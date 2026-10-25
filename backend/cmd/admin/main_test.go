package main

import (
	"strings"
	"testing"
)

func TestRestoreRequiresStoppedServerConfirmation(t *testing.T) {
	err := run([]string{"restore", "--from", "backup.db"})
	if err == nil || !strings.Contains(err.Error(), "--confirm STOPPED") {
		t.Fatalf("restore was not confirmation-gated: %v", err)
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
