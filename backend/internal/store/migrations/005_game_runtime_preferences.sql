ALTER TABLE game_settings ADD COLUMN jira_projects TEXT NOT NULL DEFAULT '[]';
ALTER TABLE game_settings ADD COLUMN jira_issue_types TEXT NOT NULL DEFAULT '[]';
ALTER TABLE game_settings ADD COLUMN featured_ticket_rule TEXT NOT NULL DEFAULT 'recently-updated'
  CHECK(featured_ticket_rule IN ('recently-updated','highest-priority','nearest-due-date'));
ALTER TABLE game_settings ADD COLUMN refresh_interval_seconds INTEGER NOT NULL DEFAULT 60
  CHECK(refresh_interval_seconds BETWEEN 10 AND 3600);
ALTER TABLE game_settings ADD COLUMN tv_mode_enabled INTEGER NOT NULL DEFAULT 1 CHECK(tv_mode_enabled IN (0,1));
ALTER TABLE game_settings ADD COLUMN fullscreen_enabled INTEGER NOT NULL DEFAULT 1 CHECK(fullscreen_enabled IN (0,1));
ALTER TABLE game_settings ADD COLUMN target_fps INTEGER NOT NULL DEFAULT 30 CHECK(target_fps IN (24,30,60));
