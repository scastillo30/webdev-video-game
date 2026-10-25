# Testing and verification

## Complete source gate

Run this before a release or broad handoff:

```sh
npm run quality:check
```

The gate is the canonical aggregate check. It validates character assets, Go tests, Game engine tests, Angular production build, and release tooling/tests as defined in `scripts/quality-gate.mjs`.

## Targeted commands

| Command | When to run |
| --- | --- |
| `npm run verify:characters` | Any character asset, manifest, registry, or board mapping change |
| `npm run test:backend` | Go, API, Jira, migration, config, backup, or audit change |
| `npm run test:engine` | Pathfinding, state, spectator, sprite, scene, or Game View behavior change |
| `npm run frontend:build` | Angular, TypeScript, styles, routes, or public asset change |
| `npm run test:release-tools` | Packaging, verification, soak validation, or admin-tool change |
| `npm run release:verify -- <folder>` | Existing release bundle integrity |
| `npm run soak:verify -- <report.json>` | Completed target-host soak evidence |

Tests must not modify approved character assets or the active local database. Prefer a temporary `DB_PATH` for manual API experiments.

## Manual smoke test

Start both development servers, then check:

1. `/` loads Office View and its Jira connection label is truthful.
2. `/game` creates one canvas and shows the castle, all enabled characters, and the activity panel.
3. Navigate Office → Game → Settings → Game; no extra canvas or duplicate SSE stream remains.
4. `/characters` lists and edits metadata without reassigning character identity.
5. `/settings/game` loads, validates, saves, and survives refresh.
6. `/operations` shows database ready, build identity, target FPS, and Jira state.
7. `/api/health` and `/api/ready` return expected statuses.

## Game View acceptance

- Characters are solid, grounded on their shadows, and legible against floor and rugs.
- Autonomous routes avoid the collision map and reach workstation/shared targets.
- Manual focus pauses automatic rotation; Resume and Next behave consistently.
- Presentation pause does not stop Jira collection.
- The active character, event author, ticket, and bottom panel agree.
- Duplicate events do not create repeated announcements.
- Multiple mapped users rotate fairly.
- Effects, movement, target FPS, TV scale, and fullscreen controls work.
- Hidden-tab and route-unmount behavior stop unnecessary rendering.

For board sprite changes, check front/back/side frames, walk-to-idle transition, pause/resume, fallback, and reduced motion. Always check Commander and Rogue separately in addition to the changed character.

## Office View regression

- Character switching preserves all eight roster identities.
- Commander and Rogue use their own animation, poster, and portrait.
- Pause, reduced motion, overview, dialogue, and full-body stage layout still work.
- The parent Jira bridge prevents independent polling.
- Demo fixtures remain labeled demo and never appear live.

## Jira verification

Use a non-production test scope where possible.

- Initial sync caches issues without replaying old changes.
- New transitions create one stable event.
- Event author and assignee remain separate.
- Unmapped authors do not activate another user's character.
- A poll failure preserves cached data but changes freshness away from live.
- Manual refresh is serialized with scheduled polling.
- Office and Game receive the same normalized issue/event state.

Do not include tokens, raw Authorization headers, or sensitive Jira responses in screenshots or test artifacts.

## Responsive and accessibility checks

- Test keyboard access to Angular controls and visible focus indicators.
- Confirm ticket links open a new tab without interrupting the canvas.
- Test with `prefers-reduced-motion: reduce`.
- Check common laptop/desktop dimensions and the intended TV resolution.
- Ensure long summaries wrap without overlapping portrait, badges, or controls.
- Verify text and state icons remain understandable without color alone.

## Soak and release evidence

Short smoke tests do not replace the television soak. Follow [TV_SOAK_RUNBOOK.md](TV_SOAK_RUNBOOK.md) on the actual display host. A certified candidate requires a completed, manually reviewed soak report:

```sh
npm run release:candidate -- --soak-report /path/to/report.json --target windows-amd64
```

The report must cover canvas lifecycle, memory stability, CPU/GPU/thermal observations, responsiveness, and truthful connection state.
