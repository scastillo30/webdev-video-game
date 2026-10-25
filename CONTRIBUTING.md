# Contributing

## Before changing code

1. Read [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
2. Check `git status`; preserve unrelated and user-owned changes.
3. Create a focused branch, normally using the `codex/` prefix.
4. Identify whether the change affects Office View, Game View, shared Jira state, persistence, or character-owned assets.
5. Update current documentation with behavior changes.

## Change boundaries

- Office View and Game View are separate presentation layers over one normalized Jira stream.
- Browser code never stores or sends Jira credentials directly to Jira Cloud.
- Event author and assignee are different fields.
- SQLite migrations are forward-only; add a numbered migration rather than editing an applied one.
- Configuration saves are validated and atomic.
- Game View canvas work stays outside Angular change detection where possible.
- Long-lived timers, streams, and Phaser resources must be stopped on route unmount/hidden state as designed.

## Character changes

Character ownership rules are mandatory, not suggestions:

1. Read [AGENTS.md](AGENTS.md), [PROJECT_WORKFLOW.md](PROJECT_WORKFLOW.md), and `characters/<id>/manifest.json` completely.
2. Commander and Rogue are distinct. Do not infer identity from similar art.
3. Add a new `vNNN` directory; never overwrite an approved version unless explicitly requested.
4. Preserve original illustrations, Blender sources, prior exports, manifests, and rollback versions.
5. A character-production change edits only that character's assets/manifest/scripts unless integration is explicitly in scope.
6. Office runtime mapping belongs to `characters/registry.js`; Game board mapping belongs to `board-character-assets.ts` and per-character engine metadata.
7. Never use another character's poster, portrait, or fallback.
8. Verify the target plus Commander and Rogue, including pause/resume, reduced motion, and switching.

See [BOARD_CHARACTER_WORKFLOW.md](BOARD_CHARACTER_WORKFLOW.md) for the board pipeline.

## Database and API changes

- Add migrations in both the embedded migration directory and the maintained mirror if the repository continues to keep both.
- Use parameterized SQL and transactions for multi-table configuration writes.
- Keep API and TypeScript models synchronized.
- Return truthful connection/freshness state and bounded error output.
- Never log tokens or store request bodies in operational audit history.
- Add Go tests for validation, migration, store, handler, and Jira changes as applicable.

## Frontend and Game View changes

- Keep semantic, keyboard-accessible controls in Angular rather than canvas-only UI.
- Respect reduced motion and user-controlled sound/fullscreen requirements.
- Do not create a second Jira store, poller, or SSE connection per view.
- Keep the board collision model synchronized with environment artwork.
- Use stable character IDs across profiles, sprites, Jira mappings, and activity focus.
- Bound particles, timeouts, and autonomous behaviors for continuous display.
- Add or update engine tests for deterministic pathfinding, selection, state, and rotation logic.

## Documentation rules

- Current guides are indexed in [docs/README.md](docs/README.md).
- Phase reports are historical evidence; do not retrofit them into current runbooks.
- Label proposals and historical specifications clearly.
- Use repository-relative links and verify every new link/path.
- Document new environment variables, routes, scripts, migrations, and operational steps in the same change.

## Validation and review

Run targeted checks while developing and the aggregate gate before a broad handoff:

```sh
npm run quality:check
```

Use [TESTING.md](TESTING.md) for manual acceptance. Visual changes require real runtime inspection at the intended board scale; source images alone are not sufficient.

## Commit hygiene

- Keep generated databases, dependencies, secrets, logs, release folders, and temporary captures out of commits unless a tracked artifact is explicitly required.
- Review `git diff --check`, `git diff --stat`, and the complete diff.
- Use a concise outcome-based commit message.
- Push only when requested and report the branch, commit, and remote result.
