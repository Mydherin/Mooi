---
id: 05-definition-chat
status: done
depends: [03-orchestrator-core]
context: [mic-sessions]
---

# Milestone 05: Definition and factory chat

## Spec

The human-driven part. It covers the persistent factory chat, the definition flow, the approval gate and
Phase 0 (Foundations).

**Factory chat** (`kind="session"` with a `FactoryBinding` of role `chat`, D3):

- One per project, persistent like the production chat. It runs on the default branch, and a new one
  replaces the previous one.
- `factories.chat_session_id` points to it.
- Its brief (`factory_prompts.chat`) carries the platform API for the factory.
- While the factory is `defining`, the chat is the **architect**. It discusses with the human, then writes
  `VISION.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md` and `FACTORY.md` from the templates, and
  commits them through the plan-commit path (D4).
- After definition, it explains state and discusses. It may change something only through a change request
  (milestone 07) or a pause/resume. It never edits plan files directly once the loop has started.

**Approval gate**:

- `POST /factories/{projectId}/definition/approve` (SPA) and `POST /sessions/{id}/factory/agent/approve`
  (chat agent, only after the human confirms in the conversation) run the same function.
- It validates the docs (`factory_docs.validate`: no issues, at least one phase, Phase 0 present) and moves
  `defining` → `ready`.
- `ready` → `running` happens on the first start (milestone 07 dialog; in this milestone, the start endpoint
  with an explicit run config).

**Phase 0, Foundations**: the architect always puts `00-foundations` first in `ROADMAP.md`. Its milestones
must include:

- the project's technical base;
- the **Mooi dev deployment**: the builder step gets the same brief as the Deploy button (reuse
  `_deployment_prompt`, `sessions.py` ≈3980) and its test.

Production and backups are explicitly excluded in the template.

**Endpoints**:

- `POST /factories/{projectId}/chat` opens or reopens the chat.
- `POST /factories/{projectId}/start` with a run config.

These are the same functions the agent endpoints call (convergence).

## Tasks

- [x] Chat session kind/role handling, replacement rule, `chat_session_id` persistence
- [x] Architect and chat briefs (definition mode, then steering mode)
- [x] Approval: shared function plus SPA and agent endpoints
- [x] Phase 0 rules in the templates; the builder brief embeds the deployment setup brief for the dev
  deployment milestone
- [x] Start endpoint (`ready` → `running`) with run-config validation (reuse `descriptor.prepare` and
  `configure`, as `_open_session` does)
- [x] Checks: `uvx ruff check src`, import check

## Acceptance

- Approving with missing core files is refused with the list of issues.
- After approval, the default branch holds the five core files, and `ROADMAP.md` starts with
  `00-foundations`.
- The chat agent cannot approve without an explicit human confirmation in the conversation (brief rule) and
  cannot edit plan files once the factory is running.

## State

Done (session 3). Code complete and checked; the *Acceptance* scenarios are verified manually by the user
(the SPA entry points arrive with milestone 08; until then the endpoints are callable directly).

What exists (`features/factories.py`, section *operations*, then *player API* and *agent API*):

- `open_chat(caller, project_id, ChatRequest)`: creates the factory on first use (`mooi.create_factory`),
  closes the previous chat (`_bound(..., "chat")`), opens a `kind="session"` session on the default branch
  with `FactoryBinding(factory_id, "chat")` and the brief as `initialMessage` (`architect_brief(request)`
  while `defining`, `steering_brief(request)` otherwise), then stores `chatSessionId` (one retry on 409).
- `approve_definition`: `defining` only; reads the default branch through `_read_plan` (control checkout,
  under the per-factory `_checkout_lock`, also used by the runner) and answers
  `{approved, issues, factory}`: issues from `factory_docs.definition_issues`, else `ready` with the plan
  snapshot.
- `start_factory(RunConfigRequest)`: `ready` only; `_run_config` validates with `describe` → `prepare` →
  `configure` and stores the resolved selection; `mooi.grant_factory`, then `running`, then `launch`.
- `delete_factory`: refused while `running`/`pausing`; deletes in mic-mooi, closes every bound session,
  removes the control checkout, publishes `factory.updated` with `factory: null`.
- Endpoints: `POST /factories/{projectId}/chat` (201), `POST /factories/{projectId}/definition/approve`,
  `POST /factories/{projectId}/start`, `DELETE /factories/{projectId}`; chat agent
  `POST /sessions/{id}/factory/agent/publish` (`defining` only, `sessions.publish_repository` = the
  platform-chat squash onto the default branch) and `POST /sessions/{id}/factory/agent/approve`.
- Every player-side write goes through `_write` (revision of the payload read, `factory.updated`
  published); the runner's own writes still use `FactoryRunner._save`.
- Prompts: `steering_brief(request=None)`; the planner brief of `00-foundations` requires the technical base
  and, for web applications, a dev deployment milestone; the builder's deployment section applies only when
  the milestone's *Spec* sets up the deployment.

Local decisions (session 3):

- The chat is `kind="session"` with role `chat` (D3), not a `kind="factory"` as the spec first said.
- The builder brief does not inline the Deploy button's brief (it is long and costs context in every
  foundations session); the agent `GET`s the same brief from its standing instructions when its milestone
  sets the deployment up. Same brief, same test, so convergence holds.
- Approval answers its issues with 200 `{approved: false}` instead of an error, so the chat and the SPA show
  them as a checklist.
- The "ready → running" start lives here; starting from `paused`, pause and resume are milestone 07
  (`agent_api(chat=True)` already documents `pause`/`resume`/`change-requests`, which 07 must add).

## Log

- Session 3: chat, approval, start and delete operations with SPA and agent endpoints; Phase 0 brief rules.
  Ruff: no new findings; import check passes.
