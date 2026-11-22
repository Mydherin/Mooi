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
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field

from mic_sessions.features import sessions
from mic_sessions.shared import factory_docs, factory_prompts, mooi, workspaces
from mic_sessions.shared.agents import STATUS_FAILED, STATUS_READY, describe
from mic_sessions.shared.auth import Caller, current_caller
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

_ROLES = {"expand": "planner", "build": "builder", "test": "tester", "merge": "merger"}
_OPEN_CHANGES = frozenset({"queued", "analyzing", "awaiting-confirmation"})
# How often factories paused on provider limits check whether the limits renewed, and how often the
# watcher looks for one that is due.
_LIMITS_POLL_SECONDS = 600
_LIMITS_CHECK_SECONDS = 60


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


def _epoch(value: Any) -> float | None:
    """A quota window's `resetsAt`: epoch seconds (or milliseconds) or an ISO 8601 date, as providers send it."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) / 1000 if value > 1e11 else float(value)
    if isinstance(value, str) and value:
        with suppress(ValueError):
            parsed = datetime.fromisoformat(value)
            return (parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)).timestamp()
    return None


def _quota_exhausted(quota: Any) -> tuple[bool, float | None]:
    """Whether a provider usage window is spent (the same KPI every adapter reports), and when the last
    spent one renews."""
    if not isinstance(quota, dict):
        return False, None
    resets: list[float] = []
    exhausted = False
    for window in quota.values():
        if not isinstance(window, dict):
            continue
        percent = window.get("percent")
        if window.get("status") == "rejected" or (isinstance(percent, (int, float)) and not isinstance(percent, bool)
                                                  and percent >= 100):
            exhausted = True
            if (reset := _epoch(window.get("resetsAt"))) is not None:
                resets.append(reset)
    return exhausted, max(resets) if resets else None


def _confirmation_message(change: dict[str, Any]) -> str:
    return (f"CR-{change.get('number')} changes the project's scope: confirm or reject it, then resume the "
            "factory.")


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
    # The plan target, or None for an analyst, whose subject is `change` (a change request).
    target: factory_docs.Target | None
    branch: str
    change: dict[str, Any] | None = None
    session: sessions.Session | None = None
    base_commit: str | None = None
    # Reported by the agent (`POST .../factory/agent/outcome`).
    outcome: Outcome | None = None
    summary: str = ""
    turns: int = 0
    peak_context: float = 0.0
    # Context checkpoint (D7): the percent that crossed the soft limit, when its brief went out, and why
    # the session must stop now (hard limit or timeout).
    checkpoint_percent: float | None = None
    checkpoint_started: float | None = None
    stop: str | None = None
    # A graceful pause asks for the checkpoint at the next turn end; provider limits stop the session and
    # record when they renew (epoch seconds, None when unknown).
    pausing: bool = False
    # The agent got its brief: before that the step did no work, so there is nothing to recover.
    briefed: bool = False
    limits: bool = False
    limits_reset: float | None = None
    wake: asyncio.Event = field(default_factory=asyncio.Event)
    # Decided by the runner once the step is over; `_close` reads them, so a failed close can be retried.
    status: str = "interrupted"
    note: str = ""
    published: bool = False
    journaled: bool = False
    attention: str | None = None

    @property
    def handed_over(self) -> bool:
        """The agent reported an outcome and the documents agreed with it."""
        return self.outcome is not None and self.status == self.outcome

    @property
    def milestone(self) -> factory_docs.Milestone | None:
        return self.target.milestone if self.target else None

    @property
    def phase_id(self) -> str | None:
        return self.target.phase.id if self.target else None

    @property
    def key(self) -> tuple[str | None, str | None]:
        if self.target is None:
            return f"CR-{(self.change or {}).get('number')}", None
        return _key(self.target.phase.id, self.milestone.id if self.milestone else None)

    @property
    def label(self) -> str:
        return _label(self.target) if self.target else f"CR-{(self.change or {}).get('number')}"


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
        # The summary of the last `continue` handover per target, passed on to the session that resumes it.
        self.handovers: dict[tuple[str | None, str | None], str] = {}
        self.stalled: tuple[tuple[str | None, str | None], int] | None = None
        # A pause the player requested while this runner lives (`graceful` or `immediate`), and the event
        # that cuts a back-off short so it is honoured at once.
        self.pause_mode: str | None = None
        self.signal = asyncio.Event()

    # --- state in mic-mooi ---------------------------------------------------------------------------

    def _loaded(self, internal: dict[str, Any]) -> None:
        self.player_id = UUID(str(internal["playerId"]))
        self.factory = internal["factory"]
        self._announce()

    def _announce(self) -> None:
        if self.player_id is not None and self.factory:
            _publish(self.player_id, self.factory.get("projectId"), self.factory)

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

    async def _revoked(self) -> bool:
        """A token minted earlier was refused: revoking the grant ends its sign-in at once, while the token
        itself has not expired yet. Minting a new one tells a revocation from a token that just lapsed."""
        self.caller = None
        revoked = False
        with suppress(Exception):  # Any other failure is not a revocation: the cycle's retry handles it.
            try:
                await self._access()
            except _Revoked:
                revoked = True
        return revoked

    async def _pause_revoked(self) -> None:
        with suppress(Exception):
            await self._pause("revoked", "The factory's sign-in was revoked. Resume it to continue.")

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
                    await self._pause_revoked()
                    return
                except Exception as error:
                    if isinstance(error, ApiException) and error.status_code == 401 and await self._revoked():
                        await self._pause_revoked()
                        return
                    LOG.exception("Factory %s cycle failed", self.factory_id)
                    failures += 1
                    if failures > len(_RETRY_SECONDS):
                        with suppress(Exception):
                            await self._pause("error", "The factory stopped after repeated errors. Resume it to retry.")
                        return
                    self.signal.clear()
                    with suppress(TimeoutError):
                        await asyncio.wait_for(self.signal.wait(), _RETRY_SECONDS[failures - 1])
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
        if self.factory.get("status") == "pausing" or (self.pause_mode and self.factory.get("status") == "running"):
            await self._pause("user", None)  # Between steps: a requested pause is complete.
            return False
        if self.factory.get("status") != "running":
            return False
        caller = await self._access()
        project = await mooi.fetch_project(caller, UUID(str(self.factory["projectId"])))
        token = await mooi.fetch_github_token(caller)
        checkout, commit, plan = await _read_plan(self.factory_id, project, token, progress=True)
        snapshot = plan.as_json()
        if commit != self.factory.get("planCommit") or snapshot != self.factory.get("plan"):
            await self._save(plan=json.dumps(snapshot), planCommit=commit)
        if plan.issues:
            listed = "; ".join(f"{issue.path}: {issue.message}" for issue in plan.issues[:10])
            await self._pause("attention", f"The plan in docs/factory needs fixing: {listed}")
            return False
        if self.factory.get("openChangeRequests"):
            # A safe point (D12): decided changes are applied before any new work.
            pending = sorted((change for change in await mooi.fetch_factory_change_requests(caller, project.id)
                              if change.get("status") in _OPEN_CHANGES), key=lambda change: change["number"])
            waiting = next((change for change in pending if change["status"] == "awaiting-confirmation"), None)
            if waiting is not None:
                await self._pause("attention", _confirmation_message(waiting))
                return False
            if pending:
                return await self._run_step("analyst", None, plan, project, caller, token, change=pending[0])
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
        if target.action == "merge" and await self._merge(target, project, caller, token):
            return True
        return await self._run_step(_ROLES[target.action], target, plan, project, caller, token)

    # --- steps -------------------------------------------------------------------------------------

    async def _run_step(self, role: str, target: factory_docs.Target | None, plan: factory_docs.FactoryPlan,
                        project: mooi.Project, caller: Caller, token: str,
                        change: dict[str, Any] | None = None) -> bool:
        run = self.factory.get("runConfig") or {}
        if not run.get("provider") or not run.get("connectionId"):
            await self._pause("attention", "Choose the agent that runs the factory, then resume it.")
            return False
        if self.pause_mode:
            return True  # The next cycle completes the pause before any new session opens.
        milestone = target.milestone if target else None
        branch = factory_docs.milestone_branch(target.phase.id, milestone.id) if target and milestone \
            else project.default_branch
        step = _Step(id=uuid4(), role=role, target=target, branch=branch, change=change)
        await mooi.open_factory_step(self.factory_id, {
            "id": str(step.id), "role": role, "phaseId": step.phase_id,
            "milestoneId": milestone.id if milestone else None, "branch": branch, "model": run.get("model")})
        self.step = step
        if change is not None:
            await mooi.update_factory_change_request(self.factory_id, UUID(str(change["id"])), {
                "status": "analyzing", "scopeLevel": change.get("scopeLevel")})
        try:
            session = await sessions.open_session(sessions.CreateSessionRequest(
                projectId=project.id, provider=run["provider"], adapter=run.get("adapter"),
                connectionId=UUID(str(run["connectionId"])), branch=branch, model=run.get("model"),
                effort=run.get("effort"),
            ), caller, sessions.FactoryBinding(self.factory_id, role, step.id, step.phase_id,
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
            conflicts = (await workspaces.integrate(workspace, project.default_branch, identity, token)
                         if milestone is not None else [])
            if role == "merger" and not conflicts:
                # The default branch merged in cleanly after all: the platform merge just retries.
                step.outcome = step.status = "completed"
                step.note = f"{project.default_branch} merged in without conflicts."
                return await self._close(step)
            if conflicts:
                if role != "merger":
                    step = await self._merger(step, project)
                brief = factory_prompts.merger_brief(conflicts, project.default_branch)
            else:
                brief = self._brief(step, plan, project)
            if step.role != "merger" and (handover := self.handovers.get(step.key)):
                brief += factory_prompts.handover_note(handover)
            if step.key in self.recovering:
                brief += factory_prompts.recovery_note()
            if step.stop is None and not step.pausing:
                await sessions.deliver(session, await self._access(), brief)
                step.briefed = True
                await self._await_outcome(step)
            else:  # Limits already exhausted at start, or a pause came first: no work starts.
                step.note = step.stop or "Paused by the user before the step started"
            await self._verify(step, project, token)
            if step.role == "tester" and step.status == "failed":
                await self._count_failure(step, workspace, identity)
        except asyncio.CancelledError:
            raise  # Shutdown: `stop` saves the work; the next boot journals the step as interrupted.
        except _Ended as ended:
            step.status, step.note = "interrupted", str(ended)
            if step.session is not None and not step.limits:
                self._check_limits(step, step.session)
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
        if target is None:
            change = step.change or {}
            return factory_prompts.analyst_brief(int(change.get("number") or 0), str(change.get("text") or ""),
                                                 confirmed=bool(change.get("scopeLevel")))
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
        milestone = step.milestone
        await mooi.open_factory_step(self.factory_id, {
            "id": str(merger.id), "role": "merger", "phaseId": step.phase_id,
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
        one ends the step as `continue`, so a silent agent never stalls the loop. Crossing the context
        soft limit turns the wait into a checkpoint (D7): past the hard limit or the timeout, or once the
        checkpoint turn ends without an outcome, the session is stopped and the close saves its work."""
        session = step.session
        assert session is not None
        handled, reminded = step.turns, False
        while step.outcome is None:
            if _ended(session):
                raise _Ended("The session ended before reporting an outcome")
            if step.stop is not None:
                step.note = step.stop
                break
            if step.checkpoint_percent is not None and step.checkpoint_started is None:
                await self._checkpoint(step, factory_prompts.checkpoint_message(step.checkpoint_percent))
                handled = step.turns
                continue
            if step.turns > handled and session.status == STATUS_READY:
                handled = step.turns
                if step.pausing and step.checkpoint_started is None:
                    # Graceful pause (D9): the turn ended, so the handover is asked without interrupting.
                    step.checkpoint_percent = step.peak_context
                    await self._checkpoint(step, factory_prompts.pause_message())
                    handled = step.turns
                    continue
                if step.checkpoint_started is not None:
                    step.note = "The checkpoint turn ended without reporting an outcome"
                    return
                if reminded:
                    step.note = "The agent ended its turn twice without reporting an outcome"
                    return
                reminded = True
                await sessions.deliver(session, await self._access(), factory_prompts.outcome_reminder())
                handled = step.turns
                continue
            step.wake.clear()
            if step.checkpoint_started is None:
                await step.wake.wait()
                continue
            remaining = step.checkpoint_started + get_settings().factory_checkpoint_timeout_seconds - time.monotonic()
            if remaining <= 0:
                step.stop = "The checkpoint took too long; Mooi stopped the session and saved its work"
                continue
            with suppress(TimeoutError):
                await asyncio.wait_for(step.wake.wait(), remaining)
        # The outcome is the agent's last action: let it end its turn before Mooi takes the workspace. A
        # stopped session is interrupted at once.
        await self._settle(step, 0 if step.stop is not None else _SETTLE_SECONDS)

    async def _checkpoint(self, step: _Step, text: str) -> None:
        """The soft limit was crossed (or a graceful pause came): interrupts the running turn, if any (one
        turn can span hundreds of tool calls), and asks for a handover in the same conversation, so nothing
        the agent knows is lost."""
        session = step.session
        assert session is not None and step.checkpoint_percent is not None
        LOG.info("Factory %s step %s checkpoints at %.0f%% of its context", self.factory_id, step.id,
                 step.checkpoint_percent)
        await sessions.interrupt(session)
        try:
            await asyncio.wait_for(self._wait(step, lambda: session.status == STATUS_READY or step.outcome is not None,
                                              "The session ended during its checkpoint"),
                                   get_settings().factory_checkpoint_timeout_seconds)
        except TimeoutError:
            step.stop = "The session did not stop for its checkpoint; Mooi stopped it and saved its work"
            return
        step.checkpoint_started = time.monotonic()
        if step.outcome is not None:
            return
        try:
            await sessions.deliver(session, await self._access(), text)
        except ApiException as error:
            # Someone else's message got there first: the turn it starts is the checkpoint's last chance.
            if error.status_code != 409:
                raise
            LOG.info("Factory %s step %s could not deliver its checkpoint brief", self.factory_id, step.id)

    async def _settle(self, step: _Step, seconds: float) -> None:
        """Lets the running turn end by itself for `seconds`, then interrupts it and waits briefly for the
        provider to stop, so the safety commit never races the agent's own writes."""
        session = step.session
        assert session is not None

        def ready() -> bool:
            return session.status == STATUS_READY

        for budget, interrupt in ((seconds, False), (_SETTLE_SECONDS, True)):
            if _ended(session) or ready():
                return
            if interrupt:
                await sessions.interrupt(session)
            if budget > 0:
                with suppress(TimeoutError, _Ended):
                    await asyncio.wait_for(self._wait(step, ready, ""), budget)

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
        elif step.target is None:
            # An analyst completes a change request by leaving a consistent plan behind.
            agreed = step.outcome == "completed" and not (await asyncio.to_thread(factory_docs.read_plan, workspace)).issues
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
            await self._flag_recovery(step, workspace)
            await workspaces.checkpoint_commit(workspace, f"chore(factory): checkpoint {step.role} {step.label}",
                                               await self._identity(caller))
            step.attention = await self._publish(step, workspace, project, token)
            step.published = True
        if step.change is not None and not step.journaled:
            await self._resolve_change(step)
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

        key = step.key
        if step.role != "merger":
            if step.status == "continue" and step.handed_over and step.summary:
                self.handovers[key] = step.summary
            else:
                self.handovers.pop(key, None)
        if step.handed_over:
            self.recovering.discard(key)
        elif step.briefed:
            self.recovering.add(key)
        progressed = head is not None and head != step.base_commit
        count = 0 if progressed else (self.stalled[1] + 1 if self.stalled and self.stalled[0] == key else 1)
        if progressed or step.briefed:
            self.stalled = (key, count)
        else:
            count = 0  # Never briefed (a pause or limits came first): it neither progressed nor stalled.
        if step.attention:
            await self._pause("attention", step.attention)
            return False
        if step.limits:
            await self._pause_for_limits(step.limits_reset)
            return False
        if step.status == "blocked":
            await self._pause("attention", _confirmation_message(step.change) if step.change else
                              f"The {step.role} of {step.label} is blocked: {step.summary or 'see its State'}")
            return False
        if count >= _MAX_STALLED_STEPS and not self.pause_mode:
            await self._pause("attention", f"{count} sessions in a row made no progress on {step.label}.")
            return False
        return True

    async def _resolve_change(self, step: _Step) -> None:
        """D12: an applied analysis closes its change request; a scope-level one waits for the user's
        confirmation; anything else queues it again for the next analyst."""
        change = step.change
        assert change is not None
        analysis = "\n\n".join(part for part in (step.summary, step.note) if part)[:8000] or None
        if step.status == "completed":
            status, scope = "applied", None
        elif step.status == "blocked":
            status, scope = "awaiting-confirmation", True
        else:
            status, scope = "queued", None
        change.update(await mooi.update_factory_change_request(self.factory_id, UUID(str(change["id"])), {
            "status": status, "scopeLevel": scope, "analysis": analysis}))

    async def _pause_for_limits(self, reset: float | None) -> None:
        """Provider limits ran out: the run waits with its grant and its agent selection (D9), and the
        limits watcher resumes it once they renew."""
        when = reset if reset and reset > time.time() else None
        renewal = (f" after {datetime.fromtimestamp(when, UTC):%Y-%m-%d %H:%M} UTC" if when
                   else " once they renew")
        await self._pause("limits", f"The provider's usage limits ran out; the factory resumes by itself{renewal}.")
        _limited[self.factory_id] = max(when or 0, time.time() + _LIMITS_POLL_SECONDS)

    def _check_limits(self, step: _Step, session: sessions.Session) -> bool:
        """Marks the step as stopped by provider limits when a quota window of its account is exhausted."""
        exhausted, reset = _quota_exhausted(session.usage.get("quota"))
        if exhausted:
            step.limits, step.limits_reset = True, reset
            step.stop = step.stop or "The provider's usage limits ran out; Mooi stopped the session and saved its work"
        return exhausted

    async def _flag_recovery(self, step: _Step, workspace: Path) -> None:
        """A milestone step that ended without a handover and never touched its milestone file gets a
        `Recovery needed` line in its *Log*, committed with the safety commit, so the next session (or a
        human reading the branch) knows *State* is stale."""
        milestone = step.milestone
        if (milestone is None or step.role == "merger" or step.handed_over or not step.briefed
                or step.base_commit is None):
            return
        path = workspace / milestone.path
        if not path.is_file() or await workspaces.changed_since(workspace, step.base_commit, milestone.path):
            return
        reason = step.note or "the session ended without a handover"
        line = (f"Recovery needed ({step.role}, step {step.id}): {reason}. *State* may be stale; "
                "see the last `chore(factory): checkpoint` commit.")
        await asyncio.to_thread(factory_docs.append_log, path, line)

    async def _publish(self, step: _Step, workspace: Path, project: mooi.Project, token: str) -> str | None:
        """Milestone work goes to its branch; plan work is squashed onto the default branch (D4). Plan work
        that conflicts with a concurrent change is kept on a recovery branch and the factory asks for help."""
        if step.milestone is not None:
            await workspaces.push_branch(workspace, step.branch, token)
            return None
        message = f"docs(factory): {step.role} {step.label}"
        preview, _ = await workspaces.merge(workspace, project.default_branch, message,
                                            await self._identity(None), token)
        if not preview.conflicts:
            return None
        rescue = f"factory/recovery/{step.id}"
        await workspaces.push_branch(workspace, rescue, token)
        return (f"The {step.role} of {step.label} conflicts with changes made meanwhile on "
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

        identity = await self._identity(caller)
        async with _checkout_lock(self.factory_id):
            await asyncio.to_thread(mark)
            preview, _ = await workspaces.merge(checkout, project.default_branch, f"docs(factory): close {phase.id}",
                                                identity, token)
        if preview.conflicts:
            raise RuntimeError(f"Closing {phase.id} conflicts with {project.default_branch}; retrying from a fresh read")
        LOG.info("Factory %s closed phase %s", self.factory_id, phase.id)

    async def _merge(self, target: factory_docs.Target, project: mooi.Project, caller: Caller, token: str) -> bool:
        """The milestone passed its end-to-end test: the platform squashes its branch onto the default
        branch, with the milestone marked `done` in the same commit. The phase is closed by the next cycle's
        `close`. Answers False when the default branch conflicts, so a merger step integrates it first;
        the milestone branch stays on GitHub."""
        milestone = target.milestone
        assert milestone is not None
        branch = factory_docs.milestone_branch(target.phase.id, milestone.id)
        identity = await self._identity(caller)
        try:
            checkout = await workspaces.factory_branch_checkout(self.factory_id, project.full_name, branch, token)
            await asyncio.to_thread(factory_docs.write_front_matter, checkout / milestone.path,
                                    {"status": "done", "test": "passed"})
            preview, commit = await workspaces.merge(checkout, project.default_branch,
                                                     f"feat({target.phase.id}): {milestone.title}", identity, token)
        finally:
            await workspaces.remove_factory_branch_checkout(self.factory_id)
        if preview.conflicts:
            LOG.info("Factory %s: %s conflicts with %s (%s)", self.factory_id, _label(target), project.default_branch,
                     ", ".join(preview.conflicts[:5]))
            return False
        LOG.info("Factory %s merged %s at %s", self.factory_id, _label(target), (commit or "")[:7])
        self.recovering.discard(_key(target.phase.id, milestone.id))
        self.handovers.pop(_key(target.phase.id, milestone.id), None)
        return True

    async def _count_failure(self, step: _Step, workspace: Path, identity: GitIdentity) -> None:
        """D10: once a milestone has failed its end-to-end test `FACTORY_MAX_TEST_CYCLES` times, the
        platform sets it to `attention` on its branch; the next cycle parks the factory there."""
        milestone = step.milestone
        assert milestone is not None
        limit = get_settings().factory_max_test_cycles

        def mark() -> bool:
            current = factory_docs.read_plan(workspace).milestone(milestone.phase_id, milestone.id)
            if current is None or current.attempts < limit or current.status == "attention":
                return False
            path = workspace / milestone.path
            factory_docs.write_front_matter(path, {"status": "attention"})
            factory_docs.append_log(path, f"Needs attention: {current.attempts} end-to-end test cycles failed; "
                                          "a human decides how to continue (see *Tests*).")
            return True

        if await asyncio.to_thread(mark):
            await workspaces.checkpoint_commit(workspace, f"chore(factory): {step.label} needs attention",
                                               identity)
            step.note = f"The milestone failed {limit} test cycles and needs attention."

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
            if "quota" in data and step.stop is None and self._check_limits(step, session):
                step.wake.set()
                return
            percent = (data.get("context") or {}).get("percent")
            if not isinstance(percent, (int, float)):
                return
            step.peak_context = max(step.peak_context, float(percent))
            if step.outcome is not None or step.stop is not None:
                return
            settings = get_settings()
            if step.checkpoint_percent is None:
                if percent < settings.factory_context_soft_percent:
                    return
                step.checkpoint_percent = float(percent)
            else:
                # The checkpoint gets the soft-to-hard margin even when the soft limit was crossed late.
                margin = settings.factory_context_hard_percent - settings.factory_context_soft_percent
                limit = max(settings.factory_context_hard_percent, step.checkpoint_percent + margin)
                if percent < limit:
                    return
                step.stop = (f"The session reached {percent:.0f}% of its context during its checkpoint; "
                             "Mooi stopped it and saved its work")
        elif type_ != sessions.EVENT_SESSION_STATUS:
            return
        step.wake.set()

    def request_pause(self, mode: str) -> None:
        """D9: a graceful pause checkpoints the step at its next turn end; an immediate one stops it now
        (interrupt, safety commit, publish). Between steps, the next cycle completes either."""
        if self.pause_mode != "immediate":
            self.pause_mode = mode
        step = self.step
        if step is not None and step.outcome is None:
            if mode == "immediate":
                step.stop = step.stop or "Paused by the user; Mooi stopped the session and saved its work"
            step.pausing = True
            step.wake.set()
        self.signal.set()

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
                await workspaces.checkpoint_commit(workspace, f"chore(factory): checkpoint {step.role} {step.label}",
                                                   await self._identity(caller))
                branch = step.branch if step.milestone is not None else f"factory/recovery/{step.id}"
                await workspaces.push_branch(workspace, branch, await mooi.fetch_github_token(caller))
        except Exception:
            LOG.warning("Factory %s could not save step %s at shutdown", self.factory_id, step.id, exc_info=True)


# --- registry and lifecycle ---------------------------------------------------------------------------

_runners: dict[UUID, FactoryRunner] = {}
_boot_task: asyncio.Task[None] | None = None
# One git operation at a time on a factory's control checkout (the runner, an approval).
_checkout_locks: dict[UUID, asyncio.Lock] = {}
# Factories paused on provider limits, with when to try them again (epoch seconds).
_limited: dict[UUID, float] = {}


def _checkout_lock(factory_id: UUID) -> asyncio.Lock:
    return _checkout_locks.setdefault(factory_id, asyncio.Lock())


async def _read_plan(factory_id: UUID, project: mooi.Project, token: str,
                     progress: bool = False) -> tuple[Path, str, factory_docs.FactoryPlan]:
    """The plan as the default branch holds it now, read from the factory's freshly fetched checkout.
    With `progress`, the next milestone's own front matter comes from its milestone branch, where builders
    and testers record it until the merge (one milestone at a time, D8, so one file is enough)."""
    async with _checkout_lock(factory_id):
        checkout, commit = await workspaces.factory_checkout(factory_id, project.full_name, project.default_branch,
                                                             token)
        plan = await asyncio.to_thread(factory_docs.read_plan, checkout)
        target = factory_docs.next_target(plan) if progress and not plan.issues else None
        if target is not None and target.milestone is not None:
            milestone = target.milestone
            text = await workspaces.branch_file(checkout, factory_docs.milestone_branch(milestone.phase_id, milestone.id),
                                                milestone.path, token)
            if text is not None:
                plan = factory_docs.with_branch_progress(plan, milestone, text)
        return checkout, commit, plan


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
        elif factory.get("status") == "paused" and factory.get("pauseReason") == "limits":
            _limited.setdefault(UUID(str(factory["id"])), time.time())
    await _watch_limits()


async def _watch_limits() -> None:
    """Resumes factories paused on provider limits with their same agent selection (D9). Their next step
    finds out at session start whether the limits renewed (each adapter reports its quota KPI then); a
    factory still limited pauses again and is retried every `_LIMITS_POLL_SECONDS`."""
    while True:
        await asyncio.sleep(_LIMITS_CHECK_SECONDS)
        now = time.time()
        for factory_id in [key for key, due in _limited.items() if due <= now]:
            _limited.pop(factory_id, None)
            try:
                internal = (await mooi.fetch_internal_factory(factory_id)).get("factory") or {}
                if internal.get("status") != "paused" or internal.get("pauseReason") != "limits":
                    continue
                await mooi.update_factory(factory_id, {"revision": internal["revision"], "status": "running",
                                                       "pauseReason": None, "attention": None})
                LOG.info("Factory %s resumes after provider limits", factory_id)
                launch(factory_id)
            except asyncio.CancelledError:
                raise
            except Exception:
                LOG.warning("Factory %s could not resume after limits; retrying later", factory_id, exc_info=True)
                _limited[factory_id] = now + _LIMITS_POLL_SECONDS


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


# --- operations: the SPA and the factory chat's agent run the same functions (convergence) ----------------

_CHAT_ROLE = "chat"
# The analysis of a scope change accepted once every phase was built: it reopened the definition.
_REDEFINITION = "Accepted after the last phase: the definition is reopened with the architect in the factory chat."


class RunConfigRequest(BaseModel):
    """The agent that runs the factory's sessions, chosen like a session's."""

    provider: str = Field(min_length=1, max_length=32)
    connectionId: UUID
    adapter: str | None = Field(default=None, max_length=32)
    model: str | None = Field(default=None, max_length=128)
    effort: str | None = Field(default=None, max_length=32)


class ChatRequest(RunConfigRequest):
    # What the user asked when opening the chat; part of its first message.
    request: str | None = Field(default=None, max_length=20_000)


def _publish(player_id: UUID, project_id: Any, factory: dict[str, Any] | None) -> None:
    sessions.publish(player_id, EVENT_FACTORY_UPDATED, {"projectId": str(project_id), "factory": factory})


async def _write(caller: Caller, factory: dict[str, Any], **changes: Any) -> dict[str, Any]:
    """A write outside the runner, against the revision `factory` was read at (a concurrent one answers 409)."""
    body = {"revision": factory["revision"], "status": factory["status"], "pauseReason": factory.get("pauseReason"),
            "attention": factory.get("attention"), **changes}
    payload = (await mooi.update_factory(UUID(str(factory["id"])), body))["factory"]
    _publish(caller.player_id, payload["projectId"], payload)
    return payload


def _bound(player_id: UUID, project_id: UUID, factory_id: UUID, role: str | None = None) -> list[sessions.Session]:
    """The factory's live sessions (its chat, or a step session a revoked run left open)."""
    return [session for session in sessions.get_registry().list_for(player_id, project_id)
            if session.factory is not None and session.factory.factory_id == factory_id and not session.closing
            and (role is None or session.factory.role == role)]


async def _run_config(caller: Caller, body: RunConfigRequest) -> dict[str, Any]:
    """Validates the selection exactly as opening a session does, and answers it resolved."""
    descriptor = describe(body.provider)
    adapter = await descriptor.prepare(caller, str(body.connectionId), adapter=body.adapter)
    config = descriptor.configure(body.model, body.effort, adapter.id)
    return {"provider": descriptor.id, "connectionId": str(body.connectionId), "adapter": adapter.id,
            "model": config.model, "effort": config.effort}


async def open_chat(caller: Caller, project_id: UUID, body: ChatRequest) -> tuple[sessions.Session, dict[str, Any]]:
    """Opens the project's factory chat, creating the factory on first use. A new chat replaces the previous
    one. While the factory is being defined it is the architect; afterwards it steers."""
    try:
        factory = await mooi.fetch_factory(caller, project_id)
    except ApiException as error:
        if error.status_code != 404:
            raise
        factory = await mooi.create_factory(caller, project_id)
        _publish(caller.player_id, project_id, factory)
    factory_id = UUID(str(factory["id"]))
    project = await mooi.fetch_project(caller, project_id)
    for chat in _bound(caller.player_id, project_id, factory_id, _CHAT_ROLE):
        await sessions.close_session(chat.id)
    if factory["status"] == "defining":
        # A redefinition after the last phase starts from the built project and the change that reopened it.
        # The plan snapshot cannot tell: the architect's publications refresh it during a first definition too.
        reopened = next((change for change in await mooi.fetch_factory_change_requests(caller, project_id)
                         if change.get("analysis") == _REDEFINITION), None)
        brief = factory_prompts.architect_brief(body.request, existing=reopened is not None,
                                                change=f"CR-{reopened['number']}: {reopened['text']}" if reopened else None)
    else:
        brief = factory_prompts.steering_brief(body.request)
    session = await sessions.open_session(sessions.CreateSessionRequest(
        projectId=project_id, provider=body.provider, adapter=body.adapter, connectionId=body.connectionId,
        branch=project.default_branch, model=body.model, effort=body.effort, initialMessage=brief,
    ), caller, sessions.FactoryBinding(factory_id, _CHAT_ROLE))
    for attempt in range(2):
        try:
            factory = await _write(caller, factory, chatSessionId=str(session.id))
            break
        except ApiException as error:
            if error.status_code != 409 or attempt:
                raise
            factory = await mooi.fetch_factory(caller, project_id)
    return session, factory


async def approve_definition(caller: Caller, project_id: UUID) -> dict[str, Any]:
    """The approval gate: the definition published on the default branch must be complete (core files,
    valid front matter, `00-foundations` first). Answers the remaining issues instead when it is not."""
    factory = await mooi.fetch_factory(caller, project_id)
    if factory["status"] != "defining":
        raise ApiException.conflict("The definition is already approved")
    project = await mooi.fetch_project(caller, project_id)
    token = await mooi.fetch_github_token(caller)
    _, commit, plan = await _read_plan(UUID(str(factory["id"])), project, token)
    issues = factory_docs.definition_issues(plan)
    if issues:
        if commit != factory.get("planCommit"):
            factory = await _write(caller, factory, plan=json.dumps(plan.as_json()), planCommit=commit)
        return {"approved": False, "factory": factory,
                "issues": [{"path": issue.path, "message": issue.message} for issue in issues]}
    factory = await _write(caller, factory, status="ready", attention=None, plan=json.dumps(plan.as_json()),
                           planCommit=commit)
    return {"approved": True, "factory": factory, "issues": []}


async def start_factory(caller: Caller, project_id: UUID, body: RunConfigRequest) -> dict[str, Any]:
    """First start of an approved factory: stores the agent selection, opens the unattended grant (D2)
    and launches the loop."""
    factory = await mooi.fetch_factory(caller, project_id)
    if factory["status"] != "ready":
        raise ApiException.conflict("Approve the definition first" if factory["status"] == "defining"
                                    else "The factory has already started")
    run = await _run_config(caller, body)
    await mooi.grant_factory(caller, project_id)
    factory = await _write(caller, factory, status="running", pauseReason=None, attention=None, runConfig=run)
    launch(UUID(str(factory["id"])))
    return factory


def _live_runner(factory_id: UUID) -> FactoryRunner | None:
    runner = _runners.get(factory_id)
    return runner if runner is not None and runner.task is not None and not runner.task.done() else None


async def pause_factory(caller: Caller, project_id: UUID, mode: Literal["graceful", "immediate"]) -> dict[str, Any]:
    """D9. With a live step the factory goes `pausing` and its runner checkpoints the step (gracefully at
    the next turn end, or at once), publishes the work and settles on `paused`. Without one it pauses
    right away. A factory waiting on limits or resting simply becomes paused."""
    factory = await mooi.fetch_factory(caller, project_id)
    if factory["status"] not in ("running", "pausing", "resting") and not (
            factory["status"] == "paused" and factory.get("pauseReason") == "limits"):
        raise ApiException.conflict("The factory is not running")
    factory_id = UUID(str(factory["id"]))
    runner = _live_runner(factory_id)
    _limited.pop(factory_id, None)
    if runner is None:
        return await _write(caller, factory, status="paused", pauseReason="user", attention=None)
    if factory["status"] != "pausing":
        factory = await _write(caller, factory, status="pausing")
    runner.request_pause(mode)
    return factory


async def resume_factory(caller: Caller, project_id: UUID, body: RunConfigRequest | None) -> dict[str, Any]:
    """D9. Every resume names the agent that runs from now on (the chat may reuse the last one), opens a
    new grant (D2) and relaunches the loop, which reconciles first. From `attention`, the parked milestone
    gets a fresh test budget."""
    factory = await mooi.fetch_factory(caller, project_id)
    if factory["status"] != "paused":
        raise ApiException.conflict("The factory is not paused")
    if body is None:
        last = factory.get("runConfig") or {}
        if not last.get("provider") or not last.get("connectionId"):
            raise ApiException.bad_request("Choose the agent that runs the factory")
        body = RunConfigRequest.model_validate(last)
    run = await _run_config(caller, body)
    factory_id = UUID(str(factory["id"]))
    if factory.get("pauseReason") == "attention":
        await _release_attention(caller, factory_id, project_id)
    await mooi.grant_factory(caller, project_id)
    factory = await _write(caller, factory, status="running", pauseReason=None, attention=None, runConfig=run)
    _limited.pop(factory_id, None)
    launch(factory_id)
    return factory


async def _release_attention(caller: Caller, factory_id: UUID, project_id: UUID) -> None:
    """A milestone parked in `attention` (D10) goes back to `building` with its `attempts` reset, on its own
    branch; whatever the human fixed meanwhile on the default branch reaches it at the next step start."""
    project = await mooi.fetch_project(caller, project_id)
    token = await mooi.fetch_github_token(caller)
    _, _, plan = await _read_plan(factory_id, project, token, progress=True)
    target = factory_docs.next_target(plan) if not plan.issues else None
    milestone = target.milestone if target and target.action == "attention" else None
    if milestone is None or milestone.status != "attention":
        return
    branch = factory_docs.milestone_branch(milestone.phase_id, milestone.id)
    identity = await mooi.fetch_github_identity(caller)
    async with _checkout_lock(factory_id):
        try:
            checkout = await workspaces.factory_branch_checkout(factory_id, project.full_name, branch, token)

            def release() -> None:
                path = checkout / milestone.path
                factory_docs.write_front_matter(path, {"status": "building", "attempts": 0})
                factory_docs.append_log(path, "Resumed by the user after attention: test attempts reset.")

            await asyncio.to_thread(release)
            await workspaces.checkpoint_commit(checkout, f"chore(factory): resume {milestone.phase_id}/{milestone.id}",
                                               identity)
            await workspaces.push_branch(checkout, branch, token)
        finally:
            await workspaces.remove_factory_branch_checkout(factory_id)


async def request_change(caller: Caller, project_id: UUID, text: str) -> dict[str, Any]:
    """D12. Queues a change the user decided; the loop applies it at its next safe point. A resting
    factory wakes up for it, under a new grant."""
    factory = await mooi.fetch_factory(caller, project_id)
    if factory["status"] in ("defining", "ready"):
        raise ApiException.conflict("The definition is not running yet: change it in the factory chat")
    change = await mooi.create_factory_change_request(caller, project_id, text)
    factory = await mooi.fetch_factory(caller, project_id)
    if factory["status"] == "resting":
        await mooi.grant_factory(caller, project_id)
        factory = await _write(caller, factory, status="running", attention=None)
        launch(UUID(str(factory["id"])))
    else:
        _publish(caller.player_id, project_id, factory)
    return change


def _finished(factory: dict[str, Any]) -> bool:
    """Every phase of the plan snapshot is built: the factory had come to rest."""
    phases = (factory.get("plan") or {}).get("phases") or []
    return bool(phases) and all(phase.get("status") == "done" for phase in phases)


async def decide_change(caller: Caller, project_id: UUID, change_id: UUID, accept: bool) -> dict[str, Any]:
    """The user's answer to a scope-level change request. Rejected, it is closed. Accepted while phases
    remain, it is queued again and the next analyst may change the scope. Accepted once every phase is
    built, it reopens the definition with the human: the factory goes back to `defining` and the chat
    becomes the architect again, with this request in its brief. The loop continues only on resume (or,
    after a redefinition, approval and start)."""
    factory = await mooi.fetch_factory(caller, project_id)
    change = next((item for item in await mooi.fetch_factory_change_requests(caller, project_id)
                   if str(item.get("id")) == str(change_id)), None)
    if change is None:
        raise ApiException.not_found("Change request not found")
    if change.get("status") != "awaiting-confirmation":
        raise ApiException.conflict("This change request does not wait for a confirmation")
    factory_id = UUID(str(factory["id"]))
    if accept and factory["status"] == "paused" and _finished(factory):
        change = await mooi.update_factory_change_request(factory_id, change_id, {
            "status": "applied", "scopeLevel": True, "analysis": _REDEFINITION})
        await _write(caller, factory, status="defining", pauseReason=None, attention=None)
        return change
    change = await mooi.update_factory_change_request(factory_id, change_id, {
        "status": "queued" if accept else "rejected", "scopeLevel": True})
    _publish(caller.player_id, project_id, await mooi.fetch_factory(caller, project_id))
    return change


async def delete_factory(caller: Caller, project_id: UUID) -> None:
    """Removes the factory's operational state, its sessions and its control checkout; `docs/factory/`
    stays in the repository."""
    factory = await mooi.fetch_factory(caller, project_id)
    factory_id = UUID(str(factory["id"]))
    if factory["status"] in ("running", "pausing"):
        raise ApiException.conflict("Pause the factory before removing it")
    await mooi.delete_factory(caller, project_id)
    for session in _bound(caller.player_id, project_id, factory_id):
        await sessions.close_session(session.id)
    async with _checkout_lock(factory_id):
        await workspaces.remove_factory_checkout(factory_id)
    _checkout_locks.pop(factory_id, None)
    _publish(caller.player_id, project_id, None)


# --- player API ------------------------------------------------------------------------------------------

router = APIRouter(tags=["factories"])
CurrentCaller = Annotated[Caller, Depends(current_caller)]


@router.post("/factories/{project_id}/chat", status_code=status.HTTP_201_CREATED)
async def factory_chat(project_id: UUID, body: ChatRequest, caller: CurrentCaller) -> dict[str, Any]:
    session, factory = await open_chat(caller, project_id, body)
    return {"sessionId": str(session.id), "factory": factory}


@router.post("/factories/{project_id}/definition/approve")
async def factory_approve(project_id: UUID, caller: CurrentCaller) -> dict[str, Any]:
    return await approve_definition(caller, project_id)


@router.post("/factories/{project_id}/start")
async def factory_start(project_id: UUID, body: RunConfigRequest, caller: CurrentCaller) -> dict[str, Any]:
    return {"factory": await start_factory(caller, project_id, body)}


@router.delete("/factories/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def factory_delete(project_id: UUID, caller: CurrentCaller) -> None:
    await delete_factory(caller, project_id)


class PauseRequest(BaseModel):
    mode: Literal["graceful", "immediate"] = "graceful"


class ChangeRequestBody(BaseModel):
    text: str = Field(min_length=1, max_length=8000)


class DecisionRequest(BaseModel):
    accept: bool


@router.post("/factories/{project_id}/pause")
async def factory_pause(project_id: UUID, body: PauseRequest, caller: CurrentCaller) -> dict[str, Any]:
    return {"factory": await pause_factory(caller, project_id, body.mode)}


@router.post("/factories/{project_id}/resume")
async def factory_resume(project_id: UUID, body: RunConfigRequest, caller: CurrentCaller) -> dict[str, Any]:
    """The agent selection is mandatory here: the Factory tab always asks for it (D9)."""
    return {"factory": await resume_factory(caller, project_id, body)}


@router.post("/factories/{project_id}/change-requests", status_code=status.HTTP_201_CREATED)
async def factory_change_request(project_id: UUID, body: ChangeRequestBody, caller: CurrentCaller) -> dict[str, Any]:
    return {"changeRequest": await request_change(caller, project_id, body.text)}


@router.post("/factories/{project_id}/change-requests/{change_id}/decision")
async def factory_change_decision(project_id: UUID, change_id: UUID, body: DecisionRequest,
                                  caller: CurrentCaller) -> dict[str, Any]:
    return {"changeRequest": await decide_change(caller, project_id, change_id, body.accept)}


# --- agent API -------------------------------------------------------------------------------------------


class OutcomeRequest(BaseModel):
    outcome: Outcome
    summary: str = Field(default="", max_length=4000)


@router.get("/sessions/{session_id}/factory/agent")
async def agent_factory(session_id: UUID, request: Request) -> dict[str, Any]:
    """The factory, this session's binding and the plan as this session's own checkout holds it; the chat
    also gets the change requests."""
    session, caller = await sessions.agent_access(session_id, request)
    assert session.factory is not None
    runner = _runners.get(session.factory.factory_id)
    factory = runner.factory if runner and runner.factory else \
        (await mooi.fetch_internal_factory(session.factory.factory_id)).get("factory")
    workspace = _workspace(session)
    plan = (await asyncio.to_thread(factory_docs.read_plan, workspace)).as_json() if workspace else None
    payload = {"factory": factory, "session": session.factory.as_payload(), "plan": plan}
    if session.factory.role == _CHAT_ROLE:
        payload["changeRequests"] = await mooi.fetch_factory_change_requests(caller, session.project_id)
    return payload


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


async def _chat_access(session_id: UUID, request: Request) -> tuple[sessions.Session, Caller]:
    session, caller = await sessions.agent_access(session_id, request)
    if session.factory is None or session.factory.role != _CHAT_ROLE:
        raise ApiException.not_found("Not found")
    return session, caller


class PublishRequest(BaseModel):
    message: str = Field(min_length=1, max_length=200)


@router.post("/sessions/{session_id}/factory/agent/publish")
async def agent_publish(session_id: UUID, request: Request, body: PublishRequest) -> dict[str, Any]:
    """The architect publishes the definition onto the default branch. Once approved, the loop is the plan's
    only writer: the chat changes it through change requests instead."""
    session, caller = await _chat_access(session_id, request)
    factory = await mooi.fetch_factory(caller, session.project_id)
    if factory["status"] != "defining":
        raise ApiException.conflict("The definition is approved: queue a change request instead of editing the plan")
    merged = await sessions.publish_repository(session, caller, body.message)
    await _refresh_definition(caller, session.project_id)
    return merged.model_dump(mode="json")


async def _refresh_definition(caller: Caller, project_id: UUID) -> None:
    """The Factory tab's checklist shows the definition as published: refresh the plan snapshot (and its
    issues) after each publication, live on every device."""
    project = await mooi.fetch_project(caller, project_id)
    token = await mooi.fetch_github_token(caller)
    for attempt in range(2):
        factory = await mooi.fetch_factory(caller, project_id)
        if factory["status"] != "defining":
            return
        _, commit, plan = await _read_plan(UUID(str(factory["id"])), project, token)
        try:
            await _write(caller, factory, plan=json.dumps(plan.as_json()), planCommit=commit)
            return
        except ApiException as error:
            if error.status_code != 409 or attempt:
                raise


@router.post("/sessions/{session_id}/factory/agent/approve")
async def agent_approve(session_id: UUID, request: Request) -> dict[str, Any]:
    """Same gate as the Factory tab's button; the brief allows it only after the user confirmed."""
    session, caller = await _chat_access(session_id, request)
    return await approve_definition(caller, session.project_id)


class AgentResumeRequest(BaseModel):
    """`{}` resumes with the last agent selection; the chat confirms it with the user first."""

    provider: str | None = Field(default=None, max_length=32)
    connectionId: UUID | None = None
    adapter: str | None = Field(default=None, max_length=32)
    model: str | None = Field(default=None, max_length=128)
    effort: str | None = Field(default=None, max_length=32)


@router.post("/sessions/{session_id}/factory/agent/pause")
async def agent_pause(session_id: UUID, request: Request, body: PauseRequest) -> dict[str, Any]:
    session, caller = await _chat_access(session_id, request)
    return {"factory": await pause_factory(caller, session.project_id, body.mode)}


@router.post("/sessions/{session_id}/factory/agent/resume")
async def agent_resume(session_id: UUID, request: Request, body: AgentResumeRequest) -> dict[str, Any]:
    session, caller = await _chat_access(session_id, request)
    selection = (RunConfigRequest.model_validate(body.model_dump()) if body.provider and body.connectionId
                 else None)
    return {"factory": await resume_factory(caller, session.project_id, selection)}


@router.post("/sessions/{session_id}/factory/agent/change-requests", status_code=status.HTTP_201_CREATED)
async def agent_change_request(session_id: UUID, request: Request, body: ChangeRequestBody) -> dict[str, Any]:
    session, caller = await _chat_access(session_id, request)
    return {"changeRequest": await request_change(caller, session.project_id, body.text)}


@router.post("/sessions/{session_id}/factory/agent/change-requests/{change_id}/decision")
async def agent_change_decision(session_id: UUID, change_id: UUID, request: Request,
                                body: DecisionRequest) -> dict[str, Any]:
    """Only after the user answered in the conversation (brief rule)."""
    session, caller = await _chat_access(session_id, request)
    return {"changeRequest": await decide_change(caller, session.project_id, change_id, body.accept)}
