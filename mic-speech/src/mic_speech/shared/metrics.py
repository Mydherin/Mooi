"""Transversal aspect: content-free dictation metrics.

A local SQLite file (`0600`) holding only outcomes, counts and timings — never audio or text. Rows
older than the retention window are pruned at startup and after every insert. Every database call
runs off the event loop.
"""

from __future__ import annotations

import asyncio
import os
import sqlite3
import time
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from mic_speech.shared.env import get_settings

OUTCOMES = ("final", "empty", "cancelled", "error")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS dictations (
    created_at INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    audio_seconds REAL NOT NULL,
    first_partial_ms REAL NULL,
    partial_count INTEGER NOT NULL,
    stop_to_final_ms REAL NULL
)
"""


@dataclass(frozen=True, slots=True)
class Dictation:
    outcome: str
    audio_seconds: float
    first_partial_ms: float | None
    partial_count: int
    stop_to_final_ms: float | None


def _percentile(values: Sequence[float], percent: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    rank = (len(ordered) - 1) * percent / 100
    lower = int(rank)
    upper = min(lower + 1, len(ordered) - 1)
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * (rank - lower), 1)


class MetricsStore:
    def __init__(self, path: Path, retention_days: int) -> None:
        self._path = path
        self._retention_seconds = retention_days * 86400

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self._path, timeout=5)

    def _prune(self, connection: sqlite3.Connection) -> None:
        connection.execute("DELETE FROM dictations WHERE created_at < ?", (int(time.time()) - self._retention_seconds,))

    def _open(self) -> None:
        self._path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.close(os.open(self._path, os.O_CREAT | os.O_WRONLY, 0o600))
        os.chmod(self._path, 0o600)
        with self._connect() as connection:
            connection.execute(_SCHEMA)
            self._prune(connection)

    def _insert(self, dictation: Dictation) -> None:
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO dictations VALUES (?, ?, ?, ?, ?, ?)",
                (int(time.time()), dictation.outcome, dictation.audio_seconds, dictation.first_partial_ms,
                 dictation.partial_count, dictation.stop_to_final_ms),
            )
            self._prune(connection)

    def _summary(self) -> dict:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT outcome, audio_seconds, first_partial_ms, partial_count, stop_to_final_ms FROM dictations"
            ).fetchall()
        first_partials = [row[2] for row in rows if row[2] is not None]
        stop_to_finals = [row[4] for row in rows if row[4] is not None]
        return {
            "retentionDays": self._retention_seconds // 86400,
            "total": len(rows),
            "outcomes": {outcome: sum(1 for row in rows if row[0] == outcome) for outcome in OUTCOMES},
            "audioSeconds": round(sum(row[1] for row in rows), 1),
            "firstPartialMs": {"p50": _percentile(first_partials, 50), "p95": _percentile(first_partials, 95)},
            "stopToFinalMs": {"p50": _percentile(stop_to_finals, 50), "p95": _percentile(stop_to_finals, 95)},
            "meanPartials": round(sum(row[3] for row in rows) / len(rows), 1) if rows else None,
        }

    async def open(self) -> None:
        await asyncio.to_thread(self._open)

    async def record(self, dictation: Dictation) -> None:
        await asyncio.to_thread(self._insert, dictation)

    async def summary(self) -> dict:
        return await asyncio.to_thread(self._summary)


_store: MetricsStore | None = None


def get_metrics() -> MetricsStore:
    global _store
    if _store is None:
        settings = get_settings()
        _store = MetricsStore(settings.speech_metrics_path, settings.speech_metrics_retention_days)
    return _store
