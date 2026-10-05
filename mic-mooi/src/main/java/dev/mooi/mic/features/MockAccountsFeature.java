package dev.mooi.mic.features;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import dev.mooi.mic.shared.Agents;
import dev.mooi.mic.shared.Auth;
import dev.mooi.mic.shared.Auth.GoogleIdentityProvider.GoogleIdentity;
import dev.mooi.mic.shared.Crypto;
import dev.mooi.mic.shared.Github;
import jakarta.persistence.EntityManager;

/**
 * Feature: accounts of the mocked development player (Mooi session previews only).
 *
 * <p>While Google sign-in is mocked ({@code AUTH_GOOGLE_MOCK_ENABLED=true}), every boot makes sure
 * the fixed player exists and links the GitHub, Claude and Codex accounts given by environment, so
 * a preview is usable at once, with no OAuth round trip. The bean does not exist otherwise: in
 * production nothing here is ever instantiated.
 *
 * <p>Only credentials that are independent from production belong here. GitHub App and Codex
 * (ChatGPT) refresh tokens rotate: a copy of a production one would be spent by whichever side
 * renews first and break the other. Hence a GitHub personal access token, a {@code claude
 * setup-token} token and the {@code auth.json} of a Codex login made for development. A rotated
 * Codex credential is kept across restarts: a linked row is replaced only when its environment
 * value changes, which a deterministic {@code credential_id} derived from that value detects.
 *
 * <p>Self-contained by architecture: plain SQL against the tables the owning features map, and only
 * transversal aspects from {@code shared}. Every account is best effort: a bad value is logged and
 * skipped, never a failed boot.
 */
@Component
@ConditionalOnProperty(name = "app.auth.google-mock.enabled", havingValue = "true")
public class MockAccountsFeature {

    private static final String CLAUDE_NAME = "Claude · development";
    private static final String CODEX_NAME = "Codex · development";

    private final EntityManager entityManager;
    private final TransactionTemplate transactions;
    private final Auth.Settings authSettings;
    private final Auth.GoogleIdentityProvider googleIdentityProvider;
    private final Github.OAuthClient githubClient;
    private final Crypto.SecretBox secretBox;
    private final String githubToken;
    private final String claudeToken;
    private final String codexAuthJson;

    MockAccountsFeature(EntityManager entityManager, TransactionTemplate transactions, Auth.Settings authSettings,
                        Auth.GoogleIdentityProvider googleIdentityProvider, Github.OAuthClient githubClient,
                        Crypto.SecretBox secretBox,
                        @Value("${app.auth.google-mock.github-token:}") String githubToken,
                        @Value("${app.auth.google-mock.claude-token:}") String claudeToken,
                        @Value("${app.auth.google-mock.codex-auth-json:}") String codexAuthJson) {
        this.entityManager = entityManager;
        this.transactions = transactions;
        this.authSettings = authSettings;
        this.googleIdentityProvider = googleIdentityProvider;
        this.githubClient = githubClient;
        this.secretBox = secretBox;
        this.githubToken = strip(githubToken);
        this.claudeToken = strip(claudeToken);
        this.codexAuthJson = strip(codexAuthJson);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void linkAccounts() {
        GoogleIdentity identity = googleIdentityProvider.mockIdentity().orElse(null);
        if (identity == null) {
            return;
        }
        UUID playerId = transactions.execute(status -> ensurePlayer(identity));
        if (!githubToken.isEmpty()) {
            attempt("GitHub", () -> linkGithub(playerId));
        }
        attempt("Claude", () -> syncAgent(playerId, "claude", Agents.Mode.SETUP_TOKEN, CLAUDE_NAME, claudeToken));
        if (codexAuthJson.isEmpty() || codexAuthJson.startsWith("{")) {
            attempt("Codex", () -> syncAgent(playerId, "codex", Agents.Mode.DEVICE_OAUTH, CODEX_NAME, codexAuthJson));
        } else {
            Auth.LOG.warn("Mock accounts: AUTH_GOOGLE_MOCK_CODEX_AUTH_JSON is not a Codex auth.json; skipped");
        }
    }

    // --- application ---

    /** Same identity and role rule as a first mocked sign-in, so signing in later just finds the row. */
    private UUID ensurePlayer(GoogleIdentity identity) {
        entityManager.createNativeQuery("""
                        INSERT INTO players (id, google_id, email, username, role, created_at)
                        VALUES (gen_random_uuid(), :googleId, :email, :username, :role, now())
                        ON CONFLICT (google_id) DO NOTHING""")
                .setParameter("googleId", identity.googleId())
                .setParameter("email", identity.email())
                .setParameter("username", identity.username())
                .setParameter("role", authSettings.resolvePlayerRole(identity.email()).wire())
                .executeUpdate();
        return (UUID) entityManager.createNativeQuery("SELECT id FROM players WHERE google_id = :googleId", UUID.class)
                .setParameter("googleId", identity.googleId())
                .getSingleResult();
    }

    /** A personal access token never expires on its own and has nothing to refresh: overwritten every boot. */
    private void linkGithub(UUID playerId) {
        Github.Viewer viewer = githubClient.fetchViewer(githubToken);
        transactions.executeWithoutResult(status -> entityManager.createNativeQuery("""
                        INSERT INTO github_connections (id, player_id, github_user_id, login, name, avatar_url,
                            profile_url, access_token, connected_at, created_at, updated_at)
                        VALUES (gen_random_uuid(), :playerId, :githubUserId, :login, CAST(:name AS varchar),
                            CAST(:avatarUrl AS varchar), CAST(:profileUrl AS varchar), :token, now(), now(), now())
                        ON CONFLICT (player_id) DO UPDATE SET github_user_id = EXCLUDED.github_user_id,
                            login = EXCLUDED.login, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url,
                            profile_url = EXCLUDED.profile_url, scope = NULL, access_token = EXCLUDED.access_token,
                            access_token_expires_at = NULL, refresh_token = NULL, refresh_token_expires_at = NULL,
                            updated_at = now()""")
                .setParameter("playerId", playerId)
                .setParameter("githubUserId", viewer.id())
                .setParameter("login", viewer.login())
                .setParameter("name", viewer.name())
                .setParameter("avatarUrl", viewer.avatarUrl())
                .setParameter("profileUrl", viewer.profileUrl())
                .setParameter("token", secretBox.encrypt(githubToken))
                .executeUpdate());
        Auth.LOG.info("Mock accounts: GitHub account {} linked", viewer.login());
    }

    /**
     * Kept as is while the environment value is unchanged (a Codex credential rotated since then is
     * the live one); replaced, with the previous development link, once it changes; unlinked once it
     * is removed. Accounts the player links by hand are never touched.
     */
    private void syncAgent(UUID playerId, String provider, Agents.Mode mode, String name, String token) {
        if (token.isEmpty()) {
            int unlinked = transactions.execute(status -> deleteAgent(playerId, provider, name));
            if (unlinked > 0) {
                Auth.LOG.info("Mock accounts: {} account unlinked", provider);
            }
            return;
        }
        UUID credentialId = UUID.nameUUIDFromBytes((provider + ":" + playerId + ":" + sha256(token))
                .getBytes(StandardCharsets.UTF_8));
        boolean linked = Boolean.TRUE.equals(transactions.execute(status -> {
            Number existing = (Number) entityManager.createNativeQuery(
                            "SELECT count(*) FROM agent_connections WHERE player_id = :playerId AND credential_id = :credentialId")
                    .setParameter("playerId", playerId)
                    .setParameter("credentialId", credentialId)
                    .getSingleResult();
            if (existing.longValue() > 0) {
                return false;
            }
            deleteAgent(playerId, provider, name);
            entityManager.createNativeQuery("""
                            INSERT INTO agent_connections (id, player_id, provider, mode, name, credential_id,
                                access_token, stale, connected_at, created_at, updated_at)
                            VALUES (gen_random_uuid(), :playerId, :provider, :mode, :name, :credentialId,
                                :token, false, now(), now(), now())""")
                    .setParameter("playerId", playerId)
                    .setParameter("provider", provider)
                    .setParameter("mode", mode.wire())
                    .setParameter("name", name)
                    .setParameter("credentialId", credentialId)
                    .setParameter("token", secretBox.encrypt(token))
                    .executeUpdate();
            return true;
        }));
        Auth.LOG.info(linked ? "Mock accounts: {} account linked" : "Mock accounts: {} account already linked", provider);
    }

    private int deleteAgent(UUID playerId, String provider, String name) {
        return entityManager.createNativeQuery(
                        "DELETE FROM agent_connections WHERE player_id = :playerId AND provider = :provider AND name = :name")
                .setParameter("playerId", playerId)
                .setParameter("provider", provider)
                .setParameter("name", name)
                .executeUpdate();
    }

    private static void attempt(String account, Runnable link) {
        try {
            link.run();
        } catch (RuntimeException exception) {
            Auth.LOG.warn("Mock accounts: unable to link the {} account: {}", account, exception.getMessage());
        }
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private static String strip(String value) {
        return value == null ? "" : value.strip();
    }
}
