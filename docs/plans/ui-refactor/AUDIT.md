# UI/UX audit of `spa-mooi` (phase 1)

Preview checked with Playwright at 360×780 (keyboard approximated at 360×420) and 1440×900, dark and light.
Screenshots are in `/tmp/ui-audit/` (outside the repo). Setup used: project `Mydherin/MyTechInterview`
(web app) and one session (`feat/mytechinterview-bp0utf`, one message). Paths are relative to `spa-mooi/src`.
Severity: **H** breaks use or looks broken, **M** degrades the experience, **L** polish.

**Not exercised** (no data, or the step would deploy or commit to GitHub): to-do items (adding one commits
`docs/TODOS.md`), Preview tab, deploy terminal and logs drawer, merge dialog and diff view, question and
permission cards, image lightbox, active factory (roadmap, journal, change requests), production and backup
consoles and chats, release dialog, restore dialog, Codex pairing. Phase 4 must cover them.

## Global patterns (fix in the foundation)

### Navigation shell (`layouts/app/*`)
- **H** Phones have no persistent navigation. Everything sits behind a hamburger drawer (`AppMobileDrawer`),
  so switching Projects ↔ Sessions ↔ To-dos takes 2 taps and has no thumb-reach entry. Use a bottom tab bar
  (Projects, Sessions, To-dos, More) plus the drawer or a "More" sheet for the rest.
- **H** Back does not close overlays. With the drawer or any `Modal` open, browser/hardware Back leaves the
  page (checked: an open "Create project" sheet + Back navigated to the previous route). AGENTS.md requires
  "Back closes the topmost overlay". Overlays need a shared history entry.
- **M** The drawer has no swipe to open or close and no exit animation (it unmounts at once). The theme toggle
  and account avatar take top-bar space on every page and duplicate Account → Preferences and the drawer footer.
- **M** On desktop there are two stacked headers on detail pages: the top bar ("Projects" crumb + theme) and the
  page header (back + title + actions). Together they take about 180 px on the session page. On phones the page
  header replaces the top bar (session, deployment) but not on the project page, so the pattern is inconsistent.
- **M** `<main>` is the only scroller (`AppLayout`), with `overflow-y-auto` and `overscroll-behavior: auto`.
  The Safari/Chrome toolbars never collapse, scroll chains into the page, and `overflow-x` is not clipped,
  so any wide child scrolls the whole page sideways (see Tooltip).
- **M** `index.html`: `maximum-scale=1, user-scalable=no` blocks pinch zoom (WCAG 1.4.4).
  `theme-color` is fixed to `#09090b`, so the status bar stays dark in the light theme.
- **L** The theme only offers Light/Dark (no System). It lives in the top bar, in Account and nowhere else.

### Overlays (`shared/components/Modal.tsx`, `ActionsMenu.tsx`, `Tooltip.tsx`, `FloatingTooltip.tsx`, `TapTooltip.tsx`)
- **H** On phones the whole sheet scrolls, including the footer (`overflow-y-auto` on the card, footer inside).
  Primary actions scroll out of view: "Create on GitHub" sits at y≈975 on a 780 px screen. At 360×420 the
  footer of "Environment variables" is half clipped. Fix: pinned header and footer with a scrolling body, sized
  to the visual viewport.
- **H** The sheet grabber is decorative only: no swipe to dismiss, no drag, and no detents (half/full).
  Sheets also jump height when content loads (Add repository: skeleton at half height, then full height).
- **H** `Tooltip` is CSS-only. Its invisible bubble still takes layout, so `main` scrolls 130 px sideways on
  `/sessions` (`w-max` bubble at r=490). It never opens on touch unless `focusable`, so the full values of
  truncated paths and branches are unreachable on phones. 62 components rely on `title=` for full text, and
  `title` does nothing on touch.
- **M** `ActionsMenu` is an absolutely positioned dropdown on every viewport. On phones it should be an action
  sheet. It closes on Escape and outside click but has no exit animation.
- **M** Composer popovers (`ComposerModelMenu`, `ChatUsageIndicators`) open over the composer and the last
  messages, so you cannot see what you are changing. On phones they should be bottom sheets.
- **M** No overlay has an exit transition: `Modal`, the drawer and `ActionsMenu` all return `null` immediately.
- **L** `Modal` focuses the sheet, not the first field. Good for not popping the keyboard, but the To-dos
  project filter does the opposite: it autofocuses its search and opens the keyboard.

### Tabs (`shared/components/Tabs.tsx`)
- **M** Tab strips overflow on phones with a fade but nothing hints at the hidden tabs: the project page shows
  "Sessions, Workspaces, To-…", the session page hides "Trace", and Account hides "Recipes". There is no swipe
  between panels. Prefer segmented controls for 2 or 3 tabs, a scrollable strip with snap and an overflow menu
  for more, and swipe between panels.
- **L** Pages with a single tab render a strip anyway ("Overview" on project deployment and backup).

### Headers and page hero
- **H** Phone pages spend 300 to 450 px before the first useful item: eyebrow + H1 + paragraph + a
  stacked search and action bar + KPI cards (Projects, Sessions, To-dos, Admin). The project page header card
  alone is 380 px. Compact large-title headers that collapse on scroll, with descriptions moved to empty
  states or info sheets.
- **M** Icon-only header actions with no labels: the project header has GitHub, key, pencil and trash in a
  row, with **Delete GitHub repository** (destructive) one tap away beside Edit. Use an overflow menu, and put
  destructive actions last and separated.

### Forms
- **M** Native `<select>` for model, effort and handover (`NewSessionDialog`, `SessionModelFields`,
  `ComposerSelect`, `AgentDefaultsRow`, `ChatUsageIndicators`) looks inconsistent next to the custom account
  picker and the segmented adapter control. Use one picker component, a sheet on phones.
- **M** Hints say "Enter to start · Shift+Enter for a new line" on phones, where there is no Shift
  (`PlatformAgentDialog`, `DeploymentSetupDialog`). The desktop composer shows kbd hints, which is fine.
- **M** The variables editor (`DevelopmentEnvironmentDialog`) shows a fixed `MOOI_DEVELOPMENT_` prefix that
  takes about half the 178 px name field. Long names scroll inside it and cannot be read. The row's delete is
  a lone icon under the inputs.
- **L** Inputs lack `autocomplete`/`inputmode`/`enterkeyhint` (only the chat composer sets `enterkeyhint=send`).
  Search inputs are 38 px tall. Search placeholders clip ("Search repositorie", "Search by name or emai").
- **L** The "New project" button has `aria-label="Create project"`: the accessible name differs from the
  visible label.

### Lists and rows
- **H** Rows truncate their primary text to almost nothing because fixed-width chips and icons beside them
  take the space. Admin user row "de…" and "developer@m…" (`AdminUserRow`), agent account "Claud…"
  (`AgentConnectionsCard`), session row branch "feat/mytechinter…" (`SessionListItem`), trace title "Gr"
  (`TracePanel`/`TraceToolbar`). Rows should stack on phones (title line, meta line) with status as a dot or
  badge, and long values should be reachable.
- **M** The session row puts a wide "Ready" pill in a left column (`SessionListItem`), wasting about a third
  of the width.
- **L** Cards nest inside cards (factory intro, agent accounts, account role). Visual noise and extra padding.

### Typography and density
- **M** Many 10 to 11.5 px texts: uppercase mono eyebrows, KPI labels, chips such as "Chat & code", counts,
  meta lines. They are hard to read on a phone. Set a minimum of 12 px for meta and 11 px for uppercase
  eyebrows, with fewer of them.
- **M** Low-contrast text: "YOUR ROLE" eyebrow on the gradient Admin card (Account), the disabled
  "Edit profile" button. Muted meta in dark mode is borderline AA.
- **L** Mono font is used for paths, branches, numbers, durations and eyebrows alike, so too much reads as
  code.

### Touch
- **M** The standard icon button is 40×40 (`IconButton`, `ActionsMenu`, top bar). Smaller ones: 32×32 (copy,
  reload to-dos, context KPI button), 28×28 (trace collapse), 36 px buttons and chips, 17 to 20 px text links
  (breadcrumb, repo link). Below 44 px.
- **M** Hover-only affordances: `opacity-0 group-hover` in `TodoRow`, `ActivityGroup`, `ActivityStepRow`,
  `ChatUsageIndicators`, `ProjectCard`. On touch these are invisible.
- **M** Almost no native gestures. Swipes exist only in `TraceInspector` (`features/traces/hooks/useSwipeGestures.ts`)
  and `ImageLightbox`. Missing: swipe to dismiss sheets, swipe between tabs, edge swipe back, long press on
  rows (session, project, to-do) for context actions, and pull to refresh instead of "Refresh" buttons.

### Keyboard (`shared/hooks/useAppViewport.ts`)
- **M** The shell follows the visual viewport, but in sheets the actions sit below the fold while typing
  (see Overlays). In the session, header + tabs + file toolbar take 155 of 420 px with the keyboard open.
  The `composing:` variant hides session tabs only on real touch devices (not verifiable here). The composer
  grows to 192 px max, half the remaining space.

### Motion
- **M** Entry animations exist (`sheet-in`, `drawer-in`, `menu-in`, `fade-up`; reduced motion is honoured in
  `styles/index.css`). There are no exit animations, no shared-element or route transitions beyond a fade, no
  tab panel transition, no list item enter/exit and no layout animation when rows change state.

### Visual design
- **M** Screens look like the same template: eyebrow + H1 + paragraph + stat cards + bordered list. There is
  little hierarchy and they look flat on phones. Desktop is clean but sparse (most pages are max-w-6xl with
  wide empty areas). Explanatory copy is everywhere: Account repeats "Your session", "Admin" and "Always
  reversible" cards under every tab, and Factory and Deployments show long marketing paragraphs.

## Screens

### Login — `pages/LoginPage.tsx`, `features/auth/**`, `features/brand/**`
- L Looks good. On the 127.0.0.1 origin the dev sign-in fails with "This account is suspended" (403 on
  `/auth/google`). The cookie or origin mismatch is shown as a ban message, which is misleading.
- Inventory: theme toggle, Continue with Google / developer sign-in, error alert.

### Projects — `pages/ProjectsPage.tsx`, `features/projects/components/{ProjectsHeader,ProjectGrid,ProjectCard,AddProjectTile}.tsx`
- H 330 px of header before the first card on a phone. The full-width search, three buttons and the eyebrow
  could be one compact bar.
- M Duplicate actions: an icon-only "Add repository" + "New project" (aria "Create project"), then an "Add
  another repository" tile, and in the empty state both "Create project" and "Add repository" again.
- M The card is a single link. Card hover reveal (`ProjectCard`) does nothing on touch. There are no
  per-card quick actions (long press).
- Inventory: search projects, refresh from GitHub, add repository (picker → kind step), create project
  (name, visibility, kind), open project, project card (name, owner/repo, visibility, description, branch,
  stars, kind, added date), add-another tile, empty state.

### Add repository / Create project sheets — `AddProjectDialog`, `RepositoryPicker`, `RepositoryRow`, `ProjectKindStep`, `CreateProjectDialog`
- H The footer scrolls away (Create on GitHub, Close). The sheet jumps from half to full height when the list
  loads.
- M Repo descriptions are truncated with no way to read them. The 2-step flow has no step transition.
  The kind cards are large (about 170 px each).
- Inventory: search repositories, reload, "N reachable · checked …", per-repo Add, step 2 kind choice, change
  repo, back, add project. Create: name (validation hint), private/public, kind, Create on GitHub.

### Project — `pages/ProjectPage.tsx`, `features/projects/components/ProjectHeader.tsx`
- H Destructive "Delete GitHub repository" is an unlabeled trash icon beside Edit. There is no "remove from
  Mooi only" option in the UI.
- H The 380 px header card plus tabs push the content below the fold. The tab strip clips "To-dos".
- M Stats (branch, language, stars, added) take a 2×2 block on phones. They should be secondary.
- Inventory: breadcrumb, open on GitHub, dev variables (sheet), edit project (kind), delete repository (typed
  confirm), repo link. Tabs: Sessions (list, New session), Workspaces (clone root + copy, refresh, clones,
  disk, running deployments, per-workspace cards), To-dos (sync status, reload, add, list), Factory (intro,
  Define the factory → `PlatformAgentDialog`-style sheet: prompt + dictation, account, adapter, model, effort).

### New session sheet — `features/sessions/components/NewSessionDialog.tsx`, `SessionModelFields`, `AgentAccountSelect`
- M Mix of a custom account dropdown, a segmented adapter control and native selects. Long (about 720 px). The
  branch field is 16 px mono and truncates long branches.
- Inventory: agent account, adapter, model, effort, context handover, branch (editable, reuse warning),
  create.

### Session — `pages/SessionPage.tsx`, `features/sessions/components/{WorkspaceHeader,SessionWorkspace,SessionActionsMenu,WorkspaceCompactTitle}.tsx`
- H Phone header: the title button shows details in a hover-style popover. Long paths wrap there but are
  not copyable from it (copy lives in the ⋯ menu).
- M Tabs: Conversation, Changes, Files, Trace (+ Preview when deployed). "Trace" is off-screen at 360. There
  is no **Workspace** tab although AGENTS.md lists one (workspace insights live only in the project's
  Workspaces tab). No swipe between tabs.
- M Desktop shows Deploy + account in the header, while phones bury Deploy in ⋯ under a "PREVIEW" label.
- Inventory: back, details (project, branch, account · adapter, path), ⋯ menu (Deploy preview, Copy branch,
  Copy clone path, Environment variables, Close session), linked sessions menu (when present), merge,
  terminal-state banner, deployment-tested bar, desktop Live badge.

### Session chat — `features/sessions/components/chat/*` (`ChatPanel`, `ChatComposer`, `ChatMessageList`, `ChatUsageIndicators`, `ComposerModelMenu`, `TurnFooter`)
- M The context/limits popover (`ChatUsageIndicators`) covers the composer and the messages. "Conversation"
  actions are two unlabeled icons (compact, clear). It uses a native select for handover, and absolute dates
  such as "Resets 11/28/2026, 3:20:00 PM" are long.
- M The model/effort popover covers the composer. On phones the model is one chip with two native selects.
- M Slash menu: one item, fine. It overlays the messages without a backdrop.
- L The assistant has no avatar on phones but has one on desktop. Turn footer meta (993ms, $0.04) is 11 px mono.
- Inventory: message list (user bubbles, assistant markdown, timestamps, turn duration/cost, activity
  groups and steps, notices, questions, permissions, opened-session cards, image generation, limits wait bar
  with auto resume, completion bar), composer (text, `/` commands, attach images, image strip, dictation
  tap/hold/Ctrl+Shift+., send/interrupt), context KPI (context %, tokens, compact, clear, handover %, 5 h and
  weekly limits with reset times), model + effort, recipes button.

### Changes — `features/sessions/components/changes/*`, `merge/*`
- L Empty state is fine. "Merge to main" is disabled with no explanation.
- Inventory: files changed, +/- totals, merge to main (dialog), changed file rows, diff view.

### Files — `features/sessions/components/files/*`
- M On phones tree and editor are sequential (as specified), but the editor does not wrap lines
  (`whitespace-pre`, scrollWidth 2854 for prose Markdown). There is no wrap toggle, and 155 px of chrome sits
  above the text with the keyboard open.
- L The tree has no changed/unsaved markers visible in this state (could not verify with changes).
- Inventory: search files, tree (expand folders), open file, back to tree, editor with line numbers,
  discard, save (revision conflict reporting).

### Trace — `features/traces/components/*`
- H The toolbar on phones truncates the trace title to "Gr" (Greeting exchange), and Download log shrinks to a
  tiny icon. The summary strip and filter chips are horizontal scrollers inside a vertical page. That is
  acceptable, but the chips are 36 px and the summary cards are cut mid-card with no snap hint.
- M Timeline rows truncate model names ("claude-sonnet…" and "claude-son…" on desktop). The timeline bars
  overlap the row text area on phones.
- L The inspector sheet is good (swipe down and left/right, prev/next). It is the one pattern to generalise.
- Inventory: Timeline/Insights switch, download log, refresh, summary KPIs (duration, prompts, turns, tool
  calls, sub-agents, errors, tokens, cache hit, peak context), search steps, expand/collapse all, filters
  (LLM, Tools, Sub-agents, Skills, Hooks, Context, Events, Errors only), tree rows with duration bars,
  inspector (model, stop reason, tokens, input/output with copy, prev/next), insights (context per request
  chart, open in timeline, tokens per model, tool ranking, errors).

### Sessions overview — `pages/SessionsPage.tsx`, `features/sessions/components/overview/*`, `SessionList*`
- H `main` scrolls horizontally by 130 px (invisible `Tooltip` bubble).
- H About 520 px of header + 4 KPI cards before the list on phones. The KPI cards duplicate the filter tabs
  (All/Working/Needs you/Ready/Previews with counts).
- M KPI captions truncated ("Agents on a …", "Questions or…", "Previews run…"). The row truncates the branch and
  path.
- Inventory: search, refresh, new session (`StartSessionDialog`: project select + session fields), KPIs, status
  filters with counts, groups per project (link, count), session row (status, branch, updated, account,
  adapter, path, context %, 5 h %), open session.

### To-dos — `pages/TodosPage.tsx`, `features/todos/components/*`
- M The project filter dropdown autofocuses its search (opens the keyboard) and is an inline popover. It
  should be a sheet on phones.
- M The row reveals actions on hover (`TodoRow`), so touch users need visible handles. Could not verify the
  drag handle size.
- L "Add" is disabled until text is typed, and the field is only 168 px wide in the project tab.
- Inventory: totals (in progress, to do, done), project filter (search, select all, clear, per-project
  checkbox; remembered), expand/collapse all, per-project section (progress, open project, file · branch,
  reload, add, list with status cycle, drag reorder, unsupported content → cleanup dialog), empty state.

### Deployments / project deployment — `pages/DeploymentsPage.tsx`, `pages/ProjectDeploymentPage.tsx`, `features/production/**`
- M The project header on phones truncates the name ("MyTech…") and repo, and shows "Not configured" twice
  (header dot + badge). A single "Overview" tab is shown.
- M The deploy setup sheet is long (prompt, 4 suggestion chips, account, adapter, model, effort). The
  "Enter to start" hint is wrong on phones.
- Inventory: list with KPIs (projects, live), Projects/History tabs, project card (status, set up
  production), detail: back, variables (sheet), ⋯ (GitHub releases, delete configuration), hero (state,
  Deploy), 3 steps, setup sheet (prompt + dictation + suggestions + agent fields), console, production chat,
  platform files, release dialog, history detail dialog.

### Backups / project backup — `pages/BackupsPage.tsx`, `pages/ProjectBackupPage.tsx`, `features/backups/**`
- M Same header problems as Deployments. The "Deploy to production first" gate is fine.
- Inventory: KPIs (projects, protected), Projects/History tabs, project card, detail: back, variables, ⋯
  (production deployment, delete configuration), hero, steps, setup chat, console, restore dialog
  (production/sandbox), backup detail dialog, delete backup.

### Account — `pages/AccountPage.tsx`, `features/account/**`, `features/agents/**`, `features/github/**`, `features/recipes/**`
- H The agent account row truncates the name to "Claud…" behind three icon buttons (default, rename,
  disconnect). No per-account usage KPIs are visible (AGENTS.md lists them).
- M The "Your session", "Admin" and "Always reversible" cards repeat under every tab, and "Edit profile" is a
  permanently disabled button. The tab strip clips "Agent accounts" and hides "Recipes".
- M "Log out on every device" uses an inline second-tap confirm ("Confirm — every device") with no timeout
  cue. A confirm sheet is clearer.
- Inventory: profile (avatar, name, role, email, since), appearance (Light/Dark), log out here, log out
  everywhere, role card + Go to Admin, GitHub (account, connected, profile link, repository access, disconnect,
  connect), agent accounts (add: title + provider → Claude OAuth paste-code / Codex device code; set
  default, rename, disconnect, sign in again, deprecated notice), recipe marketplaces (add by repo URL,
  list, remove).

### Admin — `pages/AdminPage.tsx`, `features/admin/**`, `features/agents/components/AdminAgentDefaults.tsx`
- H The user detail sheet footer has three buttons that overflow and clip ("Close sessions", "Sign out
  everywhe", Ban) (`AdminUserDialog`). The live session row truncates everything.
- H The user row truncates name and email to 2 to 10 characters (`AdminUserRow`).
- M The "Live" indicator is hidden on phones. The agents tab uses native selects. Codex fields are disabled
  without explaining why next to them (the hint sits at the bottom).
- Inventory: KPIs (users, online, live sessions, agents working), search users, reload, live badge, user row
  (online dot, role, session count, projects), user sheet (status, role, joined, projects, agent accounts,
  GitHub, devices, live sessions with close, devices list, Close sessions, Sign out everywhere, Ban/Unban),
  Agents tab (per provider: adapter, model, effort, handover; reload; saved on change).

### 404 — `pages/NotFoundPage.tsx`
- L Fine. Could offer "Back" as well as "Go to projects".
