-- Documentation mirror. Runtime uses backend/internal/store/migrations/004_game_configuration.sql.
CREATE TABLE IF NOT EXISTS game_settings (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  scene TEXT NOT NULL DEFAULT 'castle-command-center',
  movement_enabled INTEGER NOT NULL DEFAULT 1,
  effects_enabled INTEGER NOT NULL DEFAULT 1,
  animation_speed REAL NOT NULL DEFAULT 1.0,
  spectator_enabled INTEGER NOT NULL DEFAULT 1,
  rotation_interval_seconds INTEGER NOT NULL DEFAULT 15,
  tv_scale REAL NOT NULL DEFAULT 1.0,
  sound_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS jira_status_behavior_mappings (
  status_name TEXT PRIMARY KEY COLLATE NOCASE,
  behavior TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
