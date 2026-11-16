package dev.mooi.mic.features;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import dev.mooi.mic.shared.Auth;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;

/** Account-owned preferences for the editable commit title suggested by development sessions. */
@RestController
@RequiredArgsConstructor
public class SuggestedCommitFeature {

    private final SuggestedCommitService service;

    @GetMapping("/me/preferences/suggested-commit")
    @Auth.Authenticated
    public SuggestedCommitPreferences preferences(Auth.Principal principal) {
        return service.get(principal.player().id());
    }

    @PutMapping("/me/preferences/suggested-commit")
    @Auth.Authenticated
    public SuggestedCommitPreferences update(@Valid @RequestBody SuggestedCommitUpdate update,
                                             Auth.Principal principal) {
        return service.save(principal.player().id(), update);
    }

    @Service
    @RequiredArgsConstructor
    public static class SuggestedCommitService {

        private final SuggestedCommitPreferencesRepository repository;

        @Transactional(readOnly = true)
        SuggestedCommitPreferences get(UUID playerId) {
            return repository.findById(playerId).map(SuggestedCommitPreferences::from)
                    .orElseGet(SuggestedCommitPreferences::defaults);
        }

        @Transactional
        SuggestedCommitPreferences save(UUID playerId, SuggestedCommitUpdate update) {
            repository.upsert(playerId, update.enabled(), update.language());
            return new SuggestedCommitPreferences(update.enabled(), update.language());
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @Entity(name = "SuggestedCommitPreference")
    @Table(name = "suggested_commit_preferences")
    public static class SuggestedCommitPreference {

        @Id
        @Column(name = "player_id", nullable = false, updatable = false)
        private UUID playerId;

        @Column(name = "enabled", nullable = false)
        private boolean enabled = true;

        @Column(name = "language", nullable = false, length = 2)
        private String language = "en";
    }

    public interface SuggestedCommitPreferencesRepository extends JpaRepository<SuggestedCommitPreference, UUID> {

        @Modifying
        @Query(value = "insert into suggested_commit_preferences (player_id, enabled, language) "
                + "values (:playerId, :enabled, :language) on conflict (player_id) do update "
                + "set enabled = excluded.enabled, language = excluded.language", nativeQuery = true)
        void upsert(@Param("playerId") UUID playerId, @Param("enabled") boolean enabled,
                    @Param("language") String language);
    }

    public record SuggestedCommitPreferences(boolean enabled, String language) {

        static SuggestedCommitPreferences defaults() {
            return new SuggestedCommitPreferences(true, "en");
        }

        static SuggestedCommitPreferences from(SuggestedCommitPreference preference) {
            return new SuggestedCommitPreferences(preference.isEnabled(), preference.getLanguage());
        }
    }

    public record SuggestedCommitUpdate(@NotNull Boolean enabled,
                                        @NotNull @Pattern(regexp = "en|es") String language) {
    }
}
