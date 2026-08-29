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
- Docker Engine + Docker Compose V2

Maven is **not** required: `mic-mooi` ships the Maven Wrapper (`mvnw`) and the first
`make dev-start` downloads the pinned distribution into `~/.m2/wrapper`.

## Setup

```bash
cp .env.example .env
cp mic-mooi/.env.example mic-mooi/.env
```

Configuration lives in each artifact's `.env`, plus the root `.env` for the data layer and the dev
entrypoint. Set your own credentials before the first run.

### Google OAuth2

1. Create an OAuth 2.0 Client ID (type *Web application*) in the Google Cloud console.
2. Authorized JavaScript origin: `http://localhost:28471` (the pinned SPA dev port, see
   *Dev ports* below). No redirect URI is needed (Google
   Identity Services returns the ID token in the browser).
3. Set in `mic-mooi/.env`: `GOOGLE_CLIENT_ID`, `JWT_SECRET` (>= 32 bytes), `ADMIN_EMAILS`
   (comma separated), `CORS_ORIGIN`.
4. Set in `spa-mooi/.env`: `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID` (same client id).

The first sign-in of an address listed in `ADMIN_EMAILS` creates that player with the admin role;
adding an address later never promotes an existing player.

### GitHub OAuth2

Links a GitHub account to an existing player. It never signs anyone in — sign-in stays Google-only.

1. Create a **GitHub App** (Settings → Developer settings → GitHub Apps → New GitHub App).
2. Enable **Expire user authorization tokens**: it is the only setup that issues refresh tokens,
   which is what keeps the link alive without asking the player to authorize again.
3. Enable **Request user authorization (OAuth) during installation**, and grant **Repository
   permissions → Metadata: Read-only**: this is what lets an installation be redeemed as a login and
   lets the app list the repositories it was granted.
4. Callback URL: `http://localhost:28471/account/github/callback` (pinned SPA dev port; `make`
   exports the matching `GITHUB_REDIRECT_URI` automatically).
5. Generate a client secret, then set in `mic-mooi/.env`: `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`.
6. Set `GITHUB_APP_SLUG` in `mic-mooi/.env` to the app's URL slug (the last segment of
   `https://github.com/apps/<slug>`). It sends players to the install-and-authorize page, which is
   what makes private repositories selectable — without it only public repositories are listed.
7. Generate the key encrypting stored GitHub tokens at rest and set it as `SECRETS_KEY`:

```bash
openssl rand -base64 32
```

The SPA needs no GitHub variable: it asks the API for a ready-made authorize URL.

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

### Dev ports

`make` pins every dev service to a fixed, uncommon port, hardcoded in `make/ports.mk` and
exported so Vite, the microservice and docker compose all use it regardless of their `.env`
values. The `.env` files carry the same numbers as a fallback for non-`make` usage.

| Service | Port | URL |
| --- | --- | --- |
| `spa-mooi` | `28471` | `http://localhost:28471` |
| `mic-mooi` | `39615` | `http://localhost:39615` |
| `postgres` | `54983` | `localhost:54983` |
| `pgadmin` | `51247` | `http://localhost:51247` |

Change a port in `make/ports.mk`; the cross-artifact wiring (`VITE_API_BASE_URL`, `CORS_ORIGIN`,
`GITHUB_REDIRECT_URI`) follows automatically.

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
| `VITE_API_BASE_URL` | mic-mooi base URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth2 client id |
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
| `CORS_ORIGIN` | Allowed CORS origins |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client id / expected token `aud` |
| `JWT_SECRET` | HS256 access-token signing key (>= 32 bytes) |
| `ACCESS_TOKEN_EXPIRES_IN` | Access token lifetime (e.g. `15m`) |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifetime, re-issued on every rotation (e.g. `365d`) |
| `SESSION_MAX_LIFETIME` | Absolute session ceiling from its creation (e.g. `730d`) |
| `REFRESH_TOKEN_PURGE_CRON` | Cron deleting expired refresh tokens |
| `REPLAY_GRACE_SECONDS` | Grace window for concurrent refresh-token reuse |
| `ADMIN_EMAILS` | Comma-separated addresses granted admin at signup |
| `SECRETS_KEY` | AES-256-GCM key encrypting third-party tokens at rest (32 bytes, base64) |
| `GITHUB_CLIENT_ID` | GitHub App client id |
| `GITHUB_CLIENT_SECRET` | GitHub App client secret |
| `GITHUB_APP_SLUG` | GitHub App URL slug; enables the install-and-authorize flow |
| `GITHUB_REDIRECT_URI` | Callback registered on the GitHub App |
| `GITHUB_AUTHORIZE_URI` | GitHub authorization endpoint |
| `GITHUB_TOKEN_URI` | GitHub token endpoint |
| `GITHUB_API_BASE_URL` | GitHub REST API base URL |
| `GITHUB_STATE_EXPIRES_IN` | Lifetime of the signed OAuth2 `state` (e.g. `10m`) |
| `GITHUB_TOKEN_REFRESH_SKEW` | Renew the GitHub token this long before it expires |
| `GITHUB_REQUEST_TIMEOUT_MS` | Per-call timeout against GitHub |
| `LOG_LEVEL_ROOT` | Root log level |
| `LOG_LEVEL_APP` | Application log level |
| `LOG_LEVEL_AUTH` | Auth log level |
| `LOG_LEVEL_GITHUB` | GitHub integration log level |

### mic-mooi endpoints

| Endpoint | Description |
| --- | --- |
| `GET /api/landing/highlights` | List landing highlights |
| `GET /api/landing/highlights/{slug}` | Get a highlight by slug |
| `POST /api/landing/highlights` | Create a highlight |
| `GET /api/heartbeats` | List recent heartbeats |
| `GET /api/heartbeats/latest` | Get the latest heartbeat |
| `POST /auth/google` | Sign in or sign up with a Google ID token |
| `POST /auth/refresh` | Rotate the refresh token, mint a new access token |
| `POST /auth/logout` | Revoke the session behind a refresh token |
| `POST /auth/logout-all` | Revoke every session of the caller |
| `GET /me` | Current player (requires a live session) |
| `POST /me/github/authorization` | Start the GitHub link, returns an authorize URL |
| `POST /me/github/connection` | Redeem the GitHub authorization code |
| `GET /me/github/connection` | Current GitHub connection, or `null` |
| `DELETE /me/github/connection` | Unlink the GitHub account |
| `GET /me/github/repositories` | Repositories the linked GitHub account reaches |
| `GET /me/projects` | Repositories added to the caller's workspace |
| `POST /me/projects` | Add a repository by `owner/repository` |
| `DELETE /me/projects/{projectId}` | Remove a repository from the workspace |
| `GET /admin/ping` | Admin-only probe |
| `GET /health` | Liveness probe |
| `GET /actuator/health` | Health check |
