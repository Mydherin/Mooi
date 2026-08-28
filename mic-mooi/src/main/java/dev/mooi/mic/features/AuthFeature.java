package dev.mooi.mic.features;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import dev.mooi.mic.shared.Auth;
import dev.mooi.mic.shared.Auth.GoogleIdentityProvider.GoogleIdentity;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Converter;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;

/**
 * Feature: authentication sessions.
 *
 * <p>Sign up and login share one endpoint because the client cannot know which one it is asking
 * for: only {@code google_id} tells them apart, and only the server has seen it before. Everything
 * downstream of that — session opening, refresh token rotation, replay detection and revocation —
 * lives here too.
 *
 * <p>Self-contained by architecture: API, application logic, persistence and contracts live in this
 * single file and may only import transversal aspects from {@code shared}. This feature also adapts
 * the {@link Auth.SessionGuard} port, which is how the auth aspect reaches these tables without
 * importing a feature.
 */
@RestController
@RequiredArgsConstructor
public class AuthFeature {

    private final AuthService authService;

    @PostMapping("/auth/google")
    public SessionPayload loginOrSignup(@Valid @RequestBody GoogleLoginRequest request,
                                        HttpServletRequest httpRequest) {
        return authService.loginOrSignupWithGoogle(request.idToken(), Auth.readUserAgent(httpRequest),
                Auth.readIpAddress(httpRequest));
    }

    @PostMapping("/auth/refresh")
    public SessionPayload refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refreshSession(request.refreshToken());
    }

    /**
     * Always answers 204, even for a token nobody knows: logout must succeed for a client holding a
     * retired token, and a different answer would be an oracle for guessing tokens.
     */
    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshRequest request) {
        authService.revokeSession(request.refreshToken());
    }

    @PostMapping("/auth/logout-all")
    @Auth.Authenticated
    public RevokedSessionsPayload logoutEverywhere(Auth.Principal principal) {
        return new RevokedSessionsPayload(authService.revokePlayerSessions(principal.player().id()));
    }

    /** Doubles as the session check: reaching the handler at all means the session is still alive. */
    @GetMapping("/me")
    @Auth.Authenticated
    public CurrentPlayerPayload me(Auth.Principal principal) {
        return new CurrentPlayerPayload(AuthService.toPayload(principal.player()));
    }

    @GetMapping("/admin/ping")
    @Auth.RequireRole(Auth.Role.ADMIN)
    public StatusPayload adminPing() {
        return new StatusPayload("ok");
    }

    // --- application ---

    @Service
    @RequiredArgsConstructor
    public static class AuthService implements Auth.SessionGuard {

        private static final String INVALID_REFRESH_TOKEN = "Invalid refresh token";
        private static final String SESSION_NOT_ACTIVE = "Session is no longer active";

        private final PlayerRepository playerRepository;
        private final AuthSessionRepository authSessionRepository;
        private final RefreshTokenRepository refreshTokenRepository;
        private final Auth.Settings settings;
        private final Auth.Tokens tokens;
        private final Auth.GoogleIdentityProvider googleIdentityProvider;
        private final Clock clock;

        /**
         * The {@link Auth.SessionGuard} adaptation: two indexed primary key lookups, and the subject
         * binding check that makes a token minted for another player forgery rather than a mismatch.
         */
        @Override
        @Transactional(readOnly = true)
        public Optional<Auth.AuthenticatedPlayer> resolve(UUID sessionId, UUID playerId) {
            Optional<AuthSession> session = authSessionRepository.findByIdAndRevokedAtIsNull(sessionId);
            if (session.isEmpty()) {
                return Optional.empty();
            }
            if (!session.get().getPlayerId().equals(playerId)) {
                Auth.LOG.warn("Access token subject {} does not match session {}", playerId, sessionId);
                return Optional.empty();
            }
            return playerRepository.findById(playerId).map(AuthService::toAuthenticatedPlayer);
        }

        /**
         * One entry point for both flows. The response is identical either way — the SPA cannot tell
         * them apart and does not need to; the branch only decides what is written and what is logged.
         */
        @Transactional
        public SessionPayload loginOrSignupWithGoogle(String idToken, String userAgent, String ipAddress) {
            GoogleIdentity identity = googleIdentityProvider.verify(idToken);
            OffsetDateTime now = OffsetDateTime.now(clock);

            Optional<Player> existing = playerRepository.findByGoogleId(identity.googleId());
            boolean isNewPlayer = existing.isEmpty();
            Player player = existing
                    .map(found -> refreshProfile(found, identity))
                    .orElseGet(() -> createPlayer(identity, now));

            // A new session row every time, never a reused one: that is what makes each device
            // separately revocable, and what stops signing in on a new machine from silently
            // extending an old login.
            AuthSession session = new AuthSession();
            session.setPlayerId(player.getId());
            session.setCreatedAt(now);
            session.setLastUsedAt(now);
            session.setUserAgent(userAgent);
            session.setIpAddress(ipAddress);
            AuthSession openedSession = authSessionRepository.save(session);

            SessionPayload payload = issueSessionTokens(player, openedSession.getId(), now);
            Auth.LOG.info(isNewPlayer ? "Player signed up {}" : "Player signed in {}", player.getId());
            return payload;
        }

        /**
         * Rotation and replay detection.
         *
         * <p>Every renewal spends the presented token and issues a new one. Presenting an already
         * spent token is judged by <em>when</em> it was spent: inside the grace window two tabs simply
         * raced, so the session is left alone; after it, a copy of a retired token is the only
         * explanation left and the whole session goes.
         */
        @Transactional
        public SessionPayload refreshSession(String presentedToken) {
            OffsetDateTime now = OffsetDateTime.now(clock);
            RefreshToken row = refreshTokenRepository.findByTokenHash(tokens.hashRefreshToken(presentedToken))
                    .orElseThrow(() -> new Auth.AuthenticationException(INVALID_REFRESH_TOKEN));

            if (row.getUsedAt() != null) {
                if (now.isAfter(row.getUsedAt().plus(settings.getReplayGrace()))) {
                    authSessionRepository.revoke(row.getSessionId(), now);
                    Auth.LOG.warn("Refresh token replayed {} after it was spent; session {} revoked",
                            settings.getReplayGrace(), row.getSessionId());
                }
                throw new Auth.AuthenticationException(INVALID_REFRESH_TOKEN);
            }
            if (row.getExpiresAt().isBefore(now)) {
                throw new Auth.AuthenticationException(INVALID_REFRESH_TOKEN);
            }

            UUID playerId = authSessionRepository.findByIdAndRevokedAtIsNull(row.getSessionId())
                    .map(AuthSession::getPlayerId)
                    .orElseThrow(() -> new Auth.AuthenticationException(SESSION_NOT_ACTIVE));

            // The claim is one conditional statement, so Postgres serialises concurrent attempts and
            // exactly one of them wins. Losing it means another tab spent the token a moment ago,
            // which is the grace window's case: refuse, and leave the session alone.
            if (refreshTokenRepository.spend(row.getId(), now) == 0) {
                throw new Auth.AuthenticationException(INVALID_REFRESH_TOKEN);
            }
            authSessionRepository.touch(row.getSessionId(), now);

            Player player = playerRepository.findById(playerId)
                    .orElseThrow(() -> new Auth.AuthenticationException(SESSION_NOT_ACTIVE));
            return issueSessionTokens(player, row.getSessionId(), now);
        }

        /**
         * Revokes <em>the session</em> behind a refresh token, not the token: that voids every access
         * token ever minted under it. Silent when the token is unknown.
         */
        @Transactional
        public void revokeSession(String presentedToken) {
            refreshTokenRepository.findByTokenHash(tokens.hashRefreshToken(presentedToken))
                    .ifPresent(row -> {
                        if (authSessionRepository.revoke(row.getSessionId(), OffsetDateTime.now(clock)) > 0) {
                            Auth.LOG.info("Session {} revoked by logout", row.getSessionId());
                        }
                    });
        }

        /**
         * Revokes every session of a player, the caller's included — sparing it would leave alive the
         * session an attacker most likely holds.
         */
        @Transactional
        public int revokePlayerSessions(UUID playerId) {
            int revoked = authSessionRepository.revokeAllForPlayer(playerId, OffsetDateTime.now(clock));
            Auth.LOG.info("Revoked {} sessions of player {}", revoked, playerId);
            return revoked;
        }

        /**
         * Issues the token pair, shared by login and refresh. Rotation is unconditional: a refresh
         * token is minted here and nowhere else, and the client never keeps the one it presented.
         */
        private SessionPayload issueSessionTokens(Player player, UUID sessionId, OffsetDateTime now) {
            String refreshSecret = tokens.generateRefreshToken();
            RefreshToken refreshToken = new RefreshToken();
            refreshToken.setSessionId(sessionId);
            refreshToken.setTokenHash(tokens.hashRefreshToken(refreshSecret));
            refreshToken.setCreatedAt(now);
            refreshToken.setExpiresAt(now.plus(settings.getRefreshTokenTtl()));
            refreshTokenRepository.save(refreshToken);

            String accessToken = tokens.signAccessToken(player.getId(), player.getRole(), sessionId);
            // expiresIn is relative seconds, so a client with a skewed clock still renews in time.
            return new SessionPayload(accessToken, tokens.accessTokenExpiresInSeconds(), refreshSecret,
                    toPayload(player));
        }

        /** The role is decided here and only here: adding an address to ADMIN_EMAILS never promotes. */
        private Player createPlayer(GoogleIdentity identity, OffsetDateTime now) {
            Player player = new Player();
            player.setGoogleId(identity.googleId());
            player.setEmail(identity.email());
            player.setUsername(identity.username());
            player.setAvatarUrl(identity.avatarUrl());
            player.setRole(settings.resolvePlayerRole(identity.email()));
            player.setCreatedAt(now);
            return playerRepository.save(player);
        }

        /** Google owns the profile, we own the role: the UPDATE is skipped when nothing changed. */
        private Player refreshProfile(Player player, GoogleIdentity identity) {
            boolean unchanged = Objects.equals(player.getUsername(), identity.username())
                    && Objects.equals(player.getEmail(), identity.email())
                    && Objects.equals(player.getAvatarUrl(), identity.avatarUrl());
            if (unchanged) {
                return player;
            }
            player.setUsername(identity.username());
            player.setEmail(identity.email());
            player.setAvatarUrl(identity.avatarUrl());
            return playerRepository.save(player);
        }

        private static Auth.AuthenticatedPlayer toAuthenticatedPlayer(Player player) {
            return new Auth.AuthenticatedPlayer(player.getId(), player.getUsername(), player.getEmail(),
                    player.getAvatarUrl(), player.getRole(), player.getCreatedAt());
        }

        static PlayerPayload toPayload(Player player) {
            return new PlayerPayload(player.getId(), player.getUsername(), player.getEmail(),
                    player.getAvatarUrl(), player.getRole().wire(), player.getCreatedAt());
        }

        static PlayerPayload toPayload(Auth.AuthenticatedPlayer player) {
            return new PlayerPayload(player.id(), player.username(), player.email(), player.avatarUrl(),
                    player.role().wire(), player.createdAt());
        }
    }

    // --- persistence ---

    /** Keeps the closed set of roles on the wire exactly as the API and the SPA read it. */
    @Converter
    public static class RoleConverter implements AttributeConverter<Auth.Role, String> {

        @Override
        public String convertToDatabaseColumn(Auth.Role role) {
            return role == null ? null : role.wire();
        }

        @Override
        public Auth.Role convertToEntityAttribute(String value) {
            return value == null ? null : Auth.Role.fromWire(value);
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @Entity(name = "Player")
    @Table(name = "players")
    public static class Player {

        @Id
        @GeneratedValue
        @Column(name = "id", nullable = false, updatable = false)
        private UUID id;

        /** The only stable link to Google. Decides sign up vs. login, and never leaves the server. */
        @Column(name = "google_id", nullable = false, unique = true, updatable = false, length = 255)
        private String googleId;

        @Column(name = "email", nullable = false, unique = true, length = 255)
        private String email;

        @Column(name = "username", nullable = false, length = 64)
        private String username;

        @Column(name = "avatar_url", length = 512)
        private String avatarUrl;

        @Convert(converter = RoleConverter.class)
        @Column(name = "role", nullable = false, length = 16)
        private Auth.Role role;

        @Column(name = "created_at", nullable = false, updatable = false)
        private OffsetDateTime createdAt;
    }

    /** One sign-in — the unit revocation acts on. */
    @Getter
    @Setter
    @NoArgsConstructor
    @Entity(name = "AuthSession")
    @Table(name = "auth_sessions")
    public static class AuthSession {

        @Id
        @GeneratedValue
        @Column(name = "id", nullable = false, updatable = false)
        private UUID id;

        @Column(name = "player_id", nullable = false, updatable = false)
        private UUID playerId;

        @Column(name = "created_at", nullable = false, updatable = false)
        private OffsetDateTime createdAt;

        @Column(name = "last_used_at", nullable = false)
        private OffsetDateTime lastUsedAt;

        /** NULL means alive: the single fact every auth check reads. */
        @Column(name = "revoked_at")
        private OffsetDateTime revokedAt;

        @Column(name = "user_agent", length = 512)
        private String userAgent;

        @Column(name = "ip_address", length = 64)
        private String ipAddress;
    }

    /** Single-use renewal ticket. The secret itself exists only on the client. */
    @Getter
    @Setter
    @NoArgsConstructor
    @Entity(name = "RefreshToken")
    @Table(name = "refresh_tokens")
    public static class RefreshToken {

        @Id
        @GeneratedValue
        @Column(name = "id", nullable = false, updatable = false)
        private UUID id;

        @Column(name = "session_id", nullable = false, updatable = false)
        private UUID sessionId;

        @Column(name = "token_hash", nullable = false, unique = true, updatable = false, length = 64)
        private String tokenHash;

        @Column(name = "expires_at", nullable = false, updatable = false)
        private OffsetDateTime expiresAt;

        @Column(name = "created_at", nullable = false, updatable = false)
        private OffsetDateTime createdAt;

        /** NULL means unspent. Set once, atomically — the rotation and replay signal. */
        @Column(name = "used_at")
        private OffsetDateTime usedAt;
    }

    public interface PlayerRepository extends JpaRepository<Player, UUID> {

        Optional<Player> findByGoogleId(String googleId);
    }

    public interface AuthSessionRepository extends JpaRepository<AuthSession, UUID> {

        Optional<AuthSession> findByIdAndRevokedAtIsNull(UUID id);

        /** Guarded so a repeated logout keeps the original timestamp. */
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

        /**
         * The single conditional statement rotation depends on: Postgres serialises concurrent
         * attempts on the row, so exactly one of them still sees {@code used_at IS NULL}.
         */
        @Modifying(clearAutomatically = true, flushAutomatically = true)
        @Query("update RefreshToken t set t.usedAt = :now where t.id = :id and t.usedAt is null")
        int spend(@Param("id") UUID id, @Param("now") OffsetDateTime now);
    }

    // --- contracts ---

    public record GoogleLoginRequest(@NotBlank String idToken) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    /** {@code googleId} is deliberately absent: it never leaves the server. */
    public record PlayerPayload(UUID id, String username, String email, String avatarUrl, String role,
                                OffsetDateTime createdAt) {
    }

    public record SessionPayload(String accessToken, long expiresIn, String refreshToken, PlayerPayload player) {
    }

    public record CurrentPlayerPayload(PlayerPayload player) {
    }

    public record RevokedSessionsPayload(int revokedSessions) {
    }

    public record StatusPayload(String status) {
    }
}
