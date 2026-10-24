# Game View Phases 8–9 — Delivery Report

Date: 2026-10-24
Branch: `codex/game-view-proposal`

The approved proposal ended at phase 6 and the previous delivery split persistent configuration and validation into phases 6–7. This extension assigns the remaining operational release work to phases 8–9.

## Phase 8 — Operational readiness

Delivered:

- A credential-safe `GET /api/operations/status` endpoint with service uptime, Jira connection state, issue/event counts, poll cadence, poll outcomes, last-poll duration, SSE subscriber count, configured frame cap, and TV-mode state.
- A serialized `POST /api/jira/refresh` endpoint that reuses the existing Jira service and cannot overlap the scheduled poll.
- An Angular `/operations` console with automatic status updates, manual Jira refresh, explicit degraded-state treatment, and a direct link to the soak runner.
- Backend coverage for poll telemetry, subscriber counting, method restrictions, manual refresh, operations payload defaults, and credential-field exclusion.

## Phase 9 — TV soak and release evidence

Delivered:

- A dependency-free browser runner at `/diagnostics/soak.html`.
- Steady Game View and Game ↔ Office route-cycle modes.
- Configurable duration, sampling interval, and route-cycle interval.
- Checks for exactly one Phaser canvas on Game View, zero canvases after Office View teardown, operations API availability, severe event-loop lag, and excessive heap growth when Chromium exposes heap data.
- A timestamped JSON report with samples, failures, runtime telemetry, and a mandatory manual hardware-review marker.
- A target-host runbook in `TV_SOAK_RUNBOOK.md`.

## Safety and ownership

No character registry, character manifest, character animation, Blender source, or character-owned asset is part of phases 8–9. The operations payload contains no Jira base URL, email, token, JQL, or other credential material.

## Remaining operational gate

The software and unattended harness can be verified locally, but the final multi-hour run must still be executed on the actual television host while CPU, GPU, thermals, and fan behavior are observed externally.
