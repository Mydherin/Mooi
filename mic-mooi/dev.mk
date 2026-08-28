# Dev entrypoint fragment for mic-mooi. Read by the root Makefile through
# make/artifacts.mk; see Makefile and make/*.mk for the contract.

ARTIFACT_NAME := mic-mooi
ARTIFACT_KIND := mic
ARTIFACT_PORT := $(DEV_PORT_MIC)
ARTIFACT_URL := http://localhost:$(ARTIFACT_PORT)
ARTIFACT_HEALTH := $(ARTIFACT_URL)/actuator/health
ARTIFACT_SERVICES := postgres
ARTIFACT_NEEDS :=

# mic-mooi/shared/Env.java loads mic-mooi/.env then the root .env by
# itself, so the database configuration does not need to be exported here.
#
# The Maven Wrapper (./mvnw) is committed, so Maven itself is not a
# prerequisite: the first run downloads the pinned distribution
# (.mvn/wrapper/maven-wrapper.properties) into ~/.m2/wrapper and caches it.
define start
require_tool java "install Java 25: https://adoptium.net"
artifact_spawn "./mvnw -B -q spring-boot:run"
endef

define stop
artifact_stop
endef

define status
artifact_status_row
endef

define clean
rm -rf "$$ARTIFACT_DIR/target"
endef
