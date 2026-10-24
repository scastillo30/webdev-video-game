-- Documentation mirror. Runtime uses backend/internal/store/migrations/003_game_profiles.sql.
CREATE TABLE IF NOT EXISTS character_game_profiles (
  character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  jira_account_id TEXT UNIQUE,
  home_location TEXT NOT NULL,
  workstation TEXT NOT NULL,
  miniature_asset TEXT NOT NULL,
  portrait_asset TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
