"""Feature: content-free dictation metrics summary (counts, outcomes and latency percentiles)."""

from __future__ import annotations

from fastapi import APIRouter

from mic_speech.shared.metrics import get_metrics

router = APIRouter()


@router.get("/metrics")
async def metrics() -> dict:
    return await get_metrics().summary()
