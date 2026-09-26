"""Official Codex SDK transport and account isolation; no application/session contracts."""
from __future__ import annotations

import asyncio
import json
import os
import tempfile
import time
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path
from typing import Any

from codex_cli_bin import bundled_codex_path, bundled_path_dir
from openai_codex import CodexConfig
from openai_codex.client import CodexClient
from openai_codex.models import UnknownNotification

from mic_sessions.shared.mooi import Credential


def decline(method: str) -> dict[str, Any]:
    if method == "item/permissions/requestApproval":
        return {"permissions": {}, "scope": "turn"}
    if method == "mcpServer/elicitation/request":
        return {"action": "decline", "content": None}
    if method in ("item/tool/requestUserInput", "tool/requestUserInput"):
        return {"answers": {}}
    if method == "item/tool/call":
        return {"success": False, "contentItems": []}
    return {"decision": "decline"}


class Client:
    """Offload the SDK's synchronous public client, including its approval callback."""

    def __init__(self, home: Path, cwd: Path, handler=None, *, structured: bool = False):
        self.home = home
        self._loop = asyncio.get_running_loop()
        self._requests = set()
        self._handlers = set()
        self._closed = False
        self._close_lock = asyncio.Lock()

        async def dispatch(method, params):
            if self._closed:
                return decline(method)
            task = asyncio.current_task()
            self._handlers.add(task)
            try:
                return await handler(method, params)
            finally:
                self._handlers.discard(task)

        def handle(method, params):
            if self._closed or handler is None:
                return decline(method)
            pending = asyncio.run_coroutine_threadsafe(dispatch(method, params or {}), self._loop)
            self._requests.add(pending)
            try:
                if self._closed:
                    pending.cancel()
                return pending.result()
            finally:
                self._requests.discard(pending)

        environment = {key: os.environ[key] for key in ("PATH", "TMPDIR", "LANG", "LC_ALL") if key in os.environ}
        environment.update(HOME=str(home), CODEX_HOME=str(home))
        overrides = ['cli_auth_credentials_store="file"', 'model_provider="openai"',
                     'shell_environment_policy.inherit="none"',
                     'shell_environment_policy.set.PATH=' + json.dumps(os.environ.get("PATH", ""))]
        if structured:
            overrides += ['features.shell_tool=false', 'features.unified_exec=false',
                          'features.apply_patch_freeform=false', 'web_search="disabled"']
        # The SDK merges env with the host environment. Launch through env -i so host
        # API keys, endpoints, proxy credentials and Mooi secrets cannot reach Codex.
        path_dir = bundled_path_dir()
        if path_dir:
            environment["PATH"] = str(path_dir) + os.pathsep + environment.get("PATH", "")
        command = ["/usr/bin/env", "-i", *(f"{key}={value}" for key, value in environment.items()),
                   str(bundled_codex_path())]
        for override in overrides:
            command.extend(["--config", override])
        command.extend(["app-server", "--listen", "stdio://"])
        self.sdk = CodexClient(CodexConfig(cwd=str(cwd), launch_args_override=tuple(command),
                              client_name="mooi"),
                              approval_handler=handle)

    async def call(self, method: str, *args, **kwargs):
        return await asyncio.to_thread(getattr(self.sdk, method), *args, **kwargs)

    async def start(self):
        # Process creation must finish before cancellation can close it.
        spawning = asyncio.create_task(self.call("start"))
        try:
            await asyncio.shield(spawning)
            async with asyncio.timeout(30):
                await self.call("initialize")
        except BaseException:
            await asyncio.gather(spawning, return_exceptions=True)
            await self.close()
            raise

    async def close(self):
        async with self._close_lock:
            if self._closed:
                return
            self._closed = True
            for pending in list(self._requests):
                pending.cancel()
            await self.call("close")
            await asyncio.gather(*list(self._handlers), return_exceptions=True)

    async def notifications(self, turn_id: str):
        self.sdk.register_turn_notifications(turn_id)
        try:
            while True:
                note = await self.call("next_turn_notification", turn_id)
                payload = (note.payload.params if isinstance(note.payload, UnknownNotification)
                           else note.payload.model_dump(by_alias=True, mode="json"))
                yield note.method, payload
                if note.method == "turn/completed":
                    break
        finally:
            self.sdk.unregister_turn_notifications(turn_id)


class Account:
    """One private SDK home and refresh lock per stored connection, shared by its conversations.

    A turn owns the lock until refreshed auth is sealed upstream. This prevents simultaneous
    refresh-token rotations across sessions. No host Codex account/config is inherited.
    """

    def __init__(self, credential: Credential):
        self.directory = tempfile.TemporaryDirectory(prefix="mooi-codex-")
        self.home = Path(self.directory.name)
        self.lock = asyncio.Lock()
        self.credential = credential
        self.persisted_token = credential.token
        self.users = 0
        self.quota_checked_at = 0.0
        self.quota_snapshot = None
        path = self.home / "auth.json"
        path.write_text(credential.token)
        path.chmod(0o600)

    async def persist(self):
        token = (self.home / "auth.json").read_text()
        if token != self.persisted_token and self.credential.save is not None:
            await self.credential.save(token)
            self.persisted_token = token
            self.credential = replace(self.credential, token=token)


_accounts: dict[str, Account] = {}
_catalogs: dict[str, tuple[float, dict[str, Any]]] = {}


def _context_windows(home: Path) -> dict[str, int]:
    """Read the model catalog cached by the official Codex CLI during model/list."""
    try:
        catalog = json.loads((home / "models_cache.json").read_text())
        return {
            model["slug"]: int(model["context_window"] * model.get("effective_context_window_percent", 100) / 100)
            for model in catalog.get("models", [])
            if isinstance(model.get("slug"), str)
            and isinstance(model.get("context_window"), (int, float))
            and isinstance(model.get("effective_context_window_percent", 100), (int, float))
        }
    except (OSError, ValueError, TypeError, KeyError):
        return {}


def context_window(connection_id: str, model: str) -> int | None:
    cached = _catalogs.get(connection_id)
    if not cached or cached[0] <= time.monotonic():
        return None
    return next((entry.get("contextWindow") for entry in cached[1]["models"]
                 if entry["id"] == model), None)


def acquire(credential: Credential) -> Account:
    if not credential.connection_id or credential.mode != "device_oauth":
        raise ValueError("Link a Codex account before starting a session")
    account = _accounts.get(credential.connection_id)
    if account is None:
        if len(_accounts) >= 1024:
            raise ValueError("Too many active Codex accounts")
        account = Account(credential)
        _accounts[credential.connection_id] = account
    # Use the current caller for persistence, never a cached expired Mooi access token.
    account.credential = credential
    account.users += 1
    return account


def release(account: Account):
    account.users -= 1
    if account.users == 0:
        # Preserve a rotated credential after a transient storage failure so the next
        # authenticated request can retry saving it instead of restoring a stale token.
        if (account.home / "auth.json").read_text() != account.persisted_token:
            return
        _accounts.pop(account.credential.connection_id, None)
        account.directory.cleanup()


@asynccontextmanager
async def connected(account: Account, cwd: Path, handler=None, *, structured=False):
    async with account.lock:
        client = Client(account.home, cwd, handler, structured=structured)
        try:
            await client.start()
            # Refresh before a potentially long turn, while the caller's Mooi token is fresh.
            await client.call("account_read", {"refreshToken": True})
            await account.persist()
            yield client
        finally:
            async def cleanup():
                try:
                    await client.close()
                finally:
                    await account.persist()
            closing = asyncio.create_task(cleanup())
            try:
                await asyncio.shield(closing)
            except asyncio.CancelledError:
                await closing
                raise


async def models(credential: Credential) -> dict[str, Any]:
    cached = _catalogs.get(credential.connection_id)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    account = acquire(credential)
    try:
        async with asyncio.timeout(30), connected(account, account.home) as client:
            catalog = await client.call("model_list", True)
            entries = list(catalog.data)
            while catalog.next_cursor:
                catalog = await client.call("request", "model/list", {
                    "includeHidden": True, "cursor": catalog.next_cursor,
                }, response_model=type(catalog))
                entries.extend(catalog.data)
            entries = [model for model in entries if model.model.lower() != "default"]
            windows = _context_windows(account.home)
            default = next((model for model in entries if model.is_default), entries[0] if entries else None)
            result = {"id": "codex", "label": "Codex", "models": [
                {"id": model.model, "label": model.display_name,
                 "contextWindow": windows.get(model.model),
                 "defaultEffort": model.default_reasoning_effort.value,
                 "efforts": [option.reasoning_effort.value for option in model.supported_reasoning_efforts]}
                for model in entries], "defaultModel": default.model if default else "",
                "defaultEffort": default.default_reasoning_effort.value if default else None}
            # Bound memory and retain only public model metadata, never credentials.
            for key, (expires, _) in list(_catalogs.items()):
                if expires < time.monotonic():
                    _catalogs.pop(key, None)
            if len(_catalogs) >= 1024:
                _catalogs.pop(next(iter(_catalogs)))
            _catalogs[credential.connection_id] = (time.monotonic() + 300, result)
            return result
    finally:
        release(account)


async def quota(account: Account, client: Client) -> dict[str, Any] | None:
    """Called under the account lock after a turn, never by a polling timer."""
    from openai_codex.generated.v2_all import GetAccountRateLimitsResponse, RateLimitSnapshot

    if time.monotonic() - account.quota_checked_at < 60:
        return account.quota_snapshot
    account.quota_checked_at = time.monotonic()
    async with asyncio.timeout(5):
        response = await client.call("request", "account/rateLimits/read", {},
                                     response_model=GetAccountRateLimitsResponse)
    buckets = response.rate_limits_by_limit_id or {}
    limits = RateLimitSnapshot.model_validate(buckets["codex"]) if "codex" in buckets else response.rate_limits
    windows = [(name, value) for name, value in
               (("primary", limits.primary), ("secondary", limits.secondary)) if value is not None]
    if not windows:
        account.quota_snapshot = None
        return None
    account.quota_snapshot = {
        name: {"percent": window.used_percent,
               "window": f"{window.window_duration_mins} min" if window.window_duration_mins else name,
               "resetsAt": window.resets_at, "updatedAt": time.time()}
        for name, window in windows
    }
    return account.quota_snapshot
