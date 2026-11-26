"""The one commit convention of every commit Mooi writes or publishes: Conventional Commits 1.0.

Agents are told the same rule in their working style (`agent_conduct`), and the web client mirrors the
check in its merge dialog; this module is the server-side source of truth.
"""

import re

TYPES = ("feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert")
FORMAT = "<type>(<optional scope>): <description>"

_TITLE = re.compile(rf"^(?:{'|'.join(TYPES)})(?:\([^()\s][^()]*\))?!?: \S")


def is_conventional(message: str) -> bool:
    """Whether the first line of `message` is a Conventional Commits title."""
    return bool(_TITLE.match(message.split("\n", 1)[0]))


def describe_rule() -> str:
    """The rule in plain words, for errors and agent instructions."""
    return f"Conventional Commits: `{FORMAT}`, where the type is one of {', '.join(TYPES)}"
