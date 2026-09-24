"""Transversal aspect: the per-session event log.

Each session keeps one append-only, in-memory event log with a monotonic `seq`: the
event log is the single source of truth for the transcript, so the SSE stream is a live tail of it
and a client that reconnects simply replays from its last `seq` — there is no separate "snapshot"
endpoint to keep in sync. The log is a bounded ring buffer (`EVENT_LOG_LIMIT`); a subscriber that
falls behind its own bounded queue is dropped rather than allowed to buffer unboundedly, since a
dropped subscriber reconnects from `after`. Expired cursors receive an explicit history reset
and a current session/pending-interaction snapshot from the stream endpoint.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from mic_sessions.shared.env import get_settings

LOG = logging.getLogger("sessions")

_SUBSCRIBER_QUEUE_LIMIT = 256


@dataclass(frozen=True)
class Event:
    seq: int
    at: datetime
    type: str
    data: dict[str, Any]


class EventLog:
    """One session's append-only event log plus its live fan-out to SSE subscribers."""

    def __init__(self, limit: int | None = None) -> None:
        self._events: deque[Event] = deque(maxlen=limit or get_settings().event_log_limit)
        self._byte_limit = get_settings().event_log_bytes
        self._sizes: deque[int] = deque()
        self._bytes = 0
        self._seq = 0
        self._subscribers: set[asyncio.Queue[Event | None]] = set()

    def append(self, type_: str, data: dict[str, Any]) -> Event:
        self._seq += 1
        event = Event(seq=self._seq, at=datetime.now(UTC), type=type_, data=data)
        size = len(json.dumps(data, ensure_ascii=False, default=str).encode()) + 128
        if len(self._events) == self._events.maxlen:
            self._bytes -= self._sizes.popleft()
        self._events.append(event)
        self._sizes.append(size)
        self._bytes += size
        while self._bytes > self._byte_limit and self._events:
            self._events.popleft()
            self._bytes -= self._sizes.popleft()
        for queue in list(self._subscribers):
            self._offer(queue, event)
        return event

    def _offer(self, queue: asyncio.Queue[Event | None], event: Event) -> None:
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            LOG.warning("Dropping a slow SSE subscriber at seq=%s", event.seq)
            self._subscribers.discard(queue)
            self._force_close(queue)

    def _force_close(self, queue: asyncio.Queue[Event | None]) -> None:
        """Makes room for the closing sentinel in a full queue, so the subscriber's consumer loop
        can still observe it and return instead of hanging on `queue.get()` forever."""
        while not queue.empty():
            queue.get_nowait()
        queue.put_nowait(None)

    @property
    def last_seq(self) -> int:
        return self._seq

    @property
    def first_seq(self) -> int:
        return self._events[0].seq if self._events else self._seq + 1

    def replay(self, after: int) -> list[Event]:
        return [event for event in self._events if event.seq > after]

    def subscribe(self) -> asyncio.Queue[Event | None]:
        """Registers a new subscriber queue and returns it immediately — a plain, synchronous call
        with no `await` in it on purpose: the stream endpoint can `replay()` right after this
        with no gap in which an event appended in between could be lost, since the queue is already
        registered before `subscribe()` returns. A raw queue is handed back rather than an async
        generator wrapping it, so a heartbeat timeout on `queue.get()` (a plain `asyncio.Queue`
        cancellation) can never tear down the subscription the way cancelling an `async for` over a
        generator with cleanup logic would."""
        queue: asyncio.Queue[Event | None] = asyncio.Queue(maxsize=_SUBSCRIBER_QUEUE_LIMIT)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[Event | None]) -> None:
        self._subscribers.discard(queue)

    def close(self) -> None:
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(None)
            except asyncio.QueueFull:
                self._force_close(queue)
        self._subscribers.clear()


def sse_frame(event: Event) -> str:
    payload = {"seq": event.seq, "at": event.at.isoformat(), **event.data}
    return f"id: {event.seq}\nevent: {event.type}\ndata: {json.dumps(payload)}\n\n"


def sse_heartbeat() -> str:
    return ": ping\n\n"
