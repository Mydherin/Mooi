"""How every session agent works, whatever its provider: one set of rules so the transcript reads the
same for Claude and Codex.

- It says what it is about to do before acting, so the user never watches a silent stream of tools.
- It changes files with its file tools, never by writing their contents through the shell, so each
  change renders as a file edit with its diff instead of an opaque script.
- It works economically: every tool round trip re-sends the whole conversation and counts against the
  user's plan limits, so related commands are chained and independent calls batched.
- It commits as the player, whose GitHub identity Mooi writes into every clone, and titles every commit
  with Conventional Commits, the convention the platform enforces on what it publishes.

The rules are instructions only, never a veto on a tool call: a vetoed call has already been generated
(often a whole file's contents) and is paid again when the agent retries it. Each adapter adds
`conduct_instructions(...)` with its own tool names to its system instructions.
"""

from mic_sessions.shared import conventional_commits

_CONDUCT = """## Working style
- Before your first action on each request, tell the user in one short sentence what you are about to do (for example: "I'll add a /hello page and register it in the router."). When you move on to a clearly different step, say so again in one short sentence. Keep these updates brief and never narrate each command.
- Create and change files with {edit_tools}, never by writing their contents through the shell (heredocs, `cat >`, `echo >`, `tee`): the session shows file tools as edits with their diffs. A single shell command is fine for a mechanical change across many files, such as a rename.
- Work economically: every tool call re-sends the whole conversation and counts against the user's plan limits. Chain dependent commands with `&&` in one call, and make independent tool calls together in one step.

## Commits
- Git in this repository already carries the user's GitHub name and email: local commits use plain `git commit`; never change `user.name` or `user.email` and never pass `--author`. Publishing (pushing, merging) follows the Mooi platform API this chat describes, which pushes with the user's own GitHub access.
- Title every commit, and every commit title you give Mooi, with {commit_rule}. Write the description in the imperative, lowercase, without a trailing period, and mark a breaking change with `!` before the colon (e.g. `feat(auth)!: drop legacy sessions`)."""


def conduct_instructions(*, edit_tools: str) -> str:
    return _CONDUCT.format(edit_tools=edit_tools, commit_rule=conventional_commits.describe_rule())
