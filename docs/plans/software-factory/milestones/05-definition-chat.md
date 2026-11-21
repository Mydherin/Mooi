---
id: 05-definition-chat
status: planned
depends: [03-orchestrator-core]
context: [mic-sessions]
---

# Milestone 05: Definition and factory chat

## Spec

The human-driven part. It covers the persistent factory chat, the definition flow, the approval gate and
Phase 0 (Foundations).

**Factory chat** (`kind="factory"`, `factoryRole="chat"`):

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

- [ ] Chat session kind/role handling, replacement rule, `chat_session_id` persistence
- [ ] Architect and chat briefs (definition mode, then steering mode)
- [ ] Approval: shared function plus SPA and agent endpoints
- [ ] Phase 0 rules in the templates; the builder brief embeds the deployment setup brief for the dev
  deployment milestone
- [ ] Start endpoint (`ready` → `running`) with run-config validation (reuse `descriptor.prepare` and
  `configure`, as `_open_session` does)
- [ ] Checks: `uvx ruff check src`, import check

## Acceptance

- Approving with missing core files is refused with the list of issues.
- After approval, the default branch holds the five core files, and `ROADMAP.md` starts with
  `00-foundations`.
- The chat agent cannot approve without an explicit human confirmation in the conversation (brief rule) and
  cannot edit plan files once the factory is running.

## State

Not started.

## Log
