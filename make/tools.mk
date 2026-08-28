# Single responsibility: preflight tool checks. Defines TOOLS_LIB.

define TOOLS_LIB
# require_tool <bin> <install hint>
require_tool() {
  __rt_bin="$$1"; __rt_hint="$$2"
  if ! command -v "$$__rt_bin" >/dev/null 2>&1; then
    ui_fail "$$__rt_bin" "required tool not found on PATH" "-" "$$__rt_hint"
    exit 1
  fi
}

require_docker() {
  require_tool docker "install Docker: https://docs.docker.com/get-docker/"
  if ! docker compose version >/dev/null 2>&1; then
    ui_fail "docker compose" "Docker Compose v2 plugin not found" "-" "install Docker Compose v2: https://docs.docker.com/compose/install/"
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    ui_fail "docker" "Docker daemon is not reachable" "-" "start Docker Desktop (or the docker service) and retry"
    exit 1
  fi
}
endef
