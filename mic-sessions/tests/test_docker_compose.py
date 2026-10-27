"""Compose freezing: only requirements that run as isolated sibling containers are accepted."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret!")
os.environ.setdefault("SERVICE_TOKEN", "test-token")

from mic_sessions.shared.docker import DockerError, _freeze_compose  # noqa: E402


@pytest.fixture
def checkout(tmp_path: Path) -> Path:
    (tmp_path / "Dockerfile").write_text("FROM nginx\n")
    return tmp_path


def model(web: dict | None = None, **sidecar: object) -> dict:
    return {"services": {"web": {"build": {"context": "."}, **(web or {})},
                         "sidecar": {"image": "busybox", **sidecar}}}


def test_sidecar_may_share_a_sibling_network_namespace(checkout: Path) -> None:
    frozen = _freeze_compose(model(network_mode="service:web"), checkout, "project", "web")
    assert frozen["services"]["sidecar"]["network_mode"] == "service:web"


@pytest.mark.parametrize("value", [
    model(network_mode="host"),
    model(network_mode="none"),
    model(network_mode="container:other"),
    model(network_mode="service:missing"),
    model(network_mode="service:sidecar"),
    model(web={"network_mode": "service:sidecar"}),
])
def test_other_network_modes_are_rejected(checkout: Path, value: dict) -> None:
    with pytest.raises(DockerError) as error:
        _freeze_compose(value, checkout, "project", "web")
    assert error.value.code == "unsupported_project"
