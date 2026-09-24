"""Transversal aspect: agent provider runtimes.

Provider-neutral contracts: the session feature depends on the `AgentRuntime` protocol, on the
domain events built here, and on the `PROVIDERS` factory — never on a vendor
SDK. `claude_agent_sdk` is imported **only** by the Claude adapters in this module, and a second provider's SDK
must be confined to its own adapter exactly the same way.

Adding a provider:

1. Implement the `AgentRuntime` protocol in a new class in this module.
2. The adapter owns all vendor state — subprocess, HTTP session, and its own conversation history
   when the vendor SDK is stateless: `send(text)` must work N times on a live runtime.
3. Emit the required domain events (`session.status`, `message.user`, `assistant.message`,
   `tool.use`, `tool.result`, `turn.result`, `error`) and only the optional ones the adapter's
   `AgentCapabilities` declares. Absence of an optional event is compliance, not a bug.
4. `interrupt()` may be a no-op when the `interrupt` capability is `False`.
5. Register a `ProviderDescriptor` in `PROVIDERS`.

Nothing outside this module changes.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
from collections.abc import Awaitable, Callable
from contextlib import suppress
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, ClassVar, Literal, Protocol, TypedDict, runtime_checkable
from uuid import UUID, uuid4

# The single import of a vendor SDK in the whole service belongs to the Claude adapters, and a second provider's SDK must stay confined to its own adapter the same way.
from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ConversationResetMessage,
    PermissionResult,
    PermissionResultAllow,
    PermissionResultDeny,
    ResultMessage,
    StreamEvent,
    SystemMessage,
    TextBlock,
    ThinkingBlock,
    ToolPermissionContext,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
    create_sdk_mcp_server,
    tool,
)

from mic_sessions.shared.docker import redact_deployment_output
from mic_sessions.shared.env import get_settings
from mic_sessions.shared.mooi import Credential
from mic_sessions.shared.web import ApiException

LOG = logging.getLogger("sessions")

STATUS_PROVISIONING = "provisioning"
STATUS_READY = "ready"
STATUS_WORKING = "working"
STATUS_WAITING = "waiting"
STATUS_FAILED = "failed"
STATUS_CLOSED = "closed"

_SUMMARY_LIMIT = 100_000
_TITLE_LIMIT = 120
_FILE_TOOLS = {"Read", "Edit", "Write", "MultiEdit", "NotebookEdit"}
_QUESTION_TOOL = "AskUserQuestion"
_DENIED_MESSAGE = "The user declined this action"
_KIND_PERMISSION = "permission"
_KIND_QUESTION = "question"


class AgentEvent(TypedDict):
    """One domain event: `type` is an event name and `data` its exact payload."""

    type: str
    data: dict[str, Any]


def session_status(status: str, detail: str | None = None) -> AgentEvent:
    return {"type": "session.status", "data": {"status": status, "detail": detail}}


def message_user(message_id: str, text: str) -> AgentEvent:
    return {"type": "message.user", "data": {"messageId": message_id, "text": text}}


def assistant_delta(message_id: str, text: str) -> AgentEvent:
    return {"type": "assistant.delta", "data": {"messageId": message_id, "text": text}}


def assistant_message(message_id: str, text: str) -> AgentEvent:
    return {"type": "assistant.message", "data": {"messageId": message_id, "text": text}}


def thinking_delta(message_id: str, text: str) -> AgentEvent:
    return {"type": "thinking.delta", "data": {"messageId": message_id, "text": text}}


def thinking_message(message_id: str, text: str) -> AgentEvent:
    return {"type": "thinking.message", "data": {"messageId": message_id, "text": text}}


def tool_use(tool_use_id: str, name: str, title: str, input_data: dict[str, Any]) -> AgentEvent:
    return {
        "type": "tool.use",
        "data": {"toolUseId": tool_use_id, "name": name, "title": title, "input": input_data},
    }


def tool_result(tool_use_id: str, is_error: bool, summary: str) -> AgentEvent:
    return {
        "type": "tool.result",
        "data": {"toolUseId": tool_use_id, "isError": is_error, "summary": summary},
    }


def permission_request(request_id: str, tool_name: str, title: str, input_data: dict[str, Any]) -> AgentEvent:
    return {
        "type": "permission.request",
        "data": {"requestId": request_id, "toolName": tool_name, "title": title, "input": input_data},
    }


def permission_resolved(request_id: str, decision: str) -> AgentEvent:
    return {"type": "permission.resolved", "data": {"requestId": request_id, "decision": decision}}


def question_request(request_id: str, questions: list[dict[str, Any]]) -> AgentEvent:
    return {"type": "question.request", "data": {"requestId": request_id, "questions": questions}}


def question_resolved(request_id: str, answers: dict[str, Any]) -> AgentEvent:
    return {"type": "question.resolved", "data": {"requestId": request_id, "answers": answers}}


def turn_result(
    terminal_reason: str | None,
    subtype: str | None = None,
    duration_ms: int | None = None,
    cost_usd: float | None = None,
    usage: dict[str, Any] | None = None,
) -> AgentEvent:
    return {
        "type": "turn.result",
        "data": {
            "terminalReason": terminal_reason,
            "subtype": subtype,
            "durationMs": duration_ms,
            "costUsd": cost_usd,
            "usage": usage,
        },
    }


def changes_updated(changes: dict[str, Any]) -> AgentEvent:
    return {"type": "changes.updated", "data": changes}


def session_configuration(model: str, effort: str | None) -> AgentEvent:
    return {"type": "session.configuration", "data": {"model": model, "effort": effort}}


def agent_error(message: str) -> AgentEvent:
    return {"type": "error", "data": {"message": message}}


@dataclass(frozen=True)
class PermissionRequest:
    """The adapter is blocked until the player allows or denies this tool call."""

    request_id: str
    tool_name: str
    title: str
    input: dict[str, Any]


@dataclass(frozen=True)
class QuestionRequest:
    """The adapter is blocked until the player answers the agent's own questions."""

    request_id: str
    questions: list[dict[str, Any]]


Emit = Callable[[str, dict[str, Any]], Awaitable[None]]
"""Publishes one domain event to the session's event log."""

Ask = Callable[[PermissionRequest | QuestionRequest], Awaitable[dict[str, Any]]]
"""Announces to the host that the adapter is now blocked on the player, so the session can move to
`waiting` and expose the pending request. The answer itself does not come back through this call:
it arrives through `resolve(request_id, payload)` on the adapter, because a vendor callback has to
return a vendor-typed result that only the adapter can build. The returned dict is host context and
is empty today."""


@dataclass(frozen=True)
class AgentCapabilities:
    """What a provider can actually do. Everything defaults to `False`, so a new adapter is
    conservative until it opts in and the SPA renders only the affordances it declares."""

    streaming: bool = False
    thinking: bool = False
    permissions: bool = False
    questions: bool = False
    interrupt: bool = False
    editable_tool_input: bool = False
    cost: bool = False

    def as_payload(self) -> dict[str, bool]:
        return {
            "streaming": self.streaming,
            "thinking": self.thinking,
            "permissions": self.permissions,
            "questions": self.questions,
            "interrupt": self.interrupt,
            "editableToolInput": self.editable_tool_input,
            "cost": self.cost,
        }


@dataclass(frozen=True)
class AgentConfig:
    model: str
    effort: str | None


@runtime_checkable
class AgentRuntime(Protocol):
    """One live agent conversation on one workspace.

    `capabilities` is a class attribute so a runtime instance and its descriptor can never disagree.
    Constructor contract: `(credential, workspace, emit, ask, config)`.
    """

    capabilities: ClassVar[AgentCapabilities]

    def __init__(
        self,
        credential: Credential,
        workspace: Path,
        branch: str,
        emit: Emit,
        ask: Ask,
        config: AgentConfig,
    ) -> None: ...

    @staticmethod
    def configuration() -> dict[str, Any]: ...

    @classmethod
    def configure(cls, model: str | None, effort: str | None) -> AgentConfig: ...

    async def start(self) -> None: ...

    async def send(self, text: str) -> None: ...

    async def set_configuration(self, config: AgentConfig) -> AgentConfig: ...

    async def interrupt(self) -> None: ...

    async def close(self) -> None: ...

    async def resolve(self, request_id: str, payload: dict[str, Any]) -> None: ...


CLAUDE_CAPABILITIES = AgentCapabilities(
    streaming=True,
    thinking=True,
    permissions=False,
    questions=True,
    interrupt=True,
    editable_tool_input=False,
    cost=True,
)


@dataclass
class _PendingRequest:
    """One in-flight `can_use_tool` call, parked until the player answers it."""

    kind: str
    future: asyncio.Future[dict[str, Any]]


class _InMemoryTranscriptStore:
    """Keeps one runtime's opaque SDK transcript for reconnecting clients."""

    def __init__(self) -> None:
        self._entries: dict[tuple[str, str, str | None], list[dict[str, Any]]] = {}
        self._entry_ids: dict[tuple[str, str, str | None], set[str]] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _key(key: dict[str, Any]) -> tuple[str, str, str | None]:
        return (str(key["project_key"]), str(key["session_id"]), key.get("subpath"))

    async def append(self, key: dict[str, Any], entries: list[dict[str, Any]]) -> None:
        """Persist SDK blobs in order and de-duplicate retried mirror frames."""
        storage_key = self._key(key)
        async with self._lock:
            stored = self._entries.setdefault(storage_key, [])
            known_ids = self._entry_ids.setdefault(storage_key, set())
            for entry in entries:
                entry_id = entry.get("uuid")
                if isinstance(entry_id, str) and entry_id in known_ids:
                    continue
                # The SDK owns this schema. A shallow copy prevents a caller
                # from mutating the top-level object after append returns.
                stored.append(dict(entry))
                if isinstance(entry_id, str):
                    known_ids.add(entry_id)

    async def load(self, key: dict[str, Any]) -> list[dict[str, Any]] | None:
        async with self._lock:
            entries = self._entries.get(self._key(key))
            return [dict(entry) for entry in entries] if entries else None


def _tool_title(name: str, input_data: dict[str, Any]) -> str:
    if name == "Bash":
        label = str(input_data.get("command") or name)
    elif name in _FILE_TOOLS:
        label = str(input_data.get("file_path") or input_data.get("notebook_path") or name)
    elif name == "Skill":
        label = str(input_data.get("skill") or input_data.get("name") or input_data.get("description") or name)
    else:
        label = next(
            (
                str(input_data[key])
                for key in ("path", "query", "pattern", "url", "task", "description", "prompt")
                if input_data.get(key)
            ),
            name,
        )
    return label[:_TITLE_LIMIT]


def _result_summary(content: Any) -> str:
    text = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False, default=str)
    if len(text) > _SUMMARY_LIMIT:
        return text[:_SUMMARY_LIMIT] + "\n[Output truncated at 100,000 characters]"
    return text


class ClaudeAgentRuntime:
    """Adapter for Claude Code through `claude_agent_sdk`, the only module here that imports it.

    Credentials are process environment for this SDK, and `ClaudeAgentOptions.env` is bound at
    construction: the client instance is therefore the unit of credential isolation — one session,
    one subprocess, one player token, never swapped on a live client.
    """

    capabilities: ClassVar[AgentCapabilities] = CLAUDE_CAPABILITIES

    @staticmethod
    def configuration() -> dict[str, Any]:
        settings = get_settings()
        return {"id": "claude", "label": "Claude",
                "models": [{"id": model, "label": model.title(), "efforts": efforts}
                           for model, efforts in settings.agent_claude_models.items()],
                "defaultModel": settings.agent_claude_model or "sonnet",
                "defaultEffort": settings.agent_claude_effort}

    @classmethod
    def configure(cls, model: str | None, effort: str | None) -> AgentConfig:
        catalog = cls.configuration()
        chosen = model or catalog["defaultModel"]
        candidate = next((item for item in catalog["models"] if item["id"] == chosen), None)
        if candidate is None:
            raise ApiException.bad_request("Unsupported model")
        supported = candidate["efforts"]
        default = catalog["defaultEffort"]
        chosen_effort = effort if effort is not None else (
            default if default in supported else supported[0] if supported else None
        )
        if chosen_effort is not None and chosen_effort not in candidate["efforts"]:
            raise ApiException.bad_request("Unsupported effort for this model")
        return AgentConfig(chosen, chosen_effort)


    def __init__(
        self,
        credential: Credential,
        workspace: Path,
        branch: str,
        emit: Emit,
        ask: Ask,
        config: AgentConfig,
    ) -> None:
        self._config = config
        self._credential = credential
        self._workspace = workspace
        self._branch = branch
        self._emit = emit
        self._ask = ask
        self._client: ClaudeSDKClient | None = None
        self._pump: asyncio.Task[None] | None = None
        self._pending: dict[str, _PendingRequest] = {}
        self._stream_message_id: str | None = None
        self._stream_ids: dict[str, str] = {}
        self._interrupted = False
        self._awaiting_first_event_at: float | None = None
        self._config_dir: Path | None = None
        self._clients: set[ClaudeSDKClient] = set()
        self._conversation_id: str | None = None
        self._transcript_store = _InMemoryTranscriptStore()

    async def start(self) -> None:
        started_at = time.perf_counter()
        self._workspace = await asyncio.to_thread(self._validate_workspace)
        # Provider state is private to this runtime and survives client replacement.
        # It is outside the checkout, but inside the owned session directory so
        # workspace reconciliation can remove it after an unclean service exit.
        self._config_dir = Path(tempfile.mkdtemp(prefix="claude-", dir=self._workspace.parent))
        self._client = await self._connect_client(self._config)
        self._pump = asyncio.create_task(self._pump_messages(self._client))
        LOG.info("Claude runtime connected in %.0f ms", (time.perf_counter() - started_at) * 1000)

    async def send(self, text: str) -> None:
        self._interrupted = False
        started_at = time.perf_counter()
        await self._require_client().query(text)
        self._awaiting_first_event_at = time.perf_counter()
        LOG.info("Claude turn submitted in %.0f ms", (time.perf_counter() - started_at) * 1000)

    async def set_configuration(self, config: AgentConfig) -> AgentConfig:
        """Apply a validated configuration without inventing a successful state.

        Claude Agent SDK 0.2.152 exposes an async ``set_model`` call but no
        equivalent effort setter. An effort change therefore connects a new
        client, resuming the SDK conversation when one exists, and only replaces
        the running client once the connection has succeeded.
        """
        if config == self._config:
            return self._config
        if config.effort == self._config.effort:
            await self._require_client().set_model(config.model)
            self._config = config
            return self._config
        replacement = await self._connect_client(config, resume=self._conversation_id)

        previous_client = self._require_client()
        previous_pump = self._pump
        if previous_pump is not None:
            previous_pump.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await previous_pump
        try:
            await previous_client.disconnect()
            self._clients.discard(previous_client)
        except Exception:
            # Keep ownership so close() retries before the workspace is deleted.
            LOG.warning("The replaced Claude client did not disconnect cleanly", exc_info=True)

        self._client = replacement
        self._config = config
        self._pump = asyncio.create_task(self._pump_messages(replacement))
        return self._config

    async def interrupt(self) -> None:
        self._interrupted = True
        await self._deny_pending("The turn was interrupted")
        await self._require_client().interrupt()

    async def close(self) -> None:
        if self._pump is not None:
            self._pump.cancel()
            try:
                await self._pump
            except asyncio.CancelledError:
                pass
            except Exception:
                LOG.debug("The Claude message pump ended with an error", exc_info=True)
            self._pump = None
        await self._deny_pending("The session was closed")
        for client in tuple(self._clients):
            # Propagate failure: the session must retain its workspace if a
            # provider process may still be using it. A later close can retry.
            await client.disconnect()
            self._clients.discard(client)
        self._client = None
        if self._config_dir is not None:
            cleanup = asyncio.create_task(asyncio.to_thread(shutil.rmtree, self._config_dir))
            try:
                await asyncio.shield(cleanup)
            except asyncio.CancelledError:
                await cleanup
                self._config_dir = None
                raise
            self._config_dir = None
        self._transcript_store = _InMemoryTranscriptStore()

    async def _connect_client(self, config: AgentConfig, resume: str | None = None) -> ClaudeSDKClient:
        """Validate the checkout before every connection, including resume."""
        workspace = await asyncio.to_thread(self._validate_workspace)
        if workspace != self._workspace:
            raise RuntimeError("The session workspace changed during the conversation")
        client = ClaudeSDKClient(options=self._build_options(config, resume=resume))
        self._clients.add(client)
        try:
            # No prompt: this keeps the input stream open so `can_use_tool` can fire.
            await asyncio.wait_for(client.connect(), timeout=120)
        except BaseException:
            try:
                await client.disconnect()
                self._clients.discard(client)
            except Exception:
                LOG.warning("The failed Claude client did not disconnect cleanly", exc_info=True)
            raise
        return client

    def _require_client(self) -> ClaudeSDKClient:
        if self._client is None:
            raise ApiException.conflict("The agent runtime is not running")
        return self._client

    def _credential_env(self) -> dict[str, str]:
        """Both credential modes carry a Claude PAT, so there is no branch on `mode` here.
        Never log the returned dict."""
        return {"CLAUDE_CODE_OAUTH_TOKEN": self._credential.token}

    def _validate_workspace(self) -> Path:
        settings = get_settings()
        try:
            managed_root = (settings.workspace_root / "sessions").resolve(strict=True)
            workspace = self._workspace.resolve(strict=True)
        except FileNotFoundError as error:
            raise RuntimeError("The session workspace does not exist") from error

        if (
            self._workspace.is_symlink()
            or not workspace.is_dir()
            or workspace == managed_root
            or not workspace.is_relative_to(managed_root)
        ):
            raise RuntimeError("The session workspace is outside the managed workspace root")
        git_dir = workspace / ".git"
        if (
            not git_dir.is_dir()
            or git_dir.is_symlink()
            or not git_dir.resolve(strict=True).is_relative_to(workspace)
        ):
            raise RuntimeError("The session workspace does not have private Git metadata")

        git_binary = shutil.which(settings.git_binary)
        if not git_binary:
            raise RuntimeError("Git is required to validate the session workspace")
        environment = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": os.environ.get("HOME", ""),
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "LC_ALL": "C",
        }
        try:
            top_level = subprocess.run(
                [git_binary, "-C", str(workspace), "rev-parse", "--show-toplevel"],
                check=True,
                capture_output=True,
                text=True,
                timeout=settings.git_timeout_seconds,
                env=environment,
            ).stdout.strip()
            branch = subprocess.run(
                [git_binary, "-C", str(workspace), "symbolic-ref", "--quiet", "--short", "HEAD"],
                check=True,
                capture_output=True,
                text=True,
                timeout=settings.git_timeout_seconds,
                env=environment,
            ).stdout.strip()
        except (OSError, subprocess.SubprocessError) as error:
            raise RuntimeError("The session workspace Git state could not be validated") from error

        if Path(top_level).resolve() != workspace or branch != self._branch:
            raise RuntimeError("The session workspace is not on its requested branch")
        return workspace

    def _build_options(self, config: AgentConfig, resume: str | None = None) -> ClaudeAgentOptions:
        settings = get_settings()
        if self._config_dir is None:
            raise RuntimeError("The Claude runtime state directory was not prepared")
        # Only a root native plugin is explicitly loaded. Other plugins and
        # MCP servers follow the CLI's project/local settings and approvals.
        plugins = ([{"type": "local", "path": str(self._workspace)}]
                   if (self._workspace / ".claude-plugin" / "plugin.json").is_file() else [])
        return ClaudeAgentOptions(
            cwd=str(self._workspace),
            env={
                **self._credential_env(),
                "CLAUDE_CONFIG_DIR": str(self._config_dir),
                # Prevent inherited alternative auth from overriding this session's PAT.
                "ANTHROPIC_API_KEY": "",
                "ANTHROPIC_AUTH_TOKEN": "",
                "CLAUDE_CODE_USE_BEDROCK": "0",
                "CLAUDE_CODE_USE_VERTEX": "0",
                "CLAUDE_CODE_USE_FOUNDRY": "0",
            },
            # Keep interactive questions routed through the callback; ordinary tools are
            # approved immediately there, without creating pending session requests.
            permission_mode="default",
            can_use_tool=self._can_use_tool,
            include_partial_messages=True,
            # Native project discovery; cwd and these settings are not a host
            # filesystem boundary. Hooks and tools run as the service user.
            setting_sources=["project", "local"],
            skills="all",
            plugins=plugins,
            system_prompt={
                "type": "preset",
                "preset": "claude_code",
                "append": (
                    "Prefer the dedicated Read tool for reading files and Edit, MultiEdit, "
                    "Write or NotebookEdit for changing files when applicable, so the session "
                    "can display file operations and their results clearly. Use shell tools "
                    "for commands that require them."
                ),
            },
            disallowed_tools=settings.agent_claude_disallowed_tools,
            model=config.model,
            effort=config.effort,
            resume=resume,
            session_store=self._transcript_store,
            session_store_flush="eager",
            stderr=self._on_stderr,
        )

    def _on_stderr(self, line: str) -> None:
        LOG.debug("Claude CLI emitted diagnostic output (%s characters)", len(line))

    async def _deny_pending(self, message: str) -> None:
        for request_id, pending in list(self._pending.items()):
            if not pending.future.done():
                pending.future.set_result({"decision": "deny", "message": message})
                await self._emit(f"{pending.kind}.resolved", {
                    "requestId": request_id, "decision": "deny", "message": message,
                })
            self._pending.pop(request_id, None)

    async def _can_use_tool(
        self, tool_name: str, input_data: dict[str, Any], context: ToolPermissionContext
    ) -> PermissionResult:
        """Only user decisions pause the session; tool execution is automatic."""
        if tool_name != _QUESTION_TOOL:
            return PermissionResultAllow(updated_input=input_data)

        request_id = uuid4().hex
        questions = list(input_data.get("questions") or [])
        request = QuestionRequest(request_id, questions)
        event = question_request(request_id, questions)
        future: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        self._pending[request_id] = _PendingRequest(_KIND_QUESTION, future)
        try:
            await self._publish(event)
            await self._ask(request)
            payload = await future
        except asyncio.CancelledError:
            raise
        except Exception as error:
            LOG.error("The %s request %s could not be answered", tool_name, request_id, exc_info=error)
            return PermissionResultDeny(message=_DENIED_MESSAGE)
        finally:
            self._pending.pop(request_id, None)
        return self._decide(payload, input_data, True)

    def _decide(self, payload: dict[str, Any], input_data: dict[str, Any], is_question: bool) -> PermissionResult:
        """Turns the camelCase wire payload into the vendor's result type."""
        if payload.get("decision") == "deny":
            return PermissionResultDeny(message=payload.get("message") or _DENIED_MESSAGE)
        if is_question:
            updated: dict[str, Any] = {
                "questions": input_data.get("questions", []),
                "answers": {key: ", ".join(value) if isinstance(value, list) else value
                            for key, value in (payload.get("answers") or {}).items()},
            }
            response = payload.get("response")
            if response:
                updated["response"] = response
            return PermissionResultAllow(updated_input=updated)
        # Honouring `updatedInput` is the `editableToolInput` capability: the player may edit the
        # tool input before allowing it, and an adapter without that capability ignores the field.
        return PermissionResultAllow(updated_input=payload["updatedInput"] if payload.get("updatedInput") is not None else input_data)

    async def resolve(self, request_id: str, payload: dict[str, Any]) -> None:
        """Answers one parked request. Unknown or already answered ids are indistinguishable on
        purpose — both mean there is nothing left to answer."""
        pending = self._pending.get(request_id)
        if pending is None or pending.future.done():
            raise ApiException.not_found("Unknown or already answered request")
        pending.future.set_result(payload)
        if pending.kind == _KIND_QUESTION:
            await self._publish(question_resolved(request_id, payload.get("answers") or {}))
        else:
            await self._publish(permission_resolved(request_id, payload.get("decision") or "allow"))

    async def _publish(self, event: AgentEvent) -> None:
        await self._emit(event["type"], event["data"])

    async def _pump_messages(self, client: ClaudeSDKClient) -> None:
        """Translates the vendor message stream into domain events until the client stops."""
        try:
            async for message in client.receive_messages():
                await self._translate(message)
            raise RuntimeError("The agent stream ended unexpectedly")
        except asyncio.CancelledError:
            raise
        except Exception as error:
            # A configuration replacement first connects its successor, then
            # cancels this old pump. Never let an obsolete client fail a ready
            # session after the successor has taken over.
            if client is self._client:
                LOG.error("The Claude message stream failed", exc_info=error)
                await self._deny_pending("The agent stream failed")
                await self._publish(agent_error("The agent stream failed"))
                await self._publish(session_status(STATUS_FAILED, "The agent stream failed"))

    async def _translate(self, message: Any) -> None:
        session_id = getattr(message, "session_id", None)
        if isinstance(session_id, str):
            try:
                self._conversation_id = str(UUID(session_id))
            except ValueError:
                pass
        if self._awaiting_first_event_at is not None:
            LOG.info(
                "Claude first event received in %.0f ms",
                (time.perf_counter() - self._awaiting_first_event_at) * 1000,
            )
            self._awaiting_first_event_at = None
        if isinstance(message, StreamEvent):
            await self._on_stream_event(message)
        elif isinstance(message, AssistantMessage):
            await self._on_assistant_message(message)
        elif isinstance(message, UserMessage):
            await self._on_user_message(message)
        elif isinstance(message, ResultMessage):
            await self._on_result_message(message)
        elif isinstance(message, SystemMessage):
            # Whitelist useful user-facing metadata; never publish the raw initialization payload.
            data = {key: message.data[key] for key in
                    ("description", "summary", "status", "task_id", "tool_use_id") if key in message.data}
            await self._emit("agent.activity", {"kind": message.subtype, **data})
        elif isinstance(message, ConversationResetMessage):
            self._conversation_id = None
            self._stream_ids.clear()
            self._stream_message_id = None
            await self._emit("agent.activity", {
                "kind": "conversation_reset", "description": "The provider cleared its conversation context.",
            })

    async def _on_stream_event(self, message: Any) -> None:
        """Partial-message deltas. The SDK carries the raw Anthropic event in `event`; older
        releases exposed it as `event_type` + `data`, so both shapes are read."""
        raw = getattr(message, "event", None)
        if not isinstance(raw, dict):
            raw = getattr(message, "data", None) or {}
        event_type = raw.get("type") or getattr(message, "event_type", None)
        parent = getattr(message, "parent_tool_use_id", None) or "root"
        self._stream_message_id = self._stream_ids.get(parent)
        if event_type == "message_start":
            self._stream_message_id = ((raw.get("message") or {}).get("id")) or uuid4().hex
            self._stream_ids[parent] = self._stream_message_id
            return
        if event_type == "message_stop":
            return
        if event_type != "content_block_delta":
            return
        delta = raw.get("delta") or {}
        stream_id = self._current_stream_message_id()
        self._stream_ids[parent] = stream_id
        message_id = f"{stream_id}:{raw.get('index', 0)}"
        if delta.get("text"):
            await self._publish(assistant_delta(message_id, delta["text"]))
        elif delta.get("thinking"):
            await self._publish(thinking_delta(message_id, delta["thinking"]))

    def _current_stream_message_id(self) -> str:
        if self._stream_message_id is None:
            self._stream_message_id = uuid4().hex
        return self._stream_message_id

    async def _on_assistant_message(self, message: Any) -> None:
        parent = getattr(message, "parent_tool_use_id", None) or "root"
        message_id = getattr(message, "message_id", None) or self._stream_ids.get(parent) or uuid4().hex
        for index, block in enumerate(message.content):
            block_id = f"{message_id}:{index}"
            if isinstance(block, TextBlock):
                # Claude emits this sentinel when filtering a contentless assistant message.
                # Publish an empty authoritative block so clients also clear provisional deltas.
                text = "" if block.text.strip() in {"[No message content]", "<no message>"} else block.text
                await self._publish(assistant_message(block_id, text))
            elif isinstance(block, ThinkingBlock):
                await self._publish(thinking_message(block_id, block.thinking))
            elif isinstance(block, ToolUseBlock):
                await self._publish(tool_use(block.id, block.name, _tool_title(block.name, block.input), block.input))
        self._stream_ids.pop(parent, None)
        self._stream_message_id = None
        if message.error:
            await self._publish(agent_error(f"Provider error: {message.error}"))

    async def _on_user_message(self, message: Any) -> None:
        content = message.content
        if not isinstance(content, list):
            return
        for block in content:
            if isinstance(block, ToolResultBlock):
                await self._publish(
                    tool_result(block.tool_use_id, bool(block.is_error), _result_summary(block.content))
                )

    async def _on_result_message(self, message: Any) -> None:
        """Only `terminalReason` is required by the contract; every other field is best effort, so
        it is read defensively — the vendor adds and removes them across releases."""
        await self._deny_pending("The turn ended")
        self._stream_ids.clear()
        self._stream_message_id = None
        if message.is_error and getattr(message, "errors", None):
            await self._publish(agent_error(_result_summary("\n".join(message.errors))))
        await self._publish(
            turn_result(
                terminal_reason="interrupted" if self._interrupted else "error" if message.is_error else "completed",
                subtype=getattr(message, "subtype", None),
                duration_ms=getattr(message, "duration_ms", None),
                cost_usd=getattr(message, "total_cost_usd", None),
                usage=getattr(message, "usage", None),
            )
        )


@dataclass(frozen=True)
class StructuredProgress:
    """Public-safe operation progress, never a conversational event or raw SDK output."""

    phase: str
    message: str

    def __post_init__(self) -> None:
        if not self.phase.strip() or len(self.phase) > 80 or not self.message.strip() or len(self.message) > 500:
            raise ValueError('Invalid structured operation progress')


@dataclass(frozen=True)
class StructuredActivity:
    """One bounded step of the operation, for the session owner to watch it live.

    The adapter bounds every field here; how many of these an operation may publish, and their
    redaction policy, belong to the domain emitter that receives them.
    """

    kind: Literal['assistant', 'thinking', 'tool', 'tool_result', 'log', 'notice']
    title: str
    detail: str | None = None
    status: Literal['running', 'done', 'failed'] | None = None
    tool_id: str | None = None
    source: Literal['agent', 'tool'] = 'agent'
    level: Literal['debug', 'info', 'warning', 'error', 'success'] = 'info'
    mutates_workspace: bool = False

    def __post_init__(self) -> None:
        if self.kind not in ('assistant', 'thinking', 'tool', 'tool_result', 'log', 'notice'):
            raise ValueError('Invalid structured operation activity kind')
        if not self.title.strip() or len(self.title) > 120:
            raise ValueError('Invalid structured operation activity title')
        if self.detail is not None and len(self.detail) > 4000:
            raise ValueError('Structured operation activity detail exceeds its limit')
        if self.status is not None and self.status not in ('running', 'done', 'failed'):
            raise ValueError('Invalid structured operation activity status')
        if self.tool_id is not None and (not self.tool_id.strip() or len(self.tool_id) > 64):
            raise ValueError('Invalid structured operation activity tool identity')
        if self.source not in ('agent', 'tool'):
            raise ValueError('Invalid structured operation activity source')
        if self.level not in ('debug', 'info', 'warning', 'error', 'success'):
            raise ValueError('Invalid structured operation activity level')


StructuredProgressCallback = Callable[[StructuredProgress], Awaitable[None]]
StructuredActivityCallback = Callable[[StructuredActivity], Awaitable[None]]
StructuredToolCallback = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class StructuredTool:
    """Host-managed capability. Adapter bridges it through the provider's official SDK.

    The host validates input and owns resource mutations; no arbitrary command API.
    """

    name: str
    description: str
    input_schema: dict[str, Any] = field(repr=False)
    execute: StructuredToolCallback = field(repr=False)


@dataclass(frozen=True)
class StructuredOperation:
    """Fresh one-shot context; no chat runtime, history, resume, model or effort selection.

    Schema and tool definitions are owned by the caller and must not be mutated during
    execution. The caller validates the returned object against its strict domain model.
    """

    credential: Credential = field(repr=False)
    cwd: Path = field(repr=False)
    prompt: str = field(repr=False)
    output_schema: dict[str, Any] = field(repr=False)
    progress: StructuredProgressCallback = field(repr=False)
    activity: StructuredActivityCallback = field(repr=False)
    tools: tuple[StructuredTool, ...] = field(default=(), repr=False)

    def __post_init__(self) -> None:
        if not self.cwd.is_absolute() or not self.prompt.strip():
            raise ValueError('Structured operation requires an absolute workspace and prompt')
        if not callable(self.progress) or not callable(self.activity):
            raise TypeError('Structured operation requires progress and activity callbacks')
        if self.output_schema.get('type') != 'object':
            raise ValueError('Structured operation requires an object JSON schema')
        if len({tool.name for tool in self.tools}) != len(self.tools):
            raise ValueError('Structured operation tool names must be unique')


class StructuredOperationError(Exception):
    """Typed, public-safe failure; adapters must not expose SDK output or credentials."""

    def __init__(self, code: Literal['provider_unavailable', 'model_unavailable',
                                   'invalid_agent_output', 'timeout', 'cancelled'], message: str) -> None:
        super().__init__(message)
        self.code = code


class StructuredExecutor(Protocol):
    """Own and release a fresh client/temporary state on success, error and cancellation.

    Return only the SDK structured object, never JSON extracted from assistant text.
    Propagate asyncio.CancelledError after releasing resources. Do not emit chat events.
    """

    async def __call__(self, operation: StructuredOperation) -> dict[str, Any]: ...


# This policy is intentionally independent of conversational configuration and environment.
_STRUCTURED_MODEL = "claude-opus-5-5"
# Deployment preparation is mechanical configuration work, not open-ended reasoning.
_STRUCTURED_EFFORT = "medium"
_STRUCTURED_FILE_TOOLS = ("Read", "Glob", "Grep", "Edit", "MultiEdit", "Write")
_STRUCTURED_ACTIVITY_LIMIT = 4000


def _structured_detail(value: Any) -> str | None:
    """Bound any block payload to the activity contract; the domain emitter redacts further."""
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    text = text.strip()
    return text[:_STRUCTURED_ACTIVITY_LIMIT] if text else None


def _structured_tool_detail(name: str, input_data: Any) -> str | None:
    """Only the identifying argument of a tool call, never its whole input."""
    value = None
    if isinstance(input_data, dict):
        value = next((input_data[key] for key in ("file_path", "path", "pattern", "command")
                      if isinstance(input_data.get(key), str) and input_data[key].strip()), None)
    return _structured_detail(value if value is not None else name)


def _managed_tool_payload(content: Any, depth: int = 0) -> dict[str, Any] | None:
    """Extract only the public result of a managed tool from SDK content wrappers."""
    if depth > 8:
        return None
    if isinstance(content, str):
        try:
            return _managed_tool_payload(json.loads(content), depth + 1)
        except (TypeError, ValueError):
            return None
    if isinstance(content, list):
        return next((payload for block in content
                     if (payload := _managed_tool_payload(block, depth + 1)) is not None), None)
    if isinstance(content, dict):
        if isinstance(content.get("success"), bool):
            return content
        return _managed_tool_payload(content.get("content") or content.get("text"), depth + 1)
    return _managed_tool_payload(getattr(content, "content", None) or getattr(content, "text", None), depth + 1)


def _structured_result_summary(name: str, content: Any, is_error: bool) -> str:
    """Describe a tool outcome without echoing file contents or tool inputs."""
    if name.startswith("mcp__deployment__"):
        payload = _managed_tool_payload(content)
        if payload and payload.get("success") is False:
            reason = payload.get("reason")
            if isinstance(reason, dict) and isinstance(reason.get("code"), str) and isinstance(reason.get("message"), str):
                return f"{reason['code']}: {reason['message']}"[:500]
        return "failed" if is_error else "done"
    if is_error:
        return "failed"
    if name in ("Read", "Glob", "Grep"):
        if isinstance(content, str):
            count = len(content.splitlines())
            noun = "line" if count == 1 else "lines"
            return f"{count} {noun} found" if name != "Read" else f"{count} {noun} read"
        if isinstance(content, list):
            return f"{len(content)} results"
    return "done"


def _structured_mcp_tools(operation: StructuredOperation) -> list[Any]:
    def bridge(capability: StructuredTool) -> Any:
        async def invoke(arguments: dict[str, Any]) -> dict[str, Any]:
            # Domain callbacks validate arguments and return only public-safe evidence.
            try:
                result = await capability.execute(arguments)
            except asyncio.CancelledError:
                raise
            except Exception:
                LOG.debug("Background operation encountered an exception", exc_info=True)
                return {"content": [{"type": "text", "text": "Managed deployment tool failed"}], "isError": True}
            return {"content": [{"type": "text", "text": json.dumps(result)}],
                    "isError": result.get("success") is False}
        return tool(capability.name, capability.description, capability.input_schema)(invoke)
    return [bridge(capability) for capability in operation.tools]


def _structured_result(message: ResultMessage) -> dict[str, Any]:
    details = " ".join(message.errors or []).lower()
    inaccessible_model = "model" in details and any(
        marker in details for marker in ("not found", "does not exist", "not available", "access", "not supported"))
    if message.api_error_status == 404 or inaccessible_model:
        raise StructuredOperationError("model_unavailable", "The deployment model is unavailable")
    if message.api_error_status is not None:
        raise StructuredOperationError("provider_unavailable", "The deployment provider rejected the request")
    if message.is_error or message.subtype != "success":
        code = ("invalid_agent_output" if message.subtype == "error_max_structured_output_retries"
                else "provider_unavailable")
        raise StructuredOperationError(code, "The deployment agent could not complete its structured response")
    if not isinstance(message.structured_output, dict):
        raise StructuredOperationError("invalid_agent_output", "The deployment agent returned no structured object")
    return message.structured_output


async def _execute_claude_structured(operation: StructuredOperation) -> dict[str, Any]:
    """Fresh SDK client and private transcript; never touches a chat runtime or its config.

    File tools plus explicit host capabilities are the entire tool surface. In particular,
    shell, interactive questions, background tasks and repository MCP/plugins are absent.
    This limits accidental side effects; it is not a sandbox for hostile repositories.
    """
    names = [f"mcp__deployment__{capability.name}" for capability in operation.tools]

    async def permit(name: str, arguments: dict[str, Any], context: ToolPermissionContext) -> PermissionResult:
        if name in names or name == "StructuredOutput":
            return PermissionResultAllow(updated_input=arguments)
        if name in _STRUCTURED_FILE_TOOLS:
            candidate = arguments.get("file_path", arguments.get("path", "."))
            if isinstance(candidate, str):
                path = (operation.cwd / candidate).resolve()
                root = operation.cwd.resolve()
                if path.is_relative_to(root):
                    relative = path.relative_to(root)
                    if name in ("Edit", "MultiEdit", "Write") and (
                        ".git" in relative.parts or path.name in ("AGENTS.md", "CLAUDE.md")
                        or path.name == ".env" or path.name.startswith(".env.")
                    ):
                        return PermissionResultDeny(message="Do not modify repository instructions or credentials")
                    if name in ("Edit", "MultiEdit", "Write") and (
                        "src" in relative.parts
                        or path.name in ("pom.xml", "build.gradle", "build.gradle.kts", "package.json",
                                         "pyproject.toml", "go.mod", "Cargo.toml", "application.yaml",
                                         "application.yml")
                    ):
                        return PermissionResultDeny(message="Deployment cannot modify application source or manifests")
                    return PermissionResultAllow(updated_input=arguments)
        return PermissionResultDeny(message="This deployment operation cannot ask questions or use this tool. "
                                    "Return an actionable failure if configuration or permissions are missing.")

    with tempfile.TemporaryDirectory(prefix="mooi-deployment-claude-") as directory:
        options = ClaudeAgentOptions(
            cwd=str(operation.cwd), model=_STRUCTURED_MODEL, effort=_STRUCTURED_EFFORT, fallback_model=None,
            resume=None, continue_conversation=False, session_store=_InMemoryTranscriptStore(),
            session_store_flush="eager", setting_sources=[], skills=[], plugins=[],
            settings=json.dumps({"disableAllHooks": True}), strict_mcp_config=True,
            tools=list(_STRUCTURED_FILE_TOOLS), permission_mode="default", can_use_tool=permit,
            mcp_servers={"deployment": create_sdk_mcp_server(
                name="deployment", version="1.0.0", tools=_structured_mcp_tools(operation))},
            output_format={"type": "json_schema", "schema": operation.output_schema},
            env={"CLAUDE_CONFIG_DIR": directory, "CLAUDE_CODE_OAUTH_TOKEN": operation.credential.token,
                 "ANTHROPIC_API_KEY": "", "ANTHROPIC_AUTH_TOKEN": "", "ANTHROPIC_BASE_URL": "",
                 "CLAUDE_CODE_USE_BEDROCK": "0", "CLAUDE_CODE_USE_VERTEX": "0",
                 "CLAUDE_CODE_USE_FOUNDRY": "0"},
            system_prompt={"type": "preset", "preset": "claude_code", "append":
                           "Execute only the requested deployment preparation. Read repository instructions. "
                           "Never ask the user questions; report missing configuration as a structured failure. "
                           "Use only managed deployment tools to operate Docker. Never commit or push."},
            stderr=lambda line: None,
        )
        client = ClaudeSDKClient(options=options)

        async def publish(activity: StructuredActivity) -> None:
            # Watching the operation must never be able to fail it.
            try:
                await operation.activity(activity)
            except asyncio.CancelledError:
                raise
            except Exception:
                LOG.debug("Background operation encountered an exception", exc_info=True)

        async def publish_blocks(message: Any) -> None:
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        detail = _structured_detail(block.text)
                        if detail:
                            await publish(StructuredActivity("assistant", "Agent", detail))
                    elif isinstance(block, ThinkingBlock):
                        detail = _structured_detail(block.thinking)
                        if detail:
                            await publish(StructuredActivity("thinking", "Thinking", detail))
                    elif isinstance(block, ToolUseBlock):
                        mutates = block.name in ("Edit", "MultiEdit", "Write")
                        await publish(StructuredActivity(
                            "tool", block.name[:120] or "Tool", _structured_tool_detail(block.name, block.input),
                            status="running", tool_id=str(block.id)[:64] or None, source="tool",
                            mutates_workspace=mutates))
                        tool_context[str(block.id)] = (block.name, mutates)
                return
            content = getattr(message, "content", None)
            if isinstance(message, UserMessage) and isinstance(content, list):
                for block in content:
                    if isinstance(block, ToolResultBlock):
                        name, mutates = tool_context.get(str(block.tool_use_id), ("Tool", False))
                        payload = _managed_tool_payload(block.content) if name.startswith("mcp__deployment__") else None
                        failed = bool(block.is_error or (payload and payload.get("success") is False))
                        await publish(StructuredActivity(
                            "tool_result", name[:120],
                            _structured_result_summary(name, block.content, failed),
                            status="failed" if failed else "done",
                            tool_id=str(block.tool_use_id)[:64] or None, source="tool",
                            level="error" if failed else "success", mutates_workspace=mutates))

        tool_context: dict[str, tuple[str, bool]] = {}
        try:
            await operation.progress(StructuredProgress("preparing", "Preparing deployment configuration"))
            await client.connect()
            await client.query(operation.prompt)
            async for message in client.receive_response():
                if isinstance(message, (AssistantMessage, UserMessage)) and not getattr(message, "error", None):
                    await publish_blocks(message)
                if isinstance(message, AssistantMessage) and message.error:
                    # The SDK exposes typed errors, never publish assistant text or diagnostics.
                    raw_details = " ".join(block.text for block in message.content if isinstance(block, TextBlock))
                    details = raw_details.lower()
                    LOG.warning(
                        "Deployment provider rejected model %s (%s): %s",
                        _STRUCTURED_MODEL, message.error,
                        redact_deployment_output(raw_details[:1000], (operation.credential.token,)),
                    )
                    unavailable = message.error == "invalid_request" and "model" in details and any(
                        marker in details for marker in ("not found", "does not exist", "not available", "access", "not supported"))
                    code = "model_unavailable" if unavailable else "provider_unavailable"
                    raise StructuredOperationError(code, "The deployment provider could not use the requested model")
                if isinstance(message, ResultMessage):
                    return _structured_result(message)
            raise StructuredOperationError("invalid_agent_output", "The deployment agent ended without a result")
        except (asyncio.CancelledError, StructuredOperationError):
            raise
        except TimeoutError:
            raise StructuredOperationError("timeout", "The deployment agent timed out") from None
        except Exception:
            LOG.debug("Background operation encountered an exception", exc_info=True)
            raise StructuredOperationError("provider_unavailable", "The deployment provider is unavailable") from None
        finally:
            # Disconnect in the same task that connected: the SDK owns task-local cancel scopes.
            # Repeated external cancellation must not skip client teardown or private-dir removal.
            cancelled = False
            failure_pending = sys.exception() is not None
            while True:
                try:
                    await client.disconnect()
                    break
                except asyncio.CancelledError:
                    cancelled = True
                except Exception:
                    LOG.debug("Background operation encountered an exception", exc_info=True)
                    if not failure_pending and not cancelled:
                        raise StructuredOperationError("provider_unavailable",
                                                       "The deployment client could not close cleanly") from None
                    break
            if cancelled:
                raise asyncio.CancelledError


@dataclass(frozen=True)
class ProviderDescriptor:
    id: str
    label: str
    capabilities: AgentCapabilities
    runtime_class: type[AgentRuntime]
    structured_executor: StructuredExecutor | None = None

    def configuration(self) -> dict[str, Any]:
        return self.runtime_class.configuration()

    def configure(self, model: str | None, effort: str | None) -> AgentConfig:
        return self.runtime_class.configure(model, effort)


PROVIDERS: dict[str, ProviderDescriptor] = {
    "claude": ProviderDescriptor("claude", "Claude", CLAUDE_CAPABILITIES, ClaudeAgentRuntime,
                                 structured_executor=_execute_claude_structured),
}


def describe(provider: str) -> ProviderDescriptor:
    descriptor = PROVIDERS.get(provider)
    if descriptor is None:
        raise ApiException.bad_request("Unknown agent provider")
    return descriptor


def create_runtime(
    provider: str,
    credential: Credential,
    workspace: Path,
    branch: str,
    emit: Emit,
    ask: Ask,
    config: AgentConfig,
) -> AgentRuntime:
    return describe(provider).runtime_class(credential, workspace, branch, emit, ask, config)


async def execute_structured(provider: str, operation: StructuredOperation) -> dict[str, Any]:
    """Dispatch only to an explicitly registered one-shot adapter; never fall back to chat."""
    descriptor = PROVIDERS.get(provider)
    if descriptor is None or descriptor.structured_executor is None:
        raise StructuredOperationError('provider_unavailable', 'Provider does not support structured operations')
    result = await descriptor.structured_executor(operation)
    if not isinstance(result, dict):
        raise StructuredOperationError('invalid_agent_output', 'Provider returned an invalid structured result')
    return result
