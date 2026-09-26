# GNU Make execs $(SHELL) directly as a single program path (it does not
# parse it as a command line), so `/usr/bin/env bash` does not work here;
# resolve a real bash path via PATH instead, falling back to /bin/bash.
SHELL := $(or $(shell command -v bash 2>/dev/null),/bin/bash)
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help
MAKEFLAGS += --no-print-directory
.ONESHELL:

# --- GNU Make 4+ guard --------------------------------------------------
# This entrypoint requires GNU Make 4+ (macOS ships 3.81). When the running
# make is too old, delegate every goal to `gmake` when it is 4+, otherwise
# fail with install instructions instead of a raw parse error.

MAKE_VERSION_MAJOR := $(firstword $(subst ., ,$(MAKE_VERSION)))
MAKE_VERSION_OK := $(filter $(MAKE_VERSION_MAJOR),4 5 6 7 8 9)

ifeq ($(strip $(MAKE_VERSION_OK)),)

GMAKE := $(shell command -v gmake 2>/dev/null)

ifeq ($(strip $(GMAKE)),)
$(error GNU Make 4+ is required (found make $(MAKE_VERSION)). Install it: macOS -> 'brew install make' (exposes 'gmake'); Linux -> install a current 'make' package (e.g. 'apt-get install make'))
endif

GMAKE_VERSION_MAJOR := $(shell $(GMAKE) --version 2>/dev/null | head -n 1 | sed -E 's/[^0-9]*([0-9]+).*/\1/')
GMAKE_VERSION_OK := $(filter $(GMAKE_VERSION_MAJOR),4 5 6 7 8 9)

ifeq ($(strip $(GMAKE_VERSION_OK)),)
$(error GNU Make 4+ is required. Found make $(MAKE_VERSION) and gmake is also too old. Install a current make: macOS -> 'brew upgrade make'; Linux -> upgrade the 'make' package)
endif

.DEFAULT_GOAL := help
.PHONY: FORCE
%: FORCE
	@$(GMAKE) $@
FORCE: ;
Makefile: ;
make/%.mk: ;
%/dev.mk: ;

else
# --- Real entrypoint (running under GNU Make 4+) ------------------------

DEV_DIR := .dev
DEV_RUN_DIR := $(DEV_DIR)/run
DEV_LOG_DIR := $(DEV_DIR)/logs
export DEV_DIR DEV_RUN_DIR DEV_LOG_DIR

V ?= 0
ifeq ($(V),1)
export DEV_VERBOSE := 1
else
export DEV_VERBOSE := 0
endif

# Literal newline, used to join per-artifact recipe blocks built with foreach.
define NL


endef

# Reverses a list, used to stop artifacts in the opposite order they started.
reverse = $(if $(1),$(call reverse,$(wordlist 2,$(words $(1)),$(1))) $(firstword $(1)))

include make/env.mk
include make/ports.mk
include make/ui.mk
include make/tools.mk
include make/process.mk
include make/compose.mk
include make/artifacts.mk
include make/rules.mk
include make/help.mk

# Shell prelude every recipe starts with: the library functions plus verbose
# tracing when V=1.
define SHELL_LIB
if [ "$$DEV_VERBOSE" = "1" ]; then set -x; fi
export DEV_ROOT="$$(pwd)"
$(UI_LIB)
$(TOOLS_LIB)
$(PROC_LIB)
$(COMPOSE_LIB)
endef

# --- Global commands -------------------------------------------------------

.PHONY: dev-start dev-stop dev-restart

dev-start: ## Start all dependencies and artifacts
	@$(call dev-start-sequence,Application dev entrypoint,$(ARTIFACTS))

dev-stop: ## Stop all artifacts and dependencies
	@$(SHELL_LIB)
	ui_title "Application dev entrypoint"
	$(foreach a,$(call reverse,$(ORDERED_ARTIFACTS)),$(call artifact-stop-block,$(a))$(NL))
	$(call services-stop-block,$(call artifact-services,$(ARTIFACTS)))

dev-restart: ## Restart all dependencies and artifacts
	@$(MAKE) dev-stop
	@$(MAKE) dev-start

STRICT ?= 0
YES ?= 0

.PHONY: dev-status dev-clean dev-logs

dev-status: ## Show the state of the whole application
	@$(SHELL_LIB)
	__svcs="$$(compose_services)"
	__w=8
	for __n in $$__svcs $(ARTIFACTS); do
	  if [ $${#__n} -gt $$__w ]; then __w=$${#__n}; fi
	done
	export DEV_NAME_WIDTH="$$__w"
	ui_table_header "$$__w"
	__running=0
	__stopped=0
	for __svc in $$__svcs; do
	  __state="$$(compose_state "$$__svc")"
	  ui_row "$$__svc" "dep" "$$__state" "-" "$$(compose_port "$$__svc")" "-" "$$(compose_health "$$__svc")" "$$__w"
	  if [ "$$__state" = "RUNNING" ]; then __running=$$(( __running + 1 )); else __stopped=$$(( __stopped + 1 )); fi
	done
	$(foreach a,$(ARTIFACTS),$(call artifact-status-block,$(a))$(NL)if [ "$$LAST_ROW_STATE" = "RUNNING" ]; then __running=$$(( __running + 1 )); else __stopped=$$(( __stopped + 1 )); fi$(NL))
	printf '\n  %s running %s %s stopped\n\n' "$$__running" "$$SYM_BULLET" "$$__stopped"
	if [ "$${STRICT:-0}" = "1" ] && [ "$$__stopped" -gt 0 ]; then
	  exit 1
	fi

dev-clean: ## Stop everything and remove all dev state
	@$(SHELL_LIB)
	ui_title "Application dev entrypoint"
	echo "  This will remove:"
	echo "    - $(DEV_DIR)/ (pid files and logs)"
	$(foreach a,$(ARTIFACTS),echo "    - $($(a)_DIR)/ generated dev state ($(a))"$(NL))
	if compose_enabled; then
	  echo "    - compose containers, networks, volumes and orphans"
	fi
	echo
	if [ "$${YES:-0}" != "1" ]; then
	  if [ ! -t 0 ]; then
	    ui_fail "dev-clean" "confirmation required in a non interactive shell" "-" "re-run with YES=1"
	    exit 1
	  fi
	  printf "  Proceed? [y/N] "
	  read -r __confirm
	  case "$$__confirm" in
	    y|Y|yes|YES) ;;
	    *) ui_info "aborted"; exit 0 ;;
	  esac
	fi
	$(foreach a,$(call reverse,$(ORDERED_ARTIFACTS)),$(call artifact-clean-block,$(a))$(NL))
	compose_down
	rm -rf $(DEV_DIR)
	ui_ok "clean complete"

.PHONY: dev-preflight-mic-sessions
dev-preflight-mic-sessions: ## Check configured Docker engine and Compose for session previews
	@$(SHELL_LIB)
	require_tool uv "install uv: https://docs.astral.sh/uv/"
	cd mic-sessions
	PYTHONPATH=src uv run --locked python -m mic_sessions.shared.docker preflight

dev-logs: ## Tail all artifact logs
	@$(SHELL_LIB)
	__found=0
	for __f in $(DEV_LOG_DIR)/*.log; do
	  if [ -f "$$__f" ]; then __found=1; fi
	done
	if [ "$$__found" = "0" ]; then
	  ui_info "no logs yet"
	  exit 0
	fi
	tail -n $(DEV_LOG_LINES) -F $(DEV_LOG_DIR)/*.log

endif
