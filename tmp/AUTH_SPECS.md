# Auth — Google OAuth2 + rotating refresh tokens

Google issues an OIDC ID token in the browser; the backend verifies it once and
opens a **session**. The client then holds two tokens: a short-lived access token
for calls, and a single-use refresh token that renews it. A session lasts
indefinitely — only logging out or revoking ends it — and revocation takes effect
on the next call, HTTP and WebSocket alike.

| Layer | Lifetime | Stored where | Ends when |
|---|---|---|---|
| **Session** (`auth_sessions`) | Unbounded | Postgres, one row per sign-in | Logout, or revoke |
| **Refresh token** (`refresh_tokens`) | `REFRESH_TOKEN_EXPIRES_IN` (30d), renewed on every use | Postgres as a SHA-256 digest; secret only on the client | Used once, expired, or its session is revoked |
| **Access token** (JWT, HS256 over `JWT_SECRET`) | `ACCESS_TOKEN_EXPIRES_IN` (15m) | Nowhere server-side — stateless | Expiry, or its session is revoked |

Access token claims: `sub` (player id), `role`, `sid` (session id), `iat`, `exp`.
`sid` is what makes it revocable — a token without a live one is rejected.
Refresh tokens carry nothing: 32 random bytes, base64url, opaque.

Other config: `GOOGLE_CLIENT_ID` (expected `aud`; SPA reads `VITE_GOOGLE_CLIENT_ID`),
`ADMIN_EMAILS` (grants `admin` **at signup only**), `CORS_ORIGIN` (must match the
SPA origin). Log scope: `auth`.

## Flows

Sign up and login share one endpoint — `POST /auth/google` — because the client
cannot know which one it is asking for: only `google_id` tells them apart, and
only the server has seen it before. `LoginOrSignupWithGoogleUseCase` branches on
`findByGoogleId`, and the two branches write different rows.

### Sign up flow

First time this Google account is seen.

```
Browser                        Google GSI         mic-pokeworld API                              Postgres
  |                                 |                     |                                          |
  |--(1) load Google GSI script --> |                     |                                          |
  |<-(2) render Sign-In button ---- |                     |                                          |
  |--(3) trainer clicks ----------> |                     |                                          |
  |<-(4) Google ID token (JWT) ---- |                     |                                          |
  |                                 |                     |                                          |
  |--(5) POST /auth/google { idToken } -----------------> |                                          |
  |                                 |                     |   verify ID token against Google JWKS    |
  |                                 |                     |--SELECT players BY google_id ----------> |
  |                                 |                     |   no row -> this is a signup             |
  |                                 |                     |--INSERT players (role: ADMIN_EMAILS) --> |
  |                                 |                     |--INSERT auth_sessions -----------------> |
  |                                 |                     |--INSERT refresh_tokens (digest) -------> |
  |                                 |                     |   sign access JWT (sub, role, sid)       |
  |<-(6) 200 { accessToken, refreshToken, player } ------ |                                          |
  |   (7) store + navigate to "/"   |                     |                                          |
```

- Steps 1–4 never touch our server. Step 5 is the only place a Google credential
  reaches us, and it is used once and never stored.
- **`role` is decided here and only here.** `resolvePlayerRole` matches the Google
  email against `ADMIN_EMAILS`; adding an address later does not promote an
  existing player.
- `username`, `email` and `avatarUrl` are seeded from the Google profile.
- The response is identical to a login's — the SPA cannot tell the two apart, and
  does not need to. `isNewPlayer` exists only so the server can log
  `"Player signed up"` instead of `"Player signed in"`.

### Login flow

The Google account already has a player row.

```
Browser                        Google GSI         mic-pokeworld API                              Postgres
  |                                 |                     |                                          |
  |--(1..4) Google handshake -----> |                     |                                          |
  |                                 |                     |                                          |
  |--(5) POST /auth/google { idToken } -----------------> |                                          |
  |                                 |                     |   verify ID token against Google JWKS    |
  |                                 |                     |--SELECT players BY google_id ----------> |
  |                                 |                     |   row found -> this is a login           |
  |                                 |                     |--UPDATE players (profile if changed) --> |
  |                                 |                     |--INSERT auth_sessions -----------------> |
  |                                 |                     |--INSERT refresh_tokens (digest) -------> |
  |                                 |                     |   sign access JWT (sub, role, sid)       |
  |<-(6) 200 { accessToken, refreshToken, player } ------ |                                          |
  |   (7) store + navigate to "/"   |                     |                                          |
```

- **No player row is created**, and **`role` is never touched** — it is ours, not
  Google's. `refreshProfile` compares the three profile fields first and skips the
  `UPDATE` when nothing changed.
- **A new session row every time**, never a reused one. That is what makes each
  device separately revocable, and what stops signing in on a new machine from
  silently extending an old login.

Where the two differ, in one table:

| Table | Sign up | Login |
|---|---|---|
| `players` | `INSERT`, role resolved from `ADMIN_EMAILS` | `UPDATE` of name/email/avatar, and only when Google's copy differs; role untouched |
| `auth_sessions` | `INSERT` | `INSERT` |
| `refresh_tokens` | `INSERT` | `INSERT` |

### Session use and renewal

Shared by both entry paths, once the tokens are in the store.

```
Browser                                           mic-pokeworld API                              Postgres
  |                                                       |                                          |
  |   (8) persist to localStorage, deadline = now + expiresIn                                        |
  |                                                       |                                          |
  |--(9) GET /me   Authorization: Bearer <access> ------> |                                          |
  |                                                       |   verify JWT -> session alive?           |
  |                                                       |--SELECT auth_sessions, then players ---> |
  |<-(10) 200 { player } -------------------------------- |                                          |
  |                                                       |                                          |
  |   ... 15 minutes later, or on app start ...           |                                          |
  |--(11) POST /auth/refresh { refreshToken } ----------> |                                          |
  |                                                       |   digest -> find row; spend atomically   |
  |                                                       |--UPDATE refresh_tokens SET used_at ----> |
  |                                                       |--INSERT replacement; touch session ----> |
  |<-(12) 200 { accessToken, refreshToken, player } ----- |                                          |
  |                                                       |                                          |
  |--(13) room.join("world", { token }) ----------------> |                                          |
  |                                                       |   onAuth -> same check as (9)            |
  |<-(14) joined; polled every 30s for revocation ------- |                                          |
```

Every response in (6) and (12) also carries `expiresIn`, in seconds — relative, so
a client with a skewed clock still renews in time.

**Rotation and the two-tab race.** Every renewal spends the presented token and
issues a new one. The claim is one conditional statement — `UPDATE ... SET
used_at = now() WHERE id = ? AND used_at IS NULL RETURNING id` — so Postgres
serialises concurrent attempts and exactly one wins. Presenting an already-spent
token is judged by *when* it was spent:

- **Within 30s** (`REPLAY_GRACE_SECONDS`) → `401`, session untouched. Two tabs
  can both reach for the same token before either stores the replacement.
- **After 30s** → a copy of a retired token is the only explanation left, so the
  **whole session is revoked**. Logged at `warn`.

The SPA closes the gap from its side: one renewal at a time per tab (`inFlight`
single-flight in `access-token-provider.ts`), and a `storage` listener in
`auth-store.ts` rehydrates the other tabs. If a renewal fails but the store now
holds a *different* refresh token, another tab won the race and its access token
is used instead of erroring.

### Log out flow

Ends **this device only**.

1. SPA `signOut()` clears the store first — a trainer who pressed LOG OUT must end
   up logged out whatever the network does.
2. `POST /auth/logout { refreshToken }`, best-effort (`.catch()`).
3. Server hashes the token, finds its row, and revokes **the session**, not the
   token — that voids every access token ever minted under it.
4. Always `204`, even for an unknown token: logout must succeed for a client
   holding a retired token, and a different answer would be an oracle for
   guessing tokens.
5. The route guard sees an empty store and redirects to `/login`.

### Revoke flow

Three ways a session dies; all of them land on `auth_sessions.revoked_at`.

| Trigger | Entry point | Effect |
|---|---|---|
| Log out everywhere | `POST /auth/logout-all` (bearer) | Revokes **every** session of the player, the caller's included — sparing it would leave the session an attacker most likely holds. Returns `{ revokedSessions: n }`. |
| Log out this device | `POST /auth/logout` | Revokes that one session (above). |
| Replay detection | — | A refresh token reused more than 30s after it was spent revokes its session automatically. |

How it takes effect:

- **HTTP** — immediate, not eventual. `AuthenticateAccessTokenUseCase` re-checks
  that the session is active on every call, and that the token's `sub` matches the
  session's `playerId` (a mismatch is treated as forgery). Cost: two indexed
  primary-key lookups per request.
- **Live game connections** — a join is authenticated once and the socket then
  stays open for hours, so `WorldRoom` polls every 30s via
  `SessionRevocationWatcher` and disconnects clients whose session died (close
  code `4001`). A failed poll reports nothing — an unreachable database is not
  evidence of revocation.
- **The SPA** — `useSessionSync` calls `/me` on app start and on tab focus, so a
  session revoked elsewhere drops a background tab to the title screen as soon as
  it is focused. A 401 on any `authenticatedFetch` clears the store after one
  retry against a freshly renewed token.

## Endpoints

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/auth/google` | none | `{ idToken }` | `200 { accessToken, expiresIn, refreshToken, player }` |
| `POST` | `/auth/refresh` | none | `{ refreshToken }` | `200` same payload, rotated |
| `POST` | `/auth/logout` | none | `{ refreshToken }` | `204` always |
| `POST` | `/auth/logout-all` | bearer | — | `200 { revokedSessions }` |
| `GET` | `/me` | bearer | — | `200 { player }` |
| `GET` | `/admin/ping` | bearer + `role === "admin"` | — | `200`, else `403` |
| `GET` | `/health` | none | — | `200 { status }` |

Missing/empty body field → `400`. Bad, expired, or revoked credential → `401`.
Wrong role → `403`. All shaped by `error-handler.ts`. `googleId` never leaves the
server (`auth-payloads.ts`).

## Middlewares usage examples

### Adding authentication to an endpoint

`authenticate` is built once in [server.ts](mic-pokeworld/src/infrastructure/http/server.ts)
and passed into each router, so every front door shares one set of adapters. Put it
in front of the handler:

```ts
export function createInventoryRouter(authenticate: RequestHandler): Router {
  const router = Router();

  router.get("/inventory", authenticate, (req, res, next) => {
    const player = req.player;
    if (!player) {
      // Unreachable: `authenticate` answers 401 itself rather than falling through.
      next(new Error("Authenticated request is missing its player"));
      return;
    }

    res.json({ playerId: player.id });
  });

  return router;
}
```

Then wire it in `createHttpServer`: `app.use(createInventoryRouter(authenticate))`.

After the middleware runs, `req.player`, `req.sessionId` and a `req.log` already
scoped to `{ playerId, sessionId }` are available. Async handlers must pass
failures to `next(error)` — a thrown promise never reaches the error handler on
its own.

### Adding authorization to an endpoint

`requireRole` goes **after** `authenticate` — it reads `req.player`, and answers
`401` on its own if it is missing:

```ts
router.post("/admin/broadcast", authenticate, requireRole("admin"), (req, res) => {
  res.status(202).end();
});
```

Roles come from [player-role.ts](mic-pokeworld/src/domain/value-objects/player-role.ts):
`"member" | "admin"`. The check is an exact match, not a hierarchy.

### Adding authentication to a SPA page

Nest the route inside `ProtectedRoute` in [App.tsx](spa-pokeworld/src/app/App.tsx) —
it requires **both** a player and a session, hosts `useSessionSync`, and redirects
to `/login` otherwise:

```tsx
<Route element={<ProtectedRoute />}>
  <Route path="/" element={<HomePage />} />
  <Route path="/bag" element={<BagPage />} />
</Route>
```

Inside the page, call the API through `authenticatedFetch` — it attaches the
bearer, renews ahead of expiry and retries once on `401`:

```ts
const response = await authenticatedFetch("/bag");
```

Never read `session.accessToken` from the store directly: it may be seconds from
expiry, or already rotated by another tab. Use `getAccessToken()` when a raw
token is needed (the Colyseus join is the one such case).

### Adding authorization to a SPA page

Same move as authentication, one level deeper: nest the route inside
[RoleRoute](spa-pokeworld/src/shared/router/role-route.tsx), which sits inside
`ProtectedRoute` so the session is verified first:

```tsx
<Route element={<ProtectedRoute />}>
  <Route path="/" element={<HomePage />} />

  <Route element={<RoleRoute role="admin" />}>
    <Route path="/admin" element={<AdminPage />} />
  </Route>
</Route>
```

That is the whole change — no per-page code. A trainer without the role is sent
to `/`; pass `redirectTo` for anything else. A missing profile goes to `/login`
instead, because that is a signed-out trainer rather than an unauthorised one.

For hiding a control rather than a whole page, read the role inline:

```ts
const isAdmin = useAuthStore((state) => state.player?.role === "admin");
```

The role is server-issued: it is a claim in the access token and comes back on
every `/me`, so `useSessionSync` re-checks it on mount and on tab focus, and a
demotion reaches the tab on its next focus. It is still a **display** gate — the
store is editable in the browser — so the endpoints behind the page must carry
`requireRole` as well. That is where the answer actually comes from; the guard
only stops a member from landing on a page whose every request would 403.

## Core files

**Domain** (`mic-pokeworld/src/domain/`)

| File | Role |
|---|---|
| [entities/auth-session.ts](mic-pokeworld/src/domain/entities/auth-session.ts) | One sign-in — the unit revocation acts on |
| [entities/refresh-token.ts](mic-pokeworld/src/domain/entities/refresh-token.ts) | Single-use renewal ticket |
| [value-objects/session-tokens.ts](mic-pokeworld/src/domain/value-objects/session-tokens.ts) | The token pair handed to a client |
| [value-objects/player-role.ts](mic-pokeworld/src/domain/value-objects/player-role.ts) | `member \| admin`, plus the `ADMIN_EMAILS` resolution |
| [ports/auth-session-repository.ts](mic-pokeworld/src/domain/ports/auth-session-repository.ts) | Create, find-active, revoke one, revoke all |
| [ports/refresh-token-repository.ts](mic-pokeworld/src/domain/ports/refresh-token-repository.ts) | Store by digest, find by digest, spend atomically |
| [ports/token-service.ts](mic-pokeworld/src/domain/ports/token-service.ts) | Access token sign/verify |
| [ports/token-generator.ts](mic-pokeworld/src/domain/ports/token-generator.ts) | Random refresh token secrets |
| [ports/token-hasher.ts](mic-pokeworld/src/domain/ports/token-hasher.ts) | Refresh token digesting |
| [ports/oauth-identity-provider.ts](mic-pokeworld/src/domain/ports/oauth-identity-provider.ts) | Verify a third-party ID token into an identity |
| [errors/authentication-error.ts](mic-pokeworld/src/domain/errors/authentication-error.ts) | The throw that becomes a `401` |

**Application** (`mic-pokeworld/src/application/`)

| File | Role |
|---|---|
| [services/refresh-token-issuer.ts](mic-pokeworld/src/application/services/refresh-token-issuer.ts) | Mints and persists one refresh token — why rotation is unconditional |
| [services/session-token-issuer.ts](mic-pokeworld/src/application/services/session-token-issuer.ts) | Issues the pair, shared by login and refresh |
| [use-cases/login-or-signup-with-google.ts](mic-pokeworld/src/application/use-cases/login-or-signup-with-google.ts) | Verify identity → find/create player → open session |
| [use-cases/refresh-session.ts](mic-pokeworld/src/application/use-cases/refresh-session.ts) | Rotation + replay detection + the 30s grace window |
| [use-cases/authenticate-access-token.ts](mic-pokeworld/src/application/use-cases/authenticate-access-token.ts) | Verify JWT + session-alive + subject-binding check |
| [use-cases/revoke-session.ts](mic-pokeworld/src/application/use-cases/revoke-session.ts) | Revokes the session behind one refresh token; silent on unknown |
| [use-cases/revoke-player-sessions.ts](mic-pokeworld/src/application/use-cases/revoke-player-sessions.ts) | Revokes every session of a player, caller included |

**Infrastructure** (`mic-pokeworld/src/infrastructure/`)

| File | Role |
|---|---|
| [auth/auth-module.ts](mic-pokeworld/src/infrastructure/auth/auth-module.ts) | The one composition root, shared by HTTP and game server |
| [auth/google-identity-provider.ts](mic-pokeworld/src/infrastructure/auth/google-identity-provider.ts) | JWKS, issuer, audience and `email_verified` checks |
| [auth/jwt-token-service.ts](mic-pokeworld/src/infrastructure/auth/jwt-token-service.ts) | Signs and verifies access tokens (HS256) |
| [auth/random-token-generator.ts](mic-pokeworld/src/infrastructure/auth/random-token-generator.ts) | 32 bytes from `randomBytes`, base64url |
| [auth/sha256-token-hasher.ts](mic-pokeworld/src/infrastructure/auth/sha256-token-hasher.ts) | The digest stored instead of the refresh token |
| [http/server.ts](mic-pokeworld/src/infrastructure/http/server.ts) | Builds `authenticate` once and mounts every route |
| [http/middlewares/authenticate.ts](mic-pokeworld/src/infrastructure/http/middlewares/authenticate.ts) | Bearer → `req.player`, `req.sessionId`, scoped `req.log` |
| [http/middlewares/require-role.ts](mic-pokeworld/src/infrastructure/http/middlewares/require-role.ts) | Role gate — `401` unauthenticated, `403` wrong role |
| [http/middlewares/error-handler.ts](mic-pokeworld/src/infrastructure/http/middlewares/error-handler.ts) | Turns `AuthenticationError` into `401` and logs it |
| [http/routes/auth-routes.ts](mic-pokeworld/src/infrastructure/http/routes/auth-routes.ts) | The four session endpoints |
| [http/routes/player-routes.ts](mic-pokeworld/src/infrastructure/http/routes/player-routes.ts) | `/me`, which doubles as the session check |
| [http/routes/auth-payloads.ts](mic-pokeworld/src/infrastructure/http/routes/auth-payloads.ts) | Response shapes; `googleId` never leaves |
| [http/routes/read-required-string.ts](mic-pokeworld/src/infrastructure/http/routes/read-required-string.ts) | Body field validation behind the `400`s |
| [http/routes/read-sign-in-origin.ts](mic-pokeworld/src/infrastructure/http/routes/read-sign-in-origin.ts) | User agent + IP recorded on the session |
| [database/schema/auth-session.ts](mic-pokeworld/src/infrastructure/database/schema/auth-session.ts) | `auth_sessions` table, cascades on player delete |
| [database/schema/refresh-token.ts](mic-pokeworld/src/infrastructure/database/schema/refresh-token.ts) | `refresh_tokens` table, cascades on session delete |
| [database/auth-session-repository.ts](mic-pokeworld/src/infrastructure/database/auth-session-repository.ts) | Drizzle adapter for sessions |
| [database/refresh-token-repository.ts](mic-pokeworld/src/infrastructure/database/refresh-token-repository.ts) | Drizzle adapter; holds the atomic single-use `UPDATE` |
| [game-server/rooms/world-room.ts](mic-pokeworld/src/infrastructure/game-server/rooms/world-room.ts) | `onAuth` authenticates the join with the same use case |
| [game-server/session-revocation-watcher.ts](mic-pokeworld/src/infrastructure/game-server/session-revocation-watcher.ts) | 30s poll that disconnects revoked sessions (`4001`) |
| [config/env.ts](mic-pokeworld/src/config/env.ts) | Reads and validates every auth variable at boot |
| [config/parse-duration.ts](mic-pokeworld/src/config/parse-duration.ts) | `<n><s\|m\|h\|d>` TTLs; malformed values throw at boot |
| `drizzle/0001_nappy_omega_red.sql` | Migration creating both auth tables |

**Frontend** (`spa-pokeworld/src/`)

| File | Role |
|---|---|
| [features/auth/store/auth-store.ts](spa-pokeworld/src/features/auth/store/auth-store.ts) | `{ player, session }` in `localStorage` v2, with cross-tab sync |
| [features/auth/api/auth-api.ts](spa-pokeworld/src/features/auth/api/auth-api.ts) | Transport for the four auth endpoints; no store access |
| [features/auth/api/current-player-api.ts](spa-pokeworld/src/features/auth/api/current-player-api.ts) | `/me` |
| [features/auth/lib/access-token-provider.ts](spa-pokeworld/src/features/auth/lib/access-token-provider.ts) | `getAccessToken()` — renew-ahead + single-flight |
| [features/auth/lib/authenticated-fetch.ts](spa-pokeworld/src/features/auth/lib/authenticated-fetch.ts) | Bearer + retry-once on `401`, then clear the session |
| [features/auth/lib/to-auth-session.ts](spa-pokeworld/src/features/auth/lib/to-auth-session.ts) | `expiresIn` → absolute deadline |
| [features/auth/lib/sign-out.ts](spa-pokeworld/src/features/auth/lib/sign-out.ts) | `signOut` / `signOutEverywhere` — local first, server best-effort |
| [features/auth/hooks/use-session-sync.ts](spa-pokeworld/src/features/auth/hooks/use-session-sync.ts) | Verifies the session on mount and on tab focus |
| [features/auth/hooks/use-google-identity-services.ts](spa-pokeworld/src/features/auth/hooks/use-google-identity-services.ts) | Loads GSI and renders Google's button |
| [features/auth/components/GoogleSignInButton.tsx](spa-pokeworld/src/features/auth/components/GoogleSignInButton.tsx) | Pixel button over Google's invisible one |
| [features/auth/components/SignOutControls.tsx](spa-pokeworld/src/features/auth/components/SignOutControls.tsx) | LOG OUT + ALL DEVICES, inline two-step confirm |
| [shared/router/protected-route.tsx](spa-pokeworld/src/shared/router/protected-route.tsx) | Requires **both** player and session; hosts `useSessionSync` |
| [shared/router/role-route.tsx](spa-pokeworld/src/shared/router/role-route.tsx) | Role gate for a route subtree; nests inside `ProtectedRoute` |
| [shared/router/guest-route.tsx](spa-pokeworld/src/shared/router/guest-route.tsx) | Sends an already-signed-in trainer away from `/login` |
| [app/App.tsx](spa-pokeworld/src/app/App.tsx) | Where a route is placed under a guard |
| [pages/login/LoginPage.tsx](spa-pokeworld/src/pages/login/LoginPage.tsx) | ID token → `loginWithGoogle` → store → `/` |

## Database

Three tables, each one owning the row below it. Both foreign keys cascade on
delete, so removing a player takes their sessions and every token with them.

```
players 1 ──< auth_sessions 1 ──< refresh_tokens
   id            player_id            session_id
```

Nothing is ever deleted in normal operation: `revoked_at` and `used_at` are the
only state that changes, which is what leaves the trail replay detection reads.

### `players`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, `gen_random_uuid()` | The access token's `sub` |
| `google_id` | `varchar(255)` NOT NULL UNIQUE | The only stable link to Google — decides sign up vs. login, and never leaves the server |
| `email` | `varchar(255)` NOT NULL UNIQUE | From Google; refreshed on every login |
| `username` | `varchar(64)` NOT NULL | Google's display name |
| `avatar_url` | `varchar(512)` NULL | Google's photo |
| `role` | `player_role` NOT NULL DEFAULT `'member'` | Enum `member \| admin`. Set at signup from `ADMIN_EMAILS`, never after |
| `created_at` | `timestamptz` NOT NULL `now()` | |

### `auth_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | The access token's `sid` |
| `player_id` | `uuid` NOT NULL → `players.id` CASCADE | Indexed — "revoke everything for this player" is the one query not by id |
| `created_at` | `timestamptz` NOT NULL `now()` | When this device signed in |
| `last_used_at` | `timestamptz` NOT NULL `now()` | Touched on every renewal |
| `revoked_at` | `timestamptz` NULL | **NULL means alive.** The single fact every auth check reads |
| `user_agent` | `varchar(512)` NULL | Recorded so a player could recognise the device later |
| `ip_address` | `varchar(64)` NULL | Same |

### `refresh_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `session_id` | `uuid` NOT NULL → `auth_sessions.id` CASCADE | Indexed |
| `token_hash` | `varchar(64)` NOT NULL UNIQUE | SHA-256 hex of the secret. The secret itself exists only on the client |
| `expires_at` | `timestamptz` NOT NULL | `created_at + REFRESH_TOKEN_EXPIRES_IN` |
| `created_at` | `timestamptz` NOT NULL `now()` | |
| `used_at` | `timestamptz` NULL | NULL = unspent. Set once, atomically — the rotation and replay signal |

### Example data

One trainer, signed in on a laptop and a phone, who logged the phone out this
morning. `token_hash` values are 64 hex characters; truncated here.

**`players`**

| id | google_id | email | username | role | created_at |
|---|---|---|---|---|---|
| `7c9e6679-…-e07fc1f90ae7` | `114... ` | `ethan@gmail.com` | `Ethan` | `member` | `2026-07-20 09:12:04+00` |
| `2b4d1c88-…-9ab3f7c10d21` | `109...` | `mydherin@gmail.com` | `Mydherin` | `admin` | `2026-06-02 18:40:11+00` |

**`auth_sessions`** — both belong to Ethan

| id | player_id | created_at | last_used_at | revoked_at | user_agent |
|---|---|---|---|---|---|
| `a1b2c3d4-…-000000000001` | `7c9e6679-…` | `2026-07-20 09:12:04+00` | `2026-07-25 08:31:52+00` | `NULL` | `Mozilla/5.0 … Chrome/141` |
| `a1b2c3d4-…-000000000002` | `7c9e6679-…` | `2026-07-24 21:03:47+00` | `2026-07-24 21:44:10+00` | `2026-07-25 07:58:03+00` | `Mozilla/5.0 (iPhone) … Safari` |

**`refresh_tokens`**

| id | session_id | token_hash | created_at | expires_at | used_at |
|---|---|---|---|---|---|
| `…0011` | `…0001` | `9f86d081884c7d65…` | `2026-07-20 09:12:04+00` | `2026-08-19 09:12:04+00` | `2026-07-25 08:31:52+00` |
| `…0012` | `…0001` | `0ba904eae8773b70…` | `2026-07-25 08:31:52+00` | `2026-08-24 08:31:52+00` | `NULL` |
| `…0021` | `…0002` | `2c26b46b68ffc68f…` | `2026-07-24 21:03:47+00` | `2026-08-23 21:03:47+00` | `NULL` |

Reading it: the laptop session has renewed once — row `…0011` is spent, `…0012`
is the token that tab holds now. The phone's token was never spent, but its
session carries a `revoked_at`, so presenting it fails on the session check
rather than on the token. Row `…0011` stays: if that spent secret shows up again
more than 30s after `used_at`, it is a copy, and session `…0001` is revoked.

Queries behind each operation:

| Operation | Reads / writes |
|---|---|
| Authenticate a call | `SELECT auth_sessions WHERE id = <sid> AND revoked_at IS NULL`, then `SELECT players WHERE id = <sub>` |
| Refresh | `SELECT refresh_tokens WHERE token_hash = ?` → `UPDATE … SET used_at = now() WHERE id = ? AND used_at IS NULL RETURNING id` → `INSERT` the replacement + touch `last_used_at` |
| Logout | `token_hash` → `session_id` → `UPDATE auth_sessions SET revoked_at = now() WHERE id = ? AND revoked_at IS NULL` — guarded so a repeated logout keeps the original timestamp |
| Logout everywhere | `UPDATE auth_sessions SET revoked_at = now() WHERE player_id = ? AND revoked_at IS NULL` |
| Revocation poll (game) | `SELECT id FROM auth_sessions WHERE id IN (<connected sids>) AND revoked_at IS NULL` |
