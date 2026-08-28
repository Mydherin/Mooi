# Single responsibility: artifact process lifecycle. Defines PROC_LIB.
# Uses the runtime contract shell variables set by the caller before
# invoking any function here: ARTIFACT_NAME, ARTIFACT_DIR, ARTIFACT_PORT,
# ARTIFACT_URL, ARTIFACT_HEALTH, PID_FILE, LOG_FILE.

define PROC_LIB
__stat_mtime() {
  if [ "$$(uname -s)" = "Darwin" ]; then
    stat -f %m "$$1" 2>/dev/null
  else
    stat -c %Y "$$1" 2>/dev/null
  fi
}

proc_alive() {
  __pa_pid="$$1"
  [ -n "$$__pa_pid" ] && kill -0 "$$__pa_pid" >/dev/null 2>&1
}

# artifact_pid: prints the pid when the pid file exists and the process is
# alive, empty otherwise. Never mutates state.
artifact_pid() {
  if [ -f "$$PID_FILE" ]; then
    __ap_pid="$$(cat "$$PID_FILE" 2>/dev/null | tr -dc '0-9')"
    if [ -n "$$__ap_pid" ] && proc_alive "$$__ap_pid"; then
      printf '%s' "$$__ap_pid"
    fi
  fi
}

artifact_running() {
  __ar_pid="$$(artifact_pid)"
  [ -n "$$__ar_pid" ]
}

# artifact_spawn <command>: runs <command> detached in ARTIFACT_DIR, in its
# own process group, redirecting output to LOG_FILE and recording the pid.
artifact_spawn() {
  __as_cmd="$$1"
  mkdir -p "$$DEV_RUN_DIR" "$$DEV_LOG_DIR"
  {
    printf -- '--- %s: starting "%s" at %s ---\n' "$$ARTIFACT_NAME" "$$__as_cmd" "$$(date '+%Y-%m-%d %H:%M:%S')"
  } >> "$$LOG_FILE"
  (
    cd "$$ARTIFACT_DIR"
    set -m
    nohup bash -c "$$__as_cmd" >> "$$LOG_FILE" 2>&1 &
    echo $$! > "$$PID_FILE"
  )
}

# artifact_health: 0 (healthy) when ARTIFACT_HEALTH is empty, an http(s) url
# is probed with curl, anything else is run as a shell command.
artifact_health() {
  if [ -z "$${ARTIFACT_HEALTH:-}" ]; then
    return 0
  fi
  case "$$ARTIFACT_HEALTH" in
    http://*|https://*)
      curl -fsS --max-time 3 -o /dev/null "$$ARTIFACT_HEALTH" >/dev/null 2>&1
      ;;
    *)
      bash -c "$$ARTIFACT_HEALTH" >/dev/null 2>&1
      ;;
  esac
}

# artifact_wait_ready: polls health until ready, the pid dies, or timeout.
artifact_wait_ready() {
  __awr_waited=0
  while [ "$$__awr_waited" -lt "$$DEV_HEALTH_TIMEOUT" ]; do
    __awr_pid="$$(artifact_pid)"
    if [ -z "$$__awr_pid" ]; then
      ui_fail "$$ARTIFACT_NAME" "process died while starting" "$$LOG_FILE" "make dev-logs-$$ARTIFACT_NAME"
      return 1
    fi
    if artifact_health; then
      return 0
    fi
    sleep "$$DEV_POLL_INTERVAL"
    __awr_waited=$$(( __awr_waited + DEV_POLL_INTERVAL ))
  done
  ui_fail "$$ARTIFACT_NAME" "not healthy after $${DEV_HEALTH_TIMEOUT}s" "$$LOG_FILE" "make dev-logs-$$ARTIFACT_NAME"
  return 1
}

# artifact_stop: idempotent. Reports a stale pid file as already stopped,
# TERMs the process group, escalates to KILL after DEV_STOP_TIMEOUT.
artifact_stop() {
  if [ ! -f "$$PID_FILE" ]; then
    ui_info "$$ARTIFACT_NAME already stopped"
    return 0
  fi
  __ast_pid="$$(cat "$$PID_FILE" 2>/dev/null | tr -dc '0-9')"
  if [ -z "$$__ast_pid" ] || ! proc_alive "$$__ast_pid"; then
    rm -f "$$PID_FILE"
    ui_info "$$ARTIFACT_NAME already stopped (stale pid file removed)"
    return 0
  fi
  __ast_start="$$(date +%s)"
  ui_step "$$ARTIFACT_NAME" "stopping"
  kill -TERM "-$$__ast_pid" >/dev/null 2>&1 || kill -TERM "$$__ast_pid" >/dev/null 2>&1 || true
  __ast_waited=0
  while proc_alive "$$__ast_pid" && [ "$$__ast_waited" -lt "$$DEV_STOP_TIMEOUT" ]; do
    sleep "$$DEV_POLL_INTERVAL"
    __ast_waited=$$(( __ast_waited + DEV_POLL_INTERVAL ))
  done
  if proc_alive "$$__ast_pid"; then
    kill -KILL "-$$__ast_pid" >/dev/null 2>&1 || kill -KILL "$$__ast_pid" >/dev/null 2>&1 || true
    rm -f "$$PID_FILE"
    ui_warn "$$ARTIFACT_NAME force stopped after $${DEV_STOP_TIMEOUT}s"
    return 0
  fi
  rm -f "$$PID_FILE"
  ui_done "$$ARTIFACT_NAME" "stopped" "$$__ast_start"
}

# artifact_state: prints RUNNING, STOPPED, STARTING, UNHEALTHY or UNKNOWN.
# Read only, never mutates the pid file or process.
artifact_state() {
  if [ ! -f "$$PID_FILE" ]; then
    printf 'STOPPED'
    return 0
  fi
  __as2_pid="$$(cat "$$PID_FILE" 2>/dev/null | tr -dc '0-9')"
  if [ -z "$$__as2_pid" ]; then
    printf 'UNKNOWN'
    return 0
  fi
  if ! proc_alive "$$__as2_pid"; then
    printf 'STOPPED'
    return 0
  fi
  if artifact_health; then
    printf 'RUNNING'
    return 0
  fi
  __as2_mtime="$$(__stat_mtime "$$PID_FILE")"
  __as2_now="$$(date +%s)"
  if [ -n "$$__as2_mtime" ]; then
    __as2_age=$$(( __as2_now - __as2_mtime ))
    if [ "$$__as2_age" -lt "$$DEV_HEALTH_TIMEOUT" ]; then
      printf 'STARTING'
    else
      printf 'UNHEALTHY'
    fi
  else
    printf 'UNKNOWN'
  fi
}

# artifact_status_row: prints one dev-status table row for the current
# artifact using the runtime contract shell variables. Shared by every
# fragment's `status` macro so the row layout is defined exactly once.
artifact_status_row() {
  __asr_state="$$(artifact_state)"
  case "$$__asr_state" in
    RUNNING) __asr_health="healthy" ;;
    UNHEALTHY) __asr_health="unhealthy" ;;
    *) __asr_health="-" ;;
  esac
  ui_row "$$ARTIFACT_NAME" "$$ARTIFACT_KIND" "$$__asr_state" "$$(artifact_pid)" "$$ARTIFACT_PORT" "$$ARTIFACT_URL" "$$__asr_health" "$${DEV_NAME_WIDTH:-8}"
  LAST_ROW_STATE="$$__asr_state"
}
endef
