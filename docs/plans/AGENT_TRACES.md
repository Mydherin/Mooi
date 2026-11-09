# Plan: Agent traces (observability tab)

Self-contained implementation plan. A fresh session resumes from this file **alone**: trust it, do not
re-analyze what is already decided here, do not re-read files beyond the anchors a task names.

## How to work with this plan (session protocol)

1. Read this file, then go straight to the first task in *Task board* that is not `done`.
2. Work tasks in order. After each task: set its status, add one line to *Progress log* (what changed,
   files, anything the next task must know). Keep the file truthful at every moment: a session may be
   stopped at any time.
3. When the user stops the session (context budget reached), first bring this file up to date, then
   commit all work of the session (one commit, conventional message `feat(traces): …`, ending with the
   attribution lines the system reminder gives). The next fresh session starts from that commit.
4. Decisions already made are in *Decisions*: never reopen them. A new decision goes there with its reason.
5. When every task is `done`: remove the *Current work* section from `AGENTS.md`, and update the
   *Context* section of `AGENTS.md` with the trace capability (one bullet under *Development sessions*).

## Goal

Debugging an agent must be easy everywhere Mooi runs one: development sessions, the first dev
deployment setup (it runs in the session chat), production deployment chats and backup chats. Each
gets a **Trace** tab that shows, like Langfuse / LangSmith, every internal step of the agent: turns,
LLM calls with input/output/cache/reasoning tokens per request, context size per request, tool calls
with input/output and duration, sub-agents (nested), skills, hooks, context injected into the model,
compactions and errors. It works with every adapter: Claude SDK, Claude CLI and Codex SDK.

## Functional requirements

- FR1 **Trace tab** next to the existing tabs:
  - Development session (`SessionWorkspace`): tabs Conversation · Changes · Files · Preview → add **Trace**.
  - Production page and Backup page: add **Trace** whenever their chat exists (same rule as the Chat tab).
- FR2 **Summary strip** (KPIs): duration, turns, LLM calls, tool calls, sub-agents, errors, total tokens
  (input / cache read / cache write / output / reasoning), cache-hit rate, peak context.
- FR3 **Timeline** (default view): an expandable tree of spans (turn → LLM calls, tools, hooks, context;
  sub-agent → its own LLM calls and tools) with a waterfall bar per row on a shared time axis, kind icon
  and colour, status (running spinner / ok / error / interrupted / incomplete), duration, token badge
  on LLM rows, model badge.
- FR4 **Filters**: chips per kind (LLM, Tools, Sub-agents, Skills, Hooks, Context, Events), "Errors only",
  text search (name, title, preview). Expand all / collapse all.
- FR5 **Inspector**: selecting a span shows its header (kind, name, status, start offset, duration),
  metrics (model, stop reason, every token count, context), **Input**, **Output** and **Metadata**
  sections with copy buttons and pretty JSON. Full detail loads on demand.
- FR6 **Insights** view: context size per LLM call (stacked bars: cache read / cache write / new input,
  plus output), tokens per model, tools ranked by calls and by time, errors.
- FR7 **Live**: while the agent works the trace updates by itself (new spans appear, running spans tick).
- FR8 A cleared conversation's trace stays visible (conversations are listed oldest first); the trace
  lives as long as the session.
- FR9 Empty / unavailable states: no steps yet; adapter without a log; trace truncated (limit reached).

## Non-functional requirements

- **Efficiency**: zero cost while nobody looks (parse on request only); each request parses only bytes
  appended since the last one; payload cached per revision; unchanged revision answers `204` without a
  body; span list stays light (full input/output only through the detail endpoint).
- **Scalability**: bounded memory (`TRACE_MAX_SPANS`, `TRACE_DETAIL_CHARS`); the SPA renders thousands
  of rows smoothly (windowed list, fixed row height); refetch throttled.
- **Security / isolation**: endpoints go through `get_registry().get_for(caller, id)` (404 for other
  players); nothing new reaches the repository; no secret is added to a payload (logs hold the agent's
  own content only; tokens/credentials are env, never in the logs).
- **Maintainability**: provider-neutral contract; a provider adds a `TraceSource` + a parser, nothing else.
  The sessions feature stays one file (`features/sessions.py`) importing only `shared/` aspects.
- **No regressions**: existing tabs, streams and runtimes behave the same; type check, ruff and build pass.
- **UX**: enterprise, modern, a bit interactive; desktop and phone first-class: no horizontal page
  overflow, compact pills (`formatCount`), long names truncated with full text in titles, safe-area
  insets, touch targets ≥ 44px, bottom-sheet inspector with swipe-down to dismiss and swipe left/right
  for previous/next span; keyboard on desktop (↑/↓ select, ←/→ collapse/expand, Enter open, Esc close).
  Light and dark themes through existing tokens only.

## Decisions (do not reopen)

- D1 **Source = the provider's native JSONL session log**, not instrumentation of the event stream: it
  holds per-request usage, sub-agent work, hooks and injected context that the domain events never carry.
- D2 Log locations (verified):
  - Claude SDK and Claude CLI adapters both pass `CLAUDE_CONFIG_DIR = self._config_dir` (a temp dir in
    the session directory). The CLI writes `<config_dir>/projects/<cwd-slug>/<session-id>.jsonl` and
    sub-agents in `<…>/<session-id>/subagents/agent-<agentId>.jsonl` + `agent-<agentId>.meta.json`
    (`{"agentType","description","toolUseId"}`). The SDK's `session_store` is only a mirror; local files
    are always written. SDK compaction (`compact()`) forks into a new file whose copied entries carry
    `forkedFrom` (skipped; the new part is shown as a "Compaction summary" turn).
  - Codex: per-account `CODEX_HOME` (`codex.Account.home`, shared by sessions of the account, deleted on
    last release) holds `sessions/YYYY/MM/DD/rollout-<ts>-<thread_id>.jsonl`. `thread_start` returns
    `thread.path` ([UNSTABLE] field); fallback glob via `traces.codex_rollout(home, thread_id, known)`.
- D3 Runtime contract: every `AgentRuntime` gets `trace_sources() -> Sequence[TraceSource]` (cheap, called
  on each sync; may return `[]` before the conversation exists).
- D4 Session keeps a `SessionTrace` (list of conversations). Replacing the runtime (clear conversation)
  calls `await session.trace.archive()` **before** `previous.close()` (files are deleted on close), then
  `session.trace.follow(new_runtime.trace_sources)`.
- D5 Live updates reuse the existing session SSE: the SPA refetches `GET …/trace?revision=<last>`
  (throttled ≈1.2 s) when the session's `lastSeq` changes while the Trace tab is visible; one more fetch
  when the session becomes idle. No new stream.
- D6 Cost is not shown (OAuth subscription accounts; not in the logs). Tokens are.
- D7 Tab label **Trace**, icon `Activity` (lucide). Feature folder `spa-mooi/src/features/traces/`.
- D8 Verification without credentials: there is no `MOOI_DEVELOPMENT_CLAUDE_TOKEN` / `CODEX_AUTH_JSON` in
  `.env.local` and Docker is not running, so the full stack cannot run an agent locally. Verify with a
  **temporary dev harness** (removed afterwards, never committed): a script runs the real `traces.py`
  over real local logs (`~/.claude/projects/<project>/<session>.jsonl` for Claude, `~/.codex/sessions/**`
  for Codex) and writes JSON to the scratchpad; a DEV-only page renders the real `TracePanel` with that
  JSON in the browser pane, desktop and mobile (375×812), light and dark. The user asked for this visual
  test explicitly (overrides the default "do not drive the app" rule for this feature). Full end-to-end
  needs `MOOI_DEVELOPMENT_CLAUDE_TOKEN` (from `claude setup-token`) in `.env.local` + `make up`; offer it
  to the user, never invent it. Point the harness at **one session file's directory copy**, not a whole
  projects folder (a whole folder hits `TRACE_MAX_SPANS`).

## Technical specification

### Backend — `mic-sessions` (Python 3.13, FastAPI)

**`src/mic_sessions/shared/traces.py`** — DONE (lint clean, verified on real Claude and Codex logs).
Public API:
- `TraceSource(format: "claude" | "codex", path: Path)` — Claude: the `projects` dir; Codex: the rollout file.
- `SessionTrace()`: `follow(sources_callable)`, `await archive()`, `await snapshot(live: bool) -> dict`,
  `await detail(span_id) -> dict | None`. Serialized by an `asyncio.Lock`; file reads run in `asyncio.to_thread`.
- `codex_rollout(home, thread_id, known=None) -> Path | None`.
- Internals: `TraceReader` (per conversation, prefix `c<n>:`, incremental offsets per file, inode/size
  reset detection, partial last line kept), `_ClaudeParser`, `_CodexParser`, `_build`, `_summary`.

Settings added in `shared/env.py` (DONE): `trace_max_spans=5000`, `trace_detail_chars=8000`
(env `TRACE_MAX_SPANS`, `TRACE_DETAIL_CHARS`). Add both to `mic-sessions/.env.example` (task B1).

Wire contract — `GET /sessions/{id}/trace?revision=<str>`:
- `204` when `revision` equals the current one; else `200`:
```json
{
  "revision": "1.42.1", "live": true, "title": "…|null", "conversations": 1, "truncated": false,
  "metadata": {"cli_version": "…"},
  "summary": {
    "startMs": 0, "endMs": 0,
    "counts": {"turn":0,"llm":0,"tool":0,"agent":0,"skill":0,"hook":0,"context":0,"compaction":0,"event":0},
    "errors": 0,
    "tokens": {"input":0,"cacheRead":0,"cacheWrite":0,"output":0,"reasoning":0,"total":0},
    "cacheHitRate": 0.93, "peakContext": 120000,
    "models": [{"model":"…","calls":0,"input":0,"cacheRead":0,"cacheWrite":0,"output":0}],
    "tools":  [{"name":"Bash","kind":"tool|agent|skill","calls":0,"errors":0,"durationMs":0}]
  },
  "spans": [{
    "id": "c1:…", "parentId": "c1:…|null",
    "kind": "turn|llm|tool|agent|skill|hook|context|compaction|event",
    "name": "…", "status": "running|ok|error|interrupted|incomplete",
    "startMs": 0, "endMs": 0,
    "title": "?", "model": "?", "stopReason": "?", "preview": "? ≤160 chars",
    "usage": {"input":0,"cacheRead":0,"cacheWrite":0,"output":0,"reasoning":0,"context":0}
  }]
}
```
Spans are sorted by `startMs`; `endMs` is `null` while running. `usage.input` is non-cached input;
`usage.context` is the whole prompt (input + cache read + cache write) = context size of that request.

`GET /sessions/{id}/trace/spans/{span_id}` → `{"id","input": str|null, "output": str|null, "metadata": {}}`
or 404. `span_id` contains `:` — declare the path param as `{span_id:path}`.

`live` = `session.status in (STATUS_WORKING, STATUS_WAITING, STATUS_COMPACTING)`.

**Runtime wiring — `src/mic_sessions/shared/agents.py`** (task B2):
- Protocol `AgentRuntime` (≈ line 273): add `def trace_sources(self) -> Sequence[TraceSource]: ...` with a
  docstring; mention it in the module docstring's "Adding a provider" list. `from mic_sessions.shared.traces import TraceSource`.
- `ClaudeAgentRuntime` and `ClaudeCliAgentRuntime`: `return [TraceSource("claude", self._config_dir / "projects")] if self._config_dir else []`.
- `CodexAgentRuntime`: store `self._thread_path = None` in `__init__`; in `_load_thread` (≈ line 2118)
  keep `thread = (await client.call("thread_start", params)).thread`, set `self._thread_id = thread.id`
  and `self._thread_path = getattr(thread, "path", None)`; `trace_sources()` returns
  `[TraceSource("codex", path)]` with `path = traces.codex_rollout(self._account.home, self._thread_id, self._thread_path)`
  when account and thread exist (cache the found path in `self._thread_path`), else `[]`.

**Session wiring — `src/mic_sessions/features/sessions.py`** (task B3):
- `from mic_sessions.shared import traces` (shared import list ≈ line 63).
- `Session` dataclass (≈ line 689): `trace: traces.SessionTrace = field(default_factory=traces.SessionTrace, repr=False)`.
- `_provision` (≈ line 1316): after `session.runtime = runtime` → `session.trace.follow(runtime.trace_sources)`.
- `_reset_conversation` (≈ line 2053): before `await previous.close()` → `await session.trace.archive()`;
  after `session.runtime = runtime` → `session.trace.follow(runtime.trace_sources)`.
- Endpoints next to `get_changes` (≈ line 1944), same style (`Annotated[Caller, Depends(current_caller)]`),
  returning `dict[str, Any]` / `Response(status_code=204)`; detail 404 via `ApiException.not_found("Span not found")`.
- Check other places that create or close runtimes: `rg -n "create_runtime\(|runtime.close\(" features/sessions.py`
  (known: `_provision`, `_reset_conversation`, `_cleanup_workspace` — the last one needs no archive: the session is going away).

### Frontend — `spa-mooi` (React 19, TS, Tailwind v4, zustand, lucide)

Conventions (follow strictly): one type per file in `types/`, one function per file in `lib/`, API in
`api/`, hooks in `hooks/`, components in `components/`; `@/` alias; `cn()` from `@/shared/utils/cn`;
tokens only (`bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-muted`, `text-ink-subtle`, `border-line`,
`bg-brand-soft`, `*-success|warning|danger|info|accent` + `-soft` / `-dot`, `rounded-chip|control|card|panel`,
`shadow-raised|pop`, `animate-fade-up|sheet-in`); `sessionsFetch` for calls; `apiErrorMessage` for errors;
`formatCount` for compact pills; existing `Tabs`, `SegmentedControl`, `EmptyState`, `CopyButton`, `IconButton`.

Kind palette: turn = ink, llm = brand/info, tool = success, agent = accent, skill = warning,
hook = ink-subtle, context = info (muted), compaction = warning, event = danger if error else ink-subtle.

Files to create in `src/features/traces/`:
- `types/`: `AgentTrace.ts`, `TraceSpan.ts`, `TraceSpanKind.ts`, `TraceSpanStatus.ts`, `TraceUsage.ts`,
  `TraceSummary.ts`, `TraceModelStat.ts`, `TraceToolStat.ts`, `TraceSpanDetail.ts`, `TraceFilter.ts`, `TraceNode.ts`.
- `api/tracesApi.ts`: `fetchTrace(sessionId, revision?) → AgentTrace | null` (null on 204),
  `fetchTraceSpan(sessionId, spanId) → TraceSpanDetail` (encode the id with `encodeURIComponent`).
- `hooks/useAgentTrace.ts(sessionId, active)`: initial fetch when active; watches
  `useSessionsStore(s => s.byId[sessionId]?.lastSeq)` and session status; throttled refetch with
  `revision`; keeps last data on error; `useTraceSpanDetail.ts(sessionId, spanId, revision)`;
  `useTraceKeyboard.ts`; `useSwipeGestures.ts` (pointer events, threshold 60px, vertical vs horizontal lock).
- `lib/`: `buildTraceTree.ts` (spans → nodes with depth, children, descendant counts),
  `flattenTraceTree.ts` (visible rows given collapsed set + filters + search; ancestors of matches stay),
  `traceKindStyle.ts` (icon + classes per kind), `formatTokens.ts`, `formatSpanDuration.ts` (ms → "820ms", "4.2s", "3m 05s"),
  `spanDuration.ts` (uses now for running), `traceTimeScale.ts`.
- `components/`: `TracePanel.tsx` (root, lazy-loaded; header with summary + view switch Timeline/Insights,
  filters, body, inspector), `TraceSummaryStrip.tsx` (horizontal scroll on phones, KPI cards),
  `TraceToolbar.tsx` (search, kind chips with counts, errors toggle, expand/collapse),
  `TraceTimeline.tsx` (windowed list, row height 40px, overscan 8, time axis header),
  `TraceRow.tsx` (indent guides, chevron, icon, name + title, badges, duration; desktop: waterfall
  column 38% wide; phone: 3px bar under the label), `TraceInspector.tsx` (desktop right pane 420px,
  `lg:` breakpoint; phone bottom sheet portal with grabber, swipe down to close, swipe left/right = next/prev),
  `TraceDetailSection.tsx` (collapsible Input/Output/Metadata, monospace, copy), `TraceInsights.tsx`
  (`ContextChart` SVG bars per LLM call with tooltip/tap, model table, tool bars), `TraceEmptyState.tsx`.
- Integration:
  - `features/sessions/types/WorkspacePane.ts`: add `'trace'`; `SessionWorkspace.tsx`: add tab item and a
    lazy `TracePanel` section (mount once visited, `active` prop = visible), extend `selectPane` guard.
  - `features/production/types/ProductionTab.ts` and `features/backups/types/BackupTab.ts`: add `'trace'`;
    `pages/ProjectDeploymentPage.tsx` and `pages/ProjectBackupPage.tsx`: tab `{ id: 'trace', label: 'Trace', icon: Activity }`
    when `chat` exists, render `<TracePanel sessionId={chat.id} active={tab === 'trace'} />` lazily.

## Task board

Status: `todo` · `doing` · `done`. Exactly one `doing` at a time.

| # | Task | Status |
|---|------|--------|
| B0 | `shared/traces.py` + settings in `env.py` | done |
| B1 | Add `TRACE_MAX_SPANS` / `TRACE_DETAIL_CHARS` to `mic-sessions/.env.example` | todo |
| B2 | `trace_sources()` on the protocol and the 3 runtimes (`agents.py`) | todo |
| B3 | Session wiring + 2 endpoints (`features/sessions.py`) | todo |
| B4 | Backend checks: `uvx ruff check src` (only new findings matter; `env.py` has a pre-existing I001), import check `python -c "import mic_sessions.main"` with 32-byte `SERVICE_TOKEN`/`JWT_SECRET` env | todo |
| F1 | Traces types + API + `lib/` helpers | todo |
| F2 | `useAgentTrace`, `useTraceSpanDetail`, keyboard + swipe hooks | todo |
| F3 | `TracePanel`, summary strip, toolbar, timeline + rows (windowed) | todo |
| F4 | Inspector (desktop pane + phone bottom sheet with gestures) + detail sections | todo |
| F5 | Insights view (context chart, models, tools) | todo |
| F6 | Tab integration: session workspace, production page, backup page | todo |
| F7 | `cd spa-mooi && bun run build` (tsc + vite) passes | todo |
| V1 | Temporary harness (see D8): JSON from real logs → DEV page; check desktop + mobile, light + dark, gestures, overflow; fix issues | todo |
| V2 | Remove harness, final build/lint, update `AGENTS.md` Context, remove *Current work* pointer, report | todo |

## Progress log

- Session 1: analysis done; `shared/traces.py` written (≈1000 lines) and `env.py` settings added.
  Verified on real logs: a Codex rollout → 263 spans (8 turns, 132 LLM calls, 123 tools, 25.9M tokens);
  a whole Claude projects folder → hit the 5000-span cap (1,756 LLM calls, 1,865 tools, 934 hooks,
  5 skills, 3 compactions). Sub-agent nesting not yet confirmed on a real sub-agent log (V1 must check it:
  use `~/.claude/projects/-Users-mydherin-projects-mydherin-MyBank/02f0db88-575b-424e-b869-98f76a631140*`,
  which has one sub-agent). Nothing else wired; not committed.
