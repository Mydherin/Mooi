# Single responsibility: read configuration from .env files and expose the
# dev runtime knobs. No hardcoded ports, urls or credentials anywhere else.

# env-get(file, key, default) -> last assignment of `key` in `file`, tolerating
# `export `, surrounding spaces, a trailing CR and surrounding quotes.
env-get = $(strip $(or $(shell test -f '$(1)' && sed -n -e 's/\r$$//' -e 's/^[[:space:]]*\(export[[:space:]][[:space:]]*\)\{0,1\}$(2)[[:space:]]*=[[:space:]]*//p' '$(1)' 2>/dev/null | tail -n 1 | sed -e 's/^"\(.*\)"$$/\1/' -e "s/^'\(.*\)'\$$/\1/"),$(3)))

ENV_FILE := .env

DEV_HEALTH_TIMEOUT := $(call env-get,$(ENV_FILE),DEV_HEALTH_TIMEOUT,180)
DEV_STOP_TIMEOUT := $(call env-get,$(ENV_FILE),DEV_STOP_TIMEOUT,15)
DEV_SERVICE_TIMEOUT := $(call env-get,$(ENV_FILE),DEV_SERVICE_TIMEOUT,120)
DEV_POLL_INTERVAL := $(call env-get,$(ENV_FILE),DEV_POLL_INTERVAL,1)
DEV_LOG_LINES := $(call env-get,$(ENV_FILE),DEV_LOG_LINES,50)

export DEV_HEALTH_TIMEOUT DEV_STOP_TIMEOUT DEV_SERVICE_TIMEOUT DEV_POLL_INTERVAL DEV_LOG_LINES
