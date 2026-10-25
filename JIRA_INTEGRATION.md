# Jira integration

## Design rule

There is one Jira integration and two independent presentation layers. Go polls Jira once, normalizes and persists the result, and publishes it to one root-scoped Angular store. Office View and Game View never run competing Jira pollers.

```text
Jira Cloud
  → Go source adapter and poller
  → normalized issue snapshots + immutable activity events
  → SQLite and in-process event broker
  → REST snapshot + SSE
  → Angular Jira store
      → Office View bridge
      → Game View behavior/spectator services
```

## Server configuration

Set all four variables in the Go process environment:

| Variable | Meaning |
| --- | --- |
| `JIRA_BASE_URL` | Jira Cloud tenant URL |
| `JIRA_EMAIL` | Account used for the API request |
| `JIRA_API_TOKEN` | Server-only token |
| `JIRA_JQL` | Issues available to the shared application stream |

If any value is absent, the source is unconfigured. The UI must say disconnected/unconfigured, never live. Demo fixtures in the legacy client are explicitly demo-only and are not inserted into backend state.

The poll interval is stored in Game configuration, defaults to 60 seconds, and can be changed between 10 and 3600 seconds. Updating it reconfigures the existing poller; it does not create another poller.

## Normalized records

Issue snapshots represent current ticket state. Activity events represent actions at a point in time. They are deliberately separate so a past transition is not confused with the issue's current status.

Important identity fields:

- `authorId` identifies the user who performed the event.
- `assigneeId` identifies the current or recorded ticket assignee.
- Character appearance is selected only from an explicit stable `authorId` mapping.
- Assignment may influence workstation context but never rewrites authorship.
- An unmapped author remains neutral and is not attributed to another character.

Stable event IDs come from issue key, Jira changelog history ID, and changed-field index. SQLite uniqueness and frontend reduction prevent duplicate announcements.

## Initial and subsequent synchronization

The first successful poll seeds current issue snapshots without replaying the historical changelog as new activity. Later polls compare the stored cursor/state, persist new normalized events, and publish only newly accepted events.

If polling fails, the last successful snapshots remain available but the connection becomes stale or disconnected. Cached data is never relabeled live. The connection object provides `configured`, attempt/success timestamps, a state, and a human-readable message.

## Character mapping

Use `/settings/game` to associate a stable Jira account ID with a canonical character ID. Rules enforced by the backend:

- A Jira account may map to at most one character.
- Every game profile corresponds to a known character.
- Empty mappings are valid.
- Updating Jira mappings cannot update character-owned asset paths.

Do not use display names or email addresses as stable identifiers. Do not copy demo associations into production configuration without confirmation.

## Game View behavior

Game View applies presentation-only project and issue-type filters after receiving the shared stream. These filters do not broaden or replace `JIRA_JQL`.

Status mappings translate exact Jira status names into character behaviors. Supported behavior states are `IDLE`, `WORKING`, `DISCUSSING`, `REVIEWING`, `BLOCKED`, and `CELEBRATING`; `WALKING` is an internal movement state rather than a persisted status mapping.

The spectator director groups pending events by mapped author, rotates fairly, and uses the configured 15-second default. Manual focus pauses presentation rotation, not collection. Dialogue/activity details and the focused board character are updated from the same event.

## Office View bridge

Angular loads the preserved Office runtime from `/legacy-game/index.html?parentJira=1`. A versioned, same-origin `postMessage` bridge sends the current normalized snapshot and subsequent events. When that bridge is active, the legacy browser adapter does not independently poll.

The root-level `jira/examples.json` remains useful for standalone legacy demonstration. It must be labeled as a fixture and must never be presented as live Jira activity.

## Operations and diagnostics

- `/operations` shows connection freshness and poller diagnostics.
- `GET /api/operations/status` provides the same credential-safe state for automation.
- `POST /api/jira/refresh` requests one serialized refresh; it is an operator action, not a second polling path.
- Audit records never contain Jira credentials, request bodies, query strings, account emails, or client addresses.

For payload fields and endpoints, see [API.md](API.md). For release-host validation, see [TV_SOAK_RUNBOOK.md](TV_SOAK_RUNBOOK.md).
