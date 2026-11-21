---
id: 09-closure
status: done
depends: [01-persistence-identity, 02-docs-contract, 03-orchestrator-core, 04-context-checkpoints, 05-definition-chat, 06-build-test-merge, 07-control-change-requests, 08-factory-tab]
context: []
---

# Milestone 09: Closure

## Spec

Bring documentation and vision in line with what was built. Leave follow-ups recorded.

## Tasks

- [x] Review the whole diff of the phase for regressions in normal sessions, production and backup chats
  (session kinds, `_agent_access`, boot reconcile)
- [x] Final checks: `mic-mooi` build, `mic-sessions` ruff and import check, `spa-mooi` build
- [x] `README.md`: add a *Software Factory* row to the features table and a short paragraph in *How it
  works*
- [x] `AGENTS.md` › *Software Factory*: adjust it wherever the implementation made a decision the vision
  should state
- [x] To-dos through the Mooi platform API (never by editing `docs/TODOS.md`): push notifications for
  factory attention, parallel milestones by `depends`, cleanup of merged milestone branches
- [x] Remove the *Current work* pointer from `AGENTS.md`
- [x] Mark this phase `status: done`

## Acceptance

- Every check passes, and the user has run the acceptance scenarios of milestones 03–08 manually.

## State

Done (session 3). Every check passes:

- `mic-mooi`: `./mvnw -o -DskipTests compile`.
- `mic-sessions`: ruff, with only the 25 findings that were already there, and the import check.
- `spa-mooi`: `bun run build`.

The acceptance scenarios of milestones 03–08 run in milestone `10-e2e-verification`, in a fresh session, as
the user asked.

- An independent review of the diff on shared code found no regression for users without a factory. It
  pointed at two side effects, both fixed:
  - Removing or deleting a project now revokes its factory's sign-in first
    (`FactoryService.forgetProject`, called by `ProjectService.delete`/`remove`). The database cascade alone
    left the sign-in open until the idle purge.
  - The admin console's *last seen* ignores the sign-ins factories renew.
- Vision gap closed in code: a scope-level change accepted after the last phase now reopens the definition
  (`decide_change`). The factory goes back to `defining`, and `architect_brief(existing=, change=)` updates the
  documents instead of starting over. Before a phase is done, an accepted one is still applied by the analyst.
- Known behaviour, kept on purpose: the factory's sign-in is listed among the player's sign-ins in the admin
  console, labelled *Mooi Software Factory*. Factory sessions are ordinary sessions in session lists, with a
  role badge.

## Log

- Session 3: regression review, project-deletion and last-seen fixes, redefinition after the last phase,
  README, vision, follow-up to-dos, closure.
