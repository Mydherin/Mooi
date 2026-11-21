"""The `docs/factory/` contract of a Software Factory project, read deterministically.

The plan is plain Markdown written by agents and humans, but the orchestrator never reads prose: every
decision it takes comes from the YAML front matter of three kinds of files.

- `ROADMAP.md`: `phases: [{id, title, status, depends}]`, in the order they are built.
- `phases/<phase>/PHASE.md`: `{id, title, status, milestones: [ids in order]}`.
- `phases/<phase>/milestones/<milestone>.md`:
  `{id, title, status, depends, context, attempts, test}`.

Git is the source of truth: the platform state only caches what `read_plan` answers (`FactoryPlan.as_json`).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import yaml

ROOT = Path("docs/factory")
CORE_FILES = ("FACTORY.md", "VISION.md", "ARCHITECTURE.md", "DECISIONS.md", "ROADMAP.md")
FOUNDATIONS = "00-foundations"

PhaseStatus = Literal["planned", "expanded", "done", "reopened"]
MilestoneStatus = Literal["planned", "building", "testing", "attention", "done", "reopened"]
TestResult = Literal["none", "passed", "failed"]
PHASE_STATUSES: frozenset[str] = frozenset({"planned", "expanded", "done", "reopened"})
MILESTONE_STATUSES: frozenset[str] = frozenset({"planned", "building", "testing", "attention", "done", "reopened"})
TEST_RESULTS: frozenset[str] = frozenset({"none", "passed", "failed"})

_ID = re.compile(r"^[0-9]{2}-[a-z0-9][a-z0-9-]{0,80}$")
_FRONT_MATTER = re.compile(r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)", re.DOTALL)
_CONTEXT_REFERENCE = re.compile(r"context/[A-Za-z0-9._/-]+\.md")


@dataclass(frozen=True)
class Milestone:
    id: str
    phase_id: str
    title: str
    status: str
    depends: tuple[str, ...] = ()
    context: tuple[str, ...] = ()
    attempts: int = 0
    test: str = "none"

    @property
    def path(self) -> Path:
        return milestone_path(self.phase_id, self.id)


@dataclass(frozen=True)
class Phase:
    id: str
    title: str
    status: str
    depends: tuple[str, ...] = ()
    milestones: tuple[Milestone, ...] = ()

    @property
    def path(self) -> Path:
        return phase_path(self.id)


@dataclass(frozen=True)
class DocIssue:
    path: str
    message: str


@dataclass(frozen=True)
class FactoryPlan:
    phases: tuple[Phase, ...] = ()
    issues: tuple[DocIssue, ...] = ()
    core: dict[str, bool] = field(default_factory=dict)

    def phase(self, phase_id: str) -> Phase | None:
        return next((phase for phase in self.phases if phase.id == phase_id), None)

    def milestone(self, phase_id: str, milestone_id: str) -> Milestone | None:
        phase = self.phase(phase_id)
        return next((item for item in phase.milestones if item.id == milestone_id), None) if phase else None

    def as_json(self) -> dict[str, Any]:
        """The snapshot the UI shows; never read back to take a decision."""
        return {
            "core": self.core,
            "issues": [{"path": issue.path, "message": issue.message} for issue in self.issues],
            "phases": [{
                "id": phase.id, "title": phase.title, "status": phase.status, "depends": list(phase.depends),
                "milestones": [{
                    "id": item.id, "title": item.title, "status": item.status, "depends": list(item.depends),
                    "attempts": item.attempts, "test": item.test,
                } for item in phase.milestones],
            } for phase in self.phases],
        }


# What the orchestrator does next for a target, decided from front matter alone.
TargetAction = Literal["expand", "build", "test", "merge", "close", "attention"]


@dataclass(frozen=True)
class Target:
    action: TargetAction
    phase: Phase
    milestone: Milestone | None = None


def phase_path(phase_id: str) -> Path:
    return ROOT / "phases" / phase_id / "PHASE.md"


def milestone_path(phase_id: str, milestone_id: str) -> Path:
    return ROOT / "phases" / phase_id / "milestones" / f"{milestone_id}.md"


def milestone_branch(phase_id: str, milestone_id: str) -> str:
    return f"factory/{phase_id}/{milestone_id}"


# --- front matter --------------------------------------------------------------------------------


def split_front_matter(text: str) -> tuple[dict[str, Any] | None, str]:
    """`(front matter, body)`; `None` when the file has none or it is not a YAML mapping."""
    match = _FRONT_MATTER.match(text)
    if not match:
        return None, text
    try:
        data = yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        return None, text
    return (data if isinstance(data, dict) else None), text[match.end():]


def write_front_matter(path: Path, updates: dict[str, Any]) -> bool:
    """Merges `updates` into the file's front matter, keeping its key order and its body byte for byte.
    Answers whether the file changed."""
    text = path.read_text(encoding="utf-8")
    data, body = split_front_matter(text)
    merged = {**(data or {}), **updates}
    if data == merged:
        return False
    rendered = yaml.safe_dump(merged, sort_keys=False, allow_unicode=True, default_flow_style=None, width=1000)
    path.write_text(f"---\n{rendered}---\n{body}", encoding="utf-8")
    return True


def _strings(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        return (value,)
    if isinstance(value, list):
        return tuple(str(item) for item in value if isinstance(item, (str, int)))
    return ()


def _read(workspace: Path, relative: Path, issues: list[DocIssue]) -> dict[str, Any] | None:
    path = workspace / relative
    if not path.is_file():
        issues.append(DocIssue(str(relative), "File is missing"))
        return None
    data, _ = split_front_matter(path.read_text(encoding="utf-8", errors="replace"))
    if data is None:
        issues.append(DocIssue(str(relative), "Front matter is missing or is not valid YAML"))
    return data


# --- reading ---------------------------------------------------------------------------------------


def read_plan(workspace: Path) -> FactoryPlan:
    """Reads the whole plan of a checkout. Never raises on content: problems become `issues`, which
    the definition gate and the UI report, and the loop refuses to run while any is present."""
    issues: list[DocIssue] = []
    core = {name: (workspace / ROOT / name).is_file() for name in CORE_FILES}
    for name, present in core.items():
        if not present:
            issues.append(DocIssue(str(ROOT / name), "Core file is missing"))
    roadmap = _read(workspace, ROOT / "ROADMAP.md", []) if core["ROADMAP.md"] else None
    if core["ROADMAP.md"] and roadmap is None:
        issues.append(DocIssue(str(ROOT / "ROADMAP.md"), "Front matter is missing or is not valid YAML"))
    entries = (roadmap or {}).get("phases")
    if roadmap is not None and not isinstance(entries, list):
        issues.append(DocIssue(str(ROOT / "ROADMAP.md"), "`phases` must be a list"))
        entries = []

    phases: list[Phase] = []
    seen: set[str] = set()
    for index, entry in enumerate(entries or []):
        if not isinstance(entry, dict):
            issues.append(DocIssue(str(ROOT / "ROADMAP.md"), f"Phase #{index + 1} is not a mapping"))
            continue
        phase_id = str(entry.get("id") or "")
        status = str(entry.get("status") or "planned")
        if not _ID.match(phase_id) or phase_id in seen:
            issues.append(DocIssue(str(ROOT / "ROADMAP.md"), f"Phase #{index + 1} has an invalid or repeated id"))
            continue
        seen.add(phase_id)
        if status not in PHASE_STATUSES:
            issues.append(DocIssue(str(ROOT / "ROADMAP.md"), f"{phase_id}: unknown status `{status}`"))
            status = "planned"
        milestones = _read_milestones(workspace, phase_id, status, issues)
        phases.append(Phase(id=phase_id, title=str(entry.get("title") or phase_id), status=status,
                            depends=_strings(entry.get("depends")), milestones=milestones))

    plan = FactoryPlan(phases=tuple(phases), issues=tuple(issues), core=core)
    return FactoryPlan(phases=plan.phases, issues=tuple(issues + _consistency(workspace, plan)), core=core)


def _read_milestones(workspace: Path, phase_id: str, status: str, issues: list[DocIssue]) -> tuple[Milestone, ...]:
    if status == "planned" and not (workspace / phase_path(phase_id)).exists():
        return ()  # Not expanded yet: only its roadmap entry exists.
    header = _read(workspace, phase_path(phase_id), issues)
    if header is None:
        return ()
    milestones: list[Milestone] = []
    for milestone_id in _strings(header.get("milestones")):
        relative = milestone_path(phase_id, milestone_id)
        if not _ID.match(milestone_id):
            issues.append(DocIssue(str(phase_path(phase_id)), f"Invalid milestone id `{milestone_id}`"))
            continue
        data = _read(workspace, relative, issues)
        if data is None:
            continue
        milestone_status = str(data.get("status") or "planned")
        if milestone_status not in MILESTONE_STATUSES:
            issues.append(DocIssue(str(relative), f"Unknown status `{milestone_status}`"))
            milestone_status = "planned"
        test = str(data.get("test") or "none")
        attempts = data.get("attempts")
        milestones.append(Milestone(
            id=milestone_id, phase_id=phase_id, title=str(data.get("title") or milestone_id),
            status=milestone_status, depends=_strings(data.get("depends")),
            context=_strings(data.get("context")),
            attempts=attempts if isinstance(attempts, int) and attempts >= 0 else 0,
            test=test if test in TEST_RESULTS else "none",
        ))
    return tuple(milestones)


def _consistency(workspace: Path, plan: FactoryPlan) -> list[DocIssue]:
    """Cross-file rules: dependencies exist, context files are registered in the index."""
    issues: list[DocIssue] = []
    phase_ids = {phase.id for phase in plan.phases}
    milestone_ids = {item.id for phase in plan.phases for item in phase.milestones}
    for phase in plan.phases:
        for dependency in phase.depends:
            if dependency not in phase_ids:
                issues.append(DocIssue(str(ROOT / "ROADMAP.md"), f"{phase.id} depends on unknown `{dependency}`"))
        for item in phase.milestones:
            for dependency in item.depends:
                if dependency not in milestone_ids:
                    issues.append(DocIssue(str(item.path), f"Depends on unknown milestone `{dependency}`"))
            for reference in item.context:
                if not (workspace / ROOT / reference).is_file() and not (workspace / reference).is_file():
                    issues.append(DocIssue(str(item.path), f"Context file `{reference}` does not exist"))
    index = workspace / ROOT / "FACTORY.md"
    context = workspace / ROOT / "context"
    if index.is_file() and context.is_dir():
        registered = set(_CONTEXT_REFERENCE.findall(index.read_text(encoding="utf-8", errors="replace")))
        for path in sorted(context.rglob("*.md")):
            relative = f"context/{path.relative_to(context).as_posix()}"
            if relative not in registered:
                issues.append(DocIssue(str(ROOT / relative), "Not registered in FACTORY.md"))
    return issues


def definition_issues(plan: FactoryPlan) -> list[DocIssue]:
    """What still blocks approving the definition: every issue, plus at least Phase 0 in first place."""
    issues = list(plan.issues)
    if not plan.phases:
        issues.append(DocIssue(str(ROOT / "ROADMAP.md"), "The roadmap has no phases"))
    elif plan.phases[0].id != FOUNDATIONS:
        issues.append(DocIssue(str(ROOT / "ROADMAP.md"), f"The first phase must be `{FOUNDATIONS}`"))
    return issues


# --- deciding ----------------------------------------------------------------------------------------


def _done(ids: tuple[str, ...], finished: set[str]) -> bool:
    return all(item in finished for item in ids)


def next_target(plan: FactoryPlan) -> Target | None:
    """The single next piece of work, strictly in roadmap order; None once every phase is done.

    - A phase not expanded yet (or reopened without pending milestones) is expanded first.
    - Its first unfinished milestone is built, tested or merged by its own front matter; a milestone
      in `attention` stops the loop there.
    - A phase whose milestones are all done is closed.
    """
    finished_phases = {phase.id for phase in plan.phases if phase.status == "done"}
    finished_milestones = {item.id for phase in plan.phases for item in phase.milestones if item.status == "done"}
    for phase in plan.phases:
        if phase.status == "done":
            continue
        if not _done(phase.depends, finished_phases):
            return None  # The roadmap order contradicts its dependencies: the issue list explains it.
        pending = [item for item in phase.milestones if item.status != "done"]
        if phase.status == "planned" or not phase.milestones or (phase.status == "reopened" and not pending):
            return Target("expand", phase)
        if not pending:
            return Target("close", phase)
        milestone = pending[0]
        if not _done(milestone.depends, finished_milestones):
            return Target("attention", phase, milestone)
        if milestone.status == "attention":
            return Target("attention", phase, milestone)
        if milestone.status == "testing":
            return Target("merge" if milestone.test == "passed" else "test", phase, milestone)
        return Target("build", phase, milestone)
    return None
