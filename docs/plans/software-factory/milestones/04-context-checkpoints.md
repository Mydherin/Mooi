---
id: 04-context-checkpoints
status: planned
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

- [ ] Usage hook in `record()` for factory sessions → runner
- [ ] Soft-limit flow: interrupt → wait for READY → checkpoint brief
- [ ] Hard limit and timeout
- [ ] Safety commit and push helper in `Workspaces` (`checkpoint_commit`)
- [ ] Recovery brief selection
- [ ] Settings + `.env.example`
- [ ] Checks: `uvx ruff check src`, import check

## Acceptance

- A builder step reaching 20% ends with a commit on the pushed milestone branch and a rewritten *State*,
  and the next step starts in a new session.
- Killing the agent mid-checkpoint still leaves every change committed and pushed.
- The journal shows `peak_context_percent` for each step, around 20–22% in normal runs.

## State

Not started.

## Log
