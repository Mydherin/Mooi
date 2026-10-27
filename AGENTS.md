# Context

Full product vision of Mooi: what it is and is going to be. Apply it to **every** request: design, name and
structure each change for the whole platform described here. Never build something that blocks or
contradicts a capability below.

The vision runs ahead of the code: many capabilities are not implemented yet, and existing ones may differ
from it. Where they differ, this context wins over the current implementation (see *Source of truth*).

## What Mooi is

- An AI-native **development platform**: take a GitHub project from first prompt to dev preview, production
  deployment and backups, driven by coding agents (Claude Code, Codex).
- Desktop and mobile application (responsive web, mobile shell). Enterprise-grade, startup-modern: awesome
  design, excellent by default in every aspect.
- Multi-user, multi-tenant: users and tenants are fully isolated; every resource is owned and access-checked.
- Engineering bar: efficient, scalable, maintainable, secure, built on proven design patterns.

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
- Add repositories to Mooi as projects; iterate on them from there.

## Development sessions

- Many sessions per project, technically independent: each has its own branch and its own repository copy
  (worktree/clone), so features progress in parallel without interfering.
- Chat UX like Claude Code / Codex. Supported providers: **Claude** and **Codex**.
- Live view of what the agent does and of changed files on the session branch.
- Provider integration: official SDKs today, possibly CLIs later. Keep one provider-agnostic API so the
  integration technology can change without touching the rest.
- KPIs per session and provider account: context size, session limits, weekly limits, other usage metrics.
- Model and thinking-effort selection per session.
- Multiple provider accounts, including several of the same provider; sessions of one project may use the
  same or different accounts.
- **Agentic merge**: merging an outdated branch with conflicts makes the agent resolve them, preserving
  both sides' features.

## Project to-do list

- Each project has a **To-dos** tab: a view over `docs/TODOS.md` on the default branch, which is the only
  copy. Mooi stores no list of its own.
- Items are open, in progress or done, and are reordered by drag and drop (pointer, touch and keyboard).
  An item's text has no length limit.
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

- A project starts unconfigured. First **Deploy** asks how to deploy, in free text: local, VPS, AWS, any
  platform.
- This opens a chat with a platform prompt: the agent writes a deterministic deployment script, tests it with
  a real deployment and iterates until it works. Later deployments reuse the script directly.
- **Releases**: create releases from the menu, including from the latest default branch; only releases are
  deployed.
- **Platform files** (managed by Mooi, never committed): deployment script, status script (live service
  status) and `DEPLOYMENT.md` describing the deployment, editable later the same way.
- **Repository files** (committed when needed): e.g. a production Compose file reading env variables.
- **Production variables**: set manually in their menu or by the chat; both views stay in sync.
- An open production chat can be reused to change or fix the deployment.

## Backups

- Same flow as production: describe the backup in free text, the agent writes and tests a script, the
  platform reuses it.
- Each backup carries a timestamp and the release it belongs to.
- Restore into production and into sandbox (disposable, isolated) environments.
- Buttons and chat converge; changes appear live in both.

## Accounts and administration

- Account area: profile, linked GitHub, provider accounts and other personal settings; secure storage.
- Roles. **Admin** gets dynamic sections with rich insights: active users, sessions per user, detailed user
  information, default models per provider (Claude, Codex) and other platform settings.

## Other capabilities

- **Recipes**: reusable implementation recipes from GitHub marketplaces, applied from the session chat.
- **Dictation**: local push-to-talk speech-to-text in every agent chat composer.

# Guidelines

## Source of truth

- Priority: **1.** the user's new request → **2.** *Context* → **3.** current implementation.
- When a request conflicts with *Context*, follow the request and update *Context* in the same change, so it
  always states the latest vision.
- When the implementation conflicts with *Context*, align new work with *Context*, never the other way round.

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
