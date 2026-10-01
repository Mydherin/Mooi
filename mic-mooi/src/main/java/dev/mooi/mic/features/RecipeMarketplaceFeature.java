package dev.mooi.mic.features;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.hibernate.annotations.Immutable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import org.yaml.snakeyaml.error.YAMLException;

import dev.mooi.mic.shared.Auth;
import dev.mooi.mic.shared.Crypto;
import dev.mooi.mic.shared.Db;
import dev.mooi.mic.shared.Github;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;

/**
 * Feature: recipe marketplaces — GitHub repositories of reusable implementation recipes.
 *
 * <p>A marketplace is a repository with one {@code recipes/} folder of Markdown files, each one a
 * technology-agnostic recipe with a YAML front matter carrying its {@code name} and
 * {@code description}. A player links as many marketplaces as they like; a session then applies a
 * recipe by sending its content to the agent as a prompt.
 *
 * <p>Like a project, a marketplace is a reference, never a copy: the table holds the repository's
 * identity and the recipes are read live, with the player's own GitHub grant, every time they are
 * browsed. That grant is the authorization rule — a private marketplace is reachable exactly as long
 * as the player can read it on GitHub. Recipe files are cached by their git blob hash only, which is
 * content-addressed: a cache hit can never serve a stale or foreign version of a file.
 *
 * <p>Self-contained by architecture: API, application logic, persistence and contracts live in this
 * single file and may only import transversal aspects from {@code shared}.
 */
@RestController
@RequiredArgsConstructor
public class RecipeMarketplaceFeature {

    private final RecipeMarketplaceService recipeMarketplaceService;

    @GetMapping("/me/recipe-marketplaces")
    @Auth.Authenticated
    public MarketplacesResponse marketplaces(Auth.Principal principal) {
        return new MarketplacesResponse(recipeMarketplaceService.list(principal.player().id()));
    }

    /** 201 with the linked marketplace: the SPA inserts the answer instead of reloading the list. */
    @PostMapping("/me/recipe-marketplaces")
    @Auth.Authenticated
    @ResponseStatus(HttpStatus.CREATED)
    public MarketplacePayload addMarketplace(@Valid @RequestBody AddMarketplaceRequest request,
                                             Auth.Principal principal) {
        return recipeMarketplaceService.add(principal.player().id(), request.url());
    }

    @DeleteMapping("/me/recipe-marketplaces/{marketplaceId}")
    @Auth.Authenticated
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMarketplace(@PathVariable UUID marketplaceId, Auth.Principal principal) {
        recipeMarketplaceService.remove(principal.player().id(), marketplaceId);
    }

    /** Read live from GitHub: the marketplace's repository is the only source of truth for its recipes. */
    @GetMapping("/me/recipe-marketplaces/{marketplaceId}/recipes")
    @Auth.Authenticated
    public RecipesResponse recipes(@PathVariable UUID marketplaceId, Auth.Principal principal) {
        return new RecipesResponse(recipeMarketplaceService.recipes(principal.player().id(), marketplaceId));
    }

    // --- application ---

    /**
     * Linking, unlinking and reading marketplaces, always scoped to the calling player and always
     * through their own GitHub grant.
     */
    @Service
    @RequiredArgsConstructor
    public static class RecipeMarketplaceService {

        static final String RECIPES_FOLDER = "recipes";
        private static final int MAX_RECIPES = 200;
        private static final long MAX_RECIPE_BYTES = 64 * 1024;
        /** Well under GitHub's secondary limit on concurrent requests, however large the marketplace. */
        private static final int MAX_PARALLEL_READS = 16;
        private static final Pattern REPOSITORY_REFERENCE = Pattern.compile(
                "^(?:(?:https?://)?(?:www\\.)?github\\.com/)?([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100}?)(?:\\.git)?(?:/.*)?$");

        private final RecipeMarketplaceRepository marketplaceRepository;
        private final MarketplaceGithubAccountRepository linkedAccountRepository;
        private final RecipeContentCache contentCache;
        private final Github.OAuthClient oauthClient;
        private final Crypto.SecretBox secretBox;
        private final Clock clock;

        /** Most recently linked first, like every other list of references in the workspace. */
        @Transactional(readOnly = true)
        public List<MarketplacePayload> list(UUID playerId) {
            return marketplaceRepository.findByPlayerIdOrderByAddedAtDesc(playerId).stream()
                    .map(RecipeMarketplaceService::toPayload)
                    .toList();
        }

        /**
         * Links a repository as a marketplace once GitHub confirms two things with the player's own
         * token: that they can read it, and that it has a {@code recipes/} folder. A repository
         * without one is refused up front rather than linked as an empty marketplace.
         */
        @Transactional
        public MarketplacePayload add(UUID playerId, String url) {
            Matcher reference = REPOSITORY_REFERENCE.matcher(url.strip());
            if (!reference.matches()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Use a GitHub repository URL like https://github.com/owner/repository");
            }
            String token = accessToken(playerId);
            Github.Repository repository = oauthClient.fetchRepository(reference.group(1), reference.group(2), token);
            if (marketplaceRepository.findByPlayerIdAndGithubRepoId(playerId, repository.id()).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This marketplace is already linked");
            }
            recipeEntries(repository.owner(), repository.name(), token);

            RecipeMarketplace marketplace = new RecipeMarketplace();
            marketplace.setPlayerId(playerId);
            marketplace.setGithubRepoId(repository.id());
            marketplace.setOwner(repository.owner());
            marketplace.setName(repository.name());
            marketplace.setFullName(repository.fullName());
            marketplace.setDescription(repository.description());
            marketplace.setPrivateRepository(repository.isPrivate());
            marketplace.setDefaultBranch(repository.defaultBranch());
            marketplace.setHtmlUrl(repository.htmlUrl());
            marketplace.setAddedAt(OffsetDateTime.now(clock));
            RecipeMarketplace saved = marketplaceRepository.save(marketplace);
            Github.LOG.info("Player {} linked recipe marketplace {}", playerId, repository.fullName());
            return toPayload(saved);
        }

        /** Unlinks the reference only; the repository on GitHub is never touched. */
        @Transactional
        public void remove(UUID playerId, UUID marketplaceId) {
            RecipeMarketplace marketplace = owned(playerId, marketplaceId);
            marketplaceRepository.delete(marketplace);
            Github.LOG.info("Player {} unlinked recipe marketplace {}", playerId, marketplace.getFullName());
        }

        /**
         * Every recipe of a marketplace, sorted by name.
         *
         * <p>One directory listing, then the files the cache does not already hold, fetched in
         * parallel on virtual threads: a repeat read of an unchanged marketplace costs one GitHub
         * call however many recipes it carries. Oversized and non-Markdown files are skipped
         * rather than failing the whole marketplace. Not transactional: no database connection is
         * held while GitHub answers.
         */
        public List<RecipePayload> recipes(UUID playerId, UUID marketplaceId) {
            RecipeMarketplace marketplace = owned(playerId, marketplaceId);
            String token = accessToken(playerId);
            List<Github.ContentEntry> entries = recipeEntries(marketplace.getOwner(), marketplace.getName(), token)
                    .stream()
                    .filter(entry -> entry.isFile() && entry.name().toLowerCase(Locale.ROOT).endsWith(".md"))
                    .filter(entry -> entry.size() <= MAX_RECIPE_BYTES)
                    .sorted(Comparator.comparing(Github.ContentEntry::name))
                    .limit(MAX_RECIPES)
                    .toList();
            List<RecipePayload> recipes = new ArrayList<>();
            for (Map.Entry<Github.ContentEntry, String> file : read(marketplace, entries, token).entrySet()) {
                recipes.add(toRecipe(marketplace, file.getKey(), file.getValue()));
            }
            recipes.sort(Comparator.comparing(recipe -> recipe.name().toLowerCase(Locale.ROOT)));
            return recipes;
        }

        private Map<Github.ContentEntry, String> read(RecipeMarketplace marketplace, List<Github.ContentEntry> entries,
                                                      String token) {
            Map<Github.ContentEntry, Future<String>> pending = new LinkedHashMap<>();
            Semaphore permits = new Semaphore(MAX_PARALLEL_READS);
            try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
                for (Github.ContentEntry entry : entries) {
                    pending.put(entry, executor.submit(() -> contentCache.get(entry.sha()).orElseGet(() -> {
                        permits.acquireUninterruptibly();
                        try {
                            String content = oauthClient.readFile(marketplace.getOwner(), marketplace.getName(),
                                    entry.path(), token);
                            contentCache.put(entry.sha(), content);
                            return content;
                        } finally {
                            permits.release();
                        }
                    })));
                }
            }
            Map<Github.ContentEntry, String> contents = new LinkedHashMap<>();
            pending.forEach((entry, future) -> contents.put(entry, await(future)));
            return contents;
        }

        private static String await(Future<String> future) {
            try {
                return future.get();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw Github.GithubException.unavailable("reading a recipe was interrupted");
            } catch (ExecutionException exception) {
                if (exception.getCause() instanceof ResponseStatusException status) {
                    throw status;
                }
                throw Github.GithubException.unavailable("reading a recipe failed: " + exception.getMessage());
            }
        }

        /** A missing folder is worded as what it means here: the repository is not a marketplace. */
        private List<Github.ContentEntry> recipeEntries(String owner, String name, String token) {
            try {
                return oauthClient.listDirectory(owner, name, RECIPES_FOLDER, token);
            } catch (ResponseStatusException exception) {
                if (exception.getStatusCode().value() == HttpStatus.NOT_FOUND.value()) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT,
                            "This repository has no recipes folder, so it is not a recipe marketplace");
                }
                throw exception;
            }
        }

        private RecipeMarketplace owned(UUID playerId, UUID marketplaceId) {
            return marketplaceRepository.findByIdAndPlayerId(marketplaceId, playerId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Marketplace not found"));
        }

        /** Read-only, like every feature that borrows the GitHub grant: renewal stays with the connection. */
        private String accessToken(UUID playerId) {
            MarketplaceGithubAccount account = linkedAccountRepository.findByPlayerId(playerId)
                    .orElseThrow(Github.GithubException::reauthorize);
            OffsetDateTime expiresAt = account.getAccessTokenExpiresAt();
            if (expiresAt != null && !expiresAt.isAfter(OffsetDateTime.now(clock))) {
                throw Github.GithubException.reauthorize();
            }
            return secretBox.decrypt(account.getAccessToken());
        }

        private static RecipePayload toRecipe(RecipeMarketplace marketplace, Github.ContentEntry entry, String raw) {
            String slug = entry.name().substring(0, entry.name().length() - ".md".length());
            FrontMatter frontMatter = FrontMatter.parse(raw);
            String name = frontMatter.value("name").orElseGet(() -> humanize(slug));
            String branch = marketplace.getDefaultBranch() == null ? "HEAD" : marketplace.getDefaultBranch();
            String htmlUrl = marketplace.getHtmlUrl() == null ? null
                    : marketplace.getHtmlUrl() + "/blob/" + branch + "/" + entry.path();
            return new RecipePayload(slug, entry.path(), name, frontMatter.value("description").orElse(null),
                    frontMatter.body(), htmlUrl);
        }

        /** {@code google_sso_login} reads as "Google sso login" when a recipe declares no name. */
        private static String humanize(String slug) {
            String spaced = slug.replaceAll("[_-]+", " ").strip();
            return spaced.isEmpty() ? slug : Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
        }

        private static MarketplacePayload toPayload(RecipeMarketplace marketplace) {
            return new MarketplacePayload(marketplace.getId(), marketplace.getOwner(), marketplace.getName(),
                    marketplace.getFullName(), marketplace.getDescription(), marketplace.isPrivateRepository(),
                    marketplace.getDefaultBranch(), marketplace.getHtmlUrl(), marketplace.getAddedAt());
        }
    }

    /**
     * A recipe's YAML front matter and the Markdown after it.
     *
     * <p>Parsed with SnakeYAML's safe constructor, which builds plain maps and scalars only. A file
     * without front matter, or with an unreadable one, is still a recipe: its whole text is the body
     * and its name comes from the file name.
     */
    record FrontMatter(Map<String, Object> values, String body) {

        private static final Pattern BLOCK = Pattern.compile(
                "\\A\\uFEFF?---\\s*\\R(.*?)\\R---\\s*(?:\\R|\\z)(.*)\\z", Pattern.DOTALL);

        static FrontMatter parse(String raw) {
            Matcher block = BLOCK.matcher(raw);
            if (!block.matches()) {
                return new FrontMatter(Map.of(), raw.strip());
            }
            try {
                Object loaded = new Yaml(new SafeConstructor(new LoaderOptions())).load(block.group(1));
                if (loaded instanceof Map<?, ?> map) {
                    Map<String, Object> values = new LinkedHashMap<>();
                    map.forEach((key, value) -> values.put(String.valueOf(key), value));
                    return new FrontMatter(values, block.group(2).strip());
                }
            } catch (YAMLException exception) {
                Github.LOG.debug("Ignoring an unreadable recipe front matter: {}", exception.getMessage());
            }
            return new FrontMatter(Map.of(), block.group(2).strip());
        }

        Optional<String> value(String key) {
            Object value = values.get(key);
            if (value == null) {
                return Optional.empty();
            }
            String text = String.valueOf(value).strip();
            return text.isEmpty() ? Optional.empty() : Optional.of(text);
        }
    }

    /**
     * Recipe texts by git blob hash, least recently used evicted first. A blob hash names exactly
     * one content, so entries never need invalidating — only bounding.
     */
    @Component
    static class RecipeContentCache {

        private static final int CAPACITY = 1_000;

        private final Map<String, String> entries = new LinkedHashMap<>(64, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, String> eldest) {
                return size() > CAPACITY;
            }
        };

        synchronized Optional<String> get(String sha) {
            return sha == null ? Optional.empty() : Optional.ofNullable(entries.get(sha));
        }

        synchronized void put(String sha, String content) {
            if (sha != null) {
                entries.put(sha, content);
            }
        }
    }

    // --- persistence ---

    /** A GitHub repository linked as a recipe marketplace, held by reference like a project. */
    @Getter
    @Setter
    @NoArgsConstructor
    @Entity(name = "RecipeMarketplace")
    @Table(name = "recipe_marketplaces")
    public static class RecipeMarketplace extends Db.Auditable {

        @Id
        @GeneratedValue
        @Column(name = "id", nullable = false, updatable = false)
        private UUID id;

        @Column(name = "player_id", nullable = false, updatable = false)
        private UUID playerId;

        /** GitHub's numeric id: the duplicate check survives a rename upstream. */
        @Column(name = "github_repo_id", nullable = false, updatable = false)
        private long githubRepoId;

        @Column(name = "owner", nullable = false, length = 128)
        private String owner;

        @Column(name = "name", nullable = false, length = 128)
        private String name;

        @Column(name = "full_name", nullable = false, length = 255)
        private String fullName;

        @Column(name = "description", length = 1024)
        private String description;

        @Column(name = "is_private", nullable = false)
        private boolean privateRepository;

        @Column(name = "default_branch", length = 128)
        private String defaultBranch;

        @Column(name = "html_url", length = 512)
        private String htmlUrl;

        @Column(name = "added_at", nullable = false, updatable = false)
        private OffsetDateTime addedAt;
    }

    public interface RecipeMarketplaceRepository extends JpaRepository<RecipeMarketplace, UUID> {

        List<RecipeMarketplace> findByPlayerIdOrderByAddedAtDesc(UUID playerId);

        Optional<RecipeMarketplace> findByPlayerIdAndGithubRepoId(UUID playerId, long githubRepoId);

        /** Scoped by player on purpose: an id alone must never be enough to reach somebody's row. */
        Optional<RecipeMarketplace> findByIdAndPlayerId(UUID marketplaceId, UUID playerId);
    }

    /**
     * A read-only view of the connection table owned by {@code GithubConnectionFeature}, mapped again
     * here because a feature may not import another one ({@code @Immutable}: this side only reads).
     */
    @Getter
    @Immutable
    @NoArgsConstructor
    @Entity(name = "RecipeMarketplaceGithubConnection")
    @Table(name = "github_connections")
    public static class MarketplaceGithubAccount {

        @Id
        @Column(name = "id", nullable = false, updatable = false)
        private UUID id;

        @Column(name = "player_id", nullable = false, updatable = false)
        private UUID playerId;

        @Column(name = "access_token", nullable = false, length = 1024)
        private String accessToken;

        @Column(name = "access_token_expires_at")
        private OffsetDateTime accessTokenExpiresAt;
    }

    public interface MarketplaceGithubAccountRepository extends JpaRepository<MarketplaceGithubAccount, UUID> {

        Optional<MarketplaceGithubAccount> findByPlayerId(UUID playerId);
    }

    // --- contracts ---

    /** A repository URL ({@code https://github.com/owner/repo}) or its short {@code owner/repo} form. */
    public record AddMarketplaceRequest(@NotBlank @Size(max = 512) String url) {
    }

    public record MarketplacePayload(UUID id, String owner, String name, String fullName, String description,
                                     boolean isPrivate, String defaultBranch, String htmlUrl,
                                     OffsetDateTime addedAt) {
    }

    public record MarketplacesResponse(List<MarketplacePayload> marketplaces) {
    }

    /**
     * One recipe: its front matter's name and description, its Markdown body, and where it lives.
     * The slug is the snake_case file name without extension — stable, readable and unique per folder.
     */
    public record RecipePayload(String slug, String path, String name, String description, String content,
                                String htmlUrl) {
    }

    public record RecipesResponse(List<RecipePayload> recipes) {
    }
}
