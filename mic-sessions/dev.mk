# Dev entrypoint fragment for mic-sessions. Read by the root Makefile through
# make/artifacts.mk; see Makefile and make/*.mk for the contract.

ARTIFACT_NAME := mic-sessions
ARTIFACT_KIND := mic
ARTIFACT_PORT := $(DEV_PORT_SESSIONS)
ARTIFACT_URL := http://localhost:$(ARTIFACT_PORT)
ARTIFACT_HEALTH := $(ARTIFACT_URL)/health
ARTIFACT_SERVICES :=
ARTIFACT_NEEDS := mic-mooi
# Open SSE streams never end on their own: cut them after this many seconds so the
# lifespan cleanup (sessions, runtimes, deployments) starts right away.
SESSIONS_GRACEFUL_SHUTDOWN_SECONDS ?= 5

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
# Docker is optional for chat; the explicit preflight target fails when unavailable.
if ! (cd "$$ARTIFACT_DIR" && PYTHONPATH=src .venv/bin/python -m mic_sessions.shared.docker preflight); then
  ui_warn "Deploy unavailable: check DOCKER_HOST and Docker Compose; chat can still start"
fi
# Boot cleans orphaned deployments sequentially before HTTP becomes ready.
__sessions_boot_budget="$$(cd "$$ARTIFACT_DIR" && PYTHONPATH=src .venv/bin/python -c 'from mic_sessions.shared.env import get_settings; s=get_settings(); count=sum(1 for p in (s.workspace_root / "deployments").glob("*") if not p.name.startswith(".")); print(count * s.deployment_stop_timeout_seconds + 30)')" || return 1
if [ "$$DEV_HEALTH_TIMEOUT" -lt "$$__sessions_boot_budget" ]; then
  DEV_HEALTH_TIMEOUT="$$__sessions_boot_budget"
fi
artifact_spawn "uv run uvicorn mic_sessions.main:app --host 0.0.0.0 --port $$ARTIFACT_PORT --timeout-graceful-shutdown $(SESSIONS_GRACEFUL_SHUTDOWN_SECONDS)"
endef

define stop
# Budget the real pending work, not the worst case: connection cut-off, one stop per
# deployment actually on disk, plus a fixed margin for sessions. KILL after that.
# Read the same .env settings as the service; this does not start the application.
if [ -x "$$ARTIFACT_DIR/.venv/bin/python" ]; then
  __sessions_stop_budget="$$(cd "$$ARTIFACT_DIR" && PYTHONPATH=src .venv/bin/python -c 'from mic_sessions.shared.env import Settings; s=Settings(); count=sum(1 for p in (s.workspace_root / "deployments").glob("*") if not p.name.startswith(".")); print($(SESSIONS_GRACEFUL_SHUTDOWN_SECONDS) + count * s.deployment_stop_timeout_seconds + 30)')" || return 1
  if [ "$$DEV_STOP_TIMEOUT" -lt "$$__sessions_stop_budget" ]; then
    DEV_STOP_TIMEOUT="$$__sessions_stop_budget"
  fi
fi
__sessions_previous_pid="$$(artifact_pid)"
artifact_stop
# A forced stop can return before the process group has exited. Never race cleanup
# against an SDK/Docker child still running in that group.
if [ -n "$$__sessions_previous_pid" ]; then
  for __sessions_wait in 1 2 3 4 5; do
    if ! kill -0 "-$$__sessions_previous_pid" 2>/dev/null && ! proc_alive "$$__sessions_previous_pid"; then break; fi
    sleep 1
  done
  if kill -0 "-$$__sessions_previous_pid" 2>/dev/null || proc_alive "$$__sessions_previous_pid"; then
    printf '%s\n' "mic-sessions process group is still active; preserving deployment records" >&2
    exit 1
  fi
fi
# Also recover manifests after an earlier crash or forced termination. Use uv only
# if the runtime is absent, and preserve it when cleanup fails so retry is possible.
(
  cd "$$ARTIFACT_DIR"
  if [ -x .venv/bin/python ]; then
    PYTHONPATH=src .venv/bin/python -m mic_sessions.shared.docker cleanup
  else
    require_tool uv "install uv: https://docs.astral.sh/uv/"
    PYTHONPATH=src uv run --locked python -m mic_sessions.shared.docker cleanup
  fi
) || exit 1
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
