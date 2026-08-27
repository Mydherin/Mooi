# Mooi

Monorepository. Each artifact lives in its own root-level directory.

| Artifact | Description |
| --- | --- |
| `spa-mooi` | Vite + React + TypeScript SPA (UI) |
| `mic-mooi` | Spring Boot microservice (API) |

## Requirements

- [Bun](https://bun.sh) >= 1.3
- Java 25
- Maven >= 3.9
- Postgres >= 16

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

Requires an existing Postgres instance.

```bash
createdb mooi
cd mic-mooi
cp .env.example .env
```

Configuration lives in `mic-mooi/.env` (template: `mic-mooi/.env.example`), loaded by a dependency-free loader. Real environment variables always override the file. Run commands from the `mic-mooi` directory so `.env` resolves.

| Variable | Description |
| --- | --- |
| `APP_NAME` | Application name |
| `APP_VERSION` | Displayed version |
| `SERVER_PORT` | HTTP server port |
| `DB_HOST` | Postgres host |
| `DB_PORT` | Postgres port |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `DB_SCHEMA` | Database schema |
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
