---
id: 09-closure
status: planned
depends: [01-persistence-identity, 02-docs-contract, 03-orchestrator-core, 04-context-checkpoints, 05-definition-chat, 06-build-test-merge, 07-control-change-requests, 08-factory-tab]
context: []
---

# Milestone 09: Closure

## Spec

Bring documentation and vision in line with what was built. Leave follow-ups recorded.

## Tasks

- [ ] Review the whole diff of the phase for regressions in normal sessions, production and backup chats
  (session kinds, `_agent_access`, boot reconcile)
- [ ] Final checks: `mic-mooi` build, `mic-sessions` ruff and import check, `spa-mooi` build
- [ ] `README.md`: add a *Software Factory* row to the features table and a short paragraph in *How it
  works*
- [ ] `AGENTS.md` › *Software Factory*: adjust it wherever the implementation made a decision the vision
  should state
- [ ] To-dos through the Mooi platform API (never by editing `docs/TODOS.md`): push notifications for
  factory attention, parallel milestones by `depends`, cleanup of merged milestone branches
- [ ] Remove the *Current work* pointer from `AGENTS.md`
- [ ] Mark this phase `status: done`

## Acceptance

- Every check passes, and the user has run the acceptance scenarios of milestones 03–08 manually.

## State

Not started.

## Log
