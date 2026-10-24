package jira

import (
	"encoding/json"
	"testing"
	"time"
)

func TestNormalizeCloudResponseSeparatesAuthorAndAssignee(t *testing.T) {
	var payload cloudSearchResponse
	raw := `{"issues":[{"key":"PLANNA-123","fields":{"summary":"Review the release","issuetype":{"name":"Task"},"status":{"name":"Code Review","statusCategory":{"key":"indeterminate"}},"assignee":{"accountId":"assignee-1","displayName":"Assigned Engineer"},"priority":{"name":"High"},"project":{"key":"PLANNA"},"updated":"2026-10-24T12:01:00.000+0000","duedate":null},"changelog":{"histories":[{"id":"history-9","created":"2026-10-24T12:00:00.000+0000","author":{"accountId":"author-2","displayName":"Reviewing Engineer"},"items":[{"field":"status","fromString":"In Progress","toString":"Code Review"}]}]}}]}`
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatal(err)
	}
	since := time.Date(2026, 10, 24, 11, 59, 0, 0, time.UTC)
	batch := normalizeCloudResponse(payload, "https://example.atlassian.net", since)
	if len(batch.Issues) != 1 || len(batch.Events) != 1 {
		t.Fatalf("expected one issue and event, got %d and %d", len(batch.Issues), len(batch.Events))
	}
	event := batch.Events[0]
	if event.AuthorID == nil || *event.AuthorID != "author-2" {
		t.Fatalf("unexpected author: %#v", event.AuthorID)
	}
	if event.AssigneeID == nil || *event.AssigneeID != "assignee-1" {
		t.Fatalf("unexpected assignee: %#v", event.AssigneeID)
	}
	if event.EventID != "PLANNA-123:history-9:0" || event.Action != "MOVED" {
		t.Fatalf("unexpected normalized event: %#v", event)
	}
}

func TestInitialSnapshotDoesNotReplayHistoricalTransitions(t *testing.T) {
	var payload cloudSearchResponse
	if err := json.Unmarshal([]byte(`{"issues":[{"key":"A-1","fields":{"summary":"Initial","status":{"name":"Done","statusCategory":{"key":"done"}},"project":{"key":"A"},"updated":"2026-10-24T12:01:00Z"},"changelog":{"histories":[{"id":"1","created":"2026-10-24T12:00:00Z","items":[{"field":"status","fromString":"Open","toString":"Done"}]}]}}]}`), &payload); err != nil {
		t.Fatal(err)
	}
	batch := normalizeCloudResponse(payload, "https://example.atlassian.net", time.Time{})
	if len(batch.Issues) != 1 || len(batch.Events) != 0 {
		t.Fatalf("initial synchronization must cache state without replaying history: %#v", batch)
	}
}
