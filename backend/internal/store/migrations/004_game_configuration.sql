CREATE TABLE IF NOT EXISTS game_settings (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  scene TEXT NOT NULL DEFAULT 'castle-command-center',
  movement_enabled INTEGER NOT NULL DEFAULT 1 CHECK(movement_enabled IN (0,1)),
  effects_enabled INTEGER NOT NULL DEFAULT 1 CHECK(effects_enabled IN (0,1)),
  animation_speed REAL NOT NULL DEFAULT 1.0 CHECK(animation_speed BETWEEN 0.5 AND 2.0),
  spectator_enabled INTEGER NOT NULL DEFAULT 1 CHECK(spectator_enabled IN (0,1)),
  rotation_interval_seconds INTEGER NOT NULL DEFAULT 15 CHECK(rotation_interval_seconds BETWEEN 5 AND 300),
  tv_scale REAL NOT NULL DEFAULT 1.0 CHECK(tv_scale BETWEEN 0.8 AND 1.4),
  sound_enabled INTEGER NOT NULL DEFAULT 0 CHECK(sound_enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO game_settings(singleton) VALUES(1);

CREATE TABLE IF NOT EXISTS jira_status_behavior_mappings (
  status_name TEXT PRIMARY KEY COLLATE NOCASE,
  behavior TEXT NOT NULL CHECK(behavior IN ('IDLE','WORKING','DISCUSSING','REVIEWING','BLOCKED','CELEBRATING')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO jira_status_behavior_mappings(status_name,behavior) VALUES
('In Progress','WORKING'),
('In Review','REVIEWING'),
('Review','REVIEWING'),
('Blocked','BLOCKED'),
('Done','CELEBRATING'),
('Closed','CELEBRATING');
