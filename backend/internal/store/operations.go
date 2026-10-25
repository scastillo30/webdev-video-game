package store

import (
	"context"
	"errors"
	"time"
)

const (
	minimumRetentionDays = 7
	maximumRetentionDays = 3650
)

// AuditEntry deliberately contains only operational metadata. Request bodies,
// query strings, credentials, email addresses, and client addresses are never
// persisted in this table.
type AuditEntry struct {
	ID         int64  `json:"id"`
	RequestID  string `json:"requestId"`
	Action     string `json:"action"`
	Method     string `json:"method"`
	Path       string `json:"path"`
	StatusCode int    `json:"statusCode"`
	DurationMS int64  `json:"durationMs"`
	OccurredAt string `json:"occurredAt"`
}

func (s *Store) RecordAudit(ctx context.Context, entry AuditEntry) error {
	if entry.RequestID == "" || entry.Action == "" || entry.Method == "" || entry.Path == "" {
		return errors.New("audit request ID, action, method, and path are required")
	}
	if entry.OccurredAt == "" {
		entry.OccurredAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO operational_audit(
		request_id,action,method,path,status_code,duration_ms,occurred_at
	) VALUES(?,?,?,?,?,?,?)`, entry.RequestID, entry.Action, entry.Method, entry.Path,
		entry.StatusCode, entry.DurationMS, entry.OccurredAt)
	return err
}

func (s *Store) ListAudit(ctx context.Context, limit int) ([]AuditEntry, error) {
	if limit < 1 || limit > 100 {
		limit = 25
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id,request_id,action,method,path,status_code,duration_ms,occurred_at
		FROM operational_audit ORDER BY occurred_at DESC,id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := make([]AuditEntry, 0, limit)
	for rows.Next() {
		var entry AuditEntry
		if err = rows.Scan(&entry.ID, &entry.RequestID, &entry.Action, &entry.Method, &entry.Path,
			&entry.StatusCode, &entry.DurationMS, &entry.OccurredAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

type MaintenanceReport struct {
	DryRun             bool   `json:"dryRun"`
	EventRetentionDays int    `json:"eventRetentionDays"`
	AuditRetentionDays int    `json:"auditRetentionDays"`
	EventCandidates    int64  `json:"eventCandidates"`
	AuditCandidates    int64  `json:"auditCandidates"`
	EventsDeleted      int64  `json:"eventsDeleted"`
	AuditsDeleted      int64  `json:"auditsDeleted"`
	CompletedAt        string `json:"completedAt"`
}

// PruneOperationalData removes only historical Jira activity events and
// credential-safe audit rows. Current Jira issue snapshots, configuration, and
// characters are outside the retention boundary.
func (s *Store) PruneOperationalData(ctx context.Context, eventDays, auditDays int, now time.Time, dryRun bool) (MaintenanceReport, error) {
	report := MaintenanceReport{DryRun: dryRun, EventRetentionDays: eventDays, AuditRetentionDays: auditDays}
	if eventDays < minimumRetentionDays || eventDays > maximumRetentionDays || auditDays < minimumRetentionDays || auditDays > maximumRetentionDays {
		return report, errors.New("retention days must be between 7 and 3650")
	}
	if now.IsZero() {
		now = time.Now()
	}
	eventCutoff := now.UTC().AddDate(0, 0, -eventDays).Format(time.RFC3339Nano)
	auditCutoff := now.UTC().AddDate(0, 0, -auditDays).Format(time.RFC3339Nano)
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return report, err
	}
	defer tx.Rollback()
	if err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM jira_activity_events WHERE occurred_at < ?`, eventCutoff).Scan(&report.EventCandidates); err != nil {
		return report, err
	}
	if err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM operational_audit WHERE occurred_at < ?`, auditCutoff).Scan(&report.AuditCandidates); err != nil {
		return report, err
	}
	if !dryRun {
		result, deleteErr := tx.ExecContext(ctx, `DELETE FROM jira_activity_events WHERE occurred_at < ?`, eventCutoff)
		if deleteErr != nil {
			return report, deleteErr
		}
		report.EventsDeleted, _ = result.RowsAffected()
		result, deleteErr = tx.ExecContext(ctx, `DELETE FROM operational_audit WHERE occurred_at < ?`, auditCutoff)
		if deleteErr != nil {
			return report, deleteErr
		}
		report.AuditsDeleted, _ = result.RowsAffected()
	}
	report.CompletedAt = now.UTC().Format(time.RFC3339Nano)
	if err = tx.Commit(); err != nil {
		return report, err
	}
	return report, nil
}
