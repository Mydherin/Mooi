---
id: software-factory
status: open
milestones: [01-persistence-identity, 02-docs-contract, 03-orchestrator-core, 04-context-checkpoints, 05-definition-chat, 06-build-test-merge, 07-control-change-requests, 08-factory-tab, 09-closure, 10-e2e-verification]
---

# Phase: Software Factory

Self-contained plan for implementing the **Software Factory** described in `AGENTS.md` › *Software Factory*.
That section is the functional source of truth; this phase turns it into technical decisions and ordered
milestones. A fresh session resumes from this file plus **one** milestone file: trust them, do not
re-analyze what is decided here, and read only the code anchors a milestone names.

This phase deliberately uses the same layout the factory will generate for user projects
(`PHASE.md` + `milestones/<nn>-<slug>.md` with front matter), so it doubles as the reference example.

## Session protocol

1. Read this file, then the first milestone in front-matter order whose `status` is not `done`.
2. Work its *Tasks* in order. After each task, mark it `[x]`, rewrite *State* (what is done, the exact next
   step, gotchas) and add one line to *Log*. Keep the file truthful at every moment: a session may stop at
   any time.
3. When the context budget is reached, bring the milestone file up to date first, then commit all the
   session's work in one conventional commit (`feat(factory): …`, ending with the attribution lines of the
   system reminder).
4. Decisions below are closed: never reopen them. A new decision is added to *Decisions* (phase-wide) or
   to the milestone (local), with its reason.
5. Verification follows `AGENTS.md` › *Testing*: no programmatic tests. Type checks, linters and builds
   must pass. *Acceptance* scenarios are checked manually by the user unless they explicitly ask the agent
   to test.
6. When a milestone is complete, set its `status: done` and update `milestones` progress in *Milestones*.

## Goal

Large projects can be built autonomously. The human defines scope, base decisions and phases with an agent.
Then a platform-driven loop expands each phase into milestones and builds, tests end to end and merges them
in fresh sessions that stop at 20% of context. The loop runs in the background for days or weeks, can be
paused, resumed and steered at any time, and never leaves the plan or the code inconsistent.

## Current architecture facts (verified, drive the decisions)

- Sessions live **in memory** in `mic-sessions` (`SessionRegistry`, `features/sessions.py` ≈847). A restart
  closes them, and `Workspaces.reconcile` (`shared/workspaces.py` ≈353) deletes their clones at boot.
- Workspaces are full clones per session. A session can start on an existing **remote** branch
  (`create_workspace` ≈243), but nothing pushes session branches: only `Workspaces.merge` (≈440) pushes, as a
  squash fast-forward onto the default branch.
- Platform chats (`kind` production/backup) run on the default branch and commit repository changes through
  `_commit_platform_repository` (`sessions.py` ≈3107), which reuses the merge.
- `mic-mooi` never calls `mic-sessions`; traffic goes `mic-sessions` → `mic-mooi` (`shared/mooi.py`) with the
  player's bearer plus `X-Service-Token`. Long-lived callers renew through `mooi.renewed(caller)` (≈252),
  which is bound to a device auth session.
- Context KPI: runtimes emit `session.usage` `{context: {percent, usedTokens, limitTokens}}` (`agents.py`
  ≈1218 Claude SDK, ≈1910 CLI, ≈2132/≈2315 Codex), folded in `record()` (`sessions.py` ≈922/≈954). One
  provider "turn" (`turn.result`, ≈976) can span hundreds of tool calls.
- Messages are accepted only when READY. `_deliver` (≈1744) is the primitive; `interrupt_session` (≈1842)
  interrupts; `_reset_conversation` (≈2181) gives a fresh runtime on the same workspace.
- Dev deployment setup brief: `_deployment_prompt` (≈3980); `/deployment/agent/brief|start` (≈4387/≈4400).
- Prompts are inline f-strings in `sessions.py` (`_production_prompt` ≈2671, `_conflict_prompt` ≈2162,
  `_session_instructions` ≈2333). The agent platform API is guarded by `_agent_access` (≈2456).
- Realtime: player SSE channel `GET /events` (`_channels.publish(player_id, type, data)`, ≈1483–1489); SPA
  `features/live/lib/applyLiveEvent.ts`, `stores/liveStore.ts`.
- Unfinished-operation pattern in `mic-mooi`: rows with `finished_at IS NULL` and `@ServiceOnly` reconcile
  endpoints (`ProductionDeploymentFeature` ≈85/≈93, changelog `030`). Next changelog number: `035`.
- Admin defaults: `agent_engine_defaults` (`AgentConnectionFeature` ≈122/≈134). SPA model picker:
  `features/sessions/components/AgentModelFields.tsx`.
- No notification mechanism exists yet (only the live channel).

## Decisions (do not reopen)

- **D1 Split of responsibilities.** `mic-mooi` is the system of record: `FactoryFeature` (tables
  `factories`, `factory_steps`, `factory_change_requests`). `mic-sessions` runs the orchestrator
  (`features/factories.py`), because it owns runtimes, workspaces, events and the agent API. It reads and
  writes factory state only through `mic-mooi` internal endpoints. Reason: keeps the existing call direction
  and survives `mic-sessions` restarts.
- **D2 Unattended identity.** A running factory must act for its owner with no device connected.
  - Starting or resuming (`POST /me/projects/{id}/factory/grant`, player present) opens a **delegated auth
    session**: an `auth_sessions` row labelled `Mooi Software Factory`, with no refresh token
    (`AuthService.openDelegatedSession`).
  - `@ServiceOnly POST /internal/factories/{id}/access-token` mints tokens under it and touches it
    (`renewDelegatedAccessToken`), so a run lasting weeks never reaches the idle deadline.
  - Signing out everywhere, a kick or a ban revoke it like any sign-in. The next mint then answers 401, and
    the runner pauses with reason `revoked`. No new hooks in the auth paths were needed.
  - Any pause other than `limits` revokes the grant; resuming opens a new one.

  Reason: `mooi.renewed` depends on a device's sliding session, which an unattended loop must not keep alive.
- **D3 Factory sessions are plain sessions with a binding** (revised in session 1; no new `SessionKind`).
  - Every agent endpoint (`_agent_access(..., "session")`: deployment brief/start, environment, to-dos),
    `_session_instructions`, `_session_environment` (Compose scoping) and `_cleanup_workspace` key on
    `kind == "session"`. A new kind would have to touch all of them and risk regressions.
  - Factory sessions are therefore `kind="session"` with a new optional `Session.factory: FactoryBinding`
    (`factory_id`, `role` (`chat` · `architect` · `planner` · `builder` · `tester` · `merger` · `analyst`),
    `step_id`, `phase_id`, `milestone_id`), exposed as `SessionPayload.factory`.
  - The SPA groups and labels them through it. They keep chat, Changes, Files, Trace and KPIs, and the human
    may write in an active step session; the orchestrator just waits for READY.
- **D4 Branches.**
  - Plan-level steps (`architect` chat, `planner`, `analyst`) run on the default branch. At step end their
    work is published with `Workspaces.merge` (squash fast-forward, as `_commit_platform_repository` does).
  - Milestone steps run on `factory_docs.milestone_branch(phase, milestone)` = `factory/<phase>/<milestone>`,
    which is **pushed at every checkpoint** by a new `Workspaces.push_branch`, the only new push path.
    `create_workspace` already checks out an existing remote branch.
  - Each milestone step, once its session is READY and before its brief is sent, integrates the default
    branch: if `origin/<default>` is not an ancestor of HEAD, a clean merge-tree means
    `git merge --no-edit`, and conflicts mean a `merger` step. Plan changes are never trapped.
- **D5 Machine-readable docs.** `docs/factory/` stays human Markdown, but `ROADMAP.md`, `PHASE.md` and
  milestone files carry YAML front matter (`id`, `status`, `depends`, `context`, `attempts`, `test`). The
  orchestrator reads **only** front matter (`shared/factory_docs.py`), never prose.
  - Phase statuses: `planned`, `expanded`, `done`, `reopened`.
  - Milestone statuses: `planned`, `building`, `testing`, `attention`, `done`, `reopened`.
  - `test`: `none`, `passed`, `failed`.
  - `testing` + `passed` means merge; `testing` otherwise means test. A failed test sets `building` and
    `attempts`+1.
  - The platform itself sets `done` on the milestone (and on the phase when it is the last one) in the
    merge squash. The `close` action of `next_target` is a platform front-matter commit, never an agent step.
- **D5b Plan reads use a control checkout**: `<workspace_root>/factories/<factory id>/repository`, a
  shallow, blob-filtered clone with a sparse checkout of `docs/factory`, refreshed with
  `fetch --depth 1` + `checkout --force --detach FETCH_HEAD` before every decision.
  `Workspaces.reconcile` only sweeps `sessions/` and `production/`, so it survives restarts. Remove it when
  the factory is deleted.
- **D5c Milestone progress lives on its branch** (added in session 3). Builders and testers change a
  milestone's front matter on `factory/<phase>/<milestone>`; the default branch learns it only from the merge
  squash. Every decision therefore reads the default branch, then overlays the next milestone's front matter
  from its branch (`Workspaces.branch_file` into the control checkout, `factory_docs.with_branch_progress`).
  A branch never closes its own milestone: `done` there reads as `testing`. Reason: without it the loop would
  rebuild the same milestone forever.
- **D6 Explicit step outcome.** Each step ends with the agent calling `POST /sessions/{id}/factory/agent/outcome`
  `{outcome: "completed" | "continue" | "failed" | "blocked", summary}`. The orchestrator then checks that the
  docs' front matter matches the outcome and that the branch has the expected commit. If they disagree, the
  outcome is `continue`, with a note in the journal.
- **D7 Context checkpoints.** Soft limit `FACTORY_CONTEXT_SOFT_PERCENT=20`, hard limit
  `FACTORY_CONTEXT_HARD_PERCENT=30`.
  - At the first `session.usage` at or above soft, the orchestrator interrupts the run (turns can be very
    long), waits for READY and delivers the checkpoint prompt in the **same** conversation.
  - Above hard, or after `FACTORY_CHECKPOINT_TIMEOUT_SECONDS=600`, it interrupts again.
  - In every case, before closing, the platform makes a **safety commit** (`git add -A`, commit
    `chore(factory): checkpoint <step>`, push). Nothing is ever lost, and the next session recovers from Git
    plus *State*.
- **D8 Strictly sequential** in this phase: at most one active step per factory. Parallel milestones are a
  later evolution; `depends` already exists in the front matter to allow it.
- **D9 Pause and resume.** Graceful pause triggers the checkpoint at the next turn end; immediate pause runs
  the D7 interrupt path. Resume always opens the agent selection (provider, account, adapter, model, effort)
  preselected from the previous run or the admin defaults. The selection is stored on the run and applied to
  every step until the next pause. Running out of provider limits pauses with reason `limits` and resumes by
  itself with the same selection once the quota KPI renews.
- **D10 Retry bound.** `FACTORY_MAX_TEST_CYCLES=3` failed build→test cycles per milestone set it to
  `attention` and park the loop.
- **D11 Tester.** It runs on the milestone branch in its own clone, starts its own dev deployment through the
  existing agent deployment API, drives the preview in a browser (Playwright MCP, as sessions already have
  it) against the milestone's *End-to-end criteria*, writes *Tests* and front matter `test: passed|failed`,
  and stops its preview. It never edits code.
- **D12 Change requests.** States: `queued` → `analyzing` → `awaiting-confirmation` (scope-level only) →
  `applied` | `rejected`. They are applied only at safe points (between steps) by an `analyst` step on the
  default branch, which updates decisions and reopens phases with delta milestones referencing `CR-<n>`.
- **D13 Prompts** live in a new `shared/factory_prompts.py` (one function per role plus the file templates),
  not inline in `sessions.py`, which is already 4.5K lines.
- **D14 Attention signals.** In this phase they go through the live channel (`factory.updated`) and badges
  in the SPA (project card, main menu, Factory tab). Push notifications are out of scope; add a to-do for them.
- **D15 Out of scope**: production and backups (excluded by the vision), parallel milestones, more than one
  factory per project.

## Milestones

| # | Milestone | Depends | Status |
|---|-----------|---------|--------|
| 01 | [Persistence and unattended identity](milestones/01-persistence-identity.md) | — | done |
| 02 | [Docs contract, templates and role prompts](milestones/02-docs-contract.md) | — | done |
| 03 | [Orchestrator core](milestones/03-orchestrator-core.md) | 01, 02 | done |
| 04 | [Context checkpoints](milestones/04-context-checkpoints.md) | 03 | done |
| 05 | [Definition and factory chat](milestones/05-definition-chat.md) | 03 | done |
| 06 | [Build, test and merge loop](milestones/06-build-test-merge.md) | 04, 05 | done |
| 07 | [Control: pause, resume, limits, change requests](milestones/07-control-change-requests.md) | 06 | done |
| 08 | [Factory tab (SPA)](milestones/08-factory-tab.md) | 03 (API), 07 (full) | done |
| 09 | [Closure](milestones/09-closure.md) | all | done |
| 10 | [End-to-end verification](milestones/10-e2e-verification.md) | 09 | building |
