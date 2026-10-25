CREATE TABLE operational_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL,
    action TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    occurred_at TEXT NOT NULL
);

CREATE INDEX idx_operational_audit_occurred_at
    ON operational_audit(occurred_at DESC);
