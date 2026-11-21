package dev.mooi.mic.features;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import dev.mooi.mic.shared.Auth;
import dev.mooi.mic.shared.Db;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Operational state of each project's Software Factory: status, the agent selection of the current run,
 * the step journal, change requests and the unattended grant. The plan itself lives in the repository
 * ({@code docs/factory/}); {@code plan} here is only a cache of its front matter for the UI.
 *
 * <p>The orchestrator runs in mic-sessions, so every write comes from there: player-scoped writes are
 * {@link Auth.ServiceCall}, and the ones a run makes while nobody is connected are {@link Auth.ServiceOnly}.
 * The SPA only reads. Every write names the {@code revision} it read, so two writers never interleave.
 */
@RestController
@RequiredArgsConstructor
public class FactoryFeature {
    private final FactoryService service;

    @GetMapping("/me/factories")
    @Auth.Authenticated
    public FactoryList list(Auth.Principal principal) {
        return service.list(principal.player().id());
    }

    @GetMapping("/me/projects/{projectId}/factory")
    @Auth.Authenticated
    public FactoryPayload get(@PathVariable UUID projectId, Auth.Principal principal) {
        return service.get(projectId, principal.player().id());
    }

    @PostMapping("/me/projects/{projectId}/factory")
    @Auth.Authenticated
    @Auth.ServiceCall
    public FactoryPayload create(@PathVariable UUID projectId, Auth.Principal principal) {
        return service.create(projectId, principal.player().id());
    }

    @DeleteMapping("/me/projects/{projectId}/factory")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Auth.Authenticated
    @Auth.ServiceCall
    public void delete(@PathVariable UUID projectId, Auth.Principal principal) {
        service.delete(projectId, principal.player().id());
    }

    /** Called when the player starts or resumes: from then on the run acts under its own sign-in. */
    @PostMapping("/me/projects/{projectId}/factory/grant")
    @Auth.Authenticated
    @Auth.ServiceCall
    public GrantPayload grant(@PathVariable UUID projectId, Auth.Principal principal) {
        return service.grant(projectId, principal.player().id());
    }

    @GetMapping("/me/projects/{projectId}/factory/steps")
    @Auth.Authenticated
    public StepPage steps(@PathVariable UUID projectId, @RequestParam(required = false) OffsetDateTime before,
                          Auth.Principal principal) {
        return service.steps(projectId, principal.player().id(), before);
    }

    @GetMapping("/me/projects/{projectId}/factory/change-requests")
    @Auth.Authenticated
    public ChangeRequestList changeRequests(@PathVariable UUID projectId, Auth.Principal principal) {
        return service.changeRequests(projectId, principal.player().id());
    }

    @PostMapping("/me/projects/{projectId}/factory/change-requests")
    @Auth.Authenticated
    @Auth.ServiceCall
    public ChangeRequestPayload requestChange(@PathVariable UUID projectId, @Valid @RequestBody CreateChangeRequest body,
                                              Auth.Principal principal) {
        return service.requestChange(projectId, principal.player().id(), body);
    }

    /** The factories a restarted orchestrator must pick up again, including the ones waiting on provider limits. */
    @GetMapping("/internal/factories/active")
    @Auth.ServiceOnly
    public InternalFactoryList active() {
        return service.active();
    }

    @GetMapping("/internal/factories/{factoryId}")
    @Auth.ServiceOnly
    public InternalFactory internal(@PathVariable UUID factoryId) {
        return service.internal(factoryId);
    }

    @PutMapping("/internal/factories/{factoryId}")
    @Auth.ServiceOnly
    public InternalFactory update(@PathVariable UUID factoryId, @Valid @RequestBody UpdateFactory body) {
        return service.update(factoryId, body);
    }

    /** Refused once the player signed out everywhere, was kicked or banned: the run then pauses as revoked. */
    @PostMapping("/internal/factories/{factoryId}/access-token")
    @Auth.ServiceOnly
    public GrantPayload accessToken(@PathVariable UUID factoryId) {
        return service.accessToken(factoryId);
    }

    @PostMapping("/internal/factories/{factoryId}/steps")
    @Auth.ServiceOnly
    public StepPayload openStep(@PathVariable UUID factoryId, @Valid @RequestBody OpenStep body) {
        return service.openStep(factoryId, body);
    }

    @PutMapping("/internal/factories/{factoryId}/steps/{stepId}")
    @Auth.ServiceOnly
    public StepPayload updateStep(@PathVariable UUID factoryId, @PathVariable UUID stepId,
                                  @Valid @RequestBody UpdateStep body) {
        return service.updateStep(factoryId, stepId, body);
    }

    /** The orchestrator names the steps it still runs; every other unfinished one was orphaned by a restart. */
    @PostMapping("/internal/factories/steps/reconcile")
    @Auth.ServiceOnly
    public Reconciled reconcile(@Valid @RequestBody ReconcileSteps body) {
        return new Reconciled(service.interruptOrphans(Set.copyOf(body.active())));
    }

    @PutMapping("/internal/factories/{factoryId}/change-requests/{changeRequestId}")
    @Auth.ServiceOnly
    public ChangeRequestPayload updateChangeRequest(@PathVariable UUID factoryId, @PathVariable UUID changeRequestId,
                                                    @Valid @RequestBody UpdateChangeRequest body) {
        return service.updateChangeRequest(factoryId, changeRequestId, body);
    }

    // --- contract ---

    public static final Set<String> STATUSES = Set.of("defining", "ready", "running", "pausing", "paused", "resting");
    public static final Set<String> PAUSE_REASONS = Set.of("user", "limits", "attention", "revoked", "error");
    public static final Set<String> ROLES = Set.of("architect", "planner", "builder", "tester", "merger", "analyst");
    public static final Set<String> STEP_STATUSES =
            Set.of("running", "completed", "continue", "failed", "blocked", "interrupted");
    public static final Set<String> CHANGE_STATUSES =
            Set.of("queued", "analyzing", "awaiting-confirmation", "applied", "rejected");

    public record RunConfig(@NotBlank @Size(max = 32) String provider, @Size(max = 64) String connectionId,
                            @Size(max = 32) String adapter, @Size(max = 128) String model,
                            @Size(max = 32) String effort) { }
    public record FactoryPayload(UUID id, UUID projectId, String status, String pauseReason, String attention,
                                 RunConfig runConfig, UUID chatSessionId, JsonNode plan, String planCommit,
                                 StepPayload activeStep, int openChangeRequests, long revision,
                                 OffsetDateTime createdAt, OffsetDateTime updatedAt) { }
    public record FactoryList(List<FactoryPayload> factories) { }
    public record InternalFactory(UUID playerId, boolean granted, FactoryPayload factory) { }
    public record InternalFactoryList(List<InternalFactory> factories) { }
    public record GrantPayload(String accessToken, long expiresIn) { }
    public record UpdateFactory(@NotNull Long revision, @NotBlank String status, String pauseReason,
                                @Size(max = 2000) String attention, @Valid RunConfig runConfig, UUID chatSessionId,
                                @Size(max = 1_000_000) String plan, @Size(max = 64) String planCommit) { }
    public record StepPayload(UUID id, String role, String phaseId, String milestoneId, UUID sessionId, String branch,
                              String model, String baseCommit, String headCommit, String status, String summary,
                              Integer peakContextPercent, OffsetDateTime startedAt, OffsetDateTime finishedAt) { }
    public record StepPage(List<StepPayload> steps, boolean hasMore) { }
    public record OpenStep(@NotNull UUID id, @NotBlank String role, @Size(max = 128) String phaseId,
                           @Size(max = 128) String milestoneId, UUID sessionId, @Size(max = 255) String branch,
                           @Size(max = 128) String model, @Size(max = 64) String baseCommit) { }
    public record UpdateStep(UUID sessionId, @NotBlank String status, @Size(max = 4000) String summary,
                             @Size(max = 64) String headCommit, @Min(0) @Max(100) Integer peakContextPercent) { }
    public record ReconcileSteps(@NotNull @Size(max = 1000) List<@NotNull UUID> active) { }
    public record Reconciled(int interrupted) { }
    public record CreateChangeRequest(@NotBlank @Size(max = 8000) String text) { }
    public record UpdateChangeRequest(@NotBlank String status, Boolean scopeLevel,
                                      @Size(max = 8000) String analysis) { }
    public record ChangeRequestPayload(UUID id, int number, String text, String status, boolean scopeLevel,
                                       String analysis, OffsetDateTime createdAt, OffsetDateTime resolvedAt) { }
    public record ChangeRequestList(List<ChangeRequestPayload> changeRequests) { }

    // --- application ---

    @Service
    @RequiredArgsConstructor
    public static class FactoryService {
        private static final String NOT_FOUND = "Factory not found";
        private static final String GRANT_LABEL = "Mooi Software Factory";
        private static final int STEP_PAGE = 50;
        /** A step this recent may still be opening while the orchestrator names its active ones. */
        private static final Duration SETTLING = Duration.ofMinutes(1);
        private static final Set<String> LIVE = Set.of("running", "pausing");
        private static final Set<String> OPEN_CHANGES = Set.of("queued", "analyzing", "awaiting-confirmation");

        private final FactoryRepository factories;
        private final StepRepository steps;
        private final ChangeRequestRepository changes;
        private final ProjectRepository projects;
        private final AuthFeature.AuthService auth;

        @Transactional(readOnly = true)
        public FactoryList list(UUID playerId) {
            return new FactoryList(factories.findByPlayerId(playerId).stream().map(this::payload).toList());
        }

        @Transactional(readOnly = true)
        public FactoryPayload get(UUID projectId, UUID playerId) {
            return payload(owned(projectId, playerId));
        }

        @Transactional
        public FactoryPayload create(UUID projectId, UUID playerId) {
            if (!projects.existsByIdAndPlayerId(projectId, playerId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
            }
            if (factories.findByProjectId(projectId).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This project already has a factory");
            }
            var row = new Factory();
            row.setId(UUID.randomUUID());
            row.setProjectId(projectId);
            row.setPlayerId(playerId);
            row.setStatus("defining");
            row.setRevision(1L);
            return payload(factories.saveAndFlush(row));
        }

        @Transactional
        public void delete(UUID projectId, UUID playerId) {
            var row = owned(projectId, playerId);
            if (LIVE.contains(row.getStatus())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Pause the factory before removing it");
            }
            revokeGrant(row);
            factories.delete(row);
        }

        /**
         * A project leaving the workspace takes its factory with it. The database cascade would drop the row
         * too, but not the factory's sign-in: it is revoked here first, as removing the factory does.
         */
        @Transactional
        public void forgetProject(UUID projectId) {
            factories.findByProjectId(projectId).ifPresent(row -> {
                revokeGrant(row);
                factories.delete(row);
            });
        }

        @Transactional
        public GrantPayload grant(UUID projectId, UUID playerId) {
            var row = owned(projectId, playerId);
            revokeGrant(row);
            row.setGrantSessionId(auth.openDelegatedSession(playerId, GRANT_LABEL));
            factories.save(row);
            var token = auth.renewDelegatedAccessToken(row.getGrantSessionId(), playerId);
            return new GrantPayload(token.accessToken(), token.expiresIn());
        }

        @Transactional
        public GrantPayload accessToken(UUID factoryId) {
            var row = factory(factoryId);
            if (row.getGrantSessionId() == null) throw new Auth.AuthenticationException("The factory has no grant");
            var token = auth.renewDelegatedAccessToken(row.getGrantSessionId(), row.getPlayerId());
            return new GrantPayload(token.accessToken(), token.expiresIn());
        }

        @Transactional(readOnly = true)
        public StepPage steps(UUID projectId, UUID playerId, OffsetDateTime before) {
            var row = owned(projectId, playerId);
            var page = before == null
                    ? steps.findByFactoryIdOrderByStartedAtDesc(row.getId(), Limit.of(STEP_PAGE + 1))
                    : steps.findByFactoryIdAndStartedAtBeforeOrderByStartedAtDesc(row.getId(), before,
                            Limit.of(STEP_PAGE + 1));
            var visible = page.stream().limit(STEP_PAGE).map(FactoryService::step).toList();
            return new StepPage(visible, page.size() > STEP_PAGE);
        }

        @Transactional(readOnly = true)
        public ChangeRequestList changeRequests(UUID projectId, UUID playerId) {
            var row = owned(projectId, playerId);
            return new ChangeRequestList(changes.findByFactoryIdOrderByNumberDesc(row.getId()).stream()
                    .map(FactoryService::change).toList());
        }

        @Transactional
        public ChangeRequestPayload requestChange(UUID projectId, UUID playerId, CreateChangeRequest input) {
            var row = owned(projectId, playerId);
            var change = new ChangeRequest();
            change.setId(UUID.randomUUID());
            change.setFactoryId(row.getId());
            change.setNumber(changes.maxNumber(row.getId()) + 1);
            change.setText(input.text().strip());
            change.setStatus("queued");
            change.setCreatedAt(now());
            return change(changes.save(change));
        }

        @Transactional(readOnly = true)
        public InternalFactoryList active() {
            return new InternalFactoryList(factories.findActive().stream().map(this::internal).toList());
        }

        @Transactional(readOnly = true)
        public InternalFactory internal(UUID factoryId) {
            return internal(factory(factoryId));
        }

        @Transactional
        public InternalFactory update(UUID factoryId, UpdateFactory input) {
            var row = factory(factoryId);
            if (!row.getRevision().equals(input.revision())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "The factory changed meanwhile");
            }
            require(STATUSES, input.status(), "factory status");
            if (input.pauseReason() != null) require(PAUSE_REASONS, input.pauseReason(), "pause reason");
            row.setStatus(input.status());
            row.setPauseReason("paused".equals(input.status()) ? input.pauseReason() : null);
            row.setAttention(input.attention());
            if (input.runConfig() != null) {
                row.setRunProvider(input.runConfig().provider());
                row.setRunConnectionId(input.runConfig().connectionId());
                row.setRunAdapter(input.runConfig().adapter());
                row.setRunModel(input.runConfig().model());
                row.setRunEffort(input.runConfig().effort());
            }
            if (input.chatSessionId() != null) row.setChatSessionId(input.chatSessionId());
            if (input.plan() != null) {
                parse(input.plan());
                row.setPlanSnapshot(input.plan());
            }
            if (input.planCommit() != null) row.setPlanCommit(input.planCommit());
            // Only a factory waiting on provider limits resumes by itself; every other pause waits for the
            // player, whose resume opens a new grant, so the unattended sign-in never outlives its use.
            boolean unattended = LIVE.contains(row.getStatus())
                    || ("paused".equals(row.getStatus()) && "limits".equals(row.getPauseReason()));
            if (!unattended) revokeGrant(row);
            row.setRevision(row.getRevision() + 1);
            return internal(factories.saveAndFlush(row));
        }

        @Transactional
        public StepPayload openStep(UUID factoryId, OpenStep input) {
            factory(factoryId);
            require(ROLES, input.role(), "step role");
            var existing = steps.findById(input.id());
            if (existing.isPresent()) {
                if (!existing.get().getFactoryId().equals(factoryId)) {
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Step not found");
                }
                return step(existing.get());
            }
            var row = new Step();
            row.setId(input.id());
            row.setFactoryId(factoryId);
            row.setRole(input.role());
            row.setPhaseId(input.phaseId());
            row.setMilestoneId(input.milestoneId());
            row.setSessionId(input.sessionId());
            row.setBranch(input.branch());
            row.setModel(input.model());
            row.setBaseCommit(input.baseCommit());
            row.setStatus("running");
            row.setStartedAt(now());
            return step(steps.save(row));
        }

        @Transactional
        public StepPayload updateStep(UUID factoryId, UUID stepId, UpdateStep input) {
            require(STEP_STATUSES, input.status(), "step status");
            var row = steps.findById(stepId).filter(found -> found.getFactoryId().equals(factoryId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Step not found"));
            // The first outcome wins: a late update or a reconcile never rewrites a finished step.
            if (row.getFinishedAt() != null) return step(row);
            if (input.sessionId() != null) row.setSessionId(input.sessionId());
            if (input.summary() != null) row.setSummary(input.summary());
            if (input.headCommit() != null) row.setHeadCommit(input.headCommit());
            if (input.peakContextPercent() != null) row.setPeakContextPercent(input.peakContextPercent());
            row.setStatus(input.status());
            if (!"running".equals(input.status())) row.setFinishedAt(now());
            return step(row);
        }

        @Transactional
        public int interruptOrphans(Set<UUID> active) {
            var orphans = steps.findByFinishedAtIsNullAndStartedAtBefore(now().minus(SETTLING)).stream()
                    .filter(row -> !active.contains(row.getId())).toList();
            orphans.forEach(row -> {
                row.setStatus("interrupted");
                row.setFinishedAt(now());
            });
            return orphans.size();
        }

        @Transactional
        public ChangeRequestPayload updateChangeRequest(UUID factoryId, UUID changeRequestId, UpdateChangeRequest input) {
            require(CHANGE_STATUSES, input.status(), "change request status");
            var row = changes.findById(changeRequestId).filter(found -> found.getFactoryId().equals(factoryId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Change request not found"));
            row.setStatus(input.status());
            if (input.scopeLevel() != null) row.setScopeLevel(input.scopeLevel());
            if (input.analysis() != null) row.setAnalysis(input.analysis());
            row.setResolvedAt(Set.of("applied", "rejected").contains(input.status()) ? now() : null);
            return change(row);
        }

        private Factory owned(UUID projectId, UUID playerId) {
            return factories.findByProjectId(projectId).filter(row -> row.getPlayerId().equals(playerId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NOT_FOUND));
        }

        private Factory factory(UUID factoryId) {
            return factories.findById(factoryId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, NOT_FOUND));
        }

        private void revokeGrant(Factory row) {
            if (row.getGrantSessionId() == null) return;
            auth.revokeDelegatedSession(row.getGrantSessionId());
            row.setGrantSessionId(null);
        }

        private InternalFactory internal(Factory row) {
            return new InternalFactory(row.getPlayerId(), row.getGrantSessionId() != null, payload(row));
        }

        private FactoryPayload payload(Factory row) {
            var run = row.getRunProvider() == null ? null : new RunConfig(row.getRunProvider(),
                    row.getRunConnectionId(), row.getRunAdapter(), row.getRunModel(), row.getRunEffort());
            var active = steps.findFirstByFactoryIdAndFinishedAtIsNullOrderByStartedAtDesc(row.getId())
                    .map(FactoryService::step).orElse(null);
            int open = changes.countByFactoryIdAndStatusIn(row.getId(), OPEN_CHANGES);
            return new FactoryPayload(row.getId(), row.getProjectId(), row.getStatus(), row.getPauseReason(),
                    row.getAttention(), run, row.getChatSessionId(),
                    row.getPlanSnapshot() == null ? null : parse(row.getPlanSnapshot()), row.getPlanCommit(),
                    active, open, row.getRevision(), row.getCreatedAt(), row.getUpdatedAt());
        }

        private static JsonNode parse(String json) {
            try {
                return JsonMapper.shared().readTree(json);
            } catch (RuntimeException invalid) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The plan snapshot is not valid JSON");
            }
        }

        private static StepPayload step(Step row) {
            return new StepPayload(row.getId(), row.getRole(), row.getPhaseId(), row.getMilestoneId(),
                    row.getSessionId(), row.getBranch(), row.getModel(), row.getBaseCommit(), row.getHeadCommit(),
                    row.getStatus(), row.getSummary(), row.getPeakContextPercent(), row.getStartedAt(),
                    row.getFinishedAt());
        }

        private static ChangeRequestPayload change(ChangeRequest row) {
            return new ChangeRequestPayload(row.getId(), row.getNumber(), row.getText(), row.getStatus(),
                    row.isScopeLevel(), row.getAnalysis(), row.getCreatedAt(), row.getResolvedAt());
        }

        private static void require(Set<String> allowed, String value, String what) {
            if (!allowed.contains(value)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid " + what);
            }
        }

        private static OffsetDateTime now() {
            return OffsetDateTime.now(ZoneOffset.UTC);
        }
    }

    // --- persistence ---

    @Getter @Setter @NoArgsConstructor
    @Entity(name = "Factory")
    @Table(name = "factories")
    public static class Factory extends Db.Auditable {
        @Id @Column(name = "id") private UUID id;
        @Column(name = "project_id", nullable = false, updatable = false) private UUID projectId;
        @Column(name = "player_id", nullable = false, updatable = false) private UUID playerId;
        @Column(name = "status", nullable = false) private String status;
        @Column(name = "pause_reason") private String pauseReason;
        @Column(name = "attention") private String attention;
        @Column(name = "run_provider") private String runProvider;
        @Column(name = "run_connection_id") private String runConnectionId;
        @Column(name = "run_adapter") private String runAdapter;
        @Column(name = "run_model") private String runModel;
        @Column(name = "run_effort") private String runEffort;
        @Column(name = "chat_session_id") private UUID chatSessionId;
        @Column(name = "grant_session_id") private UUID grantSessionId;
        @Column(name = "plan_snapshot", columnDefinition = "text") private String planSnapshot;
        @Column(name = "plan_commit") private String planCommit;
        @Column(name = "revision", nullable = false) private Long revision;
    }

    @Getter @Setter @NoArgsConstructor
    @Entity(name = "FactoryStep")
    @Table(name = "factory_steps")
    public static class Step {
        @Id @Column(name = "id") private UUID id;
        @Column(name = "factory_id", nullable = false, updatable = false) private UUID factoryId;
        @Column(name = "role", nullable = false) private String role;
        @Column(name = "phase_id") private String phaseId;
        @Column(name = "milestone_id") private String milestoneId;
        @Column(name = "session_id") private UUID sessionId;
        @Column(name = "branch") private String branch;
        @Column(name = "model") private String model;
        @Column(name = "base_commit") private String baseCommit;
        @Column(name = "head_commit") private String headCommit;
        @Column(name = "status", nullable = false) private String status;
        @Column(name = "summary") private String summary;
        @Column(name = "peak_context_percent") private Integer peakContextPercent;
        @Column(name = "started_at", nullable = false) private OffsetDateTime startedAt;
        @Column(name = "finished_at") private OffsetDateTime finishedAt;
    }

    @Getter @Setter @NoArgsConstructor
    @Entity(name = "FactoryChangeRequest")
    @Table(name = "factory_change_requests")
    public static class ChangeRequest {
        @Id @Column(name = "id") private UUID id;
        @Column(name = "factory_id", nullable = false, updatable = false) private UUID factoryId;
        @Column(name = "number", nullable = false, updatable = false) private int number;
        @Column(name = "text", nullable = false) private String text;
        @Column(name = "status", nullable = false) private String status;
        @Column(name = "scope_level", nullable = false) private boolean scopeLevel;
        @Column(name = "analysis") private String analysis;
        @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
        @Column(name = "resolved_at") private OffsetDateTime resolvedAt;
    }

    @Getter @NoArgsConstructor
    @Entity(name = "FactoryProject")
    @Table(name = "projects")
    public static class ProjectReference {
        @Id @Column(name = "id") private UUID id;
        @Column(name = "player_id") private UUID playerId;
    }

    public interface FactoryRepository extends JpaRepository<Factory, UUID> {
        Optional<Factory> findByProjectId(UUID projectId);
        List<Factory> findByPlayerId(UUID playerId);

        @Query("select f from Factory f where f.status in ('running', 'pausing')"
                + " or (f.status = 'paused' and f.pauseReason = 'limits')")
        List<Factory> findActive();
    }

    public interface StepRepository extends JpaRepository<Step, UUID> {
        List<Step> findByFactoryIdOrderByStartedAtDesc(UUID factoryId, Limit limit);
        List<Step> findByFactoryIdAndStartedAtBeforeOrderByStartedAtDesc(UUID factoryId, OffsetDateTime before,
                                                                         Limit limit);
        Optional<Step> findFirstByFactoryIdAndFinishedAtIsNullOrderByStartedAtDesc(UUID factoryId);
        List<Step> findByFinishedAtIsNullAndStartedAtBefore(OffsetDateTime cutoff);
    }

    public interface ChangeRequestRepository extends JpaRepository<ChangeRequest, UUID> {
        List<ChangeRequest> findByFactoryIdOrderByNumberDesc(UUID factoryId);
        int countByFactoryIdAndStatusIn(UUID factoryId, Set<String> statuses);

        @Query("select coalesce(max(c.number), 0) from FactoryChangeRequest c where c.factoryId = :factoryId")
        int maxNumber(@Param("factoryId") UUID factoryId);
    }

    public interface ProjectRepository extends JpaRepository<ProjectReference, UUID> {
        boolean existsByIdAndPlayerId(UUID id, UUID playerId);
    }
}
