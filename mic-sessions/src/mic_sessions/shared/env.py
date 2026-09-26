"""Transversal aspect: environment configuration.

Settings are read from process environment variables, layered over an `.env` file chain (the
artifact's own `.env`, then the monorepo root `.env`), mirroring the precedence `mic-mooi` gets
from its `Env` aspect. No external dependency beyond `pydantic-settings` is required.
"""

from __future__ import annotations

import re
from functools import lru_cache
from ipaddress import ip_address
from pathlib import Path
from typing import Annotated, Literal

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
    session_activity_interval_seconds: int = Field(default=60, gt=0)
    event_log_limit: int = Field(default=5000, gt=0)
    event_log_bytes: int = Field(default=8 * 1024 * 1024, gt=0)
    sse_heartbeat_seconds: int = Field(default=15, gt=0)
    changes_debounce_seconds: float = Field(default=1.5, ge=0)

    # Session deployments. Docker talks to the host engine, not a nested daemon.
    docker_binary: str = Field(default="docker", min_length=1)
    docker_host: str = "unix:///var/run/docker.sock"
    docker_cli_plugin_dir: Path | None = None
    docker_command_timeout_seconds: int = Field(default=30, gt=0)
    docker_build_timeout_seconds: int = Field(default=1200, gt=0)
    docker_output_limit_bytes: int = Field(default=65536, gt=0)
    deployment_timeout_seconds: int = Field(default=1800, gt=0)
    deployment_readiness_timeout_seconds: int = Field(default=90, gt=0)
    deployment_stop_timeout_seconds: int = Field(default=60, gt=0)
    deployment_probe_timeout_seconds: int = Field(default=5, gt=0)
    deployment_monitor_interval_seconds: int = Field(default=15, gt=0)
    deployment_port_attempts: int = Field(default=3, ge=1, le=3)
    deployment_start_attempts: int = Field(default=2, gt=0, le=3)
    deployment_activity_limit: int = Field(default=400, gt=0)
    deployment_activity_bytes: int = Field(default=512 * 1024, gt=0)
    deployment_activity_text_bytes: int = Field(default=12 * 1024, gt=0)
    deployment_log_tail_lines: int = Field(default=40, gt=0)
    max_deployments: int = Field(default=4, gt=0)
    preview_public_host: str = "127.0.0.1"
    preview_scheme: Literal["http", "https"] = "http"
    preview_bind_address: str = "127.0.0.1"
    preview_probe_host: str = "127.0.0.1"
    # Empty means engine-assigned ports; otherwise an inclusive Compose port range.
    preview_port_range: str = ""

    # Agent runtime — namespaced per provider (AGENT_<PROVIDER>_*); read by that adapter alone.
    agent_claude_model: str = "sonnet"
    agent_claude_effort: str = "high"
    agent_claude_disallowed_tools: Annotated[list[str], NoDecode] = []

    # Logging
    log_level: str = "INFO"

    @field_validator("docker_binary")
    @classmethod
    def _validate_docker_binary(cls, value: str) -> str:
        if not value.strip() or "\x00" in value or "\n" in value or "\r" in value:
            raise ValueError("Docker binary must be an executable name or path")
        return value

    @field_validator("docker_cli_plugin_dir", mode="before")
    @classmethod
    def _validate_docker_cli_plugin_dir(cls, value: object) -> Path | None:
        if value is None or value == "":
            return None
        path = Path(value)
        if not path.is_absolute():
            raise ValueError("Docker CLI plugin directory must be absolute")
        return path

    @field_validator("docker_host")
    @classmethod
    def _validate_docker_host(cls, value: str) -> str:
        if (
            not value.startswith("unix:///")
            or not value.removeprefix("unix://").strip("/")
            or any(character.isspace() or ord(character) < 32 for character in value)
            or any(character in value for character in "?#\x7f")
        ):
            raise ValueError("Docker host must be an absolute unix socket URI")
        return value

    @field_validator("preview_public_host", "preview_probe_host")
    @classmethod
    def _validate_preview_host(cls, value: str) -> str:
        # Store IPv6 without brackets; the URL builder must add them when needed.
        try:
            address = ip_address(value)
        except ValueError:
            if len(value) > 253 or not all(
                re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label)
                for label in value.split(".")
            ):
                raise ValueError("Preview host must be a hostname or IP without scheme, port or path") from None
            return value.lower()
        if address.is_unspecified or address.is_multicast or "%" in value:
            raise ValueError("Preview host must be a usable destination address")
        return str(address)

    @field_validator("preview_bind_address")
    @classmethod
    def _validate_preview_bind(cls, value: str) -> str:
        try:
            address = ip_address(value)
        except ValueError:
            raise ValueError("Preview bind address must be a host interface IP") from None
        if address.is_multicast or "%" in value:
            raise ValueError("Preview bind address must be a host interface IP")
        return str(address)

    @field_validator("preview_port_range")
    @classmethod
    def _validate_preview_port_range(cls, value: str) -> str:
        if value == "":
            return value
        if not re.fullmatch(r"[0-9]{1,5}-[0-9]{1,5}", value):
            raise ValueError("Preview port range must be empty or START-END")
        start, end = map(int, value.split("-"))
        if not 1 <= start <= end <= 65535:
            raise ValueError("Preview port range must satisfy 1 <= START <= END <= 65535")
        return f"{start}-{end}"

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
