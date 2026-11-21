---
id: 03-orchestrator-core
status: done
depends: [01-persistence-identity, 02-docs-contract]
context: [mic-sessions]
---

# Milestone 03: Orchestrator core

## Spec

The deterministic state machine in a new `mic-sessions/src/mic_sessions/features/factories.py` (D1). It
launches one step at a time (D8), journals every step in `mic-mooi` and resumes after restarts.
`sessions.py` (4.5K lines) gets only small, generic hooks; all factory logic stays in `factories.py`.

**Hooks in `features/sessions.py`** (anchors verified in session 1):

- `@dataclass(frozen=True) class FactoryBinding` with `factory_id`, `role`, `step_id`, `phase_id`, and
  `milestone_id`.
  - Add `factory: FactoryBinding | None = None` to `Session` (≈689).
  - Add `factory: dict | None` to `SessionPayload` (≈513), filled in `to_payload` (≈764).
- `_open_session(body, caller, factory: FactoryBinding | None = None)` (≈1253). It sets `session.factory`
  before `registry.add`. Factory sessions use `kind="session"` with a branch: the default branch for
  plan-level roles, the milestone branch otherwise. Steps pass `initialMessage=None`: the runner delivers
  the brief itself after integrating the default branch (D4).
- **Observer hook**: a module-level `_observers: list[Callable[[Session, str, dict], None]]`, plus
  `def observe(callback)`, called at the end of `record()` (≈922, before `return event`), only when
  `session.factory is not None`. The runner reacts to `session.status` (READY, failed, closed),
  `turn.result` and `session.usage`.
- `_session_instructions` (≈2333): when `session.factory` is set, append
  `factory_prompts.agent_api(BriefContext(root, session.agent_token, session.branch, session.base_branch),
  chat=role == "chat")`.
- Small public helpers for `factories.py`, so it never reaches into private names:
  - `open_session(body, caller, factory)`;
  - `deliver(session, text)`: under `operation_lock`, requires READY, then `_deliver`;
  - `interrupt(session)`: `_runtime(session).interrupt()`;
  - `close_session` (exists, ≈1232);
  - `publish(player_id, type, data)`: `_channels.publish`;
  - `agent_access(session_id, request)`: `_agent_access(..., "session")` plus a check that
    `session.factory` is set.
- Agent identity: after READY, call `workspaces.set_identity(session.workspace,
  await mooi.fetch_github_identity(caller))` so agent commits carry the player's identity (merge resolve
  does the same, ≈2257).

**Workspace operations in `shared/workspaces.py`**, each with a module-level wrapper like the existing ones
(≈738+):

- `push_branch(workspace, branch, token)`:
  `git push --porcelain origin HEAD:refs/heads/<branch>`, never forced. Map rejections the way `merge`
  does (≈455).
- `checkpoint_commit(workspace, message, identity) -> bool`: if `status --porcelain` is non-empty and no
  `MERGE_HEAD` exists, `add -A` then `commit` with `_identity_env`.
- `head_commit(workspace) -> str`.
- `integrate(workspace, target, identity, token) -> list[str]`:
  - `_fetch`;
  - if `merge-base --is-ancestor origin/<target> HEAD`, return `[]`;
  - otherwise run `merge-tree --write-tree --name-only` of HEAD against origin;
  - if clean, `merge --no-edit origin/<target>` with the identity env and return `[]`;
  - else return the conflicting paths without touching the checkout.
- Control checkout (D5b): `factory_checkout(factory_id, project_full_name, branch, token) -> (path,
  commit)` and `remove_factory_checkout(factory_id)`, with a `.mooi-factory` marker like `.mooi-session`.

**Runner** (`FactoryRunner`, one asyncio task per live factory, in a dict keyed by factory id):

1. Load the factory with `mooi.fetch_internal_factory`. The caller comes from `mooi.factory_access`, cached
   and renewed 120 s before expiry. A 401 pauses the factory with reason `revoked`.
2. **Reconcile** at runner start: `mooi.reconcile_factory_steps(active step ids of every runner)`.
3. **Read** the plan from the control checkout with `factory_docs.read_plan`, then save `plan_snapshot`
   (`plan.as_json()`) and `plan_commit` with `update_factory`. Writes go against `revision`; on a 409,
   reload once.
4. **Decide** with `factory_docs.next_target(plan)`:
   - `None` → `resting`;
   - `attention` → pause with reason `attention` and a message;
   - `close` → platform front-matter commit (phase `done`) on the control checkout (it needs a writable
     non-sparse path: alternatively, open no session and use the GitHub contents API through mic-mooi;
     decide here and record it);
   - `expand` → `planner`;
   - `build` → `builder`;
   - `test` → `tester`;
   - `merge` → the platform merge (milestone 06).

   Plan issues (`plan.issues`) pause with reason `attention`, listing them.
5. **Open the step**:
   - `mooi.open_factory_step` with a new step id;
   - `open_session` with the run config (`provider`, `connectionId`, `adapter`, `model`, `effort`) and the
     binding;
   - wait for READY, integrate (milestone steps), deliver the role brief.
6. **Wait** for one of these signals (asyncio events set by the observer and by the agent endpoint): the
   outcome, a failed or closed session, a pause request, or (milestone 04) a context checkpoint.
7. **Close the step**:
   - `checkpoint_commit`;
   - push (milestone branch) or `Workspaces.merge` (default-branch roles, message
     `docs(factory): <role> <target>`);
   - `update_factory_step` with status, summary, head commit and peak context;
   - `close_session`, then go back to 3.
   - An agent outcome whose front matter disagrees becomes `continue`, with a journal note (D6).

**Agent API** (in `factories.py`, guarded by `sessions.agent_access`):

- `GET /sessions/{id}/factory/agent`: the factory payload, this step's binding, and `plan` (with its
  `issues`).
- `POST /sessions/{id}/factory/agent/outcome` with `{outcome, summary}`. It answers 409 if this session is
  not the active step.

**Lifecycle**:

- In the `main.py` lifespan, after the session reconciler starts, call `factories.start()`. It loads
  `mooi.fetch_active_factories()` and starts a runner for each one in `running` or `pausing`; the ones
  paused for `limits` go to the milestone 07 watcher.
- At shutdown, `factories.stop()` cancels the runners without writing anything; the next boot reconciles.
- Register the router.

**Realtime**: after every factory or step write, publish `factory.updated` with `{projectId, factory}` (the
payload `update_factory` answered) on the owner's channel.

## Tasks

- [x] `FactoryBinding`, `Session.factory`, `SessionPayload.factory`, `_open_session(factory=)`
- [x] Observer hook in `record()`, factory section in `_session_instructions`, public helpers
- [x] Workspace operations: `push_branch`, `checkpoint_commit`, `head_commit`, `integrate`, control
  checkout
- [x] `features/factories.py`: runner, reconcile, decision, step open/wait/close, journal calls
- [x] Agent endpoints: state and outcome
- [x] Boot and shutdown wiring in `main.py` lifespan; register the router
- [x] `factory.updated` events
- [x] Checks: `uvx ruff check src` (only new findings matter: `mooi.py` has a pre-existing I001), import
  check `uv run python -c "import mic_sessions.main"` with 32-byte `SERVICE_TOKEN`/`JWT_SECRET` env

## Acceptance

- Starting a factory whose docs list one planned phase opens exactly one `planner` step session, visible in
  the project's sessions.
- Restarting `mic-sessions` during a step marks it `interrupted` and opens a fresh step for the same target
  after boot.
- No path pushes to the default branch except `Workspaces.merge`.

## State

Done (session 2). Code complete and checked; the *Acceptance* scenarios are verified manually by the user
once milestones 05/07 provide the start endpoints (until then, a factory runs only if its row is set to
`running` with a `runConfig` and a grant).

What exists:

- `sessions.py`: `FactoryBinding` (+ `as_payload`), `Session.factory`, `SessionPayload.factory`,
  `_open_session(..., factory=)`, `observe(callback)` called at the end of `record()` for factory sessions,
  `_factory_instructions` appended to `_session_instructions`, and the public hooks section (before
  *lifecycle safety*): `open_session`, `deliver(session, caller, text)`, `interrupt`, `publish`,
  `agent_access`.
- `workspaces.py`: `push_branch`, `checkpoint_commit` (skips during a merge, `--no-verify`), `head_commit`,
  `merge_in_progress`, `integrate`, `factory_checkout` / `remove_factory_checkout` (`factories/<id>/`,
  marker `.mooi-factory`), module wrappers; push errors share `_raise_push_error` (merge messages unchanged).
- `factory_prompts.outcome_reminder()`.
- `features/factories.py`: `FactoryRunner` (cycle: close a pending step → load → control checkout →
  `read_plan` → save snapshot if changed → decide → step), `_Step`, `launch(factory_id)`, `start()`/`stop()`,
  agent endpoints `GET /sessions/{id}/factory/agent` (plan read from the session's own checkout) and
  `POST .../factory/agent/outcome`, `factory.updated` published on every load/save.
- `main.py`: `factories.start()` after `start_reconciler()`, `factories.stop()` first at shutdown, router.

Local decisions (session 2):

- **`close`**: the platform edits `PHASE.md` and `ROADMAP.md` front matter in the control checkout and
  publishes with `Workspaces.merge` (works on the sparse, blob-filtered checkout). So `Workspaces.merge`
  stays the only path to the default branch; conflicts make the cycle retry from a fresh read.
- **Merger at step start**: when `integrate` reports conflicts, the opened step is journaled `continue` and
  the **same session** becomes a `merger` step (new step id, binding replaced) with `merger_brief`; the
  role's own work follows in a fresh session. A merger outcome counts only if no merge is in progress and
  the default branch is integrated.
- **D6 check**: an outcome `completed`/`failed` counts only if `next_target` read from the session's own
  checkout differs from the step's target (planner: also no `plan.issues`); otherwise `continue` + note.
- **Silent agent**: a turn ending without outcome gets one `outcome_reminder`; a second ends the step as
  `continue`. After an outcome the agent gets 60 s to finish its turn, then it is interrupted.
- **Guards**: 3 consecutive steps on one target without a new commit → pause `attention`; cycle errors back
  off 15/30/60/120/300 s, then pause `error`; a 401/403 on the factory token → pause `revoked` (the open
  session is kept, nothing can be published without the grant); `blocked` → pause `attention`.
- **Plan work that conflicts** on publish is pushed to `factory/recovery/<step id>` and the factory pauses
  `attention`. At shutdown `stop()` cancels runners, then safety-commits and pushes the running step
  (milestone branch, or the recovery branch for plan roles); nothing is written to mic-mooi.
- **Recovery**: a target whose last step ended without a matching outcome (or was interrupted by a restart)
  gets `recovery_note()` appended to its next brief.
- **Builder deployment**: `foundations_deployment` is true for `00-foundations` milestones of web
  projects whose development deployment is not ready yet.
- The tester's preview root is `http://127.0.0.1:<sessions_port>`.

Gotchas for next milestones:

- `merge` target: placeholder pause (`attention`, "merging is not available yet") in `_cycle`; milestone 06
  replaces it. D10 (`attempts` bound) is not enforced yet (06).
- `pausing` is only handled at runner start (turned into `paused`/`user`); graceful/immediate pause and the
  `limits` watcher are milestone 07. The context peak is tracked (`_Step.peak_context`) but the 20 % checkpoint
  flow is milestone 04 (hook into `FactoryRunner.observe`).
- Factory step sessions count toward `max_sessions_per_player` (default 4): a full quota makes the cycle
  back off and finally pause `error`.
- Player endpoints (`/factories/{projectId}/…`: enable, chat, approve, start, pause, resume, change
  requests) belong to milestones 05 and 07, in the same `factories.py` router; deleting a factory must call
  `workspaces.remove_factory_checkout`.

## Log

- Session 2: hooks in `sessions.py`, workspace operations, `features/factories.py` (runner, agent API, events),
  lifespan wiring. Ruff: no new findings; import check passes.
