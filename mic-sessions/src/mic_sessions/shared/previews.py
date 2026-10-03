"""Transversal aspect: the embedded preview reverse proxy.

Deployed applications are never exposed: their only browser-facing door is this proxy. Each running
deployment is published under its own unguessable path `/preview/<id>/` of whatever host serves
mic-sessions (Mooi's gateway in production, the service port in development), so a preview needs no
DNS record, certificate or published port: wherever Mooi is reachable, by name or by bare IP, its
previews are too. The id is a 160-bit capability handed only to the deployment owner through the
authenticated session snapshot, rotated on every deploy and revoked as soon as it stops running.

The prefix is stripped before forwarding, so containers keep serving from `/`. The application only
has to build its frontend for the public base path, which the deployment receives beforehand as
`MOOI_PREVIEW_BASE_PATH`; the proxy sends it as `X-Forwarded-Prefix` and keeps path-absolute
redirects and cookie paths inside it.

`PreviewGateway` wraps the API application and diverts requests by path before any API middleware.
HTTP is streamed both ways untouched (no decompression, no buffering, SSE and uploads included);
WebSockets are relayed frame by frame. The proxy owns only the embedding policy: framing headers are
rewritten so Mooi can frame the preview, and the capability path is kept out of Referer headers.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import re
import secrets
from collections.abc import AsyncIterator, Awaitable, Callable, MutableMapping
from typing import Any
from uuid import UUID

import httpx
from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import ConnectionClosed, WebSocketException

from mic_sessions.shared.env import get_settings

LOG = logging.getLogger("previews")

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]

_HOP_BY_HOP = frozenset({
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "proxy-connection",
    "te", "trailer", "transfer-encoding", "upgrade",
})
# Rebuilt by the proxy: Mooi's gateway facts are kept, the connection's otherwise.
_FORWARDING = frozenset({"forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port",
                         "x-forwarded-prefix"})
# Negotiated by each WebSocket hop on its own.
_WEBSOCKET_HANDSHAKE = frozenset({
    "host", "sec-websocket-key", "sec-websocket-version", "sec-websocket-extensions",
    "sec-websocket-protocol", "sec-websocket-accept",
})
# Close codes that only describe a local condition and can never travel in a close frame.
_RESERVED_CLOSE_CODES = {1005: 1000, 1006: 1011, 1015: 1011}

PREFIX = "/preview/"
_LABEL = re.compile(r"[a-z2-7]{32}")


# --- routes ---------------------------------------------------------------------------------------


class _Routes:
    """In-memory capability table; deployments never outlive the process that started them."""

    def __init__(self) -> None:
        self._upstreams: dict[str, str] = {}
        self._labels: dict[UUID, str] = {}

    def publish(self, owner: UUID, label: str, upstream: str) -> str:
        self.withdraw(owner)
        self._upstreams[label] = upstream
        self._labels[owner] = label
        return base_path(label)

    def withdraw(self, owner: UUID) -> None:
        label = self._labels.pop(owner, None)
        if label is not None:
            self._upstreams.pop(label, None)

    def resolve(self, label: str) -> str | None:
        return self._upstreams.get(label)


_routes = _Routes()


def reserve() -> str:
    """A fresh capability label, known before the build so the frontend can target its base path."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").lower()


def base_path(label: str) -> str:
    """The public path of a preview, with leading and trailing slash: `/preview/<label>/`."""
    return f"{PREFIX}{label}/"


def publish(owner: UUID, label: str, upstream: str) -> str:
    """Opens the reserved preview path for `upstream` (an `http://host:port` private endpoint) and
    returns it. Any previous preview of the same owner is revoked first."""
    return _routes.publish(owner, label, upstream)


def withdraw(owner: UUID) -> None:
    """Revokes the owner's preview immediately; idempotent."""
    _routes.withdraw(owner)


# --- upstream client ------------------------------------------------------------------------------

_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        # No read/write timeout: streaming responses (SSE, long polling, downloads) stay open as long
        # as the browser keeps them. No ambient proxies, no redirects followed on the user's behalf.
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(None, connect=10.0, pool=10.0), follow_redirects=False,
            trust_env=False, limits=httpx.Limits(max_connections=512, max_keepalive_connections=64),
        )
    return _client


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


# --- headers --------------------------------------------------------------------------------------


def _header(scope: Scope, name: bytes) -> bytes | None:
    return next((value for key, value in scope["headers"] if key == name), None)


def _connection_tokens(headers: list[tuple[bytes, bytes]]) -> set[str]:
    return {token.strip().lower() for key, value in headers if key.lower() == b"connection"
            for token in value.decode("latin-1").split(",") if token.strip()}


def _request_headers(scope: Scope, prefix: str, drop: frozenset[str] = frozenset()) -> list[tuple[bytes, bytes]]:
    """The browser's headers minus hop-by-hop ones, with the forwarding facts of the public request.

    Host is kept: the application sees Mooi's public host, as behind any reverse proxy. mic-sessions
    is reachable only through Mooi's gateway or locally, so the gateway's scheme and host win over the
    connection's own.
    """
    raw: list[tuple[bytes, bytes]] = scope["headers"]
    excluded = _HOP_BY_HOP | _FORWARDING | _connection_tokens(raw) | drop
    headers = [(key, value) for key, value in raw if key.decode("latin-1").lower() not in excluded]
    client = scope.get("client")
    if client:
        chain = _header(scope, b"x-forwarded-for")
        address = client[0].encode("latin-1")
        headers = [(key, value) for key, value in headers if key != b"x-forwarded-for"]
        headers.append((b"x-forwarded-for", chain + b", " + address if chain else address))
    proto = _header(scope, b"x-forwarded-proto") or scope.get("scheme", "http").replace("ws", "http").encode("ascii")
    headers.append((b"x-forwarded-proto", proto))
    if (host := _header(scope, b"x-forwarded-host") or _header(scope, b"host")) is not None:
        headers.append((b"x-forwarded-host", host))
    headers.append((b"x-forwarded-prefix", prefix.encode("ascii")))
    return headers


_FRAME_ANCESTORS = re.compile(r"(?i)(^|;)\s*frame-ancestors\b[^;]*")
_COOKIE_PATH = re.compile(r"(?i)(;\s*path\s*=\s*)/?([^;]*)")


def _location(text: str, upstream: str, prefix: str) -> str:
    """Redirects to the private endpoint or to a path-absolute URL stay inside the preview prefix."""
    if text.startswith(upstream) and text[len(upstream):len(upstream) + 1] in ("", "/", "?", "#"):
        text = text[len(upstream):] or "/"
    if text.startswith("/") and not text.startswith("//") and not text.startswith(prefix + "/"):
        return prefix + text
    return text


def _response_headers(response: httpx.Response, upstream: str, prefix: str) -> list[tuple[bytes, bytes]]:
    """Upstream headers as sent (multiple Set-Cookie included), with only the embedding policy owned
    by Mooi: framing restricted to Mooi itself, redirects and cookie paths kept inside the prefix."""
    raw = response.headers.raw
    excluded = _HOP_BY_HOP | _connection_tokens(raw) | {"x-frame-options"}
    ancestors = f"frame-ancestors 'self' {get_settings().cors_origin}"
    headers: list[tuple[bytes, bytes]] = []
    for key, value in raw:
        name = key.decode("latin-1").lower()
        if name in excluded:
            continue
        if name == "content-security-policy":
            value = _FRAME_ANCESTORS.sub(lambda match: f"{match.group(1)} {ancestors}",
                                         value.decode("latin-1")).encode("latin-1")
        elif name in ("location", "content-location"):
            value = _location(value.decode("latin-1"), upstream, prefix).encode("latin-1")
        elif name == "set-cookie":
            # Each preview keeps its own cookie jar, apart from Mooi's and from other previews.
            value = _COOKIE_PATH.sub(lambda match: f"{match.group(1)}{prefix}/{match.group(2)}",
                                     value.decode("latin-1")).encode("latin-1")
        headers.append((key, value))
    if "referrer-policy" not in response.headers:
        # The path is the capability: never leak it to third parties through Referer.
        headers.append((b"referrer-policy", b"same-origin"))
    return headers


# --- HTTP -----------------------------------------------------------------------------------------


class _ClientGone(Exception):
    pass


async def _request_body(receive: Receive) -> AsyncIterator[bytes]:
    while True:
        message = await receive()
        if message["type"] == "http.disconnect":
            raise _ClientGone
        if body := message.get("body"):
            yield body
        if not message.get("more_body"):
            return


async def _until_disconnect(receive: Receive) -> None:
    while (await receive())["type"] != "http.disconnect":
        pass


async def _page(send: Send, status: int, title: str, detail: str) -> None:
    body = (f"<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" "
            f"content=\"width=device-width,initial-scale=1\"><title>{title}</title><body style=\"margin:0;"
            f"display:grid;place-items:center;min-height:100vh;font:15px system-ui,sans-serif;color:#555;"
            f"text-align:center\"><div><h1 style=\"font-size:18px;color:#222\">{title}</h1><p>{detail}</p>"
            f"</div></body></html>").encode()
    await send({"type": "http.response.start", "status": status, "headers": [
        (b"content-type", b"text/html; charset=utf-8"), (b"content-length", str(len(body)).encode()),
        (b"cache-control", b"no-store"), (b"referrer-policy", b"no-referrer"),
    ]})
    await send({"type": "http.response.body", "body": body})


async def _proxy_http(scope: Scope, receive: Receive, send: Send, upstream: str, prefix: str, path: bytes) -> None:
    endpoint = httpx.URL(upstream)
    query = scope.get("query_string") or b""
    url = endpoint.copy_with(raw_path=path + (b"?" + query if query else b""))
    headers = _request_headers(scope, prefix)
    has_body = any(key in (b"content-length", b"transfer-encoding") for key, _ in scope["headers"])
    request = httpx.Request(scope["method"], url, headers=headers,
                            content=_request_body(receive) if has_body else None)
    try:
        response = await _http().send(request, stream=True)
    except _ClientGone:
        return
    except httpx.HTTPError:
        LOG.debug("Preview upstream unavailable", exc_info=True)
        await _page(send, 502, "Preview unavailable", "The application is not answering right now. "
                                                       "Reload once it is running again.")
        return
    try:
        await send({"type": "http.response.start", "status": response.status_code,
                    "headers": _response_headers(response, upstream, prefix)})

        async def stream() -> None:
            async for chunk in response.aiter_raw():
                await send({"type": "http.response.body", "body": chunk, "more_body": True})
            await send({"type": "http.response.body", "body": b"", "more_body": False})

        # The request body is fully sent by now: the only message left is the browser leaving,
        # which must stop endless streams (SSE, long polling) instead of leaking them.
        relay = asyncio.ensure_future(stream())
        gone = asyncio.ensure_future(_until_disconnect(receive))
        try:
            await asyncio.wait({relay, gone}, return_when=asyncio.FIRST_COMPLETED)
        finally:
            for task in (relay, gone):
                task.cancel()
            await asyncio.gather(relay, gone, return_exceptions=True)
        if relay.done() and not relay.cancelled() and isinstance(relay.exception(), httpx.HTTPError):
            # Headers are already sent: returning unfinished makes the server drop the connection.
            LOG.debug("Preview upstream stream interrupted", exc_info=relay.exception())
    finally:
        await response.aclose()


# --- WebSocket ------------------------------------------------------------------------------------


def _close_code(code: int | None) -> int:
    return _RESERVED_CLOSE_CODES.get(code or 1005, code or 1000)


async def _proxy_websocket(scope: Scope, receive: Receive, send: Send, upstream: str, prefix: str,
                           raw_path: bytes) -> None:
    if (await receive())["type"] != "websocket.connect":
        return
    endpoint = httpx.URL(upstream)
    host = (_header(scope, b"host") or b"").decode("latin-1")
    path = raw_path.decode("latin-1")
    query = (scope.get("query_string") or b"").decode("latin-1")
    headers = [(key.decode("latin-1"), value.decode("latin-1"))
               for key, value in _request_headers(scope, prefix, _WEBSOCKET_HANDSHAKE)]
    try:
        # The URI carries the public Host; the TCP connection goes to the private endpoint.
        upstream_socket: ClientConnection = await connect(
            f"ws://{host}{path}" + (f"?{query}" if query else ""), host=endpoint.host, port=endpoint.port,
            additional_headers=headers, subprotocols=scope.get("subprotocols") or None,
            user_agent_header=None, proxy=None, max_size=None, open_timeout=10,
        )
    except (OSError, WebSocketException, TimeoutError):
        LOG.debug("Preview WebSocket upstream refused", exc_info=True)
        await send({"type": "websocket.close", "code": 1011})
        return
    async with upstream_socket:
        await send({"type": "websocket.accept", "subprotocol": upstream_socket.subprotocol})

        async def browser_to_application() -> None:
            while True:
                message = await receive()
                if message["type"] == "websocket.disconnect":
                    await upstream_socket.close(_close_code(message.get("code")))
                    return
                if message["type"] == "websocket.receive":
                    text = message.get("text")
                    await upstream_socket.send(text if text is not None else message.get("bytes") or b"")

        async def application_to_browser() -> None:
            with_close = True
            try:
                async for data in upstream_socket:
                    await send({"type": "websocket.send", "text": data} if isinstance(data, str)
                               else {"type": "websocket.send", "bytes": data})
            except ConnectionClosed:
                pass
            except OSError:
                with_close = False  # The browser is already gone.
            if with_close:
                await send({"type": "websocket.close", "code": _close_code(upstream_socket.close_code),
                            "reason": upstream_socket.close_reason or ""})

        tasks = {asyncio.ensure_future(browser_to_application()), asyncio.ensure_future(application_to_browser())}
        try:
            await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)


# --- gateway --------------------------------------------------------------------------------------


class PreviewGateway:
    """Outermost ASGI layer: preview paths go to the proxy, everything else to the API untouched."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket") or not scope["path"].startswith(PREFIX):
            await self.app(scope, receive, send)
            return
        raw = scope.get("raw_path") or scope["path"].encode("utf-8")
        label, slash, rest = raw[len(PREFIX):].decode("latin-1").partition("/")
        upstream = _routes.resolve(label) if _LABEL.fullmatch(label) else None
        prefix = f"{PREFIX}{label}"
        if scope["type"] == "websocket":
            if upstream is None or not slash:
                await send({"type": "websocket.close", "code": 1008})
                return
            await _proxy_websocket(scope, receive, send, upstream, prefix, ("/" + rest).encode("latin-1"))
        elif upstream is None:
            await _page(send, 404, "Preview not available",
                        "This preview has stopped or its address changed. Open it again from Mooi.")
        elif not slash:
            # Relative URLs of the application resolve against the base path only with its slash.
            query = scope.get("query_string") or b""
            await send({"type": "http.response.start", "status": 308, "headers": [
                (b"location", prefix.encode("latin-1") + b"/" + (b"?" + query if query else b"")),
                (b"content-length", b"0"), (b"cache-control", b"no-store"), (b"referrer-policy", b"no-referrer"),
            ]})
            await send({"type": "http.response.body", "body": b""})
        else:
            await _proxy_http(scope, receive, send, upstream, prefix, ("/" + rest).encode("latin-1"))
