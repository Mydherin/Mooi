package dev.mooi.mic.features;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import dev.mooi.mic.shared.Db;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

/**
 * Feature: landing highlights.
 *
 * <p>Self-contained by architecture: API, application logic, persistence and contracts live in this
 * single file and may only import transversal aspects from {@code shared}.
 */
@Slf4j
@RestController
@RequestMapping("/api/landing/highlights")
@RequiredArgsConstructor
public class LandingFeature {

    private final HighlightService highlightService;

    @GetMapping
    public List<HighlightResponse> list(@RequestParam(defaultValue = "true") boolean onlyPublished) {
        return highlightService.list(onlyPublished);
    }

    @GetMapping("/{slug}")
    public HighlightResponse bySlug(@PathVariable String slug) {
        return highlightService.bySlug(slug);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HighlightResponse create(@Valid @RequestBody CreateHighlightRequest request) {
        return highlightService.create(request);
    }

    // --- application ---

    @Slf4j
    @Service
    @RequiredArgsConstructor
    public static class HighlightService {

        private final HighlightRepository highlightRepository;

        @Transactional(readOnly = true)
        public List<HighlightResponse> list(boolean onlyPublished) {
            List<Highlight> highlights = onlyPublished
                    ? highlightRepository.findAllByPublishedTrueOrderByDisplayOrderAsc()
                    : highlightRepository.findAllByOrderByDisplayOrderAsc();
            return highlights.stream().map(HighlightService::toResponse).toList();
        }

        @Transactional(readOnly = true)
        public HighlightResponse bySlug(String slug) {
            return highlightRepository.findBySlug(slug)
                    .map(HighlightService::toResponse)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Highlight not found: " + slug));
        }

        @Transactional
        public HighlightResponse create(CreateHighlightRequest request) {
            if (highlightRepository.existsBySlug(request.slug())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Highlight already exists: " + request.slug());
            }
            Highlight highlight = new Highlight();
            highlight.setSlug(request.slug());
            highlight.setTitle(request.title());
            highlight.setDescription(request.description());
            highlight.setIcon(request.icon());
            highlight.setDisplayOrder(request.displayOrder());
            highlight.setPublished(request.published());
            Highlight saved = highlightRepository.save(highlight);
            log.info("Created landing highlight {}", saved.getSlug());
            return toResponse(saved);
        }

        private static HighlightResponse toResponse(Highlight highlight) {
            return new HighlightResponse(highlight.getId(), highlight.getSlug(), highlight.getTitle(),
                    highlight.getDescription(), highlight.getIcon(), highlight.getDisplayOrder(),
                    highlight.isPublished(), highlight.getCreatedAt(), highlight.getUpdatedAt());
        }
    }

    // --- persistence ---

    @Getter
    @Setter
    @NoArgsConstructor
    @Entity
    @Table(name = "landing_highlight")
    public static class Highlight extends Db.Auditable {

        @Id
        @GeneratedValue
        @Column(name = "id", nullable = false, updatable = false)
        private UUID id;

        @Column(name = "slug", nullable = false, unique = true, length = 64)
        private String slug;

        @Column(name = "title", nullable = false, length = 120)
        private String title;

        @Column(name = "description", nullable = false, length = 280)
        private String description;

        @Column(name = "icon", nullable = false, length = 48)
        private String icon;

        @Column(name = "display_order", nullable = false)
        private int displayOrder;

        @Column(name = "published", nullable = false)
        private boolean published;
    }

    public interface HighlightRepository extends JpaRepository<Highlight, UUID> {

        List<Highlight> findAllByPublishedTrueOrderByDisplayOrderAsc();

        List<Highlight> findAllByOrderByDisplayOrderAsc();

        java.util.Optional<Highlight> findBySlug(String slug);

        boolean existsBySlug(String slug);
    }

    // --- contracts ---

    public record HighlightResponse(UUID id, String slug, String title, String description, String icon,
                                    int displayOrder, boolean published, OffsetDateTime createdAt,
                                    OffsetDateTime updatedAt) {
    }

    public record CreateHighlightRequest(@NotBlank @Size(max = 64) String slug,
                                         @NotBlank @Size(max = 120) String title,
                                         @NotBlank @Size(max = 280) String description,
                                         @NotBlank @Size(max = 48) String icon,
                                         @PositiveOrZero int displayOrder,
                                         boolean published) {
    }
}
