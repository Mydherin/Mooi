# Production image of mic-mooi. Configuration comes only from environment variables (no .env file
# is copied); see deploy/production/compose.prod.yml.

# ── Build ────────────────────────────────────────────────────
FROM eclipse-temurin:25-jdk AS build

WORKDIR /app

# Dependency layer, cached until pom.xml or the wrapper change.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 chmod +x mvnw && ./mvnw -B -q dependency:go-offline

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q package -Dmaven.test.skip=true \
    && java -Djarmode=tools -jar target/mic-mooi.jar extract --layers --launcher --destination extracted

# ── Runtime ──────────────────────────────────────────────────
FROM eclipse-temurin:25-jre AS runtime

RUN groupadd -g 1001 mooi && useradd -u 1001 -g mooi -M -s /usr/sbin/nologin mooi

WORKDIR /app

# Spring Boot layers, least to most volatile.
COPY --from=build --chown=mooi:mooi /app/extracted/dependencies/ ./
COPY --from=build --chown=mooi:mooi /app/extracted/spring-boot-loader/ ./
COPY --from=build --chown=mooi:mooi /app/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=mooi:mooi /app/extracted/application/ ./

USER mooi

ENV SERVER_PORT=8080 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080

# The JRE image ships no HTTP client: bash /dev/tcp asks the readiness probe directly.
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
    CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /actuator/health/readiness HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && grep -q '\"UP\"' <&3"]

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
