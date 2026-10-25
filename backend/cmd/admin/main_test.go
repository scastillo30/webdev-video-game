package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"webdev-mmorpg/backend/internal/store"
)

func TestRestoreRequiresStoppedServerConfirmation(t *testing.T) {
	err := run([]string{"restore", "--from", "backup.db"})
	if err == nil || !strings.Contains(err.Error(), "--confirm STOPPED") {
		t.Fatalf("restore was not confirmation-gated: %v", err)
	}
}

func TestPruneApplyRequiresConfirmationAndBackup(t *testing.T) {
	databasePath := filepath.Join(t.TempDir(), "game.db")
	database, err := store.Open(databasePath)
	if err != nil {
		t.Fatal(err)
	}
	database.Close()
	if err = run([]string{"prune", "--db", databasePath, "--apply"}); err == nil || !strings.Contains(err.Error(), "--confirm PRUNE") {
		t.Fatalf("prune was not confirmation-gated: %v", err)
	}
	if err = run([]string{"prune", "--db", databasePath, "--apply", "--confirm", "PRUNE"}); err == nil || !strings.Contains(err.Error(), "--backup") {
		t.Fatalf("prune was not backup-gated: %v", err)
	}
}

func TestPruneApplyCreatesBackupBeforeDeletion(t *testing.T) {
	directory := t.TempDir()
	databasePath := filepath.Join(directory, "game.db")
	backupPath := filepath.Join(directory, "before-prune.db")
	database, err := store.Open(databasePath)
	if err != nil {
		t.Fatal(err)
	}
	if err = database.RecordAudit(context.Background(), store.AuditEntry{RequestID: "old", Action: "jira.refresh", Method: "POST", Path: "/api/jira/refresh", StatusCode: 200, OccurredAt: "2020-01-01T00:00:00Z"}); err != nil {
		t.Fatal(err)
	}
	database.Close()
	if err = run([]string{"prune", "--db", databasePath, "--event-days", "180", "--audit-days", "365", "--apply", "--confirm", "PRUNE", "--backup", backupPath}); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(backupPath); err != nil {
		t.Fatalf("pre-prune backup missing: %v", err)
	}
	database, err = store.Open(databasePath)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	entries, err := database.ListAudit(context.Background(), 10)
	if err != nil || len(entries) != 0 {
		t.Fatalf("old audit was not pruned: entries=%#v err=%v", entries, err)
	}
}

func TestAdminRejectsUnknownCommand(t *testing.T) {
	err := run([]string{"delete-everything"})
	if err == nil || !strings.Contains(err.Error(), "unknown command") {
		t.Fatalf("unexpected command result: %v", err)
	}
}

func TestBackupRefusesMissingSourceDatabase(t *testing.T) {
	err := run([]string{"backup", "--db", "missing-game.db", "--out", "backup.db"})
	if err == nil || !strings.Contains(err.Error(), "does not exist") {
		t.Fatalf("missing source database was not rejected: %v", err)
	}
}
