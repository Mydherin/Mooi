"""Feature: agent sessions.

The whole feature — wire contracts, in-memory registry, orchestration and REST/SSE endpoints —
lives in this single file (project architecture rule): it may only import transversal aspects from
`shared/`.

A session pairs one player, one project, one agent provider and one Git workspace: `Session` is the
in-memory record of that pairing, `SessionRegistry` is the process-wide table of live sessions
(there is no database), and `record` is the one fold that turns events into session state — every
endpoint below goes through it and nothing else assigns a session's status.

Sessions and their event logs are memory-resident. After an ungraceful restart they cannot be
resumed; marked on-disk session directories are reconciled at startup. `start_reaper()` closes idle sessions and `close_all()` closes sessions during a
graceful shutdown; `main.py`'s lifespan owns calling both.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator, Coroutine
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from mic_sessions.shared import mooi, workspaces
from mic_sessions.shared.agents import (
    STATUS_PROVISIONING,
    STATUS_FAILED,
    AgentConfig,
    PROVIDERS,
    STATUS_READY,
    STATUS_WAITING,
    STATUS_WORKING,
    AgentEvent,
    AgentRuntime,
    Ask,
    Emit,
    PermissionRequest,
    QuestionRequest,
    changes_updated,
    create_runtime,
    describe,
    message_user,
    session_configuration,
    session_status,
)
from mic_sessions.shared.auth import Caller, current_caller
from mic_sessions.shared.env import get_settings
from mic_sessions.shared.events import Event, EventLog, sse_frame, sse_heartbeat
from mic_sessions.shared.web import ApiException

LOG = logging.getLogger("sessions")

_BRANCH_PATTERN = r"^[A-Za-z0-9._\-/]{1,120}$"
_UNSET_PATH = Path()
_LAST_EVENT_ID_HEADER = "Last-Event-ID"

PENDING_KIND_PERMISSION = "permission"
PENDING_KIND_QUESTION = "question"

# Event types the fold below reacts to; every other type is transcript only.
EVENT_SESSION_STATUS = "session.status"
EVENT_PERMISSION_REQUEST = "permission.request"
EVENT_QUESTION_REQUEST = "question.request"
EVENT_PERMISSION_RESOLVED = "permission.resolved"
EVENT_QUESTION_RESOLVED = "question.resolved"
EVENT_TURN_RESULT = "turn.result"
EVENT_TOOL_USE = "tool.use"
EVENT_TOOL_RESULT = "tool.result"
EVENT_SESSION_CONFIGURATION = "session.configuration"

# --- wire contracts ---------------------------------------------------------------------------


class CreateSessionRequest(BaseModel):
    projectId: UUID
    provider: str
    branch: str = Field(pattern=_BRANCH_PATTERN)
    title: str | None = None
    model: str | None = None
    effort: str | None = None


class PendingPayload(BaseModel):
    kind: str
    requestId: str


class SessionPayload(BaseModel):
    id: UUID
    projectId: UUID
    projectFullName: str
    provider: str
    providerLabel: str
    branch: str
    baseBranch: str
    title: str | None
    status: str
    detail: str | None
    createdAt: datetime
    updatedAt: datetime
    lastSeq: int
    pending: PendingPayload | None
    capabilities: dict[str, bool]
    model: str
    effort: str | None


class SessionsResponse(BaseModel):
    sessions: list[SessionPayload]


class SendMessageRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)


class UpdateSessionConfigurationRequest(BaseModel):
    # `model_fields_set` below distinguishes an omitted field from an explicit
    # null effort, which is how clients select a model with no effort setting.
    model: str | None = Field(default=None, min_length=1, max_length=120)
    effort: str | None = Field(default=None, max_length=40)


class SendMessageResponse(BaseModel):
    seq: int


class PermissionDecisionRequest(BaseModel):
    decision: Literal["allow", "deny"]
    message: str | None = None
    updatedInput: dict[str, Any] | None = None


class QuestionAnswerRequest(BaseModel):
    answers: dict[str, str | list[str]]
    response: str | None = None


class ChangedFilePayload(BaseModel):
    path: str
    change: str
    added: int
    removed: int


class ChangesPayload(BaseModel):
    status: Literal["ready", "error"] = "ready"
    error: str | None = None
    branch: str
    baseBranch: str
    added: int
    removed: int
    files: list[ChangedFilePayload]


class FileDiffPayload(BaseModel):
    path: str
    diff: str


# --- in-memory session record ------------------------------------------------------------------


@dataclass(frozen=True)
class PendingInfo:
    """What the session is currently blocked on, mirrored from the runtime's own `ask` calls since
    the `AgentRuntime` protocol does not expose its pending requests directly."""

    kind: str
    request_id: str


@dataclass
class Session:
    """One live pairing of player, project, provider and workspace.

    Registered immediately in provisioning; runtime and workspace arrive asynchronously.
    A failed session remains inspectable until closed.
    """

    id: UUID
    player_id: UUID
    project_id: UUID
    project_full_name: str
    provider: str
    branch: str
    base_branch: str
    base_commit: str
    title: str | None
    status: str
    detail: str | None
    created_at: datetime
    updated_at: datetime
    workspace: Path
    log: EventLog
    runtime: AgentRuntime | None
    config: AgentConfig = field(default_factory=lambda: AgentConfig("", None))
    closing: bool = False
    turn_id: str | None = None
    pending: PendingInfo | None = None
    interactions: dict[str, dict[str, Any]] = field(default_factory=dict)
    # --- push-based changes refresh ---
    changes_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    changes_task: asyncio.Task[None] | None = None
    changes_revision: int = 0
    changes_dirty: bool = False
    tasks: set[asyncio.Task[None]] = field(default_factory=set)
    operation_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def to_payload(self) -> SessionPayload:
        descriptor = describe(self.provider)
        return SessionPayload(
            id=self.id,
            projectId=self.project_id,
            projectFullName=self.project_full_name,
            provider=self.provider,
            providerLabel=descriptor.label,
            branch=self.branch,
            baseBranch=self.base_branch,
            title=self.title,
            status=self.status,
            detail=self.detail,
            createdAt=self.created_at,
            updatedAt=self.updated_at,
            lastSeq=self.log.last_seq,
            pending=PendingPayload(kind=self.pending.kind, requestId=self.pending.request_id)
            if self.pending is not None
            else None,
            capabilities=descriptor.capabilities.as_payload(),
            model=self.config.model,
            effort=self.config.effort,
        )


def new_session(
    session_id: UUID,
    player_id: UUID,
    project_id: UUID,
    project_full_name: str,
    provider: str,
    branch: str,
    base_branch: str,
    title: str | None,
) -> Session:
    """Builds a session in `provisioning`, before any of the slow orchestration steps have run."""
    now = datetime.now(timezone.utc)
    return Session(
        id=session_id,
        player_id=player_id,
        project_id=project_id,
        project_full_name=project_full_name,
        provider=provider,
        branch=branch,
        base_branch=base_branch,
        base_commit="",
        title=title,
        status="provisioning",
        detail=None,
        created_at=now,
        updated_at=now,
        workspace=_UNSET_PATH,
        log=EventLog(),
        runtime=None,
    )


class SessionRegistry:
    """The process-wide table of live sessions. Reads need no lock (no `await` runs between a dict
    read and its use, so nothing else can interleave); mutations do, to keep the two limits in
    `add` correct under concurrent creations."""

    def __init__(self) -> None:
        self._sessions: dict[UUID, Session] = {}
        self._lock = asyncio.Lock()

    def check_limits(self, player_id: UUID) -> None:
        """Fails fast before the expensive clone/workspace/runtime work — best effort only:
        `add` is what actually enforces the limits atomically once the session is ready."""
        settings = get_settings()
        if len(self._sessions) >= settings.max_sessions:
            raise ApiException.conflict("The pod has reached its session limit")
        owned = sum(1 for session in self._sessions.values() if session.player_id == player_id)
        if owned >= settings.max_sessions_per_player:
            raise ApiException.conflict("You have reached your session limit")

    async def add(self, session: Session) -> None:
        settings = get_settings()
        async with self._lock:
            if len(self._sessions) >= settings.max_sessions:
                raise ApiException.conflict("The pod has reached its session limit")
            owned = sum(1 for existing in self._sessions.values() if existing.player_id == session.player_id)
            if owned >= settings.max_sessions_per_player:
                raise ApiException.conflict("You have reached your session limit")
            self._sessions[session.id] = session

    def get_for(self, caller: Caller, session_id: UUID) -> Session:
        """404 whether the session is missing or owned by another player — the same answer for
        both, so a caller cannot probe for the existence of someone else's session."""
        session = self._sessions.get(session_id)
        if session is None or session.player_id != caller.player_id:
            raise ApiException.not_found("Session not found")
        return session

    def get(self, session_id: UUID) -> Session | None:
        return self._sessions.get(session_id)

    def list_for(self, player_id: UUID, project_id: UUID | None) -> list[Session]:
        sessions = [session for session in self._sessions.values() if session.player_id == player_id]
        if project_id is not None:
            sessions = [session for session in sessions if session.project_id == project_id]
        return sorted(sessions, key=lambda session: session.created_at, reverse=True)

    async def remove(self, session_id: UUID) -> Session | None:
        async with self._lock:
            return self._sessions.pop(session_id, None)

    def count(self) -> int:
        return len(self._sessions)

    def all(self) -> list[Session]:
        return list(self._sessions.values())


@lru_cache
def get_registry() -> SessionRegistry:
    return SessionRegistry()


_reaper_task: asyncio.Task[None] | None = None


# --- the event fold ----------------------------------------------------------------------------


def record(session: Session, type_: str, data: dict[str, Any]) -> Event:
    """Appends one event to the session's log and applies the state transition it implies.

    This is the single fold over events: the log is the source of truth and every
    piece of session state that the SPA can also derive — `status`, `detail`, `pending` — is
    derived here from the very events the SPA receives, so server and client can never disagree.
    Nothing else in this feature assigns `session.status` or `session.pending`.

    `updated_at` is bumped by *any* event, which is exactly what the idle reaper reads as activity.
    Sync on purpose: everything runs on one event loop, so the runtime's pump task and the request
    handlers never interleave mid-function and no lock is needed.
    """
    if type_ == "message.user":
        session.turn_id = uuid4().hex
    event = session.log.append(type_, {**data, "turnId": session.turn_id})
    session.updated_at = event.at

    if type_ == EVENT_SESSION_STATUS:
        session.status = str(data.get("status") or session.status)
        session.detail = data.get("detail")
        if session.status in (STATUS_FAILED, "closed"):
            session.interactions.clear()
            session.pending = None
    elif type_ in (EVENT_PERMISSION_REQUEST, EVENT_QUESTION_REQUEST):
        kind = PENDING_KIND_PERMISSION if type_ == EVENT_PERMISSION_REQUEST else PENDING_KIND_QUESTION
        session.status = STATUS_WAITING
        session.pending = PendingInfo(kind=kind, request_id=str(data.get("requestId") or ""))
        session.interactions[session.pending.request_id] = {"kind": kind, **data}
    elif type_ in (EVENT_PERMISSION_RESOLVED, EVENT_QUESTION_RESOLVED):
        session.interactions.pop(str(data.get("requestId")), None)
        remaining = next(iter(session.interactions.values()), None)
        session.status = STATUS_WAITING if remaining else STATUS_WORKING
        session.pending = PendingInfo(remaining["kind"], remaining["requestId"]) if remaining else None
    elif type_ == EVENT_TURN_RESULT:
        session.status = STATUS_READY
        session.pending = None
        session.interactions.clear()
        session.turn_id = None
    elif type_ == EVENT_SESSION_CONFIGURATION:
        session.config = AgentConfig(
            model=str(data.get("model") or session.config.model),
            effort=data.get("effort"),
        )

    _observe_changes(session, type_, data)
    return event


def _record_event(session: Session, event: AgentEvent) -> Event:
    """Records an event helper from `shared/agents.py` through the fold above."""
    return record(session, event["type"], event["data"])


def _record_status(session: Session, status_: str, detail: str | None = None) -> Event:
    """Records a `session.status` event, built by the same helper the adapters use."""
    return _record_event(session, session_status(status_, detail))


# --- push-based changes refresh ----------------------------------------------------------------


def _changes_payload(session: Session, summary: workspaces.ChangesSummary) -> ChangesPayload:
    return ChangesPayload(
        status="ready",
        error=None,
        branch=session.branch,
        baseBranch=session.base_branch,
        added=summary.added,
        removed=summary.removed,
        files=[
            ChangedFilePayload(path=file.path, change=file.change, added=file.added, removed=file.removed)
            for file in summary.files
        ],
    )


def _changes_error_payload(session: Session) -> ChangesPayload:
    return ChangesPayload(
        status="error",
        error="Could not calculate changes. Retry to refresh.",
        branch=session.branch,
        baseBranch=session.base_branch,
        added=0,
        removed=0,
        files=[],
    )


def _observe_changes(session: Session, type_: str, data: dict[str, Any]) -> None:
    """Marks the workspace dirty from every possible tool mutation and every terminal turn state.

    The event fold is the only observation point, so tools added by the provider do not have to be
    added to a fragile allowlist before their writes can refresh the panel.
    """
    if type_ == EVENT_TOOL_RESULT:
        _schedule_changes_refresh(session, debounce=True)
    elif type_ == EVENT_TURN_RESULT or (type_ == EVENT_SESSION_STATUS and data.get("status") == STATUS_FAILED):
        _schedule_changes_refresh(session, debounce=False)


def _schedule_changes_refresh(session: Session, *, debounce: bool) -> None:
    """Ensures one trailing worker exists and preserves signals that arrive while it calculates."""
    if session.workspace == _UNSET_PATH or session.closing:
        return
    session.changes_revision += 1
    session.changes_dirty = True
    pending = session.changes_task
    if pending is not None and not pending.done():
        if debounce:
            return
        pending.cancel()
    delay = get_settings().changes_debounce_seconds if debounce else 0.0
    session.changes_task = _spawn(session, _refresh_changes(session, delay))


async def _refresh_changes(session: Session, delay: float) -> None:
    """Runs the single trailing changes worker and publishes ready/error states through the log."""
    try:
        if delay > 0:
            await asyncio.sleep(delay)
        while not session.closing:
            revision = session.changes_revision
            session.changes_dirty = False
            try:
                async with session.operation_lock:
                    if session.closing:
                        return
                    async with session.changes_lock:
                        summary = await workspaces.changes(session.workspace, session.base_commit)
                _record_event(session, changes_updated(_changes_payload(session, summary).model_dump()))
            except asyncio.CancelledError:
                raise
            except Exception:
                LOG.warning("Session %s could not refresh its changes", session.id, exc_info=True)
                if not session.closing:
                    _record_event(session, changes_updated(_changes_error_payload(session).model_dump()))
                if not session.changes_dirty and session.changes_revision == revision:
                    return
            if not session.changes_dirty and session.changes_revision == revision:
                return
    except asyncio.CancelledError:
        raise
    finally:
        if session.changes_task is asyncio.current_task():
            session.changes_task = None


def _spawn(session: Session, coro: Coroutine[Any, Any, None]) -> asyncio.Task[None]:
    """Keeps a strong reference to a background task for as long as it runs — the event loop only
    holds a weak one — and hands `_teardown` something to cancel."""
    task = asyncio.create_task(coro)
    session.tasks.add(task)
    task.add_done_callback(session.tasks.discard)
    return task


def _runtime(session: Session) -> AgentRuntime:
    """Reject commands while provisioning has not yet assigned a runtime."""
    if session.runtime is None:
        raise ApiException.conflict("The workspace is still being prepared")
    return session.runtime


def _emitter(session: Session) -> Emit:
    """The `Emit` the adapter publishes through: a thin async wrapper over the sync fold."""

    async def emit(type_: str, data: dict[str, Any]) -> None:
        if not session.closing:
            record(session, type_, data)

    return emit


def _asker(session: Session) -> Ask:
    """The `Ask` the adapter announces its blocked state through — deliberately near-empty.

    An adapter emits `permission.request` / `question.request` *before* calling `ask`, so `record`
    has already moved the session to `waiting` by the time this runs: deriving that state from the
    event instead of from the callback keeps one fold for both server and SPA. The
    callback stays in the protocol as the explicit blocked signal for a future adapter whose SDK
    cannot emit one.
    """

    async def ask(request: PermissionRequest | QuestionRequest) -> dict[str, Any]:
        LOG.debug("Session %s is blocked on request %s", session.id, request.request_id)
        return {}

    return ask


# --- endpoints ---------------------------------------------------------------------------------

router = APIRouter(tags=["sessions"])


async def _teardown(session: Session) -> None:
    """Join provisioning and runtime shutdown before deleting this session's clone."""
    tasks = [task for task in session.tasks if task is not asyncio.current_task()]
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    session.tasks.difference_update(tasks)
    session.changes_task = None
    try:
        await _cleanup_workspace(session)
    finally:
        session.log.close()


async def _cleanup_workspace(session: Session) -> None:
    if session.runtime is not None:
        try:
            await session.runtime.close()
        except Exception:
            LOG.exception("Session %s runtime shutdown failed; retaining workspace", session.id)
            return
        session.runtime = None
    if session.workspace != _UNSET_PATH:
        try:
            await workspaces.remove_workspace(session.id)
            session.workspace = _UNSET_PATH
        except Exception:
            LOG.exception("Session %s workspace cleanup failed", session.id)


async def _close_registered_session(session: Session) -> None:
    """Close a session while its operation lock is held."""
    removed = await get_registry().remove(session.id)
    if removed is None:
        return
    session.closing = True
    _record_status(session, "closed", "This session was closed")
    await _teardown(session)
    LOG.info("Session %s closed", session.id)


async def close_session(session_id: UUID) -> None:
    """Closes and removes one registered session. Reused by `DELETE /sessions/{id}` and by the
    idle reaper and shutdown hook, neither of which has a caller to check ownership against — that
    check, when one is needed, is the caller's job before calling this."""
    registry = get_registry()
    session = registry.get(session_id)
    if session is None:
        return
    async with session.operation_lock:
        await _close_registered_session(session)


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest, caller: Annotated[Caller, Depends(current_caller)]
) -> SessionPayload:
    """Reserve a session immediately; provision it in a tracked background task."""
    descriptor = describe(body.provider)
    registry = get_registry()
    config = descriptor.configure(body.model, body.effort)
    await workspaces.get_workspaces().validate_branch(body.branch)

    session = new_session(
        session_id=uuid4(),
        player_id=caller.player_id,
        project_id=body.projectId,
        project_full_name="",
        provider=descriptor.id,
        branch=body.branch,
        base_branch="",
        title=body.title,
    )

    session.config = config
    project = await mooi.fetch_project(caller, body.projectId)
    session.project_full_name = project.full_name
    session.base_branch = project.default_branch
    await registry.add(session)
    _record_status(session, STATUS_PROVISIONING, "Preparing the workspace")
    _spawn(session, _provision(session, caller, project))
    return session.to_payload()


async def _provision(session: Session, caller: Caller, project: mooi.Project) -> None:
    descriptor = describe(session.provider)
    started_at = time.perf_counter()
    try:
        _record_status(session, STATUS_PROVISIONING, "Loading the project")
        session.project_full_name = project.full_name
        session.base_branch = project.default_branch

        _record_status(session, STATUS_PROVISIONING, f"Loading {descriptor.label} and repository credentials")
        credential, github_token = await asyncio.gather(
            mooi.fetch_agent_credential(caller, descriptor.id),
            mooi.fetch_github_token(caller),
        )

        _record_status(session, STATUS_PROVISIONING, f"Cloning {project.full_name}")
        workspace = await workspaces.create_workspace(project, session.id, session.branch, github_token)
        session.workspace = workspace.path
        session.base_commit = workspace.base_commit

        _record_status(session, STATUS_PROVISIONING, f"Starting {descriptor.label}")
        runtime = create_runtime(
            descriptor.id,
            credential,
            workspace.path,
            session.branch,
            _emitter(session),
            _asker(session),
            session.config,
        )
        session.runtime = runtime
        await runtime.start()

        if session.closing:
            return
        _record_status(session, STATUS_READY)
    except asyncio.CancelledError:
        await _cleanup_workspace(session)
        raise
    except Exception:
        if session.closing:
            return
        LOG.exception("Session %s could not be provisioned", session.id)
        await _cleanup_workspace(session)
        record(session, "error", {"message": "The session could not be started. Check provider and repository access."})
        _record_status(session, STATUS_FAILED, "Workspace provisioning failed")
    finally:
        LOG.info("Session %s provisioning finished in %.0f ms", session.id, (time.perf_counter() - started_at) * 1000)


@router.get("/sessions/providers")
async def session_providers(caller: Annotated[Caller, Depends(current_caller)]) -> dict[str, Any]:
    return {"providers": [descriptor.configuration() for descriptor in PROVIDERS.values()]}


@router.get("/sessions")
async def list_sessions(
    caller: Annotated[Caller, Depends(current_caller)], projectId: UUID | None = None
) -> SessionsResponse:
    sessions = get_registry().list_for(caller.player_id, projectId)
    return SessionsResponse(sessions=[session.to_payload() for session in sessions])


@router.get("/sessions/{session_id}")
async def get_session(session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> SessionPayload:
    return get_registry().get_for(caller, session_id).to_payload()


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> None:
    """Always `204`: an unknown id and another player's session both no-op here, deliberately not
    `get_for`'s `404` — either way the caller learns nothing about whether the id exists."""
    try:
        get_registry().get_for(caller, session_id)
    except ApiException:
        return
    await close_session(session_id)


@router.get("/sessions/{session_id}/events")
async def stream_session_events(
    session_id: UUID,
    request: Request,
    caller: Annotated[Caller, Depends(current_caller)],
    after: int = 0,
) -> StreamingResponse:
    """Live tail of the session's event log.

    Subscribes *before* replaying: `EventLog.subscribe` registers its queue synchronously, so any
    event appended between that call and `replay()` lands in the queue instead of being lost, and
    is simply skipped as a duplicate once the live loop reaches it — its `seq` is not greater than
    the last replayed one. `Last-Event-ID` is accepted as a fallback for `after`.
    """
    session = get_registry().get_for(caller, session_id)
    last_event_id = request.headers.get(_LAST_EVENT_ID_HEADER)
    if last_event_id is not None:
        with suppress(ValueError):
            after = int(last_event_id)

    settings = get_settings()
    queue = session.log.subscribe()

    async def frames() -> AsyncIterator[str]:
        try:
            last_seq = after
            replay = session.log.replay(after)
            sync = Event(session.log.last_seq, datetime.now(timezone.utc), "session.sync", {
                "session": session.to_payload().model_dump(mode="json"),
                "pending": list(session.interactions.values()),
            })
            if after < session.log.first_seq - 1 or after > session.log.last_seq:
                last_seq = session.log.first_seq - 1
                replay = session.log.replay(last_seq)
                yield sse_frame(Event(last_seq, datetime.now(timezone.utc), "history.reset", {
                    "message": "Earlier trace events are no longer retained in memory. Showing available history."
                }))
            for event in replay:
                yield sse_frame(event)
                last_seq = event.seq
            yield sse_frame(sync)
            last_seq = sync.seq
            next_auth_check = time.monotonic()
            while True:
                if time.monotonic() >= next_auth_check:
                    try:
                        await current_caller(request)
                    except Exception:
                        return
                    next_auth_check = time.monotonic() + settings.introspection_cache_seconds
                if await request.is_disconnected():
                    return
                try:
                    event = await asyncio.wait_for(queue.get(), settings.sse_heartbeat_seconds)
                except TimeoutError:
                    yield sse_heartbeat()
                    continue
                if event is None:
                    return
                if event.seq > last_seq:
                    yield sse_frame(event)
                    last_seq = event.seq
        finally:
            session.log.unsubscribe(queue)

    return StreamingResponse(
        frames(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/sessions/{session_id}/messages", status_code=status.HTTP_202_ACCEPTED)
async def send_message(
    session_id: UUID, body: SendMessageRequest, caller: Annotated[Caller, Depends(current_caller)]
) -> SendMessageResponse:
    session = get_registry().get_for(caller, session_id)
    if not body.text.strip():
        raise ApiException.bad_request("Message cannot be blank")
    async with session.operation_lock:
        if session.status != STATUS_READY or session.closing:
            raise ApiException.conflict("The session is not ready to accept a message")
        # Configuration events describe the user's selection for the next turn.
        # Reconcile here even after provisioning, which may have started with an
        # older selection. A failed update leaves the draft and session retryable.
        runtime = _runtime(session)
        try:
            await runtime.set_configuration(session.config)
        except ApiException:
            raise
        except Exception:
            LOG.warning("Session %s could not apply its configuration", session.id, exc_info=True)
            raise ApiException.bad_gateway("The agent could not apply the selected configuration") from None
        if session.status != STATUS_READY or session.closing:
            raise ApiException.conflict("The session is not ready to accept a message")
        event = _record_event(session, message_user(uuid4().hex, body.text))
        _record_status(session, STATUS_WORKING)
        try:
            await runtime.send(body.text)
        except Exception:
            record(session, "error", {"message": "The message could not be delivered to the agent"})
            _record_status(session, STATUS_FAILED, "Agent transport failed")
            raise ApiException.bad_gateway("The message could not be delivered") from None
        return SendMessageResponse(seq=event.seq)


@router.patch("/sessions/{session_id}/configuration")
async def update_session_configuration(
    session_id: UUID,
    body: UpdateSessionConfigurationRequest,
    caller: Annotated[Caller, Depends(current_caller)],
) -> SessionPayload:
    session = get_registry().get_for(caller, session_id)
    descriptor = describe(session.provider)
    async with session.operation_lock:
        if session.closing or session.status not in (STATUS_PROVISIONING, STATUS_READY, STATUS_WORKING, STATUS_WAITING):
            raise ApiException.conflict("Configuration cannot be changed for this session")

        changed_fields = body.model_fields_set
        if not changed_fields:
            raise ApiException.bad_request("Provide a model or effort to change")
        if "model" in changed_fields and body.model is None:
            raise ApiException.bad_request("Model cannot be null")

        model = body.model if "model" in changed_fields else session.config.model
        effort = body.effort if "effort" in changed_fields else (
            None if model != session.config.model else session.config.effort
        )
        candidate = descriptor.configure(model, effort)
        # Never touch a running turn or a runtime still being provisioned.
        # send_message applies the latest selection under this same lock.
        _record_event(session, session_configuration(candidate.model, candidate.effort))
        return session.to_payload()


@router.post("/sessions/{session_id}/interrupt", status_code=status.HTTP_202_ACCEPTED)
async def interrupt_session(session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> None:
    """Request interruption; only the provider's terminal result makes the session ready."""
    session = get_registry().get_for(caller, session_id)
    async with session.operation_lock:
        if session.status not in (STATUS_WORKING, STATUS_WAITING) or session.closing:
            raise ApiException.conflict("There is no active turn to interrupt")
        await _runtime(session).interrupt()


@router.post("/sessions/{session_id}/permissions/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def resolve_permission(
    session_id: UUID,
    request_id: str,
    body: PermissionDecisionRequest,
    caller: Annotated[Caller, Depends(current_caller)],
) -> None:
    session = get_registry().get_for(caller, session_id)
    pending = session.interactions.get(request_id)
    if pending is None or pending["kind"] != "permission":
        raise ApiException.not_found("Unknown permission request")
    await _runtime(session).resolve(request_id, body.model_dump())


@router.post("/sessions/{session_id}/questions/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def resolve_question(
    session_id: UUID,
    request_id: str,
    body: QuestionAnswerRequest,
    caller: Annotated[Caller, Depends(current_caller)],
) -> None:
    session = get_registry().get_for(caller, session_id)
    pending = session.interactions.get(request_id)
    if pending is None or pending["kind"] != "question":
        raise ApiException.not_found("Unknown question request")
    expected = {question["question"] for question in pending.get("questions", [])}
    if set(body.answers) != expected or any(not answer for answer in body.answers.values()):
        raise ApiException.bad_request("Answer every question before continuing")
    for question in pending.get("questions", []):
        answer = body.answers[question["question"]]
        if isinstance(answer, list) and not question.get("multiSelect"):
            raise ApiException.bad_request("This question requires a single answer")
        values = answer if isinstance(answer, list) else [answer]
        if any(not value.strip() for value in values):
            raise ApiException.bad_request("Answers cannot be blank")
    await _runtime(session).resolve(request_id, body.model_dump())


@router.get("/sessions/{session_id}/changes")
async def get_changes(session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> ChangesPayload:
    session = get_registry().get_for(caller, session_id)
    async with session.operation_lock:
        if session.workspace == _UNSET_PATH:
            return _changes_payload(session, workspaces.ChangesSummary(files=[], added=0, removed=0))
        try:
            async with session.changes_lock:
                summary = await workspaces.changes(session.workspace, session.base_commit)
            return _changes_payload(session, summary)
        except asyncio.CancelledError:
            raise
        except Exception:
            LOG.warning("Session %s could not load its changes", session.id, exc_info=True)
            return _changes_error_payload(session)


@router.get("/sessions/{session_id}/changes/file")
async def get_file_diff(
    session_id: UUID, path: str, caller: Annotated[Caller, Depends(current_caller)]
) -> FileDiffPayload:
    session = get_registry().get_for(caller, session_id)
    async with session.operation_lock:
        if session.workspace == _UNSET_PATH:
            raise ApiException.conflict("The workspace is still being prepared")
        diff = await workspaces.file_diff(session.workspace, session.base_commit, path)
        return FileDiffPayload(path=path, diff=diff)



# --- lifecycle safety --------------------------------------------------------------------------


async def _reap_idle_sessions() -> None:
    """Reap only ready/failed sessions; never expire active turns or pending user input."""
    settings = get_settings()
    timeout = timedelta(minutes=settings.session_idle_timeout_minutes)
    cutoff = datetime.now(timezone.utc) - timeout
    idle = [session.id for session in get_registry().all()
            if session.status in (STATUS_READY, STATUS_FAILED) and session.updated_at < cutoff]
    for session_id in idle:
        LOG.info("Session %s reaped after %s idle", session_id, timeout)
        await close_session(session_id)


async def _reaper_loop() -> None:
    settings = get_settings()
    interval = max(60, settings.session_idle_timeout_minutes * 60 // 4)
    try:
        while True:
            await asyncio.sleep(interval)
            with suppress(Exception):
                await _reap_idle_sessions()
    except asyncio.CancelledError:
        raise


def start_reaper() -> None:
    """Starts the background idle reaper. Called once from `main.py`'s `lifespan` on startup;
    `close_all` cancels it again on shutdown."""
    global _reaper_task
    if _reaper_task is None:
        _reaper_task = asyncio.create_task(_reaper_loop())


async def close_all() -> None:
    """Closes every live session — runtime disconnect and workspace removal, via `close_session` —
    and stops the reaper. Called once from `main.py`'s `lifespan` on shutdown."""
    global _reaper_task
    if _reaper_task is not None:
        _reaper_task.cancel()
        with suppress(asyncio.CancelledError):
            await _reaper_task
        _reaper_task = None
    for session in get_registry().all():
        await close_session(session.id)
