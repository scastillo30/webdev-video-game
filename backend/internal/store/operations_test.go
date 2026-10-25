package store

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestOperationalAuditRoundTripAndLimit(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	ctx := context.Background()
	for _, entry := range []AuditEntry{
		{RequestID: "request-old", Action: "character.create", Method: "POST", Path: "/api/characters", StatusCode: 201, DurationMS: 4, OccurredAt: "2026-01-01T00:00:00Z"},
		{RequestID: "request-new", Action: "jira.refresh", Method: "POST", Path: "/api/jira/refresh", StatusCode: 200, DurationMS: 8, OccurredAt: "2026-01-02T00:00:00Z"},
	} {
		if err = database.RecordAudit(ctx, entry); err != nil {
			t.Fatal(err)
		}
	}
	entries, err := database.ListAudit(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].RequestID != "request-new" || entries[0].ID == 0 {
		t.Fatalf("unexpected audit entries: %#v", entries)
	}
}

func TestOperationalRetentionPreviewAndApply(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	ctx := context.Background()
	now := time.Date(2026, time.October, 25, 12, 0, 0, 0, time.UTC)
	old := now.AddDate(0, 0, -400).Format(time.RFC3339Nano)
	recent := now.AddDate(0, 0, -2).Format(time.RFC3339Nano)
	for _, values := range [][]any{
		{"event-old", "OLD-1", "UPDATED", old},
		{"event-recent", "NEW-1", "UPDATED", recent},
	} {
		if _, err = database.db.ExecContext(ctx, `INSERT INTO jira_activity_events(event_id,issue_key,action,occurred_at) VALUES(?,?,?,?)`, values...); err != nil {
			t.Fatal(err)
		}
	}
	for _, entry := range []AuditEntry{
		{RequestID: "audit-old", Action: "jira.refresh", Method: "POST", Path: "/api/jira/refresh", StatusCode: 200, OccurredAt: old},
		{RequestID: "audit-recent", Action: "jira.refresh", Method: "POST", Path: "/api/jira/refresh", StatusCode: 200, OccurredAt: recent},
	} {
		if err = database.RecordAudit(ctx, entry); err != nil {
			t.Fatal(err)
		}
	}
	preview, err := database.PruneOperationalData(ctx, 180, 365, now, true)
	if err != nil {
		t.Fatal(err)
	}
	if preview.EventCandidates != 1 || preview.AuditCandidates != 1 || preview.EventsDeleted != 0 || preview.AuditsDeleted != 0 {
		t.Fatalf("unexpected preview: %#v", preview)
	}
	applied, err := database.PruneOperationalData(ctx, 180, 365, now, false)
	if err != nil {
		t.Fatal(err)
	}
	if applied.EventsDeleted != 1 || applied.AuditsDeleted != 1 {
		t.Fatalf("unexpected apply report: %#v", applied)
	}
	var eventCount, auditCount int
	if err = database.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM jira_activity_events`).Scan(&eventCount); err != nil {
		t.Fatal(err)
	}
	if err = database.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM operational_audit`).Scan(&auditCount); err != nil {
		t.Fatal(err)
	}
	if eventCount != 1 || auditCount != 1 {
		t.Fatalf("retention removed current data: events=%d audit=%d", eventCount, auditCount)
	}
}

func TestOperationalRetentionRejectsUnsafeRanges(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	if _, err = database.PruneOperationalData(context.Background(), 0, 365, time.Now(), true); err == nil {
		t.Fatal("expected unsafe event retention to fail")
	}
}
