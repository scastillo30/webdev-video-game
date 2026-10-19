# Webdev MMORPG architecture

## Runtime

```text
Browser
  └─ Angular application (:4200 in development)
      ├─ Game view → /game/index.html
      └─ Character maintenance → /api/characters
                                      └─ Go HTTP API (:8080)
                                          └─ SQLite backend/data/game.db
```

The existing game remains intact at the repository root during migration. The Go server exposes it under `/game/`; Angular is the new application entry point and supplies database-backed character administration.

## Character ownership

SQLite stores editable application metadata. `characters/<id>/manifest.json` and `PROJECT_WORKFLOW.md` remain authoritative for animation ownership and approved versions. A database edit must not silently reassign Commander, Rogue, or any other character to another character's assets.

## API

- `GET /api/health`
- `GET /api/characters`
- `GET /api/characters/{id}`
- `POST /api/characters`
- `PUT /api/characters/{id}`
- `DELETE /api/characters/{id}`

The Go service applies the embedded migration at startup and uses parameterized SQL for all writes.

## Development

1. Use Node 22.23.1 and Go 1.27.1. Verified project-local runtimes are installed under the ignored `.tools/` directory on this workstation; `.node-version` and `.go-version` record the expected versions.
2. Run `npm run frontend:install` once when dependencies change.
3. Run `npm run local:backend:start` (or `npm run backend:start` when Go is globally available).
4. In another terminal run `npm run local:frontend:start` (or `npm run frontend:start` when Node is globally available).
5. Open `http://localhost:4200`.

For production, run `npm run frontend:build`, then start the Go server. It serves the Angular build, API, and legacy game from one process.

Verified local builds can also use `npm run local:frontend:build` and `npm run local:backend:build` without globally installing Node or Go.
