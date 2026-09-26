"""Device OAuth linking: owner-bound, expiring attempts; secrets never reach the browser."""
from __future__ import annotations

import asyncio
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Query

from mic_sessions.shared.auth import Caller, current_caller
from mic_sessions.shared.codex import Client
from mic_sessions.shared.mooi import link_codex
from mic_sessions.shared.web import ApiException

router = APIRouter()


@dataclass
class Attempt:
    owner: str
    name: str = ""
    task: asyncio.Task | None = None
    state: str = "pending"
    client: Client | None = None
    login_id: str | None = None
    ready: asyncio.Future | None = None
    finished: asyncio.Event = field(default_factory=asyncio.Event)


_attempts: dict[str, Attempt] = {}


async def _login(attempt: Attempt):
    with tempfile.TemporaryDirectory(prefix="mooi-codex-login-") as directory:
        client = Client(Path(directory), Path(directory))
        attempt.client = client
        try:
            async with asyncio.timeout(600):
                await client.start()
                login = (await client.call("account_login_start", {"type": "chatgptDeviceCode"})).root
                attempt.login_id = login.login_id
                attempt.ready.set_result({"verificationUrl": login.verification_url, "userCode": login.user_code})
                completed = await client.call("wait_for_login_completed", login.login_id)
                attempt.state = "authorized" if completed.success else "failed"
                # Completion is committed by an authenticated poll with a fresh Mooi token.
                if completed.success:
                    await attempt.finished.wait()
        except asyncio.CancelledError:
            attempt.state = "cancelled"
            raise
        except TimeoutError:
            attempt.state = "expired"
            if not attempt.ready.done():
                attempt.ready.set_exception(ApiException(502, "Codex login timed out. Try again."))
        except Exception:
            attempt.state = "failed"
            if not attempt.ready.done():
                attempt.ready.set_exception(ApiException(502, "Could not start Codex login. Try again."))
        finally:
            await client.close()
            attempt.client = None
            if attempt.state == "pending":
                attempt.state = "expired"


@router.post("/agents/codex/authorization")
async def start(caller: Annotated[Caller, Depends(current_caller)],
                name: Annotated[str, Query(min_length=1, max_length=100)]):
    name = name.strip()
    if not name:
        raise ApiException.bad_request("An account title is required")
    owner = str(caller.player_id)
    replaced = []
    for key, existing in list(_attempts.items()):
        if existing.owner == owner or existing.state in ("failed", "cancelled", "connected", "expired"):
            if existing.task and not existing.task.done():
                existing.task.cancel()
                replaced.append(existing.task)
            _attempts.pop(key, None)
    if len(_attempts) >= 32:
        raise ApiException(429, "Too many login attempts. Try again later.")
    key = uuid4().hex
    attempt = Attempt(owner, name=name, ready=asyncio.get_running_loop().create_future())
    _attempts[key] = attempt
    attempt.task = asyncio.create_task(_login(attempt))
    try:
        await asyncio.gather(*replaced, return_exceptions=True)
        async with asyncio.timeout(45):
            details = await asyncio.shield(attempt.ready)
        return {"id": key, **details}
    except BaseException as error:
        attempt.task.cancel()
        await asyncio.gather(attempt.task, return_exceptions=True)
        _attempts.pop(key, None)
        if isinstance(error, asyncio.CancelledError):
            raise
        raise ApiException(502, "Could not start Codex login. Try again.") from None


def _owned(key: str, caller: Caller) -> Attempt:
    attempt = _attempts.get(key)
    if attempt is None or attempt.owner != str(caller.player_id):
        raise ApiException.not_found("Login attempt not found")
    return attempt


@router.get("/agents/codex/authorization/{key}")
async def status(key: str, caller: Annotated[Caller, Depends(current_caller)]):
    attempt = _owned(key, caller)
    if attempt.state == "authorized" and attempt.client:
        # Claim before awaiting so overlapping polls cannot commit twice.
        attempt.state = "saving"
        try:
            account = await attempt.client.call("account_read", {"refreshToken": True})
            label = getattr(account.account.root, "email", None) if account.account else None
            home = attempt.client.home
            await link_codex(caller, (home / "auth.json").read_text(), label, attempt.name)
            attempt.state = "connected"
        except Exception:
            attempt.state = "failed"
        finally:
            attempt.finished.set()
            if attempt.task:
                await asyncio.gather(attempt.task, return_exceptions=True)
    return {"status": attempt.state}


@router.delete("/agents/codex/authorization/{key}", status_code=204)
async def cancel(key: str, caller: Annotated[Caller, Depends(current_caller)]):
    attempt = _owned(key, caller)
    if attempt.task:
        attempt.task.cancel()
        await asyncio.gather(attempt.task, return_exceptions=True)
    _attempts.pop(key, None)


async def close_all():
    tasks = [attempt.task for attempt in _attempts.values() if attempt.task]
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    _attempts.clear()
