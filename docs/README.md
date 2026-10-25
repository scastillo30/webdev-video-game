# Project documentation index

This index separates current operating documentation from historical planning material. Source code, migrations, and character manifests remain authoritative when a document and the implementation disagree.

## Start here

| Document | Use it for |
| --- | --- |
| [README.md](../README.md) | Product overview and fastest local start |
| [PROJECT_SPEC.md](../PROJECT_SPEC.md) | Current product goals, requirements, scope, and acceptance baseline |
| [DEVELOPMENT.md](../DEVELOPMENT.md) | Dependencies, run modes, environment, and troubleshooting |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Runtime components, data flow, persistence, and ownership boundaries |
| [API.md](../API.md) | REST and Server-Sent Events contract |
| [DATABASE.md](../DATABASE.md) | SQLite tables, migrations, and ownership boundaries |
| [OFFICE_VIEW.md](../OFFICE_VIEW.md) | Preserved cinematic runtime, Jira bridge, and regression checks |
| [GAME_VIEW.md](../GAME_VIEW.md) | Phaser board behavior, movement, interactions, and board visuals |
| [JIRA_INTEGRATION.md](../JIRA_INTEGRATION.md) | Jira configuration, normalization, mapping, and freshness semantics |
| [TESTING.md](../TESTING.md) | Test suites, quality gate, and manual acceptance checks |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Release bundles, runtime configuration, health, and rollback |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Branch, code, database, documentation, and asset workflow |

## Character and visual production

| Document | Status |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Mandatory character ownership rules |
| [PROJECT_WORKFLOW.md](../PROJECT_WORKFLOW.md) | Mandatory versioning and integration workflow |
| [BOARD_CHARACTER_WORKFLOW.md](../BOARD_CHARACTER_WORKFLOW.md) | Current board-sprite production and integration guide |
| [GAME_BOARD_VISUALS.md](../GAME_BOARD_VISUALS.md) | Current castle environment and board asset boundary |
| [assets/STRUCTURE.md](../assets/STRUCTURE.md) | Asset directory conventions |
| `characters/<id>/manifest.json` | Source of truth for that character's approved assets |

## Operations

| Document | Use it for |
| --- | --- |
| [WINDOWS_SETUP.md](../WINDOWS_SETUP.md) | Windows development and release-host setup |
| [TV_SOAK_RUNBOOK.md](../TV_SOAK_RUNBOOK.md) | Long-running display acceptance test |
| [BACKUP_RECOVERY.md](../BACKUP_RECOVERY.md) | SQLite backup, restore, and rollback |
| [DATA_RETENTION.md](../DATA_RETENTION.md) | Preview-first event and audit pruning |

## Historical records

The following files preserve decisions and completion evidence. They should not be used as current runbooks:

- [GAME_SPEC.md](../GAME_SPEC.md) — original static V4 continuation specification
- [GAME_VIEW_IMPLEMENTATION_PLAN.md](../GAME_VIEW_IMPLEMENTATION_PLAN.md) — implemented migration plan
- `PHASE_*.md` and `PHASES_*.md` — phase completion reports

When behavior changes, update the relevant current guide in the same change. Add a new document only when the information has a distinct audience or lifecycle; otherwise extend an existing guide.
