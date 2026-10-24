# Game View Phases 9–10 — Delivery Report

Date: 2026-10-24
Branch: `codex/game-view-proposal`

## Phase 9 — Release evidence completion

- The browser soak runner now exports explicit hardware-review fields.
- `scripts/verify-soak-report.mjs` rejects incomplete, shortened, failed, unsigned, or malformed reports.
- The default release gate requires 240 minutes, at least two samples, no automated failures, a completed run, named reviewer notes, and explicit hardware sign-off.

The target-host run itself remains an operational task because CPU, GPU, thermals, and fan behavior must be observed on that physical machine.

## Phase 10 — Reproducible packaging

- Angular font inlining is disabled at build time, removing the production build's dependency on access to Google Fonts.
- `scripts/build-release.mjs` builds Angular and a platform-specific Go binary, copies the compiled UI and preserved legacy runtime, discovers only assets referenced by the active runtime, and creates launch instructions.
- Clean-tree enforcement prevents an official bundle from silently including uncommitted work. `--allow-dirty` is available only for packaging-pipeline tests and is recorded in the manifest.
- Every bundle includes `release-manifest.json` with the Git commit, target, build time, dirty state, file sizes, and SHA-256 hashes.
- `scripts/verify-release.mjs` rejects missing, modified, unlisted, or symlinked files.
- Runtime-generated SQLite files are allowed only inside the manifest's designated `data/` directory; the rest of the bundle remains immutable and checksum-verified.
- Jira credentials remain process environment variables and are never copied into the bundle.

## Verification completed

- Go backend tests, Angular type checking, and deterministic engine tests pass.
- The production Angular build succeeds without external font downloads.
- Release and soak-report tooling has automated unit coverage.
- A 76-file `darwin-arm64` test bundle passed checksum verification and served the application, Operations console, TV soak runner, and preserved legacy view from the packaged Go server.
- The official release gate still requires a completed four-hour target-hardware soak report with reviewer sign-off.

## Character preservation

No character animation, registry, manifest, Blender source, or character-owned asset is changed by this phase. Packaging reads runtime references but does not modify their source files.
