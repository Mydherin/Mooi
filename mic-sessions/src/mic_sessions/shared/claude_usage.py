"""Shared, bounded Claude account usage and CLI context reads."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import os
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import httpx
from claude_agent_sdk import ClaudeSDKClient

LOG = logging.getLogger("sessions")
_USAGE_URL = "https://api.anthropic.com/api/oauth/usage"


@dataclass
class _Snapshot:
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    checked_at: float = 0
    retry_at: float = 0
    failures: int = 0
    value: dict[str, Any] | None = None
    loaded: bool = False
    status: str | None = None


_snapshots: dict[str, _Snapshot] = {}


def _storage(key: str, snapshot: _Snapshot, *, write: bool = False) -> None:
    """Persist only usage metadata, so restarting cannot bypass provider backoff."""
    from mic_sessions.shared.env import get_settings
    root = get_settings().workspace_root
    root.mkdir(parents=True, exist_ok=True)
    path = root / "usage-cache.sqlite3"
    descriptor = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    os.close(descriptor)
    path.chmod(0o600)
    with sqlite3.connect(path, timeout=2) as db:
        db.execute("CREATE TABLE IF NOT EXISTS usage (key TEXT PRIMARY KEY, body TEXT, touched REAL)")
        if write:
            body = {"value": snapshot.value, "retry_at": snapshot.retry_at,
                    "failures": snapshot.failures, "status": snapshot.status}
            db.execute("INSERT OR REPLACE INTO usage VALUES (?, ?, ?)", (key, json.dumps(body), time.time()))
            db.execute("DELETE FROM usage WHERE touched < ?", (time.time() - 7 * 86400,))
            db.execute("DELETE FROM usage WHERE key NOT IN (SELECT key FROM usage ORDER BY touched DESC LIMIT 1024)")
        else:
            row = db.execute("SELECT body FROM usage WHERE key = ? AND touched > ?", (key, time.time() - 7 * 86400)).fetchone()
            if row:
                body = json.loads(row[0])
                snapshot.value = body["value"]
                snapshot.retry_at = body["retry_at"]
                snapshot.failures = body["failures"]
                snapshot.status = body.get("status")


def _result(snapshot: _Snapshot) -> dict[str, Any]:
    result = {key: dict(value) for key, value in (snapshot.value or {}).items()}
    now = time.time()
    for value in result.values():
        if value.get("resetsAt") and value["resetsAt"] <= now:
            value["percent"] = None
            value["resetsAt"] = None
    return result


async def remember(connection_id: str | None, token: str, name: str | None, metric: dict[str, Any]) -> None:
    """Share authoritative turn events without losing values omitted by a later event."""
    if not name:
        return
    key = connection_id or hashlib.sha256(token.encode()).hexdigest()
    snapshot = _snapshots.setdefault(key, _Snapshot())
    async with snapshot.lock:
        await _load(key, snapshot)
        previous = (snapshot.value or {}).get(name, {})
        merged = {**previous, **{k: v for k, v in metric.items() if v is not None}}
        if metric.get("percent") is None and previous.get("percent") is not None:
            merged["updatedAt"] = previous["updatedAt"]
        snapshot.value = {**(snapshot.value or {}), name: merged}
        try:
            await asyncio.to_thread(_storage, key, snapshot, write=True)
        except (OSError, sqlite3.Error):
            LOG.debug("Claude usage event could not be cached")


async def _load(key: str, snapshot: _Snapshot) -> None:
    if snapshot.loaded:
        return
    try:
        await asyncio.to_thread(_storage, key, snapshot)
    except (OSError, sqlite3.Error, ValueError, KeyError):
        LOG.debug("Claude usage cache could not be read")
    snapshot.loaded = True


def _normalize(limits: dict[str, Any]) -> dict[str, Any] | None:
    result = {}
    for name in ("five_hour", "seven_day", "seven_day_oauth_apps", "seven_day_opus", "seven_day_sonnet"):
        window = limits.get(name)
        if not isinstance(window, dict):
            continue
        utilization = window.get("utilization")
        if utilization is not None and (isinstance(utilization, bool)
                                        or not isinstance(utilization, (int, float))
                                        or not math.isfinite(utilization)):
            continue
        # get_usage schema: OAuth utilization is a percentage (0–100).
        # Only SDK RateLimitEvent uses a fraction. Never infer units by magnitude.
        percent = utilization
        reset = window.get("resets_at")
        try:
            reset = datetime.fromisoformat(reset.replace("Z", "+00:00")).timestamp() if reset else None
        except (ValueError, TypeError, AttributeError):
            reset = None
        result[name] = {"percent": max(0, min(100, percent)) if percent is not None else None, "window": name,
                        "resetsAt": reset, "updatedAt": time.time()}
    return result or None


async def quota(connection_id: str | None, token: str) -> dict[str, Any]:
    now = time.time()
    for key, entry in list(_snapshots.items()):
        if now - entry.checked_at > 3600 and not entry.lock.locked():
            _snapshots.pop(key, None)
    key = connection_id or hashlib.sha256(token.encode()).hexdigest()
    snapshot = _snapshots.setdefault(key, _Snapshot())
    async with snapshot.lock:
        await _load(key, snapshot)
        now = time.time()
        snapshot.checked_at = now
        if now < snapshot.retry_at:
            return _result(snapshot)
        try:
            async with httpx.AsyncClient(timeout=5) as http:
                response = await http.get(_USAGE_URL, headers={
                    "Authorization": f"Bearer {token}",
                    "anthropic-beta": "oauth-2025-04-20",
                    "Content-Type": "application/json",
                    "User-Agent": "Mooi/0.1.0",
                })
            if response.status_code == 429:
                snapshot.failures += 1
                retry_header = response.headers.get("retry-after", "0")
                try:
                    retry_after = float(retry_header)
                except ValueError:
                    try:
                        retry_after = (parsedate_to_datetime(retry_header) - datetime.now(timezone.utc)).total_seconds()
                    except (ValueError, TypeError):
                        retry_after = 0
                if not math.isfinite(retry_after):
                    retry_after = 0
                snapshot.retry_at = now + max(retry_after, min(3600, 900 * 2 ** min(snapshot.failures - 1, 2)))
                snapshot.status = "rate_limited"
                LOG.info("Claude usage metadata returned 429; next read in %.0f seconds", snapshot.retry_at - now)
            elif response.status_code in (401, 403):
                snapshot.status = "authorization_required"
                snapshot.retry_at = now + 3600
                LOG.info("Claude usage metadata requires authorization (HTTP %s)", response.status_code)
            else:
                response.raise_for_status()
                fetched = _normalize(response.json())
                if fetched is None:
                    raise ValueError("No plan windows")
                snapshot.value = fetched
                snapshot.failures = 0
                snapshot.status = None
                snapshot.retry_at = now + 300
        except (httpx.HTTPError, ValueError, TypeError):
            snapshot.failures += 1
            snapshot.retry_at = now + min(1800, 300 * 2 ** min(snapshot.failures, 3))
            snapshot.status = "unavailable"
            LOG.debug("Claude account usage endpoint is unavailable")
        try:
            await asyncio.to_thread(_storage, key, snapshot, write=True)
        except (OSError, sqlite3.Error):
            LOG.debug("Claude usage cache could not be saved")
        return _result(snapshot)


async def context(client: ClaudeSDKClient) -> dict[str, Any] | None:
    """Ask the running CLI for its effective window without a model turn."""
    try:
        async with asyncio.timeout(10):
            response = await client._query._send_control_request({
                "subtype": "get_context_usage", "detail": "summary",
            })
        window = response.get("rawMaxTokens")
        used = response.get("totalTokens")
        if isinstance(window, int) and window > 0 and isinstance(used, int) and used >= 0:
            return {"percent": used / window * 100, "usedTokens": used,
                    "limitTokens": window, "updatedAt": time.time()}
    except Exception:
        LOG.debug("Claude context summary is unavailable")
    return None
