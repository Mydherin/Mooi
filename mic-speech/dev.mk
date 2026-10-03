# Dev entrypoint fragment for mic-speech. Read by the root Makefile through
# make/artifacts.mk; see Makefile and make/*.mk for the contract.

ARTIFACT_NAME := mic-speech
ARTIFACT_KIND := mic
ARTIFACT_PORT := $(DEV_PORT_SPEECH)
ARTIFACT_URL := http://127.0.0.1:$(ARTIFACT_PORT)
ARTIFACT_HEALTH := $(ARTIFACT_URL)/health
ARTIFACT_SERVICES :=
ARTIFACT_NEEDS :=

# mic-speech/shared/env.py loads the root .env then mic-speech/.env by itself,
# so its configuration does not need to be exported here.
#
# Provisioning (pinned NeMo-Speech.cpp runtime + Nemotron 3.5 model, ~742 MB on
# first run) happens in the foreground before the spawn, so a first download
# never counts against the health timeout. The native engine is a child of
# uvicorn in the same process group: artifact_stop terminates both.
# Single worker on purpose: the engine and the one-dictation lock are in-process.
define start
require_tool uv "install uv: https://docs.astral.sh/uv/"
ui_step "mic-speech" "provisioning speech engine"
if ! (cd "$$ARTIFACT_DIR" && uv run --locked python -m mic_speech.shared.engine provision); then
  ui_fail "mic-speech" "speech engine provisioning failed" "-" "check network access or set SPEECH_RUNTIME_PATH / SPEECH_MODEL in mic-speech/.env"
  exit 1
fi
artifact_spawn "uv run --locked uvicorn mic_speech.main:app --host 127.0.0.1 --port $$ARTIFACT_PORT --ws-max-size 16000 --ws-max-queue 8 --timeout-graceful-shutdown 5"
endef

define stop
artifact_stop
endef

define status
artifact_status_row
endef

define clean
rm -rf "$$ARTIFACT_DIR/.venv" "$$ARTIFACT_DIR/.runtime"
find "$$ARTIFACT_DIR/src" -name __pycache__ -type d -prune -exec rm -rf {} +
endef
