"""Transversal aspect: environment configuration.

Settings are read from process environment variables, layered over an `.env` file chain (the
artifact's own `.env`, then the monorepo root `.env`), mirroring the precedence `mic-mooi` gets
from its `Env` aspect. No external dependency beyond `pydantic-settings` is required.
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
    app_name: str = "mic-sessions"
    app_version: str = "0.1.0"
    sessions_port: int = 44913

    # Upstream API
    mooi_api_base_url: str = "http://localhost:39615"
    service_token: str = ""
    jwt_secret: str = ""
    introspection_cache_seconds: int = 30

    # Web
    cors_origin: str = "http://localhost:28471"

    # Workspaces
    workspace_root: Path = Path(".workspaces")
    git_binary: str = "git"
    git_timeout_seconds: int = Field(default=180, gt=0)

    # Sessions
    max_sessions: int = Field(default=8, gt=0)
    max_sessions_per_player: int = Field(default=4, gt=0)
    session_idle_timeout_minutes: int = Field(default=180, gt=0)
    event_log_limit: int = Field(default=5000, gt=0)
    event_log_bytes: int = Field(default=8 * 1024 * 1024, gt=0)
    sse_heartbeat_seconds: int = Field(default=15, gt=0)
    changes_debounce_seconds: float = Field(default=1.5, ge=0)

    # Agent runtime — namespaced per provider (AGENT_<PROVIDER>_*); read by that adapter alone.
    agent_claude_model: str = "sonnet"
    agent_claude_effort: str = "high"
    # Deployment allowlist; aliases resolve through Claude Code. No frontend vendor constants.
    agent_claude_models: dict[str, list[str]] = {
        "sonnet": ["low", "medium", "high"],
        "opus": ["low", "medium", "high", "max"],
        "haiku": [],
    }
    agent_claude_disallowed_tools: Annotated[list[str], NoDecode] = []

    # Logging
    log_level: str = "INFO"

    @field_validator("agent_claude_disallowed_tools", mode="before")
    @classmethod
    def _split_disallowed_tools(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("workspace_root", mode="after")
    @classmethod
    def _resolve_workspace_root(cls, value: Path) -> Path:
        return value.resolve()


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if len(settings.jwt_secret.encode("utf-8")) < 32:
        raise RuntimeError("JWT_SECRET must be at least 32 bytes long")
    if not settings.service_token.strip():
        raise RuntimeError("SERVICE_TOKEN must be set")
    if not settings.mooi_api_base_url.startswith(("http://", "https://")):
        raise RuntimeError("MOOI_API_BASE_URL must be a valid URL")
    return settings
