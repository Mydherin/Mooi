# Mooi

Monorepository. Each artifact lives in its own root-level directory.

| Artifact | Description |
| --- | --- |
| `spa-mooi` | Vite + React + TypeScript SPA (UI) |
| `mic-mooi` | Spring Boot microservice (API) |
| `compose.dev.yml` | Postgres + pgAdmin data layer (dev) |

## Requirements

- GNU Make >= 4 (macOS ships 3.81 — install with `brew install make`, exposed as `gmake`; the root `Makefile` delegates to it automatically)
- [Bun](https://bun.sh) >= 1.3 (falls back to npm)
- Java 25
- Maven >= 3.9
- Docker Engine + Docker Compose V2

## Setup

```bash
cp .env.example .env
cp mic-mooi/.env.example mic-mooi/.env
```

Configuration lives in each artifact's `.env`, plus the root `.env` for the data layer and the dev
entrypoint. Set your own credentials before the first run.

## Dev entrypoint

The whole application in dev is driven only through the root `Makefile`. It starts, stops, inspects
and cleans every artifact and every artifact dependency (Postgres, pgAdmin), in the right order,
with health checks, logs and a status table. Never run a package manager, a build tool, docker or
docker compose directly for these operations — use the targets below.

```bash
make            # same as `make help`
```

### Global commands

| Command | Description |
| --- | --- |
| `make dev-start` | Start all dependencies and artifacts |
| `make dev-stop` | Stop all artifacts and dependencies |
| `make dev-status` | Show the state of the whole application |
| `make dev-clean` | Stop everything and remove all dev state |

### Scoped commands

Every artifact gets the same set of commands, scoped to it and to what it needs:

| Command | Description |
| --- | --- |
| `make dev-start-<artifact>` | Start `<artifact>` and its dependencies |
| `make dev-stop-<artifact>` | Stop `<artifact>` only |
| `make dev-status-<artifact>` | Show the state of `<artifact>` |
| `make dev-clean-<artifact>` | Stop `<artifact>` and remove its dev state |
| `make dev-logs-<artifact>` | Tail the logs of `<artifact>` |

Current artifacts: `spa-mooi`, `mic-mooi` (e.g. `make dev-start-mic-mooi`).

### Support commands

| Command | Description |
| --- | --- |
| `make dev-logs` | Tail all artifact logs |
| `make help` | Show this help |

### Flags

| Flag | Effect |
| --- | --- |
| `V=1` | Verbose: trace every shell command instead of the normal output |
| `YES=1` | Skip the confirmation prompt on `dev-clean` |
| `STRICT=1` | `dev-status` exits non-zero when anything is not `RUNNING` |
| `NO_COLOR=1` | Disable colored output |
| `DEV_ASCII=1` | Use ASCII symbols instead of Unicode |

### Runtime layout

```
.dev/run/<artifact>.pid   process id of a running artifact
.dev/logs/<artifact>.log  stdout/stderr of a running artifact
```

Both are dev-only, git ignored, and fully removed by `make dev-clean`.

### Adding an artifact

Any directory matching `<kind>-<name>` with a `dev.mk` fragment is picked up automatically and gets
the full command set above. `dev.mk` is the contract: it declares `ARTIFACT_NAME`, `ARTIFACT_KIND`,
`ARTIFACT_PORT`, `ARTIFACT_URL`, `ARTIFACT_HEALTH`, `ARTIFACT_SERVICES`, `ARTIFACT_NEEDS`, and the
`start`/`stop`/`status`/`clean` lifecycle bodies. See `spa-mooi/dev.mk` and `mic-mooi/dev.mk` for
reference implementations.

## Configuration

### Data layer (root `.env`)

| Variable | Description |
| --- | --- |
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_SCHEMA` | Database schema |
| `POSTGRES_HOST` | Host reaching the engine |
| `POSTGRES_PORT` | Engine port on the host |
| `PGADMIN_EMAIL` | Console login email |
| `PGADMIN_PASSWORD` | Console login password |
| `PGADMIN_PORT` | Console port on the host |

### Dev entrypoint (root `.env`)

| Variable | Description |
| --- | --- |
| `DEV_HEALTH_TIMEOUT` | Seconds waiting for an artifact to become healthy |
| `DEV_STOP_TIMEOUT` | Seconds before forcing a stop |
| `DEV_SERVICE_TIMEOUT` | Seconds waiting for a compose service |
| `DEV_POLL_INTERVAL` | Seconds between polls |
| `DEV_LOG_LINES` | Lines shown by `dev-logs` |

Open the pgAdmin console at `http://localhost:${PGADMIN_PORT}` and log in with `PGADMIN_EMAIL` /
`PGADMIN_PASSWORD`. Register the server once with host `postgres`, port `5432`, and the
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` values.

### spa-mooi (`spa-mooi/.env`)

All variables must be prefixed with `VITE_`.

| Variable | Description |
| --- | --- |
| `VITE_DEV_HOST` | Dev server host |
| `VITE_DEV_PORT` | Dev server port |
| `VITE_PREVIEW_PORT` | Preview server port |
| `VITE_APP_NAME` | Application name |
| `VITE_APP_TAGLINE` | Headline tagline |
| `VITE_APP_DESCRIPTION` | Meta and hero description |
| `VITE_APP_VERSION` | Displayed version |
| `VITE_GITHUB_URL` | Repository link |
| `VITE_DOCS_URL` | Docs link |
| `VITE_CONTACT_EMAIL` | Contact email |
| `VITE_STORAGE_PREFIX` | Local storage key prefix |

### mic-mooi (`mic-mooi/.env`)

Loaded by a dependency-free loader that also reads the root `.env`, so database variables are
inherited and never duplicated. Precedence: real environment variables, then `mic-mooi/.env`, then
the root `.env`.

| Variable | Description |
| --- | --- |
| `APP_NAME` | Application name |
| `APP_VERSION` | Displayed version |
| `SERVER_PORT` | HTTP server port |
| `DB_POOL_MAX_SIZE` | Connection pool max size |
| `DB_POOL_MIN_IDLE` | Connection pool min idle |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | Connection pool timeout (ms) |
| `DB_MIGRATIONS_ENABLED` | Toggle Liquibase migrations |
| `WEB_CORS_ALLOWED_ORIGINS` | Allowed CORS origins |
| `LOG_LEVEL_ROOT` | Root log level |
| `LOG_LEVEL_APP` | Application log level |

### mic-mooi endpoints

| Endpoint | Description |
| --- | --- |
| `GET /api/landing/highlights` | List landing highlights |
| `GET /api/landing/highlights/{slug}` | Get a highlight by slug |
| `POST /api/landing/highlights` | Create a highlight |
| `GET /api/heartbeats` | List recent heartbeats |
| `GET /api/heartbeats/latest` | Get the latest heartbeat |
| `GET /actuator/health` | Health check |
