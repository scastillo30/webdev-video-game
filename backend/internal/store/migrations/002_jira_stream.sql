CREATE TABLE IF NOT EXISTS jira_issue_snapshots (
  issue_key TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  issue_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  status_category TEXT NOT NULL DEFAULT '',
  assignee_id TEXT,
  assignee_name TEXT,
  priority TEXT,
  project_key TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  due_date TEXT,
  issue_url TEXT NOT NULL DEFAULT '',
  observed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jira_activity_events (
  event_id TEXT PRIMARY KEY,
  issue_key TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT,
  assignee_id TEXT,
  assignee_name TEXT,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  current_status TEXT,
  occurred_at TEXT NOT NULL,
  issue_summary TEXT NOT NULL DEFAULT '',
  issue_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jira_events_occurred_at
  ON jira_activity_events(occurred_at DESC);

CREATE TABLE IF NOT EXISTS jira_sync_state (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  state TEXT NOT NULL DEFAULT 'disconnected',
  configured INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  last_success_at TEXT,
  message TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO jira_sync_state(singleton) VALUES(1);
