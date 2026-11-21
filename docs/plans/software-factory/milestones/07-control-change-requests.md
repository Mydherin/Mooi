---
id: 07-control-change-requests
status: planned
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

- [ ] Pause (both modes) and resume with mandatory run config, for SPA and agent
- [ ] Limits detection, auto-pause and auto-resume watcher
- [ ] Change requests: endpoints, analyst brief, safe-point scheduling, confirmation flow
- [ ] `attention` resume path
- [ ] Checks: `uvx ruff check src`, import check; `mic-mooi` build if touched

## Acceptance

- Immediate pause during a builder step leaves a pushed safety commit; resume with another model continues
  the same milestone in a fresh session using that model.
- A change request touching a finished phase reopens it with a delta milestone, which is built before the
  loop continues with new work.
- A scope-level change request waits for confirmation and changes nothing until then.

## State

Not started.

## Log
