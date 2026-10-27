ALTER TABLE characters ADD COLUMN jira_activity_url TEXT;
ALTER TABLE characters ADD COLUMN work_email TEXT;
ALTER TABLE characters ADD COLUMN linked_login_username TEXT;

CREATE TABLE IF NOT EXISTS jira_user_cache (
  user_id TEXT NOT NULL,
  host TEXT NOT NULL,
  account_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  last_synced_at TEXT NOT NULL,
  PRIMARY KEY(user_id, host, account_key)
);

CREATE TABLE IF NOT EXISTS jira_user_sync (
  user_id TEXT NOT NULL,
  host TEXT NOT NULL,
  last_sync_at TEXT NOT NULL,
  PRIMARY KEY(user_id, host)
);
