package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type BackupReport struct {
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	SHA256    string `json:"sha256"`
	CreatedAt string `json:"createdAt"`
}

type RestoreReport struct {
	DatabasePath string `json:"databasePath"`
	SourcePath   string `json:"sourcePath"`
	RollbackPath string `json:"rollbackPath,omitempty"`
	SHA256       string `json:"sha256"`
	RestoredAt   string `json:"restoredAt"`
}

func (s *Store) Backup(ctx context.Context, destination string) (BackupReport, error) {
	destination, err := cleanDatabasePath(destination)
	if err != nil {
		return BackupReport{}, err
	}
	if _, err = os.Stat(destination); err == nil {
		return BackupReport{}, fmt.Errorf("backup destination already exists: %s", destination)
	} else if !errors.Is(err, os.ErrNotExist) {
		return BackupReport{}, err
	}
	if err = os.MkdirAll(filepath.Dir(destination), 0750); err != nil {
		return BackupReport{}, fmt.Errorf("create backup directory: %w", err)
	}
	temporary := fmt.Sprintf("%s.tmp-%d", destination, time.Now().UnixNano())
	defer os.Remove(temporary)
	if _, err = s.db.ExecContext(ctx, "VACUUM INTO ?", temporary); err != nil {
		return BackupReport{}, fmt.Errorf("create SQLite snapshot: %w", err)
	}
	if err = os.Chmod(temporary, 0600); err != nil {
		return BackupReport{}, fmt.Errorf("protect backup permissions: %w", err)
	}
	if err = syncFile(temporary); err != nil {
		return BackupReport{}, err
	}
	if err = os.Rename(temporary, destination); err != nil {
		return BackupReport{}, fmt.Errorf("publish backup: %w", err)
	}
	return VerifyBackup(ctx, destination)
}

func VerifyBackup(ctx context.Context, path string) (BackupReport, error) {
	path, err := cleanDatabasePath(path)
	if err != nil {
		return BackupReport{}, err
	}
	info, err := os.Stat(path)
	if err != nil {
		return BackupReport{}, fmt.Errorf("stat database: %w", err)
	}
	if !info.Mode().IsRegular() || info.Size() == 0 {
		return BackupReport{}, errors.New("database backup must be a non-empty regular file")
	}
	dsn := (&url.URL{Scheme: "file", Path: path, RawQuery: "mode=ro"}).String()
	database, err := sql.Open("sqlite", dsn)
	if err != nil {
		return BackupReport{}, fmt.Errorf("open backup read-only: %w", err)
	}
	defer database.Close()
	var result string
	if err = database.QueryRowContext(ctx, "PRAGMA quick_check").Scan(&result); err != nil {
		return BackupReport{}, fmt.Errorf("check backup integrity: %w", err)
	}
	if result != "ok" {
		return BackupReport{}, fmt.Errorf("SQLite quick_check failed: %s", result)
	}
	digest, err := fileDigest(path)
	if err != nil {
		return BackupReport{}, err
	}
	return BackupReport{Path: path, Size: info.Size(), SHA256: digest, CreatedAt: info.ModTime().UTC().Format(time.RFC3339Nano)}, nil
}

func RestoreBackup(ctx context.Context, source, target string) (RestoreReport, error) {
	sourceReport, err := VerifyBackup(ctx, source)
	if err != nil {
		return RestoreReport{}, fmt.Errorf("source backup is invalid: %w", err)
	}
	target, err = cleanDatabasePath(target)
	if err != nil {
		return RestoreReport{}, err
	}
	if sourceReport.Path == target {
		return RestoreReport{}, errors.New("source backup and target database must be different files")
	}
	if err = os.MkdirAll(filepath.Dir(target), 0750); err != nil {
		return RestoreReport{}, fmt.Errorf("create database directory: %w", err)
	}
	temporary := fmt.Sprintf("%s.restore-%d", target, time.Now().UnixNano())
	defer os.Remove(temporary)
	if err = snapshotDatabase(ctx, sourceReport.Path, temporary); err != nil {
		return RestoreReport{}, err
	}
	stagedReport, err := VerifyBackup(ctx, temporary)
	if err != nil {
		return RestoreReport{}, fmt.Errorf("verify staged restore: %w", err)
	}

	rollback := ""
	if _, statErr := os.Stat(target); statErr == nil {
		rollback = fmt.Sprintf("%s.rollback-%s", target, time.Now().UTC().Format("20060102T150405.000000000Z"))
		if err = os.Rename(target, rollback); err != nil {
			return RestoreReport{}, fmt.Errorf("preserve current database: %w", err)
		}
		movedSidecars := []string{}
		for _, suffix := range []string{"-wal", "-shm"} {
			if _, sidecarErr := os.Stat(target + suffix); sidecarErr == nil {
				if err = os.Rename(target+suffix, rollback+suffix); err != nil {
					_ = os.Rename(rollback, target)
					for _, moved := range movedSidecars {
						_ = os.Rename(rollback+moved, target+moved)
					}
					return RestoreReport{}, fmt.Errorf("preserve SQLite sidecar %s: %w", suffix, err)
				}
				movedSidecars = append(movedSidecars, suffix)
			}
		}
	} else if !errors.Is(statErr, os.ErrNotExist) {
		return RestoreReport{}, fmt.Errorf("inspect target database: %w", statErr)
	}
	if err = os.Rename(temporary, target); err != nil {
		if rollback != "" {
			_ = os.Rename(rollback, target)
			for _, suffix := range []string{"-wal", "-shm"} {
				_ = os.Rename(rollback+suffix, target+suffix)
			}
		}
		return RestoreReport{}, fmt.Errorf("activate restored database: %w", err)
	}
	return RestoreReport{DatabasePath: target, SourcePath: sourceReport.Path, RollbackPath: rollback, SHA256: stagedReport.SHA256, RestoredAt: time.Now().UTC().Format(time.RFC3339Nano)}, nil
}

func cleanDatabasePath(path string) (string, error) {
	if strings.TrimSpace(path) == "" {
		return "", errors.New("database path is required")
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("resolve database path: %w", err)
	}
	return filepath.Clean(absolute), nil
}

func snapshotDatabase(ctx context.Context, source, destination string) error {
	dsn := (&url.URL{Scheme: "file", Path: source, RawQuery: "mode=ro"}).String()
	database, err := sql.Open("sqlite", dsn)
	if err != nil {
		return fmt.Errorf("open restore source read-only: %w", err)
	}
	defer database.Close()
	if _, err = database.ExecContext(ctx, "VACUUM INTO ?", destination); err != nil {
		return fmt.Errorf("materialize restore snapshot: %w", err)
	}
	if err = os.Chmod(destination, 0600); err != nil {
		return fmt.Errorf("protect restored database permissions: %w", err)
	}
	return syncFile(destination)
}

func syncFile(path string) error {
	file, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		return fmt.Errorf("open backup for sync: %w", err)
	}
	defer file.Close()
	if err = file.Sync(); err != nil {
		return fmt.Errorf("sync backup: %w", err)
	}
	return nil
}

func fileDigest(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open database for checksum: %w", err)
	}
	defer file.Close()
	hash := sha256.New()
	if _, err = io.Copy(hash, file); err != nil {
		return "", fmt.Errorf("checksum database: %w", err)
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}
