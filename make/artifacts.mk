# Single responsibility: artifact discovery, fragment loading and ordering.
#
# A root level directory is an artifact only when it exposes its own
# dev.mk. Detection is dynamic through $(wildcard */dev.mk); adding or
# removing an artifact directory is enough for every global command to
# cover it. make/ is never matched by this wildcard (no file in make/ is
# ever named dev.mk).

ARTIFACT_FRAGMENTS := $(sort $(wildcard */dev.mk))
ARTIFACTS :=

# artifact-register(fragment): snapshots the shared ARTIFACT_* variables and
# start/stop/status/clean macros just set by `include $(fragment)` into
# variables namespaced by the artifact name, so the next fragment cannot
# collide with this one. Single $ throughout: this text is expanded once,
# as the argument to the $(eval ...) that invokes it, before eval parses
# the result as makefile syntax (the nested `define ... endef` blocks are
# then captured verbatim by that parse, preserving whatever shell escaping
# the fragment author wrote in start/stop/status/clean).
define artifact-register
$(if $(strip $(ARTIFACT_NAME)),,$(error $(1): must set ARTIFACT_NAME))
$(if $(filter $(ARTIFACT_NAME),$(patsubst %/dev.mk,%,$(1))),,$(error $(1): ARTIFACT_NAME '$(ARTIFACT_NAME)' must match its directory name '$(patsubst %/dev.mk,%,$(1))'))
$(if $(findstring -,$(ARTIFACT_NAME)),,$(error $(1): artifact directory '$(ARTIFACT_NAME)' must follow the <kind>-<artifact-name> format))
$(if $(filter $(ARTIFACT_KIND),$(firstword $(subst -, ,$(ARTIFACT_NAME)))),,$(error $(1): ARTIFACT_KIND '$(ARTIFACT_KIND)' must equal the directory prefix '$(firstword $(subst -, ,$(ARTIFACT_NAME)))'))
ARTIFACTS += $(ARTIFACT_NAME)
$(ARTIFACT_NAME)_DIR := $(patsubst %/dev.mk,%,$(1))
$(ARTIFACT_NAME)_KIND := $(ARTIFACT_KIND)
$(ARTIFACT_NAME)_PORT := $(ARTIFACT_PORT)
$(ARTIFACT_NAME)_URL := $(ARTIFACT_URL)
$(ARTIFACT_NAME)_HEALTH := $(ARTIFACT_HEALTH)
$(ARTIFACT_NAME)_SERVICES := $(ARTIFACT_SERVICES)
$(ARTIFACT_NAME)_NEEDS := $(ARTIFACT_NEEDS)
define $(ARTIFACT_NAME)_START
$(value start)
endef
define $(ARTIFACT_NAME)_STOP
$(value stop)
endef
define $(ARTIFACT_NAME)_STATUS
$(value status)
endef
define $(ARTIFACT_NAME)_CLEAN
$(value clean)
endef
endef

# artifact-forget: clears the shared fragment variable names so a fragment
# that forgets to set one of them cannot silently inherit the previous
# fragment's value.
define artifact-forget
undefine ARTIFACT_NAME
undefine ARTIFACT_KIND
undefine ARTIFACT_PORT
undefine ARTIFACT_URL
undefine ARTIFACT_HEALTH
undefine ARTIFACT_SERVICES
undefine ARTIFACT_NEEDS
undefine start
undefine stop
undefine status
undefine clean
endef

$(foreach fragment,$(ARTIFACT_FRAGMENTS),\
  $(eval include $(fragment))\
  $(eval $(call artifact-register,$(fragment)))\
  $(eval $(call artifact-forget)))

ARTIFACTS := $(sort $(ARTIFACTS))

# Every declared NEEDS must name a known artifact.
$(foreach a,$(ARTIFACTS),\
  $(foreach dep,$($(a)_NEEDS),\
    $(if $(filter $(dep),$(ARTIFACTS)),,\
      $(error $(a)/dev.mk: ARTIFACT_NEEDS '$(dep)' is not a known artifact))))

# --- Topological order (start order); dev-stop uses its reverse ----------

VISITING :=
VISITED :=
ORDERED_ARTIFACTS :=

define artifact-visit
$(if $(filter $(1),$(VISITING)),$(error Dependency cycle detected: $(VISITING) $(1)))
$(if $(filter $(1),$(VISITED)),,\
  $(eval VISITING += $(1))\
  $(foreach dep,$($(1)_NEEDS),$(call artifact-visit,$(dep)))\
  $(eval VISITED += $(1))\
  $(eval ORDERED_ARTIFACTS += $(1))\
  $(eval VISITING := $(filter-out $(1),$(VISITING))))
endef

$(foreach a,$(ARTIFACTS),$(call artifact-visit,$(a)))

# --- Pure helpers used by make/rules.mk -----------------------------------

# artifact-closure(name): name plus its transitive ARTIFACT_NEEDS, deduped.
# Safe from infinite recursion: the cycle check above already ran for every
# artifact before this is ever called.
artifact-closure = $(sort $(1) $(foreach dep,$($(1)_NEEDS),$(call artifact-closure,$(dep))))

# artifact-order(names): names plus their closures, in ORDERED_ARTIFACTS
# order (dependencies before dependents).
artifact-order = $(strip $(filter $(sort $(foreach n,$(1),$(call artifact-closure,$(n)))),$(ORDERED_ARTIFACTS)))

# artifact-services(names): deduplicated union of ARTIFACT_SERVICES over names.
artifact-services = $(sort $(foreach n,$(1),$($(n)_SERVICES)))

# artifact-others-needing(name,service): other artifacts (not name) that
# also declare `service`, used to decide whether a scoped dev-stop may stop
# a shared dependency (the shell block still checks which of these are
# actually running before deciding).
artifact-others-needing = $(strip $(foreach n,$(filter-out $(1),$(ARTIFACTS)),$(if $(filter $(2),$($(n)_SERVICES)),$(n))))
