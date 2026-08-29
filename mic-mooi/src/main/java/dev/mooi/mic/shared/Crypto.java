package dev.mooi.mic.shared;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;

/**
 * Transversal aspect: encryption of secrets at rest.
 *
 * <p>Credentials this application holds on behalf of a player at a third party — a GitHub access
 * token, a refresh token — are not ours to store in the clear: a database dump must not hand over
 * the accounts behind them. Every such value is sealed here before it reaches Postgres and opened
 * here when it is used, so the plaintext exists only inside a request.
 *
 * <p>Our own credentials are deliberately <em>not</em> handled this way and never will be: access
 * tokens are signed rather than stored, and refresh tokens are kept as a one-way SHA-256 digest,
 * which is stronger than encryption precisely because nothing can reverse it. Encryption is the
 * right tool only when the original value has to be recovered, which is exactly the third-party
 * case.
 */
@Configuration
public class Crypto {

    /**
     * AES-256-GCM sealed values.
     *
     * <p>GCM is authenticated encryption: opening a value also proves it was written by this key
     * and has not been edited, so a tampered row fails loudly instead of decrypting into garbage. A
     * fresh random IV per call is what keeps that guarantee — reusing one under the same key breaks
     * GCM outright — and it travels in front of the ciphertext because it is not a secret.
     */
    @Component
    public static class SecretBox {

        private static final String ALGORITHM = "AES";
        private static final String TRANSFORMATION = "AES/GCM/NoPadding";
        private static final String KEY_PREFIX = "base64:";
        private static final int KEY_BYTES = 32;
        private static final int IV_BYTES = 12;
        private static final int TAG_BITS = 128;

        private final SecretKeySpec key;
        private final SecureRandom random = new SecureRandom();

        SecretBox(@Value("${app.crypto.secrets-key:}") String secretsKey) {
            this.key = new SecretKeySpec(decodeKey(secretsKey), ALGORITHM);
        }

        /** Null in, null out: a nullable column round-trips without the caller branching. */
        public String encrypt(String plaintext) {
            if (plaintext == null) {
                return null;
            }
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            try {
                Cipher cipher = Cipher.getInstance(TRANSFORMATION);
                cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
                byte[] sealed = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
                byte[] output = new byte[iv.length + sealed.length];
                System.arraycopy(iv, 0, output, 0, iv.length);
                System.arraycopy(sealed, 0, output, iv.length, sealed.length);
                return Base64.getUrlEncoder().withoutPadding().encodeToString(output);
            } catch (GeneralSecurityException exception) {
                throw new IllegalStateException("Unable to encrypt a secret", exception);
            }
        }

        /**
         * Every failure — a truncated value, a foreign key, an edited byte — is the same error: what
         * exactly went wrong is not something a caller can act on, and saying more would describe
         * the stored format to whoever caused it.
         */
        public String decrypt(String ciphertext) {
            if (ciphertext == null) {
                return null;
            }
            try {
                byte[] input = Base64.getUrlDecoder().decode(ciphertext);
                if (input.length <= IV_BYTES) {
                    throw new IllegalStateException("Unable to decrypt a stored secret");
                }
                Cipher cipher = Cipher.getInstance(TRANSFORMATION);
                cipher.init(Cipher.DECRYPT_MODE, key,
                        new GCMParameterSpec(TAG_BITS, Arrays.copyOf(input, IV_BYTES)));
                byte[] opened = cipher.doFinal(input, IV_BYTES, input.length - IV_BYTES);
                return new String(opened, StandardCharsets.UTF_8);
            } catch (GeneralSecurityException | IllegalArgumentException exception) {
                throw new IllegalStateException("Unable to decrypt a stored secret", exception);
            }
        }

        /** Validated at boot: a missing or short key fails the start, never the first write. */
        private static byte[] decodeKey(String secretsKey) {
            String value = secretsKey == null ? "" : secretsKey.strip();
            if (value.startsWith(KEY_PREFIX)) {
                value = value.substring(KEY_PREFIX.length()).strip();
            }
            if (value.isEmpty()) {
                throw new IllegalStateException("SECRETS_KEY must be set");
            }
            byte[] decoded;
            try {
                decoded = Base64.getDecoder().decode(value);
            } catch (IllegalArgumentException exception) {
                throw new IllegalStateException("SECRETS_KEY must be valid base64", exception);
            }
            if (decoded.length != KEY_BYTES) {
                throw new IllegalStateException(
                        "SECRETS_KEY must decode to exactly " + KEY_BYTES + " bytes, got " + decoded.length);
            }
            return decoded;
        }
    }
}
