"""Transversal aspect: logging.

One console format shared with the other services. Dictation never logs audio or transcript text:
only counts and timings reach a log line.
"""

from __future__ import annotations

import logging

_CONSOLE_FORMAT = "%(asctime)s %(levelname)-5s %(name)s - %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(_CONSOLE_FORMAT, datefmt=_DATE_FORMAT))

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
