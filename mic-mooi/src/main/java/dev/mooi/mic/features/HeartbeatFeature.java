package dev.mooi.mic.features;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import dev.mooi.mic.shared.Db;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

/**
 * Feature: service heartbeats.
 *
 * <p>Writes one row when the instance becomes ready and exposes the recorded history. Self-contained
 * by architecture: it duplicates the patterns of other features instead of importing them.
 */
@Slf4j
@RestController
@RequestMapping("/api/heartbeats")
@RequiredArgsConstructor
@Validated
public class HeartbeatFeature {

    private final HeartbeatService heartbeatService;

    @GetMapping
    public List<HeartbeatResponse> recent(@RequestParam(defaultValue = "10") @Positive @Max(100) int limit) {
        return heartbeatService.recent(limit);
    }

    @GetMapping("/latest")
    public HeartbeatResponse latest() {
        return heartbeatService.latest();
    }

    // --- application ---

    @Slf4j
    @Service
    @RequiredArgsConstructor
    public static class HeartbeatService {

        private static final String STATUS_READY = "READY";

        private final HeartbeatRepository heartbeatRepository;

        @Value("${spring.application.name}")
        private String serviceName;

        @Value("${app.version}")
        private String version;

        @EventListener(ApplicationReadyEvent.class)
        @Transactional
        public void recordStartup() {
            Heartbeat heartbeat = new Heartbeat();
            heartbeat.setInstanceId(instanceId());
            heartbeat.setServiceName(serviceName);
            heartbeat.setVersion(version);
            heartbeat.setStatus(STATUS_READY);
            heartbeatRepository.save(heartbeat);
            log.info("Recorded startup heartbeat for instance {}", heartbeat.getInstanceId());
        }

        @Transactional(readOnly = true)
        public List<HeartbeatResponse> recent(int limit) {
            Pageable page = PageRequest.of(0, limit);
            return heartbeatRepository.findAllByOrderByCreatedAtDesc(page).stream()
                    .map(HeartbeatService::toResponse)
                    .toList();
        }

        @Transactional(readOnly = true)
        public HeartbeatResponse latest() {
            return heartbeatRepository.findFirstByOrderByCreatedAtDesc()
                    .map(HeartbeatService::toResponse)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "No heartbeat recorded yet"));
        }

        private String instanceId() {
            return serviceName + "-" + ProcessHandle.current().pid();
        }

        private static HeartbeatResponse toResponse(Heartbeat heartbeat) {
            return new HeartbeatResponse(heartbeat.getId(), heartbeat.getInstanceId(), heartbeat.getServiceName(),
                    heartbeat.getVersion(), heartbeat.getStatus(), heartbeat.getCreatedAt());
        }
    }

    // --- persistence ---

    @Getter
    @Setter
    @NoArgsConstructor
    @Entity
    @Table(name = "service_heartbeat")
    public static class Heartbeat extends Db.Auditable {

        @Id
        @GeneratedValue
        @Column(name = "id", nullable = false, updatable = false)
        private UUID id;

        @Column(name = "instance_id", nullable = false, length = 64)
        private String instanceId;

        @Column(name = "service_name", nullable = false, length = 64)
        private String serviceName;

        @Column(name = "version", nullable = false, length = 32)
        private String version;

        @Column(name = "status", nullable = false, length = 24)
        private String status;
    }

    public interface HeartbeatRepository extends JpaRepository<Heartbeat, UUID> {

        List<Heartbeat> findAllByOrderByCreatedAtDesc(Pageable pageable);

        java.util.Optional<Heartbeat> findFirstByOrderByCreatedAtDesc();
    }

    // --- liveness ---

    /**
     * Unauthenticated liveness probe for clients that should not have to know about the actuator
     * surface. Mounted at the root, next to the auth endpoints.
     */
    @RestController
    public static class HealthController {

        private static final String STATUS_UP = "UP";

        @GetMapping("/health")
        public HealthResponse health() {
            return new HealthResponse(STATUS_UP);
        }
    }

    // --- contracts ---

    public record HealthResponse(String status) {
    }

    public record HeartbeatResponse(UUID id, String instanceId, String serviceName, String version, String status,
                                    OffsetDateTime recordedAt) {
    }
}
