# Single responsibility: reusable per-artifact recipe blocks and the
# generated per-artifact targets. Every block takes an artifact name as
# $(1); no recipe logic is ever copy pasted between artifacts.
#
# The per-artifact targets are GNU Make pattern rules (dev-start-%, ...),
# not $(eval)-generated concrete rules: $(eval) re-parses its argument as
# makefile syntax, which requires a literal tab on every recipe line, and
# the multi-line library macros below (SHELL_LIB, artifact-*-block, ...)
# do not carry one on their embedded continuation lines. A directly
# authored pattern rule only expands its recipe once, at execution time,
# so no such re-parse ever happens. Their concrete names (dev-start-foo,
# ...) must never be listed in .PHONY: on this make version, that makes
# GNU Make treat the name as already explicit and skip the pattern rule
# entirely ("Nothing to be done"). The raw patterns are listed instead.

# artifact-env-block(name): exports the runtime contract shell variables
# read by the fragment's start/stop/status/clean bodies and by PROC_LIB.
define artifact-env-block
export ARTIFACT_NAME="$(1)"
export ARTIFACT_DIR="$($(1)_DIR)"
export ARTIFACT_KIND="$($(1)_KIND)"
export ARTIFACT_PORT="$($(1)_PORT)"
export ARTIFACT_URL="$($(1)_URL)"
export ARTIFACT_HEALTH="$($(1)_HEALTH)"
export PID_FILE="$$DEV_ROOT/$(DEV_RUN_DIR)/$(1).pid"
export LOG_FILE="$$DEV_ROOT/$(DEV_LOG_DIR)/$(1).log"
endef

# artifact-start-block(name): idempotent start plus a summary line on success.
define artifact-start-block
$(call artifact-env-block,$(1))
if artifact_running; then
  ui_info "$(1) already running"
else
  __elem_start=$$(date +%s)
  ui_step "$(1)" "starting"
  $($(1)_START)
  if ! artifact_wait_ready; then
    exit 1
  fi
  ui_done "$(1)" "started" "$$__elem_start"
  SUMMARY="$${SUMMARY}$$(printf '  %-24s %s' "$(1)" "$${ARTIFACT_URL:--}")"$$'\n'
fi
endef

# artifact-stop-block(name): idempotent stop, delegating to the fragment.
define artifact-stop-block
$(call artifact-env-block,$(1))
$($(1)_STOP)
endef

# artifact-clean-block(name): stops first (safe on a running artifact),
# then removes the artifact's generated dev state.
define artifact-clean-block
$(call artifact-env-block,$(1))
$($(1)_STOP)
$($(1)_CLEAN)
endef

# artifact-status-block(name): prints one dev-status table row. Callers
# must export DEV_NAME_WIDTH first.
define artifact-status-block
$(call artifact-env-block,$(1))
$($(1)_STATUS)
endef

# services-start-block(services): starts an explicit service list.
# compose_up already no-ops when the list or the compose layer is empty.
define services-start-block
compose_up $(1)
endef

# services-stop-block(services): stops an explicit service list without
# destroying data. compose_stop already no-ops when the list is empty.
define services-stop-block
compose_stop $(1)
endef

# one-service-conditional-stop(name,service): stops `service` unless
# another currently running artifact still needs it.
define one-service-conditional-stop
__svc_needed=0
for __svc_pf in $(foreach o,$(call artifact-others-needing,$(1),$(2)),"$$DEV_ROOT/$(DEV_RUN_DIR)/$(o).pid"); do
  __svc_pid="$$(cat "$$__svc_pf" 2>/dev/null | tr -dc '0-9')"
  if [ -n "$$__svc_pid" ] && proc_alive "$$__svc_pid"; then
    __svc_needed=1
  fi
done
if [ "$$__svc_needed" -eq 1 ]; then
  ui_info "$(2) kept (still needed by another running artifact)"
else
  compose_stop $(2)
fi
endef

# artifact-scoped-stop-services-block(name): stops name's own services,
# each conditional on no other running artifact still needing it.
define artifact-scoped-stop-services-block
$(foreach s,$($(1)_SERVICES),$(call one-service-conditional-stop,$(1),$(s))$(NL))
endef

# dev-start-sequence(title, artifact-list): starts the services needed by
# artifact-list, then every artifact in artifact-list's dependency-closure
# order, printing a title, one line per step and a final summary. Shared by
# the global dev-start and every dev-start-<artifact>.
define dev-start-sequence
$(SHELL_LIB)
__seq_start=$$(date +%s)
ui_title "$(1)"
SUMMARY=""
$(call services-start-block,$(call artifact-services,$(2)))
$(foreach a,$(call artifact-order,$(2)),$(call artifact-start-block,$(a))$(NL))
if [ -n "$$SUMMARY" ]; then
  ui_title "Started"
  printf '%s' "$$SUMMARY"
fi
ui_muted "$$(printf 'total %s' "$$(ui_elapsed $$__seq_start)")"
endef

# --- Per-artifact pattern rules --------------------------------------------

# validate-artifact-stem: aborts with a clear message when $* is not a
# known artifact. Must be the first recipe line of every rule below.
define validate-artifact-stem
$(if $(filter $*,$(ARTIFACTS)),,$(error Unknown artifact '$*'. Known artifacts: $(ARTIFACTS)))
endef

.PHONY: dev-start-% dev-stop-% dev-restart-% dev-status-% dev-clean-% dev-logs-%

# Not documented via ## here: make/help.mk synthesizes the Artifacts group
# directly from $(ARTIFACTS) instead of scraping these pattern rules.

# Start <artifact> and what it needs.
dev-start-%:
	@$(validate-artifact-stem)
	$(call dev-start-sequence,$*,$*)

# Stop <artifact> only.
dev-stop-%:
	@$(validate-artifact-stem)
	$(SHELL_LIB)
	$(call artifact-stop-block,$*)
	$(call artifact-scoped-stop-services-block,$*)

# Restart <artifact> and what it needs.
dev-restart-%:
	@$(validate-artifact-stem)
	@$(MAKE) dev-stop-$*
	@$(MAKE) dev-start-$*

# Show the state of <artifact>.
dev-status-%:
	@$(validate-artifact-stem)
	$(SHELL_LIB)
	__name="$*"
	__w=$${#__name}
	[ "$$__w" -ge 8 ] || __w=8
	export DEV_NAME_WIDTH="$$__w"
	ui_table_header "$$DEV_NAME_WIDTH"
	$(call artifact-status-block,$*)

# Stop and remove <artifact> dev state.
dev-clean-%:
	@$(validate-artifact-stem)
	$(SHELL_LIB)
	$(call artifact-clean-block,$*)

# Tail the logs of <artifact>.
dev-logs-%:
	@$(validate-artifact-stem)
	$(SHELL_LIB)
	$(call artifact-env-block,$*)
	if [ -f "$$LOG_FILE" ]; then
	  tail -n $(DEV_LOG_LINES) -F "$$LOG_FILE"
	else
	  ui_info "$* has no log yet"
	fi
