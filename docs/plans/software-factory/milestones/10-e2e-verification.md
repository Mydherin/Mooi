---
id: 10-e2e-verification
status: building
depends: [09-closure]
context: [mic-sessions, mic-mooi, spa-mooi]
---

# Milestone 10: End-to-end verification

## Spec

Milestones 01–09 are code complete and every check passes, but nothing has run against real agents, GitHub
or Docker yet. This milestone runs the whole factory end to end in the Mooi dev preview and fixes what
breaks. The user asked for it explicitly, so deploying the preview and driving it in a browser is allowed
here (`AGENTS.md` › *Testing*). Still, write no programmatic tests.

**Environment**:

- Deploy this repository's dev preview exactly as the Deploy button does: `GET .../deployment/agent/brief`
  and follow it.
- Google sign-in is mocked (`MOOI_DEVELOPMENT_GOOGLE_AUTH_MOCK`, user `developer@mooi.dev`). GitHub, Claude
  and Codex accounts are linked from `MOOI_DEVELOPMENT_GITHUB_TOKEN`, `MOOI_DEVELOPMENT_CLAUDE_TOKEN` and
  `MOOI_DEVELOPMENT_CODEX_AUTH_JSON`; all of them exist in the project environment.
- Drive the preview with the Playwright browser tools, desktop and phone (360 px) viewports.
- **Test project**: a throwaway GitHub repository the linked token can push to, because the factory commits and
  pushes to its default branch and to `factory/*` branches. Never use a real project. Ask the user which
  repository to use if none is named.
- Keep the definition tiny to bound the cost: a small web app (e.g. a one-page notes app) with
  `00-foundations` plus one phase of two milestones.
- The factory's own sessions run inside the preview's `mic-sessions`. The tester's preview is a deployment
  started by that `mic-sessions` on the host engine, so check that the preview's `mic-sessions` can reach
  Docker. If it cannot, record it here and test the tester step up to its deployment call.

**Where to look**:

- The Factory tab, and each step's session (chat, Changes, Trace).
- The test repository on GitHub: `docs/factory/` on the default branch, and the `factory/<phase>/<milestone>`
  branches.
- Preview logs: `mic-sessions` logger `factories`, and the `mic-mooi` factory endpoints.
- `GET /me/projects/{id}/factory`, `/steps` and `/change-requests` through the preview API, to cross-check
  what the tab shows.

**Bug protocol**: for each failure, record the reproduction in *Tests* (scenario, steps, expected, actual,
evidence), fix it at the root, keep the checks passing (`mic-mooi` compile, `mic-sessions` ruff and import
check, `spa-mooi` build), redeploy and re-run the scenario. Commit each fix as `fix(factory): …`.

## Scenarios

Run them in order: later ones reuse the factory the earlier ones built.

1. **Enable and define** (05, 08):
   - With no factory, the Factory tab shows the intro.
   - *Define the factory* opens the chat with the architect brief. The architect writes and publishes the
     five core files with `00-foundations` first.
   - Approving with a core file missing is refused, with the list of issues. Asking the chat to approve
     without your confirmation must be refused by the agent itself.
   - After approval the status is `ready`. The default branch holds `docs/factory/` with `ROADMAP.md` starting
     with `00-foundations`.
2. **Start and plan** (03, 05): *Start* with an agent selection.
   - Exactly one `planner` step session opens, visible in the project's Sessions with a role badge.
   - The active step and the journal update live.
   - `PHASE.md` and milestone files land on the default branch, and the phase becomes `expanded`.
3. **Build with checkpoints** (04, 06):
   - A `builder` session works on `factory/00-foundations/<milestone>`.
   - The context gauge rises. At 20 % the session is interrupted and gets the checkpoint brief, its *State* is
     rewritten, the branch is pushed, and a fresh session continues.
   - The journal's peak context stays around 20–22 %.
   - The foundations milestone that sets up the dev deployment follows the Deploy brief.
4. **Test and merge** (06, D11):
   - A `tester` session deploys the milestone branch, drives its preview, writes *Tests* and the front matter,
     and its preview is stopped at step end.
   - On `passed`, the platform squashes the branch onto the default branch (`feat(<phase>): <title>`) with the
     milestone `done`. Once every milestone is done, the next cycle closes the phase.
5. **Failure cycle** (06, D10): make one end-to-end criterion fail on purpose, e.g. by editing the
   milestone's criteria.
   - A builder fix step follows, with `attempts` incremented.
   - Three failures set `attention`, pause the factory, and light the badges on the tab, the project card,
     the sidebar and the phone menu button.
   - *Resume* resets the attempts on the milestone branch.
6. **Pause and resume** (07, D9):
   - A graceful pause during a builder step checkpoints at its turn end, then `paused`/`user`.
   - An immediate pause interrupts at once and leaves a pushed safety commit.
   - *Resume* with a different model continues the same milestone in a fresh session with that model. The
     selection dialog preselects the last run.
   - The chat can pause and resume too, and each side updates the other live.
7. **Restart resilience** (03):
   - Restart the preview's `mic-sessions` during a step. The step is journaled `interrupted` and, after boot, a
     fresh step resumes the same target with a recovery note.
   - The chat session is gone after the restart. Reopening it works.
8. **Change requests** (07, D12):
   - A request touching the finished phase reopens it with a delta milestone, built before new work.
   - A scope-level request goes to `awaiting-confirmation` and changes nothing. Accept and reject it from the
     tab and from the chat.
   - Once every phase is done (`resting`), a new request wakes the factory up. An accepted scope-level one
     reopens the definition (status `defining`, architect chat with the redefinition brief).
9. **Unattended identity** (01, D2):
   - Sign out everywhere while the factory runs. The next token renewal fails and it pauses `revoked`.
   - Resume opens a new grant.
   - Deleting the test project from Mooi revokes the factory's sign-in.
10. **Limits** (07): if provider limits run out during the run, the factory pauses `limits` and resumes by
    itself later. Otherwise, check the paused message and the watcher's log line, without forcing it.
11. **Responsive and themes** (08): Factory tab views on 360 px and desktop, light and dark. No horizontal
    overflow, and the controls stay reachable.

## Tasks

- [x] Deploy the preview, sign in, link the accounts, add the test project
- [x] Scenarios 1–2
- [ ] Scenarios 3–4 (partial: blocked by the preview having no Docker, see *Tests*)
- [x] Scenarios 5–6 (5 through the `blocked` path, see *Tests*)
- [x] Scenario 7
- [ ] Scenario 8 (partial: no finished phase to reopen, accept path not run)
- [x] Scenarios 9–11 (10 not forced)
- [ ] Record the results in *Tests*, update *State*, set `status: done` and remove the *Current work* pointer
  from `AGENTS.md`

## Decisions (local)

- **L1 Platform faults block, they never fail a test.** A tester whose deployment cannot start because of
  Mooi itself (Docker engine unavailable, capacity) records it and reports `blocked`, leaving `test` and
  `attempts` untouched. Reason: run 1 burnt three build→test cycles on `docker_unavailable`.
- **L2 The dev deployment comes first.** For web applications, the first `00-foundations` milestone sets up
  the dev deployment together with the minimal app it serves, and every milestone's criteria must be testable
  once it and the earlier ones are built. Reason: the planner put it second, so milestone 1 was untestable.

## State

Session 1 ran scenarios 1–11 against a throwaway private repository (created and deleted by the session)
with Sonnet/Haiku at low effort. Seven defects were found and fixed (see *Tests*); every fix was redeployed
and re-run. What is still unverified, all for one environmental reason (the preview's `mic-sessions` has no
Docker engine, by design of `compose.yml`), plus what small milestones never trigger:

- Scenario 3: a checkpoint at 20 % (tiny milestones peak at 2–4 %); the checkpoint path itself ran through
  the graceful and immediate pauses.
- Scenario 4: a passing tester, the platform squash merge and the phase close.
- Scenario 8: a change request reopening a *finished* phase with a delta milestone; accepting a scope-level
  request (only rejecting was run); waking a `resting` factory.
- Scenario 10: limits (not forced).

Next step: run scenarios 3, 4 and 8 where the factory's `mic-sessions` reaches a Docker engine (a local run
through `make`, or production), with a milestone large enough to cross 20 % of context; then close this
milestone.

## Tests

### Session 1 — 2026-11-21

Setup: preview deployed with the Deploy brief; mocked Google sign-in; Claude account from the environment
(Codex has no credential); test repository `Mydherin/mooi-factory-e2e-vpqx52` (private, deleted at the end);
definition: a static "Click counter" page, `00-foundations` + `01-counter`.

| # | Result | Notes |
|---|--------|-------|
| 1 | Passed after fixes 1–3 | Intro shown; architect published the five core files; approving with `DECISIONS.md` missing was refused with the issue listed (tab and chat); approval → `ready`; `ROADMAP.md` starts with `00-foundations`. |
| 2 | Passed | One planner step, role badge in Sessions, live active step and journal; `PHASE.md` + two milestones on `main`, phase `expanded`. |
| 3 | Partial | Builder on `factory/00-foundations/00-site-skeleton`, pushed at every step with the user's Git identity; peak context 2–4 %, so the 20 % checkpoint never triggered. |
| 4 | Blocked by the environment | Tester called the deployment API, got `docker_unavailable`; no preview, so no pass, merge or phase close. |
| 5 | Passed (via `blocked`) | Two `Test failed` cycles raised `attempts` to 2 (fix 4 then turned platform faults into `blocked`); the factory paused `attention`; badges on the tab, the sidebar, the phone menu button and the project card ("Factory needs you"). |
| 6 | Passed after fix 5 | Graceful pause let the turn end, then `paused`/`user`; *Stop now* interrupted in 2 s and pushed a safety commit holding the tester's uncommitted *Tests* entry; resume preselected the last run and switched to Haiku; the chat resumed the factory and the tab followed live. |
| 7 | Passed | A redeploy restarted `mic-sessions` during an analyst step: journaled `Interrupted`, a fresh step on the same target 2 s after boot; the chat was gone and reopening it worked. |
| 8 | Partial, passed after fixes 6–7 | CR-1 (label rename) applied by an analyst on `main`; CR-2 (accounts and backend) went to *Confirm scope* with its impact and changed nothing; rejected from the tab. |
| 9 | Passed after fix 8 | *Log out on every device* during a step paused the factory `revoked`; resume opened a new grant. Project deletion not run (the preview was discarded instead). |
| 10 | Not forced | — |
| 11 | Passed | Desktop and 360 px, dark and light: no horizontal overflow, controls reachable. |

Defects found and fixed (each redeployed and re-run):

1. **Definition checklist never updated.** Steps: architect publishes. Expected: core files ticked, phases
   listed. Actual: empty until approval, even after reload. Cause: the plan snapshot was saved only by the
   runner and at approval. Fix: `agent_publish` (and a refused approval) refresh it; the architect brief's
   redefinition flag now comes from the redefinition change request instead of the snapshot.
2. **Stale approval issues.** After a refused approval and a fixed definition, "Still to fix" stayed. Fix:
   refused issues are tied to the plan commit they read.
3. **Factory chat had no Git identity.** The architect invented `mooi@localhost` to commit. Fix: every
   factory session gets the player's identity right after its clone, before its brief.
4. **Platform faults counted as failed tests** and the planner put the dev deployment second (L1, L2).
5. **Pause before the brief left a false "Recovery needed" log line** and a safety commit with nothing to
   recover, and counted as a stalled step. Fix: a step is `briefed` only once its brief is delivered.
6. **Factory chat invisible once the factory runs.** Opening it created a session the tab never showed. Fix:
   shared `FactoryChatCard`, shown above the roadmap whenever a chat is open.
7. **Change requests not live.** One queued from the chat appeared only after a remount (no factory
   revision change). Fix: every `factory.updated` bumps a live counter the list reads again on.
8. **Revocation looped on `cycle failed`.** A cached token kept being used after *log out everywhere* (401
   "Session is no longer active"). Fix: on a 401 the runner mints again; a refused mint pauses `revoked`.
   Also, a step left open by a revoked run shows "Step on hold" instead of a live dot.

## Log

- Session 1: ran scenarios 1–11 in the preview, fixed defects 1–8, recorded L1–L2; scenarios 3, 4 and 8
  remain partial because the preview has no Docker engine.
