# Context

Full product vision of Mooi: what it is and is going to be. Apply it to **every** request: design, name and
structure each change for the whole platform described here. Never build something that blocks or
contradicts a capability below.

The vision runs ahead of the code: many capabilities are not implemented yet, and existing ones may differ
from it. Where they differ, this context wins over the current implementation (see *Source of truth*).

## What Mooi is

- An AI-native **development platform**: take a GitHub project from first prompt to dev preview, production
  deployment and backups, driven by coding agents (Claude Code, Codex).
- For large projects, an optional **Software Factory**: once the human approves the definition, it builds the
  project autonomously, phase by phase and milestone by milestone.
- Mobile-first application for phones and desktops (responsive web, installable PWA shell). Enterprise-grade,
  startup-modern: awesome design and a native-feeling phone experience, excellent by default in every
  aspect (see *UI and UX*).
- Multi-user, multi-tenant: users and tenants are fully isolated; every resource is owned and access-checked.
- Engineering bar: efficient, scalable, maintainable, secure, built on proven design patterns (see *Code*).

## What Mooi is not

- Not a single-provider wrapper: providers are pluggable behind one compatible contract.
- Not tied to one hosting target: production and backups work on any platform the user describes.
- Not a public host for dev previews: previews are reachable only through Mooi.
- Not a secret store in Git: development, production and backup variables never reach the repository.
- Not nested virtualization: dev deployments run on the host Docker engine, isolated by network and naming.
- Not two parallel systems for UI and chat: both converge on one mechanism (see *Core principles*).

## Core principles

- **Convergence**: every capability is reachable from UI buttons *and* from the chat; both run the same
  low-level operation. Changes made from one side appear live on the other (deployment setup, variables,
  KPIs, files, status).
- **Real time everywhere**: agent activity, file changes, context/limits KPIs, deployment progress and logs,
  production and backup status stream live to every connected device.
- **Agent writes once, platform reuses**: an LLM turns a free-text description into a deterministic,
  tested script; later runs execute that script without the LLM.
- **Dev ↔ local ↔ production compatibility**: any deployment setup works in Mooi dev sessions, in local
  sessions without Mooi (e.g. Claude Code directly) and in production. Setup prompts enforce it.
- **Isolation by default**: sessions, deployments, tenants and secrets never overlap or leak.

## Identity and projects

- Sign in with Google. Link a GitHub account to list public and private repositories.
- Signed-in devices stay signed in while used: a 30-day sliding refresh token in an `HttpOnly` cookie is
  renewed on every use; 30 days without use requires signing in again.
- Add repositories to Mooi as projects; iterate on them from there.
- Projects reference repositories by GitHub's numeric id, so renames and transfers never break them: the
  Projects page's **Refresh** re-reads every project's metadata (name, owner, default branch...) from
  GitHub on demand, never by polling.

## Development sessions

- Many sessions per project, technically independent: each has its own branch and its own repository copy
  (worktree/clone), so features progress in parallel without interfering.
- Every clone (development, production, backup and factory sessions) commits as the user's linked GitHub
  account, name and noreply email, configured by the platform when it clones, for every provider and
  adapter. Every commit Mooi or its agents write follows **Conventional Commits**; the platform rejects any
  other title it would publish.
- **Merge from the chat**: asked to commit, push or merge, a session's agent runs the Merge button's own
  operation: it writes the conventional title from the changes, the platform squashes and pushes with the
  user's GitHub grant (no credential in the clone, nothing asked again) and every view shows the session
  merged. Conflicts restart the session like the **Resolve conflicts** button: once the asking turn ends
  (interrupted after a short grace), a fresh conversation gets the agentic-merge brief, resolves them and
  merges with the same title.
- Chat UX like Claude Code / Codex. Supported providers: **Claude** and **Codex**.
- Live view of what the agent does and of changed files on the session branch.
- Provider integration through **adapters** behind one provider-agnostic API: a provider may offer
  several (Claude: **Claude SDK**, the default, and **Claude CLI**, which drives the Claude Code CLI
  natively; Codex: its SDK). Each adapter supports every session feature (streaming, questions,
  interrupt, compaction, model/effort, context and limit KPIs) in its own way; a session picks one with
  its model and effort and keeps it.
- A **Files** tab, always visible in a development session: a project view of the session's working tree
  (folders of folders, search, changed and unsaved markers) beside a plain-text editor. Saving writes into
  the session's own workspace, so edits show up live in Changes and travel with the merge; a save names the
  revision it read, so a concurrent agent edit is reported, never overwritten. Desktop shows tree and editor
  side by side, phones show them one after the other.
- KPIs per session and provider account: context size, session limits, weekly limits, other usage metrics.
- Model and thinking-effort selection per session.
- **Context handover**: a development session can hand its work over once its context passes a percent,
  chosen when it starts (preselected from the Admin defaults, off unless set there) and changed live from
  the chat (composer or agent). The platform watches each adapter's context KPI with no polling; crossing
  it interrupts the turn with a priority brief: close the step in flight consistently and fast, and when
  work remains write a temporary `docs/progress/<date>-<task>.md` (request, done, in progress, pending,
  context) and point the root `AGENTS.md` at it, so a fresh conversation resumes without rediscovering
  anything and removes both once the task is done. Factory sessions keep their own checkpoints.
- **Resume after usage limits**: a turn stopped by spent provider limits (development sessions, production
  and backup chats) shows a notice with **Resume automatically** checked; the platform continues the
  conversation itself right after the renewal the provider announced (one timer per wait, no polling),
  live on every device. Unchecking it leaves the conversation to the user. Factory sessions pause and resume
  through the factory.
- A **Trace** tab, like Langfuse / LangSmith, shows every internal step of the agent: prompts, turns (one
  agent-loop iteration each: an LLM call with tokens, cache and context size, then the tools it requested),
  nested sub-agents, skills, hooks, injected context, compactions and errors, as a live timeline with an
  inspector and usage insights. **Download log** saves the raw agent session logs the trace was built from
  (Claude transcripts and sub-agent files, Codex rollouts), kept for cleared conversations too. Available in
  development sessions (including the first dev deployment setup), production and backup chats, for every adapter.
- Multiple provider accounts, including several of the same provider; sessions of one project may use the
  same or different accounts.
- Provider accounts link by each provider's own sign-in: Claude like the Claude Code app (OAuth2 + PKCE,
  the code Anthropic shows pasted back; a `claude setup-token` token only when operators turn sign-in
  off, and for existing links), Codex by device code. The platform alone
  renews sign-in tokens, so concurrent sessions of one account never race, and live sessions pick up a
  renewed token on their next message. It renews every sign-in in the background as Claude Code does, so
  an account stays signed in as long as the provider keeps the grant; an outage never signs it out, and
  an account the provider did sign out is flagged on the account page and signed in again in place.
- **Sessions opened by agents**: asked in the chat, a session's agent opens a new, fully independent session
  of the project (own branch, clone and conversation; same account, adapter, model and effort) with the
  prompt it judges best as its first message. Both stay linked, live: the opening chat shows a card with the
  new session's state, lists nest each session under the one that opened it, and a session's header lists
  where it came from and what it opened. Software Factory sessions never open any.
- **Agentic merge**: merging an outdated branch with conflicts makes the agent resolve them, preserving
  both sides' features.

## Project to-do list

- Each project has a **To-dos** tab: a view over `docs/TODOS.md` on the default branch, which is the only
  copy. Mooi stores no list of its own.
- Items are open, in progress or done, and are reordered by drag and drop (pointer, touch and keyboard).
  An item's text has no length limit.
- One order everywhere: new items go on top and done items sit at the bottom; completing an item moves it to
  the top of the done items, reopening a done one moves it just below the items still to do.
- A **To-dos** entry in the main menu gathers every project's list on one page: each project expands or
  collapses into the same editor as its tab, with its progress at a glance. Lists are read only as they
  come into view, so the page scales to any number of projects.
- A project dropdown with checkboxes filters the workspace To-dos page and its totals to the selected
  projects. The selection is remembered per user on the current device.
- Status filters show their counts in compact pills (`1.2K`) that never overflow, on phones and desktops.
- Adding, editing, changing the status of, reordering and removing items commits the file transparently
  with the user's GitHub grant; a missing file is created by the first item. Each save names the file
  revision it read, so concurrent changes are replayed, never overwritten.
- Mooi edits only what it renders losslessly: an optional `# Title` and `- [ ]` (open), `- [/]` (in
  progress) and `- [x]` (done) items. Any other content is reported, never changed, until the user chooses
  to clean it up or keep managing it by hand.
- Managed from UI or chat (session agents use the same platform API); changes stream live to every view.

## Development environment variables

- Project-wide, shared by all sessions of the project, propagated live (a variable set from one session is
  instantly available to all others).
- Managed from UI or chat. Sensitive: stored by the platform, never committed.

## Dev deployments (web applications)

- Deploy a session's code to an isolated Docker environment on the host engine (no nested virtualization,
  no performance loss), on an isolated network.
- Many instances at once (one per feature/session): free ports and volumes are detected to avoid overlap.
- Preview embedded in Mooi with mobile and desktop views. Web applications only; other project types can
  still be iterated without previews.
- Exposed only through Mooi's secure reverse proxy; no other access path.
- **First deploy**: a dedicated setup prompt goes to the chat to prepare the project. Resulting setup must be
  compatible with Mooi dev sessions, local runs without Mooi and production deployments. Deploy runs
  directly only once that setup passed its test; a Compose file already in the repository is not enough.
- Deploy, stop, configure through buttons or chat; the chat knows the deployment prompt, so setup from chat
  equals setup from the Deploy button. Build/run logs and progress stream live.

## Production deployments

- A project starts unconfigured. First **Deploy** asks how to deploy, in free text: local, VPS, AWS, GCP,
  any platform, or several targets at once (e.g. a VPS and GCP together).
- This opens a chat with a platform prompt: the agent never deploys with its own tools; it writes a
  deterministic deployment script, tests it with a real deployment and iterates until it works. From then on
  the Deploy button runs that script directly, without an agent; the chat suggests clearing itself.
- **Isolation**: production never collides with any other deployment of the repository or the target (dev
  stack, local tooling, other stacks): own files under `deploy/production/` and production-specific runtime
  names (Compose project, volumes, networks, images, directories, cloud resources).
- **Releases**: create releases from the menu, including from the latest default branch; only releases are
  deployed. A chat test deploys a new release when it just committed repository changes, otherwise the
  deployed release or, before the first deployment, the latest release (created when none exists).
- **Platform files** (managed by Mooi, never committed, since they reveal the real infrastructure):
  `deploy.sh`, `status.sh` (live status of every target) and `DEPLOYMENT.md`, the natural-language manifest
  agents read to change the deployment later; all kept consistent with every change.
- **Repository files** (committed only when the target needs them): e.g. a production Compose file reading
  env variables, holding variable references, never values.
- **Production variables**: values stored only in the platform; set manually in their menu or by the chat;
  both views stay in sync.
- An open production chat can be reused to change or fix the deployment.

## Backups

- Same flow as production: describe the backup in free text, the agent writes and tests a script, the
  platform reuses it.
- Each backup carries a timestamp and the release it belongs to.
- Restore into production and into sandbox (disposable, isolated) environments.
- Buttons and chat converge; changes appear live in both.

## Software Factory

- An optional mode for large projects, living alongside normal sessions: **one factory per project**. The
  human and an agent define the project together; then the factory builds it on its own in a background
  loop that may last days or weeks.
- **Definition** (with the human, in the project's persistent **factory chat**): closed scope, base functional
  and technical decisions, and high-level phases ordered in the most efficient way. The loop starts only once
  the human approves them.
- **Phase 0, Foundations**: the project's technical base and its Mooi dev deployment (same brief and test as
  the Deploy button), so that every milestone can be tested end to end. Production and backups stay outside
  the factory: they are set up from their own chats or from a normal session.
- **Autonomous loop**: the factory expands the next phase by itself (full functional and technical detail,
  split into self-contained milestones with end-to-end acceptance criteria), then, milestone by milestone:
  - **Build** in fresh sessions. Unit tests are written only if the project's architecture decides so, and
    belong to building.
  - **Test** end to end only, in fresh sessions distinct from the builders, against the milestone's dev
    preview. A failure records reproducible bugs; builder sessions fix them and testing runs again. After a
    bounded number of failed cycles the milestone needs attention and the loop waits for the human.
  - **Merge** into the default branch once the end-to-end test passes: the platform squashes the milestone
    branch itself, and only conflicts call an agent (agentic merge). One branch per milestone, pushed at every
    checkpoint; it holds the milestone's progress until the merge.
- **Fresh sessions at 20%**: every factory session stops once it has used 20% of its context window. The
  platform measures it (each adapter's context KPI) and asks the agent to checkpoint: commit, push and rewrite
  the milestone's state for the next session. A hard limit and a platform-side safety commit cover a checkpoint
  that runs long. Each new session resumes from that state and Git without rediscovering anything.
- **Lives in the repository** under `docs/factory/`, in one homogeneous structure that works without Mooi and
  travels with merges:
  - Core files that always exist, with fixed sections: `FACTORY.md` (index of every file with when to read
    it, conventions, current status), `VISION.md`, `ARCHITECTURE.md`, `DECISIONS.md` (global decisions, each
    stating what it affects) and `ROADMAP.md`.
  - `phases/<nn>-<slug>/PHASE.md` (detail, milestones, phase decisions) and
    `phases/<nn>-<slug>/milestones/<nn>-<slug>.md` (spec, end-to-end criteria, state for the next session,
    log, test reports), created only when needed.
  - `context/`: extra files a project needs by its nature (domain, data model, design system,
    integrations...), created on demand and registered in `FACTORY.md` with their reading rule.
  - Plan changes are committed to the default branch; milestone work goes to the milestone branch. The
    platform keeps only operational state (current step, sessions, retries, change requests).
- **Deterministic orchestrator**: the platform, never an agent, drives the loop as a persisted state machine.
  Each step is a fresh Mooi session with a role prompt (architect, phase planner, builder, tester, impact
  analyst), visible live with its chat, changes and trace, and open to the human. A step ends with an explicit
  outcome the platform accepts only when the documents and Git agree with it.
- **The human can step in at any time without breaking anything**:
  - Pause (gracefully at the next checkpoint, or immediately) and resume at will. Provider, account, adapter,
    model and effort are chosen at every start and resume, and apply to every session until the next pause.
  - Discussing in the factory chat changes nothing. A decided change becomes a **change request**, applied at
    the next safe point: an impact analysis updates the affected decisions and reopens earlier phases with
    delta milestones. Scope-level changes ask the human to confirm.
  - Consistency guarantees: a single writer of the plan, atomic idempotent steps, and on resume the platform
    reconciles its journal with Git, which wins.
- **Background**: runs on the server with nobody connected and survives restarts, under its own sign-in
  opened at each start or resume. Signing out everywhere, a kick or a ban revoke it like any device, and so
  does every pause except one for provider limits. It pauses when provider limits run out and continues
  with the same choice once they renew. It flags milestones needing attention, change requests awaiting
  confirmation and finished phases on the Factory tab, the project card and the main menu, live.
- After the last phase the factory rests: small additions enter as change requests and wake it up; an
  accepted scope-level change reopens definition with the human.
- A **Factory** tab shows the roadmap (phases, milestones, statuses), the active session live, decisions,
  change requests and controls. All of it is also available from the chat through the platform API.

## Accounts and administration

- Account area: profile, linked GitHub, provider accounts and other personal settings; secure storage.
- Roles. **Admin** gets a tabbed console with rich, live insights and controls:
  - **Users**: every registered user with their last connection, who is online right now (and on how many
    devices), their live sessions and what each agent is doing, projects, provider accounts and devices,
    all updated in real time. Admins close a user's sessions, sign them out everywhere, and ban (sign out,
    close sessions, block sign-in) or unban them. Live data costs nothing while no admin watches.
  - **Agents**: minimal per-provider session defaults (adapter, model, thinking effort, context handover)
    preselected for every user; saved on change.
  - Other platform settings as they come.

## Other capabilities

- **Recipes**: reusable implementation recipes from GitHub marketplaces, applied from the session chat.
- **Dictation**: local push-to-talk speech-to-text in every agent chat composer.

# Current work

- **Software Factory** end-to-end verification: when asked to continue it, read
  `docs/plans/software-factory/PHASE.md`, then follow its session protocol (first milestone not `done`:
  `10-e2e-verification`, which the user asked to test in the preview). Other requests ignore this pointer.

# Guidelines

## Source of truth

- Priority: **1.** the user's new request → **2.** *Context* → **3.** current implementation.
- When a request conflicts with *Context*, follow the request and update *Context* in the same change, so it
  always states the latest vision.
- When the implementation conflicts with *Context*, align new work with *Context*, never the other way round.

## Code

Applies to every service and language. Existing code that breaks a rule is fixed when touched, never copied.

- **Single responsibility**: each module, class, component, hook and function has one reason to change; split
  it when it gains a second.
- **High cohesion**: organise by feature (`features/<name>/` in every service); code moves to `shared/` only
  when a second feature needs it.
- **Low coupling**: features and services talk through public contracts (HTTP APIs, events, exported types),
  never through each other's internals. Dependencies point inwards: UI → state → API client; transport →
  application logic → domain.
- **Open for extension**: providers, adapters, deployment targets and storage sit behind interfaces; adding one
  never changes its callers.
- **One operation per capability**: UI buttons, chat and platform API call the same backend operation;
  business rules and access checks live on the server, never only in the client.
- **Scalable**: every request does bounded work (pagination, indexed queries, no N+1, no unbounded lists or
  loops); state that must survive restarts or be shared is persisted, not held in memory.
- **Efficient**: push instead of poll (live streams); load only what is visible (lazy routes, virtualised
  lists); live data costs nothing while nobody watches; optimise measured hot paths, not guesses.
- **Maintainable**: reuse before writing; match the surrounding idioms; small, typed, explicit APIs; names
  state intent; comments explain why, not what; no dead code, no speculative abstractions.
- **Secure and robust**: validate input at every boundary; least privilege; secrets never logged; errors are
  handled where they can be acted on and shown to the user in plain words, never swallowed.

## UI and UX

Every screen is built for phones first and must feel like a polished native app, then scales up to desktop.

- **Mobile first**: design at 360 px, then enhance for tablet and desktop. Every feature is fully usable on
  both; nothing is desktop-only or hover-only.
- **Modern and consistent**: one design system (shared tokens and `shared/components`), light and dark themes,
  subtle motion that honours `prefers-reduced-motion`; loading, empty and error states are designed.
- **Space**: nothing is clipped or overflows. No horizontal page scroll (only deliberate inner strips);
  flexible layouts (`min-w-0`, wrapping); long text truncates or wraps with the full value reachable; numbers
  compact (`1.2K`); safe areas respected (`--safe-*`). Primary content first on phones; secondary actions in
  menus or bottom sheets.
- **Touch**: targets at least 44×44 px, primary actions within thumb reach, clear pressed and disabled states.
- **Gestures**: use the native gesture wherever users expect it (swipe to dismiss sheets or switch views,
  drag to reorder, long press for contextual actions). Gestures lock their axis and never fight scrolling,
  and each has a visible and keyboard equivalent.
- **Virtual keyboard**: the shell follows the visual viewport (`useAppViewport`, `keyboard:` and `composing:`
  variants). When the keyboard opens, the header stays, the focused field stays in view and so does its
  context (last messages, suggestions, send and validation feedback); nothing sits behind the keyboard.
  Inputs set `type`, `inputmode`, `enterkeyhint` and `autocomplete`, with text of at least 16 px (no iOS zoom).
- **Native patterns**: Back closes the topmost overlay before leaving the page; scroll position is kept on
  return; inner scrollers contain overscroll; live updates never shift what the user is reading or touching.
- **Accessible**: semantic HTML, labelled controls, visible focus, full keyboard operation, WCAG AA contrast.
- **Verify** every UI change at 360 px and desktop, in light and dark (by review, or in the browser when
  testing is requested; see *Testing*).

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
