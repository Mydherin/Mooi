package dev.mooi.mic.shared;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Transversal aspect: environment configuration.
 *
 * <p>Loads a {@code .env} file into the Spring {@code Environment} with zero external dependencies.
 * The file is registered as the lowest precedence property source, so real OS environment variables
 * and JVM system properties always win. Override the file location with {@code ENV_FILE}.
 */
public class Env implements EnvironmentPostProcessor {

    public static final String PROPERTY_SOURCE_NAME = "dotenv";

    private static final String ENV_FILE_KEY = "ENV_FILE";
    private static final String DEFAULT_ENV_FILE = ".env";
    private static final String EXPORT_PREFIX = "export ";
    private static final String COMMENT_PREFIX = "#";
    private static final String INLINE_COMMENT = " #";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Path file = resolveFile(environment);
        if (!Files.isRegularFile(file)) {
            return;
        }
        Map<String, Object> values = read(file);
        if (values.isEmpty()) {
            return;
        }
        environment.getPropertySources().addLast(new MapPropertySource(PROPERTY_SOURCE_NAME, values));
    }

    private Path resolveFile(ConfigurableEnvironment environment) {
        String configured = environment.getProperty(ENV_FILE_KEY);
        return Path.of(configured != null && !configured.isBlank() ? configured : DEFAULT_ENV_FILE);
    }

    private Map<String, Object> read(Path file) {
        List<String> lines;
        try {
            lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read env file: " + file, exception);
        }
        Map<String, Object> values = new LinkedHashMap<>();
        for (String rawLine : lines) {
            String line = rawLine.strip();
            if (line.isEmpty() || line.startsWith(COMMENT_PREFIX)) {
                continue;
            }
            if (line.startsWith(EXPORT_PREFIX)) {
                line = line.substring(EXPORT_PREFIX.length()).strip();
            }
            int separator = line.indexOf('=');
            if (separator <= 0) {
                continue;
            }
            String key = line.substring(0, separator).strip();
            if (!key.isEmpty()) {
                values.put(key, unquote(line.substring(separator + 1).strip()));
            }
        }
        return values;
    }

    private String unquote(String value) {
        if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
            return value.substring(1, value.length() - 1).replace("\\n", "\n").replace("\\\"", "\"");
        }
        if (value.length() >= 2 && value.startsWith("'") && value.endsWith("'")) {
            return value.substring(1, value.length() - 1);
        }
        int comment = value.indexOf(INLINE_COMMENT);
        return comment >= 0 ? value.substring(0, comment).strip() : value;
    }
}
