"""Feature: liveness.

Free of feature imports by design: the sessions feature registers a `session_count` callable on
`app.state` once it exists, and this endpoint reads it defensively so health stays correct before
that registration ever happens.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request) -> dict:
    session_count = getattr(request.app.state, "session_count", None)
    return {"status": "UP", "sessions": session_count() if callable(session_count) else 0}
