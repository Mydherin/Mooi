"""Transversal aspect: running a platform-stored bash script.

Deploy, backup, restore and delete scripts live only in the platform: each one is fed to `bash -se`
through stdin (never written to disk), runs in its own process group with an explicit environment,
and its output is redacted line by line and handed over in small batches. Every exit path — success,
failure, timeout or cancellation — terminates the whole process group.
"""

from __future__ import annotations

import asyncio
import os
import signal
from collections.abc import Callable
from contextlib import suppress
from pathlib import Path

_BATCH_LINES = 50
_BATCH_SECONDS = 0.25
_LINE_LIMIT = 2000
_TERMINATE_GRACE_SECONDS = 5


async def _terminate(process: asyncio.subprocess.Process) -> None:
    if process.returncode is not None:
        return
    with suppress(ProcessLookupError):
        os.killpg(process.pid, signal.SIGTERM)
    try:
        await asyncio.wait_for(process.wait(), _TERMINATE_GRACE_SECONDS)
    except TimeoutError:
        with suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGKILL)
        await process.wait()


async def run_script(script: str, *, cwd: Path, environment: dict[str, str], timeout: float,
                     redact: Callable[[str], str], on_output: Callable[[list[str]], None]) -> int:
    """Runs `script` and answers its exit code; raises `TimeoutError` once `timeout` seconds pass.
    Output reaches `on_output` at most every 50 lines or 250 ms, and always before this returns."""
    process = await asyncio.create_subprocess_exec(
        "bash", "-se", cwd=cwd, stdin=asyncio.subprocess.PIPE, env=environment,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, start_new_session=True,
    )
    loop = asyncio.get_running_loop()
    pending: list[str] = []
    last_flush = loop.time()

    def flush() -> None:
        nonlocal pending, last_flush
        if pending:
            on_output(pending)
            pending = []
        last_flush = loop.time()

    async def feed() -> None:
        assert process.stdin is not None
        process.stdin.write(script.encode())
        await process.stdin.drain()
        process.stdin.close()

    writer = asyncio.create_task(feed())
    try:
        async with asyncio.timeout(timeout):
            assert process.stdout is not None
            while chunk := await process.stdout.readline():
                line = redact(chunk.decode("utf-8", "replace")).rstrip()[:_LINE_LIMIT]
                if line.strip():
                    pending.append(line)
                if len(pending) >= _BATCH_LINES or (pending and loop.time() - last_flush >= _BATCH_SECONDS):
                    flush()
            code = await process.wait()
            # A script may exit before reading all of itself; its exit code is what counts.
            with suppress(BrokenPipeError, ConnectionResetError):
                await writer
        return code
    finally:
        flush()
        if not writer.done():
            writer.cancel()
        with suppress(asyncio.CancelledError, BrokenPipeError, ConnectionResetError):
            await writer
        await _terminate(process)
