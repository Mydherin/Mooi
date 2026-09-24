"""Bounded Docker CLI execution against the explicitly configured host engine.

Only service-owned methods may supply arguments; this is not a command API for agents.
Captured output is private infrastructure data, never an SSE payload or log message.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import re
import signal
import stat
import tempfile
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from ipaddress import ip_address
from pathlib import Path
from typing import Literal
from urllib.parse import unquote, urlsplit
from uuid import UUID, uuid4

import httpx
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from mic_sessions.shared.env import Settings, get_settings

LOG = logging.getLogger("docker")


class DockerError(Exception):
    """Public-safe infrastructure failure; never includes CLI output or private paths.

    `detail` carries a redacted, bounded output tail for the caller to hand to the deployment
    agent or a debug log. It is never part of the exception message and never reaches a user
    without the domain emitter bounding and redacting it again.
    """

    def __init__(self, code: Literal["docker_unavailable", "timeout", "invalid_compose", "unsupported_project", "port_unavailable", "startup_failed", "health_check_failed", "cleanup_failed"], message: str, detail: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.detail = detail


@dataclass(frozen=True)
class DockerOutput:
    returncode: int
    stdout: str = field(repr=False)
    stderr: str = field(repr=False)
    truncated: bool = False


@dataclass(frozen=True)
class DockerPreflight:
    engine_version: str
    compose_version: str


@dataclass(frozen=True)
class DockerComposeBuild:
    """Normalized local build inputs for one service in the frozen Compose model."""

    service: str
    context: Path
    dockerfile: Path | None


@dataclass(frozen=True)
class DockerComposeCandidate:
    """Non-secret deployment inputs from an existing root Compose file."""

    builds: tuple[DockerComposeBuild, ...]
    ports: tuple[DockerPortRequest, ...]


@dataclass(frozen=True)
class DockerReadiness:
    preview_url: str
    status_code: int
    content_type: str | None
    expectation: Literal["html", "http"]


class DockerManifestError(Exception):
    """Private storage is unavailable or invalid; contains no paths or document data."""


class DockerPortRequest(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True, extra="forbid")

    service: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$", max_length=128)
    container_port: int = Field(ge=1, le=65535)
    protocol: Literal["tcp", "udp"] = "tcp"


class DockerPort(DockerPortRequest):
    published_port: int = Field(ge=1, le=65535)
    bind_address: str = Field(min_length=1, max_length=45)


class DockerManifest(BaseModel):
    """Private recovery record. Project secrets belong in referenced private files, never here."""

    model_config = ConfigDict(strict=True, frozen=True, extra="forbid")

    schema_version: Literal[1] = 1
    installation_id: UUID
    session_id: UUID
    owner_id: UUID
    project_name: str
    compose_files: tuple[str, ...] = ()
    environment_files: tuple[str, ...] = ()
    cwd: str
    web_service: str | None = None
    ports: tuple[DockerPort, ...] = ()
    created_at: AwareDatetime
    updated_at: AwareDatetime
    cleanup_state: Literal["prepared", "required", "stopped", "failed"] = "prepared"

    @model_validator(mode="after")
    def validate_record(self) -> DockerManifest:
        if self.project_name != _project_name(self.installation_id, self.session_id):
            raise ValueError("Invalid project identity")
        if not Path(self.cwd).is_absolute() or self.updated_at < self.created_at:
            raise ValueError("Invalid manifest metadata")
        for name in (*self.compose_files, *self.environment_files):
            # Relative private filenames, never checkout paths or arbitrary cleanup targets.
            if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}", name):
                raise ValueError("Invalid private filename")
        return self


def _project_name(installation_id: UUID, session_id: UUID) -> str:
    return f"mooi-{installation_id.hex}-{session_id.hex}"


class DockerManifests:
    """Single-process storage; callers serialize session mutations with their operation lock.

    Instantiate lazily: construction persists installation identity, but never contacts Docker.
    Missing/corrupt identity with existing records must not silently orphan resources.
    """

    def __init__(self, root: Path) -> None:
        self.root = root.resolve() / "deployments"
        try:
            self._directory(self.root)
            identity = self.root / ".installation-id"
            if not identity.exists() and not identity.is_symlink():
                if any(self.root.iterdir()):
                    raise DockerManifestError("Deployment installation identity is missing")
                self._atomic_write(identity, str(uuid4()).encode(), exclusive=True)
            self.installation_id = UUID(self._read(identity).decode("ascii"))
        except (OSError, ValueError, UnicodeError):
            raise DockerManifestError("Deployment installation identity is unavailable") from None

    @staticmethod
    def _directory(path: Path) -> None:
        if path.is_symlink() or path.resolve() != path:
            raise DockerManifestError("Invalid deployment directory")
        path.mkdir(mode=0o700, parents=True, exist_ok=True)
        path.chmod(0o700)

    @staticmethod
    def _read(path: Path) -> bytes:
        with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb") as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
                raise DockerManifestError("Invalid deployment file permissions or type")
            value = stream.read(262145)
            if len(value) > 262144:
                raise DockerManifestError("Deployment record exceeds its size limit")
            return value

    @staticmethod
    def _atomic_write(path: Path, data: bytes, *, exclusive: bool = False) -> None:
        if len(data) > 262144:
            raise DockerManifestError("Deployment record exceeds its size limit")
        fd, temporary = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            if exclusive:
                os.link(temporary, path)  # Publish a complete file without replacing another owner.
            else:
                os.replace(temporary, path)
            directory_fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        finally:
            Path(temporary).unlink(missing_ok=True)

    def directory(self, session_id: UUID) -> Path:
        if not isinstance(session_id, UUID):
            raise DockerManifestError("Invalid deployment session identity")
        path = self.root / str(session_id)
        if self.root.is_symlink() or path.is_symlink() or path.resolve() != path:
            raise DockerManifestError("Invalid deployment directory")
        return path

    def create(self, session_id: UUID, owner_id: UUID) -> DockerManifest:
        """Reserve ownership before any engine mutation. Existing records are never overwritten."""
        try:
            directory = self.directory(session_id)
            self._directory(directory)
            now = datetime.now(UTC)
            manifest = DockerManifest(
                installation_id=self.installation_id, session_id=session_id, owner_id=owner_id,
                project_name=_project_name(self.installation_id, session_id), cwd=str(directory),
                created_at=now, updated_at=now,
            )
            self._atomic_write(directory / "manifest.json", manifest.model_dump_json().encode(), exclusive=True)
            return manifest
        except (OSError, ValueError):
            raise DockerManifestError("Deployment ownership could not be reserved") from None

    def load(self, session_id: UUID) -> DockerManifest:
        try:
            directory = self.directory(session_id)
            manifest = DockerManifest.model_validate_json(self._read(directory / "manifest.json"))
            if (manifest.installation_id != self.installation_id or manifest.session_id != session_id
                    or manifest.cwd != str(directory)):
                raise DockerManifestError("Deployment ownership does not match")
            return manifest
        except (OSError, ValueError):
            raise DockerManifestError("Deployment record is unavailable or invalid") from None

    def save(self, manifest: DockerManifest) -> None:
        """Persist validated metadata; cleanup failures retain the same ownership evidence."""
        try:
            manifest = DockerManifest.model_validate_json(manifest.model_dump_json())
            previous = self.load(manifest.session_id)
            immutable = ("installation_id", "owner_id", "project_name", "cwd", "created_at")
            if (any(getattr(previous, key) != getattr(manifest, key) for key in immutable)
                    or manifest.updated_at < previous.updated_at):
                raise DockerManifestError("Deployment ownership or chronology cannot change")
            self._atomic_write(self.directory(manifest.session_id) / "manifest.json",
                               manifest.model_dump_json().encode())
        except (OSError, ValueError):
            raise DockerManifestError("Deployment record could not be saved") from None

    def _remove_stopped(self, session_id: UUID) -> None:
        """Called only after engine cleanup; keep a usable record on partial file removal."""
        manifest = self.load(session_id)
        if manifest.cleanup_state != 'stopped':
            raise DockerManifestError('Deployment resources must be stopped before removal')
        directory = self.directory(session_id)
        try:
            files = list(directory.iterdir())
            if any(not stat.S_ISREG(path.lstat().st_mode) for path in files):
                raise DockerManifestError('Invalid deployment cleanup file type')
            # Engine absence is confirmed. Retries no longer need the Compose files.
            manifest = manifest.model_copy(update={'compose_files': (), 'environment_files': (),
                                                   'updated_at': datetime.now(UTC)})
            self.save(manifest)
            for path in files:
                if path.name != 'manifest.json':
                    path.unlink()
            (directory / 'manifest.json').unlink()
            try:
                directory.rmdir()
            except OSError:
                self._atomic_write(directory / 'manifest.json', manifest.model_dump_json().encode())
                raise
        except OSError:
            raise DockerManifestError('Deployment files could not be removed') from None

    def session_ids(self) -> tuple[UUID, ...]:
        """Include corrupt records so reconciliation can preserve their workspace and report failure.

        Ignore unrelated entries and temporary files; never delete anything during discovery.
        """
        try:
            if self.root.is_symlink():
                raise DockerManifestError("Invalid deployment directory")
            result = []
            for path in self.root.iterdir():
                try:
                    session_id = UUID(path.name)
                except ValueError:
                    continue
                if str(session_id) == path.name:
                    result.append(session_id)
            return tuple(sorted(result, key=str))
        except OSError:
            raise DockerManifestError("Deployment records could not be listed") from None


def _compose_path(value: str, root: Path, *, directory: bool = False) -> Path:
    """Local build inputs must remain inside this checkout, including symlink targets."""
    if not isinstance(value, str) or not value:
        raise DockerError("invalid_compose", "Compose contains an invalid local path")
    path = (root / value).resolve()
    if not path.is_relative_to(root) or not (path.is_dir() if directory else path.is_file()):
        raise DockerError("unsupported_project", "Compose requires unavailable files outside the checkout")
    return path


def _freeze_compose(model: dict, checkout: Path, project: str, web_service: str) -> dict:
    """Normalize ownership and reject requirements that cannot run as sibling containers.

    Compose has already merged files, interpolated variables and expanded short syntax.
    Build contexts stay in the checkout: Docker sends them to the daemon during build.
    """
    def unsupported() -> None:
        raise DockerError("unsupported_project", "Compose requires unsupported mounts or external resources")

    if set(model) - {"name", "services", "networks", "volumes", "version"}:
        unsupported()
    services = model.get("services")
    if not isinstance(services, dict) or web_service not in services:
        raise DockerError("invalid_compose", "The web service is missing from Compose")
    model["name"] = project
    for kind in ("networks", "volumes"):
        resources = model.setdefault(kind, {})
        if not isinstance(resources, dict):
            unsupported()
        for name, resource in resources.items():
            if not isinstance(resource, dict) or resource.get("external") or resource.get("driver_opts"):
                unsupported()
            if resource.get("driver") not in (None, "bridge" if kind == "networks" else "local"):
                unsupported()
            resource["name"] = f"{project}_{name}"
    build_sources: dict[str, dict[str, str]] = {}
    for name, service in services.items():
        if not isinstance(service, dict):
            unsupported()
        if any(service.get(key) for key in (
            "network_mode", "volumes_from", "external_links", "configs", "secrets",
            "devices", "device_cgroup_rules", "privileged", "pid", "ipc", "uts",
            "use_api_socket", "provider", "develop", "env_file", "label_file",
            "extends", "credential_spec", "post_start", "pre_stop",
        )):
            unsupported()
        service.pop("container_name", None)
        service.pop("profiles", None)
        # Build images must not overwrite shared, explicitly named repository images.
        build = service.get("build")
        if build is not None:
            if not isinstance(build, dict) or any(build.get(key) for key in (
                "additional_contexts", "ssh", "secrets", "network", "entitlements",
                "privileged", "cache_to", "cache_from", "tags",
            )):
                unsupported()
            arguments = build.get("args", {})
            if not isinstance(arguments, dict) or any(value is None for value in arguments.values()):
                raise DockerError("invalid_compose", "Compose has unresolved build arguments")
            context = _compose_path(build.get("context", "."), checkout, directory=True)
            build["context"] = str(context)
            if "dockerfile_inline" not in build:
                dockerfile = _compose_path(build.pop("dockerfile", "Dockerfile"), context)
                if dockerfile.stat().st_size > 262144:
                    unsupported()
                build_sources[name] = {"context": str(context), "dockerfile": str(dockerfile)}
                build["dockerfile_inline"] = dockerfile.read_text()
            else:
                # Coverage validation requires a real Dockerfile rooted in the artifact.
                build_sources[name] = {"context": str(context), "dockerfile": ""}
            service["image"] = f"{project}-{name}"
        elif name == web_service:
            raise DockerError("unsupported_project", "The web service must build from a Dockerfile")
        for mount in service.get("volumes", []):
            if (not isinstance(mount, dict) or mount.get("type") != "volume"
                    or mount.get("source") not in model["volumes"]):
                unsupported()
        environment = service.get("environment", {})
        if not isinstance(environment, dict) or any(value is None for value in environment.values()):
            raise DockerError("invalid_compose", "Compose has unresolved environment variables")
        if not isinstance(service.get("ports", []), list):
            unsupported()
    # Compose extension metadata remains private and preserves the source relationship after
    # Dockerfile contents are frozen inline. Docker ignores x-* fields.
    model["x-mooi-builds"] = build_sources
    return model


def _literal_compose(value):
    """Compose re-reads the frozen JSON as YAML; protect already resolved dollar literals."""
    if isinstance(value, str):
        return value.replace("$", "$$")
    if isinstance(value, list):
        return [_literal_compose(item) for item in value]
    if isinstance(value, dict):
        return {key: _literal_compose(item) for key, item in value.items()}
    return value


def _redact(value: str, secrets: tuple[str, ...]) -> str:
    for secret in sorted(filter(None, secrets), key=len, reverse=True):
        value = value.replace(secret, "[redacted]")
    value = re.sub(r"(https?://)[^\s/@]+@", r"\1[redacted]@", value, flags=re.IGNORECASE)
    value = re.sub(r"\b(Bearer|Basic)\s+[^\s\"']+", r"\1 [redacted]", value, flags=re.IGNORECASE)
    return re.sub(
        r'''(?i)(["']?(?:password|passwd|token|secret|api[_-]?key|authorization)["']?\s*[:=]\s*)'''
        r'''(?:"[^"\n]*"|'[^'\n]*'|[^\s,}]+)''',
        r"\1[redacted]", value,
    )



def redact_deployment_output(value: str, secrets: tuple[str, ...] = ()) -> str:
    """Public diagnostic text: remove credentials and private absolute paths."""
    value = _redact(value, secrets)
    value = re.sub(
        r"""(?i)(["']?\b[\w-]*(?:password|passwd|token|secret|api[_-]?key|authorization)["']?\s*[:=]\s*)"""
        r"""(?:"[^"\n]*"|'[^'\n]*'|[^\s,}]+)""",
        r"\1[redacted]", value,
    )
    return re.sub(r"/(?:Users|home|private|tmp|var|root)/[^\s\"'<>]*", "[private path]", value)


def _tail(text: str, lines: int) -> str:
    """Last `lines` non-empty lines of already redacted output, oldest first."""
    if lines <= 0:
        return ""
    kept = [line for line in text.splitlines() if line.strip()]
    return "\n".join(kept[-lines:])


class Docker:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def _run(
        self, *args: str, cwd: Path, timeout: float | None = None,
        deadline: float | None = None, secrets: tuple[str, ...] = (),
        on_line: Callable[[str], None] | None = None,
    ) -> DockerOutput:
        """Drain both pipes with a shared byte budget; kill/reap the CLI group on interruption.

        deadline is an absolute asyncio loop time. Callers must supply the operation deadline
        for multi-command work. Killing the CLI does not roll back engine resources: callers
        must reconcile them using their manifest after a failed/cancelled mutation.

        on_line observes complete lines while they are drained, already redacted and inside the
        same byte budget as the captured output. It never changes the return value, and its own
        failures never interrupt draining: progress reporting must not break a deployment.
        """
        limit = self.settings.docker_output_limit_bytes
        duration = self.settings.docker_command_timeout_seconds if timeout is None else timeout
        if not math.isfinite(duration) or duration <= 0:
            raise ValueError("Docker command timeout must be finite and positive")
        if deadline is not None:
            if not math.isfinite(deadline):
                raise ValueError("Docker deadline must be finite")
            duration = min(duration, deadline - asyncio.get_running_loop().time())
        if duration <= 0:
            raise DockerError("timeout", "The Docker operation timed out")
        if not cwd.is_absolute():
            raise ValueError("Docker working directory must be absolute")

        # An empty config prevents ambient contexts, registry credentials and CLI settings
        # from overriding the engine or exposing Mooi credentials. System CLI plugins work.
        with tempfile.TemporaryDirectory(prefix="mooi-docker-") as config:
            if self.settings.docker_cli_plugin_dir is not None:
                Path(config, "config.json").write_text(json.dumps({
                    "cliPluginsExtraDirs": [str(self.settings.docker_cli_plugin_dir)]
                }))
            env = {"PATH": os.environ.get("PATH", os.defpath), "HOME": config,
                   "DOCKER_CONFIG": config, "DOCKER_HOST": self.settings.docker_host,
                   "LANG": "C.UTF-8", "NO_COLOR": "1", "COMPOSE_ANSI": "never"}
            process = None
            readers: list[asyncio.Task] = []
            buffers = [bytearray(), bytearray()]
            pending = [bytearray(), bytearray()]
            remaining = limit
            truncated = False

            def publish(line: bytes) -> None:
                try:
                    on_line(_redact(line.decode("utf-8", "replace").rstrip("\r"), secrets))
                except Exception:  # A reporting failure must never abort the command.
                    LOG.debug("Background operation encountered an exception", exc_info=True)

            async def drain(stream: asyncio.StreamReader, buffer: bytearray, partial: bytearray) -> None:
                nonlocal remaining, truncated
                while chunk := await stream.read(8192):
                    count = min(len(chunk), remaining)
                    buffer.extend(chunk[:count])
                    remaining -= count
                    truncated |= count < len(chunk)
                    if on_line is None or not count:
                        continue
                    partial.extend(chunk[:count])
                    while (index := partial.find(b"\n")) >= 0:
                        line = bytes(partial[:index])
                        del partial[:index + 1]
                        publish(line)
                # A budget-truncated remainder may hold part of a secret; only publish a
                # complete trailing line, i.e. one the stream itself ended.
                if on_line is not None and partial and not truncated:
                    publish(bytes(partial))
                    partial.clear()

            async def finish() -> None:
                if process is not None:
                    # Compose plugins/children can keep pipes open after the CLI exits.
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    await process.wait()
                for reader in readers:
                    reader.cancel()
                await asyncio.gather(*readers, return_exceptions=True)

            try:
                async with asyncio.timeout(duration):
                    process = await asyncio.create_subprocess_exec(
                        self.settings.docker_binary, "--host", self.settings.docker_host,
                        "--config", config, *args, cwd=str(cwd), env=env,
                        stdin=asyncio.subprocess.DEVNULL, stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE, start_new_session=True,
                    )
                    readers = [asyncio.create_task(drain(process.stdout, buffers[0], pending[0])),
                               asyncio.create_task(drain(process.stderr, buffers[1], pending[1]))]
                    await asyncio.gather(*readers)
                    await process.wait()
            except (TimeoutError, asyncio.CancelledError, OSError) as error:
                cleanup = asyncio.create_task(finish())
                # Repeated cancellation must not abandon child processes or pipe readers.
                cancelled = isinstance(error, asyncio.CancelledError)
                while not cleanup.done():
                    try:
                        await asyncio.shield(cleanup)
                    except asyncio.CancelledError:
                        cancelled = True
                cleanup.result()
                if cancelled:
                    raise asyncio.CancelledError from None
                if isinstance(error, TimeoutError):
                    raise DockerError("timeout", "The Docker operation timed out") from None
                raise DockerError("docker_unavailable", "Docker CLI could not be executed") from None

        # With truncated output, suppress the partial line (it may contain part of a secret).
        def decode(buffer: bytearray) -> str:
            value = buffer.decode("utf-8", "replace")
            if truncated:
                value = value.rpartition("\n")[0]
            return _redact(value, secrets)

        output = DockerOutput(process.returncode, decode(buffers[0]), decode(buffers[1]), truncated)
        if output.returncode != 0:
            LOG.warning("Docker command %s failed (rc=%s)", args[0], output.returncode)
            LOG.debug(
                "Docker command %s output: %s", args[0],
                _tail(f"{output.stdout}\n{output.stderr}", self.settings.deployment_log_tail_lines),
            )
        return output

    async def describe_existing_compose(self, checkout: Path, *, deadline: float) -> DockerComposeCandidate:
        """Inspect root Compose inputs without starting resources or returning secrets."""
        checkout = checkout.resolve()
        compose = next((checkout / name for name in (
            "compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml",
        ) if (checkout / name).is_file()), None)
        if compose is None:
            raise DockerError("invalid_compose", "No root Compose file exists")
        with tempfile.TemporaryDirectory(prefix="mooi-compose-") as temporary:
            output = Path(temporary) / "config.json"
            output.touch(mode=0o600)
            empty_env = Path(temporary) / "empty.env"
            empty_env.touch(mode=0o600)
            env_file = checkout / ".env"
            result = await self._run(
                "compose", "--project-directory", str(checkout), "--env-file",
                str(env_file if env_file.is_file() else empty_env), "--file", str(compose),
                "config", "--format", "json", "--output", str(output),
                cwd=checkout, deadline=deadline,
            )
            if result.returncode or result.truncated or re.search(r"variable.*(?:not set|unset)", result.stderr, re.IGNORECASE):
                raise DockerError("invalid_compose", "Existing Compose configuration could not be resolved")
            try:
                model = json.loads(output.read_text())
                services = model["services"]
                if not isinstance(services, dict):
                    raise TypeError
                builds = []
                ports = []
                for name, service in services.items():
                    build = service.get("build")
                    if build is not None:
                        if not isinstance(build, dict):
                            raise ValueError
                        context = Path(build.get("context", str(checkout))).resolve()
                        dockerfile = (context / build.get("dockerfile", "Dockerfile")).resolve()
                        builds.append(DockerComposeBuild(name, context, dockerfile))
                    for port in service.get("ports", []):
                        ports.append(DockerPortRequest(service=name, container_port=int(port["target"]),
                                                       protocol=port.get("protocol", "tcp")))
                return DockerComposeCandidate(tuple(builds), tuple(ports))
            except (OSError, ValueError, TypeError, KeyError, AttributeError):
                raise DockerError("invalid_compose", "Existing Compose configuration is invalid") from None

    async def freeze_compose(
        self, *, manifests: DockerManifests, session_id: UUID, checkout: Path,
        compose_files: tuple[Path, ...], web_service: str,
        environment_files: tuple[Path, ...] = (), deadline: float | None = None,
    ) -> DockerManifest:
        """Resolve once, then publish private immutable config before any engine mutation.

        Callers hold the session operation lock. Port allocation and marking cleanup required
        happen later, before up. No resource is started by config. Secrets remain in the 0600
        effective file, never in captured output, manifest fields or process environment.
        """
        previous = manifests.load(session_id)
        if previous.cleanup_state != "prepared" or previous.compose_files:
            raise DockerError("invalid_compose", "Deployment configuration is already frozen")
        checkout = checkout.resolve()
        if not checkout.is_dir() or not compose_files:
            raise DockerError("invalid_compose", "Compose files and a checkout are required")
        if deadline is None:
            deadline = asyncio.get_running_loop().time() + self.settings.docker_command_timeout_seconds
        directory = manifests.directory(session_id)
        # CLI writes raw config privately: stdout redaction would corrupt application secrets.
        with tempfile.TemporaryDirectory(prefix=".compose-", dir=directory) as temporary:
            output_path = Path(temporary) / "resolved.json"
            output_path.touch(mode=0o600)
            empty_env = Path(temporary) / "empty.env"
            empty_env.touch(mode=0o600)
            args = ["compose", "--project-name", previous.project_name,
                    "--project-directory", str(checkout)]
            env_paths = environment_files or ((checkout / ".env",) if (checkout / ".env").is_file() else ())
            for path in env_paths:
                args.extend(("--env-file", str(_compose_path(str(path), checkout))))
            if not env_paths:
                args.extend(("--env-file", str(empty_env)))
            for path in compose_files:
                args.extend(("--file", str(_compose_path(str(path), checkout))))
            result = await self._run(*args, "config", "--format", "json", "--output",
                                     str(output_path), cwd=checkout, deadline=deadline)
            if (result.returncode or result.truncated
                    or re.search(r"variable.*(?:not set|unset)", result.stderr, re.IGNORECASE)):
                raise DockerError("invalid_compose", "Compose configuration could not be resolved")
            try:
                model = json.loads(manifests._read(output_path))
                if not isinstance(model, dict):
                    raise TypeError
                model = _freeze_compose(model, checkout, previous.project_name, web_service)
                data = json.dumps(_literal_compose(model), ensure_ascii=False).encode()
                name = f"compose-{uuid4().hex}.json"
                frozen = directory / name
                manifests._atomic_write(frozen, data, exclusive=True)
                # Validate the exact frozen representation, with no checkout .env lookup.
                checked = await self._run(
                    "compose", "--project-name", previous.project_name,
                    "--project-directory", str(directory), "--env-file", str(empty_env),
                    "--file", str(frozen), "config", "--quiet", cwd=directory, deadline=deadline,
                )
                if checked.returncode or checked.truncated:
                    raise DockerError("invalid_compose", "Frozen Compose configuration is invalid")
                updated = previous.model_copy(update={
                    "compose_files": (name,), "web_service": web_service,
                    "updated_at": datetime.now(UTC),
                })
                manifests.save(updated)
                return updated
            except (OSError, ValueError, TypeError, AttributeError, DockerManifestError):
                raise DockerError("invalid_compose", "Compose configuration could not be frozen") from None

    @staticmethod
    def _effective(manifests: DockerManifests, manifest: DockerManifest) -> dict:
        try:
            if len(manifest.compose_files) != 1:
                raise ValueError
            model = json.loads(manifests._read(
                manifests.directory(manifest.session_id) / manifest.compose_files[0]))
            if model['name'] != manifest.project_name or not isinstance(model['services'], dict):
                raise ValueError
            return model
        except (OSError, ValueError, KeyError, TypeError):
            raise DockerError('invalid_compose', 'Frozen Compose configuration is unavailable') from None

    @classmethod
    def inspect_builds(
        cls, *, manifests: DockerManifests, manifest: DockerManifest,
    ) -> tuple[DockerComposeBuild, ...]:
        """Return normalized build sources without exposing the effective Compose document."""
        model = cls._effective(manifests, manifest)
        sources = model.get("x-mooi-builds")
        if not isinstance(sources, dict):
            raise DockerError("invalid_compose", "Frozen Compose build metadata is unavailable")
        builds = []
        try:
            for service, source in sources.items():
                if (not isinstance(service, str) or not isinstance(source, dict)
                        or set(source) != {"context", "dockerfile"}
                        or not isinstance(source["context"], str)
                        or not isinstance(source["dockerfile"], str)):
                    raise ValueError
                context = Path(source["context"])
                dockerfile = Path(source["dockerfile"]) if source["dockerfile"] else None
                if not context.is_absolute() or (dockerfile is not None and not dockerfile.is_absolute()):
                    raise ValueError
                builds.append(DockerComposeBuild(
                    service=service, context=context, dockerfile=dockerfile,
                ))
        except (TypeError, ValueError):
            raise DockerError("invalid_compose", "Frozen Compose build metadata is invalid") from None
        return tuple(sorted(builds, key=lambda build: build.service))

    async def _compose(
        self, manifest: DockerManifest, *args: str, deadline: float,
        timeout: float | None = None, on_line: Callable[[str], None] | None = None,
    ) -> DockerOutput:
        directory = Path(manifest.cwd)
        # Never discover .env in the checkout or inherit ambient Compose options.
        with tempfile.NamedTemporaryFile(dir=directory, prefix='.env-') as empty:
            command = ['compose', '--project-name', manifest.project_name,
                       '--project-directory', str(directory), '--env-file', empty.name]
            for name in manifest.compose_files:
                command.extend(('--file', str(directory / name)))
            return await self._run(*command, *args, cwd=directory,
                                   deadline=deadline, timeout=timeout, on_line=on_line)

    async def configure_ports(
        self, *, manifests: DockerManifests, session_id: UUID,
        ports: tuple[DockerPortRequest, ...], deadline: float | None = None,
    ) -> DockerManifest:
        """Replace ALL publications with explicitly requested browser-facing endpoints.

        This is a request, not a reservation: only engine bind during up proves availability.
        DB/cache publications disappear unless explicitly requested by the caller.
        """
        previous = manifests.load(session_id)
        if previous.cleanup_state != 'prepared':
            raise DockerError('invalid_compose', 'Ports cannot change after deployment starts')
        model = self._effective(manifests, previous)
        keys = set()
        for port in ports:
            key = (port.service, port.container_port, port.protocol)
            if port.service not in model['services'] or key in keys:
                raise DockerError('invalid_compose', 'Port requests contain unknown services or duplicates')
            keys.add(key)
        if not any(p.service == previous.web_service and p.protocol == 'tcp' for p in ports):
            raise DockerError('invalid_compose', 'The web service needs a published TCP port')
        for service in model['services'].values():
            service.pop('ports', None)
            if service.get('scale', 1) != 1 or service.get('deploy', {}).get('replicas', 1) != 1:
                raise DockerError('unsupported_project', 'Preview services must use one container each')
        for port in ports:
            entry = {'target': port.container_port, 'protocol': port.protocol,
                     'host_ip': self.settings.preview_bind_address, 'mode': 'ingress'}
            if self.settings.preview_port_range:
                entry['published'] = self.settings.preview_port_range
            model['services'][port.service].setdefault('ports', []).append(entry)
        name = f'compose-{uuid4().hex}.json'
        manifests._atomic_write(manifests.directory(session_id) / name,
                                json.dumps(model).encode(), exclusive=True)
        updated = previous.model_copy(update={'compose_files': (name,), 'ports': (),
                                             'updated_at': datetime.now(UTC)})
        deadline = deadline if deadline is not None else (
            asyncio.get_running_loop().time() + self.settings.docker_command_timeout_seconds)
        checked = await self._compose(updated, 'config', '--quiet', deadline=deadline)
        if checked.returncode or checked.truncated:
            raise DockerError('invalid_compose', 'Dynamic port configuration is invalid')
        manifests.save(updated)
        return updated

    def discard_prepared_configuration(
        self, *, manifests: DockerManifests, session_id: UUID,
    ) -> DockerManifest:
        """Remove a frozen config rejected before any engine resource was created."""
        manifest = manifests.load(session_id)
        if manifest.cleanup_state != "prepared":
            raise DockerError("cleanup_failed", "Active deployment configuration cannot be discarded")
        directory = manifests.directory(session_id)
        try:
            for name in manifest.compose_files:
                path = directory / name
                if path.is_symlink() or not path.is_file():
                    raise OSError
                path.unlink()
        except OSError:
            raise DockerError("cleanup_failed", "Deployment configuration could not be discarded") from None
        prepared = manifest.model_copy(update={
            "compose_files": (), "web_service": None, "ports": (), "updated_at": datetime.now(UTC),
        })
        manifests.save(prepared)
        return prepared

    def _expected_ports(self, model: dict, manifest: DockerManifest) -> set[tuple[str, int, str]]:
        expected = set()
        for name, service in model['services'].items():
            if service.get('scale', 1) != 1 or service.get('deploy', {}).get('replicas', 1) != 1:
                raise DockerError('unsupported_project', 'Preview services must use one container each')
            for port in service.get('ports', []):
                if (not isinstance(port, dict)
                        or type(port.get('target')) is not int
                        or not 1 <= port['target'] <= 65535
                        or port.get('protocol') not in ('tcp', 'udp')
                        or port.get('host_ip') != self.settings.preview_bind_address
                        or port.get('published', '') != self.settings.preview_port_range):
                    raise DockerError('invalid_compose', 'All ports must use managed dynamic allocation')
                key = (name, port['target'], port['protocol'])
                if key in expected:
                    raise DockerError('invalid_compose', 'Duplicate port publication')
                expected.add(key)
        if not any(s == manifest.web_service and p == 'tcp' for s, _, p in expected):
            raise DockerError('invalid_compose', 'Configure managed web ports before starting')
        return expected

    async def _container_ids(self, manifest: DockerManifest, *, deadline: float) -> tuple[str, ...]:
        result = await self._run('ps', '--all', '--quiet', '--no-trunc', '--filter',
                                 f'label=com.docker.compose.project={manifest.project_name}',
                                 cwd=Path(manifest.cwd), deadline=deadline)
        ids = tuple(result.stdout.split())
        if (result.returncode or result.truncated or len(set(ids)) != len(ids)
                or any(not re.fullmatch(r'[0-9a-f]{64}', value) for value in ids)):
            raise DockerError('docker_unavailable', 'Deployment containers could not be listed')
        return ids

    async def inspect(
        self, *, manifests: DockerManifests, session_id: UUID, deadline: float | None = None,
    ) -> DockerManifest:
        """Verify engine ownership and every actual binding; never return raw inspect secrets.

        Does not establish HTTP readiness or mark the deployment running.
        """
        manifest = manifests.load(session_id)
        model = self._effective(manifests, manifest)
        expected = self._expected_ports(model, manifest)
        deadline = deadline if deadline is not None else (
            asyncio.get_running_loop().time() + self.settings.docker_command_timeout_seconds)
        ids = await self._container_ids(manifest, deadline=deadline)
        seen_services = set()
        actual = {}
        bindings = set()
        # Select only operational metadata, never environment, command, or healthcheck logs.
        template = ('{"project":{{json (index .Config.Labels "com.docker.compose.project")}},'
                    '"service":{{json (index .Config.Labels "com.docker.compose.service")}},'
                    '"oneoff":{{json (index .Config.Labels "com.docker.compose.oneoff")}},'
                    '"ports":{{json .NetworkSettings.Ports}}}')
        try:
            for container_id in ids:
                result = await self._run('inspect', '--type', 'container', '--format', template,
                                         container_id, cwd=Path(manifest.cwd), deadline=deadline)
                if result.returncode or result.truncated:
                    raise ValueError
                data = json.loads(result.stdout)
                service = data['service']
                if (data['project'] != manifest.project_name or service not in model['services']
                        or service in seen_services or str(data['oneoff']).lower() != 'false'):
                    raise ValueError
                seen_services.add(service)
                for target, published in (data['ports'] or {}).items():
                    if not published:  # EXPOSE without a host publication.
                        continue
                    number, protocol = target.split('/')
                    key = (service, int(number), protocol)
                    if key not in expected or len(published) != 1 or key in actual:
                        raise ValueError
                    binding = published[0]
                    host_port = int(binding['HostPort'])
                    if ip_address(binding['HostIp']) != ip_address(self.settings.preview_bind_address):
                        raise ValueError
                    if self.settings.preview_port_range:
                        low, high = map(int, self.settings.preview_port_range.split('-'))
                        if not low <= host_port <= high:
                            raise ValueError
                    if (host_port, protocol) in bindings:
                        raise ValueError
                    bindings.add((host_port, protocol))
                    actual[key] = DockerPort(service=service, container_port=int(number),
                                             protocol=protocol, published_port=host_port,
                                             bind_address=self.settings.preview_bind_address)
            if seen_services != set(model['services']) or set(actual) != expected:
                raise ValueError
            if manifest.ports and manifest.ports != tuple(actual[key] for key in sorted(actual)):
                raise ValueError
        except (TypeError, ValueError, KeyError, AttributeError):
            raise DockerError('startup_failed', 'Docker resources or published ports do not match the deployment') from None
        updated = manifest.model_copy(update={'ports': tuple(actual[key] for key in sorted(actual)),
                                              'updated_at': datetime.now(UTC)})
        manifests.save(updated)
        return updated

    async def up(
        self, *, manifests: DockerManifests, session_id: UUID, deadline: float | None = None,
        on_line: Callable[[str], None] | None = None,
    ) -> DockerManifest:
        """Build once, start and inspect, retrying only real host port allocation failures.

        Caller serializes operations; on any failure/cancellation the required manifest stays
        available for rollback. Success is binding evidence, NOT readiness (task 10).

        Build and start output reaches on_line live, and a failure carries a redacted tail in
        `DockerError.detail` so the caller can hand the real cause back to the agent.
        """
        manifest = manifests.load(session_id)
        if manifest.cleanup_state != 'prepared':
            raise DockerError('startup_failed', 'Deployment already requires cleanup')
        self._expected_ports(self._effective(manifests, manifest), manifest)
        deadline = deadline if deadline is not None else (
            asyncio.get_running_loop().time() + self.settings.deployment_timeout_seconds)
        manifest = manifest.model_copy(update={'cleanup_state': 'required',
                                               'updated_at': datetime.now(UTC)})
        manifests.save(manifest)  # Durable ownership BEFORE the first engine mutation.
        tail = self.settings.deployment_log_tail_lines
        built = await self._compose(manifest, 'build', deadline=deadline,
                                    timeout=self.settings.docker_build_timeout_seconds,
                                    on_line=on_line)
        if built.returncode:
            raise DockerError('startup_failed', 'Docker images could not be built',
                              _tail(f'{built.stdout}\n{built.stderr}', tail))
        for attempt in range(self.settings.deployment_port_attempts):
            result = await self._compose(manifest, 'up', '--detach', '--no-build', deadline=deadline,
                                         timeout=self.settings.docker_build_timeout_seconds,
                                         on_line=on_line)
            if not result.returncode:
                return await self.inspect(manifests=manifests, session_id=session_id, deadline=deadline)
            collision = re.search(
                r'port is already allocated|address already in use|no available port|'
                r'all ports.*allocated', result.stdout + result.stderr, re.IGNORECASE)
            if not collision:
                raise DockerError('startup_failed', 'Docker containers could not be started',
                                  _tail(f'{result.stdout}\n{result.stderr}', tail))
            if attempt + 1 == self.settings.deployment_port_attempts:
                raise DockerError('port_unavailable', 'Docker could not allocate the requested host ports',
                                  _tail(f'{result.stdout}\n{result.stderr}', tail))
            # Remove only this project's service containers, preserving networks and named data.
            # Recreation drops failed HostConfig assignments and asks the engine to allocate anew.
            removed = await self._compose(manifest, 'rm', '--stop', '--force', deadline=deadline,
                                          timeout=self.settings.deployment_stop_timeout_seconds)
            if removed.returncode or await self._container_ids(manifest, deadline=deadline):
                raise DockerError('cleanup_failed', 'Conflicting deployment containers could not be removed')
        raise DockerError('port_unavailable', 'Docker could not allocate the requested host ports')

    async def _containers_ready(
        self, manifest: DockerManifest, model: dict, *, deadline: float,
        on_observation: Callable[[str], None] | None = None,
    ) -> bool:
        # Select health status only: healthcheck output can contain project secrets.
        template = ('{"project":{{json (index .Config.Labels "com.docker.compose.project")}},'
                    '"service":{{json (index .Config.Labels "com.docker.compose.service")}},'
                    '"status":{{json .State.Status}},"exit":{{json .State.ExitCode}},'
                    '"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}}}')
        completed = {
            dependency for service in model['services'].values()
            for dependency, options in service.get('depends_on', {}).items()
            if isinstance(options, dict) and options.get('condition') == 'service_completed_successfully'
        }
        seen = set()
        ready = True
        pending: list[str] = []
        try:
            for container_id in await self._container_ids(manifest, deadline=deadline):
                result = await self._run('inspect', '--type', 'container', '--format', template,
                                         container_id, cwd=Path(manifest.cwd), deadline=deadline)
                if result.returncode or result.truncated:
                    raise ValueError
                data = json.loads(result.stdout)
                service = data['service']
                if (data['project'] != manifest.project_name or service not in model['services']
                        or service in seen):
                    raise ValueError
                seen.add(service)
                status, health = data['status'], data['health']
                if service in completed and service != manifest.web_service and status == 'exited' and data['exit'] == 0:
                    continue
                if status in ('exited', 'dead', 'removing'):
                    raise DockerError('startup_failed', 'A deployment container stopped before becoming ready')
                if status not in ('created', 'running', 'paused', 'restarting') or health not in (None, 'starting', 'healthy', 'unhealthy'):
                    raise ValueError
                if service in completed and service != manifest.web_service:
                    ready = False
                    pending.append(f"{service}: {status}/{health or 'no health status'}")
                    continue
                configured = model['services'][service].get('healthcheck', {})
                needs_health = bool(configured) and not configured.get('disable', False) and configured.get('test') != ['NONE']
                service_ready = status == 'running' and (health == 'healthy' or (health is None and not needs_health))
                ready &= service_ready
                if not service_ready:
                    pending.append(f"{service}: {status}/{health or 'no health status'}")
            if on_observation is not None and (pending or seen != set(model['services'])):
                missing = sorted(set(model['services']) - seen)
                on_observation("Container healthchecks pending: " + ", ".join(sorted(pending + missing)))
            return ready and seen == set(model['services'])
        except (TypeError, ValueError, KeyError, AttributeError):
            raise DockerError('startup_failed', 'Container readiness metadata is invalid') from None

    async def check_running(self, *, manifests: DockerManifests, session_id: UUID) -> None:
        """Single bounded inspection of ownership, mappings, state and configured healthchecks."""
        deadline = asyncio.get_running_loop().time() + self.settings.docker_command_timeout_seconds
        async with asyncio.timeout_at(deadline):
            manifest = await self.inspect(manifests=manifests, session_id=session_id, deadline=deadline)
            model = self._effective(manifests, manifest)
            if not await self._containers_ready(manifest, model, deadline=deadline):
                raise DockerError('health_check_failed', 'Deployment containers are no longer healthy')

    async def readiness(
        self, *, manifests: DockerManifests, session_id: UUID, container_port: int,
        path: str = '/', expectation: Literal['html', 'http'] = 'http',
        deadline: float | None = None, on_observation: Callable[[str], None] | None = None,
    ) -> DockerReadiness:
        """Return bounded engine and HTTP evidence for a browser-visible endpoint.

        The caller alone publishes running. No chat state or activity is touched here.
        Redirects count as HTTP responses but are never followed to another endpoint.
        """
        parts = urlsplit(path)
        decoded = unquote(path)
        if (not path.startswith('/') or path.startswith('//') or parts.scheme or parts.netloc
                or parts.fragment or '\\' in decoded or decoded.startswith('//')
                or any(ord(char) <= 32 or ord(char) == 127 for char in decoded)):
            raise DockerError('health_check_failed', 'The preview path must be a local URL path')
        loop = asyncio.get_running_loop()
        end = loop.time() + self.settings.deployment_readiness_timeout_seconds
        if deadline is not None:
            if not math.isfinite(deadline):
                raise ValueError('Docker deadline must be finite')
            # Finish the phase just before the operation timeout so a specific readiness
            # diagnosis wins over the outer generic deadline.
            end = min(end, max(loop.time(), deadline - 0.05))
        last_observation: str | None = None

        def observe(value: str) -> None:
            nonlocal last_observation
            if value == last_observation:
                return
            last_observation = value
            if on_observation is not None:
                try:
                    on_observation(value)
                except Exception:
                    LOG.debug('Readiness observation callback failed', exc_info=True)
        manifest = manifests.load(session_id)
        if manifest.cleanup_state != 'required':
            raise DockerError('startup_failed', 'Deployment is not awaiting readiness')
        model = self._effective(manifests, manifest)
        matches = [p for p in manifest.ports if p.service == manifest.web_service
                   and p.container_port == container_port and p.protocol == 'tcp']
        if len(matches) != 1:
            raise DockerError('health_check_failed', 'The preview endpoint is not a verified web port')
        def url(host: str) -> str:
            authority = f'[{host}]' if ':' in host else host
            return f'{self.settings.preview_scheme}://{authority}:{matches[0].published_port}{path}'
        try:
            async with asyncio.timeout_at(end):
                async with httpx.AsyncClient(trust_env=False, follow_redirects=False) as client:
                    while True:
                        await self.inspect(manifests=manifests, session_id=session_id, deadline=end)
                        if await self._containers_ready(manifest, model, deadline=end,
                                                        on_observation=observe):
                            try:
                                async with client.stream('GET', url(self.settings.preview_probe_host),
                                                         timeout=self.settings.deployment_probe_timeout_seconds) as response:
                                    status_code = response.status_code
                                    raw_content_type = response.headers.get('content-type')
                                    content_type = (raw_content_type.split(';', 1)[0].strip().lower()
                                                    if raw_content_type else None)
                                    accepted = 200 <= status_code < 400
                                    html = False
                                    if expectation == 'html' and accepted:
                                        body = bytearray()
                                        async for chunk in response.aiter_bytes():
                                            body.extend(chunk[:max(0, 4096 - len(body))])
                                            if len(body) >= 4096:
                                                break
                                        prefix = bytes(body).decode('utf-8', 'ignore').lower()
                                        html = (content_type in ('text/html', 'application/xhtml+xml')
                                                and ('<!doctype html' in prefix or '<html' in prefix))
                                    if not accepted:
                                        observe(f'GET {path} returned HTTP {status_code}')
                                    elif expectation == 'html' and content_type not in (
                                        'text/html', 'application/xhtml+xml',
                                    ):
                                        observe(f'GET {path} returned {content_type or "no content type"}; HTML preview required')
                                    elif expectation == 'html' and not html:
                                        observe(f'GET {path} did not return an HTML document')
                                    else:
                                        observe(f'GET {path} returned HTTP {status_code}')
                                if (accepted and (expectation == 'http' or html)
                                        and await self._containers_ready(manifest, model, deadline=end)):
                                    await self.inspect(manifests=manifests, session_id=session_id, deadline=end)
                                    return DockerReadiness(
                                        preview_url=url(self.settings.preview_public_host),
                                        status_code=status_code, content_type=content_type,
                                        expectation=expectation,
                                    )
                            except httpx.HTTPError:
                                observe(f'No HTTP response received from GET {path}')
                        await asyncio.sleep(min(1, max(0, end - loop.time())))
        except TimeoutError:
            if last_observation and not last_observation.startswith('No HTTP response'):
                raise DockerError(
                    'health_check_failed', 'Deployment endpoint did not satisfy readiness',
                    detail=last_observation,
                ) from None
            raise DockerError(
                'timeout', 'Deployment readiness timed out',
                detail='No HTTP response was received before the readiness deadline',
            ) from None

    async def down(
        self, *, manifests: DockerManifests, session_id: UUID, deadline: float | None = None,
    ) -> DockerManifest:
        """Stop only this project using its frozen configuration, retaining named data.

        Caller cancels/joins any start first and serializes mutations. Absence is verified
        even for a previously stopped manifest; failures keep the recovery record.
        """
        manifest = manifests.load(session_id)
        end = asyncio.get_running_loop().time() + self.settings.deployment_stop_timeout_seconds
        if deadline is not None:
            if not math.isfinite(deadline):
                raise ValueError('Docker deadline must be finite')
            end = min(end, deadline)
        pending = manifest.model_copy(update={'cleanup_state': 'required',
                                              'updated_at': datetime.now(UTC)})
        manifests.save(pending)
        try:
            if manifest.compose_files:
                self._effective(manifests, manifest)
                # The grace period has to fit inside the exec budget with room for the SIGKILL
                # and Compose's own removal work: a container that ignores SIGTERM — `CMD npm
                # start` and every other shell PID 1 — would otherwise always outlive the call
                # and turn a normal stop into cleanup_failed.
                grace = max(1, int(self.settings.deployment_stop_timeout_seconds // 2))
                result = await self._compose(manifest, 'down', '--remove-orphans',
                                             '--timeout', str(grace),
                                             deadline=end, timeout=self.settings.deployment_stop_timeout_seconds)
                if result.returncode:
                    raise DockerError('cleanup_failed', 'Deployment containers could not be stopped')
            if await self._container_ids(manifest, deadline=end):
                raise DockerError('cleanup_failed', 'Deployment containers remain after stopping')
        except (DockerError, asyncio.CancelledError):
            manifests.save(pending.model_copy(update={'cleanup_state': 'failed',
                                                       'updated_at': datetime.now(UTC)}))
            raise
        stopped = pending.model_copy(update={'cleanup_state': 'stopped', 'ports': (),
                                              'updated_at': datetime.now(UTC)})
        manifests.save(stopped)
        return stopped

    async def rearm(self, *, manifests: DockerManifests, session_id: UUID) -> DockerManifest:
        """Return a stopped deployment to `prepared` so the same operation can configure again.

        Engine absence is already proven by `down`; only the frozen Compose files are dropped,
        keeping ownership, private environment files and named data. Touches no engine resource.
        """
        manifest = manifests.load(session_id)
        if manifest.cleanup_state != 'stopped':
            raise DockerError('cleanup_failed', 'Deployment resources must be stopped before rearming')
        directory = manifests.directory(session_id)
        try:
            for name in manifest.compose_files:
                path = directory / name
                if path.is_symlink() or not path.exists():
                    continue
                if not stat.S_ISREG(path.lstat().st_mode):
                    raise DockerError('cleanup_failed', 'Invalid deployment configuration file type')
                path.unlink()
        except OSError:
            raise DockerError('cleanup_failed', 'Deployment configuration could not be removed') from None
        rearmed = manifest.model_copy(update={
            'cleanup_state': 'prepared', 'compose_files': (), 'web_service': None, 'ports': (),
            'updated_at': datetime.now(UTC)})
        manifests.save(rearmed)
        return rearmed

    async def _resource_names(
        self, manifest: DockerManifest, kind: Literal['volume', 'network'], *, deadline: float,
    ) -> tuple[str, ...]:
        result = await self._run(kind, 'ls', '--filter',
                                 f'label=com.docker.compose.project={manifest.project_name}',
                                 '--format', '{{.Name}}', cwd=Path(manifest.cwd), deadline=deadline)
        names = tuple(result.stdout.split())
        if (result.returncode or result.truncated or len(set(names)) != len(names)
                or any(not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]*', name) for name in names)):
            raise DockerError('cleanup_failed', 'Deployment resources could not be listed')
        return names

    async def cleanup(
        self, *, manifests: DockerManifests, session_id: UUID, deadline: float | None = None,
    ) -> None:
        """Final session cleanup, including owned data. Never prune or remove images.

        Caller cancels/joins start and serializes this with all session mutations.
        A missing record is idempotent; a corrupt record is retained and fails closed.
        """
        directory = manifests.directory(session_id)
        if not directory.exists():
            return
        manifest = manifests.load(session_id)
        end = asyncio.get_running_loop().time() + self.settings.deployment_stop_timeout_seconds
        if deadline is not None:
            if not math.isfinite(deadline):
                raise ValueError('Docker deadline must be finite')
            end = min(end, deadline)
        try:
            manifest = await self.down(manifests=manifests, session_id=session_id, deadline=end)
            for kind in ('volume', 'network'):
                for name in await self._resource_names(manifest, kind, deadline=end):
                    result = await self._run(kind, 'inspect', '--format', '{{json .Labels}}', name,
                                             cwd=directory, deadline=end)
                    try:
                        labels = json.loads(result.stdout)
                        key = labels[f'com.docker.compose.{kind}']
                        owned = (labels['com.docker.compose.project'] == manifest.project_name
                                 and isinstance(key, str) and bool(key)
                                 and name == f'{manifest.project_name}_{key}')
                    except (TypeError, ValueError, KeyError):
                        owned = False
                    if result.returncode or result.truncated or not owned:
                        raise DockerError('cleanup_failed', 'Deployment resource ownership could not be verified')
                    result = await self._run(kind, 'rm', name, cwd=directory, deadline=end)
                    if result.returncode:
                        raise DockerError('cleanup_failed', 'Deployment resource could not be removed')
            if (await self._container_ids(manifest, deadline=end)
                    or await self._resource_names(manifest, 'volume', deadline=end)
                    or await self._resource_names(manifest, 'network', deadline=end)):
                raise DockerError('cleanup_failed', 'Deployment resources remain after cleanup')
            manifests._remove_stopped(session_id)
        except (DockerError, DockerManifestError, asyncio.CancelledError):
            current = manifests.load(session_id)
            manifests.save(current.model_copy(update={'cleanup_state': 'failed',
                                                       'updated_at': datetime.now(UTC)}))
            raise

    async def preflight(self, *, cwd: Path, deadline: float | None = None) -> DockerPreflight:
        """Check Compose v2+ and reach the configured daemon, without creating resources."""
        if deadline is None:
            deadline = asyncio.get_running_loop().time() + self.settings.docker_command_timeout_seconds
        compose = await self._run("compose", "version", "--short", cwd=cwd, deadline=deadline)
        version = compose.stdout.strip()
        match = re.fullmatch(r"v?(\d+)\.\d+\.\d+(?:[-+][\w.-]+)?", version)
        if compose.returncode or compose.truncated or not match or int(match[1]) < 2:
            raise DockerError("docker_unavailable", "Docker Compose v2 or newer must be installed")
        engine = await self._run("version", "--format", "{{json .Server}}", cwd=cwd, deadline=deadline)
        try:
            server = json.loads(engine.stdout)
            engine_version = server["Version"]
            valid = isinstance(engine_version, str) and bool(re.fullmatch(r"[\w.+-]{1,100}", engine_version))
        except (TypeError, ValueError, KeyError):
            valid = False
        if engine.returncode or engine.truncated or not valid:
            raise DockerError("docker_unavailable", "The configured Docker daemon is unavailable")
        return DockerPreflight(engine_version=engine_version, compose_version=version)


async def _dev_command(command: str) -> int:
    """Makefile-only maintenance; cleanup requires the service to be stopped first."""
    # Maintenance does not authenticate to Mooi or require provider credentials.
    settings = Settings()
    docker = Docker(settings)
    if command == "preflight":
        await docker.preflight(cwd=Path.cwd())
        print("Deployment Docker preflight passed")
        return 0

    directory = settings.workspace_root / "deployments"
    if not directory.exists() and not directory.is_symlink():
        print("No deployment records to clean")
        return 0
    manifests = DockerManifests(settings.workspace_root)
    failed = 0
    for session_id in manifests.session_ids():
        try:
            manifests.load(session_id)
            await docker.cleanup(manifests=manifests, session_id=session_id)
        except (DockerError, DockerManifestError, OSError):
            failed += 1
            print(f"Deployment {session_id}: cleanup failed; records and workspace retained")
    if failed:
        print("Restore Docker/records and retry make dev-stop-mic-sessions")
        return 1
    print("Managed deployments cleaned; workspaces and shared images retained")
    return 0


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Managed deployment maintenance via the root Makefile")
    parser.add_argument("command", choices=("preflight", "cleanup"))
    try:
        raise SystemExit(asyncio.run(_dev_command(parser.parse_args().command)))
    except DockerError as error:
        print(f"Deployment maintenance failed ({error.code}); check DOCKER_BINARY, DOCKER_HOST and Compose v2")
        raise SystemExit(1) from None
    except (DockerManifestError, OSError, ValueError):
        # Never expose Compose content, private paths, environment or subprocess output.
        print("Deployment maintenance failed; check Docker configuration and preserved records")
        raise SystemExit(1) from None
