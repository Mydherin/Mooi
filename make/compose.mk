# Single responsibility: infrastructure dependencies (docker compose).
# Detection is dynamic; when no compose file exists the whole layer is
# skipped silently and the global commands keep working with artifacts only.

COMPOSE_FILES := $(sort $(wildcard compose.y*ml docker-compose.y*ml compose.*.y*ml docker-compose.*.y*ml */compose.y*ml */docker-compose.y*ml */compose.*.y*ml */docker-compose.*.y*ml))
COMPOSE_ARGS := $(foreach file,$(COMPOSE_FILES),-f $(file))
COMPOSE_ENV_ARG := $(if $(wildcard $(ENV_FILE)),--env-file $(ENV_FILE))
COMPOSE := docker compose $(COMPOSE_ENV_ARG) $(COMPOSE_ARGS)

export COMPOSE_FILES_COUNT := $(words $(COMPOSE_FILES))
export COMPOSE_CMD := $(COMPOSE)

define COMPOSE_LIB
compose_enabled() {
  [ "$${COMPOSE_FILES_COUNT:-0}" -gt 0 ]
}

# compose_services: every service declared across all detected compose
# files, sorted, one per line. Does not require the docker daemon.
compose_services() {
  compose_enabled || return 0
  $$COMPOSE_CMD config --services 2>/dev/null | sort -u
}

compose_cid() {
  $$COMPOSE_CMD ps -aq "$$1" 2>/dev/null | head -n 1
}

compose_has_health() {
  __ch_cid="$$(compose_cid "$$1")"
  [ -n "$$__ch_cid" ] && docker inspect -f "{{if .State.Health}}1{{end}}" "$$__ch_cid" 2>/dev/null | grep -q 1
}

compose_port() {
  __cp_cid="$$(compose_cid "$$1")"
  if [ -z "$$__cp_cid" ]; then
    printf -- '-'
    return 0
  fi
  __cp_port="$$(docker inspect -f "{{range \$$p, \$$b := .NetworkSettings.Ports}}{{if \$$b}}{{(index \$$b 0).HostPort}}{{end}}{{end}}" "$$__cp_cid" 2>/dev/null | head -n 1)"
  if [ -z "$$__cp_port" ]; then
    printf -- '-'
  else
    printf '%s' "$$__cp_port"
  fi
}

# compose_state: RUNNING, STARTING, UNHEALTHY, STOPPED (mirrors artifact
# states so dev-status can render dependencies and artifacts uniformly).
compose_state() {
  __cs_cid="$$(compose_cid "$$1")"
  if [ -z "$$__cs_cid" ]; then
    printf 'STOPPED'
    return 0
  fi
  __cs_status="$$(docker inspect -f "{{.State.Status}}" "$$__cs_cid" 2>/dev/null)"
  if [ "$$__cs_status" != "running" ]; then
    printf 'STOPPED'
    return 0
  fi
  if compose_has_health "$$1"; then
    __cs_health="$$(docker inspect -f "{{.State.Health.Status}}" "$$__cs_cid" 2>/dev/null)"
    case "$$__cs_health" in
      healthy) printf 'RUNNING' ;;
      starting) printf 'STARTING' ;;
      *) printf 'UNHEALTHY' ;;
    esac
  else
    printf 'RUNNING'
  fi
}

compose_health() {
  __ch2_cid="$$(compose_cid "$$1")"
  if [ -z "$$__ch2_cid" ] || ! compose_has_health "$$1"; then
    printf -- '-'
    return 0
  fi
  docker inspect -f "{{.State.Health.Status}}" "$$__ch2_cid" 2>/dev/null
}

# compose_up <services...>: starts only the given services, waiting until
# each is really ready (healthcheck wait, or a port poll as fallback).
compose_up() {
  compose_enabled || return 0
  [ "$$#" -gt 0 ] || return 0
  require_docker
  __cu_start="$$(date +%s)"
  ui_step "dependencies" "starting $$*"
  $$COMPOSE_CMD up -d "$$@"
  for __cu_svc in "$$@"; do
    if compose_has_health "$$__cu_svc"; then
      if ! $$COMPOSE_CMD up -d --wait --wait-timeout "$$DEV_SERVICE_TIMEOUT" "$$__cu_svc" >/dev/null 2>&1; then
        mkdir -p "$$DEV_LOG_DIR"
        $$COMPOSE_CMD logs --no-color --tail 200 "$$__cu_svc" > "$$DEV_LOG_DIR/$$__cu_svc.log" 2>&1 || true
        ui_fail "$$__cu_svc" "not ready after $${DEV_SERVICE_TIMEOUT}s" "$$DEV_LOG_DIR/$$__cu_svc.log" "docker compose logs $$__cu_svc"
        exit 1
      fi
    else
      __cu_port="$$(compose_port "$$__cu_svc")"
      if [ "$$__cu_port" != "-" ]; then
        __cu_waited=0
        __cu_ready=0
        while [ "$$__cu_waited" -lt "$$DEV_SERVICE_TIMEOUT" ]; do
          if (exec 3<>"/dev/tcp/127.0.0.1/$$__cu_port") 2>/dev/null; then
            exec 3>&- 3<&-
            __cu_ready=1
            break
          fi
          sleep "$$DEV_POLL_INTERVAL"
          __cu_waited=$$(( __cu_waited + DEV_POLL_INTERVAL ))
        done
        if [ "$$__cu_ready" -ne 1 ]; then
          mkdir -p "$$DEV_LOG_DIR"
          $$COMPOSE_CMD logs --no-color --tail 200 "$$__cu_svc" > "$$DEV_LOG_DIR/$$__cu_svc.log" 2>&1 || true
          ui_fail "$$__cu_svc" "port $$__cu_port not open after $${DEV_SERVICE_TIMEOUT}s" "$$DEV_LOG_DIR/$$__cu_svc.log" "docker compose logs $$__cu_svc"
          exit 1
        fi
      fi
    fi
  done
  ui_done "dependencies" "started $$*" "$$__cu_start"
}

# compose_stop <services...>: stops without destroying data.
compose_stop() {
  compose_enabled || return 0
  [ "$$#" -gt 0 ] || return 0
  require_docker
  __cs2_start="$$(date +%s)"
  ui_step "dependencies" "stopping $$*"
  $$COMPOSE_CMD stop "$$@"
  ui_done "dependencies" "stopped $$*" "$$__cs2_start"
}

# compose_down: destroys containers, networks, volumes and orphans. Only
# dev-clean is allowed to call this.
compose_down() {
  compose_enabled || return 0
  require_docker
  $$COMPOSE_CMD down -v --remove-orphans
}
endef
