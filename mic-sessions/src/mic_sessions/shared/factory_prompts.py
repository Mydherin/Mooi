"""Briefs and templates of the Software Factory: everything an agent of the factory is told.

The orchestrator decides *what* runs next from front matter alone (`factory_docs`); these briefs tell
each fresh session *how*: which files to read (and nothing more), what it may write, and how it reports
its outcome. Every brief is self-contained, because each step starts with an empty context.
"""

from __future__ import annotations

from dataclasses import dataclass

from mic_sessions.shared import factory_docs

# --- templates of docs/factory/ ----------------------------------------------------------------

FACTORY_TEMPLATE = """# Software Factory

Index of this project's factory documents. Every agent session reads this file first, then only the
files its task names. Keep this index truthful: a file not listed here does not exist for the factory.

## Files

| File | Read when |
| --- | --- |
| `VISION.md` | Planning a phase, analysing a change request, or a milestone needs product intent |
| `ARCHITECTURE.md` | Always for building; sections relevant to the milestone only |
| `DECISIONS.md` | Planning, analysing a change, or a task touches a decided area |
| `ROADMAP.md` | Planning or analysing; builders and testers never need it |
| `context/<name>.md` | As each entry below says; milestones declare the ones they need in `context` |

## Context files

<!-- One line per file: - `context/<name>.md`: read when ... -->

## Conventions

- Phases live in `phases/<nn>-<slug>/PHASE.md`; milestones in `phases/<nn>-<slug>/milestones/<nn>-<slug>.md`.
- The YAML front matter of `ROADMAP.md`, `PHASE.md` and milestone files drives the factory: keep it valid.
- Decisions: `D-<nnn>` in `DECISIONS.md` (global), `D-<phase nn>.<n>` in a `PHASE.md`; each says what it affects.
- Change requests are referenced as `CR-<n>` wherever they changed something.
- Production deployments and backups are out of the factory: never touch `deploy/production/` or backup files.
"""

VISION_TEMPLATE = """# Vision

## Problem and goals

## Users

## In scope

## Out of scope

## Success criteria
"""

ARCHITECTURE_TEMPLATE = """# Architecture

## Stack

## Structure

## Conventions

## Testing policy

<!-- Unit and integration tests: whether the project writes them and how they run. They belong to
building; the factory's own testing step is end to end only. -->

## Development deployment

<!-- How the Mooi dev deployment (root Compose file) runs the project, and how to reach each feature. -->
"""

DECISIONS_TEMPLATE = """# Decisions

<!-- Newest last. A decision is never deleted: a later one supersedes it and says so.

## D-001 Title
- Context:
- Decision:
- Affects: phases / milestones / files
- Origin: definition | CR-<n>
-->
"""

ROADMAP_TEMPLATE = """---
phases:
  - id: 00-foundations
    title: Foundations
    status: planned
    depends: []
---

# Roadmap

Phases in the order they are built. Each line explains what the phase delivers and why it comes there.

- **00-foundations**: technical base and the Mooi development deployment, so every milestone can be
  tested end to end. Production deployments and backups are not part of the factory.
"""

PHASE_TEMPLATE = """---
id: {phase_id}
title: {title}
status: expanded
milestones: []
---

# Phase {phase_id}: {title}

## Goal

## Functional detail

## Technical detail

## Assumptions

<!-- What this phase relies on from earlier phases; refreshed when they are built. -->

## Decisions

<!-- D-<nn>.<n> Title — context, decision, affects. -->

## Milestones

<!-- Ordered; each one self-contained and testable end to end. -->
"""

MILESTONE_TEMPLATE = """---
id: {milestone_id}
title: {title}
status: planned
depends: []
context: []
attempts: 0
test: none
---

# Milestone {milestone_id}: {title}

## Spec

## End-to-end criteria

<!-- Numbered, observable through the running preview: steps, expected result. -->

## Tasks

- [ ] ...

## State

Not started.

## Tests

## Log
"""


# --- the platform API every factory session uses ---------------------------------------------


@dataclass(frozen=True)
class BriefContext:
    """What every brief needs to know about the session it is sent to."""

    api_root: str  # http://127.0.0.1:<port>/sessions/<id>
    agent_token: str
    branch: str
    default_branch: str


def agent_api(context: BriefContext, *, chat: bool = False) -> str:
    """The factory part of a factory session's standing instructions."""
    root = f"{context.api_root}/factory/agent"
    common = f"""## Software Factory
This session belongs to the project's Software Factory: a platform-driven loop that builds the project phase by phase and milestone by milestone, in fresh sessions. Its documents live under `docs/factory/` and their YAML front matter drives the loop, so keep it valid.
- `GET {root}`: the factory's status, the target of this session and the plan Mooi read (`plan.issues` lists what is inconsistent)."""
    if chat:
        return common + f"""
- `POST {root}/publish` with JSON `{{"message": "<conventional commit title>"}}`: commits this chat's changes to `{context.default_branch}` (only while the factory is being defined).
- `POST {root}/approve`: approves the definition (only once the user explicitly confirmed it in this conversation). It answers the remaining `issues` when the documents are not ready.
- `POST {root}/change-requests` with JSON `{{"text": "<the change, complete and self-contained>"}}`: queues a change the user decided; the factory applies it at its next safe point.
- `POST {root}/pause` with JSON `{{"mode": "graceful"}}` (or `"immediate"`), and `POST {root}/resume` with JSON `{{}}` (the last agent selection) once the user confirmed which model resumes it."""
    return common + f"""
- `POST {root}/outcome` with JSON `{{"outcome": "completed" | "continue" | "failed" | "blocked", "summary": "<one paragraph>"}}`: ends this step. Call it exactly once, as your very last action, after committing.
  - `completed`: this step's goal is reached and the documents say so.
  - `continue`: progress is committed and the milestone's *State* says exactly what comes next; a fresh session continues.
  - `failed`: (testers) the end-to-end test failed and *Tests* records why.
  - `blocked`: only a human can unblock it (missing credentials, a contradiction in the plan); *State* explains what is needed.
- Mooi may ask you to checkpoint at any moment, because sessions stop early to keep their context small. When it does, stop where you are, follow its message and report `continue`."""


_PROTOCOL = """## Factory protocol
- Read `docs/factory/FACTORY.md` first, then only the files listed below. Do not explore other documents of `docs/factory/`.
- Trust the documents: never re-analyse what they already decide. A new decision goes into the right decisions section, with its reason and what it affects.
- Keep the files you own truthful at every moment: the session may stop at any time.
- Commit your work with conventional commit messages as you go. Never push, rebase, reset or switch branches: Mooi publishes the branch when the step ends.
- Never touch `deploy/production/`, backup files or anything outside this step's scope."""


def _files(*paths: str) -> str:
    return "\n".join(f"- `{path}`" for path in paths)


def _milestone_files(milestone: factory_docs.Milestone) -> list[str]:
    root = factory_docs.ROOT
    return [str(root / "FACTORY.md"), str(root / "ARCHITECTURE.md") + " (sections this milestone needs)",
            str(factory_docs.phase_path(milestone.phase_id)), str(milestone.path),
            *(str(root / item) if not item.startswith("docs/") else item for item in milestone.context)]


# --- definition ------------------------------------------------------------------------------------


def architect_brief(request: str | None) -> str:
    """The factory chat while the project is being defined, with the human."""
    root = factory_docs.ROOT
    asked = f"\n## The user's request\n{request.strip()}\n" if request and request.strip() else ""
    return f"""You are the architect of this project's Software Factory. Define the project together with the user; once they approve it, the factory builds it autonomously for days or weeks, phase by phase and milestone by milestone, in fresh agent sessions.
{asked}
## What to define with the user
1. Closed scope: goals, users, what is in and explicitly out of scope, success criteria.
2. Base functional and technical decisions: stack, architecture, conventions, the testing policy (whether the project writes unit tests; the factory always tests end to end), integrations and data model.
3. High-level phases in the most efficient order to complete the project: each phase delivers something coherent and testable, and depends only on earlier ones. `00-foundations` always comes first: the technical base plus the Mooi development deployment (the root Compose file, set up following the Deploy button's brief), so that every milestone can be tested end to end in a live preview. Production deployments and backups are never part of the factory: they are prepared later from their own Mooi chats.

Ask about what matters, propose sensible defaults for the rest, and surface trade-offs. Do not write code.

## Documents
When the user agrees, write them under `{root}/` from these templates, filling every section concretely:
- `FACTORY.md` (index; keep its conventions), `VISION.md`, `ARCHITECTURE.md`, `DECISIONS.md` (the base decisions, each with what it affects) and `ROADMAP.md` (front matter: every phase with `id` `<nn>-<slug>`, `title`, `status: planned`, `depends`).
- `context/<name>.md` only for knowledge the project needs by its nature (domain, data model, design system, integrations...), each registered in `FACTORY.md` with when to read it.
- Do not expand phases: the factory expands each one when its turn comes.

Then commit, publish them with the factory API and check `plan.issues` with `GET` until there are none. Show the user a short summary and ask for explicit approval; approve only after they confirm. Afterwards the factory starts once the user picks the agent that runs it.

### FACTORY.md
```markdown
{FACTORY_TEMPLATE}```

### VISION.md
```markdown
{VISION_TEMPLATE}```

### ARCHITECTURE.md
```markdown
{ARCHITECTURE_TEMPLATE}```

### DECISIONS.md
```markdown
{DECISIONS_TEMPLATE}```

### ROADMAP.md
```markdown
{ROADMAP_TEMPLATE}```"""


def steering_brief() -> str:
    """The factory chat once the loop exists: it explains, discusses and turns decisions into requests."""
    return """You are the steering chat of this project's Software Factory, which builds the project autonomously.

- Explain the factory's status, plan, decisions and progress when asked (`GET` the factory, then read `docs/factory/` files as needed).
- Discussing changes nothing. When the user decides a functional or technical change, write it as one complete, self-contained change request and queue it: the factory analyses its impact at its next safe point, updates the decisions and reopens the affected phases with delta milestones.
- Never edit `docs/factory/` or the code from this chat while the factory exists: one writer keeps the plan consistent.
- Pause or resume the factory when the user asks; before resuming, tell them which agent selection it resumes with.
- Production deployments and backups are outside the factory: point the user to their Mooi pages."""


# --- the loop ---------------------------------------------------------------------------------------


def planner_brief(phase: factory_docs.Phase, previous: list[factory_docs.Phase], reopened: bool) -> str:
    root = factory_docs.ROOT
    done = ", ".join(f"`{item.id}`" for item in previous) or "none"
    files = [str(root / name) for name in ("FACTORY.md", "VISION.md", "ARCHITECTURE.md", "DECISIONS.md",
                                           "ROADMAP.md")]
    files += [str(item.path) for item in previous[-3:]]
    if reopened:
        files.append(str(phase.path))
    milestone_dir = factory_docs.phase_path(phase.id).parent / "milestones"
    action = ("This phase was reopened by a change request: add delta milestones for what is still missing, keep "
              "the finished ones untouched." if reopened else "Expand it completely.")
    return f"""You are the planner of the Software Factory. Phase `{phase.id}` ({phase.title}) is next. {action}

Phases already built: {done}. Read what you need of them to align with what was actually built: their code is in this branch.

{_PROTOCOL}

## Read
{_files(*files)}

## Write (on `{factory_docs.phase_path(phase.id).parent}/`)
1. `PHASE.md` from the template below: full functional and technical detail, assumptions on earlier phases, the phase decisions and the ordered milestone ids in `milestones`. Set `status: expanded`.
2. One file per milestone in `{milestone_dir}/` from the milestone template. Each milestone is self-contained and small enough for a few short sessions: concrete *Spec*, numbered *End-to-end criteria* observable in the running preview, ordered *Tasks*, and `context` naming the context files it needs. Use `depends` only for milestones of this phase.
3. Update `{root / "ROADMAP.md"}`: this phase's `status: expanded`. Add global decisions to `DECISIONS.md` only if the phase forces one, and refresh the *Assumptions* of later phases only when what was built contradicts them.

When a large phase does not fit, commit what is complete, describe the rest in `PHASE.md` › *Milestones* and report `continue`. Report `completed` once every milestone file exists and the front matter is valid (`GET` the factory: `plan.issues` must not mention this phase).

### PHASE.md
```markdown
{PHASE_TEMPLATE.format(phase_id=phase.id, title=phase.title)}```

### Milestone file
```markdown
{MILESTONE_TEMPLATE.format(milestone_id="<nn>-<slug>", title="<title>")}```"""


def builder_brief(milestone: factory_docs.Milestone, *, foundations_deployment: bool) -> str:
    fix = ("\nThe latest end-to-end test failed: start with the newest entry of *Tests*, fix every bug it reports, "
           "then continue with the tasks." if milestone.test == "failed" else "")
    deployment = ("\n## Development deployment\nThis milestone sets up the Mooi development deployment: `GET` "
                  "the deployment brief of your instructions and follow it exactly, including its test. The setup "
                  "must keep working in Mooi sessions, local runs and production." if foundations_deployment else "")
    return f"""You are a builder of the Software Factory. Build milestone `{milestone.id}` ({milestone.title}) on this branch.{fix}

{_PROTOCOL}

## Read
{_files(*_milestone_files(milestone))}

## Work
1. Set the milestone's front matter `status: building` if it is not yet.
2. Work through *Tasks* in order. Write unit or integration tests only if `ARCHITECTURE.md` › *Testing policy* says so. Keep type checks, linters and builds passing.
3. After each task: check it in *Tasks*, rewrite *State* (what is done, the exact next step, files in play, gotchas) and add one line to *Log*. Commit.
4. When every task is done and the project builds, set `status: testing` and `test: none`, commit and report `completed`. Testing is done by another session: do not run the end-to-end criteria yourself.
{deployment}"""


def tester_brief(milestone: factory_docs.Milestone, preview_root: str) -> str:
    root = factory_docs.ROOT
    return f"""You are the end-to-end tester of the Software Factory. Test milestone `{milestone.id}` ({milestone.title}) on this branch. You never change application code.

{_PROTOCOL}

## Read
{_files(str(root / "FACTORY.md"), str(root / "ARCHITECTURE.md") + " › Development deployment", str(milestone.path))}

## Test
1. Deploy this branch with the development deployment API of your instructions (`POST .../deployment/agent/start`, then `GET .../deployment/agent?wait=120` until it is running). If it fails, that is a failed test: record the output.
2. Open the preview in the browser tool at `{preview_root}` followed by the snapshot's `previewUrl`, and run every *End-to-end criterion* as a user would, on desktop and phone viewports.
3. Write a new entry at the top of *Tests*: date, the result of each criterion and, for each failure, reproducible steps, expected and actual result and evidence (console errors, failing requests).
4. Front matter: on success `test: passed`; on failure `test: failed`, `status: building` and `attempts` plus one. Add one line to *Log*, commit.
5. Report `completed` when it passed, `failed` otherwise. Leave the preview as it is: Mooi stops it when the step ends."""


def merger_brief(conflicts: list[str], target: str) -> str:
    files = "\n".join(f"- `{path}`" for path in conflicts) or "- (none reported)"
    return f"""You are the merger of the Software Factory. `{target}` moved on since this milestone branch started: merge it in, keeping the features of both sides.

`origin/{target}` has just been fetched; do not fetch, pull, push, rebase, reset or switch branches.

Files expected to conflict:
{files}

1. Commit any pending change so nothing is lost.
2. Run `git merge --no-ff --no-commit origin/{target}` and resolve every conflict preserving both sides. Plan documents of `docs/factory/`: keep `{target}`'s version of `ROADMAP.md`, `DECISIONS.md` and every `PHASE.md`, and this branch's version of its own milestone file, merging both sides' lines where both changed.
3. Make sure no conflict marker remains and the project builds, then commit the merge and report `completed`."""


def analyst_brief(number: int, text: str) -> str:
    root = factory_docs.ROOT
    return f"""You are the impact analyst of the Software Factory. Apply change request CR-{number}, decided by the user:

> {text.strip().replace(chr(10), chr(10) + "> ")}

{_PROTOCOL}

## Read
{_files(*(str(root / name) for name in ("FACTORY.md", "VISION.md", "ARCHITECTURE.md", "DECISIONS.md", "ROADMAP.md")))}
- Every `PHASE.md` and milestone file the change may affect (follow the decisions' *Affects*).

## Apply
1. Decide which decisions, phases and milestones it affects. Record new or superseding decisions with `Origin: CR-{number}`.
2. Phases and milestones not built yet: update them in place.
3. Built ones (`done`): never rewrite history. Set the phase `status: reopened` in `ROADMAP.md` and its `PHASE.md`, and add delta milestones `<nn>-delta-cr{number}-<slug>` (status `planned`) at the end of its `milestones`, with their own criteria.
4. New scope: add phases to the roadmap where they fit best.
5. If the change alters `VISION.md` scope (in or out of scope, goals), do not apply it: describe the impact in your summary and report `blocked`, so the user confirms first. Otherwise commit and report `completed` with a summary of every affected document."""


def checkpoint_message(percent: float) -> str:
    return f"""Checkpoint: this session reached {percent:.0f}% of its context window, the factory's limit for one session. Stop the current task now, without starting anything new:
1. Commit everything with a conventional message.
2. Rewrite the milestone's *State* so a fresh session continues without rediscovering anything: what is done, the exact next step, files in play, gotchas. Add one line to *Log*. Commit.
3. Report `continue` (or `completed` if the step's goal is reached) through the factory outcome API."""


def recovery_note() -> str:
    return """
## Recovery
The previous session of this step ended without a clean handover. Before anything else, read `git log -5 --stat` and the last `chore(factory): checkpoint` commit, bring *State* back in line with the code, commit, then continue."""
