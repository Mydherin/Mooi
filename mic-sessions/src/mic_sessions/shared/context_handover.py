"""Context handover of plain development sessions: the briefs the platform sends.

A session configured with a context percent hands its work over once its context crosses it: the platform
interrupts the running turn and sends `handover_message` as the next user message. The agent closes the
step in flight, and when work remains it writes a temporary progress file under `docs/progress/` and
points the repository's agent instructions at it, so the next conversation (a cleared one, a new session,
a local run without Mooi) resumes from there without rediscovering anything.
"""

from __future__ import annotations

MIN_PERCENT = 10
MAX_PERCENT = 95
PROGRESS_DIRECTORY = "docs/progress"
POINTER_SECTION = "# In-progress work"


def handover_message(percent: float, threshold: int) -> str:
    """The priority brief; short, because it is read with an almost full context."""
    return f"""[Mooi context handover] This conversation reached {round(percent)}% of its context window (the session hands over at {threshold}%). Mooi interrupted your turn: stop starting new work and hand over now, quickly.

1. Close the step in flight in a consistent state: finish or revert the edit you were making so nothing is left half-written or broken (no partial files, dangling references or failing builds you caused). Do not start new tasks, explorations or long verifications.
2. If the user's request is already fully done, say so in two or three lines and stop: create no files. When you were resuming a task from a `{PROGRESS_DIRECTORY}/` file and it is now complete, delete that file and its pointer line (step 4) instead.
3. Otherwise write `{PROGRESS_DIRECTORY}/<yyyy-mm-dd>-<short-task-slug>.md` (create the folder if needed); when you were already resuming from such a file, rewrite that same file and keep its single pointer line instead of adding new ones. A fresh agent with no memory of this conversation must be able to continue from it alone, without re-reading what you already explored. Start it with the line `> Temporary handover file: once this task is complete, delete this file and its line under {POINTER_SECTION} in the agent instructions (and that section when it is empty), in the same change.` Then these sections:
   - **Request**: what the user asked, with every requirement and constraint that still matters (their words when precise).
   - **Done**: each completed task, with the files it touched.
   - **In progress**: the task you just stopped, its exact state and the precise next step.
   - **Pending**: every remaining task in order, each with enough detail to do it directly.
   - **Context**: decisions taken and why, files and symbols in play, gotchas and how to verify the result.
4. Point the repository's agent instructions at it: in the root `AGENTS.md` (or `CLAUDE.md` when the repository keeps its instructions there; create `AGENTS.md` when neither exists), add under a `{POINTER_SECTION}` section, created right after the file's first section when missing, one line:
   `- {PROGRESS_DIRECTORY}/<file>.md: <one-line summary>. Interrupted task, temporary: read that file first and continue from it without re-exploring; once the task is complete, delete the file and this line (and this section when it is empty) in the same change, before reporting the task done.`
5. Leave these changes in the working tree: do not push, merge or switch branches.
6. End with a short message to the user, in the language they wrote in: what is done, what remains, and that clearing the conversation (or opening a new session on this branch once it is merged or pushed) and asking to continue resumes from the progress file."""


def agent_api(root: str) -> str:
    """The standing guidance a plain session's agent gets, so the chat can change the setting too."""
    endpoint = f"{root}/context-handover/agent"
    return f"""## Context handover
This session may hand over its work when its context fills up: past the configured percent, Mooi interrupts the turn and asks you to close it and leave a progress file in `{PROGRESS_DIRECTORY}/`, pointed at from a `{POINTER_SECTION}` section of the root agent instructions. When such a pointer exists, resume from its file; once that task is complete, delete the progress file and its pointer line (and the section when it is empty) in the same change, before reporting the task done: both are temporary and must never outlive the task. When the user asks in this chat to show, change, enable or disable it, use the Mooi platform API (the composer's context menu shows the same setting):
- `GET {endpoint}`: `percent`, the context percent that triggers the handover, or null when it is off.
- `PUT {endpoint}` with JSON `{{"percent": 60}}` (from {MIN_PERCENT} to {MAX_PERCENT}; null turns it off): applies at once and returns the stored value."""
