---
id: 01-persistence-identity
status: done
depends: []
context: [mic-mooi]
---

# Milestone 01: Persistence and unattended identity

## Spec

`mic-mooi` becomes the system of record for factories (D1) and issues the factory grant (D2).

**Model** (Liquibase `035-software-factory.yaml`):

- `factories`: `id`, `project_id` (unique, so one factory per project), `player_id` (owner), `status`
  (`defining` · `ready` · `running` · `pausing` · `paused` · `resting`), `pause_reason` (`user` · `limits` ·
  `attention` · `revoked` · `error`, nullable), `run_config` (jsonb: `provider`, `connectionId`, `adapter`,
  `model`, `effort`), `chat_session_id` (nullable), `grant_active` (bool), `revision` (bigint, optimistic
  concurrency), `created_at`, `updated_at`.
- `factory_steps` (the orchestrator journal): `id`, `factory_id`, `role`, `phase_id`, `milestone_id`
  (nullable), `session_id`, `branch`, `base_commit`, `head_commit`, `status` (`running` · `completed` ·
  `continue` · `failed` · `blocked` · `interrupted`), `summary`, `peak_context_percent`, `started_at`,
  `finished_at` (partial index `WHERE finished_at IS NULL`, as in `030`).
- `factory_change_requests`: `id`, `factory_id`, `number` (per factory, shown as `CR-<n>`), `text`, `status`
  (D12), `scope_level` (bool), `analysis` (text), `created_at`, `applied_at`.

**Player API** (`@Authenticated`, owner and project access-checked):

- `GET /me/projects/{id}/factory`: the payload, or 404 when the project has no factory.
- `POST /me/projects/{id}/factory`: enables the factory with status `defining`.
- `DELETE /me/projects/{id}/factory`: only when `paused`, `ready` or `resting`. It removes the platform state
  and never touches the repository.
- `GET /me/projects/{id}/factory/steps?before=<id>`: journal pages of 50.
- `GET/POST /me/projects/{id}/factory/change-requests`.

**Internal API** (`@ServiceCall` / `@ServiceOnly`, for `mic-sessions`):

- `GET /internal/factories/running`: factories with status `running` or `pausing`, for boot resume.
- `PUT /internal/factories/{id}`: status, reason, run config and chat session. The `revision` must match,
  otherwise 409.
- `POST /internal/factories/{id}/steps` and `PUT /internal/factories/{id}/steps/{stepId}`.
- `PUT /internal/factories/{id}/change-requests/{crId}`.
- `POST /internal/factories/{id}/access-token`: mints a short-lived player access token while
  `grant_active` is set and the owner is not banned (D2). Mint it like `AuthFeature` ≈132 does, without a
  device session.

**Revocation**: banning a user and signing them out everywhere (`AdminFeature`, `AuthFeature`) set
`grant_active=false` and `status=paused`, `pause_reason=revoked` on their factories.

## Tasks

- [x] Changelog `035-software-factory.yaml` (tables, foreign keys with cascade on project delete, indexes)
- [x] `FactoryFeature.java`: entities, payloads, player endpoints, `revision` concurrency
- [x] Internal endpoints, including the access-token mint
- [x] Revocation: implemented as a delegated auth session (D2), so the existing ban and sign-out paths
  revoke it; no hooks needed
- [x] `mic-sessions/shared/mooi.py`: client functions for every endpoint; `factory_access(factory_id)` mints
  a caller (the runner caches it and renews before expiry)
- [x] Checks: `./mvnw -q -B -DskipTests compile` passes

## Acceptance

- A project accepts at most one factory; a second `POST` answers 409.
- Another player gets 404 on every endpoint of a factory they do not own.
- Banning the owner pauses their running factories with reason `revoked`; the mint endpoint then refuses.

## State

Done. Notes for later milestones:

- The SPA only reads (`GET /me/factories`, `/me/projects/{id}/factory`, `/steps`, `/change-requests`).
  Every write goes through `mic-sessions`.
- Run config columns are `run_*`; the plan cache is `plan_snapshot`, JSON from `factory_docs.read_plan`.
- `GET /internal/factories/active` also returns factories paused with reason `limits`.

## Log

- Session 1: implemented the changelog, `FactoryFeature`, the delegated session in `AuthService` and the
  `mooi.py` client.
