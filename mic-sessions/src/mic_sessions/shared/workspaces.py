"""Session-owned Git clones, ephemeral credentials and index-preserving diffs.

Only marked directories in sessions/<UUID> belong to this implementation.
Legacy caches, workspaces and reservations are never reconciled.
"""

from __future__ import annotations

import asyncio
import base64
import difflib
import logging
import os
import re
import shutil
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from uuid import UUID

from mic_sessions.shared.env import get_settings
from mic_sessions.shared.mooi import Project
from mic_sessions.shared.web import ApiException

LOG = logging.getLogger("sessions")

_BRANCH_PATTERN = re.compile(r"^[A-Za-z0-9._\-/]{1,120}$")
_CREDENTIAL_PATTERN = re.compile(r"//[^/@\s]*@")
_NO_CREDENTIAL_HELPER = ("-c", "credential.helper=")


@dataclass(frozen=True)
class SessionWorkspace:
    """An isolated checkout of a repository, owned by exactly one session."""

    path: Path
    base_commit: str


@dataclass(frozen=True)
class WorkspaceInspection:
    """What a clone looks like on disk right now: its checked-out ref, size and pending edits."""

    head_commit: str | None
    head_branch: str | None
    dirty_files: int
    size_bytes: int


@dataclass(frozen=True)
class ChangedFile:
    path: str
    change: str
    added: int
    removed: int


@dataclass(frozen=True)
class ChangesSummary:
    files: list[ChangedFile]
    added: int
    removed: int


_CHANGE_KINDS = {"A": "added", "M": "modified", "D": "deleted", "R": "renamed", "C": "renamed", "T": "modified"}


def _redact(text: str) -> str:
    return _CREDENTIAL_PATTERN.sub("//***@", text)


def _directory_size(directory: Path) -> int:
    """Apparent size of every regular file below `directory`, never following symlinks."""
    total = 0
    for root, _, files in os.walk(directory, followlinks=False):
        for name in files:
            try:
                stat = os.lstat(os.path.join(root, name))
            except OSError:
                continue
            total += stat.st_size
    return total


class Workspaces:
    """Owns the on-disk layout and every git invocation made by this service."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = (root or get_settings().workspace_root).resolve()

    def workspace_path(self, session_id: UUID) -> Path:
        return self.root / "sessions" / str(session_id) / "repository"

    def _session_directory(self, session_id: UUID) -> Path:
        directory = self.workspace_path(session_id).parent
        if directory.parent.is_symlink() or directory.is_symlink():
            raise RuntimeError("Refusing a symlink in the managed session path")
        if directory.resolve() != directory:
            raise RuntimeError("Session path is outside the managed root")
        return directory

    # --- git ----------------------------------------------------------------------------------

    async def _run(self, *args: str, cwd: Path | None = None, auth: str | None = None) -> tuple[int, str, str]:
        """Runs one git command to completion and returns `(exit code, stdout, redacted stderr)`."""
        settings = get_settings()
        env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
        if auth:
            encoded = base64.b64encode(f"x-access-token:{auth}".encode()).decode()
            env.update({"GIT_CONFIG_COUNT": "2", "GIT_CONFIG_KEY_0": "credential.helper",
                        "GIT_CONFIG_VALUE_0": "", "GIT_CONFIG_KEY_1": "http.https://github.com/.extraheader",
                        "GIT_CONFIG_VALUE_1": f"Authorization: Basic {encoded}"})
        process = await asyncio.create_subprocess_exec(
            settings.git_binary,
            *args,
            cwd=str(cwd) if cwd else None,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), settings.git_timeout_seconds)
        except (TimeoutError, asyncio.CancelledError) as error:
            if process.returncode is None:
                process.kill()
            await process.wait()
            if isinstance(error, asyncio.CancelledError):
                raise
            raise ApiException.bad_gateway("The git command timed out") from None

        detail = _redact(stderr.decode("utf-8", "replace").strip())
        if auth:
            detail = detail.replace(auth, "***").replace(encoded, "***")
        return process.returncode or 0, stdout.decode("utf-8", "replace"), detail

    async def _git(self, *args: str, cwd: Path | None = None, auth: str | None = None) -> str:
        """Runs one git command and returns its stdout, failing the request on a non-zero exit."""
        code, stdout, detail = await self._run(*args, cwd=cwd, auth=auth)
        if code != 0:
            LOG.warning("git %s failed with %s: %s", args[0], code, detail or "no output")
            raise ApiException.bad_gateway(detail or "The git command failed")
        return stdout

    async def _git_ok(self, *args: str, cwd: Path | None = None) -> bool:
        """Runs one git command for its exit code alone, tolerating failure."""
        code, _, detail = await self._run(*args, cwd=cwd)
        if code != 0 and detail:
            LOG.info("git %s exited with %s: %s", args[0], code, detail)
        return code == 0

    async def validate_branch(self, branch: str) -> None:
        """Rejects anything git would not accept as a branch name, or would read as an option."""
        if not _BRANCH_PATTERN.match(branch) or branch.startswith("-"):
            raise ApiException.bad_request("Invalid branch name")
        if not await self._git_ok("check-ref-format", "--branch", branch):
            raise ApiException.bad_request("Invalid branch name")

    async def create_workspace(
        self, project: Project, session_id: UUID, branch: str, token: str,
    ) -> SessionWorkspace:
        await self.validate_branch(branch)
        await self.validate_branch(project.default_branch)
        directory = self._session_directory(session_id)
        directory.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation prevents one attempt from deleting another's workspace.
        directory.mkdir()
        try:
            (directory / ".mooi-session").write_text(str(session_id))
            path = directory / "repository"
            url = f"https://github.com/{project.full_name}.git"
            await self._git(*_NO_CREDENTIAL_HELPER, "clone", "--no-checkout", url, str(path), auth=token)
            remote = f"refs/remotes/origin/{branch}"
            if await self._git_ok("-C", str(path), "show-ref", "--verify", "--quiet", remote):
                await self._git("-C", str(path), "checkout", "-B", branch, "--track", f"origin/{branch}")
            else:
                await self._git("-C", str(path), "checkout", "--no-track", "-b", branch,
                                f"refs/remotes/origin/{project.default_branch}")
            base_commit = (await self._git("-C", str(path), "rev-parse", "HEAD")).strip()
            LOG.info("Workspace %s created on %s at %s", session_id, branch, base_commit[:7])
            return SessionWorkspace(path=path, base_commit=base_commit)
        except BaseException:
            # Git has stopped before cleanup begins. Await the deletion even if cancelled again.
            await self._remove_directory(directory)
            raise

    async def _remove_directory(self, directory: Path) -> None:
        def remove() -> None:
            # Keep ownership evidence until all potentially large deletions succeed.
            # A failed/terminated removal can then be retried at startup.
            marker = directory / ".mooi-session"
            for child in directory.iterdir():
                if child == marker:
                    continue
                if child.is_dir() and not child.is_symlink():
                    shutil.rmtree(child)
                else:
                    child.unlink()
            marker.unlink(missing_ok=True)
            directory.rmdir()

        task = asyncio.create_task(asyncio.to_thread(remove))
        cancelled = False
        while not task.done():
            try:
                await asyncio.shield(task)
            except asyncio.CancelledError:
                cancelled = True
            except Exception:
                LOG.debug("Background operation encountered an exception", exc_info=True)
                break
        try:
            task.result()
        except Exception:
            LOG.exception("Workspace cleanup failed for %s", directory)
            raise
        if cancelled:
            raise asyncio.CancelledError

    async def remove_workspace(self, session_id: UUID) -> None:
        directory = self._session_directory(session_id)
        if not directory.exists():
            return
        marker = directory / ".mooi-session"
        if marker.is_symlink() or not marker.is_file() or marker.read_text() != str(session_id):
            raise RuntimeError("Refusing to remove an unowned session directory")
        await self._remove_directory(directory)
        LOG.info("Workspace %s removed", session_id)

    async def reconcile(self, *, preserve: set[UUID] | None = None) -> None:
        """Remove marked leftovers except sessions whose deployment cleanup failed at boot."""
        preserved = preserve or set()
        sessions = self.root / "sessions"
        if sessions.is_symlink():
            raise RuntimeError("Managed sessions root cannot be a symlink")
        if not sessions.exists():
            return
        for directory in sessions.iterdir():
            try:
                session_id = UUID(directory.name)
            except ValueError:
                continue
            if (session_id in preserved or str(session_id) != directory.name
                    or directory.is_symlink() or not directory.is_dir()):
                continue
            marker = directory / ".mooi-session"
            if marker.is_file() and not marker.is_symlink() and marker.read_text() == str(session_id):
                await self.remove_workspace(session_id)

    # --- inspection ------------------------------------------------------------------------------

    async def inspect(self, workspace: Path) -> WorkspaceInspection:
        """Best-effort snapshot of a clone; every probe tolerates failure so one broken clone never
        hides the rest of an overview."""
        if not workspace.is_dir():
            return WorkspaceInspection(head_commit=None, head_branch=None, dirty_files=0, size_bytes=0)
        head_code, head, _ = await self._run("-C", str(workspace), "rev-parse", "HEAD")
        branch_code, branch, _ = await self._run("-C", str(workspace), "rev-parse", "--abbrev-ref", "HEAD")
        status_code, status, _ = await self._run(
            "-C", str(workspace), "status", "--porcelain", "-z", "--untracked-files=all"
        )
        dirty = 0
        if status_code == 0:
            fields = [field for field in status.split("\0") if field]
            i = 0
            while i < len(fields):
                # A rename/copy entry carries its source path as the next field.
                i += 2 if fields[i][:1] in ("R", "C") else 1
                dirty += 1
        size = await asyncio.to_thread(_directory_size, workspace.parent)
        return WorkspaceInspection(
            head_commit=(head.strip() or None) if head_code == 0 else None,
            head_branch=(branch.strip() or None) if branch_code == 0 else None,
            dirty_files=dirty,
            size_bytes=size,
        )

    # --- diffs ----------------------------------------------------------------------------------

    async def _numstat(self, workspace: Path, base_commit: str) -> dict[str, tuple[int, int]]:
        """Maps each changed path to `(added, removed)`, using `-z` so a renamed path's two names
        arrive as separate NUL-terminated fields instead of an ambiguous `old => new` string."""
        raw = await self._git("-C", str(workspace), "diff", "--numstat", "-M", "-z", base_commit)
        fields = raw.split("\0")
        counts: dict[str, tuple[int, int]] = {}
        i = 0
        while i < len(fields) and fields[i]:
            added_raw, removed_raw, path = fields[i].split("\t", 2)
            added = 0 if added_raw == "-" else int(added_raw)
            removed = 0 if removed_raw == "-" else int(removed_raw)
            i += 1
            if path == "":
                # Rename/copy: the old and new paths follow as their own NUL-terminated fields.
                i += 1  # old path, unused
                path = fields[i]
                i += 1
            counts[path] = (added, removed)
        return counts

    async def _name_status(self, workspace: Path, base_commit: str) -> list[tuple[str, str]]:
        """Lists `(status, final_path)` pairs; `status` is the first letter of git's status code."""
        raw = await self._git("-C", str(workspace), "diff", "--name-status", "-M", "-z", base_commit)
        fields = [field for field in raw.split("\0") if field != ""]
        entries: list[tuple[str, str]] = []
        i = 0
        while i < len(fields):
            status = fields[i]
            i += 1
            if status[0] in ("R", "C"):
                i += 1  # old path, unused
                entries.append((status, fields[i]))
            else:
                entries.append((status, fields[i]))
            i += 1
        return entries

    async def changes(self, workspace: Path, base_commit: str) -> ChangesSummary:
        """Read tracked and untracked changes without touching the workspace index."""
        counts = await self._numstat(workspace, base_commit)
        statuses = await self._name_status(workspace, base_commit)

        untracked = list(
            filter(
                None,
                (
                    await self._git(
                        "-C", str(workspace), "ls-files", "--others", "--exclude-standard", "-z"
                    )
                ).split("\0"),
            )
        )
        deleted = [path for status, path in statuses if status[0] == "D"]
        renamed_from: set[str] = set()
        renamed_to: set[str] = set()
        renamed_counts: dict[str, tuple[int, int]] = {}
        for path in untracked:
            target_hash = await self._git("-C", str(workspace), "hash-object", "--", path)
            for old_path in deleted:
                if old_path in renamed_from:
                    continue
                base_hash = await self._git("-C", str(workspace), "rev-parse", f"{base_commit}:{old_path}")
                if target_hash.strip() == base_hash.strip():
                    renamed_from.add(old_path)
                    renamed_to.add(path)
                    renamed_counts[path] = (0, 0)
                    break
                try:
                    old_text = await self._git("-C", str(workspace), "show", f"{base_commit}:{old_path}")
                    new_text = await asyncio.to_thread((workspace / path).read_text, encoding="utf-8")
                except (ApiException, OSError, UnicodeError):
                    continue
                old_lines = old_text.splitlines()
                new_lines = new_text.splitlines()
                matcher = difflib.SequenceMatcher(None, old_lines, new_lines)
                similarity = matcher.ratio()
                if similarity < 0.6:
                    continue
                added = 0
                removed = 0
                for opcode, old_start, old_end, new_start, new_end in matcher.get_opcodes():
                    if opcode in ("replace", "delete"):
                        removed += old_end - old_start
                    if opcode in ("replace", "insert"):
                        added += new_end - new_start
                renamed_from.add(old_path)
                renamed_to.add(path)
                renamed_counts[path] = (added, removed)
                break

        files = [
            ChangedFile(
                path=path,
                change=_CHANGE_KINDS.get(status[0], "modified"),
                added=counts.get(path, (0, 0))[0],
                removed=counts.get(path, (0, 0))[1],
            )
            for status, path in statuses
            if path not in renamed_from
        ]
        for path in untracked:
            diff = await self.file_diff(workspace, base_commit, path)
            added = sum(line.startswith("+") and not line.startswith("+++") for line in diff.splitlines())
            rename_added, rename_removed = renamed_counts.get(path, (0, 0))
            files.append(
                ChangedFile(
                    path=path,
                    change="renamed" if path in renamed_to else "added",
                    added=rename_added if path in renamed_to else added,
                    removed=rename_removed,
                )
            )
        return ChangesSummary(
            files=files,
            added=sum(file.added for file in files),
            removed=sum(file.removed for file in files),
        )

    async def file_diff(self, workspace: Path, base_commit: str, path: str) -> str:
        """Returns the unified diff of one file, rejecting a path that escapes the workspace."""
        relative = Path(path)
        if relative.is_absolute() or ".." in relative.parts:
            raise ApiException.bad_request("Invalid file path")
        target = workspace / relative
        if not target.resolve().is_relative_to(workspace.resolve()):
            raise ApiException.bad_request("Invalid file path")
        untracked = await self._git("-C", str(workspace), "ls-files", "--others", "--exclude-standard", "-z", "--", path)
        if path in untracked.split("\0"):
            code, diff, _ = await self._run("diff", "--no-index", "--", "/dev/null", path, cwd=workspace)
            if code not in (0, 1):
                raise ApiException.bad_gateway("Could not read untracked file diff")
            return diff
        return await self._git("-C", str(workspace), "diff", base_commit, "--", relative.as_posix())


@lru_cache
def get_workspaces() -> Workspaces:
    return Workspaces()


async def create_workspace(
    project: Project, session_id: UUID, branch: str, token: str,
) -> SessionWorkspace:
    return await get_workspaces().create_workspace(project, session_id, branch, token)


async def remove_workspace(session_id: UUID) -> None:
    await get_workspaces().remove_workspace(session_id)


async def inspect(workspace: Path) -> WorkspaceInspection:
    return await get_workspaces().inspect(workspace)


async def changes(workspace: Path, base_commit: str) -> ChangesSummary:
    return await get_workspaces().changes(workspace, base_commit)


async def file_diff(workspace: Path, base_commit: str, path: str) -> str:
    return await get_workspaces().file_diff(workspace, base_commit, path)
