"""Feature: the Software Factory orchestrator.

A deterministic state machine drives each running factory, never an agent (D1, D8). One `FactoryRunner`
task per live factory repeats the same cycle:

1. read the plan's front matter from the factory's control checkout of the default branch;
2. decide the single next piece of work with `factory_docs.next_target`;
3. run it as one *step*: a fresh, ordinary session (`kind="session"` with a `FactoryBinding`) that gets
   its role brief, works, commits and reports an explicit outcome through the agent API below;
4. close the step: safety commit, publish (milestone branch push, or squash onto the default branch for
   plan-level roles), journal it in `mic-mooi` and close the session.

`mic-mooi` is the system of record (status, run selection, step journal); Git holds the plan and wins on
any disagreement. Nothing here is persisted in memory beyond one cycle: after a restart the runner reads
everything again, marks the step it lost as interrupted and starts a fresh one for the same target.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Callable
from contextlib import suppress
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from mic_sessions.features import sessions
from mic_sessions.shared import factory_docs, factory_prompts, mooi, workspaces
from mic_sessions.shared.agents import STATUS_FAILED, STATUS_READY
from mic_sessions.shared.auth import Caller
from mic_sessions.shared.env import get_settings
from mic_sessions.shared.mooi import GitIdentity
from mic_sessions.shared.web import ApiException

LOG = logging.getLogger("factories")

EVENT_FACTORY_UPDATED = "factory.updated"
Outcome = Literal["completed", "continue", "failed", "blocked"]

# The factory's own sign-in is renewed this long before its access token expires.
_RENEWAL_MARGIN_SECONDS = 120
# Back-off between failed cycles (mic-mooi or GitHub unreachable, no free session...); past the last one
# the factory pauses with reason `error`.
_RETRY_SECONDS = (15, 30, 60, 120, 300)
# Consecutive steps on one target that commit nothing before the factory asks for attention.
_MAX_STALLED_STEPS = 3
# How long an agent that reported its outcome may take to end its turn before it is interrupted.
_SETTLE_SECONDS = 60
# Best effort at shutdown: the safety commit and push of a running step.
_SHUTDOWN_SECONDS = 60

_ROLES = {"expand": "planner", "build": "builder", "test": "tester"}
_PLAN_ROLES = frozenset({"planner", "analyst"})


class _Revoked(Exception):
    """The factory's sign-in was revoked (sign out everywhere, kick, ban): the run cannot act anymore."""


class _Ended(Exception):
    """The step's session ended before its step did."""


def _key(phase_id: str | None, milestone_id: str | None) -> tuple[str | None, str | None]:
    return phase_id, milestone_id


def _target_key(target: factory_docs.Target | None) -> tuple[str, str | None, str | None] | None:
    if target is None:
        return None
    return target.action, target.phase.id, target.milestone.id if target.milestone else None


def _label(target: factory_docs.Target) -> str:
    return f"{target.phase.id}/{target.milestone.id}" if target.milestone else target.phase.id


def _workspace(session: sessions.Session | None) -> Path | None:
    """The step's clone once provisioning made it; never the unset placeholder path."""
    if session is None or not session.workspace.is_absolute() or not (session.workspace / ".git").exists():
        return None
    return session.workspace


def _ended(session: sessions.Session) -> bool:
    return session.closing or session.status in (STATUS_FAILED, "closed")


@dataclass
class _Step:
    """One step while it runs: what the observer and the agent endpoint report, and how it ended."""

    id: UUID
    role: str
    target: factory_docs.Target
    branch: str
    session: sessions.Session | None = None
    base_commit: str | None = None
    # Reported by the agent (`POST .../factory/agent/outcome`).
    outcome: Outcome | None = None
    summary: str = ""
    turns: int = 0
    peak_context: float = 0.0
    wake: asyncio.Event = field(default_factory=asyncio.Event)
    # Decided by the runner once the step is over; `_close` reads them, so a failed close can be retried.
    status: str = "interrupted"
    note: str = ""
    published: bool = False
    journaled: bool = False
    attention: str | None = None


class FactoryRunner:
    """The loop of one factory. Only this task writes the factory's operational state while it runs."""

    def __init__(self, factory_id: UUID) -> None:
        self.factory_id = factory_id
        self.player_id: UUID | None = None
        self.factory: dict[str, Any] = {}
        self.caller: Caller | None = None
        self.identity: GitIdentity | None = None
        self.step: _Step | None = None
        self.task: asyncio.Task[None] | None = None
        # Targets whose last step ended without a clean handover: their next brief asks for recovery.
        self.recovering: set[tuple[str | None, str | None]] = set()
        self.stalled: tuple[tuple[str | None, str | None], int] | None = None

    # --- state in mic-mooi ---------------------------------------------------------------------------

    def _loaded(self, internal: dict[str, Any]) -> None:
        self.player_id = UUID(str(internal["playerId"]))
        self.factory = internal["factory"]
        self._announce()

    def _announce(self) -> None:
        if self.player_id is not None and self.factory:
            sessions.publish(self.player_id, EVENT_FACTORY_UPDATED,
                             {"projectId": self.factory.get("projectId"), "factory": self.factory})

    async def _load(self) -> None:
        self._loaded(await mooi.fetch_internal_factory(self.factory_id))

    async def _save(self, **changes: Any) -> None:
        """Writes against the revision read; a concurrent write (409) is read again and applied once more."""
        for attempt in range(2):
            body = {"revision": self.factory["revision"], "status": self.factory["status"],
                    "pauseReason": self.factory.get("pauseReason"), "attention": self.factory.get("attention"),
                    **changes}
            try:
                self._loaded(await mooi.update_factory(self.factory_id, body))
                return
            except ApiException as error:
                if error.status_code != 409 or attempt:
                    raise
                await self._load()

    async def _pause(self, reason: str, message: str | None) -> None:
        LOG.info("Factory %s pauses (%s): %s", self.factory_id, reason, message or "-")
        await self._save(status="paused", pauseReason=reason, attention=message[:2000] if message else None)

    async def _access(self) -> Caller:
        """The factory's own caller (D2), renewed before it expires; a refusal means the grant was revoked."""
        if self.caller is None or self.caller.expires_at - time.time() <= _RENEWAL_MARGIN_SECONDS:
            try:
                self.caller = await mooi.factory_access(self.factory_id)
            except ApiException as error:
                if error.status_code in (401, 403):
                    raise _Revoked from None
                raise
        return self.caller

    # --- the loop -----------------------------------------------------------------------------------

    async def run(self) -> None:
        failures, started = 0, False
        try:
            while True:
                try:
                    if not started:
                        await self._start()
                        started = True
                    if not await self._cycle():
                        return
                    failures = 0
                except asyncio.CancelledError:
                    raise
                except _Revoked:
                    with suppress(Exception):
                        await self._pause("revoked", "The factory's sign-in was revoked. Resume it to continue.")
                    return
                except Exception:
                    LOG.exception("Factory %s cycle failed", self.factory_id)
                    failures += 1
                    if failures > len(_RETRY_SECONDS):
                        with suppress(Exception):
                            await self._pause("error", "The factory stopped after repeated errors. Resume it to retry.")
                        return
                    await asyncio.sleep(_RETRY_SECONDS[failures - 1])
        finally:
            if _runners.get(self.factory_id) is self:
                _runners.pop(self.factory_id, None)

    async def _start(self) -> None:
        """Reconciles what a restart left behind: the step this factory was running is lost, so it is
        journaled as interrupted and its target resumes with a recovery brief."""
        await self._load()
        stale = self.factory.get("activeStep")
        if stale:
            await mooi.update_factory_step(self.factory_id, UUID(str(stale["id"])), {
                "status": "interrupted", "summary": "Mooi restarted while this step ran; a fresh step resumes it."})
            self.recovering.add(_key(stale.get("phaseId"), stale.get("milestoneId")))
            await self._load()
        await mooi.reconcile_factory_steps(_active_steps())
        if self.factory.get("status") == "pausing":
            # Nothing runs after a restart: a graceful pause that was waiting for its step is complete.
            await self._save(status="paused", pauseReason="user")

    async def _cycle(self) -> bool:
        """One decision and its work; False once the loop has nothing left to do."""
        if self.step is not None:
            await self._close(self.step)  # A close that failed in the previous cycle.
        await self._load()
        if self.factory.get("status") != "running":
            return False
        caller = await self._access()
        project = await mooi.fetch_project(caller, UUID(str(self.factory["projectId"])))
        token = await mooi.fetch_github_token(caller)
        checkout, commit = await workspaces.factory_checkout(self.factory_id, project.full_name,
                                                             project.default_branch, token)
        plan = await asyncio.to_thread(factory_docs.read_plan, checkout)
        snapshot = plan.as_json()
        if commit != self.factory.get("planCommit") or snapshot != self.factory.get("plan"):
            await self._save(plan=json.dumps(snapshot), planCommit=commit)
        if plan.issues:
            listed = "; ".join(f"{issue.path}: {issue.message}" for issue in plan.issues[:10])
            await self._pause("attention", f"The plan in docs/factory needs fixing: {listed}")
            return False
        target = factory_docs.next_target(plan)
        if target is None:
            await self._save(status="resting", attention=None)
            return False
        if target.action == "attention":
            await self._pause("attention", f"Milestone {_label(target)} needs attention (see its State and Tests).")
            return False
        if target.action == "close":
            await self._close_phase(checkout, target, project, caller, token)
            return True
        if target.action == "merge":
            await self._pause("attention", f"Milestone {_label(target)} passed its test; merging is not available yet.")
            return False
        return await self._run_step(target, plan, project, caller, token)

    # --- steps -------------------------------------------------------------------------------------

    async def _run_step(self, target: factory_docs.Target, plan: factory_docs.FactoryPlan, project: mooi.Project,
                        caller: Caller, token: str) -> bool:
        run = self.factory.get("runConfig") or {}
        if not run.get("provider") or not run.get("connectionId"):
            await self._pause("attention", "Choose the agent that runs the factory, then resume it.")
            return False
        role = _ROLES[target.action]
        milestone = target.milestone
        branch = factory_docs.milestone_branch(target.phase.id, milestone.id) if milestone else project.default_branch
        step = _Step(id=uuid4(), role=role, target=target, branch=branch)
        await mooi.open_factory_step(self.factory_id, {
            "id": str(step.id), "role": role, "phaseId": target.phase.id,
            "milestoneId": milestone.id if milestone else None, "branch": branch, "model": run.get("model")})
        self.step = step
        try:
            session = await sessions.open_session(sessions.CreateSessionRequest(
                projectId=project.id, provider=run["provider"], adapter=run.get("adapter"),
                connectionId=UUID(str(run["connectionId"])), branch=branch, model=run.get("model"),
                effort=run.get("effort"),
            ), caller, sessions.FactoryBinding(self.factory_id, role, step.id, target.phase.id,
                                               milestone.id if milestone else None))
            step.session = session
            await mooi.update_factory_step(self.factory_id, step.id, {"sessionId": str(session.id), "status": "running"})
            await self._load()
            await self._wait(step, lambda: session.status == STATUS_READY, "The session could not start")
            workspace = _workspace(session)
            if workspace is None:
                raise _Ended("The session has no workspace")
            step.base_commit = await workspaces.head_commit(workspace)
            identity = await self._identity(caller)
            await workspaces.set_identity(workspace, identity)
            brief = self._brief(step, plan, project)
            if milestone is not None:
                conflicts = await workspaces.integrate(workspace, project.default_branch, identity, token)
                if conflicts:
                    step = await self._merger(step, project)
                    brief = factory_prompts.merger_brief(conflicts, project.default_branch)
            if _key(target.phase.id, milestone.id if milestone else None) in self.recovering:
                brief += factory_prompts.recovery_note()
            await sessions.deliver(session, await self._access(), brief)
            await self._await_outcome(step)
            await self._verify(step, project, token)
        except asyncio.CancelledError:
            raise  # Shutdown: `stop` saves the work; the next boot journals the step as interrupted.
        except _Ended as ended:
            step.status, step.note = "interrupted", str(ended)
        except _Revoked:
            raise  # Without a grant nothing can be published: the session stays open with the work.
        except Exception:
            LOG.exception("Factory %s step %s failed", self.factory_id, step.id)
            step.status, step.note = "interrupted", "The step stopped on an unexpected error"
            await self._close(step)
            raise
        return await self._close(step)

    def _brief(self, step: _Step, plan: factory_docs.FactoryPlan, project: mooi.Project) -> str:
        target = step.target
        if step.role == "planner":
            previous = []
            for phase in plan.phases:
                if phase.id == target.phase.id:
                    break
                if phase.status == "done":
                    previous.append(phase)
            return factory_prompts.planner_brief(target.phase, previous, reopened=target.phase.status == "reopened")
        milestone = target.milestone
        assert milestone is not None
        if step.role == "tester":
            return factory_prompts.tester_brief(milestone, f"http://127.0.0.1:{get_settings().sessions_port}")
        foundations = (milestone.phase_id == factory_docs.FOUNDATIONS and project.web_application
                       and not project.development_deployment_ready)
        return factory_prompts.builder_brief(milestone, foundations_deployment=foundations)

    async def _merger(self, step: _Step, project: mooi.Project) -> _Step:
        """The default branch conflicts with the milestone branch: the same session first merges it in,
        as a step of its own, so the journal shows why; the role's own work follows in a fresh session."""
        session = step.session
        assert session is not None and session.factory is not None
        step.status, step.published = "continue", True
        step.note = f"{project.default_branch} moved on with conflicting changes: a merger step integrates it first."
        await mooi.update_factory_step(self.factory_id, step.id, {
            "status": step.status, "summary": step.note, "headCommit": step.base_commit})
        merger = _Step(id=uuid4(), role="merger", target=step.target, branch=step.branch, session=session,
                       base_commit=step.base_commit)
        milestone = step.target.milestone
        await mooi.open_factory_step(self.factory_id, {
            "id": str(merger.id), "role": "merger", "phaseId": step.target.phase.id,
            "milestoneId": milestone.id if milestone else None, "sessionId": str(session.id),
            "branch": step.branch, "model": session.config.model, "baseCommit": step.base_commit})
        session.factory = replace(session.factory, role="merger", step_id=merger.id)
        self.step = merger
        await self._load()
        return merger

    async def _wait(self, step: _Step, condition: Callable[[], bool], ended: str) -> None:
        """Waits until `condition()` holds; the session ending first ends the step."""
        session = step.session
        assert session is not None
        while not condition():
            if _ended(session):
                raise _Ended(ended)
            step.wake.clear()
            await step.wake.wait()

    async def _await_outcome(self, step: _Step) -> None:
        """Waits for the agent's outcome. A turn that ends without one gets a single reminder; a second
        one ends the step as `continue`, so a silent agent never stalls the loop."""
        session = step.session
        assert session is not None
        handled, reminded = step.turns, False
        while step.outcome is None:
            if _ended(session):
                raise _Ended("The session ended before reporting an outcome")
            if step.turns > handled and session.status == STATUS_READY:
                handled = step.turns
                if reminded:
                    step.note = "The agent ended its turn twice without reporting an outcome"
                    return
                reminded = True
                await sessions.deliver(session, await self._access(), factory_prompts.outcome_reminder())
                handled = step.turns
                continue
            step.wake.clear()
            await step.wake.wait()
        # The outcome is the agent's last action: let it end its turn before Mooi takes the workspace.
        if not _ended(session) and session.status != STATUS_READY:
            with suppress(TimeoutError, _Ended):
                await asyncio.wait_for(self._wait(step, lambda: session.status == STATUS_READY, ""), _SETTLE_SECONDS)
        if not _ended(session) and session.status != STATUS_READY:
            await sessions.interrupt(session)

    async def _verify(self, step: _Step, project: mooi.Project, token: str) -> None:
        """D6: an outcome counts only when the documents (or Git, for a merger) agree with it."""
        if step.outcome is None:
            step.status = "continue"
            return
        if step.outcome in ("continue", "blocked"):
            step.status = step.outcome
            return
        workspace = _workspace(step.session)
        if workspace is None:
            raise _Ended("The session has no workspace")
        if step.role == "merger":
            if await workspaces.merge_in_progress(workspace):
                agreed = False
            else:
                agreed = not await workspaces.integrate(workspace, project.default_branch, await self._identity(None),
                                                        token)
        else:
            after = await asyncio.to_thread(factory_docs.read_plan, workspace)
            agreed = _target_key(factory_docs.next_target(after)) != _target_key(step.target)
            if step.role == "planner":
                agreed = agreed and not after.issues
        if agreed:
            step.status = "failed" if step.outcome == "failed" else "completed"
        else:
            step.status = "continue"
            step.note = f"The agent reported `{step.outcome}`, but the documents do not show it; the next session continues."

    async def _close(self, step: _Step) -> bool:
        """Ends a step without ever losing work: safety commit, publish, journal, close the session. Each
        part runs once, so a close that failed halfway is simply retried by the next cycle."""
        caller = await self._access()
        session = step.session
        workspace = _workspace(session)
        head = step.base_commit
        if workspace is not None and not step.published:
            token = await mooi.fetch_github_token(caller)
            project = await mooi.fetch_project(caller, UUID(str(self.factory["projectId"])))
            await workspaces.checkpoint_commit(workspace, f"chore(factory): checkpoint {step.role} {_label(step.target)}",
                                               await self._identity(caller))
            step.attention = await self._publish(step, workspace, project, token)
            step.published = True
        if workspace is not None:
            head = await workspaces.head_commit(workspace)
        if not step.journaled:
            summary = "\n\n".join(part for part in (step.summary, step.note) if part)[:4000]
            await mooi.update_factory_step(self.factory_id, step.id, {
                "status": step.status, "summary": summary or None, "headCommit": head,
                "peakContextPercent": max(0, min(100, round(step.peak_context)))})
            step.journaled = True
        if session is not None:
            await sessions.close_session(session.id)
        self.step = None
        await self._load()

        key = _key(step.target.phase.id, step.target.milestone.id if step.target.milestone else None)
        if step.outcome is not None and step.status == step.outcome:
            self.recovering.discard(key)
        else:
            self.recovering.add(key)
        progressed = head is not None and head != step.base_commit
        count = 0 if progressed else (self.stalled[1] + 1 if self.stalled and self.stalled[0] == key else 1)
        self.stalled = (key, count)
        if step.attention:
            await self._pause("attention", step.attention)
            return False
        if step.status == "blocked":
            await self._pause("attention", f"The {step.role} of {_label(step.target)} is blocked: "
                                           f"{step.summary or 'see its State'}")
            return False
        if count >= _MAX_STALLED_STEPS:
            await self._pause("attention", f"{count} sessions in a row made no progress on {_label(step.target)}.")
            return False
        return True

    async def _publish(self, step: _Step, workspace: Path, project: mooi.Project, token: str) -> str | None:
        """Milestone work goes to its branch; plan work is squashed onto the default branch (D4). Plan work
        that conflicts with a concurrent change is kept on a recovery branch and the factory asks for help."""
        if step.target.milestone is not None:
            await workspaces.push_branch(workspace, step.branch, token)
            return None
        message = f"docs(factory): {step.role} {_label(step.target)}"
        preview, _ = await workspaces.merge(workspace, project.default_branch, message,
                                            await self._identity(None), token)
        if not preview.conflicts:
            return None
        rescue = f"factory/recovery/{step.id}"
        await workspaces.push_branch(workspace, rescue, token)
        return (f"The {step.role} of {_label(step.target)} conflicts with changes made meanwhile on "
                f"{project.default_branch} ({', '.join(preview.conflicts[:5])}); its work is on {rescue}.")

    async def _close_phase(self, checkout: Path, target: factory_docs.Target, project: mooi.Project, caller: Caller,
                           token: str) -> None:
        """Every milestone of the phase is done: the platform itself marks the phase done (`PHASE.md` and
        the roadmap) with a front-matter commit squashed onto the default branch, the same publish path
        plan-level steps use. No agent is involved."""
        phase = target.phase

        def mark() -> None:
            factory_docs.write_front_matter(checkout / phase.path, {"status": "done"})
            roadmap = checkout / factory_docs.ROOT / "ROADMAP.md"
            data, _ = factory_docs.split_front_matter(roadmap.read_text(encoding="utf-8"))
            phases = [{**entry, "status": "done"} if isinstance(entry, dict) and entry.get("id") == phase.id else entry
                      for entry in (data or {}).get("phases") or []]
            factory_docs.write_front_matter(roadmap, {"phases": phases})

        await asyncio.to_thread(mark)
        preview, _ = await workspaces.merge(checkout, project.default_branch, f"docs(factory): close {phase.id}",
                                            await self._identity(caller), token)
        if preview.conflicts:
            raise RuntimeError(f"Closing {phase.id} conflicts with {project.default_branch}; retrying from a fresh read")
        LOG.info("Factory %s closed phase %s", self.factory_id, phase.id)

    async def _identity(self, caller: Caller | None) -> GitIdentity:
        if self.identity is None:
            self.identity = await mooi.fetch_github_identity(caller or await self._access())
        return self.identity

    # --- signals --------------------------------------------------------------------------------------

    def observe(self, session: sessions.Session, type_: str, data: dict[str, Any]) -> None:
        step = self.step
        if step is None or step.session is not session:
            return
        if type_ == sessions.EVENT_TURN_RESULT:
            step.turns += 1
        elif type_ == "session.usage":
            percent = (data.get("context") or {}).get("percent")
            if isinstance(percent, (int, float)):
                step.peak_context = max(step.peak_context, float(percent))
            return
        elif type_ != sessions.EVENT_SESSION_STATUS:
            return
        step.wake.set()

    def report(self, session: sessions.Session, outcome: Outcome, summary: str) -> None:
        step = self.step
        if (step is None or step.session is not session or session.factory is None
                or session.factory.step_id != step.id or step.outcome is not None):
            raise ApiException.conflict("This session is not the factory's active step")
        step.outcome, step.summary = outcome, summary.strip()
        step.wake.set()

    async def shutdown(self) -> None:
        """Stops the loop without writing its state (the next boot reconciles it), after saving the running
        step's work in Git: its milestone branch, or a recovery branch for plan work."""
        if self.task is not None:
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
        step = self.step
        workspace = _workspace(step.session if step else None)
        if step is None or workspace is None or step.published:
            return
        try:
            async with asyncio.timeout(_SHUTDOWN_SECONDS):
                caller = await self._access()
                await workspaces.checkpoint_commit(workspace, f"chore(factory): checkpoint {step.role} {_label(step.target)}",
                                                   await self._identity(caller))
                branch = step.branch if step.target.milestone is not None else f"factory/recovery/{step.id}"
                await workspaces.push_branch(workspace, branch, await mooi.fetch_github_token(caller))
        except Exception:
            LOG.warning("Factory %s could not save step %s at shutdown", self.factory_id, step.id, exc_info=True)


# --- registry and lifecycle ---------------------------------------------------------------------------

_runners: dict[UUID, FactoryRunner] = {}
_boot_task: asyncio.Task[None] | None = None


def _active_steps() -> list[UUID]:
    return [runner.step.id for runner in _runners.values() if runner.step is not None]


def launch(factory_id: UUID) -> FactoryRunner:
    """Starts the factory's runner unless one already runs (D8: one step at a time per factory)."""
    runner = _runners.get(factory_id)
    if runner is not None and runner.task is not None and not runner.task.done():
        return runner
    runner = FactoryRunner(factory_id)
    _runners[factory_id] = runner
    runner.task = asyncio.create_task(runner.run())
    return runner


def _observe(session: sessions.Session, type_: str, data: dict[str, Any]) -> None:
    if session.factory is not None and (runner := _runners.get(session.factory.factory_id)) is not None:
        runner.observe(session, type_, data)


sessions.observe(_observe)


async def _boot() -> None:
    while True:
        try:
            active = await mooi.fetch_active_factories()
            await mooi.reconcile_factory_steps([])  # Nothing runs yet: every unfinished step was orphaned.
            break
        except asyncio.CancelledError:
            raise
        except Exception:
            LOG.warning("Active factories are unavailable; retrying", exc_info=True)
            await asyncio.sleep(_RETRY_SECONDS[1])
    for item in active:
        factory = item.get("factory") or {}
        if factory.get("status") in ("running", "pausing"):
            launch(UUID(str(factory["id"])))
        # Factories paused on provider limits wait for the limits watcher (milestone 07).


def start() -> None:
    """Called once from `main.py`'s lifespan: picks up every factory that was running."""
    global _boot_task
    if _boot_task is None:
        _boot_task = asyncio.create_task(_boot())


async def stop() -> None:
    """Called from `main.py`'s lifespan before sessions close, so running steps save their work first."""
    global _boot_task
    if _boot_task is not None:
        _boot_task.cancel()
        await asyncio.gather(_boot_task, return_exceptions=True)
        _boot_task = None
    await asyncio.gather(*(runner.shutdown() for runner in list(_runners.values())), return_exceptions=True)
    _runners.clear()


# --- agent API -------------------------------------------------------------------------------------------

router = APIRouter(tags=["factories"])


class OutcomeRequest(BaseModel):
    outcome: Outcome
    summary: str = Field(default="", max_length=4000)


@router.get("/sessions/{session_id}/factory/agent")
async def agent_factory(session_id: UUID, request: Request) -> dict[str, Any]:
    """The factory, this session's binding and the plan as this session's own checkout holds it."""
    session, _ = await sessions.agent_access(session_id, request)
    assert session.factory is not None
    runner = _runners.get(session.factory.factory_id)
    factory = runner.factory if runner and runner.factory else \
        (await mooi.fetch_internal_factory(session.factory.factory_id)).get("factory")
    workspace = _workspace(session)
    plan = (await asyncio.to_thread(factory_docs.read_plan, workspace)).as_json() if workspace else None
    return {"factory": factory, "session": session.factory.as_payload(), "plan": plan}


@router.post("/sessions/{session_id}/factory/agent/outcome")
async def agent_outcome(session_id: UUID, request: Request, body: OutcomeRequest) -> dict[str, Any]:
    """Ends this step; Mooi checks the documents agree, then publishes the work and moves on."""
    session, _ = await sessions.agent_access(session_id, request)
    assert session.factory is not None
    runner = _runners.get(session.factory.factory_id)
    if runner is None:
        raise ApiException.conflict("This session is not the factory's active step")
    runner.report(session, body.outcome, body.summary)
    return {"accepted": True, "outcome": body.outcome}
