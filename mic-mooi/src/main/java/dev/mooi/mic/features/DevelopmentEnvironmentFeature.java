package dev.mooi.mic.features;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.regex.Pattern;

import org.hibernate.annotations.Immutable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import dev.mooi.mic.shared.Auth;
import dev.mooi.mic.shared.Crypto;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * Encrypted, project-scoped development environment: the MOOI_DEVELOPMENT_ values every session of a
 * project shares, which production deployments and backups inherit. Nothing is stored in Git, and
 * values only ever leave this service towards mic-sessions.
 */
@RestController
@RequiredArgsConstructor
public class DevelopmentEnvironmentFeature {
    private final EnvironmentService service;

    @GetMapping("/me/projects/{projectId}/development/environment")
    @Auth.Authenticated
    @Auth.ServiceCall
    public EnvironmentValues values(@PathVariable UUID projectId, Auth.Principal principal) {
        return service.values(projectId, principal.player().id());
    }

    @PutMapping("/me/projects/{projectId}/development/environment")
    @Auth.Authenticated
    @Auth.ServiceCall
    public EnvironmentNames update(@PathVariable UUID projectId, @Valid @RequestBody EnvironmentUpdate body,
                                   Auth.Principal principal) {
        return service.update(projectId, principal.player().id(), body);
    }

    public record EnvironmentValues(Map<String, String> values) { }
    public record EnvironmentNames(List<String> environment) { }
    /** A null value removes that variable. */
    public record EnvironmentUpdate(@NotNull @Size(max = 100) Map<String, String> values) { }

    @Service
    @RequiredArgsConstructor
    public static class EnvironmentService {
        private static final Pattern NAME = Pattern.compile("MOOI_DEVELOPMENT_[A-Z0-9_]{1,100}");
        private static final int MAX_VARIABLES = 100;
        private static final int MAX_VALUE = 8192;

        private final EnvironmentRepository environments;
        private final ProjectReferenceRepository projects;
        private final Crypto.SecretBox box;
        private final ObjectMapper json = JsonMapper.shared();

        private void requireProject(UUID projectId, UUID playerId) {
            if (!projects.existsByIdAndPlayerId(projectId, playerId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
            }
        }

        @Transactional(readOnly = true)
        public EnvironmentValues values(UUID projectId, UUID playerId) {
            requireProject(projectId, playerId);
            return new EnvironmentValues(environments.findById(projectId).map(this::decrypt).orElse(Map.of()));
        }

        @Transactional
        public EnvironmentNames update(UUID projectId, UUID playerId, EnvironmentUpdate update) {
            requireProject(projectId, playerId);
            Environment row = environments.findById(projectId).orElse(null);
            Map<String, String> values = new TreeMap<>(row == null ? Map.of() : decrypt(row));
            update.values().forEach((name, value) -> {
                if (!NAME.matcher(name).matches()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Environment names must use the MOOI_DEVELOPMENT_ prefix and uppercase letters, digits or underscores");
                }
                if (value == null) {
                    values.remove(name);
                } else if (value.length() > MAX_VALUE) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Environment values cannot exceed 8 KB");
                } else {
                    values.put(name, value);
                }
            });
            if (values.size() > MAX_VARIABLES) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A project can store at most 100 variables");
            }
            if (values.isEmpty()) {
                if (row != null) environments.delete(row);
            } else {
                if (row == null) {
                    row = new Environment();
                    row.setProjectId(projectId);
                }
                row.setEnvironment(box.encrypt(json.writeValueAsString(values)));
                environments.save(row);
            }
            return new EnvironmentNames(List.copyOf(values.keySet()));
        }

        private Map<String, String> decrypt(Environment row) {
            return json.readValue(box.decrypt(row.getEnvironment()), new TypeReference<TreeMap<String, String>>() { });
        }
    }

    @Getter @Setter @NoArgsConstructor
    @Entity(name = "DevelopmentEnvironment")
    @Table(name = "development_environments")
    public static class Environment {
        @Id @Column(name = "project_id") private UUID projectId;
        @Column(name = "environment", columnDefinition = "text", nullable = false) private String environment;
    }

    @Getter @Immutable @NoArgsConstructor
    @Entity(name = "DevelopmentEnvironmentProject")
    @Table(name = "projects")
    public static class ProjectReference {
        @Id @Column(name = "id") private UUID id;
        @Column(name = "player_id") private UUID playerId;
    }

    public interface EnvironmentRepository extends JpaRepository<Environment, UUID> { }
    public interface ProjectReferenceRepository extends JpaRepository<ProjectReference, UUID> {
        boolean existsByIdAndPlayerId(UUID id, UUID playerId);
    }
}
