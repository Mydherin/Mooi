"""Preview proxy: the application sees the public request (Host, forwarding headers, redirects)."""

from __future__ import annotations

import asyncio
import os
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import uuid4

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret!")
os.environ.setdefault("SERVICE_TOKEN", "test-token")

from websockets.asyncio.server import ServerConnection, serve  # noqa: E402
from websockets.http11 import Request  # noqa: E402

from mic_sessions.shared import previews  # noqa: E402

PUBLIC = b"mooi.example"


# --- harness --------------------------------------------------------------------------------------


class FakeHttpUpstream:
    """Records the raw request head and answers with fixed headers."""

    def __init__(self, status: int = 200, headers: list[tuple[str, str]] | None = None) -> None:
        self.status, self.headers = status, headers or []
        self.heads: list[bytes] = []

    async def handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        self.heads.append(await reader.readuntil(b"\r\n\r\n"))
        lines = [f"HTTP/1.1 {self.status} X", "Content-Length: 0", "Connection: close"]
        lines += [f"{key}: {value}" for key, value in self.headers]
        writer.write(("\r\n".join(lines) + "\r\n\r\n").encode("latin-1"))
        await writer.drain()
        writer.close()

    def received(self) -> list[tuple[bytes, bytes]]:
        lines = self.heads[-1].split(b"\r\n")[1:]
        return [(key.strip().lower(), value.strip()) for key, _, value in
                (line.partition(b":") for line in lines if line)]


def _run(test: Callable[[], Awaitable[Any]]) -> Any:
    async def main() -> Any:
        try:
            return await test()
        finally:
            await previews.close()
    return asyncio.run(main())


def _publish(port: int) -> str:
    label = previews.reserve()
    previews.publish(uuid4(), label, f"http://127.0.0.1:{port}")
    return label


async def _http(label: str, path: str, headers: list[tuple[bytes, bytes]]) -> list[dict[str, Any]]:
    async def app(*_: Any) -> None:
        raise AssertionError("not a preview path")

    sent: list[dict[str, Any]] = []
    messages = iter([{"type": "http.request", "body": b"", "more_body": False}])

    async def receive() -> dict[str, Any]:
        try:
            return next(messages)
        except StopIteration:
            await asyncio.Event().wait()
            raise

    async def send(message: dict[str, Any]) -> None:
        sent.append(message)

    full = f"/preview/{label}{path}"
    scope = {"type": "http", "method": "GET", "scheme": "http", "path": full, "raw_path": full.encode(),
             "query_string": b"", "headers": headers, "client": ("10.0.0.2", 5000)}
    await previews.PreviewGateway(app)(scope, receive, send)
    return sent


async def _http_through(upstream: FakeHttpUpstream, path: str,
                        headers: list[tuple[bytes, bytes]]) -> list[dict[str, Any]]:
    server = await asyncio.start_server(upstream.handle, "127.0.0.1", 0)
    async with server:
        label = _publish(server.sockets[0].getsockname()[1])
        return await _http(label, path, headers)


def _values(headers: list[tuple[bytes, bytes]], name: bytes) -> list[bytes]:
    return [value for key, value in headers if key.lower() == name]


# --- public host ----------------------------------------------------------------------------------


@pytest.mark.parametrize(("forwarded", "expected"), [
    (b"mooi.example", b"mooi.example"),
    (b"a.com, b.internal", b"a.com"),
    (b" a.com ,b.internal", b"a.com"),
    (b"1.2.3.4:8443", b"1.2.3.4:8443"),
    (b"[::1]:8443", b"[::1]:8443"),
    (b"evil.com\r\nX-Injected: 1", b"mic-sessions"),
    (b"evil .com", b"mic-sessions"),
    (b"evil.com/path", b"mic-sessions"),
    (b"user@evil.com", b"mic-sessions"),
    (b"", b"mic-sessions"),
    (None, b"mic-sessions"),
])
def test_public_host(forwarded: bytes | None, expected: bytes) -> None:
    headers = [(b"host", b"mic-sessions")] + ([(b"x-forwarded-host", forwarded)] if forwarded is not None else [])
    assert previews._public_host({"headers": headers}) == expected


# --- HTTP -----------------------------------------------------------------------------------------


def test_http_sends_public_host_once() -> None:
    upstream = FakeHttpUpstream()
    _run(lambda: _http_through(upstream, "/", [(b"host", b"mic-sessions"), (b"x-forwarded-host", PUBLIC)]))
    received = upstream.received()
    assert _values(received, b"host") == [PUBLIC]
    assert _values(received, b"x-forwarded-host") == [PUBLIC]


def test_http_without_forwarded_host_keeps_host() -> None:
    upstream = FakeHttpUpstream()
    _run(lambda: _http_through(upstream, "/", [(b"host", b"localhost:8000")]))
    received = upstream.received()
    assert _values(received, b"host") == [b"localhost:8000"]
    assert _values(received, b"x-forwarded-host") == [b"localhost:8000"]


@pytest.mark.parametrize(("forwarded", "expected"), [
    (b"mooi.example, gateway.internal", PUBLIC),
    (b"bad host/with@junk", b"mic-sessions"),
])
def test_http_list_and_invalid_forwarded_host(forwarded: bytes, expected: bytes) -> None:
    upstream = FakeHttpUpstream()
    _run(lambda: _http_through(upstream, "/", [(b"host", b"mic-sessions"), (b"x-forwarded-host", forwarded)]))
    received = upstream.received()
    assert _values(received, b"host") == [expected]
    assert _values(received, b"x-forwarded-host") == [expected]


@pytest.mark.parametrize(("location", "expected"), [
    ("http://mooi.example/assets/", "/assets/"),
    ("https://mooi.example/assets/?a=1#top", "/assets/?a=1#top"),
    ("http://MOOI.example", "/"),
    ("/assets/", "/assets/"),
    ("https://elsewhere.example/assets/", None),
    ("http://mooi.example.evil/assets/", None),
])
def test_redirect_to_public_host_stays_in_preview(location: str, expected: str | None) -> None:
    upstream = FakeHttpUpstream(301, [("Location", location)])

    async def scenario() -> tuple[str, list[dict[str, Any]]]:
        server = await asyncio.start_server(upstream.handle, "127.0.0.1", 0)
        async with server:
            label = _publish(server.sockets[0].getsockname()[1])
            return label, await _http(label, "/assets", [(b"host", b"mic-sessions"),
                                                         (b"x-forwarded-host", PUBLIC)])

    label, sent = _run(scenario)
    start = sent[0]
    assert start["status"] == 301
    value = _values(start["headers"], b"location")[0].decode()
    assert value == (f"/preview/{label}{expected}" if expected else location)
    assert "mic-sessions" not in value


def test_redirect_to_private_upstream_stays_in_preview() -> None:
    assert previews._location("http://app:80/x?y", "http://app:80", "/preview/p", "mooi.example") == "/preview/p/x?y"


# --- WebSocket ------------------------------------------------------------------------------------


async def _websocket(label: str, headers: list[tuple[bytes, bytes]]) -> list[dict[str, Any]]:
    async def app(*_: Any) -> None:
        raise AssertionError("not a preview path")

    sent: list[dict[str, Any]] = []
    inbox: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    inbox.put_nowait({"type": "websocket.connect"})

    async def send(message: dict[str, Any]) -> None:
        sent.append(message)
        if message["type"] == "websocket.accept":
            inbox.put_nowait({"type": "websocket.disconnect", "code": 1000})

    path = f"/preview/{label}/socket"
    scope = {"type": "websocket", "scheme": "ws", "path": path, "raw_path": path.encode(), "query_string": b"",
             "headers": headers, "client": ("10.0.0.2", 5000), "subprotocols": [],
             "extensions": {"websocket.http.response": {}}}
    await previews.PreviewGateway(app)(scope, inbox.get, send)
    return sent


async def _same_origin_upstream(handshakes: list[Request]) -> Any:
    """An application that, like many frameworks, accepts only same-origin WebSockets."""
    def process_request(connection: ServerConnection, request: Request) -> Any:
        handshakes.append(request)
        if request.headers.get("Origin") != f"https://{request.headers.get('Host')}":
            return connection.respond(403, "Cross-origin WebSocket refused\n")
        return None

    async def handler(connection: ServerConnection) -> None:
        await connection.wait_closed()

    return await serve(handler, "127.0.0.1", 0, process_request=process_request)


def _websocket_through(origin: bytes) -> tuple[list[Request], list[dict[str, Any]]]:
    handshakes: list[Request] = []

    async def scenario() -> list[dict[str, Any]]:
        server = await _same_origin_upstream(handshakes)
        async with server:
            label = _publish(next(iter(server.sockets)).getsockname()[1])
            return await _websocket(label, [
                (b"host", b"mic-sessions"), (b"x-forwarded-host", PUBLIC), (b"origin", origin),
                (b"upgrade", b"websocket"), (b"connection", b"Upgrade"),
                (b"sec-websocket-key", b"dGhlIHNhbXBsZSBub25jZQ=="), (b"sec-websocket-version", b"13"),
            ])

    return handshakes, _run(scenario)


def test_websocket_same_origin_accepted_with_public_host() -> None:
    # The TCP connection reached the private 127.0.0.1 endpoint while the handshake named the public host.
    handshakes, sent = _websocket_through(b"https://mooi.example")
    assert [message["type"] for message in sent][0] == "websocket.accept"
    headers = handshakes[0].headers
    assert headers.get_all("Host") == ["mooi.example"]
    assert headers.get_all("X-Forwarded-Host") == ["mooi.example"]


def test_websocket_other_origin_gets_application_refusal() -> None:
    handshakes, sent = _websocket_through(b"https://attacker.example")
    assert handshakes[0].headers.get_all("Host") == ["mooi.example"]
    assert sent[0]["type"] == "websocket.http.response.start"
    assert sent[0]["status"] == 403
    assert sent[1]["body"] == b"Cross-origin WebSocket refused\n"
