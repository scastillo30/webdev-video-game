# Game View Phases 11–12 — Delivery Report

Date: 2026-10-24
Branch: `codex/game-view-proposal`

## Phase 11 — Production runtime hardening

- `GET /api/health` remains a lightweight process liveness probe and now rejects unsupported methods.
- `GET /api/ready` confirms SQLite can answer requests and reports the current Jira connection state without exposing credentials.
- The Operations console now reports the database readiness state alongside service uptime.
- The Go server bounds header and request reads, idle connections, and header size while leaving response write timeout disabled for the long-lived SSE stream.
- `SIGINT` and `SIGTERM` trigger a ten-second graceful shutdown instead of terminating active work immediately.
- Browser responses receive `nosniff`, same-origin framing/referrer policy, restricted browser permissions, and no-store API defaults.
- Cross-origin access is disabled by default and uses the comma-separated `CORS_ALLOWED_ORIGINS` allowlist when explicitly needed; unapproved preflight origins receive `403`.

## Phase 12 — Automated release qualification

- `npm run quality:check` is the single local and CI gate for whitespace, character ownership, release tooling, Go, TypeScript, deterministic engine behavior, and the Angular production build.
- `.github/workflows/quality.yml` runs that gate on pushes and pull requests with Node 22 and Go 1.22.
- `npm run release:candidate -- --soak-report <report> --target <platform>` requires a clean tree, passes the full quality gate, validates the signed four-hour soak, and creates the verified release bundle.
- Qualified bundles receive `release-certificate.json`. It binds the Git commit, target, verification time, and soak-report SHA-256 digest without copying the operator's report into the release.
- The certificate is itself included in `release-manifest.json` and covered by normal bundle checksum verification.

## Character preservation

No character animation, character registry, manifest, Blender source, export script, or character-owned asset is changed by these phases.

## Verification completed

- The unified quality gate passes all backend, frontend, engine, ownership, release-tool, whitespace, and production-build checks.
- Windows x64 and macOS ARM64 test bundles cross-compile and pass integrity verification with 77 packaged files.
- The packaged server returns database-ready state, approved-origin CORS headers, `403` for an unapproved preflight, and the expected browser security headers.
- The packaged Operations route responds successfully, and an interrupt completes a zero-error graceful shutdown.
- The release-candidate command rejects missing soak evidence before starting release work.

## Remaining operational gate

The release-candidate command is intentionally blocked until a real four-hour report is completed and manually signed on the target display host.
