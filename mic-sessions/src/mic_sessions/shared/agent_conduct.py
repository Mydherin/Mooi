"""How every session agent works, whatever its provider: one set of rules so the transcript reads the
same for Claude and Codex.

- It says what it is about to do before acting, so the user never watches a silent stream of tools.
- It changes files with its file tools, never through the shell, so each change renders as a file
  edit with its diff instead of an opaque script.
- It keeps one purpose per shell command, so each one can be named ("Ran tests", "Searched for x").

Each adapter adds `conduct_instructions(...)` with its own tool names to its system instructions.
Where the provider lets the platform veto a tool call, it also enforces the file rule with
`shell_file_write`; elsewhere the instruction stands alone.
"""

import re

_CONDUCT = """## Working style
- Before your first action on each request, tell the user in one short sentence what you are about to do (for example: "I'll add a /hello page and register it in the router."). When you move on to a clearly different step, say so again in one short sentence. Keep these updates brief and never narrate each command.
- Read files with {read_tools} and change them only with {edit_tools}. Never create or modify files through the shell: no heredocs, `cat >`, `echo >`, `tee`, `sed -i` or inline scripts that write files. The session shows file tools as edits with their diffs.
- Give each shell command one purpose (search, build, test, run). Never chain unrelated steps such as creating files, editing them and building into one script."""


def conduct_instructions(*, read_tools: str, edit_tools: str) -> str:
    return _CONDUCT.format(read_tools=read_tools, edit_tools=edit_tools)


# Scratch and device paths are not project files: writing them from the shell is fine.
_EXEMPT_TARGET = re.compile(r"^['\"]?(/dev/|/tmp/|/private/tmp/|\$TMPDIR|\$\{TMPDIR)")
_HEREDOC = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
_REDIRECT_WRITE = re.compile(r"\b(?:cat|echo|printf)\b[^|;&\n]*?(?<![0-9&<>])>>?\s*([^\s;&|<>()]+)")
_TEE = re.compile(r"\btee\b((?:\s+-[a-z]+)*)\s+([^\s;&|<>()-][^\s;&|<>()]*)")
_IN_PLACE = re.compile(r"\b(?:sed|perl)\b[^|;&\n]*\s-[a-zA-Z]*i\b")
_INLINE_SCRIPT = re.compile(r"\b(?:python3?|node|ruby|perl)\b[^\n]*?(?:\s-\s*<<|\s<<|\s-c\s|\s-e\s)")
_SCRIPT_WRITE = re.compile(r"open\([^)]*,\s*['\"][wax]|\.write_(?:text|bytes)\(|writeFile(?:Sync)?\(|File\.write\(")


def _split_heredocs(command: str) -> tuple[str, list[str]]:
    """The command lines with heredoc bodies removed, and those bodies: a body is data, so `>` in a
    JSX snippet inside it is never mistaken for a redirection."""
    lines = command.split("\n")
    kept: list[str] = []
    bodies: list[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        kept.append(line)
        index += 1
        for match in _HEREDOC.finditer(line):
            body: list[str] = []
            while index < len(lines) and lines[index].strip() != match.group(2):
                body.append(lines[index])
                index += 1
            index += 1
            bodies.append("\n".join(body))
    return "\n".join(kept), bodies


def shell_file_write(command: str) -> str | None:
    """Names the file a shell command writes through redirection, `tee`, in-place editing or an inline
    script, or None when it writes no project file. A heuristic for steering the agent to its file
    tools, never a security boundary: what it misses still runs."""
    if not isinstance(command, str) or not command.strip():
        return None
    script, bodies = _split_heredocs(command)
    for match in _REDIRECT_WRITE.finditer(script):
        if not _EXEMPT_TARGET.match(match.group(1)):
            return match.group(1)
    for match in _TEE.finditer(script):
        if not _EXEMPT_TARGET.match(match.group(2)):
            return match.group(2)
    if _IN_PLACE.search(script):
        return "a file edited in place"
    if _INLINE_SCRIPT.search(script) and any(_SCRIPT_WRITE.search(text) for text in [script, *bodies]):
        return "a file written by an inline script"
    return None

