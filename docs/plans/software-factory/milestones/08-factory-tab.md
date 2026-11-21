---
id: 08-factory-tab
status: planned
depends: [03-orchestrator-core, 07-control-change-requests]
context: [spa-mooi]
---

# Milestone 08: Factory tab (SPA)

## Spec

A **Factory** tab in the project page that is live, responsive and converges with the chat. It can start as
soon as milestone 03's API exists and is finished after 07.

**Feature folder** `spa-mooi/src/features/factory/`, following the conventions of `features/todos` and
`features/traces`:

- one type per file in `types/`, one function per file in `lib/`, `api/`, `hooks/`, `components/`;
- tokens only, `cn()`;
- reuse `Tabs`, `SegmentedControl`, `EmptyState` and `formatCount`.

**Integration**:

- `pages/ProjectPage.tsx`: add a `FACTORY_TAB` to `TABS` (≈33–35) with an attention dot.
- `features/live/lib/applyLiveEvent.ts` and `stores/liveStore.ts`: handle `factory.updated`.
- The project card and the main menu show an attention badge for factories needing the human (D14).

**Views**:

- **Not enabled**: an explanation plus an *Enable factory* button, which opens the factory chat in
  definition mode.
- **Defining**: the chat embedded (reuse the session chat components) plus the docs checklist from
  `validate`, and an *Approve definition* button with its issues.
- **Running, paused or resting**:
  - Header: status, reason, run config, *Pause* (graceful/immediate) and *Resume* (opens the agent selection
    dialog, reusing `AgentModelFields.tsx`).
  - Roadmap: phases → milestones with status, attempts, test result and a progress bar.
  - Active step: role, target, live context gauge against the 20% limit, and a link to its session (chat,
    Changes, Trace).
  - Journal: paginated steps.
  - Decisions and change requests: a list, a new-request composer, and confirm/reject for
    `awaiting-confirmation`.
- Phones: sections stack and the roadmap collapses per phase. Desktop: roadmap and active step side by side.

## Tasks

- [ ] Types, API client and `useProjectFactory` hook (initial fetch plus live updates)
- [ ] Tab integration and attention badges
- [ ] Enable/define/approve views
- [ ] Header controls, pause and resume dialog with the run config
- [ ] Roadmap, active step, journal, change requests
- [ ] Responsive pass (phone and desktop, light and dark)
- [ ] Checks: `cd spa-mooi && bun run build`, plus lint if configured

## Acceptance

- Every action in the tab has a chat equivalent with the same effect, and changes from either side appear
  live in the other.
- A milestone entering `attention` lights the badge on the project card, the menu and the tab within
  seconds.
- No overflow at 360 px width.

## State

Not started.

## Log
