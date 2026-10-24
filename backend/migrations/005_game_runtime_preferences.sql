-- Documentation mirror. Runtime uses backend/internal/store/migrations/005_game_runtime_preferences.sql.
ALTER TABLE game_settings ADD COLUMN jira_projects TEXT NOT NULL DEFAULT '[]';
ALTER TABLE game_settings ADD COLUMN jira_issue_types TEXT NOT NULL DEFAULT '[]';
ALTER TABLE game_settings ADD COLUMN featured_ticket_rule TEXT NOT NULL DEFAULT 'recently-updated';
ALTER TABLE game_settings ADD COLUMN refresh_interval_seconds INTEGER NOT NULL DEFAULT 60;
ALTER TABLE game_settings ADD COLUMN tv_mode_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE game_settings ADD COLUMN fullscreen_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE game_settings ADD COLUMN target_fps INTEGER NOT NULL DEFAULT 30;
