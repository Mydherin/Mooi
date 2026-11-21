---
id: 02-docs-contract
status: done
depends: []
context: [mic-sessions]
---

# Milestone 02: Docs contract, templates and role prompts

## Spec

The `docs/factory/` contract that every factory project shares (vision › *Lives in the repository*). It also
covers its deterministic reader (D5) and the role prompts (D13).

**Structure** (core files always exist; the rest only when needed):

```
docs/factory/
  FACTORY.md        # index: every file + "read when…", conventions, channel rules, current status
  VISION.md         # goals, users, in scope / out of scope (closed)
  ARCHITECTURE.md   # stack, structure, conventions, unit-test policy, dev deployment notes
  DECISIONS.md      # D-<nnn>: context, decision, affects (phases/milestones/files), CR reference
  ROADMAP.md        # front matter: ordered phases [{id, title, status, depends}]
  context/<slug>.md # on demand; registered in FACTORY.md with its reading rule
  phases/<nn>-<slug>/PHASE.md                 # front matter {id, status, milestones[]}; detail; D-<nn>.<n>
  phases/<nn>-<slug>/milestones/<nn>-<slug>.md
```

**Milestone file**:

- Front matter: `{id, status, depends, context: [files], attempts, test: none|passed|failed, branch}`.
- Sections, always in this order: *Spec*, *End-to-end criteria*, *Tasks*, *State* (rewritten by every
  session), *Tests* (tester reports, newest first), *Log* (one line per session, appended; compacted to a
  summary beyond 30 lines).

**Rules written into `FACTORY.md`**:

- A session reads `FACTORY.md`, its `PHASE.md`, its milestone and the `context` files it declares, and nothing
  else under `docs/factory/` unless a task requires it.
- Factory sessions never touch `deploy/production/` or backups.
- Only plan-level roles edit `VISION.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md` and `PHASE.md`.
  Milestone roles edit only their milestone file and the code.

**Reader** (`mic-sessions/src/mic_sessions/shared/factory_docs.py`):

- `read_plan(workspace) -> FactoryPlan` (phases, milestones, statuses, depends, context, test, attempts)
  parses front matter only, with `yaml.safe_load`.
- `validate(workspace) -> list[FactoryDocIssue]` reports missing core files, unknown statuses, broken
  references and unregistered `context/` files.
- `next_target(plan) -> Target | None` returns the first phase in order that is not `done`, then its first
  milestone that is not `done`. A `reopened` milestone counts as not done; `depends` are respected.

**Prompts** (`shared/factory_prompts.py`): one function per role (`chat`, `architect`, `planner`, `builder`,
`tester`, `merger`, `analyst`, plus `checkpoint` and `recovery`). Each returns the brief, which includes:

- the factory protocol;
- the files to read;
- the outcome API (D6);
- the Mooi platform API block (reuse the pieces of `_session_instructions`, `sessions.py` ≈2333).

The file templates are constants in the same module.

## Tasks

- [x] `factory_docs.py`: dataclasses, front-matter parsing, `read_plan` (validation is folded into
  `plan.issues`), `definition_issues`, `next_target`, `write_front_matter`
- [x] `factory_prompts.py`: templates of all core files and the milestone file, and the role briefs
- [x] PyYAML declared in `pyproject.toml` (it was only transitive through `uvicorn[standard]`); `uv.lock`
  updated
- [x] Checks: ruff is clean on the new modules (the I001 in `mooi.py` was already there); smoke import done

## Acceptance

- `validate` on `docs/plans/software-factory/` (the same milestone layout) reports issues only for the
  missing core files.
- Every brief names exactly which files to read and which outcome to report.

## State

Done. Nothing calls these modules yet; milestone 03 wires them. API to use:

- `factory_docs`:
  - `read_plan(checkout) -> FactoryPlan` (`.phases`, `.issues`, `.as_json()` for `plan_snapshot`);
  - `definition_issues(plan)`;
  - `next_target(plan) -> Target(action, phase, milestone) | None`, where `action` is `expand`, `build`,
    `test`, `merge`, `close` or `attention`;
  - `write_front_matter(path, updates)`;
  - `milestone_branch(phase, milestone)`, which gives `factory/<phase>/<milestone>`;
  - `FOUNDATIONS = "00-foundations"`.
- `factory_prompts`:
  - `BriefContext`;
  - `agent_api(context, chat=)`: the factory section of the standing instructions;
  - `architect_brief(request)`, `steering_brief()`, `planner_brief(phase, previous, reopened)`,
    `builder_brief(milestone, foundations_deployment=)`, `tester_brief(milestone, preview_root)`,
    `merger_brief(conflicts, target)`, `analyst_brief(number, text)`;
  - `checkpoint_message(percent)`, `recovery_note()`.
- Decisions taken here (also in `PHASE.md`):
  - The tester leaves the preview running, and the platform stops it at step end.
  - Drift control is part of the planner brief (it reads the last three built phases), so there is no
    separate refresh step.
  - The `close` action is done by the platform: a front-matter commit, no agent.

## Log

- Session 1: wrote both modules and declared PyYAML.
