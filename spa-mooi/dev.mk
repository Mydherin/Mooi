# Dev entrypoint fragment for spa-mooi. Read by the root Makefile through
# make/artifacts.mk; see Makefile and make/*.mk for the contract.

ARTIFACT_NAME := spa-mooi
ARTIFACT_KIND := spa
ARTIFACT_PORT := $(call env-get,spa-mooi/.env,VITE_DEV_PORT,5173)
ARTIFACT_URL := http://$(call env-get,spa-mooi/.env,VITE_DEV_HOST,localhost):$(ARTIFACT_PORT)
ARTIFACT_HEALTH := $(ARTIFACT_URL)
ARTIFACT_SERVICES :=
ARTIFACT_NEEDS :=

define start
if command -v bun >/dev/null 2>&1; then
  __pm="bun"
elif command -v npm >/dev/null 2>&1; then
  __pm="npm"
else
  ui_fail "spa-mooi" "no npm-like package manager found (bun or npm)" "-" "install bun: https://bun.sh"
  exit 1
fi
if [ ! -d "$$ARTIFACT_DIR/node_modules" ]; then
  ui_step "spa-mooi" "installing dependencies ($$__pm)"
  if [ "$$__pm" = "bun" ]; then
    (cd "$$ARTIFACT_DIR" && bun install --frozen-lockfile)
  else
    (cd "$$ARTIFACT_DIR" && npm ci)
  fi
fi
if [ "$$__pm" = "bun" ]; then
  artifact_spawn "bun run dev"
else
  artifact_spawn "npm run dev"
fi
endef

define stop
artifact_stop
endef

define status
artifact_status_row
endef

define clean
rm -rf "$$ARTIFACT_DIR/node_modules" "$$ARTIFACT_DIR/dist" "$$ARTIFACT_DIR/.vite"
find "$$ARTIFACT_DIR" -maxdepth 1 -name '*.tsbuildinfo' -delete
endef
