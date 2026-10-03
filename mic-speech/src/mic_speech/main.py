"""ASGI entrypoint: assembles the app from the transversal aspects and features.

`_lifespan` opens the metrics store and starts the native engine once (the model stays resident
for every dictation), then stops it on shutdown. Run with a single worker: the engine and the
one-dictation lock live in this process.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from mic_speech.features import dictation, health, metrics
from mic_speech.shared.engine import get_engine
from mic_speech.shared.env import get_settings
from mic_speech.shared.logging import configure_logging
from mic_speech.shared.metrics import get_metrics


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    await get_metrics().open()
    engine = get_engine()
    await engine.start()
    try:
        yield
    finally:
        await engine.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=_lifespan)
    app.include_router(health.router)
    app.include_router(metrics.router)
    app.include_router(dictation.router)

    return app


app = create_app()
