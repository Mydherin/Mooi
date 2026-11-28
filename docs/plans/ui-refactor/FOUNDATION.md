# UI foundation (`spa-mooi`, phase 2)

The public API every phase-3 screen is rebuilt on. Paths are relative to `spa-mooi/src`. Read with the root
`AGENTS.md` (*Experience and design*, *Reactivity and performance*, *Code*). Shared APIs are frozen in phase 3:
list needed changes in your report instead of editing them (see `PLAN.md`).

## 1. Folder layout

```
styles/            index.css (entry) → tokens.css, theme.css, base.css, utilities.css, motion.css
app/               router (lazy screens), navigation/installNavigationGuards (overlay unwind + view transitions)
layouts/app/       AppLayout, sidebar/, tab-bar/ (AppTabBar, AppMoreSheet), top-bar/ (breadcrumbs), account/, navigation/, hooks/
shared/components/
  actions/         Button, IconButton, CopyButton, ResponsiveActions (+ ActionItem), ThemeToggle
  brand/           Logo, LogoMark, GithubMark
  data-display/    Card, Badge, StatusDot, Stat, CompactNumber, TruncatedText, ListGroup, ListRow, Avatar, Initials, Eyebrow
  feedback/        Alert, EmptyState, ErrorState, Skeleton, Spinner, toast/ (toast(), Toaster)
  forms/           Field, TextField, TextArea, Switch, Checkbox, SearchInput, select/Select
  layout/          Page, PageHeader, PageSection, PageChrome (context)
  navigation/      Tabs, TabPanels, useTabParam, SegmentedControl, BackButton
  overlays/        dialog/Dialog, sheet/Sheet, menu/Menu, popover/Popover, tooltip/Tooltip, confirm/ConfirmDialog,
                   stack/ (registry, history, focus), surface/ (shared frames), positioning/
shared/gestures/   useDrag, useSwipeToDismiss, useLongPress, useSwipeTabs, rubberBand
shared/hooks/      useAppViewport, useMediaQuery, useIsPhone, useSheetPickers, mediaQueries, useBackLink…
shared/styles/     buttonStyles (links styled as buttons), iconAction, toneStyles
```

Removed (do not recreate): `Modal` → `Dialog`; `ActionsMenu` + `MenuAction` → `Menu`; `TapTooltip` → `Popover`;
`FloatingTooltip` and the CSS-only tooltip → `Tooltip`; `useAnchoredPlacement` → `Select`/`Popover`;
`useLockBodyScroll`, `useTransientOpen`, `Container`, `SectionHeading`, `ActionLink`, the mobile drawer.

## 2. Tokens and styles

Use named utilities, never raw values (`text-[13px]`, `#fff`, `z-50`).

- **Colors** (both themes, AA for text on `surface`, `canvas`, `surface-2`): surfaces `bg-shell | canvas |
  surface | surface-2 | surface-3`; text `text-ink | ink-muted | ink-subtle`; lines `border-line | line-strong`;
  `brand | brand-strong | brand-soft`; `contrast` / `contrast-ink` (inverted); status `success | warning |
  danger | info | accent` each with `-soft` (fills) and `-dot` (indicators); `bg-scrim` (modal backdrop);
  `bg-frosted` (translucent bar material with blur); `bg-brand-gradient`, `text-brand-gradient`.
- **Text styles** (size + line height + tracking + weight in one class):
  `text-large-title` 30 · `text-title` 22 · `text-headline` 17 · `text-body` 15 · `text-callout` 14 ·
  `text-footnote` 13 · `text-caption` 12 · `text-mono` 12.5 (pair with `font-mono`) · `text-input` 16 (every
  field). Minimum 12 px for meta text; 11 px only for uppercase micro labels; mono only for code, paths,
  branches and ids.
- **Spacing**: Tailwind's 4 px scale. Page gutters: `px-gutter` (16 / 24 / 32 px). `--bar-height` 56 px,
  `--tab-bar-height` 56 px.
- **Radii**: `rounded-chip` 7 · `rounded-control` 10 · `rounded-card` 16 · `rounded-panel` 20 · `rounded-sheet` 24.
- **Elevation**: `shadow-card` (resting), `shadow-raised` (lifted), `shadow-pop` (floating), `shadow-sheet`,
  `shadow-brand`.
- **Layers**: in the app `z-sticky` (10, sticky rows), `z-header` (30, sticky headers), `z-nav` (40, tab bar).
  Every overlay renders into `#overlays` (sibling of `#root`, `--z-overlay` 100) in opening order; inside it
  toasts (`--z-toast`) and tooltips (`--z-tooltip`) sit above. Never give feature content a z-index above
  `z-nav`, and never portal to `document.body` yourself: use the overlay primitives.
- **Variants**: `dark:`, `keyboard:` (on-screen keyboard up), `composing:` (a `data-compose` field focused
  with the keyboard up), `hover-device:` (fine pointer with hover: wrap every `hover:` that reveals or
  styles something, e.g. `hover-device:hover:bg-surface-2`), `touch:` (coarse pointer).
- **Viewport**: `h-app` / `max-h-app` (visible viewport height, follows the keyboard), `--app-offset`,
  `--safe-top|right|bottom|left`, `pb-safe`, `--tab-bar-space` (tab bar + home indicator while it shows, 0
  otherwise). Inner scrollers: `overflow-y-auto overscroll-contain` (or `data-scroller`).

## 3. Motion

- Durations `--duration-instant` 90 · `fast` 140 · `base` 220 · `slow` 320 · `sheet` 420 ms. Easings
  `ease-standard`, `ease-exit`, `ease-out-expo`, `ease-sheet` (iOS curve), `ease-spring` (slight overshoot,
  for indicators, toggles, presses).
- Animate only `transform`, `translate`, `scale` and `opacity`. Gestures move elements with the `translate`
  property so CSS keyframes on `transform` compose with them.
- Keyframe utilities: `animate-fade-in`, `animate-fade-up` (content arriving), `animate-menu-in`,
  `animate-sheet-in`, `animate-dialog-in`, `animate-slide-in-start|end`, `animate-pulse-soft`, `animate-shimmer`…
- Overlays animate in and out by themselves (`data-overlay` + `data-state`, kept mounted by `usePresence`).
- Route changes: a view transition cross-fades only the content panel (`view-transition-name: page`) when
  the pathname changes; Back and browsers without the API get a short fade. Query-only changes never animate.
- `prefers-reduced-motion` disables all of it globally (CSS) and the JS animations check
  `REDUCED_MOTION_QUERY`. Do not add per-component reduced-motion logic for CSS animations.

## 4. Overlays: which one

| Need | Use | Phone | Desktop |
| --- | --- | --- | --- |
| A task or decision that blocks (form, confirm with details) | `Dialog` | bottom sheet | centered card |
| "Are you sure?" | `ConfirmDialog` | bottom sheet | small card |
| Supplementary content, a list of choices, a tool panel | `Sheet` | bottom sheet (detents optional) | `desktop="dialog" \| "side" \| "sheet"` |
| A list of actions / context menu | `Menu` | action sheet (also on any touch screen) | anchored popover |
| Interactive content tied to a control (details, filters) | `Popover` | sheet | anchored panel |
| One value out of a list | `Select` | sheet with tall rows (+search) | listbox popover (+search) |
| A read-only hint | `Tooltip` | long press | hover (350 ms) and keyboard focus |
| Transient "it happened" | `toast()` | above the tab bar | bottom right |
| Persistent, actionable feedback | `Alert` (inline) | | |

All of them share the overlay stack (`overlays/stack/overlayStack.ts`):
- Only the topmost overlay reacts to Escape and outside presses.
- Each overlay pushes a history entry: Back (Android, browser, iOS edge swipe) closes the topmost overlay
  first. Closing it any other way pops its entry silently; the router never sees it.
- Navigating from inside an overlay (a `to` menu item, a `Link` in a sheet, `navigate()` after submit) is safe:
  the router guard releases overlay entries first and closes overlays that stay mounted. **`onClose` must
  only close** (no navigation, no side effects that must not run twice).
- Modal overlays make everything beneath them `inert`, trap Tab and return focus to the trigger.
- Overlays follow the visible viewport, so sheets sit above the keyboard.

### Dialog (`overlays/dialog/Dialog`)

```tsx
<Dialog open={open} onClose={close} title="Create project" description="…" size="md|sm|lg|xl"
  dismissible={!busy} headerActions={…} flush initialFocus={ref} role="dialog|alertdialog"
  footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="brand" loading={busy}>Create</Button></>}>
  …body…
</Dialog>
```

- Header (title, description, close) and footer are sticky; the body is the only scroller
  (`overscroll-behavior: contain`). On phones: grabber, drag the header down to dismiss (or pull the body down
  from its top), footer actions stacked full width with the **last one (primary) at the bottom**, home
  indicator cleared. Order footer children `Cancel, …, Primary`; `sm:mr-auto` on one pushes it left on desktop.
- `dismissible={false}` while work is in flight: Escape, Back, scrim, drag and the close button are ignored.
  Never pass a no-op `onClose` for that.
- Focus goes to the panel, not the first field (no keyboard popping up). Pass `initialFocus` only when typing
  is the point of the dialog. Render it always or conditionally; both are fine (exit animation only plays when
  it stays mounted with `open={false}`).
- `flush` removes body padding (edge-to-edge lists; add your own `px-5 sm:px-6`).

### Sheet (`overlays/sheet/Sheet`)

Same props as `Dialog` plus `detents?: ('medium' | 'large')[]` (phones; the first is where it opens; medium is
half the visible viewport; dragging up in the body expands first), `desktop?: 'dialog' | 'side' | 'sheet'`,
`hideTitle`. Use it for content that supplements the screen (More, details, pickers, a filter set).

### Menu (`overlays/menu/Menu`)

```tsx
<Menu label="Session actions" icon={MoreHorizontal} count={3} indicator placement="bottom-end" width="sm|md|lg"
  header={<AccountSummary … />} renderTrigger={(props) => <button {...props}>…</button>}
  open={…} onOpenChange={…}
  sections={[
    { id: 'main', title?: 'Preview', note?: <…/>, items: [
      { id: 'copy', label: 'Copy branch', icon: Copy, description?, onSelect },
      { id: 'open', label: 'Open session', to: sessionPath(p, s), linkState?, trailing: <SessionLiveStatus/> },
      { id: 'docs', label: 'Docs', href: 'https://…' },
      { id: 'wrap', label: 'Wrap lines', selection: 'checkbox', checked, keepOpen: true, onSelect },
      { id: 'phone-only', label: '…', hidden: !phone },
    ] },
    { id: 'danger', items: [{ id: 'delete', label: 'Delete', icon: Trash2, destructive: true, disabled, onSelect }] },
  ]} />
```

- Data-driven so the same items render as a popover (arrow keys, Home/End, flips, scrolls) or an action sheet
  (grouped inset lists, 52 px rows, red destructive rows, separate Cancel).
- Destructive items go last, in their own section. Sections replace submenus (no nested menus).
- Selecting closes the menu first, then runs `onSelect`: opening a `Dialog` from an item just works.
- Custom triggers must spread `props` (ref, onClick, aria-*) onto a real `<button>`.
- Context menus: open it controlled (`open`/`onOpenChange`) from `useLongPress` on the row.

### Popover (`overlays/popover/Popover`)

`label` (names it; sheet title on phones), `content` (node or `(close) => node`), `children` (content of the
default full-width text trigger) or `renderTrigger`, `placement` (`bottom-start` default), `className` (panel
width/padding on desktop), controlled `open`/`onOpenChange`. Non-modal on desktop: the page stays usable.

### Tooltip (`overlays/tooltip/Tooltip`)

`content`, `children`, `placement` `top|bottom`, `align` `start|center|end`, `mono` (default true: paths,
code), `focusable` (make the wrapper focusable when the child is not), `delay`, `className` (the wrapper is an
`inline-flex max-w-full`; pass `flex w-full` to keep block layout). Portaled, never clipped, never
interactive. **Never the only way to information** on phones: what matters must be visible, or one tap away
(`Popover`, a details sheet). `title=` does nothing on touch: do not rely on it.

### ConfirmDialog (`overlays/confirm/ConfirmDialog`)

`open, onClose, onConfirm, title, description, confirmLabel, cancelLabel?, tone 'default'|'danger', busy,
confirmDisabled, error, children` (e.g. an "I understand" `Checkbox`). Busy disables dismissal and shows the
spinner on the confirm button.

### Select (`forms/select/Select`)

```tsx
<Select label="Project" value={id} onChange={setId} placeholder="Select a project"
  options={projects.map((p) => ({ value: p.id, label: p.name, description: p.fullName, leading: <Initials …/>, keywords?, disabled? }))}
  searchable?  actions={[{ id: 'add', label: 'Add repository', icon: Plus, onSelect }]} emptyText renderValue disabled id className />
```

Search appears automatically past 8 options. Replace every native `<select>` and hand-made dropdown with it.

### Toasts (`feedback/toast/toast`)

`toast({ title, description?, tone?: 'neutral'|'success'|'warning'|'danger', action?: { label, onAction },
duration? })` from anywhere; returns an id. Swipe down or tap × to dismiss; paused while touched. Not for
errors the user must act on (use `Alert` or the field error).

## 5. Gestures (`shared/gestures`)

Every gesture needs a visible and keyboard equivalent (a button, a menu item, the tab strip).

- `useDrag({ axis?, threshold?, enabled?, filter?, onStart?, onMove, onEnd, onCancel? })` → `{ onPointerDown }`.
  State: `dx, dy, vx, vy (px/ms), axis, pointerType, target`. Axis locks after `threshold` (6 px); a gesture
  locking to the other axis is left to the browser. **Set `touch-action`** on the element to what the browser
  keeps (`touch-pan-y` for a horizontal swipe, `touch-none` for a handle). The click ending a drag is swallowed.
- `useSwipeToDismiss({ target, direction: 'down'|'up'|'left'|'right', onDismiss, distance?, velocity? })` →
  pointer props. Follows the finger, rubber-bands the other way, flick or 35% dismisses.
- `useLongPress(callback, { delay = 480, tolerance = 10 })` → spread all returned handlers. Right click and
  Shift+F10 / the context-menu key fire it too; the click after a long press is swallowed.
- `useSwipeTabs({ target, index, count, onChange })` → pointer props. Used by `TabPanels`; ignores screen
  edges (iOS back swipe), horizontal scrollers, inputs and `[data-swipe-ignore]`.
- `rubberBand(overshoot, dimension)`.
- Sheets get drag-to-dismiss and detents for free; do not add your own.

## 6. Navigation shell

- **Phones** (`< lg`): no global top bar. A frosted bottom tab bar (Projects, Sessions, To-dos, Deployments,
  More) with a springy active pill and attention badges; More opens a sheet with the account, Backups,
  Account, Admin (admins), recent projects, the theme and Log out. The tab bar hides while the keyboard is
  up and on immersive routes (`handle: { immersive: true }`: session, deployment, backup), which own their
  header and back button.
- **Desktop** (`lg+`): sidebar (collapsible to icons, remembered per device, tooltips when collapsed, account
  menu at its foot) and a top bar with breadcrumbs (section › where the screen was opened from
  (`backLinkState`) › the `PageHeader` title) plus the theme toggle.
- `main` is the only page scroller: `overflow-x` is clipped (the page never scrolls sideways), overscroll is
  contained, it is padded by `--tab-bar-space`, and its position is restored on Back/Forward per history entry.
  A screen that needs a full-height tool layout (session) uses `h-full` children with their own inner scrollers.
- Lazy routes: each page is its own chunk (`app/router.tsx`, `lazy`). New pages follow the same pattern.

## 7. Page recipe

```tsx
<Page width="default|narrow|wide|full">
  <PageHeader title="Projects" subtitle="12 repositories" back={useBackLink(fallback)} status={<Badge …/>}
    leading={<Initials …/>} largeTitle actions={<ResponsiveActions actions={[…]} />}>
    <Tabs … />            {/* or a SearchInput / filters: sticks under the bar on phones */}
  </PageHeader>
  <PageSection title="Recent" actions={…}>…</PageSection>
  <PageSection>…</PageSection>
</Page>
```

- Phone: sticky frosted bar (back, compact title fading in, actions) + large title that scrolls under it +
  sticky children row. Desktop: one header row (eyebrow, title, status, subtitle, actions).
- Put descriptions in empty states or info sheets, not above every list. The first useful item must be
  visible without scrolling at 360×780.
- Dense tool screens (session, consoles) pass `largeTitle={false}` or build their own header from
  `BackButton` + `ResponsiveActions` + `TruncatedText`.

### Header actions: `ResponsiveActions` (`actions/ResponsiveActions`)

```tsx
<ResponsiveActions label="More project actions" maxInline={2} actions={[
  { id: 'new', label: 'New session', icon: Plus, primary: true, variant: 'brand', onSelect },
  { id: 'edit', label: 'Edit', icon: Pencil, onSelect },
  { id: 'github', label: 'Open on GitHub', icon: GithubIcon, href },
  { id: 'delete', label: 'Delete repository', icon: Trash2, destructive: true, onSelect },
]} />
```

Phones: only `primary` actions stay buttons (one, two at most), the rest go to a ⋯ action sheet. Desktop: up to
`maxInline` non-destructive buttons, the rest (destructive always) in the menu. `ActionItem` = `MenuItem` +
`primary`, `variant`, `loading`.

## 8. Tabs and segmented controls

- `Tabs` (`items: TabItem[]` with `icon`, `count`, `dot`, `onClose`; `value`, `onChange`, `ariaLabel`,
  `idPrefix`): scrollable strip, sliding indicator, edge fades, arrow keys. Use for 4+ views or labels that
  vary; for 2–3 short options use `SegmentedControl` (`items: SegmentItem[]`, `value`, `onChange`,
  `ariaLabel | labelledBy`; a radiogroup). Do not render a strip with one tab.
- `TabPanels` (`ids`, `value`, `onChange`, `idPrefix` (same as the strip), `swipeable`, `children: (id) =>
  node`) renders only the active panel and slides it in; `swipeable` adds the horizontal swipe on touch.
- `useTabParam(ids, fallback, param = 'tab')` → `[value, setValue]`: keeps the tab in the URL with replace (no
  history entries, no scroll reset).

## 9. Lists, cards, data

- `ListGroup` (`title`, `footer`, `action`, `variant 'inset'|'plain'`) + `ListRow` (`title`, `subtitle`,
  `leading`, `trailing`, `chevron`, `to`/`linkState` or `onClick`, `disabled`, `destructive`,
  `swipeActions` (touch only; always also offer them in a menu)). Rows are ≥ 52 px; title and subtitle
  truncate, trailing never shrinks. On phones stack a row's facts (title line, meta line) instead of columns.
- `Card` (`as`, `className`; pad `p-4 sm:p-5`). Do not nest cards.
- `Badge` (`tone`, `icon`), `StatusDot` (`tone`, `pulse`, `label` when alone), `Stat` (`label`, `value`,
  `hint`, `icon`, `tone`; lay out in `grid grid-cols-2 sm:grid-cols-4 gap-3`), `Avatar`, `Initials`.
- **Truncation**: `TruncatedText` (`text`, `from 'end'|'start'` (start keeps a branch/path tail), `lines 2|3`,
  `mono`): the full value is reachable (tooltip on hover/focus/long press) only when clipped. Every flex child
  that holds text needs `min-w-0`; never let chips squeeze a title to a few letters (wrap the chips below).
- **Numbers**: `CompactNumber` (`1.2K`, exact value as label/tooltip) or `formatCount`; `tabular-nums` for
  figures that update live. Bytes `formatBytes`, durations `formatDuration`, times `formatRelativeTime`.

## 10. Forms

- `TextField` (`label`, `value`, `onChange(string)`, `type`, `inputMode`, `enterKeyHint`, `autoComplete`,
  `autoCapitalize`, `spellCheck`, `hint`, `error`, `required`, `leading`, `trailing`, `mono`, `labelAction`,
  `hideLabel`, `ref`…), `TextArea` (auto-grows to `maxRows`), `Switch` (applies at once), `Checkbox`
  (confirmed later; `indeterminate`), `Field` (frame for custom controls), `SearchInput` (clear button).
- Always set `type` / `inputMode` / `enterKeyHint` / `autoComplete` (e.g. repo name: `autoCapitalize="none"
  spellCheck={false} enterKeyHint="next"`; URLs `type="url"`; secrets `type="password" autoComplete="off"`).
  Text is 16 px (`text-input`), fields 48 px tall on phones.
- Errors: under the field (`error`), announced; form-level failures in an `Alert` above the footer.
  Phone hints never mention Shift/⌘ shortcuts.

## 11. Buttons and feedback

- `Button` (`variant primary|brand|tinted|secondary|ghost|danger`, `size sm|md|lg`, `icon`, `loading`,
  `fullWidth`, `type`, `form`, `ariaLabel`, `ref`). Pressed scale, 44 px hit area at every size. Use
  `loading` instead of swapping in a spinner and text by hand. Links that look like buttons:
  `buttonStyles(variant, size)`.
- `IconButton` (`icon`, `label` (required), `variant ghost|secondary|tinted`, `size sm|md`, `active`,
  `loading`, `indicator`, any button attribute).
- `Spinner` (`label`), `Skeleton` (`className` for shape, `lines`), `EmptyState` (`icon`, `title`,
  `description`, actions as children, `bare`), `ErrorState` (`description`, `onRetry`, `retrying`), `Alert`
  (`tone info|success|warning|danger`, `title`, `action`).

## 12. Keyboard-safe layouts

- The shell is sized to the visible viewport (`useAppViewport`), and focused fields are scrolled into view
  inside their scroller. Build screens so that this works: one scroller per region, header and the input's
  context (send button, validation, last messages) outside the scroller or sticky.
- Dialog/Sheet footers stay above the keyboard; keep forms in them short on phones.
- Use `keyboard:hidden` for chrome that must step aside while typing, `composing:` for the session composer.
- Never use `100vh`/`h-screen`; use `h-app`, `h-full` or flex.

## 13. Stores

- Select narrowly: `useStore((s) => s.byId[id]?.field)`; never return new objects/arrays from a selector
  (use `useShallow` from `zustand/react/shallow` when you must pick several fields). Read actions with
  `useStore.getState().action()` in handlers instead of subscribing.
- `sessionsStore` keeps references stable when an event changes nothing; derive lists with `useMemo` from
  the narrowest slice.
- `sidebarStore` (desktop collapse, persisted) and `pageTitleStore` (breadcrumb title, set by `PageHeader`) are
  shell-only.

## 14. Phone-first checklist (every screen, every PR)

1. Designed at 360×780 first, then 1440×900; light and dark.
2. No horizontal page scroll; every text container `min-w-0`; long values truncate with the full value
   reachable (`TruncatedText`, `Popover`), or wrap.
3. Touch targets ≥ 44×44 px (`Button`/`IconButton` already are); primary action in thumb reach (sheet
   footer, bottom of the screen, or the header's single primary).
4. Header: `PageHeader` with at most one or two inline actions on phones; the rest in `ResponsiveActions`;
   destructive actions last, in the menu.
5. No hover-only affordances: anything revealed on hover is visible or reachable by tap/long press on touch
   (`hover-device:` for hover styling only).
6. Overlays only through `Dialog`/`Sheet`/`Menu`/`Popover`/`Select`/`Tooltip`; no hand-made dropdowns,
   no `position: absolute` panels, no portals of your own, no native `<select>`.
7. Back closes the topmost overlay (automatic); `onClose` only closes.
8. Inner scrollers `overflow-y-auto overscroll-contain`; one scroll axis per region; nothing scrolls the page
   sideways.
9. Keyboard up: the focused field, its context and its submit stay visible; nothing behind the keyboard.
10. Inputs: `TextField`/`TextArea` with `type`, `inputMode`, `enterKeyHint`, `autoComplete`; 16 px text.
11. Loading (`Skeleton` in the shape of the content), empty (`EmptyState`) and error (`ErrorState`/`Alert`)
    states are designed; live updates never shift what the user is reading or touching.
12. Motion: transform/opacity only, from the tokens; overlays and route changes already animate.
13. Gestures where users expect them (swipe sheets, swipe tabs with `TabPanels swipeable`, long press rows for
    their `Menu`, swipe rows for quick actions), each with a visible equivalent.
14. Text styles from the scale (`text-body`, `text-footnote`…), ≥ 12 px meta, mono only for code-like values.
15. Accessible: semantic elements, labelled controls (`IconButton label`), visible focus, full keyboard use,
    AA contrast (use the tokens).
16. Store access selective; no selector returning fresh objects; split components by responsibility.
17. `cd spa-mooi && bun run build` green; no new dependencies; no tests.
