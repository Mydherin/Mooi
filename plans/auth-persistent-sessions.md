# Plan: persistent Google sign-in (30-day sliding refresh tokens)

Status: **proposed, awaiting review**. Nothing in this plan is implemented yet.

## 1. Goal

A player signs in with Google once and **stays signed in for as long as they keep using Mooi**. A sign-in
ends only when:

- the player has not used Mooi for **30 days** (the refresh token expires), or
- the player signs out (this device or every device), or an administrator signs them out or bans them, or
- a stolen refresh token is detected (replay), which ends that sign-in.

It must never end because of a network blip, an offline laptop, a server restart, two tabs refreshing at
the same moment, a lost refresh response on a phone, or the browser throttling a background tab.

At the same time, sign-in becomes **more secure**: the long-lived credential (the refresh token) leaves
JavaScript-readable storage and moves to an `HttpOnly` cookie.

No regressions: existing signed-in players are migrated without signing in again, every other feature
(API calls, live streams, mic-sessions, agents acting for the player, admin sign-out and bans, previews,
local runs) keeps working with the same public client API (`getAccessToken`, `authenticatedFetch`).

## 2. How it works today (facts this plan relies on)

### 2.1 Backend (`mic-mooi`, Spring Boot 4.1, Java, nimbus-jose-jwt)

- `mic-mooi/src/main/java/dev/mooi/mic/shared/Auth.java`: transversal auth aspect.
  - `Settings` reads `app.auth.*` (from `application.yml`, env-overridable): `ACCESS_TOKEN_EXPIRES_IN=15m`,
    `REFRESH_TOKEN_EXPIRES_IN=365d`, `SESSION_MAX_LIFETIME=730d`, `REPLAY_GRACE_SECONDS=30`,
    `REFRESH_TOKEN_PURGE_CRON=0 30 3 * * *`. Durations use `parseDuration` (`<n><s|m|h|d>`, `n > 0`).
  - `Tokens`: HS256 access JWT (`sub` = player id, `role`, `sid` = auth session id, `iat`, `exp`); opaque
    refresh token = 32 random bytes base64url; only its SHA-256 hex digest is stored.
  - `GoogleIdentityProvider` verifies Google ID tokens (JWKS, issuer, audience, `email_verified`), with a
    development mock (`AUTH_GOOGLE_MOCK_ENABLED`).
  - `AuthInterceptor` guards `@Authenticated` / `@RequireRole` / `@ServiceOnly` / `@ServiceCall` handlers:
    verifies the bearer access token, then `SessionGuard.resolve(sid, sub)` (session alive, owner matches,
    player not banned) on every request.
- `mic-mooi/src/main/java/dev/mooi/mic/features/AuthFeature.java`: endpoints, service, entities.
  - `POST /auth/google {idToken}` → new `auth_sessions` row + token pair → `SessionPayload {accessToken,
    expiresIn, refreshToken, player}`.
  - `POST /auth/refresh {refreshToken}` → rotation: the presented row is spent (`used_at`, atomic
    conditional `UPDATE`), a new row is issued with `expires_at = now + refreshTtl` (sliding), session
    `last_used_at` is touched. A spent token presented again **within** 30 s → plain 401 (tab race); **after**
    30 s → the whole session is revoked (replay). Session older than `SESSION_MAX_LIFETIME` → revoked.
  - `POST /auth/logout {refreshToken}` (always 204), `POST /auth/logout-all` (bearer), `GET /me`,
    `POST /internal/auth/sessions/{sid}/access-token` (service-only; mic-sessions renews tokens for agents),
    admin sign-out / ban / unban.
  - Nightly `purgeExpiredRefreshTokens` deletes rows with `expires_at < now`.
- Tables (Liquibase, `mic-mooi/src/main/resources/db/changelog/changes/`, last is `033-...`):
  - `auth_sessions(id uuid pk, player_id uuid fk→players cascade, created_at, last_used_at, revoked_at null,
    user_agent varchar(512), ip_address varchar(64))`, index on `player_id`.
  - `refresh_tokens(id uuid pk, session_id uuid fk→auth_sessions cascade, token_hash varchar(64) unique,
    expires_at, created_at, used_at null)`, index on `session_id`.
  - `players.banned_at` (032).
- `AdminFeature` reads `auth_sessions` (`last_used_at`, `revoked_at IS NULL`) to show sign-ins.
- `Web.java`: CORS for `app.cors.allowed-origins` (`CORS_ORIGIN`), no credentials; single `ApiError` contract.

### 2.2 Gateway and deployments

- `spa-mooi/nginx.conf` is the single origin: `/api/mooi/*` → mic-mooi (prefix stripped, so mic-mooi sees
  `/auth/refresh`), `/api/sessions/*` → mic-sessions, `/preview/*` → mic-sessions preview proxy. **SPA and
  API share one origin**, so cookies are first-party.
- Dev previews of Mooi itself run under `/preview/<id>/` of the same origin. The preview proxy
  (`mic-sessions/src/mic_sessions/shared/previews.py`, `_response_headers`) **rewrites every `Set-Cookie`
  `Path` to live inside `/preview/<id>/`**, so each preview has its own cookie jar, apart from Mooi's.
- Production (`deploy/production/compose.prod.yml`) sets no auth TTL variables: `application.yml` defaults
  apply. Changing defaults there changes production **without touching production-owned files**.
- `compose.yml` (dev session channel) builds the SPA with `VITE_API_BASE_URL=${MOOI_PREVIEW_BASE_PATH:-/}api/mooi`
  and storage prefix `mooi-preview<base path>`. No change needed there.

### 2.3 SPA (`spa-mooi`, React 19, zustand 5, TypeScript, Vite)

- `stores/authStore.ts`: zustand `persist` to `localStorage` key `${storagePrefix}:auth`, version 2,
  holding `player` **and** `session {accessToken, refreshToken, expiresAt}`.
- `features/auth/lib/accessTokenProvider.ts`: `getAccessToken(force)`, renews 30 s before expiry,
  per-tab single-flight.
- `features/auth/lib/authenticatedFetch.ts` and `features/sessions/lib/sessionsFetch.ts`: attach bearer,
  retry once on 401 with a forced renewal.
- `features/auth/hooks/useSessionSync.ts`: calls `/me` on mount, focus and visibility.
- `features/auth/hooks/useAuthStorageSync.ts`: rehydrates the store on cross-tab `storage` events.
- `features/sessions/lib/openEventStream.ts`: SSE via `fetch`, calls `getAccessToken()` per (re)connect,
  reconnects with backoff on any thrown error.
- Routes: `shared/router/ProtectedRoute.tsx` / `GuestRoute.tsx` require `player && session`.
- `pages/LoginPage.tsx`: Google button (or mock) → `loginWithGoogle` → `setSession`.

## 3. Root causes of the unexpected sign-outs

The backend already slides the refresh token; the player is signed out by the **client** treating any
failure as "session over", plus two server-side edge cases:

1. **Every renewal failure clears the session.** `accessTokenProvider.renew` calls `store.clear()` on *any*
   error: offline, DNS failure, 502 while mic-mooi restarts during a deploy, timeout. Waking a laptop before
   Wi-Fi is up is enough.
2. **`useSessionSync` clears on any `/me` failure**, including network errors and 5xx, on every focus.
3. **`authenticatedFetch` / `sessionsFetch` clear the store** whenever `getAccessToken` returns `null`,
   which happens on any renewal failure (cause 1).
4. **Cross-tab race wipes every tab.** Tabs share the refresh token through `localStorage` but single-flight
   is per tab. Two tabs renew at once; the loser gets 401 (grace window). Its fallback compares with its
   own in-memory store, which may not have rehydrated yet, so it calls `clear()`, which **writes the empty
   state to `localStorage` and signs out every tab**, including the winner.
5. **Lost refresh response revokes the session.** On a phone or a sleeping laptop, the server can spend
   the token and commit while the response never arrives. The client still holds the spent token; its next
   attempt (> 30 s later) is judged a replay and the **whole session is revoked**.
6. **Long-lived secret in `localStorage`.** Not a sign-out cause, but a security gap: any script on the
   origin (an XSS, a compromised dependency, or code inside a same-origin preview) can read and exfiltrate
   a refresh token valid for a year.
7. **Absolute ceiling.** `SESSION_MAX_LIFETIME=730d` ends even an active sign-in after two years, which
   contradicts "if I keep connecting I never sign in again".

## 4. Target design

### 4.1 Token model

| Credential | Lifetime | Where it lives | Sent as |
| --- | --- | --- | --- |
| Access token (HS256 JWT, unchanged claims) | 15 min | **Memory only** of each tab (shared between tabs via `BroadcastChannel`) | `Authorization: Bearer` (unchanged for mic-mooi and mic-sessions) |
| Refresh token (opaque, single-use, rotated) | **30 days sliding**: every rotation issues a new one valid 30 days | **`HttpOnly` cookie**, scoped to the auth endpoints | Cookie, automatically, only on `/api/mooi/auth/*` |
| Player profile (non-secret) | until sign-out | `localStorage` (zustand persist) | — (instant shell render, cross-tab sign-in/out signal) |

Consequences:

- Any use of Mooi at least once every 30 days renews the refresh token, so an active player never signs in
  again. 30 days without any renewal → the token and the sign-in expire → Google sign-in again.
- **No absolute ceiling by default**: `SESSION_MAX_LIFETIME` becomes optional (blank = none), as requested.
  Rotation + replay detection + `HttpOnly` storage are what bound a stolen token.
- JavaScript never sees the refresh token again.

### 4.2 Refresh cookie

```
Set-Cookie: mooi_refresh=<secret>; Path=/api/mooi/auth; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict
```

- **Name** `mooi_refresh` (`AUTH_REFRESH_COOKIE_NAME`). Not `__Host-` (requires `Path=/`, which would send
  the token to `/preview/*` apps) and not `__Secure-` (would break local plain-http setups when `Secure`
  is turned off).
- **Path** `/api/mooi/auth` (`AUTH_REFRESH_COOKIE_PATH`): the public path of the auth endpoints behind the
  gateway. Never sent to the SPA, `/api/sessions`, or `/preview/*`. Inside a Mooi preview of Mooi, the
  preview proxy rewrites it to `/preview/<id>/api/mooi/auth` automatically: previews and production never
  share or overwrite each other's cookie (same name, different path = different cookie).
- **No `Domain`**: host-only.
- **`Max-Age`** = refresh TTL, re-sent on every rotation (sliding, same as the server row).
- **`Secure`** (`AUTH_REFRESH_COOKIE_SECURE`, default `true`). Production and previews are HTTPS; browsers
  accept `Secure` cookies on `http://localhost`, so local `make` runs work. Set `false` only for plain-http
  hosts other than localhost.
- **`SameSite=Strict`**: never sent on cross-site requests (CSRF). The SPA's own `fetch` calls are
  same-site, so they always carry it.
- Clearing: same attributes with `Max-Age=0`.

### 4.3 CSRF protection of cookie-authenticated endpoints

`/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/google` are protected by three layers:

1. `SameSite=Strict` cookie.
2. Required header `X-Mooi-Auth: cookie` on every SPA auth call. A cross-origin page cannot send a custom
   header without a CORS preflight, which `Web.java` refuses for unknown origins.
3. `Origin` check: when the request carries `Origin`, it must be one of `app.cors.allowed-origins`
   (`CORS_ORIGIN`); otherwise 403. (Requests without `Origin` are non-browser clients and carry no cookie
   of the player.)

### 4.4 Rotation rules (server)

Given the presented refresh token `T` (cookie first, legacy body second, see 4.6):

1. Unknown hash → **401**.
2. Session revoked, player banned (banned → **403** `This account is suspended`), or session idle
   (`last_used_at + refreshTtl < now`), or past the optional ceiling → revoke if needed, **401**.
3. `T` unspent and unexpired → spend it atomically (existing conditional `UPDATE`), issue successor `S`
   (`T.replaced_by_id = S.id`), touch `last_used_at`, set the cookie to `S`, return the access token.
   Losing the atomic `UPDATE` → go to rule 4 (another tab spent it a moment ago).
4. `T` spent **within the grace window** (`used_at + 30 s ≥ now`): two tabs or a fast retry raced.
   **Return 200 with a fresh access token and no `Set-Cookie`** (the browser's cookie jar already holds the
   winner's `S`). No refresh token is handed out, so a stolen copy gains at most 15 min of access during a
   30 s window. *(Today this is a 401, which is what triggers cause 4.)*
5. `T` spent **after** the grace window, and its successor `S = T.replaced_by_id` is **still unspent**:
   the response that carried `S` was lost (cause 5). **Recover**: spend `S` atomically, issue `R`
   (`S.replaced_by_id = R.id`), set the cookie to `R`, return 200. Log at `INFO` "refresh response lost,
   recovered". If spending `S` loses the race, fall through to rule 6.
6. Any other spent `T` (its successor was used too): a copy of a retired token is replayed → **revoke the
   session**, 401, `WARN` log (unchanged behaviour).
7. `T` unspent but expired → **401**.

Security note on rule 5: an attacker holding an older token `T` can use it only while the legitimate
client has not renewed since `S` was issued; the legitimate client's next renewal then presents `S`,
already spent → rule 6 → the session is revoked and the attacker is cut off. Detection is delayed by at
most one access-token lifetime of the legitimate client instead of being immediate, in exchange for never
signing players out on a dropped response. Because the refresh token now lives in an `HttpOnly` cookie,
stealing `T` at all requires much more than an XSS.

### 4.5 Client behaviour

- **One renewal at a time across all tabs**: `navigator.locks.request('<storagePrefix>:auth-refresh', …)`
  (Web Locks; all supported browsers). Inside the lock, a tab first checks whether another tab already
  broadcast a fresh access token while it waited; if so it uses it and does not call the server. Without
  `navigator.locks` (very old browsers) renewal runs unlocked; server rule 4 keeps that safe.
- **Sharing**: after a renewal or sign-in, a tab posts `{type: 'token', accessToken, expiresAt}` on
  `BroadcastChannel('<storagePrefix>:auth')`; other tabs adopt it. Sign-out posts `{type: 'signed-out'}`.
  A newly opened tab has no access token in memory and renews once on its first API call.
- **Error classification** (the core fix):
  - `401` from `/auth/refresh` → `SessionExpiredError` → sign out locally (clear store, broadcast) → login.
  - `403` from `/auth/refresh` → `AccountSuspendedError` → same, the login page shows the suspension message.
  - Network error, timeout, `5xx`, `429`, anything else → `AuthUnavailableError`: **the session is kept**.
    The current request fails like any network failure; renewal is retried by the scheduler.
  - Only `SessionExpiredError` / `AccountSuspendedError` ever clear the store. `authenticatedFetch`,
    `sessionsFetch` and `useSessionSync` never clear on other failures.
- **Proactive renewal** (`useTokenRenewal`, mounted in `ProtectedRoute`): while the document is visible,
  a timer renews 60 s before `expiresAt`; on `visibilitychange` to visible, `online`, `focus` and
  `pageshow`, it renews immediately if the token is missing or due. Transient failures retry with
  exponential backoff (2 s → 60 s cap, reset on success). Hidden tabs do nothing (timers are throttled
  anyway); they renew on demand when used again.
- **Request time**: `getAccessToken()` returns the in-memory token when valid for > 60 s, otherwise renews
  (single-flight per tab + lock across tabs). `authenticatedFetch` keeps its "retry once on 401 with a
  forced renewal" contract.

### 4.6 Migration and compatibility (zero forced sign-ins)

- **Persisted store v2 → v3**: v3 persists only `{ player }`. The zustand `migrate` function moves a v2
  `session.refreshToken` into a module-level `legacyRefreshToken` (memory) and drops `session` from storage.
- **First renewal after upgrade**: if `legacyRefreshToken` is set, the SPA sends it once in the body of
  `POST /auth/refresh` (with `X-Mooi-Auth: cookie`). The server accepts a body token **only when no cookie
  is present**, rotates it as usual, and sets the cookie. From then on the cookie is used. The variable is
  cleared after that call, whatever its outcome.
- **Old SPA bundles still open during the deploy** (they send no `X-Mooi-Auth` header): the server keeps
  the legacy contract for them, i.e. reads the body token and **also returns `refreshToken` in the body**
  (and sets the cookie). When that tab reloads, `index.html` is `no-cache`, so the new bundle loads and
  migrates as above.
- **Removal**: the legacy body path is guarded by `AUTH_LEGACY_BODY_TOKEN_ENABLED` (default `true`). A
  follow-up change, at least 30 days after release (every legacy token is expired or migrated by then),
  removes it and the flag. Add that follow-up as a to-do when this plan is implemented.
- **TTL change on existing rows**: rows issued with the 365-day TTL keep their `expires_at`, but the
  idle check (rule 2: `last_used_at + 30d < now`) applies the 30-day inactivity rule to every session at
  once, old or new.

## 5. Backend changes (`mic-mooi`)

### 5.1 Configuration

`mic-mooi/src/main/resources/application.yml`, under `app.auth`:

```yaml
    access-token-expires-in: ${ACCESS_TOKEN_EXPIRES_IN:15m}
    refresh-token-expires-in: ${REFRESH_TOKEN_EXPIRES_IN:30d}
    # Optional absolute ceiling from the session's creation; blank = none (an active player never signs in again).
    session-max-lifetime: ${SESSION_MAX_LIFETIME:}
    refresh-token-purge-cron: ${REFRESH_TOKEN_PURGE_CRON:0 30 3 * * *}
    replay-grace-seconds: ${REPLAY_GRACE_SECONDS:30}
    refresh-cookie:
      name: ${AUTH_REFRESH_COOKIE_NAME:mooi_refresh}
      # Public path of the auth endpoints behind the gateway; the preview proxy re-roots it per preview.
      path: ${AUTH_REFRESH_COOKIE_PATH:/api/mooi/auth}
      secure: ${AUTH_REFRESH_COOKIE_SECURE:true}
    # Transition only: accept and return the refresh token in JSON bodies (pre-cookie clients). Remove later.
    legacy-body-token-enabled: ${AUTH_LEGACY_BODY_TOKEN_ENABLED:true}
```

`mic-mooi/.env.example`: update the Auth block accordingly (`REFRESH_TOKEN_EXPIRES_IN=30d` with the comment
"Sliding inactivity window: every renewal re-issues it, 30 days without use signs the player out",
`SESSION_MAX_LIFETIME=` "blank = no ceiling", the three cookie variables, the legacy flag).
`deploy/production/*` and `compose.yml` need **no change** (defaults apply).

### 5.2 `shared/Auth.java`

- `Settings`:
  - `sessionMaxLifetime` becomes `Optional<Duration>`: blank → `Optional.empty()`, otherwise
    `parseDuration`. Getter `getSessionMaxLifetime()` returns the `Optional`.
  - New fields: `refreshCookieName` (non-blank, matches `^[A-Za-z0-9_-]+$`), `refreshCookiePath` (must
    start with `/`), `refreshCookieSecure`, `legacyBodyTokenEnabled`, and `allowedOrigins`
    (`Set<String>` from `app.cors.allowed-origins`, comma separated, trimmed) for the Origin check.
    Validate at boot like the existing fields.
  - Optional consistency check: if `sessionMaxLifetime` is present it must be ≥ `refreshTokenTtl`.
- New nested component `RefreshCookies` (mechanics only, no feature imports):

  ```java
  @Component
  @RequiredArgsConstructor
  public static class RefreshCookies {
      public static final String TRANSPORT_HEADER = "X-Mooi-Auth";
      public static final String COOKIE_TRANSPORT = "cookie";

      private final Settings settings;

      /** The refresh secret the browser sent, if any. */
      public Optional<String> read(HttpServletRequest request) { /* iterate request.getCookies(), match name, non-blank */ }

      /** True when the caller is a cookie-transport client (current SPA). */
      public boolean cookieTransport(HttpServletRequest request) {
          return COOKIE_TRANSPORT.equals(request.getHeader(TRANSPORT_HEADER));
      }

      public void write(HttpServletResponse response, String secret) { add(response, secret, settings.getRefreshTokenTtl()); }

      public void clear(HttpServletResponse response) { add(response, "", Duration.ZERO); }

      private void add(HttpServletResponse response, String value, Duration maxAge) {
          ResponseCookie cookie = ResponseCookie.from(settings.getRefreshCookieName(), value)
                  .httpOnly(true).secure(settings.isRefreshCookieSecure()).sameSite("Strict")
                  .path(settings.getRefreshCookiePath()).maxAge(maxAge).build();
          response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
      }

      /**
       * CSRF guard for cookie-authenticated endpoints: a browser Origin must be an allowed one.
       * Throws 403 otherwise.
       */
      public void requireTrustedOrigin(HttpServletRequest request) { /* Origin null → ok; else must be in settings.getAllowedOrigins() */ }
  }
  ```

  Responses carrying `Set-Cookie` must also send `Cache-Control: no-store` (set in the feature).

### 5.3 `features/AuthFeature.java`

Endpoints (paths unchanged, so nothing else in the gateway changes):

```java
@PostMapping("/auth/google")
public SessionPayload loginOrSignup(@Valid @RequestBody GoogleLoginRequest request,
                                    HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
    refreshCookies.requireTrustedOrigin(httpRequest);
    IssuedSession issued = authService.loginOrSignupWithGoogle(request.idToken(), Auth.readUserAgent(httpRequest),
            Auth.readIpAddress(httpRequest));
    return respond(issued, httpRequest, httpResponse);
}

@PostMapping("/auth/refresh")
public SessionPayload refresh(@RequestBody(required = false) LegacyRefreshRequest body,
                              HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
    refreshCookies.requireTrustedOrigin(httpRequest);
    String presented = presentedToken(body, httpRequest);          // cookie first, legacy body second
    IssuedSession issued = authService.refreshSession(presented);  // may carry no new refresh secret (grace)
    return respond(issued, httpRequest, httpResponse);
}

@PostMapping("/auth/logout")
@ResponseStatus(HttpStatus.NO_CONTENT)
public void logout(@RequestBody(required = false) LegacyRefreshRequest body,
                   HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
    refreshCookies.requireTrustedOrigin(httpRequest);
    presentedTokenOrNull(body, httpRequest).ifPresent(authService::revokeSession);
    refreshCookies.clear(httpResponse);                            // always 204, as today
}

@PostMapping("/auth/logout-all")
@Auth.Authenticated
public RevokedSessionsPayload logoutEverywhere(Auth.Principal principal, HttpServletResponse httpResponse) {
    refreshCookies.clear(httpResponse);
    return new RevokedSessionsPayload(authService.revokePlayerSessions(principal.player().id()));
}
```

Helpers in the controller:

- `presentedToken`: `refreshCookies.read(request)` if present; else, when `legacyBodyTokenEnabled` and
  `body != null && body.refreshToken()` is non-blank, that; else throw `Auth.AuthenticationException("Invalid refresh token")`.
- `respond(issued, request, response)`: sets `Cache-Control: no-store`; if `issued.refreshSecret() != null`
  calls `refreshCookies.write(...)`; returns `SessionPayload(accessToken, expiresIn, refreshToken, player)`
  where `refreshToken` is `issued.refreshSecret()` **only when** `!refreshCookies.cookieTransport(request)
  && legacyBodyTokenEnabled`, otherwise `null`. Annotate the record component with
  `@JsonInclude(JsonInclude.Include.NON_NULL)` so cookie clients never see the field.

Contracts:

```java
/** Internal result of login/refresh: refreshSecret is null when a grace-window renewal issued none. */
record IssuedSession(String accessToken, long expiresIn, String refreshSecret, PlayerPayload player) {}

/** Transition only: pre-cookie clients send the token in the body. */
public record LegacyRefreshRequest(String refreshToken) {}

public record SessionPayload(String accessToken, long expiresIn,
                             @JsonInclude(JsonInclude.Include.NON_NULL) String refreshToken,
                             PlayerPayload player) {}
```

`RefreshRequest` (with `@NotBlank`) is replaced by `LegacyRefreshRequest` (body optional).

`AuthService` changes:

- `loginOrSignupWithGoogle` and `issueSessionTokens` return `IssuedSession`. `issueSessionTokens` gains a
  `RefreshToken parent` parameter (nullable): after saving the new row it sets
  `parent.replacedById = new.id` via a repository `UPDATE` (`linkSuccessor(parentId, successorId)`).
- `refreshSession(String presentedToken)` implements section 4.4 exactly:

  ```java
  @Transactional(noRollbackFor = Auth.AuthenticationException.class)
  public IssuedSession refreshSession(String presentedToken) {
      OffsetDateTime now = OffsetDateTime.now(clock);
      RefreshToken row = refreshTokenRepository.findByTokenHash(tokens.hashRefreshToken(presentedToken))
              .orElseThrow(() -> new Auth.AuthenticationException(INVALID_REFRESH_TOKEN));
      AuthSession session = liveSession(row.getSessionId(), now);   // revoked / idle / ceiling → revoke + 401
      Player player = allowedPlayer(session);                       // banned → 403 ACCOUNT_SUSPENDED

      if (row.getUsedAt() == null) {
          if (row.getExpiresAt().isBefore(now)) throw new Auth.AuthenticationException(INVALID_REFRESH_TOKEN);
          if (refreshTokenRepository.spend(row.getId(), now) == 1) {
              authSessionRepository.touch(session.getId(), now);
              return issueSessionTokens(player, session.getId(), row, now);
          }
          row = refreshTokenRepository.findById(row.getId()).orElseThrow();   // lost the race: re-read used_at
      }
      if (!now.isAfter(row.getUsedAt().plus(settings.getReplayGrace()))) {
          return accessOnly(player, session.getId());                         // rule 4: no Set-Cookie
      }
      Optional<RefreshToken> successor = Optional.ofNullable(row.getReplacedById())
              .flatMap(refreshTokenRepository::findById)
              .filter(next -> next.getUsedAt() == null && next.getExpiresAt().isAfter(now));
      if (successor.isPresent() && refreshTokenRepository.spend(successor.get().getId(), now) == 1) {
          authSessionRepository.touch(session.getId(), now);
          Auth.LOG.info("Refresh response lost for session {}; recovered", session.getId());
          return issueSessionTokens(player, session.getId(), successor.get(), now); // rule 5
      }
      authSessionRepository.revoke(session.getId(), now);                     // rule 6
      Auth.LOG.warn("Refresh token replayed {} after it was spent; session {} revoked",
              settings.getReplayGrace(), session.getId());
      throw new Auth.AuthenticationException(INVALID_REFRESH_TOKEN);
  }
  ```

  Important: the revocation `UPDATE` must commit even though the method throws a 401, hence
  `noRollbackFor = Auth.AuthenticationException.class` (today's code has the same latent issue: a
  `ResponseStatusException` is a `RuntimeException` and rolls the revocation back). Apply the same
  `noRollbackFor` to every auth method that revokes then throws. The banned case throws a
  `ResponseStatusException(FORBIDDEN, ACCOUNT_SUSPENDED)`; add it to `noRollbackFor` too (or revoke in a
  separate statement before throwing and keep the annotation list explicit).
- `liveSession(sessionId, now)`: `findByIdAndRevokedAtIsNull` else 401 `SESSION_NOT_ACTIVE`; if
  `lastUsedAt + refreshTtl < now` → revoke, log `INFO` "Session {} expired after 30 days without use",
  401; if `sessionMaxLifetime` present and `createdAt + ceiling < now` → revoke, 401 (existing behaviour,
  now optional).
- `accessOnly(player, sessionId)`: `new IssuedSession(tokens.signAccessToken(...), expiresIn, null, toPayload(player))`.
- `renewAccessToken` (service endpoint for mic-sessions agents): apply the same idle rule and the optional
  ceiling via `liveSession`-like checks (read-only: no revoke needed, just 401), so an expired sign-in
  stops agents acting for it too. Do **not** touch `last_used_at` there: agents are not player activity.
- `revokeSession(presentedToken)`: unchanged logic.
- New scheduled job, in the same nightly cron as the purge (one method, two statements):

  ```java
  @Transactional
  @Scheduled(cron = "${app.auth.refresh-token-purge-cron}")
  public void purgeExpiredAuthState() {
      OffsetDateTime now = OffsetDateTime.now(clock);
      int idle = authSessionRepository.revokeIdle(now.minus(settings.getRefreshTokenTtl()), now);
      int purged = refreshTokenRepository.purgeExpired(now);
      if (idle > 0 || purged > 0) Auth.LOG.info("Revoked {} idle sessions, purged {} expired refresh tokens", idle, purged);
  }
  ```

  This keeps the admin "sign-ins" count (`revoked_at IS NULL`) truthful: idle sign-ins stop being listed.

Entity and repositories:

- `RefreshToken`: add `@Column(name = "replaced_by_id") private UUID replacedById;` (nullable, updatable).
- `RefreshTokenRepository`: add
  `@Modifying(clearAutomatically = true, flushAutomatically = true) @Query("update RefreshToken t set t.replacedById = :successor where t.id = :id") int linkSuccessor(...)`.
- `AuthSessionRepository`: add
  `@Modifying(...) @Query("update AuthSession s set s.revokedAt = :now where s.revokedAt is null and s.lastUsedAt < :cutoff") int revokeIdle(@Param("cutoff") OffsetDateTime cutoff, @Param("now") OffsetDateTime now);`
- Update the class and method Javadoc to describe the 30-day sliding window, the cookie transport, the
  grace and recovery rules.

### 5.4 Database migration

New file `mic-mooi/src/main/resources/db/changelog/changes/034-refresh-token-rotation-chain.yaml`, included
at the end of `db.changelog-master.yaml`:

```yaml
databaseChangeLog:
  - changeSet:
      id: 034-refresh-token-rotation-chain
      author: mooi
      changes:
        - addColumn:
            tableName: refresh_tokens
            columns:
              - column:
                  name: replaced_by_id
                  type: uuid
                  remarks: The token this one was rotated into; lets a lost refresh response be recovered
        - addForeignKeyConstraint:
            constraintName: fk_refresh_tokens_replaced_by
            baseTableName: refresh_tokens
            baseColumnNames: replaced_by_id
            referencedTableName: refresh_tokens
            referencedColumnNames: id
            onDelete: SET NULL
        - sql:
            comment: Nightly idle-session revocation scans live sessions by last use
            sql: CREATE INDEX idx_auth_sessions_live_last_used ON auth_sessions (last_used_at) WHERE revoked_at IS NULL
      rollback:
        - sql:
            sql: DROP INDEX IF EXISTS idx_auth_sessions_live_last_used
        - dropForeignKeyConstraint:
            baseTableName: refresh_tokens
            constraintName: fk_refresh_tokens_replaced_by
        - dropColumn:
            tableName: refresh_tokens
            columnName: replaced_by_id
```

`ON DELETE SET NULL` matters: with the TTL shortened from 365 to 30 days, a successor can expire (and be
purged) before its parent issued under the old TTL.

### 5.5 `shared/Web.java`

Add `.allowCredentials(true)` to the CORS mapping (origins are an explicit list, so this is allowed). Only
relevant for local setups where the SPA dev server talks to mic-mooi on another port; same-origin
deployments are unaffected. Ensure `X-Mooi-Auth` is allowed (`allowedHeaders("*")` already covers it).

## 6. SPA changes (`spa-mooi`)

Follow the existing layout: one type per file in `types/`, libs in `lib/`, hooks in `hooks/`.

### 6.1 API — `features/auth/api/authApi.ts`

- Every auth call: `credentials: 'include'`, headers `{ 'Content-Type': 'application/json', 'X-Mooi-Auth': 'cookie' }`.
- `loginWithGoogle(idToken)`: unchanged signature; response type no longer has `refreshToken`.
- `refreshSession(legacyRefreshToken?: string)`: body `JSON.stringify(legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {})`.
- `logout()`: no argument (cookie), body `{}`.
- `logoutEverywhere(accessToken)`: unchanged plus `credentials: 'include'` (so the cookie is cleared).
- `AuthRequestError` stays; network failures (`fetch` rejects) are left as `TypeError` and classified by the provider.

### 6.2 Types

- `types/SessionResponse.ts`: `{ accessToken: string; expiresIn: number; player: AuthPlayer }`.
- `types/AuthSession.ts`: `{ accessToken: string; expiresAt: number }` (memory only).
- New `types/AuthBroadcast.ts`: `type AuthBroadcast = { type: 'token'; session: AuthSession } | { type: 'signed-out' }`.
- `lib/toAuthSession.ts`: drop `refreshToken`.

### 6.3 Errors — new `features/auth/lib/authErrors.ts`

```ts
/** The sign-in is over (expired, revoked, replayed): the only failure that signs the player out. */
export class SessionExpiredError extends Error {}
/** The account is banned: signs out and the login page explains why. */
export class AccountSuspendedError extends Error {}
/** Renewal could not reach a verdict (offline, 5xx, timeout): the sign-in is kept and retried. */
export class AuthUnavailableError extends Error {}
```

### 6.4 Store — `stores/authStore.ts`, `stores/types/AuthState.ts`

```ts
export interface AuthState {
  player: AuthPlayer | null;
  /** Set when sign-out was caused by a suspension, read once by the login page. */
  suspended: boolean;
  signIn: (player: AuthPlayer) => void;
  setPlayer: (player: AuthPlayer) => void;
  clear: (options?: { suspended?: boolean }) => void;
}
```

`persist` options: `{ name: \`${env.storagePrefix}:auth\`, version: 3, partialize: ({ player }) => ({ player }), migrate }`
where `migrate(persisted, version)` for `version < 3` calls `setLegacyRefreshToken(persisted.session?.refreshToken)`
(exported by the token provider) and returns `{ player: persisted.player ?? null }`.
`suspended` is not persisted.

### 6.5 Token provider — `features/auth/lib/accessTokenProvider.ts` (rewrite, same public API)

Public API kept: `getAccessToken(force?: boolean): Promise<string | null>`. New exports:
`setAccessSession(session)`, `dropAccessSession()`, `setLegacyRefreshToken(token)`, `renewIfDue()`,
`accessSessionExpiresAt()`.

Behaviour:

```ts
const RENEW_AHEAD_MS = 60_000;
const LOCK_NAME = `${env.storagePrefix}:auth-refresh`;

let current: AuthSession | null = null;            // memory only
let inFlight: Promise<string | null> | null = null; // per-tab single flight
let legacyRefreshToken: string | null = null;

const fresh = (session: AuthSession | null) => session !== null && Date.now() < session.expiresAt - RENEW_AHEAD_MS;

const withRefreshLock = <T>(work: () => Promise<T>): Promise<T> =>
  navigator.locks ? navigator.locks.request(LOCK_NAME, work) : work();

const renew = (force: boolean): Promise<string | null> =>
  withRefreshLock(async () => {
    // Another tab may have renewed while this one waited for the lock.
    if (!force && fresh(current)) return current!.accessToken;
    const legacy = legacyRefreshToken;
    legacyRefreshToken = null;
    let response: SessionResponse;
    try {
      response = await refreshSession(legacy ?? undefined);
    } catch (failure) {
      if (failure instanceof AuthRequestError && failure.status === 401) throw new SessionExpiredError();
      if (failure instanceof AuthRequestError && failure.status === 403) throw new AccountSuspendedError();
      if (legacy) legacyRefreshToken = legacy;       // keep the migration for the next attempt
      throw new AuthUnavailableError();
    }
    adopt(toAuthSession(response), response.player); // memory + store player + broadcast
    return response.accessToken;
  });

export const getAccessToken = async (force = false): Promise<string | null> => {
  if (!useAuthStore.getState().player) return null;   // signed out
  if (!force && fresh(current)) return current!.accessToken;
  inFlight ??= renew(force).catch((failure) => {
    if (failure instanceof SessionExpiredError) endSession();
    if (failure instanceof AccountSuspendedError) endSession({ suspended: true });
    throw failure;
  }).finally(() => { inFlight = null; });
  try {
    return await inFlight;
  } catch (failure) {
    if (failure instanceof SessionExpiredError || failure instanceof AccountSuspendedError) return null;
    throw failure;                                     // AuthUnavailableError: caller treats it as a network failure
  }
};
```

- `adopt(session, player)`: sets `current`, calls `useAuthStore.getState().setPlayer(player)` (keeps the
  profile fresh), posts `{ type: 'token', session }` on the channel.
- `endSession(options)`: `current = null`, `useAuthStore.getState().clear(options)`, posts `{ type: 'signed-out' }`.
- A forced renewal (`force = true`, after a 401 from an API) skips the "fresh" shortcut inside the lock
  only if the token it would return is the same one that just got the 401; compare with the token the
  caller used (pass it as `getAccessToken(true, rejectedToken)` internally) so a tab does not burn a
  rotation when another tab already renewed.

### 6.6 Cross-tab channel — new `features/auth/lib/authChannel.ts`

```ts
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`${env.storagePrefix}:auth`);
export const postAuth = (message: AuthBroadcast) => channel?.postMessage(message);
export const onAuth = (listener: (message: AuthBroadcast) => void) => { /* add/remove 'message' listener, return unsubscribe */ };
```

The provider subscribes once at module load: `token` → `current = message.session` (if it expires later
than the current one); `signed-out` → `current = null` (the store is already cleared via `storage` events).
`useAuthStorageSync` stays: it propagates sign-in/sign-out of the persisted `player` between tabs; when the
rehydrated `player` becomes `null`, call `dropAccessSession()`.

### 6.7 Fetch helpers

- `features/auth/lib/authenticatedFetch.ts`: extract the common logic into an exported
  `fetchWithAccessToken(url: string, init?: RequestInit): Promise<Response>`:
  - `token = await getAccessToken()`; `null` → throw `SessionExpiredError` (the store is already cleared
    by the provider; **do not** call `clear()` here).
  - Response not 401 → return it.
  - 401 → `retry = await getAccessToken(true)`; `null` → throw `SessionExpiredError`; refetch; a second 401
    means the session really is gone server side → the provider already handled it, throw `SessionExpiredError`.
  - `AuthUnavailableError` propagates untouched.
  - `authenticatedFetch(path, init) = fetchWithAccessToken(\`${env.apiBaseUrl}${path}\`, init)`.
- `features/sessions/lib/sessionsFetch.ts`: `fetchWithAccessToken(\`${env.sessionsBaseUrl}${path}\`, init)`;
  remove its own `clear()` calls.
- `features/sessions/lib/openEventStream.ts`: no change; a `null` token or `AuthUnavailableError` already
  lands in its `catch` → `scheduleReconnect()`. When the player is signed out, `ProtectedRoute` unmounts
  the shell and closes streams.

### 6.8 Hooks and routing

- `hooks/useSessionSync.ts`: keep the triggers (mount, focus, visible); call `fetchCurrentPlayer()`; on
  success `setPlayer`; on failure do **nothing** (expiry was already handled by the provider; transient
  failures must not sign out).
- New `hooks/useTokenRenewal.ts` (section 4.5 "Proactive renewal"): schedules `renewIfDue()` at
  `accessSessionExpiresAt() - 60 s` while visible; listens to `visibilitychange`, `online`, `focus`,
  `pageshow`; on `AuthUnavailableError` retries with backoff 2 s, 4 s, … capped at 60 s; reschedules after
  every successful renewal (subscribe to the channel's `token` messages and to local adoption).
- `shared/router/ProtectedRoute.tsx`: requires `player` only; mounts `useSessionSync()` and `useTokenRenewal()`.
- `shared/router/GuestRoute.tsx`: redirects when `player` is set.
- `pages/LoginPage.tsx`: on success `setAccessSession(toAuthSession(response))` + `signIn(response.player)`;
  show "This account is suspended. Contact an administrator." when `useAuthStore` `suspended` is true (and
  reset it), in addition to the existing 403 handling of the sign-in call itself.
- `features/auth/lib/signOut.ts`:
  - `signOut()`: `dropAccessSession()`, `clear()`, broadcast, then `await logout().catch(() => {})`.
  - `signOutEverywhere()`: get the token first (`getAccessToken().catch(() => null)`), clear locally,
    broadcast, then `logoutEverywhere(token)` if a token was obtained, else `logout()` (at least end this
    device server side).

### 6.9 Untouched consumers

The 14 modules calling `authenticatedFetch` / `getAccessToken` (projects, agents, GitHub, admin, backups,
production, recipes, todos, development, platform, dictation, sessions) keep their imports and signatures.
mic-sessions (`shared/auth.py`, `shared/mooi.py`) and mic-speech need no change: they only see bearer
access tokens, whose format is unchanged.

## 7. Context and docs

- `AGENTS.md`, section *Identity and projects*: add "Signed-in devices stay signed in while used: a 30-day
  sliding refresh token in an `HttpOnly` cookie is renewed on every use; 30 days without use requires
  signing in again." (Source-of-truth rule: the vision must state it.)
- `mic-mooi/.env.example`: section 5.1.
- No README change required beyond, optionally, one line in the security list.

## 8. Implementation order

1. Migration `034` + entity/repository changes.
2. `Auth.Settings` (optional ceiling, cookie settings, origins) + `Auth.RefreshCookies`.
3. `AuthFeature` endpoints, `IssuedSession`, rotation rules 1–7, `noRollbackFor`, idle checks in refresh
   and `renewAccessToken`, nightly idle revocation; `Web.java` credentials; `application.yml`, `.env.example`.
4. SPA: errors, types, store v3 + migration, provider rewrite, channel, fetch helpers, hooks, routes,
   login page, sign-out.
5. `AGENTS.md` Context line; add a to-do "Remove the legacy body refresh token transport (after <release date + 30 days>)".

The backend is backward compatible on its own (old SPA keeps working through the legacy contract), so
backend and SPA can ship in the same release or backend first.

## 9. Verification (per the repository's testing rules: no test files)

Static checks to run and report:

- `mic-mooi`: `./mvnw -q -DskipTests package` (compiles, Liquibase YAML is packaged; Hibernate
  `ddl-auto: validate` will check the new column at boot).
- `spa-mooi`: `bun run typecheck` and `bun run build`.
- `mic-sessions` untouched; no check needed beyond `git diff` review.

Manual scenarios for the user to run in a preview or production (the agent does not deploy by default):

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Sign in, use Mooi, reload, close and reopen the browser | Still signed in; `localStorage` holds only `player`; DevTools shows `mooi_refresh` `HttpOnly`, path `/api/mooi/auth` |
| 2 | Already signed-in browser before the upgrade, then upgrade | Still signed in; first `/auth/refresh` sends the legacy body once, cookie appears, `session` gone from storage |
| 3 | Go offline (DevTools) for > 15 min, come back | No sign-out; requests fail while offline, recover when online |
| 4 | Restart mic-mooi while the app is open | Brief errors, no sign-out |
| 5 | Five tabs open, wait for expiry | One `/auth/refresh` per expiry across all tabs, no sign-out |
| 6 | Block the response of one `/auth/refresh` (DevTools request blocking after it reaches the server is hard; simulate by replaying the previous cookie value after 30 s via curl with the same cookie) | Server logs "recovered"; still signed in |
| 7 | Replay a token whose successor was used | Session revoked, all tabs go to login |
| 8 | Sign out / sign out everywhere / admin sign-out / ban | Login screen on every device (ban shows the suspension message); cookie cleared on the acting device |
| 9 | Set `last_used_at` of a session 31 days back in the DB, then use that browser | Login screen; nightly job revokes such sessions |
| 10 | Mooi preview of Mooi (mock sign-in) | Sign-in works; its cookie path is `/preview/<id>/api/mooi/auth`; production session unaffected |
| 11 | Agent session running while the access token expires | Agent keeps working (mic-sessions renewal unchanged) |

## 10. Risks and residual issues

- **Same-origin previews**: apps deployed in previews run on Mooi's origin. Their JavaScript can still call
  `/api/mooi/auth/refresh` with the player's cookie and read an access token while the page is open (no
  header or cookie flag can stop same-origin code). This plan removes the worst part, stealing the
  long-lived refresh token itself, but full isolation needs previews on a separate origin (for example a
  wildcard preview domain) or a sandboxed iframe. Out of scope here; worth a dedicated to-do.
- **Recovery rule trades immediate replay detection for no false sign-outs** (section 4.4, rule 5).
  Set `REPLAY_GRACE_SECONDS` and keep rule 5 as designed; if stricter behaviour is ever needed, rule 5 can
  be disabled by a flag without other changes.
- **Safari ITP** caps script-written storage, not server-set `HttpOnly` first-party cookies, so the 30-day
  cookie survives; the persisted `player` may be evicted after 7 days without visits on Safari, in which
  case the login page shows, so the plan adds one fallback: `GuestRoute` / `LoginPage` try one silent
  `/auth/refresh` on mount when no `player` is stored; success signs the player straight in (no Google
  prompt), 401 shows the login page as today.
- **Ledger size**: one row per renewal (≈ 96/day for an all-day active session), kept 30 days instead of
  365, so the table shrinks compared with today.

## 11. Decisions to confirm

1. **No absolute ceiling** (`SESSION_MAX_LIFETIME` blank by default): an active player is never asked to
   sign in again. Alternative: keep a long ceiling (for example 365 days).
2. **Inactivity window 30 days** (`REFRESH_TOKEN_EXPIRES_IN=30d`), access token stays 15 minutes.
3. **Lost-response recovery** (rule 5) enabled.
4. **Legacy body transport** kept for 30 days after release, then removed.
