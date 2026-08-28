# PLAN — Google OAuth2 authentication with rotating refresh tokens

> **Self-contained document.** Everything needed to implement this change is written below:
> stack, conventions, exact file paths, DDL, contracts, algorithms and acceptance checks.
> An agent starting cold must go straight to implementation and only open a file right
> before editing it — never to discover context.

---

## 1. What is being built

`tmp/AUTH_SPECS.md` describes a Google OIDC sign-in that opens a server-side **session**, and
hands the client a short-lived **access token** (JWT) plus a single-use, rotating **refresh
token**. Sessions live forever until logged out or revoked; revocation takes effect on the very
next call.

| Layer | Lifetime | Stored where | Ends when |
|---|---|---|---|
| Session (`auth_sessions`) | Unbounded | Postgres, one row per sign-in | Logout, or revoke |
| Refresh token (`refresh_tokens`) | `REFRESH_TOKEN_EXPIRES_IN` (30d), renewed on every use | Postgres as SHA-256 hex digest; secret only on the client | Used once, expired, or its session is revoked |
| Access token (JWT HS256 over `JWT_SECRET`) | `ACCESS_TOKEN_EXPIRES_IN` (15m) | Nowhere server-side — stateless | Expiry, or its session is revoked |

Access token claims: `sub` (player id), `role`, `sid` (session id), `iat`, `exp`.
`sid` is what makes it revocable. Refresh tokens carry nothing: 32 random bytes, base64url.

---

## 2. The repository as it is today

Monorepo root `/Users/mydherin/projects/mydherin/Mooi`.

| Path | What it is |
|---|---|
| `mic-mooi/` | Java 25 + Spring Boot 4.1.1 microservice, Maven, JPA, Liquibase, Postgres, Lombok |
| `spa-mooi/` | Vite 8 + React 19 + TypeScript + Tailwind 4 + Zustand 5 + React Router 7 + lucide-react |
| `compose.dev.yml` | Postgres 18 + pgAdmin (dev data layer) |
| `Makefile` + `make/*.mk` | The **only** supported dev entrypoint (`make dev-start`, `dev-stop`, `dev-status`, `dev-clean`, and `dev-<cmd>-<artifact>`) |
| `.env` / `.env.example` (root) | Postgres + dev-entrypoint knobs |

**Tooling present on this machine:** Java 25, bun, npm, node, docker. **Maven is NOT installed** —
the Java side cannot be compiled locally; see §12.

### 2.1 Microservice architecture rules (from `CLAUDE.md`, non-negotiable)

- `features/<Name>Feature.java` — one file holds the whole feature: REST controller, application
  services, JPA entities, Spring Data repositories and request/response records.
- `shared/<Aspect>.java` — one file per transversal infrastructure aspect.
- A feature may import `shared`; a feature may **never** import another feature. Duplication
  between features is expected and correct.
- Business logic is never a transversal aspect.

Existing shared aspects — **do not re-read them, their contract is repeated here**:

| File | Public surface used by this plan |
|---|---|
| `shared/Env.java` | `EnvironmentPostProcessor` registered in `src/main/resources/META-INF/spring.factories`; loads `mic-mooi/.env` then root `../.env` into the Spring `Environment`. No change needed. |
| `shared/Db.java` | `@EnableJpaAuditing`, `@EnableJpaRepositories(basePackages = "dev.mooi.mic.features", considerNestedRepositories = true)` — **nested repository interfaces inside features are already scanned**. Also exposes `Db.Auditable` (`created_at` + `updated_at` mapped superclass). |
| `shared/Logging.java` | `X-Correlation-Id` filter; `Logging.CORRELATION_ID_HEADER`, `Logging.CORRELATION_ID_KEY = "correlationId"`, `Logging.currentCorrelationId()`. MDC-based. |
| `shared/Web.java` | `@Bean WebMvcConfigurer corsConfigurer(@Value("${app.cors.allowed-origins}") String[])` currently mapping `"/api/**"`. Plus `Web.ApiError(timestamp, status, error, message, path, correlationId, issues)` and a `@RestControllerAdvice ApiErrorHandler` that already maps `MethodArgumentNotValidException` → 400, `ResponseStatusException` → its status, `ErrorResponseException` → its status, `Exception` → 500. |

Existing features (patterns to copy): `features/LandingFeature.java`, `features/HeartbeatFeature.java`.
Shape: `@Slf4j @RestController @RequestMapping("/api/...") @RequiredArgsConstructor` outer class,
then `// --- application ---` (`@Service` nested static class), `// --- persistence ---`
(`@Getter @Setter @NoArgsConstructor @Entity @Table` nested static class + nested
`interface XRepository extends JpaRepository<...>`), then `// --- contracts ---` (records).

Liquibase: `src/main/resources/db/changelog/db.changelog-master.yaml` includes
`changes/001-create-landing-highlight.yaml`, `002-seed-landing-highlight.yaml`,
`003-create-service-heartbeat.yaml`. Each changeset has `id`, `author: mooi`, `changes`, `rollback`.
`spring.jpa.hibernate.ddl-auto: validate` — Liquibase owns the schema, JPA only validates it.

### 2.2 SPA conventions (from `CLAUDE.md` + the existing code)

- Path alias `@/*` → `spa-mooi/src/*` (set in both `vite.config.ts` and `tsconfig.app.json`).
- **File naming in this repo is camelCase** for modules (`themeStore.ts`, `navLinks.ts`,
  `useApplyTheme.ts`) and **PascalCase for components** (`Header.tsx`). The spec's kebab-case
  names are Node-side conventions and are translated to this repo's style.
- One type per file, exported directly from its own module (no `index.d.ts`).
- Global state through Zustand stores in `src/stores/` (`themeStore.ts`, `navigationStore.ts`),
  their state interfaces in `src/stores/types/`.
- `tsconfig.app.json` has `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax` (type-only imports **must** use `import type`), and
  **`erasableSyntaxOnly: true` → no TS `enum`, no constructor parameter properties.**
- Env access: `src/config/env.ts` builds an `AppEnv` object through
  `requireEnv(import.meta.env.VITE_X, 'VITE_X')` (throws when missing);
  `src/config/types/AppEnv.ts` and `src/config/types/RawEnv.ts` must both be extended.
- Styling helpers: `@/shared/utils/cn`, `@/shared/styles/buttonStyles` (`buttonStyles('primary' | 'secondary', extraClasses)`),
  `@/shared/components/Container`. Dark mode via `dark:` classes.
- Routing: `src/app/routes.ts` (`ROUTES` const object), `src/app/router.tsx`
  (`createBrowserRouter` with `RootLayout` as the layout element), `src/pages/*`.

---

## 3. Deviations from `tmp/AUTH_SPECS.md` (and why)

The spec was written against a Node/Express/Drizzle/Colyseus service (`mic-pokeworld`) and a
different SPA (`spa-pokeworld`). Its **behaviour, endpoints, payloads, tables and columns are
implemented exactly**; only the file layout is translated to this repo's mandated architecture.
The full list of intentional differences:

1. **File layout.** The spec's `domain/ · application/ · infrastructure/` tree becomes
   `shared/Auth.java` (transversal auth infrastructure) + `features/AuthFeature.java`
   (the feature), per `CLAUDE.md`. The port/adapter split survives as
   `Auth.SessionGuard` (port, declared in `shared`) implemented by `AuthFeature` (adapter).
2. **`/me` and `/admin/ping` live in `AuthFeature`.** Features cannot import each other, and both
   endpoints need the `players` table, so they cannot move into their own feature file.
3. **`GET /health`** is added to `features/HeartbeatFeature.java` (the liveness feature) as a
   nested controller returning `{"status":"UP"}`. `/actuator/health` stays as it is.
4. **No game server.** `WorldRoom`, `SessionRevocationWatcher` and the Colyseus 30s revocation
   poll have no counterpart — this monorepo has no WebSocket/live layer at all. Everything the
   spec says about revocation over HTTP is implemented; the WS part is out of scope and is
   listed in §12.
5. **`CORS_ORIGIN`.** The spec's variable name replaces the existing `WEB_CORS_ALLOWED_ORIGINS`
   (same single use, `app.cors.allowed-origins`). CORS mapping widens from `/api/**` to `/**`
   because the auth endpoints are mounted at the exact paths the spec gives (no `/api` prefix).
6. **Auth tables do not extend `Db.Auditable`.** The spec lists their columns explicitly and
   none of the three has `updated_at`; `created_at` / `last_used_at` / `used_at` / `revoked_at`
   are set explicitly in code from a UTC clock. Table names stay plural (`players`,
   `auth_sessions`, `refresh_tokens`) exactly as specified, unlike the singular names used by
   the two pre-existing tables.
7. **`role` column type — the one open question.** The spec says `player_role` enum
   (`member | admin`). Hibernate's `@JdbcTypeCode(SqlTypes.NAMED_ENUM)` requires the Postgres
   labels to equal the Java constant **names**, which would force lowercase Java enum constants.
   The plan below uses `varchar(16) NOT NULL DEFAULT 'member'` + a
   `CHECK (role IN ('member','admin'))` constraint with a JPA `AttributeConverter`, which keeps
   the wire values exactly `member`/`admin` everywhere (JWT claim, JSON, SPA) with idiomatic
   Java. Switching to a native Postgres enum is a two-line change in task 5 + task 6 if
   preferred.
8. **SPA post-login destination** is `/account`, not `/`, because `/` is this repo's public
   landing page.
9. **SPA auth store lives in `src/stores/authStore.ts`** (repo convention for global stores),
   not `features/auth/store/`. Everything else auth-related lives under `src/features/auth/`.

---

## 4. Configuration

### 4.1 `mic-mooi/.env.example` — append

```
# Auth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
JWT_SECRET=change-me-development-secret-at-least-32-bytes
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
REPLAY_GRACE_SECONDS=30
ADMIN_EMAILS=
```

and **rename** the existing `WEB_CORS_ALLOWED_ORIGINS=http://localhost:5173` line to
`CORS_ORIGIN=http://localhost:5173` (keep it under the `# Web` heading).

Also append `LOG_LEVEL_AUTH=INFO` under `# Logging`.

### 4.2 `mic-mooi/src/main/resources/application.yml`

- `app.cors.allowed-origins: ${CORS_ORIGIN:http://localhost:5173}`
- add under `app:`:

```yaml
  auth:
    google-client-id: ${GOOGLE_CLIENT_ID:}
    jwt-secret: ${JWT_SECRET:}
    access-token-expires-in: ${ACCESS_TOKEN_EXPIRES_IN:15m}
    refresh-token-expires-in: ${REFRESH_TOKEN_EXPIRES_IN:30d}
    replay-grace-seconds: ${REPLAY_GRACE_SECONDS:30}
    admin-emails: ${ADMIN_EMAILS:}
    google-jwks-uri: https://www.googleapis.com/oauth2/v3/certs
```

- add `auth: ${LOG_LEVEL_AUTH:INFO}` under `logging.level`.
- change `logging.pattern.console` to
  `"%d{yyyy-MM-dd HH:mm:ss.SSS} %-5level [%X{correlationId:-}] [%X{playerId:-}] %logger{36} - %msg%n"`.

### 4.3 `spa-mooi/.env.example` **and** `spa-mooi/.env` — append

```
# API
VITE_API_BASE_URL=http://localhost:8080

# Google OAuth2
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 4.4 `mic-mooi/pom.xml`

Add one dependency (the jar is already in `~/.m2`, version pinned because the Spring Boot BOM
does not manage it):

```xml
<dependency>
    <groupId>com.nimbusds</groupId>
    <artifactId>nimbus-jose-jwt</artifactId>
    <version>10.4</version>
</dependency>
```

---

## 5. Database — Liquibase changesets

Add three files under `mic-mooi/src/main/resources/db/changelog/changes/` and three `include`
entries at the end of `db.changelog-master.yaml`, in this order.

### `004-create-players.yaml` — table `players`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK `pk_players`, not null |
| `google_id` | `varchar(255)` | not null, unique `uq_players_google_id` |
| `email` | `varchar(255)` | not null, unique `uq_players_email` |
| `username` | `varchar(64)` | not null |
| `avatar_url` | `varchar(512)` | nullable |
| `role` | `varchar(16)` | not null, `defaultValue: member` |
| `created_at` | `timestamptz` | not null |

Plus `addCheckConstraint`-equivalent via a raw `sql` change:
`ALTER TABLE players ADD CONSTRAINT ck_players_role CHECK (role IN ('member','admin'));`
Rollback: `dropTable: players`.

### `005-create-auth-sessions.yaml` — table `auth_sessions`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK `pk_auth_sessions`, not null |
| `player_id` | `uuid` | not null |
| `created_at` | `timestamptz` | not null |
| `last_used_at` | `timestamptz` | not null |
| `revoked_at` | `timestamptz` | nullable — **NULL means alive** |
| `user_agent` | `varchar(512)` | nullable |
| `ip_address` | `varchar(64)` | nullable |

Then `addForeignKeyConstraint` `fk_auth_sessions_player` → `players(id)` with
`onDelete: CASCADE`, and `createIndex idx_auth_sessions_player_id` on `player_id`.
Rollback: `dropTable: auth_sessions`.

### `006-create-refresh-tokens.yaml` — table `refresh_tokens`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK `pk_refresh_tokens`, not null |
| `session_id` | `uuid` | not null |
| `token_hash` | `varchar(64)` | not null, unique `uq_refresh_tokens_token_hash` |
| `expires_at` | `timestamptz` | not null |
| `created_at` | `timestamptz` | not null |
| `used_at` | `timestamptz` | nullable — NULL = unspent |

Then `addForeignKeyConstraint` `fk_refresh_tokens_session` → `auth_sessions(id)` with
`onDelete: CASCADE`, and `createIndex idx_refresh_tokens_session_id` on `session_id`.
Rollback: `dropTable: refresh_tokens`.

Nothing is ever deleted in normal operation: `revoked_at` and `used_at` are the only state that
changes, which is what leaves the trail replay detection reads.

---

## 6. `mic-mooi/src/main/java/dev/mooi/mic/shared/Auth.java` (new)

Transversal aspect: **authentication and authorization**. Self-contained; imports only
`shared/Logging` (for the MDC keys) and the JDK/Spring/nimbus.

```java
package dev.mooi.mic.shared;

@Configuration
public class Auth { ... }
```

Public surface (all nested in `Auth`):

| Member | Purpose |
|---|---|
| `public static final Logger LOG = LoggerFactory.getLogger("auth")` | The spec's `auth` log scope, shared with the feature |
| `public enum Role { MEMBER("member"), ADMIN("admin") }` | `wire()` returns the lowercase value; `static Role fromWire(String)` throws `IllegalArgumentException` on anything else |
| `public record AuthenticatedPlayer(UUID id, String username, String email, String avatarUrl, Role role, OffsetDateTime createdAt)` | The identity the guard resolves |
| `public record Principal(AuthenticatedPlayer player, UUID sessionId)` | Injected into handlers |
| `public interface SessionGuard { Optional<AuthenticatedPlayer> resolve(UUID sessionId, UUID playerId); }` | **Port** implemented by `AuthFeature`: session alive + `sub` binding + player load |
| `@Retention(RUNTIME) @Target({METHOD, TYPE}) public @interface Authenticated {}` | Marks an endpoint as requiring a live session |
| `@Retention(RUNTIME) @Target({METHOD, TYPE}) public @interface RequireRole { Role value(); }` | Role gate; implies `@Authenticated` |
| `public static class AuthenticationException extends ResponseStatusException` | `super(HttpStatus.UNAUTHORIZED, reason)` — becomes a `401` through the existing `Web.ApiErrorHandler` |
| `public static Duration parseDuration(String value, String name)` | `<n><s\|m\|h\|d>`; anything else throws `IllegalStateException` at boot |

### 6.1 `Auth.Settings` — `@Component`, validated at boot

Reads `app.auth.*` through `@Value` into a constructor, then in the constructor:

- `googleClientId` blank → `IllegalStateException("GOOGLE_CLIENT_ID must be set")`.
- `jwtSecret` blank or `< 32` UTF-8 bytes → `IllegalStateException("JWT_SECRET must be at least 32 bytes")` (HS256 needs a 256-bit key).
- `accessTokenTtl = parseDuration(accessTokenExpiresIn, "ACCESS_TOKEN_EXPIRES_IN")`, same for `refreshTokenTtl`.
- `replayGrace = Duration.ofSeconds(replayGraceSeconds)`, must be `>= 0`.
- `adminEmails`: split the raw value on `,`, strip, lowercase, drop blanks → `Set<String>`.
- `googleJwksUri` parsed into a `URL`.

Also exposes `public Role resolvePlayerRole(String email)` → `adminEmails.contains(email.toLowerCase(ROOT)) ? ADMIN : MEMBER`.

### 6.2 `Auth.Tokens` — `@Component`, the crypto

Constructor takes `Settings` and `Clock` (`Clock.systemUTC()` bean below).

- `public String signAccessToken(UUID playerId, Role role, UUID sessionId)`
  — nimbus `SignedJWT` with `JWSHeader(JWSAlgorithm.HS256)` and a `JWTClaimsSet` of
  `subject(playerId)`, `claim("role", role.wire())`, `claim("sid", sessionId)`,
  `issueTime(now)`, `expirationTime(now + accessTokenTtl)`; signed with
  `new MACSigner(jwtSecret.getBytes(UTF_8))`; returns `.serialize()`.
- `public record AccessClaims(UUID playerId, Role role, UUID sessionId) {}`
- `public AccessClaims verifyAccessToken(String token)`
  — `SignedJWT.parse`; **reject unless header alg is exactly `HS256`**; `verify(new MACVerifier(secret))`;
  reject when `exp` is null or `exp <= now`; parse `sub`/`sid` as `UUID` and `role` via `Role.fromWire`.
  Every failure path (`ParseException`, `JOSEException`, bad claim) throws
  `new AuthenticationException("Invalid access token")` — never leak which check failed.
- `public String generateRefreshToken()` — `SecureRandom` 32 bytes →
  `Base64.getUrlEncoder().withoutPadding().encodeToString(...)`.
- `public String hashRefreshToken(String token)` — SHA-256 of the UTF-8 bytes, lowercase hex,
  64 characters.
- `public long accessTokenExpiresInSeconds()` — `settings.accessTokenTtl().toSeconds()`.

### 6.3 `Auth.GoogleIdentityProvider` — `@Component`

- `public record GoogleIdentity(String googleId, String email, String username, String avatarUrl) {}`
- Built once in the constructor:
  ```java
  JWKSource<SecurityContext> jwkSource = JWKSourceBuilder
          .<SecurityContext>create(settings.googleJwksUri())
          .retrying(true)
          .build();
  DefaultJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
  processor.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, jwkSource));
  processor.setJWTClaimsSetVerifier(new DefaultJWTClaimsVerifier<>(
          settings.googleClientId(),                     // accepted audience
          null,                                          // exact match claims
          Set.of("iss", "sub", "aud", "exp", "iat")));   // required claims
  ```
- `public GoogleIdentity verify(String idToken)`:
  - `JWTClaimsSet claims = processor.process(idToken, null);`
  - `iss` must be `https://accounts.google.com` **or** `accounts.google.com`;
  - `email_verified` claim must be `true`;
  - `email` must be non-blank;
  - `googleId = claims.getSubject()`;
  - `username` = `name` claim, falling back to the local part of the email;
  - `avatarUrl` = `picture` claim (nullable), truncated to 512 chars;
  - any failure → `AuthenticationException("Invalid Google credential")`, logged at
    `LOG.debug` with the reason.

### 6.4 The HTTP guard

- `Auth.AuthInterceptor implements HandlerInterceptor`, constructed with `Tokens` and an
  `ObjectProvider<SessionGuard>` (lazy: the guard bean lives in a feature and must not create a
  startup cycle).
  - `preHandle`: if the handler is not a `HandlerMethod`, pass. Look for `@RequireRole` then
    `@Authenticated` on the method, then on the declaring class; if neither is present, pass.
  - Read `Authorization`; require the `Bearer ` prefix and a non-blank token, else
    `AuthenticationException("Missing bearer token")`.
  - `AccessClaims claims = tokens.verifyAccessToken(token);`
  - `AuthenticatedPlayer player = guard.resolve(claims.sessionId(), claims.playerId())
        .orElseThrow(() -> new AuthenticationException("Session is no longer active"));`
  - `@RequireRole` present and `player.role() != required` → `ResponseStatusException(FORBIDDEN, "Insufficient role")`.
  - Store `new Principal(player, claims.sessionId())` under request attribute
    `Auth.PRINCIPAL_ATTRIBUTE = "dev.mooi.mic.auth.principal"`; `MDC.put("playerId", ...)`,
    `MDC.put("sessionId", ...)`; return `true`.
  - `afterCompletion`: `MDC.remove` both keys.
- `Auth.PrincipalArgumentResolver implements HandlerMethodArgumentResolver` — supports a
  parameter of type `Principal`, returns the request attribute (never null: the interceptor
  answered 401 first).
- `@Bean WebMvcConfigurer authWebMvcConfigurer(...)` — registers the interceptor on `/**` and
  the argument resolver. (Mirrors the `@Bean WebMvcConfigurer` style already used in `Web.java`;
  Spring composes multiple configurers.)
- `@Bean Clock authClock() { return Clock.systemUTC(); }` (guarded with
  `@ConditionalOnMissingBean`-free simplicity: no other `Clock` bean exists).
- `public static String readUserAgent(HttpServletRequest)` → header `User-Agent`, truncated to 512.
- `public static String readIpAddress(HttpServletRequest)` → first hop of `X-Forwarded-For`,
  else `getRemoteAddr()`, truncated to 64.

### 6.5 `shared/Web.java` — one edit

Change the CORS mapping from `"/api/**"` to `"/**"` so the spec's unprefixed auth endpoints are
reachable from the SPA origin. Nothing else changes; `AuthenticationException` extends
`ResponseStatusException`, which the existing `ApiErrorHandler` already renders as the shared
`ApiError` body with the right status.

---

## 7. `mic-mooi/src/main/java/dev/mooi/mic/features/AuthFeature.java` (new)

Single-file feature. `@Slf4j @RestController @RequiredArgsConstructor`, no class-level
`@RequestMapping` (paths are absolute and differ per endpoint).

### 7.1 Endpoints

| Method | Path | Guard | Body | Returns |
|---|---|---|---|---|
| `POST` | `/auth/google` | none | `{ idToken }` | `200 { accessToken, expiresIn, refreshToken, player }` |
| `POST` | `/auth/refresh` | none | `{ refreshToken }` | `200` same payload, rotated |
| `POST` | `/auth/logout` | none | `{ refreshToken }` | `204` **always** |
| `POST` | `/auth/logout-all` | `@Authenticated` | — | `200 { revokedSessions }` |
| `GET` | `/me` | `@Authenticated` | — | `200 { player }` |
| `GET` | `/admin/ping` | `@RequireRole(ADMIN)` | — | `200 { status: "ok" }`, else `403` |

Request records use `@NotBlank` so a missing/empty field is a `400` through the existing
validation handler: `record GoogleLoginRequest(@NotBlank String idToken)`,
`record RefreshRequest(@NotBlank String refreshToken)`; handlers take `@Valid @RequestBody`.

`/auth/google` and `/auth/refresh` also receive `HttpServletRequest` to record the sign-in origin.
`/auth/logout-all` and `/me` and `/admin/ping` take an `Auth.Principal` parameter.

### 7.2 Contracts (`// --- contracts ---`)

```java
public record PlayerPayload(UUID id, String username, String email, String avatarUrl,
                            String role, OffsetDateTime createdAt) {}
public record SessionPayload(String accessToken, long expiresIn, String refreshToken,
                             PlayerPayload player) {}
public record CurrentPlayerPayload(PlayerPayload player) {}
public record RevokedSessionsPayload(int revokedSessions) {}
public record StatusPayload(String status) {}
```

`googleId` is never part of any payload — it never leaves the server.

### 7.3 Persistence (`// --- persistence ---`)

```java
@Entity @Table(name = "players")   // fields: id, googleId, email, username, avatarUrl, role, createdAt
@Entity @Table(name = "auth_sessions")  // id, playerId (plain UUID column, no @ManyToOne), createdAt, lastUsedAt, revokedAt, userAgent, ipAddress
@Entity @Table(name = "refresh_tokens") // id, sessionId (plain UUID), tokenHash, expiresAt, createdAt, usedAt
```

- Ids: `@Id @GeneratedValue @Column(name = "id", nullable = false, updatable = false) private UUID id;`
  (same as the existing features).
- `role` maps through a nested `@Converter public static class RoleConverter implements
  AttributeConverter<Auth.Role, String>` (`convertToDatabaseColumn` → `role.wire()`,
  `convertToEntityAttribute` → `Auth.Role.fromWire(value)`), applied with
  `@Convert(converter = RoleConverter.class)`.
- Foreign keys are held as plain `UUID` columns, not associations — every query in this feature
  is by id and lazy-loading graphs would only add round trips.
- These entities deliberately do **not** extend `Db.Auditable` (§3.6).

Repositories (nested interfaces, already covered by `considerNestedRepositories = true`):

```java
public interface PlayerRepository extends JpaRepository<Player, UUID> {
    Optional<Player> findByGoogleId(String googleId);
}

public interface AuthSessionRepository extends JpaRepository<AuthSession, UUID> {
    Optional<AuthSession> findByIdAndRevokedAtIsNull(UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update AuthSession s set s.revokedAt = :now where s.id = :id and s.revokedAt is null")
    int revoke(@Param("id") UUID id, @Param("now") OffsetDateTime now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update AuthSession s set s.revokedAt = :now where s.playerId = :playerId and s.revokedAt is null")
    int revokeAllForPlayer(@Param("playerId") UUID playerId, @Param("now") OffsetDateTime now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update AuthSession s set s.lastUsedAt = :now where s.id = :id")
    int touch(@Param("id") UUID id, @Param("now") OffsetDateTime now);
}

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** The single conditional statement rotation depends on: Postgres serialises concurrent
     *  attempts on the row and exactly one of them sees `used_at IS NULL`. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update RefreshToken t set t.usedAt = :now where t.id = :id and t.usedAt is null")
    int spend(@Param("id") UUID id, @Param("now") OffsetDateTime now);
}
```

`revoke` is guarded by `revoked_at is null` so a repeated logout keeps the original timestamp.

### 7.4 Application (`// --- application ---`)

`@Service @RequiredArgsConstructor public static class AuthService implements Auth.SessionGuard`,
holding the three repositories, `Auth.Settings`, `Auth.Tokens`, `Auth.GoogleIdentityProvider`
and `Clock`. All timestamps come from `OffsetDateTime.now(clock)`.

**`resolve(UUID sessionId, UUID playerId)`** — `@Transactional(readOnly = true)`, the port:
1. `findByIdAndRevokedAtIsNull(sessionId)` → empty ⇒ `Optional.empty()`.
2. `session.getPlayerId().equals(playerId)` must hold — a mismatch is forgery:
   log `Auth.LOG.warn("Access token subject does not match its session")` and return empty.
3. `playerRepository.findById(playerId)` → map to `Auth.AuthenticatedPlayer`.

**`loginOrSignupWithGoogle(String idToken, String userAgent, String ipAddress)`** — `@Transactional`:
1. `GoogleIdentity identity = googleIdentityProvider.verify(idToken);` (the only place a Google
   credential reaches us; it is used once and never stored).
2. `Optional<Player> existing = playerRepository.findByGoogleId(identity.googleId());`
3. **Signup branch** (empty): create `Player` with `role = settings.resolvePlayerRole(identity.email())`,
   `createdAt = now`, username/email/avatarUrl seeded from Google. `isNewPlayer = true`.
   **`role` is decided here and only here** — adding an address to `ADMIN_EMAILS` later never
   promotes an existing player.
4. **Login branch** (present): `refreshProfile` — compare `username`, `email`, `avatarUrl`
   against Google's copy and `save` **only when at least one differs**. `role` is never touched.
5. Either way: insert a **new** `AuthSession` (`createdAt = lastUsedAt = now`, `revokedAt = null`,
   userAgent, ipAddress). Never reuse a session row — that is what makes each device separately
   revocable and stops a new machine from silently extending an old login.
6. `issueSessionTokens(player, session)` (below).
7. `Auth.LOG.info(isNewPlayer ? "Player signed up" : "Player signed in")` with the player id.

**`issueSessionTokens(Player player, AuthSession session)`** — private, shared by login and refresh:
- `String refreshSecret = tokens.generateRefreshToken();`
- persist a `RefreshToken` row: `tokenHash = tokens.hashRefreshToken(refreshSecret)`,
  `createdAt = now`, `expiresAt = now + refreshTokenTtl`, `usedAt = null`.
- `String accessToken = tokens.signAccessToken(player.getId(), player.getRole(), session.getId());`
- return `new SessionPayload(accessToken, tokens.accessTokenExpiresInSeconds(), refreshSecret, toPayload(player))`.
  `expiresIn` is **relative seconds**, so a client with a skewed clock still renews in time.

**`refreshSession(String presentedToken)`** — `@Transactional`, rotation + replay detection:
1. `RefreshToken row = refreshTokenRepository.findByTokenHash(tokens.hashRefreshToken(presentedToken))`
   → empty ⇒ `AuthenticationException("Invalid refresh token")`.
2. `row.getUsedAt() != null` ⇒ **replay judgement, by when it was spent**:
   - `now <= usedAt + replayGrace` (30s) → `AuthenticationException`, **session untouched** —
     two tabs can both reach for the same token before either stores the replacement;
   - otherwise → `authSessionRepository.revoke(row.getSessionId(), now)`,
     `Auth.LOG.warn("Refresh token replay detected; session revoked")`, then
     `AuthenticationException`. A copy of a retired token is the only remaining explanation.
3. `row.getExpiresAt().isBefore(now)` ⇒ `AuthenticationException("Refresh token expired")`.
4. `authSessionRepository.findByIdAndRevokedAtIsNull(row.getSessionId())` → empty ⇒
   `AuthenticationException("Session is no longer active")`.
5. `refreshTokenRepository.spend(row.getId(), now) == 0` ⇒ another concurrent request won the
   race in the same instant ⇒ `AuthenticationException` (grace-window semantics, session untouched).
6. `authSessionRepository.touch(sessionId, now)`; load the player; `issueSessionTokens(...)`.

**`revokeSession(String presentedToken)`** — `@Transactional`, backing `POST /auth/logout`:
hash → `findByTokenHash` → when present, `authSessionRepository.revoke(sessionId, now)`.
Revokes **the session, not the token** — that voids every access token ever minted under it.
Returns nothing; an unknown token is silently ignored so the endpoint is never an oracle for
guessing tokens, and so logout still succeeds for a client holding a retired token.

**`revokePlayerSessions(UUID playerId)`** — `@Transactional`, backing `POST /auth/logout-all`:
`revokeAllForPlayer(playerId, now)` and return the count. It revokes **every** session including
the caller's — sparing it would leave alive the session an attacker most likely holds.

---

## 8. `features/HeartbeatFeature.java` — one addition

A nested `@RestController public static class HealthController` with
`@GetMapping("/health") public StatusPayload health() { return new StatusPayload("UP"); }`
and a `record StatusPayload(String status)`, so `GET /health` answers `200 {"status":"UP"}`
without authentication.

---

## 9. SPA — files to create and edit

All paths relative to `spa-mooi/src/`.

### 9.1 Config

| File | Change |
|---|---|
| `config/types/RawEnv.ts` | `+ readonly VITE_API_BASE_URL: string; readonly VITE_GOOGLE_CLIENT_ID: string;` |
| `config/types/AppEnv.ts` | `+ apiBaseUrl: string; googleClientId: string;` |
| `config/env.ts` | `+ apiBaseUrl: requireEnv(import.meta.env.VITE_API_BASE_URL, 'VITE_API_BASE_URL'), googleClientId: requireEnv(import.meta.env.VITE_GOOGLE_CLIENT_ID, 'VITE_GOOGLE_CLIENT_ID'),` |

### 9.2 Types — one per file, under `features/auth/types/`

| File | Content |
|---|---|
| `PlayerRole.ts` | `export type PlayerRole = 'member' \| 'admin';` (a union, not a TS `enum` — `erasableSyntaxOnly`) |
| `AuthPlayer.ts` | `{ id, username, email, avatarUrl: string \| null, role: PlayerRole, createdAt: string }` |
| `AuthSession.ts` | `{ accessToken: string; refreshToken: string; expiresAt: number }` (absolute ms deadline) |
| `SessionResponse.ts` | `{ accessToken: string; expiresIn: number; refreshToken: string; player: AuthPlayer }` |
| `CurrentPlayerResponse.ts` | `{ player: AuthPlayer }` |
| `RevokedSessionsResponse.ts` | `{ revokedSessions: number }` |
| `GoogleCredentialResponse.ts` | `{ credential: string }` |
| `GoogleIdentityServices.ts` | `declare global { interface Window { google?: { accounts: { id: { initialize, renderButton, disableAutoSelect } } } } }` typed against the two calls used |

`stores/types/AuthState.ts`: `{ player: AuthPlayer | null; session: AuthSession | null;
setSession: (player: AuthPlayer, session: AuthSession) => void; setPlayer: (player: AuthPlayer) => void;
clear: () => void; }`

### 9.3 Store — `stores/authStore.ts`

Zustand `create<AuthState>()(persist(..., { name: `${env.storagePrefix}:auth`, version: 2 }))`.
`clear()` sets both `player` and `session` to `null`.

### 9.4 `features/auth/api/` — transport only, no store access

- `authApi.ts` — `loginWithGoogle(idToken)`, `refreshSession(refreshToken)`,
  `logout(refreshToken)`, `logoutEverywhere(accessToken)`; each `fetch`es
  `` `${env.apiBaseUrl}${path}` `` with `Content-Type: application/json`, throws on a non-ok
  response, and parses the JSON body (`logout` returns `void` on `204`).
- `currentPlayerApi.ts` — `fetchCurrentPlayer(): Promise<AuthPlayer>` through
  `authenticatedFetch('/me')`.

### 9.5 `features/auth/lib/`

- `toAuthSession.ts` — `(response: SessionResponse): AuthSession` → `expiresAt = Date.now() + response.expiresIn * 1000`.
- `accessTokenProvider.ts` — `getAccessToken(force = false): Promise<string | null>`:
  - no session ⇒ `null`;
  - not forced and `Date.now() < session.expiresAt - 30_000` ⇒ the stored access token;
  - otherwise renew, **single-flight**: a module-level `inFlight` promise is reused by every
    concurrent caller in the tab and cleared in `finally`;
  - the renewal calls `authApi.refreshSession`, then `setSession(player, toAuthSession(...))`;
  - **if the renewal fails but the store now holds a *different* refresh token**, another tab won
    the race — return that tab's access token instead of erroring. Otherwise `clear()` and return `null`.
- `authenticatedFetch.ts` — `authenticatedFetch(path, init?)`: attach
  `Authorization: Bearer <getAccessToken()>`; on `401` retry **once** against
  `getAccessToken(true)`; a second `401` clears the store and throws.
- `signOut.ts` —
  `signOut()`: read the session, **`clear()` first** (a user who pressed LOG OUT must end up
  logged out whatever the network does), then `authApi.logout(refreshToken).catch(() => {})`;
  `signOutEverywhere()`: `await getAccessToken()` **before** clearing, then `clear()`, then
  `authApi.logoutEverywhere(token).catch(() => {})`.

### 9.6 `features/auth/hooks/`

- `useGoogleIdentityServices.ts` — injects `https://accounts.google.com/gsi/client` once
  (idempotent by `id`), calls `google.accounts.id.initialize({ client_id: env.googleClientId,
  callback })` and `renderButton(container, { ... })`; returns `{ containerRef, isReady }`.
- `useSessionSync.ts` — on mount and on `focus` + `visibilitychange`, calls
  `fetchCurrentPlayer()` → `setPlayer`; on failure `clear()`. This is what drops a background tab
  to the login screen as soon as it is focused after a revocation elsewhere.
- `useAuthStorageSync.ts` — a `storage` listener on the persist key that calls
  `useAuthStore.persist.rehydrate()`, so a renewal in one tab reaches the others.

### 9.7 `features/auth/components/`

- `GoogleSignInButton.tsx` — the styled pixel button laid over Google's own (rendered into an
  absolutely positioned, `opacity-0`, pointer-events-enabled container above the visual button),
  matching the existing gradient button language.
- `SignOutControls.tsx` — `LOG OUT` plus `ALL DEVICES` with an inline two-step confirm.
- `HeaderAuthActions.tsx` — avatar + username when signed in, `Sign in` link otherwise.

### 9.8 Routing and pages

- `shared/router/ProtectedRoute.tsx` — requires **both** `player` and `session`; hosts
  `useSessionSync()`; otherwise `<Navigate to={ROUTES.login} replace />`. Renders `<Outlet />`.
- `shared/router/RoleRoute.tsx` — props `{ role: PlayerRole; redirectTo?: string }`; no player ⇒
  `/login` (a signed-out user, not an unauthorised one); wrong role ⇒ `redirectTo ?? '/'`.
- `shared/router/GuestRoute.tsx` — already signed in ⇒ `<Navigate to={ROUTES.account} replace />`.
- `app/routes.ts` — `+ login: '/login', account: '/account', admin: '/admin'`.
- `app/router.tsx` — under `RootLayout`: public `/`, `GuestRoute` → `/login`,
  `ProtectedRoute` → `/account` and (nested) `RoleRoute role="admin"` → `/admin`, then `*`.
- `pages/LoginPage.tsx` — Google ID token → `authApi.loginWithGoogle` → `setSession` →
  `navigate(ROUTES.account, { replace: true })`; renders an error state on failure.
- `pages/AccountPage.tsx` — the signed-in landing: profile card + `SignOutControls` + an
  "admin area" link rendered only when `useAuthStore((s) => s.player?.role === 'admin')`.
- `pages/AdminPage.tsx` — calls `authenticatedFetch('/admin/ping')` and shows the result; this is
  what proves the display gate and the server gate agree.
- `app/App.tsx` — `useAuthStorageSync()` alongside `useApplyTheme()`.
- `layouts/Header.tsx` — mount `<HeaderAuthActions />` next to `<ThemeToggle />`.

The role guard is a **display** gate only — the store is editable in the browser — which is why
`/admin/ping` carries `@RequireRole` on the server. That is where the answer actually comes from.

---

## 10. Makefile / dev entrypoint

No change is required and none must be invented: no artifact is added, removed or renamed, no
port changes, and every new setting is read by the applications themselves from their own `.env`
(`mic-mooi/shared/Env.java` for the service, Vite for the SPA). `make dev-start`, `dev-stop`,
`dev-status`, `dev-clean` and their `-<artifact>` variants keep working unchanged. Task 15
verifies this explicitly.

---

## 11. README

Extend the existing `## Setup` section only (the README stays a single, concise run/setup
document): a short "Google OAuth2" subsection listing the client-id origin/redirect to register,
the four variables to set (`GOOGLE_CLIENT_ID`, `JWT_SECRET`, `ADMIN_EMAILS`, `CORS_ORIGIN` in
`mic-mooi/.env`; `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID` in `spa-mooi/.env`), and one line
noting that the first sign-in of an address listed in `ADMIN_EMAILS` creates an admin.

---

## 12. Verification and known limits

**Can be verified here:** `cd spa-mooi && bun run typecheck` and `bun run build`.

**Cannot be verified here:** Maven is not installed on this machine, so `mic-mooi` cannot be
compiled or booted, and no end-to-end sign-in can be exercised. The Java code is written against
the exact APIs confirmed from the local artifacts (`nimbus-jose-jwt 10.4` — `JWKSourceBuilder`,
`DefaultJWTProcessor`, `DefaultJWTClaimsVerifier(String audience, JWTClaimsSet, Set<String>)`,
`JWSVerificationKeySelector`, `MACSigner`/`MACVerifier`, `SignedJWT` — all verified present with
`javap`). Once Maven is installed, `make dev-start` compiles and boots the service and the
Liquibase changesets create the three tables.

**Deliberately out of scope** (nothing in this monorepo to attach it to): the spec's live-game
pieces — `WorldRoom.onAuth`, `SessionRevocationWatcher`, the 30s revocation poll and close code
`4001`. This repo has no WebSocket layer. Everything the spec specifies for HTTP revocation is
implemented and is immediate, not eventual.

---

## 13. Tasks

Five tasks are done without stopping; then the user is asked before continuing.

### Chunk 1

- [x] **1. Backend configuration.** `pom.xml` + nimbus dependency; `application.yml` (`app.auth.*`,
      `CORS_ORIGIN`, `logging.level.auth`, log pattern); `mic-mooi/.env.example` (auth block,
      `WEB_CORS_ALLOWED_ORIGINS` → `CORS_ORIGIN`, `LOG_LEVEL_AUTH`). §4.
- [x] **2. `shared/Auth.java` — settings and crypto.** Class skeleton, `LOG`, `Role`,
      `AuthenticatedPlayer`, `Principal`, `SessionGuard`, `Authenticated`, `RequireRole`,
      `AuthenticationException`, `parseDuration`, `Settings` (boot validation +
      `resolvePlayerRole`), `Tokens` (HS256 sign/verify, refresh secret, SHA-256 digest),
      `Clock` bean. §6.1–6.2.
- [x] **3. `shared/Auth.java` — Google identity provider.** JWKS source, processor, issuer /
      audience / `email_verified` checks, `GoogleIdentity`. §6.3.
- [x] **4. `shared/Auth.java` — HTTP guard + `shared/Web.java` CORS.** Interceptor, argument
      resolver, `WebMvcConfigurer` bean, MDC scoping, `readUserAgent` / `readIpAddress`; widen
      CORS to `/**`. §6.4–6.5.
- [x] **5. Liquibase changesets.** `004-create-players.yaml`, `005-create-auth-sessions.yaml`,
      `006-create-refresh-tokens.yaml` + master includes. §5.

### Chunk 2

- [x] **6. `AuthFeature.java` — persistence.** Entities, `RoleConverter`, the three repositories
      with the atomic `spend`/`revoke`/`touch` queries, and `resolve` (the `SessionGuard`
      implementation). §7.3 + the `resolve` part of §7.4.
- [x] **7. `AuthFeature.java` — login/signup + token issuing.** `loginOrSignupWithGoogle`,
      `refreshProfile`, `issueSessionTokens`, `toPayload`. §7.4.
- [x] **8. `AuthFeature.java` — refresh, replay detection and revocation.** `refreshSession`
      (rotation + the 30s grace window), `revokeSession`, `revokePlayerSessions`. §7.4.
- [x] **9. `AuthFeature.java` — HTTP layer.** The six endpoints, request records with
      `@NotBlank`, response records; plus `GET /health` in `HeartbeatFeature`. §7.1–7.2 + §8.
- [x] **10. SPA configuration and types.** `RawEnv`, `AppEnv`, `env.ts`, `spa-mooi/.env` and
      `.env.example`; every file in §9.2 and `stores/types/AuthState.ts`.

### Chunk 3

- [x] **11. SPA store and transport.** `stores/authStore.ts`, `features/auth/api/authApi.ts`,
      `features/auth/api/currentPlayerApi.ts`. §9.3–9.4.
- [x] **12. SPA token lifecycle.** `toAuthSession.ts`, `accessTokenProvider.ts` (renew-ahead +
      single-flight + the cross-tab race resolution), `authenticatedFetch.ts`, `signOut.ts`. §9.5.
- [x] **13. SPA hooks and components.** `useGoogleIdentityServices.ts`, `useSessionSync.ts`,
      `useAuthStorageSync.ts`, `GoogleSignInButton.tsx`, `SignOutControls.tsx`,
      `HeaderAuthActions.tsx`. §9.6–9.7.
- [x] **14. SPA routing and pages.** `ProtectedRoute`, `RoleRoute`, `GuestRoute`, `routes.ts`,
      `router.tsx`, `LoginPage`, `AccountPage`, `AdminPage`, `App.tsx`, `Header.tsx`. §9.8.
- [x] **15. Docs and verification.** README setup section; `bun run typecheck` and `bun run build`
      in `spa-mooi`; confirm `make dev-status` still resolves both artifacts; report what could
      not be verified without Maven. §10–§12.
