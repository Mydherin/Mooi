# Single responsibility: the canonical dev ports.
#
# Every dev service runs on a fixed, deliberately uncommon port hardcoded
# here — one random port per service, always the same across runs — so a
# stock Postgres on 5432, a Vite app on 5173 or a service on 8080 never
# collides with this stack. This file is the single source of truth: the
# artifact fragments read these variables (never the .env files) and the
# values are exported so docker compose interpolation, Vite (loadEnv +
# import.meta.env) and mic-mooi/shared/Env.java all pick them up over
# whatever their .env / compose defaults say.

DEV_PORT_SPA      := 28471
DEV_PORT_MIC      := 39615
DEV_PORT_SESSIONS := 44913
DEV_PORT_POSTGRES := 54983
DEV_PORT_PGADMIN  := 51247

DEV_HOST_SPA := $(call env-get,spa-mooi/.env,VITE_DEV_HOST,localhost)

# Variable names the downstream tools actually read; exported so they win
# over the .env-file values.
export VITE_DEV_PORT  := $(DEV_PORT_SPA)
export SERVER_PORT    := $(DEV_PORT_MIC)
export SESSIONS_PORT  := $(DEV_PORT_SESSIONS)
export POSTGRES_PORT  := $(DEV_PORT_POSTGRES)
export PGADMIN_PORT   := $(DEV_PORT_PGADMIN)

# Cross-artifact wiring that must follow the ports.
export VITE_API_BASE_URL := http://localhost:$(DEV_PORT_MIC)
export MOOI_API_BASE_URL := http://localhost:$(DEV_PORT_MIC)
export VITE_SESSIONS_BASE_URL := http://localhost:$(DEV_PORT_SESSIONS)
export CORS_ORIGIN       := http://$(DEV_HOST_SPA):$(DEV_PORT_SPA)
# Registered on the GitHub App; it embeds the SPA port, so it follows a change here.
export GITHUB_REDIRECT_URI := http://$(DEV_HOST_SPA):$(DEV_PORT_SPA)/account/github/callback
export AGENT_CLAUDE_REDIRECT_URI := http://$(DEV_HOST_SPA):$(DEV_PORT_SPA)/account/agents/claude/callback
