---
id: 04-context-checkpoints
status: done
depends: [03-orchestrator-core]
context: [mic-sessions]
---

# Milestone 04: Context checkpoints

## Spec

Every factory step session stops at 20% of its context window and hands over cleanly (D7). It works the same
for Claude SDK, Claude CLI and Codex, because it relies only on the folded `session.usage` context KPI.

**Detection**:

- In `record()` (`sessions.py` ≈954), after the usage merge, for `kind="factory"` sessions only, notify the
  runner of `context.percent`.
- The runner tracks `peak_context_percent` for the journal.

**Soft limit** (`FACTORY_CONTEXT_SOFT_PERCENT`, default 20), the first time it is crossed:

1. `interrupt_session` (≈1842); wait for READY (`turn.result`).
2. Deliver the `checkpoint` brief in the **same** conversation, under `session.operation_lock`, through
   `_deliver`. The brief says: stop the task, commit, update *State* and *Log* precisely (exact next step,
   files in play, gotchas), push through the outcome call `continue`.

**Hard limit** (`FACTORY_CONTEXT_HARD_PERCENT`, default 30) or `FACTORY_CHECKPOINT_TIMEOUT_SECONDS`
(default 600) during the checkpoint: interrupt again and do not ask anything more.

**Safety commit**, always, before closing any step session (normal end, checkpoint, hard stop, pause,
error):

- If the worktree is dirty, run `git add -A` and commit `chore(factory): checkpoint <role> <target>` with
  the session's git identity.
- Then push the milestone branch (or the plan-commit path on the default branch).
- If the agent did not update *State*, append a `Recovery needed` line to the milestone *Log* in the same
  commit.

**Next session**:

- The runner opens a fresh step for the same target.
- If the previous step ended without a valid `continue`, the brief is `recovery`: inspect
  `git log -3 --stat` and the diff of the safety commit, fix *State*, then continue.

**Settings**: `shared/env.py` gets the three values; document them in `mic-sessions/.env.example`.

## Tasks

- [x] Usage hook in `record()` for factory sessions → runner
- [x] Soft-limit flow: interrupt → wait for READY → checkpoint brief
- [x] Hard limit and timeout
- [x] Safety commit and push helper in `Workspaces` (`checkpoint_commit`; done in milestone 03, also used
  by every step close)
- [x] Recovery brief selection
- [x] Settings + `.env.example`
- [x] Checks: `uvx ruff check src`, import check

## Acceptance

- A builder step reaching 20% ends with a commit on the pushed milestone branch and a rewritten *State*,
  and the next step starts in a new session.
- Killing the agent mid-checkpoint still leaves every change committed and pushed.
- The journal shows `peak_context_percent` for each step, around 20–22% in normal runs.

## State

Done (session 3). Code complete and checked; the *Acceptance* scenarios are verified manually by the user
once milestones 05/07 provide the start endpoints.

What exists:

- Settings `factory_context_soft_percent` (20), `factory_context_hard_percent` (30, must be above soft,
  checked in `get_settings`), `factory_checkpoint_timeout_seconds` (600); documented in `.env.example`.
- `FactoryRunner.observe`: on `session.usage` tracks the peak; the first value at or above soft sets
  `_Step.checkpoint_percent`; during the checkpoint, a value at or above the hard limit sets `_Step.stop`.
- `_await_outcome`: soft → `_checkpoint` (interrupt, wait for READY within the timeout, deliver
  `checkpoint_message` in the same conversation); then waits with the timeout; a stop, the timeout or a
  checkpoint turn ending without an outcome ends the step. `_settle(step, seconds)` lets a turn end, then
  interrupts and waits up to 60 s for READY before the safety commit.
- `_close` → `_flag_recovery`: a milestone step (not merger) without a handover whose milestone file is
  unchanged since `base_commit` (`workspaces.changed_since`) gets a `Recovery needed` line in *Log*
  (`factory_docs.append_log`), committed by the safety commit.
- Next session: `recovery_note()` when the last step had no handover (milestone 03); new `handover_note`
  carries the summary of a valid `continue` to the next session of the same target (plan roles have no
  *State*).

Local decisions (session 3):

- **Late soft crossing**: the hard limit during a checkpoint is `max(hard, crossing percent + (hard -
  soft))`, so a usage jump past hard still leaves the checkpoint its margin.
- **Checkpoint brief refused (409)** because another message got in first: that turn is the checkpoint's
  last chance; when it ends without an outcome the step ends.
- **Handover summaries** live in the runner's memory only; after a restart the recovery note covers it.
- Graceful/immediate pause (milestone 07) should reuse `_checkpoint` / `_Step.stop`.

## Log

- Session 3: settings, usage hook, checkpoint/hard-stop/timeout flow, recovery Log line, handover note.
  Ruff: no new findings; import check passes.
