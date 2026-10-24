package store

import (
	"context"
	"path/filepath"
	"testing"
	"time"
	"webdev-mmorpg/backend/internal/jira"
)

func TestMigrationsAndJiraEventDeduplication(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	var migrationsApplied int
	if err := database.db.QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&migrationsApplied); err != nil {
		t.Fatal(err)
	}
	if migrationsApplied < 3 {
		t.Fatalf("expected all three migrations, got %d", migrationsApplied)
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	event := jira.ActivityEvent{EventID: "A-1:h1:0", IssueKey: "A-1", AuthorID: jira.String("author"), AssigneeID: jira.String("assignee"), Action: "MOVED", OccurredAt: now, IssueSummary: "Test"}
	issue := jira.IssueSnapshot{IssueKey: "A-1", Summary: "Test", Status: "Review", UpdatedAt: now}
	connection := jira.Connection{State: "live", Configured: true, LastSuccessAt: &now}
	accepted, err := database.ApplyJiraBatch(context.Background(), jira.Batch{Issues: []jira.IssueSnapshot{issue}, Events: []jira.ActivityEvent{event}}, connection)
	if err != nil || len(accepted) != 1 {
		t.Fatalf("first batch: accepted=%d err=%v", len(accepted), err)
	}
	accepted, err = database.ApplyJiraBatch(context.Background(), jira.Batch{Issues: []jira.IssueSnapshot{issue}, Events: []jira.ActivityEvent{event}}, connection)
	if err != nil || len(accepted) != 0 {
		t.Fatalf("duplicate batch: accepted=%d err=%v", len(accepted), err)
	}
	snapshot, err := database.JiraSnapshot(context.Background(), 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Events) != 1 || len(snapshot.Issues) != 1 || snapshot.Connection.State != "live" {
		t.Fatalf("unexpected snapshot: %#v", snapshot)
	}
}
