package store

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

func TestBackupVerifyAndRestoreRoundTrip(t *testing.T) {
	ctx := context.Background()
	directory := t.TempDir()
	databasePath := filepath.Join(directory, "game.db")
	backupPath := filepath.Join(directory, "backups", "game-backup.db")
	database, err := Open(databasePath)
	if err != nil {
		t.Fatal(err)
	}
	before := Character{ID: "backup-before", Name: "Before", Role: "Test"}
	if _, err = database.Create(before); err != nil {
		t.Fatal(err)
	}
	created, err := database.Backup(ctx, backupPath)
	if err != nil {
		t.Fatal(err)
	}
	if created.SHA256 == "" || created.Size == 0 || created.Path != backupPath {
		t.Fatalf("incomplete backup report: %#v", created)
	}
	if info, statErr := os.Stat(backupPath); statErr != nil || info.Mode().Perm() != 0600 {
		t.Fatalf("backup permissions are not owner-only: info=%v err=%v", info, statErr)
	}
	if _, err = database.Backup(ctx, backupPath); err == nil {
		t.Fatal("expected backup to refuse overwriting an existing file")
	}
	after := Character{ID: "backup-after", Name: "After", Role: "Test"}
	if _, err = database.Create(after); err != nil {
		t.Fatal(err)
	}
	if err = database.Close(); err != nil {
		t.Fatal(err)
	}
	restored, err := RestoreBackup(ctx, backupPath, databasePath)
	if err != nil {
		t.Fatal(err)
	}
	if restored.RollbackPath == "" || restored.SHA256 == "" {
		t.Fatalf("restore did not preserve rollback/checksum: %#v", restored)
	}
	if active, verifyErr := VerifyBackup(ctx, databasePath); verifyErr != nil || active.SHA256 != restored.SHA256 {
		t.Fatalf("restored database checksum mismatch: active=%#v err=%v", active, verifyErr)
	}
	if _, err = VerifyBackup(ctx, restored.RollbackPath); err != nil {
		t.Fatalf("rollback database is invalid: %v", err)
	}
	database, err = Open(databasePath)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	if _, err = database.Get(before.ID); err != nil {
		t.Fatalf("backup content was not restored: %v", err)
	}
	if _, err = database.Get(after.ID); err != sql.ErrNoRows {
		t.Fatalf("post-backup content survived restore: %v", err)
	}
}

func TestRestorePreservesExistingSidecarFiles(t *testing.T) {
	ctx := context.Background()
	directory := t.TempDir()
	target := filepath.Join(directory, "game.db")
	source := filepath.Join(directory, "source.db")
	database, err := Open(target)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = database.Backup(ctx, source); err != nil {
		t.Fatal(err)
	}
	if err = database.Close(); err != nil {
		t.Fatal(err)
	}
	for _, suffix := range []string{"-wal", "-shm"} {
		if err = os.WriteFile(target+suffix, []byte("preserved "+suffix), 0600); err != nil {
			t.Fatal(err)
		}
	}
	restored, err := RestoreBackup(ctx, source, target)
	if err != nil {
		t.Fatal(err)
	}
	for _, suffix := range []string{"-wal", "-shm"} {
		if body, readErr := os.ReadFile(restored.RollbackPath + suffix); readErr != nil || string(body) != "preserved "+suffix {
			t.Fatalf("rollback sidecar %s was not preserved: body=%q err=%v", suffix, body, readErr)
		}
	}
}

func TestVerifyBackupRejectsCorruptFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "corrupt.db")
	if err := os.WriteFile(path, []byte("not a sqlite database"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := VerifyBackup(context.Background(), path); err == nil {
		t.Fatal("expected corrupt backup verification to fail")
	}
}
