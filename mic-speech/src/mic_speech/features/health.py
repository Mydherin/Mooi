"""Feature: liveness. Healthy only while the native engine process is alive."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from mic_speech.shared.engine import get_engine, model_name
from mic_speech.shared.env import get_settings

router = APIRouter()


@router.get("/health")
async def health() -> JSONResponse:
    alive = get_engine().alive
    return JSONResponse(
        status_code=200 if alive else 503,
        content={"status": "UP" if alive else "DOWN", "engine": model_name(get_settings())},
    )
