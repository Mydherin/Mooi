# Mooi

Monorepository. Each artifact lives in its own root-level directory.

| Artifact | Description |
| --- | --- |
| `spa-mooi` | Vite + React + TypeScript SPA (UI) |
| `mic-mooi` | Spring Boot microservice (API) |
| `compose.dev.yml` | Postgres + pgAdmin data layer (dev) |

## Requirements

- [Bun](https://bun.sh) >= 1.3
- Java 25
- Maven >= 3.9
- Docker Engine + Docker Compose V2

## Data layer

Postgres and pgAdmin run from `compose.dev.yml` at project root. It is the single source of the
database: no artifact starts its own engine, and schema creation belongs to the `mic-mooi` migrations.

### Setup

```bash
cp .env.example .env
```

Configuration lives in the root `.env` (template: `.env.example`). Every value is also declared as an
inline default in `compose.dev.yml`, so the stack boots with no `.env`. Shell variables override
`.env`, and `.env` overrides the inline defaults. Set your own credentials in `.env` before the first
run.

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

### Commands

```bash
docker compose -f compose.dev.yml up -d      # start
docker compose -f compose.dev.yml ps         # status
docker compose -f compose.dev.yml logs -f    # logs
docker compose -f compose.dev.yml down       # stop, keep data
docker compose -f compose.dev.yml down -v    # stop, drop data
```

### Console

Open `http://localhost:${PGADMIN_PORT}` and log in with `PGADMIN_EMAIL` / `PGADMIN_PASSWORD`. Register
the server once with host `postgres`, port `5432`, and the `POSTGRES_DB`, `POSTGRES_USER`,
`POSTGRES_PASSWORD` values. Both services share the same dedicated network, so the console reaches
the engine by service name.

## spa-mooi

### Setup

```bash
cd spa-mooi
bun install
```

Configuration lives in `spa-mooi/.env` (template: `spa-mooi/.env.example`). All variables must be prefixed with `VITE_`.

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

### Commands

```bash
bun run dev        # dev server (http://localhost:5173)
bun run build      # type check + production build to dist/
bun run preview    # serve dist/
bun run typecheck  # type check only
```

## mic-mooi

### Setup

Start the [data layer](#data-layer) first.

```bash
cd mic-mooi
cp .env.example .env
```

Artifact configuration lives in `mic-mooi/.env` (template: `mic-mooi/.env.example`), loaded by a
dependency-free loader that also reads the root `.env`, so database variables are inherited and never
duplicated. Precedence: real environment variables, then `mic-mooi/.env`, then the root `.env`. Run
commands from the `mic-mooi` directory so both files resolve.

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

### Commands

```bash
mvn spring-boot:run     # run on http://localhost:8080
mvn clean package       # build target/mic-mooi.jar
java -jar target/mic-mooi.jar
```

### Endpoints

| Endpoint | Description |
| --- | --- |
| `GET /api/landing/highlights` | List landing highlights |
| `GET /api/landing/highlights/{slug}` | Get a highlight by slug |
| `POST /api/landing/highlights` | Create a highlight |
| `GET /api/heartbeats` | List recent heartbeats |
| `GET /api/heartbeats/latest` | Get the latest heartbeat |
| `GET /actuator/health` | Health check |
