package dev.mooi.mic.shared;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.text.ParseException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import lombok.Getter;

/**
 * Transversal aspect: agent-provider OAuth2 and credential mechanics.
 *
 * <p>Only the protocol lives here: the provider registry and (from here on) PKCE state signing and
 * the OAuth client, mapping every failure to the status the SPA should act on. What is stored, for
 * whom, and how a credential is handed to another service belongs to
 * {@code AgentConnectionFeature}, which owns the table — this aspect never imports it and holds no
 * state of its own.
 *
 * <p>"Agent provider" means a coding-agent vendor a player brings their own subscription to (Claude
 * first). Every mode this aspect knows about yields the same shape of credential: a long-lived
 * personal access token, whether it arrived through OAuth2 or was pasted from
 * {@code claude setup-token}. Anthropic API keys are explicitly out of scope: the product is "bring
 * your Claude subscription", not "bring your API billing".
 *
 * <p>Self-contained by architecture, which is why the TTL grammar is parsed here rather than
 * borrowed from {@link Github}: transversal aspects do not depend on each other, so a small,
 * deliberate duplication is the correct trade.
 */
@Configuration
public class Agents {

    /** Log scope shared by this aspect and the feature that owns the connections. */
    public static final Logger LOG = LoggerFactory.getLogger("agents");

    private static final Pattern DURATION_PATTERN = Pattern.compile("^(\\d+)([smhd])$");

    // --- contracts ---

    /**
     * How a credential was obtained. Both modes yield the same kind of token — a Claude PAT — so
     * nothing downstream branches on this beyond recording it: it exists purely so a player can see,
     * and repair, how their link was made.
     */
    public enum Mode {

        OAUTH("oauth"),
        SETUP_TOKEN("setup_token"),
        DEVICE_OAUTH("device_oauth");

        private final String wire;

        Mode(String wire) {
            this.wire = wire;
        }

        public String wire() {
            return wire;
        }

        public static Mode fromWire(String value) {
            return Arrays.stream(values())
                    .filter(mode -> mode.wire.equals(value))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown agent connection mode: " + value));
        }
    }

    /**
     * One agent provider this application knows how to link. A single {@code envVar} is enough
     * because every mode of a given provider yields the same kind of token — whichever variable that
     * provider's runtime expects on its process environment.
     */
    public record Provider(String id, String label, boolean oauthEnabled, String clientId, String authorizeUri,
                           String tokenUri, String scopes, String redirectUri, String envVar) {
    }

    // --- errors ---

    /**
     * Every way linking an agent provider can fail, mapped once to the status the SPA should act on
     * and to a message that says what to do about it. Mirrors {@link Github.GithubException} in
     * shape and in the same reasoning: the vendor's own wording never reaches the client.
     */
    public static class AgentsException extends ResponseStatusException {

        private AgentsException(HttpStatus status, String reason) {
            super(status, reason);
        }

        /** No provider registered under that id. */
        public static AgentsException unknownProvider() {
            return new AgentsException(HttpStatus.NOT_FOUND, "Unknown agent provider");
        }

        /** OAuth2 is not usable for this provider yet: turned off, or no client id configured. */
        public static AgentsException oauthNotConfigured() {
            return new AgentsException(HttpStatus.CONFLICT, "OAuth is not configured for this provider");
        }

        /** A forged, edited, expired or foreign {@code state}: the PKCE round trip did its job. */
        public static AgentsException invalidState() {
            return new AgentsException(HttpStatus.BAD_REQUEST, "Invalid or expired authorization state");
        }

        /** The provider refused the grant — a spent code, a revoked token, a mismatched redirect URI. */
        public static AgentsException rejected(String description) {
            LOG.warn("The agent provider refused the authorization: {}", description);
            return new AgentsException(HttpStatus.BAD_REQUEST, "The agent provider refused the authorization");
        }

        /**
         * The stored grant no longer opens anything — revoked upstream, or expired past renewal.
         *
         * <p>Deliberately not a 401: the SPA reads that status as its own session expiring and would
         * sign the player out of Mooi over an agent-provider problem. A 409 says what is true — the
         * link is there but no longer usable, and re-authorizing repairs it.
         */
        public static AgentsException reauthorize() {
            return new AgentsException(HttpStatus.CONFLICT,
                    "Your agent provider authorization is no longer valid, please connect again");
        }

        /** The agent provider is unreachable, slow or broken. Distinct from a refusal: retrying may work. */
        public static AgentsException unavailable(String detail) {
            LOG.warn("The agent provider is unavailable: {}", detail);
            return new AgentsException(HttpStatus.BAD_GATEWAY, "The agent provider is unavailable, please try again");
        }

        /** A pasted token that is blank or otherwise obviously not a credential. */
        public static AgentsException invalidToken() {
            return new AgentsException(HttpStatus.BAD_REQUEST, "Invalid token");
        }
    }

    // --- configuration ---

    /**
     * Every agent-provider variable, read and validated at boot: a malformed TTL fails the
     * application start instead of the first link attempt.
     *
     * <p>URLs are validated only when a provider both declares OAuth enabled and has a client id
     * configured: the paste-a-token mode must keep working with the whole OAuth block left empty.
     */
    @Component
    public static class Settings {

        private static final String CLAUDE_ENV_VAR = "CLAUDE_CODE_OAUTH_TOKEN";

        @Getter
        private final Duration stateExpiresIn;
        @Getter
        private final Duration tokenRefreshSkew;
        @Getter
        private final Duration requestTimeout;
        private final Map<String, Provider> providers;

        Settings(@Value("${app.agents.state-expires-in}") String stateExpiresIn,
                 @Value("${app.agents.token-refresh-skew}") String tokenRefreshSkew,
                 @Value("${app.agents.request-timeout-ms}") long requestTimeoutMs,
                 @Value("${app.agents.claude.enabled}") boolean claudeOauthEnabled,
                 @Value("${app.agents.claude.client-id:}") String claudeClientId,
                 @Value("${app.agents.claude.authorize-uri:}") String claudeAuthorizeUri,
                 @Value("${app.agents.claude.token-uri:}") String claudeTokenUri,
                 @Value("${app.agents.claude.scopes:}") String claudeScopes,
                 @Value("${app.agents.claude.redirect-uri:}") String claudeRedirectUri) {
            this.stateExpiresIn = parseDuration(stateExpiresIn, "AGENT_STATE_EXPIRES_IN");
            this.tokenRefreshSkew = parseDuration(tokenRefreshSkew, "AGENT_TOKEN_REFRESH_SKEW");
            if (requestTimeoutMs <= 0) {
                throw new IllegalStateException("AGENT_REQUEST_TIMEOUT_MS must be greater than zero");
            }
            this.requestTimeout = Duration.ofMillis(requestTimeoutMs);

            Provider claude = new Provider("claude", "Claude", claudeOauthEnabled, blankToNull(claudeClientId),
                    blankToNull(claudeAuthorizeUri), blankToNull(claudeTokenUri), blankToNull(claudeScopes),
                    blankToNull(claudeRedirectUri), CLAUDE_ENV_VAR);
            if (claude.oauthEnabled() && claude.clientId() != null) {
                validUrl(claude.authorizeUri(), "AGENT_CLAUDE_AUTHORIZE_URI");
                validUrl(claude.tokenUri(), "AGENT_CLAUDE_TOKEN_URI");
                validUrl(claude.redirectUri(), "AGENT_CLAUDE_REDIRECT_URI");
            }
            Provider codex = new Provider("codex", "Codex", false, null, null, null, null, null, null);
            this.providers = Map.of(claude.id(), claude, codex.id(), codex);
        }

        public Optional<Provider> find(String id) {
            return Optional.ofNullable(providers.get(id));
        }

        public List<Provider> all() {
            return List.copyOf(providers.values());
        }

        private static String blankToNull(String value) {
            String stripped = value == null ? "" : value.strip();
            return stripped.isEmpty() ? null : stripped;
        }

        private static void validUrl(String value, String name) {
            try {
                URI.create(value).toURL();
            } catch (MalformedURLException | IllegalArgumentException exception) {
                throw new IllegalStateException(name + " is not a valid URL: " + value, exception);
            }
        }
    }

    /** Parses the {@code <n><s|m|h|d>} TTL format. Malformed values throw, at boot. */
    private static Duration parseDuration(String value, String name) {
        Matcher matcher = value == null ? null : DURATION_PATTERN.matcher(value.strip());
        if (matcher == null || !matcher.matches()) {
            throw new IllegalStateException(name + " must match <n><s|m|h|d>, got: " + value);
        }
        long amount = Long.parseLong(matcher.group(1));
        if (amount <= 0) {
            throw new IllegalStateException(name + " must be greater than zero, got: " + value);
        }
        return switch (matcher.group(2)) {
            case "s" -> Duration.ofSeconds(amount);
            case "m" -> Duration.ofMinutes(amount);
            case "h" -> Duration.ofHours(amount);
            default -> Duration.ofDays(amount);
        };
    }

    // --- state ---

    /**
     * The {@code state} parameter of the PKCE round trip, as a signed short-lived token rather than
     * a random string kept in a table.
     *
     * <p>It carries the player and the provider it was minted for, and the PKCE code verifier
     * itself, so nothing needs to be stored between the redirect and the code exchange: the
     * callback hands back a state it never had to look up. Derived from {@code JWT_SECRET} rather
     * than a per-provider secret, since PKCE has no client secret to derive from — the code
     * challenge is what defeats an intercepted authorization code, this signature only proves the
     * state was minted by us, for this player, for this provider.
     */
    @Component
    public static class StateCodec {

        /** Fixed label so the signing key is bound to this purpose and to nothing else. */
        private static final String KEY_LABEL = "mooi:agents:oauth-state";
        private static final String HMAC_ALGORITHM = "HmacSHA256";
        private static final String PROVIDER_CLAIM = "pid";
        private static final String VERIFIER_CLAIM = "cv";
        private static final int VERIFIER_BYTES = 32;

        private final Settings settings;
        private final Clock clock;
        private final byte[] key;
        private final SecureRandom random = new SecureRandom();

        StateCodec(Settings settings, Clock clock, @Value("${app.auth.jwt-secret:}") String jwtSecret) {
            this.settings = settings;
            this.clock = clock;
            this.key = deriveKey(jwtSecret);
        }

        /** What the authorize URL needs: the signed state, and the challenge derived from the verifier. */
        public record Issued(String state, String codeVerifier, String codeChallenge) {
        }

        public Issued issue(UUID playerId, String provider) {
            String codeVerifier = randomUrlSafe(VERIFIER_BYTES);
            Instant issuedAt = clock.instant();
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(playerId.toString())
                    .claim(PROVIDER_CLAIM, provider)
                    .claim(VERIFIER_CLAIM, codeVerifier)
                    .jwtID(UUID.randomUUID().toString())
                    .issueTime(Date.from(issuedAt))
                    .expirationTime(Date.from(issuedAt.plus(settings.getStateExpiresIn())))
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            try {
                jwt.sign(new MACSigner(key));
            } catch (JOSEException exception) {
                throw new IllegalStateException("Unable to sign an agent authorization state", exception);
            }
            return new Issued(jwt.serialize(), codeVerifier, challenge(codeVerifier));
        }

        /** What the state was minted for. Every rejection is the same failure. */
        public record StateClaims(UUID playerId, String provider, String codeVerifier) {
        }

        public StateClaims verify(String state) {
            try {
                SignedJWT jwt = SignedJWT.parse(state);
                if (!JWSAlgorithm.HS256.equals(jwt.getHeader().getAlgorithm()) || !jwt.verify(new MACVerifier(key))) {
                    throw AgentsException.invalidState();
                }
                JWTClaimsSet claims = jwt.getJWTClaimsSet();
                Date expiresAt = claims.getExpirationTime();
                if (expiresAt == null || !expiresAt.toInstant().isAfter(clock.instant())) {
                    throw AgentsException.invalidState();
                }
                String provider = claims.getStringClaim(PROVIDER_CLAIM);
                String codeVerifier = claims.getStringClaim(VERIFIER_CLAIM);
                if (provider == null || codeVerifier == null) {
                    throw AgentsException.invalidState();
                }
                return new StateClaims(UUID.fromString(claims.getSubject()), provider, codeVerifier);
            } catch (AgentsException exception) {
                throw exception;
            } catch (ParseException | JOSEException | IllegalArgumentException | NullPointerException exception) {
                throw AgentsException.invalidState();
            }
        }

        private String randomUrlSafe(int bytes) {
            byte[] buffer = new byte[bytes];
            random.nextBytes(buffer);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer);
        }

        private static String challenge(String codeVerifier) {
            try {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                return Base64.getUrlEncoder().withoutPadding()
                        .encodeToString(digest.digest(codeVerifier.getBytes(StandardCharsets.UTF_8)));
            } catch (NoSuchAlgorithmException exception) {
                throw new IllegalStateException("SHA-256 is not available", exception);
            }
        }

        /**
         * The JWT secret signs nothing directly: a separate key is derived from it, so the value
         * used here could never be mistaken for, or replayed as, the credential itself.
         */
        private static byte[] deriveKey(String jwtSecret) {
            try {
                Mac mac = Mac.getInstance(HMAC_ALGORITHM);
                mac.init(new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
                return mac.doFinal(KEY_LABEL.getBytes(StandardCharsets.UTF_8));
            } catch (NoSuchAlgorithmException | InvalidKeyException exception) {
                throw new IllegalStateException("Unable to derive the agent state signing key", exception);
            }
        }
    }

    // --- oauth2 ---

    /**
     * The only place this application talks to an agent provider's OAuth2 token endpoint.
     *
     * <p>PKCE only, no client secret: the operator supplies just a client id, and the code
     * challenge is what protects the exchange. Every provider that reaches this class is assumed to
     * speak the same authorization-code-plus-PKCE grant; a provider that cannot would need its own
     * client, not a branch in this one.
     */
    @Component
    public static class OAuthClient {

        private static final String ACCEPT_HEADER = "Accept";
        private static final String JSON = "application/json";
        private static final String FORM = "application/x-www-form-urlencoded";
        private static final int MAX_SCOPE_LENGTH = 512;
        private static final int MAX_ACCOUNT_LABEL_LENGTH = 255;
        private static final int MAX_ERROR_LENGTH = 256;

        private final Clock clock;
        private final Duration requestTimeout;
        private final HttpClient httpClient;
        private final ObjectMapper objectMapper = JsonMapper.shared();

        OAuthClient(Settings settings, Clock clock) {
            this.clock = clock;
            this.requestTimeout = settings.getRequestTimeout();
            this.httpClient = HttpClient.newBuilder().connectTimeout(requestTimeout).build();
        }

        public String authorizeUrl(Provider provider, String state, String codeChallenge) {
            return provider.authorizeUri()
                    + "?response_type=code"
                    + "&client_id=" + encode(provider.clientId())
                    + "&redirect_uri=" + encode(provider.redirectUri())
                    + "&scope=" + encode(provider.scopes() == null ? "" : provider.scopes())
                    + "&state=" + encode(state)
                    + "&code_challenge=" + encode(codeChallenge)
                    + "&code_challenge_method=S256";
        }

        /**
         * A provider grant. {@code accountLabel} reads an optional {@code account}/{@code email}
         * field when the provider's token response carries one, else {@code null}: shown to the
         * player so they can tell two linked accounts of the same provider apart, never relied on
         * for anything else.
         */
        public record Tokens(String accessToken, OffsetDateTime accessTokenExpiresAt, String refreshToken,
                             String scope, String accountLabel) {
        }

        public Tokens exchangeCode(Provider provider, String code, String codeVerifier) {
            return readTokens(postForm(provider.tokenUri(), Map.of(
                    "grant_type", "authorization_code",
                    "client_id", provider.clientId(),
                    "code", code,
                    "redirect_uri", provider.redirectUri(),
                    "code_verifier", codeVerifier)));
        }

        /** Some providers rotate the refresh token on renewal, some do not; a missing one keeps the old. */
        public Tokens refresh(Provider provider, String refreshToken) {
            return readTokens(postForm(provider.tokenUri(), Map.of(
                    "grant_type", "refresh_token",
                    "client_id", provider.clientId(),
                    "refresh_token", refreshToken)));
        }

        private String postForm(String tokenUri, Map<String, String> form) {
            String body = form.entrySet().stream()
                    .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                    .collect(Collectors.joining("&"));
            HttpRequest request = HttpRequest.newBuilder(URI.create(tokenUri))
                    .timeout(requestTimeout)
                    .header(HttpHeaders.CONTENT_TYPE, FORM)
                    .header(ACCEPT_HEADER, JSON)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            try {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() / 100 != 2) {
                    throw AgentsException.unavailable("the token endpoint answered " + response.statusCode());
                }
                return response.body();
            } catch (IOException exception) {
                throw AgentsException.unavailable("the token endpoint failed: " + exception.getMessage());
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw AgentsException.unavailable("the token endpoint was interrupted");
            }
        }

        /** The {@code error} field is read first: some providers refuse a grant with a 200 status. */
        private Tokens readTokens(String body) {
            JsonNode node = readJson(body);
            String error = text(node, "error", MAX_ERROR_LENGTH);
            if (error != null) {
                String description = text(node, "error_description", MAX_ERROR_LENGTH);
                throw AgentsException.rejected(description != null ? description : error);
            }
            String accessToken = text(node, "access_token");
            if (accessToken == null) {
                throw AgentsException.unavailable("the token endpoint returned no access token");
            }
            String accountLabel = text(node, "account", MAX_ACCOUNT_LABEL_LENGTH);
            if (accountLabel == null) {
                accountLabel = text(node, "email", MAX_ACCOUNT_LABEL_LENGTH);
            }
            return new Tokens(accessToken, expiresAt(node, "expires_in"), text(node, "refresh_token"),
                    text(node, "scope", MAX_SCOPE_LENGTH), accountLabel);
        }

        private JsonNode readJson(String body) {
            try {
                return objectMapper.readTree(body);
            } catch (JacksonException exception) {
                throw AgentsException.unavailable("the token endpoint returned a malformed response");
            }
        }

        /** Relative seconds become an absolute instant once, here. Absent or zero means no expiry. */
        private OffsetDateTime expiresAt(JsonNode node, String field) {
            JsonNode value = node.get(field);
            if (value == null || !value.isNumber() || value.asLong() <= 0) {
                return null;
            }
            return OffsetDateTime.ofInstant(clock.instant().plusSeconds(value.asLong()), ZoneOffset.UTC);
        }

        /** Untruncated: token material must survive intact. */
        private static String text(JsonNode node, String field) {
            JsonNode value = node.get(field);
            if (value == null || !value.isString()) {
                return null;
            }
            String stripped = value.asText().strip();
            return stripped.isEmpty() ? null : stripped;
        }

        /** Truncated to what the column holds, so a long field can never fail an insert. */
        private static String text(JsonNode node, String field, int maxLength) {
            String value = text(node, field);
            if (value == null) {
                return null;
            }
            return value.length() <= maxLength ? value : value.substring(0, maxLength);
        }

        private static String encode(String value) {
            return URLEncoder.encode(value, StandardCharsets.UTF_8);
        }
    }
}
