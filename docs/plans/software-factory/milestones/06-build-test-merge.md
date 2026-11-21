---
id: 06-build-test-merge
status: done
depends: [04-context-checkpoints, 05-definition-chat]
context: [mic-sessions]
---

# Milestone 06: Build, test and merge loop

## Spec

The autonomous loop proper, per phase and milestone (vision › *Autonomous loop*).

**Planner** (default branch):

- When the next phase is `planned`, it reads `FACTORY.md`, `VISION.md`, `ARCHITECTURE.md`, `DECISIONS.md`,
  `ROADMAP.md` and the previous phases' `PHASE.md` summaries.
- It writes `PHASE.md` (full functional and technical detail, phase decisions) and one file per milestone.
  Each milestone is self-contained, with concrete *End-to-end criteria* and a declared `context`.
- It sets the phase to `expanded` and commits. No human gate.
- A phase too large for one planner step continues across steps through *State* in `PHASE.md`.

**Builder** (milestone branch):

- At step start, the platform merges the default branch into the milestone branch. On conflicts, it runs a
  `merger` step that uses `_conflict_prompt` (≈2162).
- The builder works through *Tasks*, writes unit tests only if `ARCHITECTURE.md` says so, keeps *State*
  truthful, and reports `continue` or `completed`.
- `completed` requires every task checked and `status: testing`.

**Tester** (milestone branch, D11):

- It starts its own dev deployment through `/deployment/agent/start`.
- It runs each *End-to-end criterion* in the browser, records reproducible bugs in *Tests* (steps, expected,
  actual, evidence), and sets `test: passed|failed`.
- It stops the preview and reports. It never edits code.
- A failure increments `attempts` and returns the milestone to `building`. The builder brief then points at
  the latest *Tests* entry.
- When `attempts` reaches `FACTORY_MAX_TEST_CYCLES` (D10), the milestone goes to `attention` and the factory
  pauses with reason `attention`.

**Merge**: after `passed`, the platform runs `preview_merge` (≈414).

- Clean → `Workspaces.merge` (squash onto the default branch, commit message
  `feat(<phase>): <milestone title>`).
- Conflicts → a `merger` step, then merge.
- Then set the milestone to `done` on the default branch (in the same squash), and the phase to `done` when
  all of its milestones are.
- The milestone branch is left on GitHub (no deletion in this phase).

**Phase end**: a short planner step refreshes the next phases' assumptions against what was actually built
(drift control). It touches only the front-matter `status` and the *Assumptions* sections; anything bigger
becomes a change request.

## Tasks

- [x] Planner, builder and tester briefs (written in milestone 02; reviewed here)
- [x] Default-branch → milestone-branch merge at step start, with the merger step on conflicts (done in
  milestone 03: `workspaces.integrate` + `FactoryRunner._merger`, using `merger_brief`)
- [x] Milestone progress read from its branch (D5c)
- [x] Test-cycle accounting and the `attention` transition
- [x] Merge flow with status updates in the squash
- [x] Phase-end drift refresh (covered by the planner brief, decision of milestone 02)
- [x] Checks: `uvx ruff check src`, import check

## Acceptance

- A two-milestone phase goes planner → builder (several steps) → tester → merge twice, with no human action,
  and ends `done` in `ROADMAP.md` on the default branch.
- A deliberately failing criterion produces a builder fix step; three failures park the factory in
  `attention`.
- The tester's preview is stopped at the end of every test step.

## State

Done (session 3). Code complete and checked; the *Acceptance* scenarios are verified manually by the user.

What exists:

- D5c: `_read_plan(..., progress=True)` (runner only) overlays the next milestone's front matter read from
  its branch (`workspaces.branch_file`: shallow fetch into the control checkout, `None` when the branch or
  file is missing) with `factory_docs.with_branch_progress`. The saved `plan` snapshot includes it.
- Merge (`FactoryRunner._merge`, no agent): `workspaces.factory_merge_checkout` (fresh blob-filtered clone
  of the milestone branch in `factories/<id>/merge`, removed afterwards), front matter `status: done`,
  `test: passed`, then `Workspaces.merge` with `feat(<phase>): <title>`. Conflicts make the cycle run a
  `merger` step (`_ROLES["merge"]`) on the milestone branch with `merger_brief`; if the default branch
  integrates cleanly at step start, that step ends `completed` at once and the next cycle merges.
- D10: after a verified tester `failed`, `_count_failure` reads the workspace's milestone and, at
  `attempts >= FACTORY_MAX_TEST_CYCLES` (setting, default 3), sets `status: attention`, appends a *Log* line
  and commits; the next cycle pauses with reason `attention`.
- The tester's preview stops with its session (`close_session` cleans its deployment).

Local decisions (session 3):

- The phase is set `done` by the existing platform `close` action in the next cycle, not in the merge
  squash: editing `ROADMAP.md` from a milestone branch would conflict with concurrent plan changes.
- Phase-end drift control is the planner brief's job (it reads the last three built phases and refreshes
  later *Assumptions*), as milestone 02 decided: no extra step.
- Milestone branches stay on GitHub after merging.

## Log

- Session 3: branch progress overlay, platform merge with merger fallback, test-cycle bound. Ruff: no new
  findings; import check passes; `branch_file`'s git commands checked against a local bare repository.
