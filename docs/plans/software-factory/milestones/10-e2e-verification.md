---
id: 10-e2e-verification
status: planned
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

- [ ] Deploy the preview, sign in, link the accounts, add the test project
- [ ] Scenarios 1–2
- [ ] Scenarios 3–4
- [ ] Scenarios 5–6
- [ ] Scenario 7
- [ ] Scenario 8
- [ ] Scenarios 9–11
- [ ] Record the results in *Tests*, update *State*, set `status: done` and remove the *Current work* pointer
  from `AGENTS.md`

## State

Not started. Code of milestones 01–09 is complete on `feat/mooi-a2gpr5`, last commit `1c9611d`. The areas
most likely to need fixes are the ones never run:

- the agent loop against GitHub (pushes, merges, the default branch moving);
- interrupt and checkpoint timing per adapter;
- quota detection per adapter;
- the delegated sign-in over long runs;
- Docker access from the preview's `mic-sessions`;
- the visual layout of the Factory tab.

## Tests

## Log
