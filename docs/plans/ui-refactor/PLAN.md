# SPA UI/UX refactor (`spa-mooi`)

Temporary plan: deleted, with its `AGENTS.md` pointer, once the refactor is done.

## Request

Refactor the whole `spa-mooi` UI (not a new SPA) so it is phone-first, native-feeling as an installable PWA in
Safari and Chrome, modern and impressive, with an equally polished desktop, **without losing one piece of
functionality**. The current UI was built desktop-first by a weaker model: overloaded screens, overlays that
hide what is needed, overflowing dropdowns, wrong scroll axes, clipped text, almost no gestures or native
patterns, the keyboard hiding what must stay visible. The code has unnecessary coupling, re-renders and SRP
violations. Keep React + TypeScript + Vite + Tailwind + Zustand. Finish with an end-to-end test pass with
screenshots (mainly 360 px), light and dark, and fix what it finds.

Every rule in the root `AGENTS.md` (*Experience and design*, *Reactivity and performance*, *Code*) applies.

## Phases

1. **Audit** (read-only): screenshots of the current preview, findings in `AUDIT.md`.
2. **Foundation**: tokens, motion, gestures, overlay system, navigation shell, shared components. Its public
   API is documented in `FOUNDATION.md`; every later phase builds on it.
3. **Features** (parallel, disjoint ownership, see below): every screen moved onto the foundation, redesigned
   for phones first, split by responsibility, store access made selective.
4. **E2E verification**: deployed preview, Playwright at 360×780 and 1440×900, light and dark, every screen and
   overlay, keyboard open, long texts; fix and repeat until clean. Report in `E2E.md`.
5. **Close**: typecheck + build green, `AGENTS.md` updated, these plan files removed.

## Ownership in phase 3 (each owner edits only its paths)

| Area | Paths |
| --- | --- |
| A. Session chat | `features/sessions/components/chat/**`, `features/sessions/hooks/**`, `features/sessions/lib/**`, `features/dictation/**` |
| B. Session workspace | `pages/SessionPage.tsx`, `pages/SessionsPage.tsx`, the rest of `features/sessions/components/**`, `features/traces/**`, `features/platform/**` |
| C. Projects, to-dos, factory | `pages/ProjectsPage.tsx`, `pages/ProjectPage.tsx`, `pages/TodosPage.tsx`, `features/projects/**`, `features/todos/**`, `features/factory/**`, `features/recipes/**` |
| D. Production, backups, variables | `pages/DeploymentsPage.tsx`, `pages/ProjectDeploymentPage.tsx`, `pages/BackupsPage.tsx`, `pages/ProjectBackupPage.tsx`, `features/production/**`, `features/backups/**`, `features/development/**` |
| E. Account, admin, auth, brand | `pages/AccountPage.tsx`, `pages/AdminPage.tsx`, `pages/LoginPage.tsx`, `pages/GithubCallbackPage.tsx`, `pages/NotFoundPage.tsx`, `features/account/**`, `features/agents/**`, `features/github/**`, `features/admin/**`, `features/auth/**`, `features/brand/**` |

`shared/**`, `layouts/**`, `styles/**`, `app/**`, `stores/**` belong to the foundation. In phase 3 an owner may
add a new shared file when a second area clearly needs it, but never changes an existing shared API; needed
changes are listed in its report and applied centrally.

## Status

- [x] 1. Audit (`AUDIT.md`; screenshots in `/tmp/ui-audit/`; sign in through
  `https://mooi.skypea.dev/preview/<id>/`, the 127.0.0.1 origin rejects the mock sign-in)
- [x] 2. Foundation (API in `FOUNDATION.md`)
- [ ] 3. Features A B C D E
- [ ] 4. E2E verification
- [ ] 5. Close
