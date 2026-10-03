"""Transversal aspect: environment configuration.

Settings are read from process environment variables, layered over an `.env` file chain (the
monorepo root `.env`, then the artifact's own `.env`), the same precedence `mic-sessions` uses. No
external dependency beyond `pydantic-settings` is required.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), env_file_encoding="utf-8", extra="ignore")

    # Application
    app_name: str = "mic-speech"
    app_version: str = "0.1.0"
    # Loopback only: audio never leaves the machine and the service is unreachable from another one.
    speech_host: str = "127.0.0.1"
    speech_port: int = 59100

    # Web: the SPA origin is the only WebSocket `Origin` accepted.
    cors_origin: str = "http://localhost:28471"

    # Recognition
    speech_language: str = Field(default="es-ES", pattern=r"^[a-z]{2,3}-[A-Z]{2}$")
    speech_contexts: Annotated[list[str], NoDecode] = []
    speech_max_seconds: int = Field(default=300, ge=1, le=1800)

    # Native engine: an explicit binary wins; otherwise the provisioned runtime, then PATH.
    speech_runtime_path: str = ""
    speech_runtime_dir: Path = Path(".runtime")
    # Indexed model name (pinned revision and checksum) or a local GGUF path.
    speech_model: str = "nemotron-3.5"
    # Empty picks `metal` on macOS and `auto` elsewhere.
    speech_device: str = ""
    speech_startup_timeout_seconds: int = Field(default=60, gt=0)

    # Content-free metrics
    speech_metrics_path: Path = Path("~/.cache/mooi/speech/metrics.sqlite")
    speech_metrics_retention_days: int = Field(default=30, gt=0)

    # Logging
    log_level: str = "INFO"

    @field_validator("speech_contexts", mode="before")
    @classmethod
    def _split_contexts(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("speech_runtime_dir", "speech_metrics_path", mode="after")
    @classmethod
    def _resolve_path(cls, value: Path) -> Path:
        return value.expanduser().resolve()


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.speech_host not in {"127.0.0.1", "::1", "localhost"}:
        raise RuntimeError("SPEECH_HOST must be a loopback address")
    if not settings.cors_origin.startswith(("http://", "https://")):
        raise RuntimeError("CORS_ORIGIN must be the SPA origin URL")
    return settings
