---
id: 08-factory-tab
status: done
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

- [x] Types, API client and `useProjectFactory` hook (initial fetch plus live updates)
- [x] Tab integration and attention badges
- [x] Enable/define/approve views
- [x] Header controls, pause and resume dialog with the run config
- [x] Roadmap, active step, journal, change requests
- [x] Responsive pass (phone and desktop, light and dark): tokens only, stacked below `lg`, phone labels
  collapse to icons; not checked in a browser (the user tests manually)
- [x] Checks: `cd spa-mooi && bun run build` (no lint configured)

## Acceptance

- Every action in the tab has a chat equivalent with the same effect, and changes from either side appear
  live in the other.
- A milestone entering `attention` lights the badge on the project card, the menu and the tab within
  seconds.
- No overflow at 360 px width.

## State

Done (session 3). Build passes; the *Acceptance* scenarios are checked manually by the user.

What exists (`spa-mooi/src/features/factory/`):

- `types/` (one per file), `api/factoryApi.ts`: reads from mic-mooi (`/me/factories`,
  `/me/projects/{id}/factory`, `/steps`, `/change-requests`), writes through mic-sessions (`/factories/{id}/…`).
- Live: `liveStore.factories` (per project, `null` = none) with `adoptFactory`/`adoptFactories` that keep the
  newer revision; `factory.updated` folded in `liveStore.apply`. `useFactoriesSync` (in `AppLayout`) reads
  the whole list once per live epoch for the badges.
- Hooks: `useProjectFactory`, `useFactorySteps` (newest page refreshed on every revision, older pages kept),
  `useFactoryChangeRequests`.
- Components: `FactoryPanel` (view switch and dialogs), `FactoryIntro`, `FactoryDefinition` (embedded
  `PlatformChatPanel` plus `FactoryChecklist` and approve/start), `FactoryHeader` (status, attention, agent,
  Pause / Stop now / Resume / Chat / Remove), `FactoryRunDialog` (agent selection restored from the last run:
  account, then adapter, then model/effort), `FactoryRoadmap` + `FactoryMilestoneRow`, `FactoryActiveStep`
  (context gauge against `FACTORY_CONTEXT_LIMIT`), `FactoryJournal`, `FactoryChangeRequests` (composer
  with dictation, confirm/reject scope changes).
- Integration: `ProjectPage` tab `factory` with an attention dot; `ProjectCard` badge; sidebar *Projects*
  pill (`AppNavLink.attention`, rendered by `AppNavItem`); dot on the phone menu button (`AppTopBar`);
  `Session.factory` and a role badge in `SessionListItem`.

Local decisions (session 3):

- The chat dialog reuses `PlatformAgentDialog`; the request text goes to `POST /factories/{id}/chat` and
  the server wraps it in the architect or steering brief.
- Decisions are not parsed in the SPA: the tab links to `DECISIONS.md` (and the core documents) on GitHub;
  change requests show their analysis.
- The handover limit shown (20 %) is a SPA constant mirroring the platform default; if operators change
  `FACTORY_CONTEXT_SOFT_PERCENT`, expose it in the factory payload.

## Log

- Session 3: feature folder, live integration, badges, every view. `bun run build` passes.
