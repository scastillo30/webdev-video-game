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

1. Install Go 1.22 or newer.
2. Run `npm run frontend:install` once.
3. Run `npm run backend:start`.
4. In another terminal run `npm run frontend:start`.
5. Open `http://localhost:4200`.

For production, run `npm run frontend:build`, then start the Go server. It serves the Angular build, API, and legacy game from one process.
