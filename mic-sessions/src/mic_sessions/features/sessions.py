"""Feature: agent sessions.

The whole feature — wire contracts, in-memory registry, orchestration and REST/SSE endpoints —
lives in this single file (project architecture rule): it may only import transversal aspects from
`shared/`.

A session pairs one player, one project and one agent provider with a managed workspace: `Session` is the
in-memory record of that pairing, `SessionRegistry` is the process-wide table of live sessions
(there is no database), and `record` is the one fold that turns events into session state — every
endpoint below goes through it and nothing else assigns a session's status.

Ordinary sessions own a Git clone; production chats use an empty, branchless directory. Production
deployments themselves are project-scoped (see the production section): they run without a chat and
fetch only the selected release into a temporary checkout.

Sessions and their event logs are memory-resident. After an ungraceful restart they cannot be
resumed; marked on-disk session directories are reconciled at startup. `start_reaper()` closes idle sessions and `close_all()` closes sessions during a
graceful shutdown; `main.py`'s lifespan owns calling both.
"""

from __future__ import annotations

import asyncio
import difflib
import hmac
import json
import logging
import os
import re
import secrets
import signal
import tempfile
import time
from collections.abc import AsyncIterator, Callable, Coroutine
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4
from urllib.parse import quote

import httpx

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    TypeAdapter,
    model_validator,
)

from mic_sessions.shared import mooi, workspaces
from mic_sessions.shared.agents import (
    PROVIDERS,
    STATUS_COMPACTING,
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
    changes_updated,
    create_runtime,
    describe,
    message_user,
    session_configuration,
    session_status,
)
from mic_sessions.shared.auth import Caller, current_caller
from mic_sessions.shared.docker import (
    Docker,
    DockerError,
    DockerManifestError,
    DockerManifests,
    DockerPortRequest,
    redact_deployment_output,
)
from mic_sessions.shared.env import get_settings, production_environment
from mic_sessions.shared.events import Event, EventLog, sse_frame, sse_heartbeat
from mic_sessions.shared.web import ApiException

LOG = logging.getLogger("sessions")

_BRANCH_PATTERN = r"^[A-Za-z0-9._\-/]{1,120}$"
_UNSET_PATH = Path()
_LAST_EVENT_ID_HEADER = "Last-Event-ID"

PENDING_KIND_PERMISSION = "permission"
PENDING_KIND_QUESTION = "question"

# Event types the fold below reacts to; deployment updates are independent of chat turns.
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
EVENT_DEPLOYMENT_LOG = "deployment.log"
EVENT_PRODUCTION_UPDATED = "production.updated"
EVENT_SESSION_CLEARED = "session.cleared"
EVENT_SESSION_COMPACTION = "session.compaction"
EVENT_MERGE_COMPLETED = "merge.completed"

# --- wire contracts ---------------------------------------------------------------------------


DeploymentState = Literal["stopped", "starting", "running", "stopping", "failed"]
DeploymentAction = Literal["start", "stop"]
DeploymentErrorCode = Literal[
    "unsupported_project", "docker_unavailable", "invalid_compose", "port_unavailable",
    "startup_failed", "health_check_failed", "timeout", "cancelled", "cleanup_failed",
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


class DeploymentLog(DeploymentContract):
    """A batch of redacted Docker Compose command and output lines of one start operation."""

    operationId: UUID
    # Monotonic per operation, so clients can order and discard duplicates on replay.
    index: int = Field(ge=0)
    lines: list[str] = Field(min_length=1, max_length=50)


class CreateSessionRequest(BaseModel):
    projectId: UUID
    provider: str
    connectionId: UUID
    branch: str | None = Field(default=None, pattern=_BRANCH_PATTERN)
    model: str | None = None
    effort: str | None = None
    kind: Literal["session", "production"] = "session"
    # Delivered as the first user message once the agent is ready, exactly as if the user sent it.
    initialMessage: str | None = Field(default=None, min_length=1, max_length=100_000)


class ProductionSnapshot(BaseModel):
    """The live deployment state of one project in this process; output travels separately."""

    state: Literal["idle", "running", "succeeded", "failed"] = "idle"
    operationId: UUID | None = None
    message: str | None = None
    releaseTag: str | None = None
    releaseUrl: str | None = None
    releaseCommit: str | None = None
    startedAt: datetime | None = None
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ProductionStatusResult(BaseModel):
    state: Literal["healthy", "unhealthy"]
    output: str
    checkedAt: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ProductionStoredFiles(BaseModel):
    """DEPLOYMENT.md, deploy.sh and status.sh as stored: virtual documents living only in the platform."""

    manifest: str
    script: str
    statusScript: str = ""


class ProductionFiles(ProductionStoredFiles):
    """A complete draft as written by the user or the agent."""

    manifest: str = Field(min_length=1, max_length=65536, pattern=r"\S")
    script: str = Field(min_length=1, max_length=65536, pattern=r"\S")
    statusScript: str = Field(min_length=1, max_length=65536, pattern=r"\S")


class ProductionDocuments(BaseModel):
    active: ProductionStoredFiles | None = None
    draft: ProductionStoredFiles | None = None
    revision: int = 0
    environment: list[str] = Field(default_factory=list)


class ProductionEnvironmentVariable(BaseModel):
    name: str
    configured: bool
    required: bool


class ProductionOverview(BaseModel):
    configured: bool
    deployed: bool
    hasDraft: bool
    revision: int
    environment: list[ProductionEnvironmentVariable]
    snapshot: ProductionSnapshot
    chatSessionId: UUID | None
    # The live chat's configuration succeeded in a real deployment since its last draft: it may be closed.
    chatTested: bool = False


class ProductionEnvironmentUpdate(BaseModel):
    """A null value removes the variable; values are write-only."""

    values: dict[str, str | None] = Field(max_length=100)


class GithubRelease(BaseModel):
    tag: str
    name: str
    url: str
    publishedAt: datetime | None = None


class ReleaseList(BaseModel):
    releases: list[GithubRelease]


class StartProductionRequest(BaseModel):
    tag: str = Field(min_length=1, max_length=120)
    create: bool = False


_PRODUCTION_PLATFORM_ENVIRONMENT = frozenset({
    "MOOI_PRODUCTION_RELEASE_TAG", "MOOI_PRODUCTION_RELEASE_SHA", "MOOI_PRODUCTION_RELEASE_URL",
})
_PRODUCTION_VARIABLE = re.compile(r"\bMOOI_PRODUCTION_[A-Z0-9_]+\b")
_PRODUCTION_DEFAULTED = re.compile(r"\$\{(MOOI_PRODUCTION_[A-Z0-9_]+):?[-=+]")
_PRODUCTION_FILE_NAMES = {"DEPLOYMENT.md": "manifest", "deploy.sh": "script", "status.sh": "statusScript"}


def _required_environment(files: ProductionStoredFiles | None) -> list[str]:
    """Variables the scripts mention, minus shell-defaulted ones and the platform's release data."""
    if files is None:
        return []
    scripts = (files.script, files.statusScript)
    names = {name for text in scripts for name in _PRODUCTION_VARIABLE.findall(text)}
    defaulted = {name for text in scripts for name in _PRODUCTION_DEFAULTED.findall(text)}
    return sorted(names - defaulted - _PRODUCTION_PLATFORM_ENVIRONMENT)


async def _resolve_production_release(project: mooi.Project, caller: Caller,
                                      body: StartProductionRequest) -> tuple[dict, str]:
    if body.create:
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,119}", body.tag):
            raise ApiException.bad_request("Invalid release version")
        branch = quote(project.default_branch or "main", safe="")
        main = await _github_api(caller, project.full_name, "GET", f"branches/{branch}")
        main_sha = main["commit"]["sha"]
        try:
            await _github_api(caller, project.full_name, "GET", f"git/ref/tags/{quote(body.tag, safe='')}")
        except ApiException as error:
            if error.status_code != status.HTTP_404_NOT_FOUND:
                raise
        else:
            raise ApiException.conflict("This GitHub version already exists; choose another version")
        release = await _github_api(caller, project.full_name, "POST", "releases", {
            "tag_name": body.tag, "target_commitish": main_sha, "name": body.tag,
            "draft": False, "prerelease": False, "generate_release_notes": True})
    else:
        release = await _github_api(caller, project.full_name, "GET", f"releases/tags/{quote(body.tag, safe='')}")
        if release.get("draft") or release.get("tag_name") != body.tag:
            raise ApiException.conflict("The selected GitHub release is not published")
    commit = await _github_api(caller, project.full_name, "GET", f"commits/{quote(body.tag, safe='')}")
    release_sha = commit["sha"]
    if body.create and release_sha != main_sha:
        raise ApiException.conflict("The new release tag does not point to the selected default branch commit")
    return release, release_sha


_FIRST_RELEASE_TAG = "v1.0.0"


async def _test_release(caller: Caller, project: mooi.Project) -> StartProductionRequest:
    """The release a chat tests with: the one currently deployed (latest successful deployment) or,
    before any, v1.0.0 — created on the default branch with the linked GitHub account when missing."""
    for page in range(10):
        data = await mooi.fetch_production_deployments(caller, project.id, page)
        deployed = next((item["releaseTag"] for item in data.get("deployments", [])
                         if item.get("state") == "succeeded"), None)
        if deployed:
            return StartProductionRequest(tag=deployed)
        if not data.get("hasMore"):
            break
    try:
        await _github_api(caller, project.full_name, "GET", f"releases/tags/{_FIRST_RELEASE_TAG}")
    except ApiException as error:
        if error.status_code != status.HTTP_404_NOT_FOUND:
            raise
        return StartProductionRequest(tag=_FIRST_RELEASE_TAG, create=True)
    return StartProductionRequest(tag=_FIRST_RELEASE_TAG)


async def _production_documents(caller: Caller, project_id: UUID) -> ProductionDocuments:
    return ProductionDocuments.model_validate(await mooi.fetch_production_recipe(caller, project_id))


async def _github_api(caller: Caller, full_name: str, method: str, path: str,
                      payload: dict | None = None) -> Any:
    token = await mooi.fetch_github_token(caller)
    url = f"https://api.github.com/repos/{full_name}/{path}"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.request(method, url, headers={
                "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"}, json=payload)
    except httpx.HTTPError:
        raise ApiException.bad_gateway("Could not reach GitHub") from None
    if response.status_code >= 400:
        raise ApiException(response.status_code if response.status_code < 500 else 502,
                           "GitHub could not complete the release request")
    return response.json()


class PendingPayload(BaseModel):
    kind: str
    requestId: str


class SessionPayload(BaseModel):
    id: UUID
    kind: Literal["session", "production"]
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
    # A normal session's clone; production uses a private, branchless agent directory.
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
    kind: Literal["session", "production"]
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
    production_edit_token: str = field(default_factory=lambda: secrets.token_urlsafe(32), repr=False)
    production_caller: Caller | None = field(default=None, repr=False)
    production_tested: bool = False
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
            kind=self.kind,
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
            workspacePath=None if self.kind == "production" or self.workspace == _UNSET_PATH else str(self.workspace),
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
    kind: Literal["session", "production"] = "session",
) -> Session:
    """Builds a session in `provisioning`, before any of the slow orchestration steps have run."""
    now = datetime.now(UTC)
    return Session(
        id=session_id,
        kind=kind,
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
            if session.kind == "production" and any(
                existing.player_id == session.player_id and existing.project_id == session.project_id
                and existing.kind == "production" and not existing.closing
                for existing in self._sessions.values()
            ):
                raise ApiException.conflict("A production deployment chat already exists for this project")
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

    Deployment updates share sequence/replay with chat but never acquire a turnId, mutate chat
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
    if type_ == EVENT_DEPLOYMENT_LOG:
        return session.log.append(type_, DeploymentLog.model_validate(data).model_dump(mode="json"))

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
    if session.kind != "production" and session.workspace != _UNSET_PATH:
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
    if session.kind == "production" or session.workspace == _UNSET_PATH or session.closing:
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
    if body.kind == "session":
        if body.branch is None:
            raise ApiException.bad_request("A branch is required for a session")
        await workspaces.get_workspaces().validate_branch(body.branch)
    if body.kind == "production":
        # A new deployment chat always replaces the project's previous one.
        for existing in registry.list_for(caller.player_id, body.projectId):
            if existing.kind == "production" and not existing.closing:
                await close_session(existing.id)

    session = new_session(
        session_id=uuid4(),
        player_id=caller.player_id,
        project_id=body.projectId,
        project_full_name="",
        provider=descriptor.id,
        connection_id=body.connectionId,
        branch=body.branch if body.kind == "session" else "",
        base_branch="",
        kind=body.kind,
    )

    session.config = config
    session.production_caller = caller if body.kind == "production" else None
    project = await mooi.fetch_project(caller, body.projectId)
    session.project_full_name = project.full_name
    session.base_branch = project.default_branch
    if session.kind == "production":
        session.branch = project.default_branch
    await registry.add(session)
    _record_status(session, STATUS_PROVISIONING, "Preparing the workspace")
    _spawn(session, _provision(session, caller, project, body.initialMessage))
    return session.to_payload()


async def _provision(session: Session, caller: Caller, project: mooi.Project,
                     initial_message: str | None = None) -> None:
    descriptor = describe(session.provider)
    started_at = time.perf_counter()
    try:
        _record_status(session, STATUS_PROVISIONING, "Loading the project")
        session.project_full_name = project.full_name
        session.base_branch = project.default_branch

        if session.kind == "production":
            _record_status(session, STATUS_PROVISIONING, f"Preparing {descriptor.label}")
            credential = await mooi.fetch_agent_credential(caller, str(session.connection_id))
            session.workspace = await workspaces.get_workspaces().create_production_workspace(session.id)
        else:
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
            session.workspace,
            session.branch if session.kind == "session" else "",
            _emitter(session),
            _asker(session),
            session.config,
        )
        session.runtime = runtime
        await runtime.start()

        if session.closing:
            return
        _record_status(session, STATUS_READY)
        if initial_message:
            async with session.operation_lock:
                if not session.closing and session.status == STATUS_READY:
                    # A failed delivery is already recorded on the session by `_deliver`.
                    with suppress(ApiException):
                        await _deliver(session, runtime, initial_message)
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
    sessions = [session for session in get_registry().list_for(caller.player_id, projectId)
                if session.kind == "session"]

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
    if session.kind == "production":
        session.production_caller = caller
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
        production_context = _production_context(session) if session.kind == "production" else ""
        await runtime.send(production_context + text)
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


@router.post("/sessions/{session_id}/clear", status_code=status.HTTP_204_NO_CONTENT)
async def clear_session_conversation(
    session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]
) -> None:
    session = get_registry().get_for(caller, session_id)
    async with session.operation_lock:
        if session.status != STATUS_READY or session.closing or session.deployment.state == "starting":
            raise ApiException.conflict("The session is not ready to clear its conversation")
        await _reset_conversation(session, caller)
        _touch_activity(session)


@router.post("/sessions/{session_id}/compact", status_code=status.HTTP_202_ACCEPTED)
async def compact_session_conversation(
    session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]
) -> None:
    session = get_registry().get_for(caller, session_id)
    async with session.operation_lock:
        if session.status != STATUS_READY or session.closing or session.deployment.state == "starting":
            raise ApiException.conflict("The session is not ready to compact its conversation")
        _runtime(session)
        _touch_activity(session)
        previous_context = session.usage.get("context")
        record(session, EVENT_SESSION_COMPACTION, {"phase": "started"})
        _record_status(session, STATUS_COMPACTING)
        record(session, "session.usage", {"context": None})
        _spawn(session, _run_compaction(session, previous_context))


async def _run_compaction(session: Session, previous_context: dict[str, Any] | None) -> None:
    """Own the long provider operation after the HTTP request has returned."""
    async with session.operation_lock:
        if session.closing or session.status != STATUS_COMPACTING:
            return
        try:
            await _runtime(session).compact()
        except asyncio.CancelledError:
            raise
        except Exception:
            LOG.exception("Session %s could not compact its conversation", session.id)
            record(session, "session.usage", {"context": previous_context})
            record(session, EVENT_SESSION_COMPACTION, {"phase": "failed"})
            record(session, "error", {"message": "The agent could not compact the conversation. Try again."})
            if session.status == STATUS_COMPACTING:
                _record_status(session, STATUS_READY)
        else:
            record(session, EVENT_SESSION_COMPACTION, {"phase": "completed"})
            if session.status == STATUS_COMPACTING:
                _record_status(session, STATUS_READY)


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
    if session.kind == "production":
        return _production_changes_payload(await _production_documents(caller, session.project_id))
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
    if session.kind == "production":
        return _production_file_diff(await _production_documents(caller, session.project_id), path)
    async with session.operation_lock:
        if session.workspace == _UNSET_PATH:
            raise ApiException.conflict("The workspace is still being prepared")
        diff = await workspaces.file_diff(session.workspace, session.base_commit, path)
        return FileDiffPayload(path=path, diff=diff)



# --- merge into the default branch -------------------------------------------------------------


def _require_mergeable(session: Session) -> None:
    """Merging reads the whole working tree, so no turn, question or deployment may be mid-flight."""
    if session.kind == "production":
        raise ApiException.conflict("Production deployment methods are published after a successful deployment")
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
    runtime = create_runtime(session.provider, credential, session.workspace,
                             session.branch if session.kind == "session" else "",
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


# --- production: project-scoped configuration, deployments and GitHub releases -----------------
#
# A project's production configuration (DEPLOYMENT.md, deploy.sh, status.sh and environment values)
# lives encrypted in mic-mooi. Deployments and status checks are project-scoped: they never need a
# chat. The optional production chat (a `kind="production"` session) edits the configuration through
# the token-guarded agent endpoints below; a failed deployment is handed to it when one is live.


EVENT_PRODUCTION_SYNC = "production.sync"
EVENT_PRODUCTION_LOG = "production.log"
EVENT_PRODUCTION_CONFIGURATION = "production.configuration"
_PRODUCTION_LOG_LIMIT = 2000
_PRODUCTION_BASE_ENVIRONMENT = ("PATH", "HOME", "USER", "LANG", "SSH_AUTH_SOCK")


@dataclass
class ProductionRun:
    """One project's live production state in this process: at most one deployment at a time,
    its output kept in memory for the console and persisted with the history entry when done."""

    project_id: UUID
    player_id: UUID
    snapshot: ProductionSnapshot = field(default_factory=ProductionSnapshot)
    logs: list[str] = field(default_factory=list)
    log: EventLog = field(default_factory=lambda: EventLog(limit=256))
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    task: asyncio.Task[None] | None = None


_production_runs: dict[UUID, ProductionRun] = {}
_production_capacity_lock = asyncio.Lock()
_production_status_capacity = asyncio.Semaphore(16)


def _production_run(caller: Caller, project_id: UUID) -> ProductionRun:
    """Only call after mic-mooi has confirmed the caller owns the project."""
    run = _production_runs.get(project_id)
    if run is None:
        run = _production_runs[project_id] = ProductionRun(project_id=project_id, player_id=caller.player_id)
    elif run.player_id != caller.player_id:
        raise ApiException.not_found("Project not found")
    return run


async def _owned_production(caller: Caller, project_id: UUID) -> tuple[mooi.Project, ProductionRun]:
    project = await mooi.fetch_project(caller, project_id)
    return project, _production_run(caller, project_id)


def _production_chat(player_id: UUID, project_id: UUID) -> Session | None:
    return next((session for session in get_registry().list_for(player_id, project_id)
                 if session.kind == "production" and not session.closing), None)


def _publish_production(run: ProductionRun, snapshot: ProductionSnapshot) -> None:
    run.snapshot = snapshot
    run.log.append(EVENT_PRODUCTION_UPDATED, snapshot.model_dump(mode="json"))


def _publish_production_sync(run: ProductionRun) -> None:
    run.log.append(EVENT_PRODUCTION_SYNC, {"snapshot": run.snapshot.model_dump(mode="json"), "logs": run.logs})


def _publish_production_output(run: ProductionRun, operation_id: UUID, lines: list[str]) -> None:
    run.logs = [*run.logs, *lines][-_PRODUCTION_LOG_LIMIT:]
    run.log.append(EVENT_PRODUCTION_LOG, {"operationId": str(operation_id), "lines": lines})


def _notify_production_configuration(run: ProductionRun, documents: ProductionDocuments) -> None:
    run.log.append(EVENT_PRODUCTION_CONFIGURATION, {"revision": documents.revision})


async def _production_environment(caller: Caller, project_id: UUID) -> dict[str, str]:
    """Server-wide MOOI_PRODUCTION_ values from .env, overridden by the project's stored ones."""
    values = production_environment()
    values.update(await mooi.fetch_production_environment(caller, project_id))
    return {name: value for name, value in values.items() if value}


def _require_environment(files: ProductionStoredFiles, environment: dict[str, str]) -> None:
    missing = [name for name in _required_environment(files) if name not in environment]
    if missing:
        raise ApiException.conflict("Set the missing environment variables: " + ", ".join(missing))


def _production_process_environment(environment: dict[str, str], snapshot: ProductionSnapshot) -> dict[str, str]:
    process_environment = {key: value for key, value in os.environ.items() if key in _PRODUCTION_BASE_ENVIRONMENT}
    process_environment.update(environment)
    process_environment.update({"MOOI_PRODUCTION_RELEASE_TAG": snapshot.releaseTag or "",
                                "MOOI_PRODUCTION_RELEASE_SHA": snapshot.releaseCommit or "",
                                "MOOI_PRODUCTION_RELEASE_URL": snapshot.releaseUrl or ""})
    return process_environment


def _production_context(session: Session) -> str:
    """Hidden instructions prefixed to every production chat message; the transcript shows only
    what the user typed."""
    base = f"http://127.0.0.1:{get_settings().sessions_port}/sessions/{session.id}/production/agent"
    return (
        f"You are the production deployment assistant of https://github.com/{session.project_full_name} "
        f"(default branch {session.base_branch}). The working directory is empty: there is no repository clone "
        "or branch. Fetch repository content on demand only when you need it (a shallow clone into a temporary "
        "directory or the GitHub API).\n\n"
        "The project's production configuration is exactly three VIRTUAL documents stored only in the Mooi "
        "platform database. Never write them to the repository or any filesystem path:\n"
        "- DEPLOYMENT.md (field manifest): what the deployment does, its target, method, prerequisites, "
        "required environment variables and how the service is verified.\n"
        "- deploy.sh (field script): a non-interactive bash script the platform runs from a detached checkout "
        "of the GitHub release the user selects (that checkout is the working directory). It must start with "
        "`set -euo pipefail`, be repeatable, read every secret from environment variables and deploy exactly "
        "MOOI_PRODUCTION_RELEASE_SHA.\n"
        "- status.sh (field statusScript): a non-interactive, read-only bash script, safe to run repeatedly "
        "from an empty working directory, that exits 0 only while the deployed service is healthy and prints "
        "concise status details. It must not depend on release variables.\n\n"
        "Environment: scripts read configuration only from variables named MOOI_PRODUCTION_<NAME>. The platform "
        "provides MOOI_PRODUCTION_RELEASE_TAG, MOOI_PRODUCTION_RELEASE_SHA and MOOI_PRODUCTION_RELEASE_URL. Every "
        "other MOOI_PRODUCTION_ variable the scripts mention without a shell default (${NAME:-default}) is "
        "required. Ask the user for each missing value (hosts, users, keys, tokens, domains...) and never invent "
        "credentials. Save the values the user gives you with the environment endpoint; the user can also set "
        "them in the Environment section of the deployment overview. Values are write-only: you only ever see "
        "their names.\n\n"
        "Platform API (use Python urllib with an inline JSON body, never a temporary file; send the header "
        f"X-Production-Edit-Token: {session.production_edit_token}):\n"
        f"- GET {base}/documents: active and draft documents plus the names of stored environment variables.\n"
        f"- PUT {base}/documents with JSON keys manifest, script, statusScript: saves the complete draft "
        "(always send all three).\n"
        f"- PUT {base}/environment with JSON {{\"values\": {{\"MOOI_PRODUCTION_NAME\": \"value\"}}}} "
        "(null removes a variable).\n"
        f"- GET {base}/deployments/{{operationId}}: read-only detail of a past attempt (files, result, redacted "
        "output).\n\n"
        f"- POST {base}/deployments with an empty JSON body {{}}: runs a real test deployment of the draft (or the "
        "active configuration when there is no draft). The platform chooses the release itself: the release "
        "currently deployed in production (latest successful deployment) or, when nothing was ever deployed, "
        f"{_FIRST_RELEASE_TAG}, which it creates on the default branch with the user's linked GitHub account when "
        "missing. It returns the deployment snapshot.\n"
        f"- GET {base}/deployment?wait=120: waits up to 120 seconds while a deployment runs, then returns its "
        "snapshot (state running, succeeded or failed; message; releaseTag) and the latest redacted output. Repeat "
        "it while the state is running.\n\n"
        "Testing is mandatory: finish every setup, update or fix with a successful test deployment. Once the draft "
        "is saved and every required variable is stored, start the test and wait for its result. If it fails, "
        "find the cause in the output, save a corrected draft (ask the user for anything missing) and test again. "
        "A successful test deploys that release to production and makes the draft the active configuration. Only "
        "after a successful test tell the user clearly that the deployment is tested and working: they can deploy "
        "any release with the Deploy button and close this chat.\n\n"
        "Never run deploy.sh yourself, never choose, create or publish releases yourself (the test endpoint does "
        "it) and never modify the repository.\n\n"
        "User message:\n"
    )


def _production_changes_payload(documents: ProductionDocuments) -> ChangesPayload:
    files: list[ChangedFilePayload] = []
    added = removed = 0
    if documents.draft:
        for path, field_name in _PRODUCTION_FILE_NAMES.items():
            before = getattr(documents.active, field_name) if documents.active else ""
            after = getattr(documents.draft, field_name)
            if before == after:
                continue
            delta = list(difflib.ndiff(before.splitlines(), after.splitlines()))
            file_added = sum(line.startswith("+ ") for line in delta)
            file_removed = sum(line.startswith("- ") for line in delta)
            files.append(ChangedFilePayload(path=path, change="modified" if before else "added",
                                            added=file_added, removed=file_removed))
            added += file_added
            removed += file_removed
    return ChangesPayload(branch="Draft configuration", baseBranch="Active configuration",
                          added=added, removed=removed, files=files)


def _production_file_diff(documents: ProductionDocuments, path: str) -> FileDiffPayload:
    field_name = _PRODUCTION_FILE_NAMES.get(path)
    if field_name is None:
        raise ApiException.not_found("Deployment document not found")
    before = getattr(documents.active, field_name) if documents.active else ""
    after = getattr(documents.draft, field_name) if documents.draft else before
    diff = "".join(difflib.unified_diff(before.splitlines(keepends=True), after.splitlines(keepends=True),
                                        fromfile=f"a/{path}", tofile=f"b/{path}"))
    return FileDiffPayload(path=path, diff=diff)


async def _save_production_draft(caller: Caller, project_id: UUID, files: ProductionFiles) -> ProductionDocuments:
    run = _production_run(caller, project_id)
    async with run.lock:
        if run.snapshot.state == "running":
            raise ApiException.conflict("Wait until the deployment completes")
        documents = ProductionDocuments.model_validate(
            await mooi.write_production_recipe(caller, project_id, files.model_dump()))
        _notify_production_configuration(run, documents)
        return documents


async def _save_production_environment(caller: Caller, project_id: UUID,
                                       body: ProductionEnvironmentUpdate) -> ProductionDocuments:
    run = _production_run(caller, project_id)
    documents = ProductionDocuments.model_validate(
        await mooi.write_production_environment(caller, project_id, body.values))
    _notify_production_configuration(run, documents)
    return documents


@router.get("/production/projects/{project_id}")
async def production_overview(project_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> ProductionOverview:
    _, run = await _owned_production(caller, project_id)
    documents = await _production_documents(caller, project_id)
    files = documents.draft or documents.active
    required = set(_required_environment(files))
    stored = set(documents.environment)
    server = {name for name, value in production_environment().items() if value}
    chat = _production_chat(caller.player_id, project_id)
    return ProductionOverview(
        configured=files is not None, deployed=documents.active is not None,
        hasDraft=documents.draft is not None, revision=documents.revision,
        environment=[ProductionEnvironmentVariable(name=name, configured=name in stored or name in server,
                                                   required=name in required)
                     for name in sorted(required | stored)],
        snapshot=run.snapshot, chatSessionId=chat.id if chat else None,
        chatTested=bool(chat and chat.production_tested),
    )


@router.get("/production/projects/{project_id}/events")
async def stream_production_events(project_id: UUID, request: Request,
                                   caller: Annotated[Caller, Depends(current_caller)]) -> StreamingResponse:
    """Live production state: a `production.sync` snapshot with the retained output, then updates,
    output batches and configuration changes. Reconnecting simply starts from a fresh sync."""
    _, run = await _owned_production(caller, project_id)
    settings = get_settings()
    queue = run.log.subscribe()

    async def frames() -> AsyncIterator[str]:
        try:
            last_seq = run.log.last_seq
            yield sse_frame(Event(last_seq, datetime.now(UTC), EVENT_PRODUCTION_SYNC,
                                  {"snapshot": run.snapshot.model_dump(mode="json"), "logs": run.logs}))
            next_auth_check = time.monotonic() + settings.introspection_cache_seconds
            while True:
                if time.monotonic() >= next_auth_check:
                    try:
                        await current_caller(request)
                    except Exception:
                        LOG.debug("Production stream authentication ended", exc_info=True)
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
            run.log.unsubscribe(queue)

    return StreamingResponse(frames(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})


@router.get("/production/projects/{project_id}/documents")
async def production_documents(project_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> ProductionDocuments:
    return await _production_documents(caller, project_id)


@router.put("/production/projects/{project_id}/documents/draft")
async def save_production_documents(project_id: UUID, body: ProductionFiles,
                                    caller: Annotated[Caller, Depends(current_caller)]) -> ProductionDocuments:
    await _owned_production(caller, project_id)
    return await _save_production_draft(caller, project_id, body)


@router.put("/production/projects/{project_id}/environment")
async def update_production_environment(project_id: UUID, body: ProductionEnvironmentUpdate,
                                        caller: Annotated[Caller, Depends(current_caller)]) -> ProductionDocuments:
    await _owned_production(caller, project_id)
    return await _save_production_environment(caller, project_id, body)


@router.delete("/production/projects/{project_id}/configuration", status_code=status.HTTP_204_NO_CONTENT)
async def delete_production_configuration(project_id: UUID,
                                          caller: Annotated[Caller, Depends(current_caller)]) -> Response:
    """Removes the documents and environment values; history and the deployed service stay."""
    _, run = await _owned_production(caller, project_id)
    async with run.lock:
        if run.snapshot.state == "running":
            raise ApiException.conflict("Wait until the deployment completes")
        await mooi.delete_production_recipe(caller, project_id)
        chat = _production_chat(caller.player_id, project_id)
        if chat is not None:
            await close_session(chat.id)
        _notify_production_configuration(run, ProductionDocuments())
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/production/projects/{project_id}/changes")
async def production_changes(project_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> ChangesPayload:
    return _production_changes_payload(await _production_documents(caller, project_id))


@router.get("/production/projects/{project_id}/changes/file")
async def production_file_diff(project_id: UUID, path: str,
                               caller: Annotated[Caller, Depends(current_caller)]) -> FileDiffPayload:
    return _production_file_diff(await _production_documents(caller, project_id), path)


@router.get("/production/projects/{project_id}/releases")
async def production_releases(project_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> ReleaseList:
    project, _ = await _owned_production(caller, project_id)
    data = await _github_api(caller, project.full_name, "GET", "releases?per_page=50")
    return ReleaseList(releases=[GithubRelease(tag=item["tag_name"], name=item.get("name") or item["tag_name"],
                                               url=item["html_url"], publishedAt=item.get("published_at"))
                                 for item in data if not item.get("draft")])


@router.post("/production/projects/{project_id}/deployments", status_code=status.HTTP_202_ACCEPTED)
async def start_production(project_id: UUID, body: StartProductionRequest,
                           caller: Annotated[Caller, Depends(current_caller)]) -> ProductionSnapshot:
    project, run = await _owned_production(caller, project_id)
    return await _start_production(run, caller, project, body)


async def _start_production(run: ProductionRun, caller: Caller, project: mooi.Project,
                            body: StartProductionRequest) -> ProductionSnapshot:
    project_id = project.id
    async with run.lock:
        if run.snapshot.state == "running":
            return run.snapshot
        documents = await _production_documents(caller, project_id)
        files = documents.draft or documents.active
        if files is None:
            raise ApiException.conflict("Set up the production deployment first")
        environment = await _production_environment(caller, project_id)
        _require_environment(files, environment)
        release, release_sha = await _resolve_production_release(project, caller, body)
        now = datetime.now(UTC)
        snapshot = ProductionSnapshot(state="running", operationId=uuid4(), message=f"Fetching release {body.tag}",
                                      releaseTag=body.tag, releaseUrl=release["html_url"], releaseCommit=release_sha,
                                      startedAt=now, updatedAt=now)
        previous, previous_logs = run.snapshot, run.logs
        async with _production_capacity_lock:
            running = sum(1 for item in _production_runs.values() if item.snapshot.state == "running")
            if running >= get_settings().max_deployments:
                raise ApiException(status.HTTP_429_TOO_MANY_REQUESTS, "Production deployment capacity is full")
            run.logs = []
            _publish_production(run, snapshot)
        chat = _production_chat(caller.player_id, project_id)
        try:
            await mooi.start_production_deployment(caller, project_id, snapshot.operationId,
                                                   chat.id if chat else None, body.tag, files.model_dump())
        except Exception:
            run.snapshot, run.logs = previous, previous_logs
            _publish_production_sync(run)
            raise
        run.task = asyncio.create_task(_run_production(run, caller, project, files, environment,
                                                       documents.draft is not None))
        return snapshot


async def _run_production(run: ProductionRun, caller: Caller, project: mooi.Project, files: ProductionStoredFiles,
                          environment: dict[str, str], publish_draft: bool) -> None:
    """Run deploy.sh against a temporary checkout of the selected release."""
    started = run.snapshot
    operation_id = started.operationId
    assert operation_id is not None and started.releaseTag is not None and started.releaseCommit is not None
    process: asyncio.subprocess.Process | None = None
    script_writer: asyncio.Task[None] | None = None
    checkout: Path | None = None
    pending: list[str] = []
    loop = asyncio.get_running_loop()
    last_flush = loop.time()

    def flush() -> None:
        nonlocal pending, last_flush
        if pending:
            _publish_production_output(run, operation_id, pending)
            pending = []
        last_flush = loop.time()

    async def conclude(state: Literal["succeeded", "failed"], message: str) -> None:
        """Persist first, so clients reloading history on the final snapshot see the outcome."""
        flush()
        try:
            await mooi.finish_production_deployment(caller, project.id, operation_id, state, message, run.logs)
        except Exception:
            LOG.warning("Could not save %s deployment %s", state, operation_id, exc_info=True)
        _publish_production(run, started.model_copy(update={
            "state": state, "message": message, "updatedAt": datetime.now(UTC)}))

    try:
        token = await mooi.fetch_github_token(caller)
        checkout = await workspaces.get_workspaces().create_release_checkout(
            operation_id, project.full_name, started.releaseTag, started.releaseCommit, token)
        _publish_production(run, started.model_copy(update={"message": "Running deploy.sh",
                                                            "updatedAt": datetime.now(UTC)}))
        secrets_ = tuple(value for value in environment.values() if len(value) >= 4)
        process = await asyncio.create_subprocess_exec(
            "bash", "-se", cwd=checkout, stdin=asyncio.subprocess.PIPE,
            env=_production_process_environment(environment, started),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, start_new_session=True,
        )

        async def feed_script() -> None:
            assert process is not None and process.stdin is not None
            process.stdin.write(files.script.encode())
            await process.stdin.drain()
            process.stdin.close()

        script_writer = asyncio.create_task(feed_script())
        async with asyncio.timeout(get_settings().deployment_timeout_seconds):
            assert process.stdout is not None
            while chunk := await process.stdout.readline():
                line = redact_deployment_output(chunk.decode("utf-8", "replace"),
                                                (str(checkout), *secrets_)).rstrip()[:2000]
                if line.strip():
                    pending.append(line)
                if len(pending) >= 50 or (pending and loop.time() - last_flush >= 0.25):
                    flush()
            code = await process.wait()
            await script_writer
        if code != 0:
            raise RuntimeError(f"deploy.sh exited with code {code}")
        if publish_draft:
            documents = ProductionDocuments.model_validate(await mooi.publish_production_recipe(caller, project.id))
            _notify_production_configuration(run, documents)
        chat = _production_chat(run.player_id, run.project_id)
        if chat is not None:
            chat.production_tested = True
        await conclude("succeeded", "Production deployment completed")
    except asyncio.CancelledError:
        await conclude("failed", "Production deployment interrupted")
        raise
    except Exception as error:
        if process is not None and process.returncode is None:
            with suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGTERM)
            try:
                await asyncio.wait_for(process.wait(), 5)
            except TimeoutError:
                with suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)
                await process.wait()
        if isinstance(error, TimeoutError):
            message = "Deployment timed out"
        elif isinstance(error, (RuntimeError, ApiException)):
            message = str(error) or "Production deployment failed"
        else:
            LOG.warning("Production deployment %s failed", operation_id, exc_info=True)
            message = "Production deployment failed"
        await conclude("failed", message)
        await _hand_off_production_failure(run, operation_id, message)
    finally:
        if script_writer is not None:
            if not script_writer.done():
                script_writer.cancel()
            with suppress(asyncio.CancelledError, BrokenPipeError, ConnectionResetError):
                await script_writer
        if process is not None and process.returncode is None:
            with suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGTERM)
            try:
                await asyncio.wait_for(process.wait(), 5)
            except TimeoutError:
                with suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)
                await process.wait()
        if checkout is not None:
            with suppress(Exception):
                await workspaces.get_workspaces().remove_release_checkout(operation_id)


async def _hand_off_production_failure(run: ProductionRun, operation_id: UUID, message: str) -> None:
    """A live, idle production chat receives the failure as a user message so it can fix it."""
    chat = _production_chat(run.player_id, run.project_id)
    if chat is None:
        return
    async with chat.operation_lock:
        if chat.closing or chat.status != STATUS_READY or chat.pending is not None or chat.runtime is None:
            return
        try:
            await _deliver(chat, chat.runtime,
                f"The production deployment {operation_id} failed: {message}\n\nRead its detail through the "
                "deployments endpoint, compare it with the current configuration, explain the cause and save a "
                "corrected draft. Ask me for anything missing.\n\nRecent redacted output:\n"
                + "\n".join(run.logs[-30:]))
        except Exception:
            LOG.warning("Could not deliver production failure to chat %s", chat.id, exc_info=True)


@router.post("/production/projects/{project_id}/status")
async def check_production_status(project_id: UUID,
                                  caller: Annotated[Caller, Depends(current_caller)]) -> ProductionStatusResult:
    _, run = await _owned_production(caller, project_id)
    if run.snapshot.state == "running":
        raise ApiException.conflict("Wait until the deployment completes")
    documents = await _production_documents(caller, project_id)
    files = documents.active or documents.draft
    if files is None or not files.statusScript.strip():
        raise ApiException.conflict("Add status.sh to the deployment configuration first")
    environment = await _production_environment(caller, project_id)
    _require_environment(files, environment)
    try:
        await asyncio.wait_for(_production_status_capacity.acquire(), timeout=0.1)
    except TimeoutError:
        raise ApiException(status.HTTP_429_TOO_MANY_REQUESTS, "Status checks are busy; try again shortly") from None
    try:
        with tempfile.TemporaryDirectory(prefix="mooi-status-") as directory:
            return await _run_production_status(files.statusScript, Path(directory),
                                                _production_process_environment(environment, run.snapshot),
                                                environment)
    finally:
        _production_status_capacity.release()


async def _run_production_status(script: str, workspace: Path, environment: dict[str, str],
                                 available: dict[str, str]) -> ProductionStatusResult:
    process = await asyncio.create_subprocess_exec(
        "bash", "-se", cwd=workspace, stdin=asyncio.subprocess.PIPE,
        env=environment, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        start_new_session=True,
    )
    try:
        async with asyncio.timeout(30):
            assert process.stdin is not None and process.stdout is not None
            try:
                process.stdin.write(script.encode())
                await process.stdin.drain()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                process.stdin.close()
            chunks: list[bytes] = []
            size = 0
            while chunk := await process.stdout.read(4096):
                size += len(chunk)
                if size > 32768:
                    raise RuntimeError("Status output exceeded 32 KB")
                chunks.append(chunk)
            code = await process.wait()
    except (TimeoutError, RuntimeError) as error:
        with suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGKILL)
        await process.wait()
        return ProductionStatusResult(state="unhealthy", output=str(error) or "Status check timed out")
    finally:
        if process.returncode is None:
            with suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGKILL)
            await process.wait()
    secrets = tuple(value for value in available.values() if len(value) >= 4)
    output = redact_deployment_output(b"".join(chunks).decode("utf-8", "replace"), secrets).strip()
    return ProductionStatusResult(state="healthy" if code == 0 else "unhealthy",
                                  output=output[:32768] or f"Status script exited with code {code}")


@router.delete("/production/projects/{project_id}/deployments/{operation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_production_deployment(project_id: UUID, operation_id: UUID,
                                       caller: Annotated[Caller, Depends(current_caller)]) -> Response:
    _, run = await _owned_production(caller, project_id)
    async with run.lock:
        if run.snapshot.operationId == operation_id and run.snapshot.state == "running":
            raise ApiException.conflict("Wait for the deployment to finish before deleting its data")
        await mooi.delete_production_deployment(caller, project_id, operation_id)
        if run.snapshot.operationId == operation_id:
            run.snapshot, run.logs = ProductionSnapshot(), []
            _publish_production_sync(run)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _agent_recipe_access(session_id: UUID, request: Request) -> tuple[Session, Caller]:
    session = get_registry().get(session_id)
    token = request.headers.get("X-Production-Edit-Token", "")
    if (request.client is None or request.client.host not in ("127.0.0.1", "::1")
            or session is None or session.kind != "production" or session.closing
            or not hmac.compare_digest(token, session.production_edit_token)
            or session.production_caller is None):
        raise ApiException.not_found("Deployment configuration not found")
    return session, session.production_caller


@router.get("/sessions/{session_id}/production/agent/documents")
async def agent_production_documents(session_id: UUID, request: Request) -> ProductionDocuments:
    session, caller = _agent_recipe_access(session_id, request)
    return await _production_documents(caller, session.project_id)


@router.put("/sessions/{session_id}/production/agent/documents")
async def agent_save_production_documents(session_id: UUID, request: Request,
                                          body: ProductionFiles) -> ProductionDocuments:
    session, caller = _agent_recipe_access(session_id, request)
    documents = await _save_production_draft(caller, session.project_id, body)
    session.production_tested = False
    return documents


@router.put("/sessions/{session_id}/production/agent/environment")
async def agent_save_production_environment(session_id: UUID, request: Request,
                                            body: ProductionEnvironmentUpdate) -> ProductionDocuments:
    session, caller = _agent_recipe_access(session_id, request)
    return await _save_production_environment(caller, session.project_id, body)


@router.get("/sessions/{session_id}/production/agent/deployments/{operation_id}")
async def agent_production_deployment_detail(session_id: UUID, operation_id: UUID, request: Request) -> dict:
    session, caller = _agent_recipe_access(session_id, request)
    return await mooi.fetch_production_deployment_detail(caller, session.project_id, operation_id)


@router.post("/sessions/{session_id}/production/agent/deployments", status_code=status.HTTP_202_ACCEPTED)
async def agent_test_production(session_id: UUID, request: Request) -> ProductionSnapshot:
    """A real deployment of the current configuration with the release `_test_release` picks."""
    session, caller = _agent_recipe_access(session_id, request)
    project = await mooi.fetch_project(caller, session.project_id)
    run = _production_run(caller, session.project_id)
    return await _start_production(run, caller, project, await _test_release(caller, project))


@router.get("/sessions/{session_id}/production/agent/deployment")
async def agent_production_deployment(session_id: UUID, request: Request, wait: int = 0) -> dict:
    """The live deployment snapshot and its latest output, optionally waiting while it runs."""
    session, caller = _agent_recipe_access(session_id, request)
    run = _production_run(caller, session.project_id)
    task = run.task
    if wait > 0 and run.snapshot.state == "running" and task is not None and not task.done():
        await asyncio.wait({task}, timeout=min(wait, 120))
    return {"snapshot": run.snapshot.model_dump(mode="json"), "output": run.logs[-200:]}


async def close_productions() -> None:
    """Interrupts running deployments on shutdown; each records itself as interrupted."""
    tasks = [run.task for run in _production_runs.values() if run.task is not None and not run.task.done()]
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    for run in _production_runs.values():
        run.log.close()


# --- deployment: deterministic Compose run, agent setup through the chat -----------------------


_WEB_DEPENDENCIES = ("vite", "react", "vue", "@angular/core", "next")
_WEB_SCAN_IGNORED = {"node_modules", "target", "build", "dist", "venv", "__pycache__"}
_WEB_SCAN_MAX_DEPTH = 4

# Failures the agent can fix by editing the repository's Docker setup; anything else is
# infrastructure or the player's own decision and stays a plain failed deployment.
_AGENT_FIXABLE_CODES = frozenset({
    "invalid_compose", "unsupported_project", "startup_failed", "health_check_failed", "timeout",
})

PHASE_PREPARING = "Preparing the deployment"
PHASE_BUILDING = "Building images and starting containers"
PHASE_PROBING = "Waiting for the application to answer"
PHASE_STOPPING = "Stopping the application"


@dataclass(frozen=True)
class DeploymentPlan:
    """What the root Compose file says to run: its file, the one browser port and how to probe it."""

    compose: str
    port: DockerPortRequest
    expectation: Literal["html", "http"]


def _web_roots(checkout: Path) -> set[Path]:
    """Roots of every web frontend package, so Compose can never leave one out of the preview."""
    roots: set[Path] = set()
    for current_value, directories, files in os.walk(checkout, followlinks=False):
        current = Path(current_value)
        depth = len(current.relative_to(checkout).parts)
        directories[:] = [name for name in directories if depth < _WEB_SCAN_MAX_DEPTH
                          and name not in _WEB_SCAN_IGNORED and not name.startswith(".")]
        if "package.json" not in files:
            continue
        try:
            package = json.loads((current / "package.json").read_text())
            dependencies = {**package.get("dependencies", {}), **package.get("devDependencies", {})}
        except (OSError, ValueError, TypeError, AttributeError):
            continue
        if any(name in dependencies for name in _WEB_DEPENDENCIES):
            roots.add(current)
    return roots


async def _deployment_plan(docker: Docker, checkout: Path, *, deadline: float) -> DeploymentPlan:
    """Reads the preview straight from the root Compose; anything ambiguous is left to the agent."""
    checkout = checkout.resolve()
    compose = await docker.describe_existing_compose(checkout, deadline=deadline)
    services = {build.context: build.service for build in compose.builds}
    web_roots = _web_roots(checkout)
    if any(root not in services for root in web_roots):
        raise DockerError("invalid_compose", "Compose does not build every web frontend of the repository")
    web_services = {services[root] for root in web_roots}
    ports = [port for port in compose.ports
             if port.protocol == "tcp" and (not web_services or port.service in web_services)]
    if len(ports) != 1:
        raise DockerError("invalid_compose", "Compose must publish exactly one browser port"
                          + (" on the web frontend service" if web_services else ""))
    return DeploymentPlan(compose.file, ports[0], "html" if web_services else "http")


def _deployment_prompt(failure: str) -> str:
    settings = get_settings()
    return f"""Set up this repository so Mooi can deploy it as a live web preview.

Mooi's last deployment attempt failed:
{failure}

How Mooi deploys once the user deploys again:
- It resolves the single Compose file at the repository root (`compose.yaml`, `compose.yml`, `docker-compose.yaml` or `docker-compose.yml`), with the root `.env` when present.
- It builds every service with a `build` section and starts all of them.
- It keeps exactly one published TCP port and drops every other publication: the one of the service building the web frontend (a Vite, React, Vue, Angular or Next package), or the only one of an API-only product.
- It waits for every container healthcheck, then expects `GET /` on that port to answer 2xx/3xx, with an HTML document when there is a frontend.
- The preview is served from `{settings.preview_scheme}://{settings.preview_public_host}` on a port Mooi assigns, embedded in an iframe from `{settings.cors_origin}`.

1. Read the root AGENTS.md/CLAUDE.md and the instructions that apply to the files you edit, then find the cause of the failure. Repair what exists instead of recreating a working configuration.
2. Give each deployable artifact its own Dockerfile at its root, with a `.dockerignore`, dependency cache layers, slim or alpine multistage images, and frontends built as static files without dev servers or HMR.
3. Keep ONE root Compose file that builds those Dockerfiles through `build.context` and `build.dockerfile`. Databases and caches run as services with named volumes and credentials you choose yourself; give every variable an explicit literal value.
4. Prefer one public frontend port: a static server that proxies the API routes to the backend by its Compose service name, allows being framed by `{settings.cors_origin}`, and a frontend that calls the API through relative same-origin routes.
5. Every service listens on 0.0.0.0 and has a healthcheck on an existing endpoint or a TCP/process check against 127.0.0.1, never localhost. Never add endpoints, dependencies or authentication exceptions for it.
6. Do not use `container_name`, `env_file`, `profiles`, bind mounts, external networks or volumes, `privileged`, host networking or the Docker socket.
7. Only edit deployment files: never application source, dependency manifests, authentication rules or runtime application configuration. Use harmless placeholders for third-party credentials only when the application still starts; never fabricate real ones.
8. Never build, start or stop containers yourself, and do not commit or push: Mooi runs the deployment when the user deploys again.
9. Finish with a short summary of what you changed and anything the user must still provide."""


def _failure_detail(error: DockerError) -> str:
    """The public failure plus its redacted output tail: what the agent needs to diagnose it."""
    tail = redact_deployment_output(error.detail or "").strip()
    return f"{error}\n\n```\n{tail}\n```" if tail else str(error)


async def _hand_off_to_agent(session: Session, caller: Caller, failure: str) -> bool:
    """Clears the conversation and asks the agent to set the deployment up, the same way merge
    conflicts are resolved; the caller holds the operation lock."""
    if session.closing or session.status != STATUS_READY or session.pending is not None or session.runtime is None:
        return False
    try:
        runtime = await _reset_conversation(session, caller)
        await _deliver(session, runtime, _deployment_prompt(failure))
    except Exception:
        # The deployment must still finish as failed: never leave it `starting`.
        LOG.warning("Session %s could not hand its deployment setup to the agent", session.id, exc_info=True)
        return False
    return True


async def _admit_deployment_start(session: Session, caller: Caller) -> DeploymentSnapshot:
    """Atomically admit once; the spawned worker owns finalization and rollback.

    No provider/Docker I/O under operation_lock.
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
        await _reserve_deployment(session.id)
        operation_id = uuid4()
        snapshot = DeploymentSnapshot(state="starting", operationId=operation_id, phase=PHASE_PREPARING,
                                      previewUrl=None, result=None, cleanupRequired=False,
                                      updatedAt=datetime.now(UTC))
        # The event-loop cannot execute the worker until this lock scope has returned.
        record(session, EVENT_DEPLOYMENT_UPDATED, snapshot.model_dump())
        _touch_activity(session, snapshot.updatedAt)
        session.deployment_task = _spawn(session, _run_deployment_start(session, caller, operation_id))
        return snapshot


# Public reasons are selected by code: engine diagnostics never cross the API boundary.
_DEPLOYMENT_MESSAGES: dict[str, str] = {
    "unsupported_project": "The Docker setup uses features Mooi cannot run",
    "docker_unavailable": "Check Docker Compose and access to the configured Docker engine",
    "invalid_compose": "The repository has no usable root Docker Compose setup",
    "port_unavailable": "No permitted publication port is available; check the engine and configured range",
    "startup_failed": "The application could not be built or started",
    "health_check_failed": "The application did not become ready",
    "timeout": "The deployment timed out",
    "cancelled": "Deployment was cancelled",
    "cleanup_failed": "Resources may remain; restore Docker access and retry Stop before deploying again",
}


def _deployment_reason(code: str, delegated: bool = False) -> DeploymentReason:
    if code not in _DEPLOYMENT_MESSAGES:
        code = "startup_failed"
    message = _DEPLOYMENT_MESSAGES[code]
    if delegated:
        message += ". The agent is setting it up in the chat; deploy again once it finishes"
    return DeploymentReason(code=code, message=message)


def _publish_deployment_phase(session: Session, operation_id: UUID, phase: str) -> None:
    if (session.closing or session.deployment.operationId != operation_id
            or session.deployment.state not in ("starting", "stopping")):
        return
    record(session, EVENT_DEPLOYMENT_UPDATED, session.deployment.model_copy(update={
        "phase": phase, "updatedAt": datetime.now(UTC),
    }).model_dump())


class _DeploymentLogWriter:
    """Publishes the Compose output of one start operation as batched `deployment.log` events.

    The log shares the session event log with the chat, so it must not be able to evict the
    conversation: it stops after `deployment_log_lines` lines and says so once. Publication is
    best effort and stale operations are dropped rather than interleaved with a newer one.
    """

    _BATCH_LINES = 50
    _LINE_CHARS = 2000
    _FLUSH_SECONDS = 0.25

    def __init__(self, session: Session, operation_id: UUID) -> None:
        self._session = session
        self._operation_id = operation_id
        self._sensitive = (str(session.workspace), str(get_settings().workspace_root))
        self._remaining = get_settings().deployment_log_lines
        self._truncated = False
        self._lines: list[str] = []
        self._index = 0
        self._timer: asyncio.TimerHandle | None = None

    def __call__(self, line: str) -> None:
        if self._truncated:
            return
        if self._remaining:
            self._remaining -= 1
            self._lines.append(redact_deployment_output(line, self._sensitive)[:self._LINE_CHARS])
        else:
            self._truncated = True
            self._lines.append("… log truncated")
        if len(self._lines) >= self._BATCH_LINES or self._truncated:
            self.flush()
        elif self._timer is None:
            self._timer = asyncio.get_running_loop().call_later(self._FLUSH_SECONDS, self.flush)

    def flush(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None
        lines, self._lines = self._lines, []
        if (not lines or self._session.closing
                or self._session.deployment.operationId != self._operation_id):
            return
        record(self._session, EVENT_DEPLOYMENT_LOG,
               {"operationId": self._operation_id, "index": self._index, "lines": lines})
        self._index += 1


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
    """Deploys the root Compose deterministically. A failure the agent can fix is handed to the
    chat in a fresh conversation, which ends with the deployment set up for the next Deploy."""
    failure: str | None = None
    log = _DeploymentLogWriter(session, operation_id)
    try:
        deadline = asyncio.get_running_loop().time() + get_settings().deployment_timeout_seconds
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
            plan = await _deployment_plan(docker, session.workspace, deadline=deadline)
            _publish_deployment_phase(session, operation_id, PHASE_BUILDING)
            await docker.freeze_compose(manifests=manifests, session_id=session.id, checkout=session.workspace,
                                        compose_files=(Path(plan.compose),), web_service=plan.port.service,
                                        deadline=deadline)
            await docker.configure_ports(manifests=manifests, session_id=session.id, ports=(plan.port,),
                                         deadline=deadline)
            try:
                await docker.up(manifests=manifests, session_id=session.id, deadline=deadline, on_line=log)
            finally:
                log.flush()
            _publish_deployment_phase(session, operation_id, PHASE_PROBING)
            readiness = await docker.readiness(
                manifests=manifests, session_id=session.id, container_port=plan.port.container_port,
                expectation=plan.expectation, deadline=deadline,
            )
            if session.closing or session.deployment.operationId != operation_id:
                raise asyncio.CancelledError
            _deployment_finish(session, operation_id, "start", url=readiness.preview_url)
            session.deployment_monitor = _spawn(session, _monitor_deployment(session, operation_id))
            return
    except asyncio.CancelledError:
        code = "cancelled"
    except TimeoutError:
        code = "timeout"
        failure = f"The deployment did not finish within {get_settings().deployment_timeout_seconds} seconds"
    except DockerError as error:
        code, failure = error.code, _failure_detail(error)
    except DockerManifestError:
        code = "cleanup_failed"
    except Exception:
        code = "startup_failed"
    LOG.warning("Deployment %s start failed with %s", session.id, code, exc_info=True)
    # Rollback has its own stop deadline, independent of the exhausted start deadline.
    # Shield AND join it: stop/close must wait for every possible engine mutation.
    cleanup = await _settle_deployment_cleanup(session)
    delegated = False
    # A closing session holds the lock while it joins this worker: never wait for it then.
    if failure and code in _AGENT_FIXABLE_CODES and not cleanup and not session.closing:
        async with session.operation_lock:
            delegated = (session.deployment.operationId == operation_id
                         and await _hand_off_to_agent(session, caller, failure))
    _deployment_finish(session, operation_id, "start", reason=_deployment_reason(code, delegated), cleanup=cleanup)


@router.post("/sessions/{session_id}/deployment/start", status_code=status.HTTP_202_ACCEPTED)
async def start_deployment(session_id: UUID, caller: Annotated[Caller, Depends(current_caller)]) -> DeploymentSnapshot:
    session = get_registry().get_for(caller, session_id)
    if session.kind == "production":
        raise ApiException.conflict("Use the production deployment action for this chat")
    # Read live rather than cached on the session: the player can change the setting at any time.
    # Stop stays ungated, so a deployment started before the change can always be torn down.
    project = await mooi.fetch_project(caller, session.project_id)
    if not project.web_application:
        raise ApiException.conflict("Deploy and preview are only available for web applications")
    return await _admit_deployment_start(session, caller)


async def _run_deployment_stop(session: Session, operation_id: UUID, previous: asyncio.Task | None) -> None:
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
        snapshot = DeploymentSnapshot(state="stopping", operationId=operation_id, phase=PHASE_STOPPING,
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
    await close_productions()
