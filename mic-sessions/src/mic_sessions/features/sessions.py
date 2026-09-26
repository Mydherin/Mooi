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
import hashlib
import json
import logging
import os
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Coroutine
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal
from urllib.parse import unquote, urlsplit
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    TypeAdapter,
    ValidationError,
    model_validator,
)

from mic_sessions.shared import mooi, workspaces
from mic_sessions.shared.agents import (
    PROVIDERS,
    STATUS_FAILED,
    STATUS_PROVISIONING,
    STATUS_READY,
    STATUS_WAITING,
    STATUS_WORKING,
    AgentConfig,
    AgentEvent,
    AgentRuntime,
    Ask,
    Emit,
    PermissionRequest,
    QuestionRequest,
    StructuredOperation,
    StructuredOperationError,
    StructuredTool,
    changes_updated,
    create_runtime,
    describe,
    execute_structured,
    message_user,
    session_configuration,
    session_status,
)
from mic_sessions.shared.auth import Caller, current_caller
from mic_sessions.shared.docker import (
    Docker,
    DockerComposeBuild,
    DockerError,
    DockerManifestError,
    DockerManifests,
    DockerPortRequest,
    redact_deployment_output,
)
from mic_sessions.shared.env import get_settings
from mic_sessions.shared.events import Event, EventLog, sse_frame, sse_heartbeat
from mic_sessions.shared.web import ApiException

LOG = logging.getLogger("sessions")

_BRANCH_PATTERN = r"^[A-Za-z0-9._\-/]{1,120}$"
_UNSET_PATH = Path()
_LAST_EVENT_ID_HEADER = "Last-Event-ID"

PENDING_KIND_PERMISSION = "permission"
PENDING_KIND_QUESTION = "question"

# Event types the fold below reacts to; deployment events are independent of chat turns.
EVENT_SESSION_STATUS = "session.status"
EVENT_PERMISSION_REQUEST = "permission.request"
EVENT_QUESTION_REQUEST = "question.request"
EVENT_PERMISSION_RESOLVED = "permission.resolved"
EVENT_QUESTION_RESOLVED = "question.resolved"
EVENT_TURN_RESULT = "turn.result"
EVENT_TOOL_USE = "tool.use"
EVENT_TOOL_RESULT = "tool.result"
EVENT_SESSION_CONFIGURATION = "session.configuration"
EVENT_DEPLOYMENT_UPDATED = "deployment.updated"
EVENT_DEPLOYMENT_PROGRESS = "deployment.progress"
EVENT_DEPLOYMENT_ACTIVITY = "deployment.activity"
EVENT_SESSION_CLEARED = "session.cleared"
EVENT_MERGE_COMPLETED = "merge.completed"

# --- wire contracts ---------------------------------------------------------------------------


DeploymentState = Literal["stopped", "starting", "running", "stopping", "failed"]
DeploymentAction = Literal["start", "stop"]
DeploymentErrorCode = Literal[
    "not_web_application", "missing_configuration", "unsupported_project",
    "provider_unavailable", "model_unavailable", "docker_unavailable", "invalid_compose",
    "port_unavailable", "startup_failed", "health_check_failed", "invalid_agent_output",
    "timeout", "cancelled", "cleanup_failed",
]
_PREVIEW_URL = TypeAdapter(HttpUrl)


class DeploymentContract(BaseModel):
    """Strict, immutable deployment contracts; nullable fields remain present on the wire."""

    model_config = ConfigDict(strict=True, extra="forbid", frozen=True)


class DeploymentReason(DeploymentContract):
    code: DeploymentErrorCode
    # Callers must supply a public, redacted message, never raw SDK/subprocess output.
    message: str = Field(min_length=1, max_length=1000, pattern=r"\S")


def _validate_preview_url(value: str | None) -> None:
    if value is None:
        return
    url = _PREVIEW_URL.validate_python(value)
    if url.username is not None or url.password is not None or url.fragment is not None:
        raise ValueError("Preview URL must not contain credentials or a fragment")
    # Ownership, configured host and inspected port are verified by orchestration.


class DeploymentAgentResult(DeploymentContract):
    success: bool
    reason: DeploymentReason | None
    webService: str | None = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$", max_length=128)
    containerPort: int | None = Field(ge=1, le=65535)
    path: str | None = Field(max_length=2048)

    @model_validator(mode="after")
    def validate_agent_result(self) -> DeploymentAgentResult:
        if self.success:
            if self.reason is not None or any(value is None for value in
                                              (self.webService, self.containerPort, self.path)):
                raise ValueError("Successful agent output needs a web endpoint and no reason")
            _validate_deployment_path(self.path)
        elif self.reason is None or any(value is not None for value in
                                         (self.webService, self.containerPort, self.path)):
            raise ValueError("Failed agent output needs a reason and null endpoint fields")
        return self


def _validate_deployment_path(path: str) -> None:
    parts = urlsplit(path)
    decoded = unquote(path)
    if (not path.startswith("/") or path.startswith("//") or parts.scheme or parts.netloc
            or parts.fragment or "\\" in decoded or decoded.startswith("//")
            or any(ord(char) <= 32 or ord(char) == 127 for char in decoded)):
        raise ValueError("Preview path must be a local URL path")


def _validate_deployment_agent_result(raw: dict[str, Any]) -> DeploymentAgentResult:
    try:
        return DeploymentAgentResult.model_validate(raw)
    except (ValidationError, ValueError):
        raise StructuredOperationError("invalid_agent_output", "The deployment agent returned an invalid result") from None


async def _execute_deployment_agent(provider: str, operation: StructuredOperation) -> DeploymentAgentResult:
    return _validate_deployment_agent_result(await execute_structured(provider, operation))


class DeploymentArtifactCandidate(DeploymentContract):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    root: str = Field(min_length=1, max_length=512)
    manifest: str = Field(min_length=1, max_length=512)
    ecosystem: Literal["java", "node", "python", "go", "rust"]


class DeploymentArtifactSelection(DeploymentContract):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    disposition: Literal["web", "service", "dependency", "ignored"]
    service: str | None = Field(
        default=None, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$", max_length=128,
    )
    dockerfile: str | None = Field(default=None, min_length=1, max_length=512)
    reason: str | None = Field(default=None, min_length=1, max_length=500, pattern=r"\S")

    @model_validator(mode="after")
    def validate_disposition(self) -> DeploymentArtifactSelection:
        deployable = self.disposition in ("web", "service")
        if deployable and (self.service is None or self.dockerfile is None or self.reason is not None):
            raise ValueError("Deployable artifacts require service and Dockerfile only")
        if not deployable and (self.reason is None or self.service is not None or self.dockerfile is not None):
            raise ValueError("Non-deployable artifacts require a reason only")
        return self


class DeploymentPortsInput(DeploymentContract):
    composeFiles: list[str] = Field(min_length=1, max_length=1)
    webService: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$", max_length=128)
    ports: list[DockerPortRequest] = Field(min_length=1, max_length=32)
    artifacts: list[DeploymentArtifactSelection] = Field(min_length=1, max_length=64)


class DeploymentUpInput(DeploymentContract):
    containerPort: int = Field(ge=1, le=65535)
    path: str = Field(min_length=1, max_length=2048)
    expectation: Literal["html", "http"]

    @model_validator(mode="after")
    def validate_path(self) -> DeploymentUpInput:
        _validate_deployment_path(self.path)
        return self


class DeploymentResult(DeploymentContract):
    schemaVersion: Literal[1]
    operationId: UUID
    action: DeploymentAction
    success: bool
    state: Literal["running", "stopped", "failed"]
    reason: DeploymentReason | None
    previewUrl: str | None
    cleanupRequired: bool

    @model_validator(mode="after")
    def validate_outcome(self) -> DeploymentResult:
        _validate_preview_url(self.previewUrl)
        if self.success:
            expected = "running" if self.action == "start" else "stopped"
            if self.state != expected or self.reason is not None or self.cleanupRequired:
                raise ValueError("Successful deployment result must match its action and need no cleanup")
            if (self.previewUrl is not None) != (self.state == "running"):
                raise ValueError("Only a running result must contain a preview URL")
        elif self.state != "failed" or self.reason is None or self.previewUrl is not None:
            raise ValueError("Failed deployment result must include a reason and no preview URL")
        return self


class DeploymentSnapshot(DeploymentContract):
    state: DeploymentState
    operationId: UUID | None
    phase: str | None = Field(max_length=120, pattern=r"\S")
    previewUrl: str | None
    result: DeploymentResult | None
    cleanupRequired: bool
    updatedAt: AwareDatetime

    @model_validator(mode="after")
    def validate_state(self) -> DeploymentSnapshot:
        _validate_preview_url(self.previewUrl)
        if (self.previewUrl is not None) != (self.state == "running"):
            raise ValueError("Only a running snapshot must contain a preview URL")
        if self.state != "stopped" and self.operationId is None:
            raise ValueError("An active or failed deployment must identify its operation")
        if self.cleanupRequired and self.state not in ("failed", "stopping"):
            raise ValueError("Cleanup is only pending for a failed or stopping deployment")
        if self.state in ("starting", "stopping"):
            if self.result is not None:
                raise ValueError("An operation in progress cannot have a final result")
        elif self.result is None and (self.state != "stopped" or self.operationId is not None):
            raise ValueError("A completed operation must contain its final result")
        if self.result is not None and (
            self.result.operationId != self.operationId
            or self.result.state != self.state
            or self.result.previewUrl != self.previewUrl
            or self.result.cleanupRequired != self.cleanupRequired
        ):
            raise ValueError("Snapshot and final result must describe the same operation outcome")
        return self


class DeploymentProgress(DeploymentContract):
    operationId: UUID
    phase: str = Field(min_length=1, max_length=120, pattern=r"\S")
    # Public summary only, never raw SDK/subprocess output.
    message: str = Field(min_length=1, max_length=1000, pattern=r"\S")


class DeploymentActivity(DeploymentContract):
    """One bounded step of a deployment, for the session owner to follow it live.

    Emitters truncate and redact `detail` before constructing this: it is the only deployment
    contract carrying agent/engine output, and it never carries credentials or private paths.
    """

    operationId: UUID
    # Monotonic per operation, so clients can order and discard duplicates on replay.
    index: int = Field(ge=0)
    at: AwareDatetime = Field(default_factory=lambda: datetime.now(UTC))
    source: Literal["system", "agent", "tool", "docker", "probe"]
    level: Literal["debug", "info", "warning", "error", "success"]
    phase: str | None = Field(default=None, max_length=120)
    kind: Literal["phase", "assistant", "thinking", "tool", "tool_result", "log", "notice"]
    title: str = Field(min_length=1, max_length=120, pattern=r"\S")
    detail: str | None = Field(default=None, max_length=12288)
    status: Literal["running", "done", "failed"] | None = None
    # Pairs a tool with its result.
    toolId: str | None = Field(default=None, max_length=64)


class CreateSessionRequest(BaseModel):
    projectId: UUID
    provider: str
    connectionId: UUID
    branch: str = Field(pattern=_BRANCH_PATTERN)
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
    connectionId: UUID
    providerLabel: str
    branch: str
    baseBranch: str
    status: str
    detail: str | None
    createdAt: datetime
    updatedAt: datetime
    lastSeq: int
    usage: dict[str, Any] = Field(default_factory=dict)
    pending: PendingPayload | None
    capabilities: dict[str, bool]
    model: str
    effort: str | None
    deployment: DeploymentSnapshot
    # The session's own clone on this pod's disk; null until provisioning has cloned it.
    workspacePath: str | None
    baseCommit: str | None


class SessionsResponse(BaseModel):
    sessions: list[SessionPayload]


class WorkspacePayload(BaseModel):
    sessionId: UUID
    status: str
    branch: str
    baseBranch: str
    path: str | None
    baseCommit: str | None
    headCommit: str | None
    headBranch: str | None
    dirtyFiles: int
    sizeBytes: int
    createdAt: datetime
    deploymentState: str
    previewUrl: str | None


class WorkspacesResponse(BaseModel):
    root: str
    workspaces: list[WorkspacePayload]
    totalBytes: int


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


MergeState = Literal["clean", "conflicts", "up_to_date", "merged"]


class MergeRequest(BaseModel):
    message: str = Field(min_length=1, max_length=200)


class MergePayload(BaseModel):
    state: MergeState
    targetBranch: str
    conflicts: list[str]
    commit: str | None = None


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
    connection_id: UUID
    branch: str
    base_branch: str
    base_commit: str
    status: str
    detail: str | None
    created_at: datetime
    updated_at: datetime
    workspace: Path
    log: EventLog
    runtime: AgentRuntime | None
    deployment: DeploymentSnapshot
    config: AgentConfig = field(default_factory=lambda: AgentConfig("", None))
    usage: dict[str, Any] = field(default_factory=dict)
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
    deployment_task: asyncio.Task[None] | None = None
    deployment_monitor: asyncio.Task[None] | None = None
    last_human_activity: datetime = field(default_factory=lambda: datetime.now(UTC))
    activity_heartbeat_at: float | None = None

    def to_payload(self) -> SessionPayload:
        descriptor = describe(self.provider)
        return SessionPayload(
            id=self.id,
            projectId=self.project_id,
            projectFullName=self.project_full_name,
            provider=self.provider,
            connectionId=self.connection_id,
            providerLabel=descriptor.label,
            branch=self.branch,
            baseBranch=self.base_branch,
            status=self.status,
            detail=self.detail,
            createdAt=self.created_at,
            updatedAt=self.updated_at,
            lastSeq=self.log.last_seq,
            usage=self.usage,
            pending=PendingPayload(kind=self.pending.kind, requestId=self.pending.request_id)
            if self.pending is not None
            else None,
            capabilities=descriptor.capabilities.as_payload(),
            model=self.config.model,
            effort=self.config.effort,
            deployment=self.deployment,
            workspacePath=None if self.workspace == _UNSET_PATH else str(self.workspace),
            baseCommit=self.base_commit or None,
        )


def new_session(
    session_id: UUID,
    player_id: UUID,
    project_id: UUID,
    project_full_name: str,
    provider: str,
    connection_id: UUID,
    branch: str,
    base_branch: str,
) -> Session:
    """Builds a session in `provisioning`, before any of the slow orchestration steps have run."""
    now = datetime.now(UTC)
    return Session(
        id=session_id,
        player_id=player_id,
        project_id=project_id,
        project_full_name=project_full_name,
        provider=provider,
        connection_id=connection_id,
        branch=branch,
        base_branch=base_branch,
        base_commit="",
        status="provisioning",
        detail=None,
        created_at=now,
        updated_at=now,
        last_human_activity=now,
        workspace=_UNSET_PATH,
        log=EventLog(),
        usage={"context": {"percent": None, "usedTokens": 0, "limitTokens": None,
                           "updatedAt": now.timestamp()}},
        runtime=None,
        deployment=DeploymentSnapshot(
            state="stopped",
            operationId=None,
            phase=None,
            previewUrl=None,
            result=None,
            cleanupRequired=False,
            updatedAt=now,
        ),
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

    Deployment events share sequence/replay with chat but never acquire a turnId, mutate chat
    state or renew idle activity. Their payloads are validated before appending to the log.
    Other events bump display `updated_at`; expiry uses the separate human activity clock.
    Sync on purpose: everything runs on one event loop, so the runtime's pump task and the request
    handlers never interleave mid-function and no lock is needed.
    """
    if type_ == EVENT_DEPLOYMENT_UPDATED:
        snapshot = DeploymentSnapshot.model_validate(data)
        event = session.log.append(type_, snapshot.model_dump(mode="json"))
        session.deployment = snapshot
        return event
    if type_ == EVENT_DEPLOYMENT_PROGRESS:
        progress = DeploymentProgress.model_validate(data)
        return session.log.append(type_, progress.model_dump(mode="json"))
    if type_ == EVENT_DEPLOYMENT_ACTIVITY:
        activity = DeploymentActivity.model_validate(data)
        return session.log.append(type_, activity.model_dump(mode="json"))

    if type_ == "message.user":
        session.turn_id = uuid4().hex
    event = session.log.append(type_, {**data, "turnId": session.turn_id})
    session.updated_at = event.at
    if type_ == "message.user":
        _touch_activity(session, event.at)

    if type_ == "session.usage":
        previous_quota = session.usage.get("quota")
        session.usage = {**session.usage, **{key: data[key] for key in ("context", "quota") if key in data}}
        if isinstance(data.get("quota"), dict):
            session.usage["quota"] = {**(previous_quota or {}), **data["quota"]}
    elif type_ == EVENT_SESSION_STATUS:
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
    elif type_ == EVENT_SESSION_CLEARED:
        session.pending = None
        session.interactions.clear()
        session.turn_id = None
        session.usage = {**session.usage, "context": None}
    elif type_ == EVENT_SESSION_CONFIGURATION:
        if data.get("model") and data["model"] != session.config.model:
            session.usage = {**session.usage, "context": None}
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
    """Records a `session.status` event, built by the same helper the adapters use. Carries the
    clone path once it exists, so a live client learns where provisioning placed the workspace."""
    event = session_status(status_, detail)
    if session.workspace != _UNSET_PATH:
        event["data"]["workspacePath"] = str(session.workspace)
        event["data"]["baseCommit"] = session.base_commit or None
    return _record_event(session, event)


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
    # Teardown has joined deployment workers. Provisioning error paths cannot have
    # admitted a deployment. Never delete recovery evidence when Docker cleanup fails.
    docker_clean = True
    try:
        manifests = _deployment_storage()
        if manifests.directory(session.id).exists():
            _owned_deployment(session, manifests)
            await Docker().cleanup(manifests=manifests, session_id=session.id)
        _deployment_slots.discard(session.id)
    except Exception:
        LOG.debug("Background operation encountered an exception", exc_info=True)
        docker_clean = False
        LOG.warning("Session %s deployment cleanup failed; retaining workspace", session.id)
    if session.runtime is not None:
        try:
            await session.runtime.close()
        except Exception:
            LOG.exception("Session %s runtime shutdown failed; retaining workspace", session.id)
            return
        session.runtime = None
    if docker_clean and session.workspace != _UNSET_PATH:
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
    await descriptor.prepare(caller, str(body.connectionId))
    config = descriptor.configure(body.model, body.effort)
    await workspaces.get_workspaces().validate_branch(body.branch)

    session = new_session(
        session_id=uuid4(),
        player_id=caller.player_id,
        project_id=body.projectId,
        project_full_name="",
        provider=descriptor.id,
        connection_id=body.connectionId,
        branch=body.branch,
        base_branch="",
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
            mooi.fetch_agent_credential(caller, str(session.connection_id)),
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


@router.get("/sessions/providers/{provider}")
async def session_provider(provider: str, connectionId: UUID,
                           caller: Annotated[Caller, Depends(current_caller)], refresh: bool = False) -> dict[str, Any]:
    descriptor = describe(provider)
    await descriptor.prepare(caller, str(connectionId), refresh=refresh)
    return descriptor.configuration()


@router.get("/sessions/workspaces")
async def list_workspaces(
    caller: Annotated[Caller, Depends(current_caller)], projectId: UUID
) -> WorkspacesResponse:
    """Overview of every clone the caller holds for one project, read live from disk."""
    sessions = get_registry().list_for(caller.player_id, projectId)

    async def describe_workspace(session: Session) -> WorkspacePayload:
        cloned = session.workspace != _UNSET_PATH
        inspection = await workspaces.inspect(session.workspace) if cloned else None
        return WorkspacePayload(
            sessionId=session.id,
            status=session.status,
            branch=session.branch,
            baseBranch=session.base_branch,
            path=str(session.workspace) if cloned else None,
            baseCommit=session.base_commit or None,
            headCommit=inspection.head_commit if inspection else None,
            headBranch=inspection.head_branch if inspection else None,
            dirtyFiles=inspection.dirty_files if inspection else 0,
            sizeBytes=inspection.size_bytes if inspection else 0,
            createdAt=session.created_at,
            deploymentState=session.deployment.state,
            previewUrl=session.deployment.previewUrl,
        )

    payloads = await asyncio.gather(*(describe_workspace(session) for session in sessions))
    return WorkspacesResponse(
        root=str(workspaces.get_workspaces().root / "sessions"),
        workspaces=list(payloads),
        totalBytes=sum(payload.sizeBytes for payload in payloads),
    )


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
            # Includes the current deployment even when its update has fallen out of replay.
            sync = Event(session.log.last_seq, datetime.now(UTC), "session.sync", {
                "session": session.to_payload().model_dump(mode="json"),
                "pending": list(session.interactions.values()),
            })
            if after < session.log.first_seq - 1 or after > session.log.last_seq:
                last_seq = session.log.first_seq - 1
                replay = session.log.replay(last_seq)
                yield sse_frame(Event(last_seq, datetime.now(UTC), "history.reset", {
                    "message": "Earlier trace events are no longer retained in memory. Showing available history."
                }))
            for event in replay:
                yield sse_frame(event)
                last_seq = event.seq
            yield sse_frame(sync)
            last_seq = sync.seq
            next_usage_check = 0.0
            next_auth_check = time.monotonic()
            while True:
                if time.monotonic() >= next_auth_check:
                    try:
                        await current_caller(request)
                    except Exception:
                        LOG.debug("Background operation encountered an exception", exc_info=True)
                        return
                    next_auth_check = time.monotonic() + settings.introspection_cache_seconds
                if await request.is_disconnected():
                    return
                if time.monotonic() >= next_usage_check:
                    next_usage_check = time.monotonic() + 60
                    if session.runtime is not None and session.status in (STATUS_READY, STATUS_WORKING, STATUS_WAITING):
                        try:
                            await session.runtime.refresh_usage()
                        except Exception:
                            LOG.debug("Visible session usage refresh unavailable")
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
        if session.status != STATUS_READY or session.closing or session.deployment.state == "starting":
            raise ApiException.conflict("The session is not ready to accept a message")
        # Configuration events describe the user's selection for the next turn.
        # Reconcile here even after provisioning, which may have started with an
        # older selection. A failed update leaves the draft and session retryable.
        runtime = _runtime(session)
        try:
            refresh = getattr(runtime, "refresh_credential", None)
            if refresh:
                await refresh(await mooi.fetch_agent_credential(caller, str(session.connection_id)))
            await runtime.set_configuration(session.config)
        except ApiException:
            raise
        except Exception:
            LOG.warning("Session %s could not apply its configuration", session.id, exc_info=True)
            raise ApiException.bad_gateway("The agent could not apply the selected configuration") from None
        if session.status != STATUS_READY or session.closing or session.deployment.state == "starting":
            raise ApiException.conflict("The session is not ready to accept a message")
        return await _deliver(session, runtime, body.text)


async def _deliver(session: Session, runtime: AgentRuntime, text: str) -> SendMessageResponse:
    """Records the user message and hands it to the agent; the caller holds the operation lock."""
    event = _record_event(session, message_user(uuid4().hex, text))
    _record_status(session, STATUS_WORKING)
    try:
        await runtime.send(text)
    except Exception:
        LOG.debug("Background operation encountered an exception", exc_info=True)
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
    await descriptor.prepare(caller, str(session.connection_id))
    async with session.operation_lock:
        if (session.closing or session.deployment.state == "starting"
                or session.status not in (STATUS_PROVISIONING, STATUS_READY, STATUS_WORKING, STATUS_WAITING)):
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
        _touch_activity(session)
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
        _touch_activity(session)


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
    _touch_activity(session)


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
    _touch_activity(session)


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



# --- merge into the default branch -------------------------------------------------------------


def _require_mergeable(session: Session) -> None:
    """Merging reads the whole working tree, so no turn, question or deployment may be mid-flight."""
    if session.workspace == _UNSET_PATH:
        raise ApiException.conflict("The workspace is still being prepared")
    if (session.status != STATUS_READY or session.closing or session.pending is not None
            or session.deployment.state == "starting"):
        raise ApiException.conflict("Wait for the agent to finish before merging")


def _merge_payload(preview: workspaces.MergePreview, commit: str | None = None) -> MergePayload:
    state: MergeState = ("merged" if commit else "conflicts" if preview.conflicts
                         else "up_to_date" if preview.up_to_date else "clean")
    return MergePayload(state=state, targetBranch=preview.target, conflicts=preview.conflicts, commit=commit)


def _conflict_prompt(session: Session, preview: workspaces.MergePreview) -> str:
    target = f"origin/{preview.target}"
    base = preview.merge_base or f"$(git merge-base HEAD {target})"
    files = "\n".join(f"- `{path}`" for path in preview.conflicts) or "- (none reported)"
    return f"""Resolve the merge conflicts between this branch `{session.branch}` and `{preview.target}`.

`{target}` has just been fetched; do not fetch, pull, push, rebase, reset or switch branches. Both branches were last in sync at commit `{base}`.

Files expected to conflict:
{files}

1. Commit any pending change on `{session.branch}` so nothing is lost.
2. Analyze both branches since `{base}`: read `git log` and `git diff` for `{base}..HEAD` and for `{base}..{target}` to understand every feature each side added.
3. Run `git merge --no-ff --no-commit {target}`.
4. Resolve every conflict preserving the features of both branches, making whatever technical and functional decisions are needed so both keep working. When both sides implement the same feature, keep the most complete version using the cleanest, most maintainable and scalable approach.
5. Make sure no conflict markers remain and the project still builds and its checks pass where practical, then commit the merge.
6. Finish with a short summary of the decisions you took."""


async def _reset_conversation(session: Session, caller: Caller) -> AgentRuntime:
    """Replaces the runtime with a fresh one on the same workspace: a new conversation with no
    context from the previous one, for every provider alike."""
    previous = _runtime(session)
    credential = await mooi.fetch_agent_credential(caller, str(session.connection_id))
    await previous.close()
    session.runtime = None
    record(session, EVENT_SESSION_CLEARED, {})
    runtime = create_runtime(session.provider, credential, session.workspace, session.branch,
                             _emitter(session), _asker(session), session.config)
    session.runtime = runtime
    try:
        await runtime.start()
    except Exception:
        LOG.exception("Session %s could not restart its agent", session.id)
        record(session, "error", {"message": "The agent could not be restarted. Close the session and start a new one."})
        _record_status(session, STATUS_FAILED, "Agent restart failed")
        raise ApiException.bad_gateway("The agent could not be restarted") from None
    return runtime


@router.post("/sessions/{session_id}/merge/check")
async def check_merge(session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> MergePayload:
    """Dry-runs the merge against the freshly fetched default branch without touching the checkout."""
    session = get_registry().get_for(caller, session_id)
    token = await mooi.fetch_github_token(caller)
    async with session.operation_lock:
        _require_mergeable(session)
        _touch_activity(session)
        return _merge_payload(await workspaces.preview_merge(session.workspace, session.base_branch, token))


@router.post("/sessions/{session_id}/merge")
async def merge_session(
    session_id: UUID, body: MergeRequest, caller: Annotated[Caller, Depends(current_caller)]
) -> MergePayload:
    """Squashes the session's work onto the default branch as one commit and pushes it. Conflicts
    that appeared since the check are answered, not raised: the client offers resolution instead."""
    session = get_registry().get_for(caller, session_id)
    message = body.message.strip()
    if not message:
        raise ApiException.bad_request("The commit title cannot be blank")
    token, identity = await asyncio.gather(mooi.fetch_github_token(caller), mooi.fetch_github_identity(caller))
    async with session.operation_lock:
        _require_mergeable(session)
        _touch_activity(session)
        async with session.changes_lock:
            preview, commit = await workspaces.merge(session.workspace, session.base_branch, message, identity, token)
        if commit is not None:
            session.base_commit = commit
            record(session, EVENT_MERGE_COMPLETED, {"targetBranch": preview.target, "commit": commit, "message": message})
            _record_status(session, STATUS_READY)
            _schedule_changes_refresh(session, debounce=False)
        return _merge_payload(preview, commit)


@router.post("/sessions/{session_id}/merge/resolve", status_code=status.HTTP_202_ACCEPTED)
async def resolve_merge_conflicts(
    session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]
) -> SendMessageResponse:
    """Clears the conversation and asks the agent to merge the default branch in, resolving conflicts."""
    session = get_registry().get_for(caller, session_id)
    token, identity = await asyncio.gather(mooi.fetch_github_token(caller), mooi.fetch_github_identity(caller))
    async with session.operation_lock:
        _require_mergeable(session)
        preview = await workspaces.preview_merge(session.workspace, session.base_branch, token)
        if not preview.conflicts:
            raise ApiException.conflict(f"There are no conflicts with {preview.target} anymore; merge it directly")
        await workspaces.set_identity(session.workspace, identity)
        runtime = await _reset_conversation(session, caller)
        return await _deliver(session, runtime, _conflict_prompt(session, preview))


# Capacity also includes orphaned/failed resources after a session leaves the registry.
_deployment_slots: set[UUID] = set()
_deployment_capacity_lock = asyncio.Lock()
_deployment_recovery_blocked = False


async def reconcile_deployments() -> set[UUID] | None:
    """Boot-only cleanup, before workspace reconciliation; None preserves every workspace."""
    global _deployment_recovery_blocked
    _deployment_slots.clear()
    try:
        manifests = _deployment_storage()
        session_ids = manifests.session_ids()
    except Exception:
        LOG.debug("Background operation encountered an exception", exc_info=True)
        _deployment_recovery_blocked = True
        LOG.warning("Deployment recovery unavailable; preserving all workspaces and blocking Deploy")
        return None
    _deployment_recovery_blocked = False
    _deployment_slots.update(session_ids)
    preserved: set[UUID] = set()
    for session_id in session_ids:
        try:
            manifests.load(session_id)  # Validate even dangling/corrupt directory entries.
            await Docker().cleanup(manifests=manifests, session_id=session_id)
        except Exception:
            LOG.debug("Background operation encountered an exception", exc_info=True)
            preserved.add(session_id)
            LOG.warning("Deployment %s recovery failed; retaining resources and workspace", session_id)
        else:
            _deployment_slots.discard(session_id)
    return preserved


async def _reserve_deployment(session_id: UUID) -> None:
    async with _deployment_capacity_lock:
        if _deployment_recovery_blocked:
            raise ApiException.conflict("Restore deployment records and restart the service before deploying")
        if session_id in _deployment_slots:
            raise ApiException.conflict("Previous deployment resources require cleanup")
        if len(_deployment_slots) >= get_settings().max_deployments:
            raise ApiException(status.HTTP_429_TOO_MANY_REQUESTS, "Deployment capacity is full; stop an active deployment")
        _deployment_slots.add(session_id)


# --- deployment preparation and admission ------------------------------------------------------


_DEPLOYMENT_MANIFESTS = {
    "pom.xml": "java",
    "build.gradle": "java",
    "build.gradle.kts": "java",
    "package.json": "node",
    "pyproject.toml": "python",
    "go.mod": "go",
    "Cargo.toml": "rust",
}
_DEPLOYMENT_IGNORED_DIRECTORIES = {
    ".git", ".dev", ".mooi", ".codex", ".idea", ".vscode",
    "node_modules", "target", "build", "dist", ".venv", "venv",
    "__pycache__", ".pytest_cache", ".ruff_cache", ".mypy_cache", ".gradle",
}
_DEPLOYMENT_ARTIFACT_MAX_DEPTH = 4
_DEPLOYMENT_ARTIFACT_MAX_CANDIDATES = 64
_DEPLOYMENT_ARTIFACT_MAX_PATH = 512


def _deployment_artifact_candidates(checkout: Path) -> tuple[DeploymentArtifactCandidate, ...]:
    """Discover a closed, bounded manifest inventory without following checkout escapes."""
    checkout = checkout.resolve()
    if not checkout.is_dir():
        raise StructuredOperationError("unsupported_project", "The project checkout is unavailable")
    found: list[DeploymentArtifactCandidate] = []
    for current_value, directories, files in os.walk(checkout, topdown=True, followlinks=False):
        current = Path(current_value)
        relative_root = current.relative_to(checkout)
        depth = len(relative_root.parts)
        directories[:] = sorted(
            name for name in directories
            if depth < _DEPLOYMENT_ARTIFACT_MAX_DEPTH
            and name not in _DEPLOYMENT_IGNORED_DIRECTORIES
            and not name.startswith(".")
            and not (current / name).is_symlink()
        )
        for manifest_name in sorted(set(files) & _DEPLOYMENT_MANIFESTS.keys()):
            manifest_path = current / manifest_name
            try:
                resolved = manifest_path.resolve(strict=True)
            except OSError:
                continue
            if not resolved.is_file() or not resolved.is_relative_to(checkout):
                continue
            root = relative_root.as_posix() if relative_root.parts else "."
            manifest = (relative_root / manifest_name).as_posix()
            if len(root) > _DEPLOYMENT_ARTIFACT_MAX_PATH or len(manifest) > _DEPLOYMENT_ARTIFACT_MAX_PATH:
                continue
            digest = hashlib.sha256(manifest.encode()).hexdigest()[:16]
            found.append(DeploymentArtifactCandidate(
                id=f"artifact-{digest}", root=root, manifest=manifest,
                ecosystem=_DEPLOYMENT_MANIFESTS[manifest_name],
            ))
    found.sort(key=lambda candidate: (candidate.root, candidate.manifest))
    if len(found) > _DEPLOYMENT_ARTIFACT_MAX_CANDIDATES:
        raise StructuredOperationError(
            "unsupported_project", "The project contains too many deployable artifact candidates",
        )
    return tuple(found)


def _validate_artifact_classification(
    candidates: tuple[DeploymentArtifactCandidate, ...], request: DeploymentPortsInput,
) -> dict[str, tuple[DeploymentArtifactCandidate, DeploymentArtifactSelection]]:
    expected = {candidate.id: candidate for candidate in candidates}
    selected: dict[str, DeploymentArtifactSelection] = {}
    for selection in request.artifacts:
        if selection.id in selected:
            raise DockerError("invalid_compose", "Artifact classification contains duplicate IDs")
        if selection.id not in expected:
            raise DockerError("invalid_compose", "Artifact classification contains an unknown ID")
        selected[selection.id] = selection
    if set(selected) != set(expected):
        raise DockerError("invalid_compose", "Every discovered artifact must be classified")
    deployable = [selection for selection in selected.values()
                  if selection.disposition in ("web", "service")]
    if not deployable:
        raise DockerError("invalid_compose", "At least one artifact must provide the preview")
    services = [selection.service for selection in deployable]
    if len(set(services)) != len(services):
        raise DockerError("invalid_compose", "Each deployable artifact needs its own Compose service")
    web = [selection for selection in deployable if selection.disposition == "web"]
    preview = web if web else [selection for selection in deployable
                               if selection.service == request.webService]
    if not any(selection.service == request.webService for selection in preview):
        raise DockerError("invalid_compose", "Preview service does not match the artifact classification")
    return {candidate_id: (expected[candidate_id], selected[candidate_id])
            for candidate_id in expected}


def _validate_artifact_builds(
    checkout: Path,
    classified: dict[str, tuple[DeploymentArtifactCandidate, DeploymentArtifactSelection]],
    builds: tuple[DockerComposeBuild, ...],
) -> None:
    by_service = {build.service: build for build in builds}
    checkout = checkout.resolve()
    for candidate, selection in classified.values():
        if selection.disposition not in ("web", "service"):
            continue
        expected_context = checkout if candidate.root == "." else (checkout / candidate.root).resolve()
        expected_dockerfile = expected_context / "Dockerfile"
        expected_relative = "Dockerfile" if candidate.root == "." else f"{candidate.root}/Dockerfile"
        if selection.dockerfile != expected_relative:
            raise DockerError("invalid_compose", "Artifact Dockerfile must be at its artifact root")
        build = by_service.get(selection.service)
        if (build is None or build.context != expected_context
                or build.dockerfile != expected_dockerfile):
            raise DockerError("invalid_compose", "Compose must build every deployable artifact Dockerfile")


async def _existing_compose_inputs(
    docker: Docker, checkout: Path, candidates: tuple[DeploymentArtifactCandidate, ...],
    *, deadline: float,
) -> tuple[DeploymentPortsInput, DeploymentUpInput] | None:
    """Use an unambiguous root Compose directly; leave ambiguous choices to the agent."""
    compose = next((name for name in (
        "compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml",
    ) if (checkout / name).is_file()), None)
    if compose is None:
        return None
    described = await docker.describe_existing_compose(checkout, deadline=deadline)
    builds = {build.context: build for build in described.builds}
    classified = []
    web_services = []
    for candidate in candidates:
        root = checkout.resolve() if candidate.root == "." else (checkout / candidate.root).resolve()
        build = builds.get(root)
        expected = root / "Dockerfile"
        is_web = False
        if candidate.ecosystem == "node":
            try:
                package = json.loads((root / "package.json").read_text())
                dependencies = {**package.get("dependencies", {}), **package.get("devDependencies", {})}
                is_web = any(name in dependencies for name in ("vite", "react", "vue", "@angular/core", "next"))
            except (OSError, ValueError, TypeError, AttributeError):
                return None
        if build is None or build.dockerfile != expected or not expected.is_file():
            # Never hide a frontend omitted from an otherwise runnable API Compose.
            if is_web or expected.is_file():
                return None
            classified.append(DeploymentArtifactSelection(
                id=candidate.id, disposition="ignored", reason="No artifact-root Dockerfile",
            ))
            continue
        if is_web:
            web_services.append(build.service)
        classified.append(DeploymentArtifactSelection(
            id=candidate.id, disposition="web" if is_web else "service",
            service=build.service, dockerfile=("Dockerfile" if candidate.root == "."
                                               else f"{candidate.root}/Dockerfile"),
        ))
    published = [port for port in described.ports if port.protocol == "tcp"]
    if len(web_services) > 1 or not published:
        return None
    preview_ports = [port for port in published if port.service == web_services[0]] if web_services else published
    if len(preview_ports) != 1:
        return None
    preview = preview_ports[0]
    request = DeploymentPortsInput(
        composeFiles=[compose], webService=preview.service,
        ports=[preview], artifacts=classified,
    )
    _validate_artifact_classification(candidates, request)
    return request, DeploymentUpInput(
        containerPort=preview.container_port, path="/",
        expectation="html" if web_services else "http",
    )


def _deployment_prompt(candidates: tuple[DeploymentArtifactCandidate, ...]) -> str:
    settings = get_settings()
    inventory = json.dumps(
        [candidate.model_dump(mode="json") for candidate in candidates],
        ensure_ascii=False, separators=(",", ":"),
    )
    return f"""Prepare and deploy the current checkout as a web preview using Docker only.
If a root Compose file and artifact-root Dockerfiles already exist, inspect and reuse them.
Repair only the failing deployment files; do not recreate a working configuration.
Read root AGENTS.md/CLAUDE.md and instructions applicable to files you edit. Preserve existing
uncommitted work. The backend discovered this CLOSED artifact inventory: {inventory}
Classify EVERY supplied ID as web, service, dependency or ignored before writing files. Do not
invent candidates or perform another free-form repository inventory. Treat sibling directories
as potential parts of the same product. For ignored/dependency entries, provide a concrete reason.
In check_ports, copy each inventory id exactly. For web/service selections provide service and
the artifact-root Dockerfile path, with reason=null. For dependency/ignored selections provide
reason, with service=null and dockerfile=null. Port objects use container_port (snake_case).
For Node candidates read package.json, Vite/React configuration and .env.example when present.
For Java candidates read the manifest, runtime configuration and directed public routes. Read
only candidate dependency manifests, entrypoints, env examples and runtime configuration.
Do not explore unrelated harnesses, skills, documentation or source trees. Do not delegate.
If this is not a web application, return not_web_application.
Create or adapt exactly one Dockerfile at the root of EACH deployable artifact, and exactly
ONE general Compose file at repository root that builds those Dockerfiles using build.context
and build.dockerfile. Existing nested development Compose files may remain unchanged; do not
create extra Compose files or overrides. Remove only redundant files you created yourself.
Copy code into images, use dependency cache layers and artifact-specific .dockerignore files.
Prefer compatible slim/alpine images, multistage builds and built static frontends without HMR.
Include dependencies, healthchecks and named data volumes. Database/cache credentials for
services created by this Compose are yours to choose and wire consistently; they are not missing
external secrets. Give every Compose variable an explicit literal value: no unset interpolation.
Use existing health endpoints or a container-level TCP/process check. Do not add endpoints,
dependencies, or authentication exceptions to the application for a healthcheck.
Use 127.0.0.1 instead of localhost for healthchecks inside containers; some images resolve
localhost to IPv6 while the application listens only on IPv4.
For third-party OAuth/API credentials, use harmless non-secret placeholders only if the app can
start and offer a useful preview; otherwise return missing_configuration. Never fabricate real
credentials, request input, or wait for permissions. Do not read or edit credential files or .git.
For SPA + API, create a Dockerfile for BOTH artifacts and prefer ONE public frontend port with a
static server proxying the app's API routes
to the backend Compose service name and internal port. Set frontend build-time API configuration
to relative same-origin routes. If impossible, use runtime API configuration with reachable public
URLs. Only return unsupported_project for build-time public ports when neither approach works.
Listen on 0.0.0.0; dependencies communicate by service name and internal port, without published
DB/cache ports. No container_name, external resources, env_file, profiles, scaling, code bind
mounts, privileged containers, host networking, Docker sockets or global runtime installations.
Only edit deployment-related files. Never edit application source, dependency manifests,
authentication rules or runtime application configuration. No commits, push or cloud publishing. Never build, start or
stop services via shell: use the managed tools only. If adaptation is impossible, return
unsupported_project with a safe actionable explanation.
Public host: {settings.preview_public_host}; scheme: {settings.preview_scheme}.
Preview embedding origin: {settings.cors_origin}. Prepare app-specific frame headers compatible
with this origin; do not alter Mooi headers. HTTPS requires real TLS at the published endpoint.
Use the frontend service as Preview whenever a web artifact exists; use `/` and HTML readiness.
Only for a genuinely API-only product may Preview use a public unauthenticated GET endpoint.
Call check_ports exactly once per attempt with the complete artifact classification, exactly ONE
root Compose file, the web service and ALL browser-required publications
(service/container_port/protocol);
omit DB/cache publications. It freezes config
and replaces every published port with managed engine allocation. This does NOT reserve or
prove availability. Do not change the configuration after that call.
Then call start_project with the web containerPort, local URL path and readiness expectation.
Use expectation `html` whenever the classification contains a web artifact. Only a genuinely
API-only product may use expectation `http` for a public unauthenticated GET endpoint. The backend builds,
starts, inspects ALL actual bindings and verifies HTTP readiness. Review its evidence before
reporting success. If start_project fails with retriesLeft > 0, use its log to fix the indicated
files, then call check_ports again and start_project again. Never retry unchanged configuration.
Otherwise return the failure immediately. Never claim success without the tool's readiness result.
Return exactly the supplied structured schema: success, reason, webService, containerPort, path.
Success needs reason=null and the verified endpoint; failure needs a reason and null endpoint
fields. Never include credentials, private file paths or raw command output in any reason.
The backend, not your response, determines the final deployment state and preview URL.
"""


def _deployment_activity_emitter(session: Session, operation_id: UUID, secrets: list[str] | None = None) -> Callable[..., None]:
    """Bounded publisher of `deployment.activity` for one operation.

    The activity log shares the session event log with the chat, so it must not be able to
    evict the conversation: it stops after `deployment_activity_limit` entries and says so once.
    Emission is best effort — a deployment never fails because its narration could not be
    published — and stale operations are dropped rather than interleaved with a newer one.
    """
    settings = get_settings()
    state = {"index": 0, "bytes": 0, "stopped": False, "notice_sent": False}

    def emit(kind: str, title: str, detail: str | None = None, *,
             status: str | None = None, tool_id: str | None = None, final: bool = False,
             source: str = "system", level: str = "info", phase: str | None = None) -> None:
        if (state["stopped"] and not final) or session.closing:
            return
        if session.deployment.operationId != operation_id:
            return
        index = state["index"]
        sensitive = tuple(secrets or ()) + (str(session.workspace), str(get_settings().workspace_root))
        title = redact_deployment_output(title, sensitive)
        if detail is not None:
            detail = redact_deployment_output(detail, sensitive)
            detail = detail.encode("utf-8")[:min(12288, settings.deployment_activity_text_bytes)].decode("utf-8", "ignore")
            detail = detail if detail.strip() else None
        estimated = len(title.encode("utf-8")) + len((detail or "").encode("utf-8")) + 192
        over_budget = (index >= settings.deployment_activity_limit
                       or state["bytes"] + estimated > settings.deployment_activity_bytes)
        if over_budget and not final:
            state["stopped"] = True
            if state["notice_sent"]:
                return
            state["notice_sent"] = True
            kind, title, detail, status, tool_id = "notice", "Activity log truncated", None, None, None
            source, level = "system", "warning"
            estimated = len(title.encode("utf-8")) + 192
        state["index"] = index + 1
        try:
            record(session, EVENT_DEPLOYMENT_ACTIVITY, DeploymentActivity(
                operationId=operation_id, index=index, source=source, level=level,
                phase=phase or session.deployment.phase, kind=kind, title=title[:120].strip() or kind,
                detail=detail, status=status, toolId=tool_id).model_dump())
            state["bytes"] += estimated
        except (ValidationError, ValueError):
            LOG.debug("Deployment %s dropped an invalid activity entry", session.id, exc_info=True)

    return emit


class _DeploymentLogBuffer:
    """Batch redacted Docker lines without delaying or coupling the engine process."""

    _MAX_LINES = 50
    _MAX_BYTES = 12 * 1024
    _FLUSH_SECONDS = 0.25

    def __init__(self, emit: Callable[..., None]) -> None:
        self._emit = emit
        self._lines: list[str] = []
        self._bytes = 0
        self._last: str | None = None
        self._repeats = 0
        self._timer: asyncio.TimerHandle | None = None

    def add(self, line: str) -> None:
        if line == self._last:
            self._repeats += 1
            return
        self._append_repeat()
        self._last = line
        self._repeats = 1
        if self._timer is None:
            self._timer = asyncio.get_running_loop().call_later(self._FLUSH_SECONDS, self.flush)
        if len(self._lines) >= self._MAX_LINES or self._bytes >= self._MAX_BYTES:
            self.flush()

    def _append_repeat(self) -> None:
        if self._last is None:
            return
        line = self._last if self._repeats == 1 else f"{self._last} ×{self._repeats}"
        self._lines.append(line)
        self._bytes += len(line.encode("utf-8")) + 1
        self._last = None
        self._repeats = 0

    def flush(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None
        self._append_repeat()
        if not self._lines:
            return
        lines, self._lines = self._lines, []
        self._bytes = 0
        self._emit("log", "Docker", "\n".join(lines), source="docker")


def _publish_deployment_phase(
    session: Session, operation_id: UUID, emit: Callable[..., None], phase: str, message: str,
) -> None:
    """Publish one authoritative phase to snapshot, progress and activity in one sync turn."""
    if (session.closing or session.deployment.operationId != operation_id
            or session.deployment.state not in ("starting", "stopping")):
        return
    snapshot = session.deployment.model_copy(update={
        "phase": phase[:120], "updatedAt": datetime.now(UTC),
    })
    record(session, EVENT_DEPLOYMENT_UPDATED, snapshot.model_dump())
    record(session, EVENT_DEPLOYMENT_PROGRESS, DeploymentProgress(
        operationId=operation_id, phase=phase[:120], message=message[:1000],
    ).model_dump())
    emit("phase", phase, message, source="system", phase=phase)


def _deployment_tools(
    session: Session, operation_id: UUID, docker: Docker, manifests: DockerManifests,
    candidates: tuple[DeploymentArtifactCandidate, ...], *, deadline: float,
    emit: Callable[..., None], verified_endpoint: dict[str, Any],
) -> tuple[StructuredTool, ...]:
    """Capabilities bound to one admitted operation, not identifiers provided by the model.

    The worker is the sole Docker owner until stop cancels AND joins it (task 22). The
    capability lock serializes concurrent MCP calls without holding the chat operation lock.
    Caller creates/rearms the manifest before execution (task 19), and rolls back on failure.
    """
    lock = asyncio.Lock()
    configured: DeploymentPortsInput | None = None
    evidence: dict[str, Any] | None = None
    started_input: DeploymentUpInput | None = None
    last_start_error: DockerError | None = None
    configured_fingerprint: str | None = None
    failed_fingerprint: str | None = None
    attempts_used = 0
    settings = get_settings()

    def deployment_files_fingerprint(request: DeploymentPortsInput) -> str:
        paths = [*request.composeFiles, *(
            selection.dockerfile for selection in request.artifacts if selection.dockerfile is not None
        )]
        digest = hashlib.sha256()
        checkout = session.workspace.resolve()
        for relative in sorted(set(paths)):
            try:
                path = (checkout / relative).resolve(strict=True)
            except OSError:
                raise DockerError("invalid_compose", "Deployment file is unavailable") from None
            if not path.is_file() or not path.is_relative_to(checkout):
                raise DockerError("invalid_compose", "Deployment file path is invalid")
            try:
                content = path.read_bytes()
            except OSError:
                raise DockerError("invalid_compose", "Deployment file is unavailable") from None
            digest.update(relative.encode())
            digest.update(content)
        return digest.hexdigest()

    def require_current() -> None:
        if session.closing or session.deployment.state != "starting" or session.deployment.operationId != operation_id:
            raise DockerError("startup_failed", "The deployment operation is no longer active")

    async def invoke(kind: str, arguments: dict[str, Any]) -> dict[str, Any]:
        nonlocal configured, evidence, started_input, attempts_used, last_start_error
        nonlocal configured_fingerprint, failed_fingerprint
        try:
            async with lock:
                require_current()
                async with asyncio.timeout_at(deadline):
                    if kind == "ports":
                        request = DeploymentPortsInput.model_validate(arguments)
                        classified = _validate_artifact_classification(candidates, request)
                        fingerprint = deployment_files_fingerprint(request)
                        if failed_fingerprint is not None and fingerprint == failed_fingerprint:
                            raise DockerError(
                                "invalid_compose",
                                "Change the failed deployment configuration before retrying",
                            )
                        if configured is not None:
                            if configured != request:
                                raise DockerError("invalid_compose", "Deployment ports are already configured")
                        else:
                            _publish_deployment_phase(
                                session, operation_id, emit, "freezing",
                                "Freezing the Compose configuration",
                            )
                            manifest = await docker.freeze_compose(
                                manifests=manifests, session_id=session.id, checkout=session.workspace,
                                compose_files=tuple(Path(path) for path in request.composeFiles),
                                web_service=request.webService, deadline=deadline)
                            try:
                                _validate_artifact_builds(
                                    session.workspace, classified,
                                    docker.inspect_builds(manifests=manifests, manifest=manifest),
                                )
                            except DockerError:
                                docker.discard_prepared_configuration(
                                    manifests=manifests, session_id=session.id,
                                )
                                raise
                            await docker.configure_ports(manifests=manifests, session_id=session.id,
                                                         ports=tuple(request.ports), deadline=deadline)
                            configured = request
                            configured_fingerprint = fingerprint
                            _publish_deployment_phase(
                                session, operation_id, emit, "ports_configured",
                                "Browser publications configured",
                            )
                        return {"success": True, "phase": "ports_configured", "bound": False,
                                "message": "All publications replaced; engine binding is verified during start"}
                    request = DeploymentUpInput.model_validate(arguments)
                    if configured is None:
                        raise DockerError("invalid_compose", "Check all published ports before requesting start")
                    has_web_artifact = any(
                        selection.disposition == "web" for selection in configured.artifacts
                    )
                    required_expectation = "html" if has_web_artifact else "http"
                    if request.expectation != required_expectation:
                        raise DockerError(
                            "invalid_compose",
                            "Web previews require HTML readiness"
                            if has_web_artifact
                            else "API-only previews require HTTP readiness",
                        )
                    if not any(port.service == configured.webService and port.container_port == request.containerPort
                               and port.protocol == "tcp" for port in configured.ports):
                        raise DockerError("invalid_compose", "The requested web port was not configured")
                    if evidence is not None:
                        if started_input != request:
                            raise DockerError("startup_failed", "Deployment has already started with another endpoint")
                        return evidence
                    _publish_deployment_phase(
                        session, operation_id, emit, "building",
                        "Building images and starting containers",
                    )
                    attempts_used += 1
                    docker_logs = _DeploymentLogBuffer(emit)
                    try:
                        manifest = await docker.up(manifests=manifests, session_id=session.id,
                                                   deadline=deadline,
                                                   on_line=docker_logs.add)
                        docker_logs.flush()
                        _publish_deployment_phase(
                            session, operation_id, emit, "starting",
                            "Containers started; waiting for the endpoint",
                        )
                        _publish_deployment_phase(
                            session, operation_id, emit, "probing",
                            "Probing the application endpoint",
                        )
                        readiness = await docker.readiness(
                            manifests=manifests, session_id=session.id,
                            container_port=request.containerPort, path=request.path,
                            expectation=request.expectation, deadline=deadline,
                            on_observation=lambda observation: emit(
                                "log", "Probe", observation,
                                status="failed" if "returned HTTP 4" in observation else None,
                                source="probe",
                                level="warning" if "returned HTTP 4" in observation else "info",
                            ),
                        )
                    except DockerError as error:
                        # A build failure is recoverable inside this operation: give the agent the
                        # real cause, put the deployment back to `prepared`, and let it correct the
                        # files. Without this the agent retries blindly until the budget expires.
                        last_start_error = error
                        failed_fingerprint = configured_fingerprint
                        excerpt = error.detail or ""
                        if excerpt:
                            emit("log", "Docker", excerpt, status="failed", source="docker", level="error")
                        retries_left = settings.deployment_start_attempts - attempts_used
                        if retries_left <= 0:
                            raise
                        try:
                            await docker.down(manifests=manifests, session_id=session.id, deadline=deadline)
                            await docker.rearm(manifests=manifests, session_id=session.id)
                        except (DockerError, DockerManifestError):
                            LOG.warning("Deployment %s could not be reset for a retry", session.id, exc_info=True)
                            attempts_used = settings.deployment_start_attempts
                            raise DockerError(
                                "cleanup_failed", "Deployment resources could not be reset for another attempt",
                            ) from None
                        # Rearmed: the frozen configuration is gone, so ports must be set again.
                        configured = evidence = started_input = None
                        configured_fingerprint = None
                        emit("notice", "Deployment attempt failed",
                             f"{retries_left} attempt(s) left after {error.code}", level="warning")
                        return {"success": False, "reason": {"code": error.code, "message": str(error)},
                                "retriesLeft": retries_left, "log": excerpt,
                                "message": "Fix the reported files, then call check_ports and start_project again"}
                    finally:
                        docker_logs.flush()
                        _schedule_changes_refresh(session, debounce=False)
                    require_current()
                    last_start_error = None
                    _publish_deployment_phase(
                        session, operation_id, emit, "ready",
                        "The application answered on its published port",
                    )
                    started_input = request
                    evidence = {"success": True, "ready": True, "webService": manifest.web_service,
                                "containerPort": request.containerPort, "path": request.path,
                                "expectation": request.expectation,
                                "previewUrl": readiness.preview_url,
                                "ports": [port.model_dump(mode="json") for port in manifest.ports]}
                    verified_endpoint.update({
                        "webService": manifest.web_service,
                        "containerPort": request.containerPort,
                        "path": request.path,
                        "expectation": request.expectation,
                    })
                    return evidence
        except ValidationError as error:
            # Field locations and error types are safe to return; Pydantic's full
            # messages can echo model input, including Compose configuration.
            problems = []
            for issue in error.errors()[:4]:
                location = '.'.join(map(str, issue['loc'])) or 'input'
                kind = issue['type']
                # The model validator below emits only these fixed strings. Return
                # them to help the agent correct a classification without echoing data.
                if kind == "value_error" and location.startswith("artifacts."):
                    message = str(issue.get("ctx", {}).get("error", ""))
                    if message in (
                        "Deployable artifacts require service and Dockerfile only",
                        "Non-deployable artifacts require a reason only",
                    ):
                        kind = message
                problems.append(f"{location}: {kind}")
            return {"success": False, "reason": {"code": "invalid_compose",
                                                  "message": "Invalid deployment tool arguments: "
                                                  + "; ".join(problems)}}
        except DockerError as error:
            return {"success": False, "reason": {"code": error.code, "message": str(error)}}
        except DockerManifestError:
            return {"success": False, "reason": {"code": "cleanup_failed",
                                                  "message": "Deployment recovery record is unavailable"}}
        except TimeoutError:
            if last_start_error is not None:
                return {"success": False, "reason": {
                    "code": last_start_error.code, "message": str(last_start_error),
                }, "log": last_start_error.detail or ""}
            return {"success": False, "reason": {"code": "timeout", "message": "Deployment deadline expired"}}

    async def ports(arguments: dict[str, Any]) -> dict[str, Any]:
        return await invoke("ports", arguments)

    async def start(arguments: dict[str, Any]) -> dict[str, Any]:
        return await invoke("start", arguments)

    return (
        StructuredTool("check_ports", "Freeze Compose and configure ALL browser publications; no reservation yet",
                       DeploymentPortsInput.model_json_schema(), ports),
        StructuredTool("start_project", "Build, start and verify the managed project; returns all real port bindings",
                       DeploymentUpInput.model_json_schema(), start),
    )


async def _admit_deployment_start(
    session: Session, run: Callable[[UUID], Awaitable[None]],
) -> DeploymentSnapshot:
    """Atomically admit once; the supplied worker owns finalization/rollback (tasks 19–20).

    No provider/Docker I/O under operation_lock. All worker exceptions must be finalized by
    run; this primitive is internal until the REST integration in task 21.
    """
    async with session.operation_lock:
        if session.closing:
            raise ApiException.conflict("The session is closing")
        if session.deployment.state in ("starting", "running"):
            return session.deployment
        if session.deployment.state == "stopping" or session.deployment.cleanupRequired:
            raise ApiException.conflict("Stop the previous deployment before deploying again")
        if session.deployment_task is not None and not session.deployment_task.done():
            raise ApiException.conflict("A deployment operation is still finishing")
        if (session.status != STATUS_READY or session.pending is not None or session.interactions
                or session.runtime is None or session.workspace == _UNSET_PATH):
            raise ApiException.conflict("The chat must be ready with no pending requests before deploying")
        if describe(session.provider).structured_executor is None:
            raise ApiException.conflict("This provider does not support deployment operations")
        await _reserve_deployment(session.id)
        operation_id = uuid4()
        snapshot = DeploymentSnapshot(state="starting", operationId=operation_id, phase="preparing",
                                      previewUrl=None, result=None, cleanupRequired=False,
                                      updatedAt=datetime.now(UTC))

        async def worker() -> None:
            await run(operation_id)

        # The event-loop cannot execute the worker until this lock scope has returned.
        record(session, EVENT_DEPLOYMENT_UPDATED, snapshot.model_dump())
        _touch_activity(session, snapshot.updatedAt)
        session.deployment_task = _spawn(session, worker())
        return snapshot



# Public reasons are selected by code: model/provider diagnostics never cross the API boundary.
_DEPLOYMENT_MESSAGES: dict[str, str] = {
    "not_web_application": "This repository does not contain a deployable web application",
    "missing_configuration": "Provide the application's required configuration and secrets before deploying",
    "unsupported_project": "Adapt the project to image builds, named volumes and browser-accessible configuration",
    "provider_unavailable": "Reconnect the session's agent provider and retry Deploy",
    "model_unavailable": "The deployment model is unavailable for this provider account",
    "docker_unavailable": "Check Docker Compose and access to the configured Docker engine",
    "invalid_compose": "Correct the project's Docker Compose configuration and retry Deploy",
    "port_unavailable": "No permitted publication port is available; check the engine and configured range",
    "startup_failed": "The application could not start; review its Docker configuration",
    "health_check_failed": "The application did not become ready; check healthchecks and the web endpoint",
    "invalid_agent_output": "The agent did not return a verified deployment endpoint; retry Deploy",
    "timeout": "Deployment timed out; check the application build and readiness configuration",
    "cancelled": "Deployment was cancelled",
    "cleanup_failed": "Resources may remain; restore Docker access and retry Stop before deploying again",
}


def _deployment_reason(code: str) -> DeploymentReason:
    if code not in _DEPLOYMENT_MESSAGES:
        code = "startup_failed"
    return DeploymentReason(code=code, message=_DEPLOYMENT_MESSAGES[code])


def _deployment_finish(session: Session, operation_id: UUID, action: DeploymentAction, *,
                       reason: DeploymentReason | None = None, url: str | None = None,
                       cleanup: bool = False) -> None:
    # No await: stop admission and terminal publication cannot interleave. Never take the
    # operation lock here: close holds it while joining workers.
    if session.deployment.operationId != operation_id:
        return
    state = "failed" if reason else ("running" if action == "start" else "stopped")
    result = DeploymentResult(schemaVersion=1, operationId=operation_id, action=action,
                              success=reason is None, state=state, reason=reason,
                              previewUrl=url, cleanupRequired=cleanup)
    record(session, EVENT_DEPLOYMENT_UPDATED, DeploymentSnapshot(
        state=state, operationId=operation_id, phase=None, previewUrl=url, result=result,
        cleanupRequired=cleanup, updatedAt=datetime.now(UTC)).model_dump())


def _deployment_storage() -> DockerManifests:
    return DockerManifests(get_settings().workspace_root)


def _owned_deployment(session: Session, manifests: DockerManifests):
    manifest = manifests.load(session.id)
    if manifest.owner_id != session.player_id:
        raise DockerManifestError("Deployment owner does not match session")
    return manifest


async def _join_deployment(task: asyncio.Task) -> None:
    """Join even during repeated cancellation; callers must never race a late Docker up."""
    while not task.done():
        try:
            await asyncio.shield(task)
        except asyncio.CancelledError:
            continue
    # Workers finalize their own failures; still retrieve exceptions from an aborted task.
    if not task.cancelled():
        task.result()


async def _deployment_down(session: Session) -> None:
    manifests = _deployment_storage()
    if manifests.directory(session.id).exists():
        _owned_deployment(session, manifests)
        await Docker().down(manifests=manifests, session_id=session.id)
    _deployment_slots.discard(session.id)


def _deployment_cleanup_required(session: Session) -> bool:
    """Unreadable/foreign evidence is never proof that resources have been removed."""
    try:
        manifests = _deployment_storage()
        if not manifests.directory(session.id).exists():
            return False
        return _owned_deployment(session, manifests).cleanup_state != "stopped"
    except Exception:
        LOG.debug("Background operation encountered an exception", exc_info=True)
        return True


async def _settle_deployment_cleanup(session: Session) -> bool:
    # Each attempt has its own bounded stop budget. Shield and join even if the caller is
    # cancelled repeatedly; no late down can race the next deployment operation.
    for _ in range(2):
        task = asyncio.create_task(_deployment_down(session))
        try:
            await _join_deployment(task)
        except Exception as error:
            LOG.warning("Deployment %s cleanup failed with %s", session.id,
                        getattr(error, "code", "cleanup_failed"), exc_info=True)
            if isinstance(error, DockerError) and error.detail:
                LOG.debug("Deployment %s: %s", session.id, error.detail)
        if not _deployment_cleanup_required(session):
            _deployment_slots.discard(session.id)
            return False
    return True


async def _run_deployment_start(session: Session, caller: Caller, operation_id: UUID) -> None:
    reason = None
    secrets: list[str] = []
    emit = _deployment_activity_emitter(session, operation_id, secrets)
    try:
        deadline = asyncio.get_running_loop().time() + get_settings().deployment_timeout_seconds
        _publish_deployment_phase(
            session, operation_id, emit, "preparing", "Preparing deployment configuration",
        )
        async with asyncio.timeout_at(deadline):
            docker, manifests = Docker(), _deployment_storage()
            await docker.preflight(cwd=session.workspace, deadline=deadline)
            if manifests.directory(session.id).exists():
                _owned_deployment(session, manifests)
                # Normalize even a failed manifest using its frozen configuration. Ownership
                # is verified before touching the engine; absence is proved before rearming.
                await docker.down(manifests=manifests, session_id=session.id, deadline=deadline)
                await docker.rearm(manifests=manifests, session_id=session.id)
            else:
                manifests.create(session.id, session.player_id)
            candidates = _deployment_artifact_candidates(session.workspace)
            verified_endpoint: dict[str, Any] = {}

            async def progress(update) -> None:
                if session.deployment.operationId != operation_id or session.closing:
                    return
                _publish_deployment_phase(
                    session, operation_id, emit, update.phase, update.message,
                )

            async def activity(item) -> None:
                emit(item.kind, item.title, item.detail, status=item.status, tool_id=item.tool_id,
                     source=item.source, level=item.level)
                if item.kind == "tool_result" and item.mutates_workspace:
                    _schedule_changes_refresh(session, debounce=True)

            deployment_tools = _deployment_tools(
                session, operation_id, docker, manifests, candidates,
                deadline=deadline, emit=emit, verified_endpoint=verified_endpoint,
            )
            result: DeploymentAgentResult | None = None
            direct_error: str | None = None
            try:
                existing = await _existing_compose_inputs(
                    docker, session.workspace, candidates, deadline=deadline,
                )
                if existing is not None:
                    ports_input, up_input = existing
                    emit("notice", "Reusing existing Compose configuration")
                    checked = await deployment_tools[0].execute(ports_input.model_dump(mode="json"))
                    started = (await deployment_tools[1].execute(up_input.model_dump(mode="json"))
                               if checked.get("success") else checked)
                    if started.get("success") and started.get("ready"):
                        result = DeploymentAgentResult(
                            success=True, reason=None, webService=ports_input.webService,
                            containerPort=up_input.containerPort, path=up_input.path,
                        )
                    else:
                        reason = started.get("reason", {})
                        direct_error = reason.get("message") or "Managed deployment failed"
                        if started.get("log"):
                            direct_error += "\n" + redact_deployment_output(
                                str(started["log"])[-2000:], tuple(secrets),
                            )
                        emit("notice", "Existing Compose needs repair", direct_error,
                             level="warning")
            except DockerError as error:
                direct_error = str(error)
                emit("notice", "Existing Compose needs repair", direct_error, level="warning")
            except (ValidationError, ValueError, OSError):
                direct_error = "Existing Compose needs deployment configuration repair"
                emit("notice", "Existing Compose needs repair", direct_error, level="warning")
            if result is None:
                # A failed direct attempt may have frozen configuration or started resources.
                # Reset only this session's owned project before giving the agent fresh tools.
                manifest = _owned_deployment(session, manifests)
                if manifest.compose_files:
                    await docker.down(manifests=manifests, session_id=session.id, deadline=deadline)
                    await docker.rearm(manifests=manifests, session_id=session.id)
                deployment_tools = _deployment_tools(
                    session, operation_id, docker, manifests, candidates,
                    deadline=deadline, emit=emit, verified_endpoint=verified_endpoint,
                )
                verified_endpoint.clear()
                try:
                    credential = await mooi.fetch_agent_credential(caller, str(session.connection_id))
                    secrets.append(credential.token)
                except Exception:
                    LOG.debug("Background operation encountered an exception", exc_info=True)
                    raise StructuredOperationError("provider_unavailable", "Provider credential unavailable") from None
                try:
                    loader = getattr(describe(session.provider).runtime_class, "load_configuration")
                    await loader(credential, refresh=True)
                    catalog = describe(session.provider).configuration()
                    available = {entry["id"] for entry in catalog["models"]}
                    deployment_model = (credential.deployment_model if credential.deployment_model in available
                                        else catalog["defaultModel"])
                    if not deployment_model:
                        raise StructuredOperationError("model_unavailable", "No deployment model available")
                    model_entry = next(entry for entry in catalog["models"] if entry["id"] == deployment_model)
                    efforts = model_entry.get("efforts") or []
                    requested_effort = (credential.deployment_effort if not credential.deployment_model
                                        or credential.deployment_model == deployment_model else None)
                    deployment_effort = next((value for value in (
                        requested_effort, model_entry.get("defaultEffort"), catalog.get("defaultEffort"),
                        "medium", *efforts) if value and value in efforts), None)
                except StructuredOperationError:
                    raise
                except Exception:
                    raise StructuredOperationError("provider_unavailable", "Could not load deployment models") from None
                result = await _execute_deployment_agent(session.provider, StructuredOperation(
                    credential=credential, model=deployment_model, effort=deployment_effort, cwd=session.workspace,
                    prompt=_deployment_prompt(candidates)
                    + (f"\nPrevious managed attempt failed: {direct_error}. Diagnose and fix it."
                       if direct_error else ""),
                    output_schema=DeploymentAgentResult.model_json_schema(), progress=progress,
                    activity=activity, tools=deployment_tools,
                ))
            if not result.success:
                raise StructuredOperationError(result.reason.code, "Agent could not deploy project")
            manifest = _owned_deployment(session, manifests)
            if (manifest.cleanup_state != "required" or manifest.web_service != result.webService
                    or verified_endpoint.get("webService") != result.webService
                    or verified_endpoint.get("containerPort") != result.containerPort
                    or verified_endpoint.get("path") != result.path
                    or not any(port.service == result.webService and port.protocol == "tcp"
                               and port.container_port == result.containerPort for port in manifest.ports)):
                raise StructuredOperationError("invalid_agent_output", "Endpoint was not started by managed tools")
            readiness = await docker.readiness(
                manifests=manifests, session_id=session.id,
                container_port=result.containerPort, path=result.path,
                expectation=verified_endpoint["expectation"], deadline=deadline,
            )
            if session.closing or session.deployment.operationId != operation_id:
                raise asyncio.CancelledError
            _schedule_changes_refresh(session, debounce=False)
            emit("notice", "Deployment ready", final=True, level="success")
            _deployment_finish(session, operation_id, "start", url=readiness.preview_url)
            session.deployment_monitor = _spawn(session, _monitor_deployment(session, operation_id))
            return
    except asyncio.CancelledError:
        reason = _deployment_reason("cancelled")
        LOG.warning("Deployment %s start failed with %s", session.id, reason.code, exc_info=True)
    except TimeoutError:
        reason = _deployment_reason("timeout")
        LOG.warning("Deployment %s start failed with %s", session.id, reason.code, exc_info=True)
    except (DockerError, StructuredOperationError) as error:
        reason = _deployment_reason(error.code)
        LOG.warning("Deployment %s start failed with %s", session.id, reason.code, exc_info=True)
        if isinstance(error, DockerError) and error.detail:
            LOG.debug("Deployment %s: %s", session.id, error.detail)
    except DockerManifestError:
        reason = _deployment_reason("cleanup_failed")
        LOG.warning("Deployment %s start failed with %s", session.id, reason.code, exc_info=True)
    except Exception:
        reason = _deployment_reason("startup_failed")
        LOG.warning("Deployment %s start failed with %s", session.id, reason.code, exc_info=True)
    # Rollback has its own stop deadline, independent of the exhausted start deadline.
    # Shield AND join it: stop/close must wait for every possible engine mutation.
    cleanup = await _settle_deployment_cleanup(session)
    _schedule_changes_refresh(session, debounce=False)
    emit("notice", reason.message, status="failed", final=True, level="error")
    _deployment_finish(session, operation_id, "start", reason=reason, cleanup=cleanup)


@router.get("/sessions/{session_id}/deployment")
async def get_deployment(session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> DeploymentSnapshot:
    return get_registry().get_for(caller, session_id).deployment


@router.post("/sessions/{session_id}/deployment/start", status_code=status.HTTP_202_ACCEPTED)
async def start_deployment(session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> DeploymentSnapshot:
    session = get_registry().get_for(caller, session_id)
    # Read live rather than cached on the session: the player can change the setting at any time.
    # Stop stays ungated, so a deployment started before the change can always be torn down.
    project = await mooi.fetch_project(caller, session.project_id)
    if not project.web_application:
        raise ApiException.conflict("Deploy and preview are only available for web applications")
    return await _admit_deployment_start(session, lambda operation_id: _run_deployment_start(session, caller, operation_id))


async def _run_deployment_stop(session: Session, operation_id: UUID, previous: asyncio.Task | None) -> None:
    emit = _deployment_activity_emitter(session, operation_id)
    _publish_deployment_phase(
        session, operation_id, emit, "stopping", "Stopping deployment",
    )
    # Failed/cancelled workers must not skip cleanup. Join them before any new engine mutation.
    for task in (previous, session.deployment_monitor):
        if task is None:
            continue
        if task is session.deployment_monitor:
            task.cancel()
        try:
            await _join_deployment(task)
        except Exception:
            LOG.warning("Deployment %s stop could not join previous worker", session.id, exc_info=True)
    session.deployment_monitor = None
    cleanup = await _settle_deployment_cleanup(session)
    if cleanup:
        LOG.warning("Deployment %s stop failed with cleanup_failed", session.id)
    emit("notice", _deployment_reason("cleanup_failed").message if cleanup else "Deployment stopped",
         status="failed" if cleanup else "done", final=True)
    _deployment_finish(session, operation_id, "stop",
                       reason=_deployment_reason("cleanup_failed") if cleanup else None,
                       cleanup=cleanup)


@router.post("/sessions/{session_id}/deployment/stop", status_code=status.HTTP_202_ACCEPTED)
async def stop_deployment(session_id: UUID, response: Response,
                          caller: Annotated[Caller, Depends(current_caller)]) -> DeploymentSnapshot:
    session = get_registry().get_for(caller, session_id)
    async with session.operation_lock:
        if session.closing:
            raise ApiException.conflict("The session is closing")
        if session.deployment.state == "stopped":
            response.status_code = status.HTTP_200_OK
            return session.deployment
        if session.deployment.state == "stopping":
            return session.deployment
        previous = session.deployment_task
        operation_id = uuid4()
        snapshot = DeploymentSnapshot(state="stopping", operationId=operation_id, phase="stopping",
                                      previewUrl=None, result=None,
                                      cleanupRequired=session.deployment.cleanupRequired,
                                      updatedAt=datetime.now(UTC))
        record(session, EVENT_DEPLOYMENT_UPDATED, snapshot.model_dump())
        _touch_activity(session, snapshot.updatedAt)
        if previous is not None and not previous.done():
            previous.cancel()
        session.deployment_task = _spawn(session, _run_deployment_stop(session, operation_id, previous))
        return snapshot


def _touch_activity(session: Session, at: datetime | None = None) -> None:
    session.last_human_activity = at or datetime.now(UTC)
    session.updated_at = session.last_human_activity


@router.post("/sessions/{session_id}/activity", status_code=status.HTTP_204_NO_CONTENT)
async def session_activity(session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> Response:
    session = get_registry().get_for(caller, session_id)
    if session.closing:
        raise ApiException.conflict("The session is closing")
    now = asyncio.get_running_loop().time()
    if (session.activity_heartbeat_at is None
            or now - session.activity_heartbeat_at >= get_settings().session_activity_interval_seconds):
        session.activity_heartbeat_at = now
        _touch_activity(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _monitor_deployment(session: Session, operation_id: UUID) -> None:
    """One bounded read per interval; never restart, invoke AI, or renew human activity."""
    while not session.closing and session.deployment.state == "running" and session.deployment.operationId == operation_id:
        await asyncio.sleep(get_settings().deployment_monitor_interval_seconds)
        if session.closing or session.deployment.state != "running" or session.deployment.operationId != operation_id:
            return
        try:
            manifests = _deployment_storage()
            _owned_deployment(session, manifests)
            await Docker().check_running(manifests=manifests, session_id=session.id)
        except asyncio.CancelledError:
            raise
        except Exception:
            LOG.debug("Background operation encountered an exception", exc_info=True)
            if not session.closing and session.deployment.state == "running" and session.deployment.operationId == operation_id:
                _deployment_finish(session, operation_id, "start",
                                   reason=_deployment_reason("health_check_failed"), cleanup=True)
            return


# --- lifecycle safety --------------------------------------------------------------------------


async def _reap_idle_sessions() -> None:
    """Reap only ready/failed sessions; never expire active turns or pending user input."""
    settings = get_settings()
    timeout = timedelta(minutes=settings.session_idle_timeout_minutes)
    cutoff = datetime.now(UTC) - timeout
    idle = [session.id for session in get_registry().all()
            if session.status in (STATUS_READY, STATUS_FAILED) and session.last_human_activity < cutoff]
    for session_id in idle:
        session = get_registry().get(session_id)
        if session is None:
            continue
        async with session.operation_lock:
            # Earlier cleanup may have awaited Docker while this session received activity.
            if (not session.closing and session.status in (STATUS_READY, STATUS_FAILED)
                    and session.last_human_activity < cutoff):
                LOG.info("Session %s reaped after %s idle", session_id, timeout)
                await _close_registered_session(session)


async def _reaper_loop() -> None:
    settings = get_settings()
    interval = max(60, settings.session_idle_timeout_minutes * 60 // 4)
    while True:
        await asyncio.sleep(interval)
        with suppress(Exception):
            await _reap_idle_sessions()


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
