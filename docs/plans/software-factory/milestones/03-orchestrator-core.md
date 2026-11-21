---
id: 03-orchestrator-core
status: planned
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

- [ ] `FactoryBinding`, `Session.factory`, `SessionPayload.factory`, `_open_session(factory=)`
- [ ] Observer hook in `record()`, factory section in `_session_instructions`, public helpers
- [ ] Workspace operations: `push_branch`, `checkpoint_commit`, `head_commit`, `integrate`, control
  checkout
- [ ] `features/factories.py`: runner, reconcile, decision, step open/wait/close, journal calls
- [ ] Agent endpoints: state and outcome
- [ ] Boot and shutdown wiring in `main.py` lifespan; register the router
- [ ] `factory.updated` events
- [ ] Checks: `uvx ruff check src` (only new findings matter: `mooi.py` has a pre-existing I001), import
  check `uv run python -c "import mic_sessions.main"` with 32-byte `SERVICE_TOKEN`/`JWT_SECRET` env

## Acceptance

- Starting a factory whose docs list one planned phase opens exactly one `planner` step session, visible in
  the project's sessions.
- Restarting `mic-sessions` during a step marks it `interrupted` and opens a fresh step for the same target
  after boot.
- No path pushes to the default branch except `Workspaces.merge`.

## State

Not started. The hooks and the workspace operations above are fully designed; start with the first task.
Player endpoints (`/factories/{projectId}/…`: enable, chat, approve, start, pause, resume, change requests)
belong to milestones 05 and 07, but put them in the same `factories.py` router.

## Log
