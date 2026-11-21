---
id: 07-control-change-requests
status: done
depends: [06-build-test-merge]
context: [mic-sessions, mic-mooi]
---

# Milestone 07: Control: pause, resume, limits, change requests

## Spec

The human can step in at any time without breaking anything (D9, D12).

**Pause**:

- `POST /factories/{projectId}/pause {mode: "graceful" | "immediate"}`.
  - Graceful: status `pausing`; the active step gets the checkpoint brief at its next turn end; then
    `paused` with reason `user`.
  - Immediate: the D7 interrupt path plus the safety commit, then `paused`.
- The chat agent has the same operation at `/sessions/{id}/factory/agent/pause`.

**Resume**:

- `POST /factories/{projectId}/resume {runConfig}`. The run config is **mandatory** at every resume.
- The SPA preselects the last run config, falling back to the admin defaults (`agent_engine_defaults`).
- It reactivates the grant (D2), reconciles (milestone 03) and continues.
- From `attention`, it resumes the parked milestone with its `attempts` reset, after the human has
  discussed or fixed it (in the chat or in a normal session merged to the default branch).

**Provider limits**:

- When a step fails on a quota error, or the quota KPI reports exhaustion, the runner safety-commits and
  pauses with reason `limits`.
- A low-frequency watcher (every 10 minutes, `refresh_usage`-based) resumes it with the **same** run config
  once the quota renews.

**Change requests** (D12):

- `POST /factories/{projectId}/change-requests {text}` (SPA) and `/sessions/{id}/factory/agent/change-requests`
  (chat, after the human decides) create `queued` requests.
- At the next safe point (between steps) the runner opens an `analyst` step on the default branch. It reads
  the plan, the decisions and their `affects`, then:
  - updates the decisions (with `CR-<n>`);
  - reopens the affected phases and milestones as `reopened`, adding delta milestones
    (`<nn>-delta-cr<n>-<slug>`);
  - commits.
- Scope-level impact (it changes `VISION.md` scope) → `awaiting-confirmation`: the factory pauses with
  reason `attention` until the human confirms or rejects in the SPA or the chat.
- After the last phase (`resting`), a change request reactivates the loop. A scope-level one returns to
  `defining` with the chat as architect.

**Consistency**:

- Every transition goes through `PUT /internal/factories/{id}` with `revision` (409 → reload and retry
  once).
- A single runner per factory: an in-process lock, plus `revision` across processes.

## Tasks

- [x] Pause (both modes) and resume with mandatory run config, for SPA and agent
- [x] Limits detection, auto-pause and auto-resume watcher
- [x] Change requests: endpoints, analyst brief, safe-point scheduling, confirmation flow
- [x] `attention` resume path
- [x] Checks: `uvx ruff check src`, import check; `mic-mooi` not touched

## Acceptance

- Immediate pause during a builder step leaves a pushed safety commit; resume with another model continues
  the same milestone in a fresh session using that model.
- A change request touching a finished phase reopens it with a delta milestone, which is built before the
  loop continues with new work.
- A scope-level change request waits for confirmation and changes nothing until then.

## State

Done (session 3). Code complete and checked (ruff: no new findings; import check; pyright clean on the
factory modules, an extra check the project does not configure). *Acceptance* is verified manually by the
user. `mic-mooi` needed no change.

What exists (`features/factories.py`):

- `_Step` now has an optional `target` and a `change` (analyst steps), plus `milestone`, `phase_id`, `key` and
  `label` properties used everywhere instead of `step.target...`; `_run_step(role, target, plan, ..., change=)`.
- Pause: `pause_factory(caller, project_id, mode)`. With a live runner it writes `pausing` and calls
  `FactoryRunner.request_pause`: graceful sets `_Step.pausing` (checkpoint with `pause_message()` at the
  next turn end, or no brief if the step had not started), immediate sets `_Step.stop` (interrupt, safety
  commit, publish). The next `_cycle` writes `paused`/`user`. Without a runner it writes `paused` at once.
  The back-off sleep of `run()` is cut short by `runner.signal`.
- Resume: `resume_factory(caller, project_id, RunConfigRequest | None)`; the player endpoint requires the
  selection, the chat agent may send `{}` for the last one. Validates it like a session (`_run_config`),
  releases a milestone parked in `attention` (`_release_attention`: on its branch, `status: building`,
  `attempts: 0`, a *Log* line, pushed; through `workspaces.factory_branch_checkout`, renamed from the merge
  checkout), opens a new grant, writes `running`, launches.
- Limits: `_quota_exhausted(session.usage["quota"])` (a window at 100 % or `status: rejected`; `resetsAt`
  read by `_epoch`). The observer checks every quota update and a session that ended; a hit sets
  `_Step.limits` and `stop`. `_close` then calls `_pause_for_limits` (pause `limits`, message with the renewal
  time, `_limited[factory_id] = max(reset, now + 600 s)`). `_watch_limits` (in the `_boot` task, every 60 s)
  writes `running` for due factories and launches them with the same selection. A still-limited account stops
  at session start without a brief and pauses again. At boot, factories paused on `limits` are due at once.
- Change requests: `request_change` (refused while `defining`/`ready`; wakes a `resting` factory with a new
  grant) and `decide_change` (only `awaiting-confirmation`: accept → `queued` with `scopeLevel: true`,
  reject → `rejected`). In `_cycle`, after the plan check, open changes are the safe point: an
  `awaiting-confirmation` one pauses `attention` (`_confirmation_message`), else the oldest
  `queued`/`analyzing` runs an `analyst` step (CR set `analyzing`). `_resolve_change` at close: `completed` →
  `applied`, `blocked` → `awaiting-confirmation` + `scopeLevel`, anything else → `queued` again, with the summary
  as `analysis`. `analyst_brief(..., confirmed=)` allows `VISION.md` changes once confirmed.
- Endpoints: player `POST /factories/{projectId}/pause|resume|change-requests|change-requests/{id}/decision`;
  chat agent `POST /sessions/{id}/factory/agent/pause|resume|change-requests|change-requests/{id}/decision`.
  `GET .../factory/agent` adds `changeRequests` for the chat. `agent_api(chat=True)` documents the decision
  call.

Local decisions (session 3):

- A confirmed scope-level change is applied by the analyst (with `VISION.md`) instead of reopening the
  definition: the user's confirmation is the human gate, and the chat stays the place to discuss it. This
  also covers a resting factory. Reopening `defining` stays possible later without changing the contract.
- Limits are retried by resuming and letting the next session's quota KPI decide, so every adapter works
  without provider-specific quota calls; the watcher's renewal time is in memory, and after a restart a
  limited factory is tried at once.
- A decision on a change request never resumes the factory by itself: resuming always names the agent (D9).

## Log

- Session 3: pause/resume (SPA and chat), limits pause and watcher, change requests with the analyst step and
  the confirmation flow, release from attention.
