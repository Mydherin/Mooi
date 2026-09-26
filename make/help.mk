# Single responsibility: the `help` command and its catalog generation.
# A new Global/Support target is documented by writing its `## comment`
# next to it (the single source of the description text) and adding its
# name to the small list below; the Artifacts group needs neither, since
# it is synthesized directly from $(ARTIFACTS).

GLOBAL_TARGETS := dev-start dev-stop dev-restart dev-status dev-clean
SUPPORT_TARGETS := dev-logs dev-preflight-mic-sessions help

# help-desc(target): the ## comment text following `target:` in any
# included makefile, or empty when the target carries none.
help-desc = $(shell grep -h -E '^$(1):.*##' $(MAKEFILE_LIST) 2>/dev/null | head -n 1 | sed -E 's/^[^#]*##[[:space:]]*//')

define help-print-list
$(foreach t,$(1),printf '    %-24s %s\n' "$(t)" "$(call help-desc,$(t))"$(NL))
endef

.PHONY: help

help: ## Show this help
	@$(SHELL_LIB)
	ui_title "Application dev entrypoint"
	printf '  Global\n'
	$(call help-print-list,$(GLOBAL_TARGETS))
	printf '\n'
	if [ -n "$(ARTIFACTS)" ]; then
	  printf '  Artifacts\n'
	  $(foreach a,$(ARTIFACTS),printf '    %-24s %s\n' "dev-start-$(a)" "Start $(a)"$(NL))
	  $(foreach a,$(ARTIFACTS),printf '    %-24s %s\n' "dev-restart-$(a)" "Restart $(a)"$(NL))
	  printf '\n'
	fi
	printf '  Support\n'
	$(call help-print-list,$(SUPPORT_TARGETS))
