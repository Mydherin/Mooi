# Dev entrypoint fragment for mic-sessions. Read by the root Makefile through
# make/artifacts.mk; see Makefile and make/*.mk for the contract.

ARTIFACT_NAME := mic-sessions
ARTIFACT_KIND := mic
ARTIFACT_PORT := $(DEV_PORT_SESSIONS)
ARTIFACT_URL := http://localhost:$(ARTIFACT_PORT)
ARTIFACT_HEALTH := $(ARTIFACT_URL)/health
ARTIFACT_SERVICES :=
ARTIFACT_NEEDS := mic-mooi

# mic-sessions/shared/env.py loads mic-sessions/.env then the root .env by
# itself, so its configuration does not need to be exported here.
#
# `uv run` creates and syncs the virtualenv from pyproject.toml/uv.lock on
# first invocation, so no separate install step is needed.
define start
require_tool uv "install uv: https://docs.astral.sh/uv/"
require_tool git "install Git"
# The pinned SDK ships a native CLI; fail before starting if it cannot execute.
(
  cd "$$ARTIFACT_DIR"
  uv run python -c 'from importlib.resources import files; import subprocess; subprocess.run([str(files("claude_agent_sdk") / "_bundled" / "claude"), "--version"], check=True, timeout=20)'
)
artifact_spawn "uv run uvicorn mic_sessions.main:app --host 0.0.0.0 --port $$ARTIFACT_PORT"
endef

define stop
artifact_stop
endef

define status
artifact_status_row
endef

define clean
# Preserve workspace data, including legacy/unowned repositories. Startup reconciles
# only marked session directories under the configured WORKSPACE_ROOT.
rm -rf "$$ARTIFACT_DIR/.venv"
find "$$ARTIFACT_DIR/src" -name __pycache__ -type d -prune -exec rm -rf {} +
endef
