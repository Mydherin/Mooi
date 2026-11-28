> Temporary handover file: once this task is complete, delete this file and its line under # In-progress work in the agent instructions (and that section when it is empty), in the same change.

# SPA UI/UX refactor — finishing phase 3, then phases 4 and 5

## Request

The user (Spanish) asked to continue the SPA UI/UX refactor of `docs/plans/ui-refactor/PLAN.md` exactly where it
stopped (read this file, then `PLAN.md` and `FOUNDATION.md`; trust them, do not re-explore the repo; read only
files you touch; pre-refactor versions via `git show fcb897d^:spa-mooi/src/<path>`). Requirements:
- **Do NOT use sub-agents or workflows** — do everything yourself. Be very context-efficient (batch commands,
  precise edits, do not re-read documented things).
- Result efficient, scalable, maintainable, consistent, coherent; no regressions, no lost functionality.
- Order: typecheck green (areas D, C, B, A) → migrate every screen to the foundation (FOUNDATION.md §14) →
  `bun run build` green → phase 4 (deploy the preview following the Mooi deployment brief
  `GET http://127.0.0.1:8000/sessions/<id>/deployment/agent/brief`, Playwright at 360×780 and 1440×900, light
  and dark, report in `E2E.md`, fix and repeat) → phase 5 (close the plan, update `AGENTS.md`, delete temporary
  files and `.playwright-mcp/`).
- Update this progress file after finishing each area.
- No tests, no new dependencies. Conventional commits only if asked to commit.

## Done

- Earlier session (committed in 8b45405): area E (account, admin, agents, recipes), new shared
  `shared/components/forms/select/SelectField.tsx` (add it to FOUNDATION/AGENTS facts when closing).
- This session: **area D typecheck-clean and migrated** (uncommitted, in the working tree):
  - `features/production/components/`: `ProductionConsolePanel` (thin wrapper of `operation/OperationConsole`),
    `ProductionHero` (on `OperationStatusCard` + `OperationSteps`, no `project` prop any more),
    `ProductionOverviewPanel` (ErrorState/Skeleton/Alert, no `project` prop), `ProductionHistoryCard` (ListGroup +
    memo ListRow, redeploy as swipe action + in detail dialog), `ProductionHistoryList` (ListRow, swipe "Project"),
    `ProductionProjectCard` (now a `ListRow` → must be rendered inside a `ListGroup`), `ProductionDeploymentDetailDialog`
    (Tabs + OperationOutput, delete via ConfirmDialog, new optional `projectTo` prop → "Open project" link),
    `ProductionStats` (shared `Stat`), `ProductionReleaseDialog` (SegmentedControl, TextField, Spinner, Alert).
  - `features/backups/components/`: `BackupConsolePanel`, `BackupHero` (prop `projectId` instead of `project`),
    `BackupOverviewPanel` (prop `projectId`), `BackupListCard` (ListGroup), `BackupRow` (memo, Menu + long press:
    View/Verify/Restore/Delete), `BackupHistoryList`, `BackupProjectCard` (ListRow), `BackupDetailDialog`
    (SelectField for operations, SegmentedControl Output/Script, `projectTo`), `BackupStats` (Stat).
  - `pages/ProjectDeploymentPage.tsx` and `pages/ProjectBackupPage.tsx`: `OperationProjectGate` → inner
    `ProductionScreen`/`BackupScreen`; `OperationHeader` with `ActionItem[]` (Deploy/Create backup primary,
    Environment variables, Change…, Check status / Production deployment link, GitHub releases, Delete configuration
    destructive), `operationTabs()`, `useTabParam`, `OperationSessionPanel` for changes/trace, tabpanel ids
    `<prefix>-panel-<id>` matching `Tabs` `idPrefix` ("production"/"backup").
  - `pages/DeploymentsPage.tsx`, `pages/BackupsPage.tsx`: Page/PageHeader (eyebrow Production, subtitle counts),
    SegmentedControl Projects|History via `useTabParam` (`?tab=history` kept), SearchInput, ListGroup,
    ErrorState/EmptyState/Skeleton, detail dialogs get `projectTo`.
  - `features/platform/components/PlatformEnvironmentCard.tsx` (tokens, no `title=`).
  - `features/sessions/components/workspaces/WorkspaceStat.tsx` deleted (`git rm`); its users
    (`WorkspaceStats.tsx`, `overview/SessionsOverviewStats.tsx`, BackupStats, ProductionStats) use shared `Stat`.
  - `git mv` `features/development/hooks/useEnvironmentDraft.ts` → `features/platform/hooks/useEnvironmentDraft.ts`
    and `features/development/lib/environmentNames.ts` → `features/platform/lib/environmentNames.ts` (import updated;
    still unused — see In progress).

## In progress

Step 2 of Pending (legacy-marker sweep). **Typecheck is green** (all of step 1 is done). A mechanical sweep
(`/tmp/uiref/sweep.py`, may be gone; not needed again) already ran over `spa-mooi/src`: `text-[N px]` ≤18 px →
text styles (`text-mono` when the literal has `font-mono`; skipped Initials, Logo, <10 px and <11 px in
layouts/shared), bare `hover:`/`group-hover:` → `hover-device:` variants, `<LoaderCircle … animate-spin/>` →
`Spinner`. Typecheck stayed green; the diff was spot-checked in shared/layouts (fine).
**Next step**: re-run the marker grep
`grep -rnE "text-\[[0-9]|<select|<[a-z]+ [^>]*\btitle=|opacity-0[^\"]*hover-device:group-hover" spa-mooi/src --include=*.tsx`
and fix by hand: the 4 native `<select>` (ChatUsageIndicators:96, ComposerSelect, ComposerModelMenu:30,
NewSessionDialog:136 → shared `Select`/`SelectField`); `title=` on native elements (→ `Tooltip`/`IconButton`, drop when
aria-label + visible text); hover-only reveals (`opacity-0 … hover-device:group-hover:opacity-100` must stay visible
on touch: use `hover-device:opacity-0`); remaining ≥20 px sizes (LoginPage etc. → `text-title`/`text-large-title`);
hand-made alerts (`role="alert" className="… bg-danger-soft"` → `Alert`). Then pages still without Page/PageHeader
(SessionsPage, TodosPage, LoginPage, GithubCallbackPage, NotFoundPage + Back) and the heaviest files first:
WorkspaceCard, TraceInspector, ProjectTodosSection, TraceRow, FactoryChangeRequests/Journal/Checklist, TracePanel,
TraceContextChart, ChatUsageIndicators, OpenedSessionCard. Check the session **Workspace** tab exists in
`SessionWorkspace`. Finished since the previous handover:
- D/platform leftovers: `PlatformEnvironmentDialog` on `useEnvironmentDraft` + `TextField`; `PlatformEnvironmentCard`
  uses `shortVariableName`; `PlatformAgentDialog` (Enter submits only off touch via new shared `TOUCH_QUERY` in
  `shared/hooks/mediaQueries.ts`, also used by `useAppViewport`, `useNativeTouchGuards`, `PreviewPanel`);
  `PlatformFilesPanel`, `PlatformChatPanel`; `PlatformDeleteDialog` and `BackupRestoreDialog` on `ConfirmDialog`.
- C typecheck: `ProjectsPage` (Page/PageHeader, ResponsiveActions New project/Add repository/Refresh hidden while
  empty, the empty state holds both; SearchInput; ListGroup of new `features/projects/components/ProjectRow.tsx`
  with long-press Menu: open, GitHub, variables, edit), `ProjectPage` (PageHeader with Initials, fact Badges,
  ResponsiveActions New session/GitHub/variables/edit/Delete GitHub repository; Tabs + `TabPanels swipeable`,
  idPrefix "project", `useTabParam`). `SessionList` is now a plain `ListGroup` (no onNewSession), `SessionListItem`
  and `overview/SessionGroupSection` restyled on ListGroup.
- B typecheck: `WorkspaceHeader` rewritten (BackButton, title button opening `session/SessionDetailsSheet`,
  `useMerge` → `MergeButton merge`, `session/SessionActionsMenu` with onDetails/closeError, LinkedSessionsMenu from
  sm); deleted old root `SessionActionsMenu.tsx` and `WorkspaceCompactTitle.tsx`; `SessionPage.handleClose` returns
  the promise; `DeployTerminalToolbar` accepts `sticky`; `DeployGroupButton` Tooltip; `DeployButton` loading/icon.
- A typecheck: `ActivityGroup`/`ActivityStepRow`/`ChatMessageItem` on `lib/activity/*` (currentAction, stepDetails,
  summarizeActivity), `ChatMessageList` on `transcript/visibleEntries`, `TurnFooter` gained a Copy answer action
  (`turnText`). Every `lib/activity|commands|transcript` module is now imported.

## Pending (in order)

1. Typecheck green. Remaining errors (15) at handover, all outside D:
   - C: `pages/ProjectsPage.tsx` imports deleted `ProjectGrid`/`ProjectsHeader`; `pages/ProjectPage.tsx` imports
     deleted `ProjectHeader` (also deleted: `ProjectCard`, `AddProjectTile`). Rebuild on the foundation (AUDIT.md
     "Projects"/"Project": compact header, ResponsiveActions with destructive "Delete GitHub repository" last,
     card long-press menu, no duplicate add actions). Old versions: `git show fcb897d^:spa-mooi/src/<path>`.
   - B: `features/sessions/components/WorkspaceHeader.tsx:63` MergeButton needs a `merge` prop;
     `features/sessions/components/deploy/DeployTerminal.tsx:74` passes `sticky` the toolbar doesn't accept.
     New pieces exist in `features/sessions/components/session/` (SessionActionsMenu, SessionDetailRow,
     SessionDetailsSheet), `merge/MergeConflictsDialog.tsx`, `lib/deployMenuSection.tsx`,
     `hooks/useSessionChangesSeed.ts`, `hooks/useSessionModels.ts`. The old root
     `features/sessions/components/SessionActionsMenu.tsx` duplicates `session/SessionActionsMenu.tsx` (both import
     DevelopmentEnvironmentDialog): wire the new one and delete the old.
   - A: `features/sessions/components/chat/ActivityGroup.tsx`, `ActivityStepRow.tsx`, `ChatMessageItem.tsx` import
     `@/features/sessions/lib/describeStep` and `.../groupTurnBlocks`, moved to `@/features/sessions/lib/activity/…`
     (groupTurnBlocks API changed: read it before fixing); new libs `lib/activity/*`, `lib/commands/*`,
     `lib/transcript/*` must actually be used by the chat components.
2. Finish migrating every area to the foundation (§14). Find legacy markers with
   `grep -rnE "text-\[[0-9]|<select|<[a-z]+ [^>]*title=| hover:" src` (D is clean except the platform files above):
   sessions (`ComposerSelect`, `ChatUsageIndicators`, `NewSessionDialog`…), traces, factory, todos, projects,
   layouts, shared. Pages still without `Page`/`PageHeader`: SessionsPage, TodosPage, ProjectsPage, ProjectPage,
   SessionPage (immersive, own header), LoginPage, GithubCallbackPage, NotFoundPage (add a Back action). Add the
   session **Workspace** tab if missing (AGENTS.md lists it).
3. `cd spa-mooi && bun run build` green.
4. Phase 4: deploy the preview (deployment brief API), Playwright 360×780 + 1440×900, light + dark, every screen
   and overlay incl. those AUDIT.md lists as "Not exercised"; keyboard open; long texts. Sign in via
   `https://mooi.skypea.dev/preview/<id>/` (127.0.0.1 rejects the mock sign-in). Write `E2E.md`, fix, repeat.
5. Phase 5: move FOUNDATION.md facts that shape future work into `AGENTS.md` (e.g. overlays only through shared
   primitives, SelectField for labelled pickers, operation/ shared pieces for production+backups), remove the
   *SPA UI/UX refactor* line from AGENTS.md *Current work*, delete `docs/plans/ui-refactor/`, delete this file and
   its pointer, delete the stray `.playwright-mcp/` files committed in fcb897d.

## Context

- `spa-mooi`: React 19, TS, Vite, Tailwind 4, Zustand 5. Run `bun install --frozen-lockfile` first if
  `node_modules` is missing (it was missing in this clone). Typecheck: `cd spa-mooi && bun run typecheck`. No `npx tsc`.
- Foundation API as in FOUNDATION.md. Checked details: `Button` has `icon?: LucideIcon` and `loading`; `Card` adds
  no padding; `ListRow` renders an `<li>` (always inside `ListGroup`), `trailing` sits inside the row's
  button/link, so never put a button in `trailing` of a clickable row — use `swipeActions` + a menu/dialog, or the
  `RecipeMarketplaceRow` pattern (row `<li>` with a button + a sibling `Menu`, `useLongPress` opening it);
  `useTabParam(ids, fallback)` validates against ids; `Tabs` ids are `${prefix}-tab-${id}` / `${prefix}-panel-${id}`
  (`tabId`/`panelId` exported from `Tabs.tsx`); `SelectField` = Select props + label/hint/error; `Stat`
  (label, value, hint, icon, tone) in `grid grid-cols-2 gap-3 lg:grid-cols-4`.
- Shared operation pieces for production and backups live in `features/production/components/operation/`
  (`OperationHeader`, `OperationConsole`, `OperationStatusCard`, `OperationSteps`, `OperationStateBadge/Icon`,
  `OperationOutput`, `OperationProjectGate`, `OperationSessionPanel`), `features/production/lib/operationTabs.ts`,
  `types/OperationTab.ts`, `hooks/useNow.ts`.
- Patterns: rows `memo`'d with id/object callbacks, overlays mounted conditionally with `key` when they hold a draft,
  destructive actions via `ConfirmDialog`, errors via `Alert`/`ErrorState`, loading via `Skeleton`/`Spinner`.
