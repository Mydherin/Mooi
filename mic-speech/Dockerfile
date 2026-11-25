# Production image of mic-speech. It binds loopback only, exactly as in development: it runs in the
# network namespace of the spa-mooi gateway, whose nginx is its only client (see deploy/production/compose.prod.yml).
#
# The pinned NeMo-Speech.cpp runtime (same version and SHA-256 as mic_speech.shared.engine) is baked
# into the image and selected through SPEECH_RUNTIME_PATH. The model (~742 MB) is pulled on start into
# the persistent data volume, idempotently: only the very first start downloads it.

# ── Speech engine runtime ────────────────────────────────────
FROM debian:trixie-slim AS engine

ARG NEMO_SPEECH_VERSION=0.3.0
ARG TARGETARCH

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) asset=linux-x86_64-cpu; sum=255f12b722ab15b2a38a51cf125d56e3fa97058b528f7e895b39d6a473deb06e ;; \
      arm64) asset=linux-aarch64-cpu; sum=56858eaf50d19b05902c043f65d0057352bdc107ae380c41053bfbddfc204bf1 ;; \
      *) echo "unsupported architecture $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/runtime.tar.gz \
      "https://github.com/NVIDIA/NeMo-Speech.cpp/releases/download/v${NEMO_SPEECH_VERSION}/nemo-speech-${NEMO_SPEECH_VERSION}-${asset}.tar.gz"; \
    echo "$sum  /tmp/runtime.tar.gz" | sha256sum -c -; \
    mkdir -p /opt/nemo-speech; \
    tar -xzf /tmp/runtime.tar.gz -C /opt/nemo-speech --strip-components=1; \
    test -x /opt/nemo-speech/bin/nemo-speech

# ── Python dependencies ──────────────────────────────────────
FROM python:3.15-slim-trixie AS build

COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never

WORKDIR /app

COPY pyproject.toml uv.lock .python-version ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project

COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-editable

# ── Runtime ──────────────────────────────────────────────────
FROM python:3.15-slim-trixie AS runtime

# curl: the engine's `pull` downloads the pinned model through it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1001 mooi && useradd -u 1001 -g mooi -m -d /home/mooi -s /usr/sbin/nologin mooi

WORKDIR /app

COPY --from=engine /opt/nemo-speech /opt/nemo-speech
COPY --from=build --chown=mooi:mooi /app/.venv /app/.venv

USER mooi

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    SPEECH_HOST=127.0.0.1 \
    SPEECH_PORT=59100 \
    SPEECH_RUNTIME_PATH=/opt/nemo-speech/bin/nemo-speech \
    NEMO_SPEECH_MODEL_DIR=/var/lib/mooi/speech/models \
    SPEECH_METRICS_PATH=/var/lib/mooi/speech/metrics.sqlite \
    XDG_CACHE_HOME=/var/lib/mooi/speech/cache \
    HOME=/var/lib/mooi/speech/home

EXPOSE 59100

HEALTHCHECK --interval=15s --timeout=5s --start-period=900s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:59100/health', timeout=4)"]

# Single worker on purpose: the engine and the one-dictation lock live in this process.
CMD ["sh", "-c", "mkdir -p \"$HOME\" && python -m mic_speech.shared.engine provision && exec uvicorn mic_speech.main:app --host 127.0.0.1 --port \"$SPEECH_PORT\" --ws-max-size 16000 --ws-max-queue 8 --timeout-graceful-shutdown 5"]
