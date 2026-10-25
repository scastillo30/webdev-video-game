# Game View Phases 13–14 — Delivery Report

Date: 2026-10-25
Branch: `codex/game-view-proposal`

## Phase 13 — Runtime identity and build provenance

- The application now has an explicit package version.
- Release packaging injects version, Git commit, UTC build time, and operating-system/architecture target into the Go server.
- `GET /api/version` returns that credential-safe identity, and the Operations console shows the version, abbreviated commit, and target.
- Development runs remain clearly labeled `dev`, `unknown`, and `development`.
- Release manifests and release certificates carry the same version and commit identity.

## Phase 14 — SQLite backup and recovery

- `webdev-admin backup` creates a consistent live-safe SQLite snapshot without overwriting existing backups.
- Every snapshot is checked read-only with `PRAGMA quick_check` and reported with size, timestamp, and SHA-256 digest.
- `webdev-admin verify` validates a backup without running application migrations.
- `webdev-admin restore` requires the exact `--confirm STOPPED` acknowledgement, verifies the source and staged copy, and preserves the replaced database plus WAL/SHM sidecars under a timestamped rollback name.
- The administration binary, backup directory, recovery runbook, and commands are included in every release bundle.

## Character preservation

No character animation, registry entry, manifest, Blender source, export script, or character-owned asset is changed by these phases.

## Verification completed

- The unified quality gate passes backend, frontend, engine, ownership, release-tool, whitespace, and production-build checks.
- Store tests cover backup integrity, owner-only permissions, overwrite refusal, restore round-trip behavior, corrupt-file rejection, and rollback sidecar preservation.
- The administration CLI completed a real backup → verify → restore sequence against a temporary database.
- Windows x64 and macOS ARM64 bundles cross-compiled with both executables and passed integrity verification with 80 immutable files.
- A packaged macOS server reported version `0.1.0`, the expected commit, build timestamp, and `darwin-arm64` target consistently through `/api/version` and `/api/operations/status`.
- The packaged admin tool created and verified a backup while that server remained live; mutable database and backup files did not invalidate the release manifest.

## Operational requirement

Backup may run while the server is live. Restore must run only after the server has been stopped. The existing signed four-hour target-hardware soak remains required for a certified release candidate.
