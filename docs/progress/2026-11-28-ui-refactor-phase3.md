> Temporary handover file: once this task is complete, delete this file and its line under # In-progress work in the agent instructions (and that section when it is empty), in the same change.

# SPA UI/UX refactor — finishing phase 3, then phases 4 and 5

## Request

The user (Spanish) asked to continue the SPA UI/UX refactor described in `docs/plans/ui-refactor/PLAN.md`
(read it, plus `FOUNDATION.md` = shared API, `AUDIT.md` = findings per screen). Requirements:
- First close the inconsistent state left by previous sessions (they used sub-agents in parallel and left
  phase 3 half-done, deleting components without updating pages → the build fails), then finish every
  pending task of the plan (phases 3, 4, 5), efficient, scalable, complete, maintainable, consistent.
- **Do NOT use sub-agents** (Agent tool / workflows) — the user was explicit: do everything yourself.
- It must deploy and work: phase 4 = deploy the preview and verify with Playwright at 360×780 and
  1440×900, light and dark (the user explicitly asked for deploying/testing; follow the deployment brief
  via `GET /sessions/<id>/deployment/agent/brief` as the system prompt says). Report in `E2E.md`.
- Phase 5: `bun run build` green, `AGENTS.md` updated (remove the *SPA UI/UX refactor* pointer under
  *Current work*), plan files deleted.
- No tests, no new dependencies. Conventional commits only if asked to commit.

## Done (this session)

Area E (account, admin, agents, recipes) — complete and type-clean:
- New shared `shared/components/forms/select/SelectField.tsx` (Select + visible label/hint/error via `Field`).
  Use it for every labelled picker. Add it to `FOUNDATION.md` §4/§10 when closing.
- `features/agents/components/accounts/`: `AgentAccountsPanel.tsx` (new), `AddAgentAccountDialog.tsx` (new),
  `RenameAgentAccountDialog.tsx` (new, mounted with `key`), `AgentSignInAgainDialog.tsx` (new);
  `AgentAccountRepairNotice.tsx` (dropped unused `legacy` prop), `AgentAccountRow.tsx` (call updated).
- `features/agents/components/defaults/AgentDefaultsRow.tsx` (new, SelectField instead of native selects),
  `AdminAgentDefaults.tsx` (rewritten as a `PageSection`).
- `features/agents/components/AgentAccountSelect.tsx` → SelectField.
- `features/sessions/components/SessionModelFields.tsx` (SelectField, no native `<select>`),
  `AgentModelFields.tsx` (Alert/Spinner, no nested label), `AgentAdapterSelect.tsx` (label style).
- `features/admin/components/AdminUsersPanel.tsx`, `AdminUserRow.tsx` (stacked rows, memo, Live visible),
  `AdminUserDialog.tsx` (actions as ListRows + ConfirmDialog for ban; no overflowing footer).
- `features/recipes/components/RecipeMarketplacesPanel.tsx` (new; `RecipeMarketplacesCard.tsx` removed via
  `git rm`), `RecipeMarketplaceRow.tsx` (Menu + long press), `AddRecipeMarketplaceDialog.tsx` (TextField).
- `pages/AccountPage.tsx` (Page/PageHeader/Tabs/TabPanels swipeable, `useTabParam`, tabs
  general|github|agents|recipes — `?tab=agents` deep link kept), `pages/AdminPage.tsx`
  (SegmentedControl + TabPanels, `?tab=agents`).

## In progress

Area D (production, backups, development variables). Nothing half-written. I had just read
`pages/ProjectDeploymentPage.tsx`. The previous session already built good shared pieces in
`features/production/components/operation/` (`OperationHeader`, `OperationConsole`, `OperationStatusCard`,
`OperationSteps`, `OperationStateBadge`, `OperationStateIcon`, `OperationOutput`, `OperationProjectGate`,
`OperationSessionPanel`, `operationStateView.ts`), `features/production/lib/operationTabs.ts`,
`types/OperationTab.ts`, `hooks/useNow.ts`. Next step: rewrite `ProjectDeploymentPage.tsx` with
`OperationProjectGate` + `OperationHeader` (actions as `ActionItem[]`: Deploy primary, Variables, Reconfigure,
Check status, Delete configuration destructive) + `operationTabs()` + `OperationSessionPanel`; replace
imports of deleted `DeploymentStateBadge/Icon` → `OperationStateBadge/Icon`, `ProductionSteps/BackupSteps` →
`OperationSteps`, `ProductionTab/BackupTab` → `OperationTab`, `ProductionPageHeader/BackupPageHeader` →
`OperationHeader`. Same for `ProjectBackupPage.tsx`. Then fix the console panels/hero components and migrate
`DeploymentsPage`/`BackupsPage` to Page/PageHeader.

## Pending (in order)

1. Make `cd spa-mooi && bun run typecheck` green. Remaining errors (34) at handover:
   - D: see above (BackupConsolePanel, BackupDetailDialog, BackupHero, BackupHistoryList, BackupProjectCard,
     BackupRow, ProductionConsolePanel, ProductionDeploymentDetailDialog, ProductionHero,
     ProductionHistoryCard, ProductionHistoryList, ProductionProjectCard, ProjectBackupPage, ProjectDeploymentPage).
   - C: `pages/ProjectsPage.tsx` imports deleted `ProjectGrid`/`ProjectsHeader`; `pages/ProjectPage.tsx`
     imports deleted `ProjectHeader` (also deleted: `ProjectCard`, `AddProjectTile`). Rebuild them on the
     foundation (see AUDIT.md "Projects"/"Project": compact header, ResponsiveActions with destructive
     "Delete GitHub repository" last in the menu, card long-press menu, no duplicate add actions).
     Old versions: `git show fcb897d^:spa-mooi/src/<path>`.
   - B: `features/sessions/components/WorkspaceHeader.tsx:63` MergeButton needs a `merge` prop;
     `features/sessions/components/deploy/DeployTerminal.tsx:74` passes `sticky` the toolbar doesn't accept.
     New pieces exist in `features/sessions/components/session/` (SessionActionsMenu, SessionDetailRow,
     SessionDetailsSheet), `merge/MergeConflictsDialog.tsx`, `lib/deployMenuSection.tsx`,
     `hooks/useSessionChangesSeed.ts`, `hooks/useSessionModels.ts` — check whether the old root
     `SessionActionsMenu.tsx` is now a duplicate and wire the new ones.
   - A: `features/sessions/components/chat/ActivityGroup.tsx`, `ActivityStepRow.tsx`, `ChatMessageItem.tsx`
     import `@/features/sessions/lib/describeStep` and `.../groupTurnBlocks`, moved to
     `@/features/sessions/lib/activity/describeStep` and `.../activity/groupTurnBlocks` (groupTurnBlocks API
     changed ~50%: read it before fixing); new libs `lib/activity/*`, `lib/commands/*`, `lib/transcript/*`
     must actually be used by the chat components.
2. Finish migrating every area to the foundation (FOUNDATION.md §14 checklist). Legacy markers to drive the
   work (count by `grep -rE "text-\[[0-9]"`, `<select`, native `title=` on elements, unwrapped `hover:`):
   sessions (86 raw sizes, 7 `<select>`, 19 titles, 37 hovers — e.g. `ComposerSelect`, `ChatUsageIndicators`,
   `NewSessionDialog`), traces (47 raw, 16 titles), factory (51 raw), todos (24 raw, 17 hovers), projects,
   platform (`PlatformAgentDialog`: "Enter to start · Shift+Enter" hint must not show on phones), production,
   backups, layouts (10 raw), shared (16 raw). No page used `Page`/`PageHeader` before this session: migrate
   SessionsPage, TodosPage, ProjectsPage, ProjectPage, DeploymentsPage, BackupsPage, SessionPage (immersive,
   own header), LoginPage, GithubCallbackPage, NotFoundPage (add a Back action). Add the session
   **Workspace** tab if missing (AGENTS.md lists it).
3. `bun run build` green.
4. Phase 4: deploy the preview (deployment brief API), Playwright 360×780 + 1440×900, light + dark, every
   screen and overlay incl. those AUDIT.md lists as "Not exercised"; keyboard open; long texts. Sign in via
   `https://mooi.skypea.dev/preview/<id>/` (127.0.0.1 rejects the mock sign-in). Write `E2E.md`, fix, repeat.
5. Phase 5: update `FOUNDATION.md` facts worth keeping into `AGENTS.md` only if they shape future work
   (e.g. "overlays only through shared primitives", SelectField), remove the *SPA UI/UX refactor* line from
   AGENTS.md *Current work*, delete `docs/plans/ui-refactor/`, delete this file and its pointer.
   Also delete the stray `.playwright-mcp/` files committed in fcb897d.

## Context

- Repo: `spa-mooi` (React 19, TS, Vite, Tailwind 4, Zustand 5). Typecheck: `cd spa-mooi && bun run typecheck`
  (bun is installed; `bun install` already done). Do not use `npx tsc`.
- Last commit `fcb897d refactor: whole interface redesign` holds the half-done work; original files before
  the refactor: `git show fcb897d^:spa-mooi/src/...` (use `rtk proxy git show ...` when output is truncated).
- Foundation API is accurate as documented in FOUNDATION.md (Page, PageHeader with sticky children row,
  PageSection, ListGroup/ListRow (swipeActions), Tabs/TabPanels/useTabParam, SegmentedControl, Dialog
  (`footer` order Cancel…Primary, `dismissible`, `initialFocus`), Sheet, Menu (sections, controlled open for
  long press), ResponsiveActions, Select, ConfirmDialog (`error`, `busy`), Alert (`action`), EmptyState
  (description required), ErrorState (description required), Stat, CompactNumber, TruncatedText, toast()).
- Select has no visible label: use `SelectField` in forms.
- Patterns used in area E: per-row `Menu` opened by `useLongPress`, row components `memo`'d with id-based
  callbacks, overlays mounted conditionally with `key` when they hold a draft, destructive actions via
  `ConfirmDialog`.
