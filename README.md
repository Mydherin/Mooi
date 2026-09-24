# Mooi

Monorepository. Each artifact lives in its own root-level directory.

| Artifact | Description |
| --- | --- |
| `spa-mooi` | Vite + React + TypeScript SPA (UI) |
| `mic-mooi` | Spring Boot microservice (API) |
| `mic-sessions` | FastAPI microservice (real-time agent sessions) |
| `compose.dev.yml` | Postgres + pgAdmin data layer (dev) |

## Requirements

- GNU Make >= 4 (macOS ships 3.81 — install with `brew install make`, exposed as `gmake`; the root `Makefile` delegates to it automatically)
- [Bun](https://bun.sh) >= 1.3 (falls back to npm)
- Java 25
- [uv](https://docs.astral.sh/uv/) (Python package manager for `mic-sessions`)
- `git` CLI (one independent clone per agent session)
- Docker Engine + Docker Compose V2 (data layer and session deployments)

Maven is **not** required: `mic-mooi` ships the Maven Wrapper (`mvnw`) and the first
`make dev-start` downloads the pinned distribution into `~/.m2/wrapper`.

## Setup

```bash
cp .env.example .env
cp mic-mooi/.env.example mic-mooi/.env
cp mic-sessions/.env.example mic-sessions/.env
cp spa-mooi/.env.example spa-mooi/.env
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
   permissions → Metadata: Read-only** and **Contents: Read-only**: this is what lets an
   installation be redeemed as a login and lets the app list the repositories it was granted.
4. Callback URL: `http://localhost:28471/account/github/callback` (pinned SPA dev port; `make`
   exports the matching `GITHUB_REDIRECT_URI` automatically).
5. Generate a client secret, then set in `mic-mooi/.env`: `GITHUB_CLIENT_ID`,
   `GITHUB_CLIENT_SECRET`.
6. Set `GITHUB_APP_SLUG` in `mic-mooi/.env` to the app's URL slug (the last segment of
   `https://github.com/apps/<slug>`). It backs the **Repository access** action, which is the
   install-and-authorize page — without it players are sent to their GitHub installations screen
   instead, one step longer.
7. Generate the key encrypting stored GitHub tokens at rest and set it as `SECRETS_KEY`:

```bash
openssl rand -base64 32
```

8. **Install the app on every account owning repositories to work on** — the personal account and
   each organization. Authorizing grants an identity; only an installation decides which
   repositories the grant may read, so private repositories of an account with no installation are
   invisible to Mooi by GitHub's design and no configuration can widen that.

The SPA needs no GitHub variable: it asks the API for ready-made authorize and install URLs.

### Agent providers

Links a player's own Claude subscription so `mic-sessions` can run agent sessions on their behalf.
Credentials are stored by `mic-mooi` and handed to `mic-sessions` server-to-server; the browser
never sees a raw token.

1. Generate a shared secret and set it as `SERVICE_TOKEN` in **both** `mic-mooi/.env` and
   `mic-sessions/.env` (identical value, >= 32 bytes) — it guards the endpoints that hand a
   third-party credential to `mic-sessions`:

```bash
openssl rand -base64 32
```

2. Copy `mic-mooi/.env`'s `JWT_SECRET` into `mic-sessions/.env` as well: `mic-sessions` verifies
   access tokens locally with the same signing key, no network hop required for that check.
3. Two credential modes are supported, both stored the same way and both mapped to the same
   downstream env var (`CLAUDE_CODE_OAUTH_TOKEN`):
   - **Setup token** (works out of the box): the player runs `claude setup-token` and pastes the
     printed `sk-ant-oat…` token on the account screen.
   - **OAuth2 (PKCE)**: fully env-driven (`AGENT_CLAUDE_CLIENT_ID`, `AGENT_CLAUDE_AUTHORIZE_URI`,
     `AGENT_CLAUDE_TOKEN_URI`, `AGENT_CLAUDE_SCOPES` in `mic-mooi/.env`) and ships **empty** on
     purpose: per the Claude Agent SDK docs, offering claude.ai login or its rate limits from a
     third-party product requires prior Anthropic approval. Fill these in only once that approval is
     in hand — until then, use the setup-token mode above.
4. **Anthropic API keys (`sk-ant-api…`) are not a supported credential** — this is "bring your Claude
   subscription", not "bring your API billing".

### Agent session runtime

Run `mic-sessions` with one process and one worker. `make dev-start-mic-sessions` installs
Python 3.13 and the pinned Claude Agent SDK through uv, checks its bundled local CLI, then
starts the service. A global Claude installation and an agent Docker image are not required.
Git and the host tools required by your repositories must be installed locally.

Set `VITE_SESSIONS_BASE_URL` in `spa-mooi/.env` to `http://localhost:44913`.
Configure `mic-sessions/.env` using its example:

| Variable | Purpose |
| --- | --- |
| `WORKSPACE_ROOT` | Writable storage; each session clones into `sessions/<UUID>/repository` |
| `GIT_BINARY`, `GIT_TIMEOUT_SECONDS` | Git executable and command timeout |
| `MAX_SESSIONS`, `MAX_SESSIONS_PER_PLAYER` | Concurrent session limits |
| `SESSION_IDLE_TIMEOUT_MINUTES` | Inactivity expiry; active turns/questions are retained |
| `AGENT_CLAUDE_MODELS` | JSON model-to-effort allowlist; use models available to your account |
| `AGENT_CLAUDE_MODEL`, `AGENT_CLAUDE_EFFORT` | Defaults for new sessions |
| `AGENT_CLAUDE_DISALLOWED_TOOLS` | Comma-separated tool exclusions |
| `EVENT_LOG_LIMIT`, `EVENT_LOG_BYTES` | Per-session retained event limits |

Adding a repository does not clone it. A new session checks out its requested remote branch,
or creates a branch from the remote default branch. Sessions may use the same branch name
independently. Closing, expiry and graceful shutdown stop the runtime before removing its clone.
Session conversations are held in memory and cannot survive a service restart. Startup removes
only marked session leftovers; legacy repositories and unowned directories are preserved.
`dev-clean` preserves workspace storage; the next start reconciles owned leftovers, including
when `WORKSPACE_ROOT` points outside the artifact directory.

Claude runs locally with the service user's permissions. Its working directory and private
per-runtime configuration directory do not restrict access to the host. Run the service under an
account whose access is appropriate for the repositories, hooks and tools you enable.

Commit native project configuration to the repository: `CLAUDE.md`, `.claude/rules/`,
`.claude/skills/`, `.claude/commands/`, `.claude/agents/`, project settings/hooks and `.mcp.json`.
Project and local settings are enabled. Install required hook/MCP executables and provide their
credentials on the host; native MCP approvals still apply. A root `.claude-plugin/plugin.json`
loads that repository as a local plugin. Marketplace plugins require installation and availability
in the CLI's runtime state; the service does not copy the user's global Claude configuration or
install plugin dependencies automatically.

### Session deployments

Install Docker CLI with Compose v2 where `mic-sessions` runs and grant its service user access
to the configured host Unix socket. Verify with `make dev-preflight-mic-sessions`.
Deploy uses the session provider with fixed `claude-sonnet-5` / `high`; the linked account must
have access to that model. Chat model settings do not configure Deploy.

Set these values in `mic-sessions/.env`:

| Variable | Purpose |
| --- | --- |
| `DOCKER_BINARY`, `DOCKER_HOST` | CLI executable and explicit host socket URI, e.g. `unix:///var/run/docker.sock` |
| `DOCKER_CLI_PLUGIN_DIR` | Optional absolute Compose/buildx plugin directory; Docker Desktop macOS: `/Applications/Docker.app/Contents/Resources/cli-plugins` |
| `PREVIEW_PUBLIC_HOST` | Server DNS/IP reachable from users' browsers; no scheme, port or path |
| `PREVIEW_SCHEME` | `http` or `https`; HTTPS requires valid TLS at the app endpoint |
| `PREVIEW_BIND_ADDRESS` | Daemon host interface publishing ports, e.g. `0.0.0.0` for external access |
| `PREVIEW_PROBE_HOST` | Daemon host address reachable from `mic-sessions` for readiness checks |
| `PREVIEW_PORT_RANGE` | Empty for engine allocation, or inclusive range such as `49152-49251` |
| `MAX_DEPLOYMENTS` | Concurrent deployment limit (default 4, no queue) |
| `DEPLOYMENT_*_TIMEOUT_SECONDS`, `DOCKER_*_TIMEOUT_SECONDS` | Operation limits; see `.env.example` |
| `SESSION_ACTIVITY_INTERVAL_SECONDS` | Preview activity coalescing interval; default 60 seconds |

The example's loopback addresses are for local development. For external browsers, configure
public/probe hosts separately and allow the published port range through existing ingress and
firewall rules. An HTTPS Mooi page needs an HTTPS app endpoint; changing `PREVIEW_SCHEME`
does not provision TLS. The app must allow embedding through its CSP/X-Frame-Options headers.
Published ports are accessible outside Mooi; the iframe does not provide exclusive access.

If Mooi runs in a container/pod, mount the host Docker socket and provide the CLI/Compose there.
Apps run as sibling containers on that engine. Build contexts are sent from the session checkout;
matching checkout paths on the daemon host are unnecessary. Apps must use built images and
named data volumes, without host bind mounts or access to Mooi's socket/credentials. This setup
does not sandbox hostile repositories. Mooi containerization and a preview proxy are not included.

Keep `WORKSPACE_ROOT` on durable, private, writable storage, including `deployments/` and its
installation identity. Run one `mic-sessions` process/worker; multiworker/multinode coordination
is unsupported. Stop preserves app data volumes; session closure/expiry and startup recovery
remove only owned resources. Failed cleanup preserves manifests/checkouts for retry; restore
Docker access and use `make dev-stop-mic-sessions` before cleaning the development environment.
Do not delete deployment records manually while resources remain. Conversations do not survive
restart. The default inactivity expiry is 180 minutes; a visible, focused Preview sends activity
every 60 seconds. Hidden previews and automatic health checks do not prevent expiry.

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

Current artifacts: `spa-mooi`, `mic-mooi`, `mic-sessions` (e.g. `make dev-start-mic-mooi`).

### Dev ports

`make` pins every dev service to a fixed, uncommon port, hardcoded in `make/ports.mk` and
exported so Vite, the microservice and docker compose all use it regardless of their `.env`
values. The `.env` files carry the same numbers as a fallback for non-`make` usage.

| Service | Port | URL |
| --- | --- | --- |
| `spa-mooi` | `28471` | `http://localhost:28471` |
| `mic-mooi` | `39615` | `http://localhost:39615` |
| `mic-sessions` | `44913` | `http://localhost:44913` |
| `postgres` | `54983` | `localhost:54983` |
| `pgadmin` | `51247` | `http://localhost:51247` |

Change a port in `make/ports.mk`; the cross-artifact wiring (`VITE_API_BASE_URL`, `CORS_ORIGIN`,
`GITHUB_REDIRECT_URI`) follows automatically.

### Support commands

| Command | Description |
| --- | --- |
| `make dev-logs` | Tail all artifact logs |
| `make dev-preflight-mic-sessions` | Verify deployment CLI, Compose and configured daemon |
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
| `VITE_SESSIONS_BASE_URL` | mic-sessions base URL |
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
| `GITHUB_APP_SLUG` | GitHub App URL slug; backs the install-and-authorize page for repository access |
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
