"""Transversal aspect: a typed client for `mic-mooi`.

Every call forwards the caller's own bearer token, so `mic-mooi` still enforces its own
authorization; the service-only endpoints (the agent credential, the GitHub clone token) also carry
`X-Service-Token` — a browser holding a valid access token cannot reach them
directly, only this service can. Upstream 4xx responses are re-raised with the same status and the
upstream `message` when the body carries one (the same `ApiError` shape `mic-mooi` returns);
5xx responses and network failures collapse to a single `ApiException.bad_gateway`, since none of
those carry information this service should forward verbatim.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

import httpx

from mic_sessions.shared.auth import Caller
from mic_sessions.shared.env import get_settings
from mic_sessions.shared.web import ApiException, get_http_client

_SERVICE_TOKEN_HEADER = "X-Service-Token"


@dataclass(frozen=True)
class Project:
    id: UUID
    full_name: str
    default_branch: str
    is_private: bool
    html_url: str


@dataclass(frozen=True)
class Credential:
    mode: str
    token: str
    expires_at: datetime | None


def _bearer(caller: Caller) -> dict[str, str]:
    return {"Authorization": f"Bearer {caller.token}"}


def _service_headers(caller: Caller) -> dict[str, str]:
    return {**_bearer(caller), _SERVICE_TOKEN_HEADER: get_settings().service_token}


def _raise_for_status(response: httpx.Response, not_found_message: str) -> None:
    if response.status_code == 404:
        raise ApiException.not_found(not_found_message)
    if 400 <= response.status_code < 500:
        message = not_found_message
        try:
            message = response.json().get("message") or message
        except ValueError:
            pass
        raise ApiException(response.status_code, message)
    if response.status_code >= 500:
        raise ApiException.bad_gateway()


async def _get(client: httpx.AsyncClient, url: str, headers: dict[str, str], not_found_message: str) -> dict:
    try:
        response = await client.get(url, headers=headers)
    except httpx.HTTPError:
        raise ApiException.bad_gateway() from None
    _raise_for_status(response, not_found_message)
    return response.json()


async def fetch_project(caller: Caller, project_id: UUID) -> Project:
    settings = get_settings()
    body = await _get(
        get_http_client(),
        f"{settings.mooi_api_base_url}/me/projects",
        _bearer(caller),
        "Project not found",
    )
    for project in body.get("projects", []):
        if project.get("id") == str(project_id):
            return Project(
                id=UUID(project["id"]),
                full_name=project["fullName"],
                default_branch=project["defaultBranch"],
                is_private=project["isPrivate"],
                html_url=project["htmlUrl"],
            )
    raise ApiException.not_found("Project not found")


async def fetch_github_token(caller: Caller) -> str:
    settings = get_settings()
    body = await _get(
        get_http_client(),
        f"{settings.mooi_api_base_url}/me/github/token",
        _service_headers(caller),
        "No GitHub account linked",
    )
    return body["token"]


async def fetch_agent_credential(caller: Caller, provider: str) -> Credential:
    settings = get_settings()
    body = await _get(
        get_http_client(),
        f"{settings.mooi_api_base_url}/me/agents/{provider}/credential",
        _service_headers(caller),
        "No agent provider linked",
    )
    expires_at = body.get("expiresAt")
    return Credential(
        mode=body["mode"],
        token=body["token"],
        expires_at=datetime.fromisoformat(expires_at) if expires_at else None,
    )
