# About this file

`AGENTS.md` is the single source of the product vision and the rules every agent follows in this repository.
Read it fully before each request and apply it to **every** change: design, name and structure each change
for the whole platform described here, and never build something that blocks or contradicts it.

- **Vision, not inventory**: what follows describes what Mooi is *and is going to be*. Much of it is
  implemented, some of it is not yet, and existing code may differ. Never assume a capability exists because
  it is written here, and never drop one because it is missing from the code.
- **Priority**: **1.** the user's new request → **2.** this file → **3.** the current implementation. Where
  the implementation differs from this file, new work aligns with this file, never the other way round.
- **Sections**: *Context* (high-level vision), *Functional guidelines* (what every capability does),
  *Non-functional guidelines* (quality bar: experience, performance, security, scalability) and *Technical
  guidelines* (architecture, code, deployment channels, testing). *Current work* points to long-running work.

## Keeping this file current (mandatory)

User requests are what evolve Mooi, so every request also maintains this file, in the same change:

- **Add** what the request introduces: a new capability, behaviour, rule, constraint or technical decision.
- **Change** what the request redefines, wherever it is stated, so no section contradicts another.
- **Remove** what the request drops or replaces; never leave obsolete statements behind.
- **Keep** the file untouched when the request only implements, fixes or refines what is already stated.
- **Place** each fact in exactly one section (the one listed above that owns it) and refer to it from
  elsewhere instead of repeating it. Keep the existing structure; add a subsection only for a new area.
- **Write** precisely and concisely: lasting decisions in present tense, no change logs, no dates, no
  implementation trivia that the code already states. Implementation details belong here only when they
  shape future work (contracts, names, patterns, boundaries).
- Temporary pointers (*Current work*, *In-progress work* from a context handover) are removed as soon as
  their task is done.

# In-progress work

- docs/progress/2026-11-28-ui-refactor-phase3.md: finishing the SPA UI/UX refactor (phase 3 areas D, C, B, A, then E2E and close). Interrupted task, temporary: read that file first and continue from it without re-exploring; once the task is complete, delete the file and this line (and this section when it is empty) in the same change, before reporting the task done.

# Context

## What Mooi is

- A multi-user, multi-tenant, AI-native **development platform** that covers a project's whole life cycle
  with coding agents, entirely from the platform: from the first prompt on a GitHub repository to
  development sessions, live previews, merges, releases, production deployments and backups.
- **GitHub is the source of truth** for code: users link GitHub, list their repositories (public and
  private) and add them as projects. Every change reaches the repository as commits by the user's own account.
- **Agents do the work**: each session drives an agent provider (**Claude** and **Codex** today) through the
  user's own linked accounts. The agent can do practically anything the platform can do, and everything it
  does streams live and stays in sync with the rest of the UI.
- **Project types**: **web applications** have the fullest support (dev deployments, embedded previews,
  end-to-end testing in a browser); other project types are developed in the same sessions, without the
  web-only features.
- An optional **Software Factory** builds large projects autonomously, phase by phase and milestone by
  milestone, once the human approves their definition.
- Used almost entirely from phones as an installable PWA (Safari and Chrome), with excellent desktop
  support. Its design is modern and impressive, and the phone experience feels native and flawless.
- Enterprise-grade engineering: efficient, scalable, maintainable and secure, built on proven patterns.

## What Mooi is not

- Not a single-provider wrapper: providers are pluggable behind one compatible contract, without losing any
  provider's potential or efficiency for the sake of compatibility.
- Not tied to one hosting target: production and backups work on any platform the user describes (Docker
  host, VPS, AWS, GCP, several at once...), not only Docker.
- Not a public host for dev previews: previews are reachable only through Mooi.
- Not a secret store in Git: development, production and backup variables never reach the repository.
- Not nested virtualization: dev deployments run on the host Docker engine, isolated by network and naming.
- Not two parallel systems for UI and chat: both converge on one mechanism.

## Core principles

- **Convergence**: every capability is reachable from UI buttons *and* from the chat, and both run the same
  low-level operation. What one side does appears live on the other (a deployment started from the chat
  changes the Deploy button's state; variables, KPIs, files and status likewise).
- **Real time everywhere**: agent activity, file changes, context and limit KPIs, deployment progress and
  logs, production and backup status stream live to every connected device.
- **AI defines the deterministic path**: repetitive tasks that are not deterministic at first (dev
  deployment, production deployment, backups) are set up once by an agent from a description. The agent
  writes a deterministic script or setup and tests it for real until it works. Later runs execute it
  directly, without the LLM. When it is missing or breaks, or when the user changes it, the agent sets it
  up again and tests it until it works, and it becomes deterministic again.
- **Dev ↔ local ↔ production compatibility**: any deployment setup works in Mooi dev sessions, in local runs
  without Mooi (e.g. Claude Code directly) and in production. Setup prompts enforce it.
- **Isolation by default**: users, tenants, sessions, deployments and secrets never overlap or leak.

# Current work

- **Software Factory** end-to-end verification: when asked to continue it, read
  `docs/plans/software-factory/PHASE.md`, then follow its session protocol (first milestone not `done`:
  `10-e2e-verification`, which the user asked to test in the preview). Other requests ignore this pointer.
- **SPA UI/UX refactor**: when asked to continue it, read `docs/plans/ui-refactor/PLAN.md` and resume from
  its first unchecked phase. Other requests ignore this pointer.

# Functional guidelines

## Identity and accounts

- Sign in with Google. Signed-in devices stay signed in while used: a 30-day sliding refresh token in an
  `HttpOnly` cookie is renewed on every use, and 30 days without use requires signing in again.
- Users then link their **GitHub** account (to list repositories and commit) and one or more **provider
  accounts**, as many as they want, including several of the same provider.
- Provider accounts link through each provider's own sign-in. Claude links like the Claude Code app (OAuth2
  + PKCE, pasting back the code Anthropic shows), or with a `claude setup-token` token only when operators
  turn sign-in off and for existing links. Codex links by device code. Only the platform renews sign-in
  tokens, so concurrent sessions of one account never race, and live sessions pick up a renewed token on
  their next message. Renewal runs in the background as Claude Code does: an account stays signed in as
  long as the provider keeps the grant, an outage never signs it out, and an account the provider did sign
  out is flagged on the account page and signed in again in place.
- The **account area** holds the profile, linked GitHub, provider accounts and other personal settings, all
  stored securely.

## Projects

- Users add repositories as projects dynamically and choose the project type (web application or other).
- Projects reference repositories by GitHub's numeric id, so renames and transfers never break them. The
  Projects page's **Refresh** re-reads every project's metadata (name, owner, default branch...) from GitHub
  on demand, never by polling.
- A project holds many development sessions, its to-do list, its development variables, its production
  deployment and releases, its backups and, optionally, its factory.

## Development sessions

- **Independent**: each session has its own branch and its own copy of the repository (clone/worktree),
  so features progress in parallel without interfering.
- **Commits**: every clone (development, production, backup and factory sessions) commits as the user's
  linked GitHub account, name and noreply email, configured by the platform when it clones, for every
  provider and adapter. Every commit title Mooi or its agents write follows **Conventional Commits**; the
  platform rejects any other title it would publish.
- **Chat**: a highly dynamic chat with the experience of Claude Code / Codex (or better): streaming
  answers, thinking, tools, questions, permissions, images, interrupt and compaction, with model and
  thinking effort chosen per session.
- **The agent can do anything**: build, run and test the project, end to end in a browser (Playwright)
  for web applications, deploy, manage variables, to-dos and merges, open sessions... It uses the
  platform API, which runs the same operations as the buttons, and every effect shows live in the UI.
- **Adapters**: providers integrate through adapters behind one provider-agnostic API, and a provider may
  offer several (Claude: **Claude SDK**, the default, and **Claude CLI**, which drives the Claude Code CLI
  natively; Codex: its SDK). Each adapter supports every session feature (streaming, questions, interrupt,
  compaction, model/effort, context and limit KPIs) in its own way. A session picks an adapter with its
  model and effort and keeps it.
- **Tabs**: besides the chat, a session shows:
  - **Changes**: live view of what the agent changes on the session branch.
  - **Files**: always visible, a project view of the session's working tree (folders of folders,
    search, changed and unsaved markers) beside a plain-text editor. Saving writes into the session's
    own workspace, so edits show up live in Changes and travel with the merge. A save names the revision
    it read, so a concurrent agent edit is reported, never overwritten. Desktop shows tree and editor side
    by side, phones show one after the other.
  - **Preview** (web applications): the dev deployment, embedded (see *Dev deployments*).
  - **Trace**: every internal step of the agent, like Langfuse / LangSmith (see below).
  - **Workspace**: where the session lives on the file system, how much space it uses and similar
    insights.
- **KPIs** per session and per provider account: context size, session limits, weekly limits and other
  usage metrics.
- **Context handover**: a session can hand its work over once its context passes a percent, chosen when it
  starts (preselected from the Admin defaults, off unless set there) and changed live from the chat
  (composer or agent). The platform watches each adapter's context KPI without polling. Crossing the
  percent interrupts the turn with a priority brief: close the step in flight consistently and fast. When
  work remains, the agent writes a temporary `docs/progress/<date>-<task>.md` (request, done, in progress,
  pending, context) and points the root `AGENTS.md` at it, so a fresh conversation resumes without
  rediscovering anything and removes both once the task is done. Factory sessions keep their own
  checkpoints.
- **Resume after usage limits**: a turn stopped by spent provider limits (development sessions, production
  and backup chats) shows a notice with **Resume automatically** checked. The platform continues the
  conversation itself right after the renewal the provider announced (one timer per wait, no polling),
  live on every device. Unchecking it leaves the conversation to the user. Factory sessions pause and resume
  through the factory.
- **Sessions opened by agents**: asked in the chat, a session's agent opens a new, fully independent session
  of the project (own branch, clone and conversation; same account, adapter, model and effort), with the
  prompt it judges best as its first message. Both stay linked, live: the opening chat shows a card with the
  new session's state, lists nest each session under the one that opened it, and a session's header lists
  where it came from and what it opened. Software Factory sessions never open any.
- **Merge**: the Merge button, or the chat when asked to commit, push or merge, squashes the session's
  working tree onto the default branch as one conventional commit and pushes it with the user's GitHub
  grant (no credential in the clone, nothing asked again). Every view shows the session merged.
- **Agentic merge**: when the default branch changed in the same files, the session restarts like the
  **Resolve conflicts** button. Once the asking turn ends (interrupted after a short grace), a fresh
  conversation gets the agentic-merge brief and resolves the conflicts. It keeps both branches'
  features as consistently, coherently and maintainably as possible, then merges with the same title.
- **Trace**: every prompt, turn (one agent-loop iteration: an LLM call with tokens, cache and context size,
  then the tools it requested), nested sub-agent, skill, hook, injected context, compaction and error, as a
  live timeline with an inspector and usage insights. **Download log** saves the raw agent logs the trace
  was built from (Claude transcripts and sub-agent files, Codex rollouts), kept for cleared conversations
  too. Available in development sessions (including the first dev deployment setup), production and backup
  chats, for every adapter.

## Development environment variables

- Project-wide variables and secrets (API keys, tokens, service URLs...) shared by every session of the
  project and propagated live: a value set in one session is instantly available in all others, in the
  preview and, inherited, in production deployments and backups.
- Created, read, edited and removed from the UI or by the agent. Stored encrypted by the platform and
  never committed; deployments read them through interpolation.

## Dev deployments (web applications)

- **Deploy** runs a session's code in an isolated Docker environment on the host engine (no nested
  virtualization, no performance loss), on an isolated network. Many instances run at once (one per
  session/feature), and free ports and volumes are detected to avoid overlap.
- **Preview**: exposed only through Mooi's secure reverse proxy and embedded in a session tab, with mobile
  and desktop views on any device.
- **Setup by the agent**: the first Deploy, or a Deploy whose setup is missing or broken, sends the
  deployment setup brief to the chat. The agent prepares the root `compose.yml`, deploys and tests it until
  it works. Deploy runs directly only once that setup passed its test; a Compose file already in the
  repository is not enough. The setup works in Mooi dev sessions, local runs and production alike.
- Deploy, redeploy, stop and configure from buttons or chat (the chat knows the same brief). Build and run
  logs and progress stream live.

## Project to-do list

- Each project has a **To-dos** tab: a view over `docs/TODOS.md` on the default branch, which is the only
  copy. Mooi stores no list of its own.
- Items are open, in progress or done, with no text length limit, and are reordered by drag and drop
  (pointer, touch and keyboard).
- One order everywhere: new items go on top and done items sit at the bottom. Completing an item moves it to
  the top of the done items; reopening a done one moves it just below the items still to do.
- A **To-dos** entry in the main menu gathers every project's list on one page. Each project expands or
  collapses into the same editor as its tab, with its progress at a glance. Lists are read only as they
  come into view, so the page scales to any number of projects.
- A project dropdown with checkboxes filters that page and its totals; the selection is remembered per user
  on the current device. Status filters show their counts in compact pills (`1.2K`) that never overflow.
- Every edit commits the file transparently with the user's GitHub grant; a missing file is created by the
  first item. Each save names the file revision it read, so concurrent changes are replayed, never
  overwritten.
- Mooi edits only what it renders losslessly: an optional `# Title` and `- [ ]` (open), `- [/]` (in
  progress) and `- [x]` (done) items. Any other content is reported, never changed, until the user chooses
  to clean it up or keep managing it by hand.
- Managed from UI or chat (session agents use the same platform API); changes stream live to every view.

## Production deployments

- A project starts unconfigured. The first **Deploy** asks how to deploy, in free text: local, VPS, AWS,
  GCP, any platform, or several targets at once.
- This opens a production chat with a platform prompt. The agent never deploys with its own tools. It
  writes a deterministic deployment script, tests it with a real deployment and iterates until it works.
  From then on the Deploy button runs that script directly, without an agent, and the chat suggests
  clearing itself.
- **Releases**: semantic versions (major, minor, patch) created from the menu, including from the latest
  default branch; only releases are deployed. A chat test deploys a new release when it just committed
  repository changes; otherwise it deploys the deployed release or, before the first deployment, the latest
  release (`1.0.0` is created when none exists).
- **Platform files** (managed by Mooi, linked to the deployment, never committed because they reveal the
  real infrastructure): `deploy.sh`, `status.sh` (live status of every target) and `DEPLOYMENT.md`. The
  last one is the natural-language manifest agents read to change the deployment later. All three stay
  consistent with every change.
- **Repository files** (committed only when the target needs them, e.g. a production Compose file for a
  Docker target): they hold variable references, never values or infrastructure details.
- **Isolation**: production never collides with any other deployment of the repository or the target (dev
  stack, local tooling, other stacks). It has its own files under `deploy/production/` and
  production-specific runtime names (Compose project, volumes, networks, images, directories, cloud
  resources).
- **Production variables**: values stored only in the platform, set from their menu or by the chat, both
  views in sync.
- **Change the deployment**: an open production chat is reused to change or fix it, starting from
  `DEPLOYMENT.md`.

## Backups

- Same flow as production: describe the backup in free text; the agent writes and tests the backup
  *and restore* scripts with platform files and repository files under the same rules. The platform then
  reuses the scripts.
- Each backup carries a timestamp and the release it belongs to, and is linked mainly to that release's
  major version.
- Restore into production and into sandbox (disposable, isolated) environments.
- Buttons and chat converge; changes appear live in both.

## Software Factory

- An optional mode for large projects, living alongside normal sessions: **one factory per project**. The
  human and an agent define the project together; then the factory builds it on its own in a background
  loop that may last days or weeks.
- **Definition** (with the human, in the project's persistent **factory chat**): closed scope, base
  functional and technical decisions, and high-level phases ordered in the most efficient way. The loop
  starts only once the human approves them.
- **Phase 0, Foundations**: the project's technical base and its Mooi dev deployment (same brief and test as
  the Deploy button), so every milestone can be tested end to end. Production and backups stay outside the
  factory; they are set up from their own chats or from a normal session.
- **Autonomous loop**: the factory expands the next phase by itself (full functional and technical detail,
  split into self-contained milestones with end-to-end acceptance criteria), then, milestone by milestone:
  - **Build** in fresh sessions. Unit tests are written only if the project's architecture decides so, and
    belong to building.
  - **Test** end to end only, in fresh sessions distinct from the builders, against the milestone's dev
    preview. A failure records reproducible bugs; builder sessions fix them and testing runs again. After a
    bounded number of failed cycles the milestone needs attention and the loop waits for the human.
  - **Merge** into the default branch once the end-to-end test passes: the platform squashes the milestone
    branch itself, and only conflicts call an agent (agentic merge). One branch per milestone, pushed at
    every checkpoint, holds the milestone's progress until the merge.
- **Fresh sessions at 20%**: every factory session stops once it has used 20% of its context window. The
  platform measures it (each adapter's context KPI) and asks the agent to checkpoint: commit, push and
  rewrite the milestone's state for the next session. A hard limit and a platform-side safety commit cover a
  checkpoint that runs long. Each new session resumes from that state and Git without rediscovering
  anything.
- **Lives in the repository** under `docs/factory/`, in one homogeneous structure that works without Mooi and
  travels with merges:
  - Core files that always exist, with fixed sections: `FACTORY.md` (index of every file with when to read
    it, conventions, current status), `VISION.md`, `ARCHITECTURE.md`, `DECISIONS.md` (global decisions,
    each stating what it affects) and `ROADMAP.md`.
  - `phases/<nn>-<slug>/PHASE.md` (detail, milestones, phase decisions) and
    `phases/<nn>-<slug>/milestones/<nn>-<slug>.md` (spec, end-to-end criteria, state for the next session,
    log, test reports), created only when needed.
  - `context/`: extra files a project needs by its nature (domain, data model, design system,
    integrations...), created on demand and registered in `FACTORY.md` with their reading rule.
  - Plan changes are committed to the default branch; milestone work goes to the milestone branch. The
    platform keeps only operational state (current step, sessions, retries, change requests).
- **Deterministic orchestrator**: the platform, never an agent, drives the loop as a persisted state
  machine. Each step is a fresh Mooi session with a role prompt (architect, phase planner, builder, tester,
  impact analyst), visible live with its chat, changes and trace, and open to the human. A step ends with an
  explicit outcome that the platform accepts only when the documents and Git agree with it.
- **The human can step in at any time without breaking anything**:
  - Pause (gracefully at the next checkpoint, or immediately) and resume at will. Provider, account,
    adapter, model and effort are chosen at every start and resume, and apply to every session until the
    next pause.
  - Discussing in the factory chat changes nothing. A decided change becomes a **change request**, applied
    at the next safe point: an impact analysis updates the affected decisions and reopens earlier phases
    with delta milestones. Scope-level changes ask the human to confirm.
  - Consistency guarantees: a single writer of the plan, atomic idempotent steps, and on resume the
    platform reconciles its journal with Git, which wins.
- **Background**: runs on the server with nobody connected and survives restarts, under its own sign-in
  opened at each start or resume. Signing out everywhere, a kick or a ban revoke it like any device, and so
  does every pause except one for provider limits. It pauses when provider limits run out and continues
  with the same choice once they renew. Milestones needing attention, change requests awaiting
  confirmation and finished phases are flagged live on the Factory tab, the project card and the main menu.
- After the last phase the factory rests: small additions enter as change requests and wake it up; an
  accepted scope-level change reopens definition with the human.
- A **Factory** tab shows the roadmap (phases, milestones, statuses), the active session live, decisions,
  change requests and controls. All of it is also available from the chat through the platform API.

## Administration

- Roles. **Admin** gets a tabbed console with rich, live insights and controls:
  - **Users**: every registered user with their last connection, who is online right now (and on how many
    devices), their live sessions and what each agent is doing, projects, provider accounts and devices,
    all updated in real time. Admins close a user's sessions, sign them out everywhere, and ban (sign out,
    close sessions, block sign-in) or unban them. Live data costs nothing while no admin watches.
  - **Agents**: per-provider session defaults (adapter, model, thinking effort, context handover)
    preselected for every user; saved on change.
  - Other platform settings as they come.

## Other capabilities

- **Recipes**: reusable implementation recipes from GitHub marketplaces, applied from the session chat.
- **Dictation**: local push-to-talk speech-to-text in every agent chat composer, with a model running on
  Mooi's own servers (no third-party service). It supports Spanish and English today and will eventually
  support Spanish only. It must be highly efficient and feel instant (the model stays loaded between
  dictations).

# Non-functional guidelines

## Experience and design

Every screen is built for phones first and must feel like a polished native app, then scales up to desktop.

- **Impressive and modern**: one design system (shared tokens and `shared/components`), light and dark
  themes. Every state change has a meaningful transition that is light and fluid, never heavy, and honours
  `prefers-reduced-motion`. Loading, empty and error states are designed.
- **Mobile first**: design at 360 px, then enhance for tablet and desktop. Every feature is fully usable on
  both; nothing is desktop-only or hover-only.
- **Native PWA** in Safari and Chrome: the best native patterns everywhere (bottom sheets, modals, context
  menus, navigation). Back closes the topmost overlay before leaving the page; scroll position is kept on
  return; inner scrollers contain overscroll; live updates never shift what the user is reading or touching.
- **Space**: nothing is clipped, overlaps or overflows. No horizontal page scroll (only deliberate inner
  strips); flexible layouts (`min-w-0`, wrapping); long text truncates or wraps with the full value
  reachable; numbers compact (`1.2K`); safe areas respected (`--safe-*`). Primary content first on phones;
  secondary actions in menus or bottom sheets.
- **Touch**: targets at least 44×44 px, primary actions within thumb reach, clear pressed and disabled states.
- **Gestures**: use the native gesture wherever users expect it (swipe to dismiss sheets or switch views,
  drag to reorder, long press for contextual actions). Gestures lock their axis and never fight scrolling,
  and each has a visible and keyboard equivalent.
- **Virtual keyboard**: the shell follows the visual viewport (`useAppViewport`, `keyboard:` and `composing:`
  variants). When the keyboard opens, the header stays, and the focused field stays in view with its
  context (last messages, suggestions, send and validation feedback); nothing sits behind the keyboard.
  Inputs set `type`, `inputmode`, `enterkeyhint` and `autocomplete`, with text of at least 16 px (no iOS zoom).
- **Accessible**: semantic HTML, labelled controls, visible focus, full keyboard operation, WCAG AA contrast.

## Reactivity and performance

- Everything the agent does streams as it happens, and every view reflects platform state live, whether
  the change came from a button, the chat, another device or another session.
- Push instead of poll; live data costs nothing while nobody watches; load only what is visible (lazy
  routes, virtualised lists); optimise measured hot paths, not guesses.
- The chat and the agent feel as fast as the native Claude Code / Codex or faster.

## Security and isolation

- Users and tenants are fully isolated: every resource is owned and access-checked on the server.
- Secrets (variables, tokens, provider grants) are stored encrypted by the platform, never logged and never
  committed. Clones hold no credentials; publishing uses the user's GitHub grant on the platform side.
- Least privilege everywhere; input is validated at every boundary.
- Dev previews are reachable only through Mooi; sessions, deployments and production never share resources.

## Scalability and reliability

- Every request does bounded work: pagination, indexed queries, no N+1, no unbounded lists or loops.
- State that must survive restarts or be shared is persisted, not held in memory. Long-running work
  (factory, limit resumes, token renewal) survives restarts and recovers consistently.
- Errors are handled where they can be acted on and shown to the user in plain words, never swallowed.

# Technical guidelines

## Monorepo and services

One repository; every technical artefact lives in a root folder named with its kind prefix: `spa-` for
single page applications, `mic-` for microservices.

| Artefact | Stack | Responsibility |
| --- | --- | --- |
| `spa-mooi` | React, TypeScript, Vite, Tailwind, Zustand; served by nginx | The PWA. Its nginx also routes `/api/mooi`, `/api/sessions` and `/api/stt` to the services. |
| `mic-mooi` | Java, Spring Boot, JPA, Liquibase, PostgreSQL | Core: identity and auth, projects, GitHub, provider accounts and token renewal, encrypted variables, production, releases, backups, factory state, to-dos, recipes, admin. Owns the database. |
| `mic-sessions` | Python, FastAPI, Claude Agent SDK / Claude CLI, Codex SDK | Agents: workspaces and clones, agent runtimes and adapters, traces, dev deployments on the host Docker engine, previews, browser testing (Playwright MCP), factory orchestration, and the platform API that agents call. Talks to `mic-mooi` with a service token. |
| `mic-speech` | Python, FastAPI, WebSockets, local NeMo-Speech.cpp engine | Dictation: speech-to-text streamed over WebSockets, with the model resident in a supervised local engine. |

- Services talk only through public contracts (HTTP APIs, live streams, exported types), never through each
  other's internals. Live updates reach the SPA over WebSocket streams.
- A new artefact gets its own prefixed root folder, its own `Dockerfile` and a service in `compose.yml`
  (and production when needed).

## Agent architecture

- One provider-agnostic contract (`AgentRuntime`, its capabilities and a common event stream) with one
  **strategy** per adapter. Adding a provider or adapter never changes its callers, and switching
  implementation is a configuration choice.
- Every adapter supports every session feature (streaming, questions, permissions, interrupt,
  compaction, model/effort, context and limit KPIs, traces, handover, limit resumes), each in the most
  efficient way its provider allows. Compatibility never adds needless complexity and never costs a
  provider's efficiency or potential.
- Agents act on the platform only through the platform API, the same operations the UI calls.

## Code

Applies to every service and language. Existing code that breaks a rule is fixed when touched, never copied.

- **Single responsibility**: each module, class, component, hook and function has one reason to change; split
  it when it gains a second.
- **High cohesion**: organise by feature (`features/<name>/` in every service); code moves to `shared/` only
  when a second feature needs it.
- **Low coupling**: dependencies point inwards: UI → state → API client; transport → application logic →
  domain.
- **Open for extension**: providers, adapters, deployment targets and storage sit behind interfaces.
- **One operation per capability**: UI buttons, chat and platform API call the same backend operation;
  business rules and access checks live on the server, never only in the client.
- **Maintainable**: reuse before writing; match the surrounding idioms; small, typed, explicit APIs; names
  state intent; comments explain why, not what; no dead code, no speculative abstractions.

## Deployment channels

Three channels, each owned by one Mooi feature. Edit a channel's files only when the request comes from its
owner (its Mooi platform prompt); otherwise treat them as read-only.

| Channel | Files | Owner (only editor) | Used by |
| --- | --- | --- | --- |
| Production | `deploy/production/`, `tools/deploy-production.sh` | Mooi **production deployment** feature | Production only |
| Dev session | `compose.yml` | Mooi dev **Deploy** feature (deployment setup) | Mooi dev sessions; reused by local |
| Local | `Makefile` | Wraps the dev session channel; no logic of its own | Local runs outside Mooi |

- Never edit production or dev session files from local work, plain sessions or tools outside Mooi.
- Local deployment always goes through `make`, which only drives `compose.yml`; never run production files
  locally and never add a separate local stack.
- Files shared by channels (e.g. service `Dockerfile`s) must keep every channel working.
- Secrets live in the platform or git-ignored files (`.env`, `.env.local`), never in the repository.
- Respect isolation: keep the assigned Compose project, let Docker name resources and pick host ports, and
  manage only resources the current session owns. No automatic restarts or deploys after code changes.

## Testing

- Do not write programmatic tests: no unit, integration or end-to-end test files, test suites, test runners
  or test dependencies (pytest, vitest, `node:test`...) when adding or changing features. The repository
  keeps none.
- By default, verify without running the application: keep type checks, linters and builds passing, review
  the change for regressions and report what was checked. Type checks, linters and builds are not
  programmatic tests.
- Do not deploy the preview, start the stack, call the running services or drive the app in a browser
  (Playwright or otherwise) unless the user explicitly asks you to test the application: by default the user
  deploys and tests manually. When asked, test with those tools and report what was checked.
- Verify every UI change at 360 px and desktop, in light and dark: by review, or in the browser when testing
  is requested.
