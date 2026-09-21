"""Transversal aspect: request tracing and access logging.

Every request carries a correlation id, injected into every log line through a `logging.Filter`
reading from a `ContextVar`, and echoed back in the `X-Correlation-Id` response header — the same
shape as `mic-mooi`'s `Logging` aspect, so a correlated request can be followed across both
services.
"""

from __future__ import annotations

import logging
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

CORRELATION_ID_HEADER = "X-Correlation-Id"

LOG = logging.getLogger("sessions")

correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")
player_id_var: ContextVar[str] = ContextVar("player_id", default="")

_CONSOLE_FORMAT = "%(asctime)s %(levelname)-5s [%(correlation_id)s] [%(player_id)s] %(name)s - %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


class _ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id_var.get()
        record.player_id = player_id_var.get()
        return True


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(_CONSOLE_FORMAT, datefmt=_DATE_FORMAT))
    handler.addFilter(_ContextFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        correlation_id = request.headers.get(CORRELATION_ID_HEADER) or str(uuid.uuid4())
        correlation_token = correlation_id_var.set(correlation_id)
        try:
            response = await call_next(request)
        finally:
            correlation_id_var.reset(correlation_token)
        response.headers[CORRELATION_ID_HEADER] = correlation_id
        return response
