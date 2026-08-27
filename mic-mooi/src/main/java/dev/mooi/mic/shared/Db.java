package dev.mooi.mic.shared;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

/**
 * Transversal aspect: persistence infrastructure.
 *
 * <p>Enables JPA auditing on a UTC clock and exposes the auditable mapped superclass every feature
 * entity extends. Schema ownership belongs to Liquibase; JPA only validates it.
 *
 * <p>Repository interfaces are nested inside each single-file feature, so repository scanning must
 * consider nested interfaces explicitly; Spring Data skips them by default.
 */
@Configuration
@EnableJpaAuditing(dateTimeProviderRef = Db.DATE_TIME_PROVIDER)
@EnableJpaRepositories(basePackages = "dev.mooi.mic.features", considerNestedRepositories = true)
public class Db {

    public static final String DATE_TIME_PROVIDER = "dbUtcDateTimeProvider";

    @Bean(DATE_TIME_PROVIDER)
    DateTimeProvider dbUtcDateTimeProvider() {
        return () -> Optional.of(OffsetDateTime.now(ZoneOffset.UTC));
    }

    /** Audited columns shared by every persisted entity. */
    @Getter
    @Setter
    @MappedSuperclass
    @EntityListeners(AuditingEntityListener.class)
    public abstract static class Auditable {

        @CreatedDate
        @Column(name = "created_at", nullable = false, updatable = false)
        private OffsetDateTime createdAt;

        @LastModifiedDate
        @Column(name = "updated_at", nullable = false)
        private OffsetDateTime updatedAt;
    }
}
