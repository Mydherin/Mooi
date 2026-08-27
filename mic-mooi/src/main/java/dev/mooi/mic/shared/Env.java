package dev.mooi.mic.shared;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
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
 * <p>Loads an ordered chain of {@code .env} files into the Spring {@code Environment} with zero
 * external dependencies. The default chain is the artifact {@code .env} followed by the monorepo root
 * {@code .env}, so the artifact overrides shared values and the shared data layer configuration is
 * inherited instead of duplicated. Every file is registered below the real OS environment variables
 * and the JVM system properties, which always win. Override the chain with {@code ENV_FILES}.
 */
public class Env implements EnvironmentPostProcessor {

    public static final String PROPERTY_SOURCE_PREFIX = "dotenv:";

    private static final String ENV_FILES_KEY = "ENV_FILES";
    private static final String DEFAULT_ENV_FILES = ".env,../.env";
    private static final String FILE_SEPARATOR = ",";
    private static final String EXPORT_PREFIX = "export ";
    private static final String COMMENT_PREFIX = "#";
    private static final String INLINE_COMMENT = " #";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        for (Path file : resolveFiles(environment)) {
            if (!Files.isRegularFile(file)) {
                continue;
            }
            Map<String, Object> values = read(file);
            if (values.isEmpty()) {
                continue;
            }
            environment.getPropertySources()
                    .addLast(new MapPropertySource(PROPERTY_SOURCE_PREFIX + file, values));
        }
    }

    private List<Path> resolveFiles(ConfigurableEnvironment environment) {
        String configured = environment.getProperty(ENV_FILES_KEY);
        String value = configured != null && !configured.isBlank() ? configured : DEFAULT_ENV_FILES;
        List<Path> files = new ArrayList<>();
        for (String candidate : value.split(FILE_SEPARATOR)) {
            String path = candidate.strip();
            if (!path.isEmpty()) {
                Path normalized = Path.of(path).toAbsolutePath().normalize();
                if (!files.contains(normalized)) {
                    files.add(normalized);
                }
            }
        }
        return files;
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
