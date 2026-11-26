"""Provider usage limits, read from the quota KPI every adapter reports (`session.usage.quota`).

Shared by the Software Factory, which pauses on spent limits and resumes once they renew, and by plain
sessions and platform chats, which resume their interrupted turn by themselves at the renewal.
"""

from __future__ import annotations

from contextlib import suppress
from datetime import UTC, datetime
from typing import Any


def reset_epoch(value: Any) -> float | None:
    """A quota window's `resetsAt`: epoch seconds (or milliseconds) or an ISO 8601 date, as providers send it."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) / 1000 if value > 1e11 else float(value)
    if isinstance(value, str) and value:
        with suppress(ValueError):
            parsed = datetime.fromisoformat(value)
            return (parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)).timestamp()
    return None


def exhausted(quota: Any) -> tuple[bool, float | None]:
    """Whether a provider usage window is spent, and when the last spent one renews."""
    if not isinstance(quota, dict):
        return False, None
    resets: list[float] = []
    spent = False
    for window in quota.values():
        if not isinstance(window, dict):
            continue
        percent = window.get("percent")
        if window.get("status") == "rejected" or (isinstance(percent, (int, float)) and not isinstance(percent, bool)
                                                  and percent >= 100):
            spent = True
            if (reset := reset_epoch(window.get("resetsAt"))) is not None:
                resets.append(reset)
    return spent, max(resets) if resets else None
