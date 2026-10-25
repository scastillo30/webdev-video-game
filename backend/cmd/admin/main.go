package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"time"
	"webdev-mmorpg/backend/internal/store"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: webdev-admin <backup|verify|restore|prune> [options]")
	}
	switch args[0] {
	case "backup":
		flags := flag.NewFlagSet("backup", flag.ContinueOnError)
		databasePath := flags.String("db", environment("DB_PATH", "data/game.db"), "SQLite database path")
		outputPath := flags.String("out", "", "new backup file path")
		if err := flags.Parse(args[1:]); err != nil {
			return err
		}
		if *outputPath == "" {
			return errors.New("backup requires --out <new-backup-file>")
		}
		if err := requireDatabase(*databasePath); err != nil {
			return err
		}
		database, err := store.Open(*databasePath)
		if err != nil {
			return err
		}
		defer database.Close()
		report, err := database.Backup(context.Background(), *outputPath)
		if err != nil {
			return err
		}
		return printJSON(report)
	case "verify":
		flags := flag.NewFlagSet("verify", flag.ContinueOnError)
		filePath := flags.String("file", "", "backup file path")
		if err := flags.Parse(args[1:]); err != nil {
			return err
		}
		if *filePath == "" {
			return errors.New("verify requires --file <backup-file>")
		}
		report, err := store.VerifyBackup(context.Background(), *filePath)
		if err != nil {
			return err
		}
		return printJSON(report)
	case "restore":
		flags := flag.NewFlagSet("restore", flag.ContinueOnError)
		databasePath := flags.String("db", environment("DB_PATH", "data/game.db"), "SQLite database path")
		backupPath := flags.String("from", "", "verified backup file path")
		confirmation := flags.String("confirm", "", "must be STOPPED after the server has been stopped")
		if err := flags.Parse(args[1:]); err != nil {
			return err
		}
		if *backupPath == "" {
			return errors.New("restore requires --from <backup-file>")
		}
		if *confirmation != "STOPPED" {
			return errors.New("stop the server, then pass --confirm STOPPED; restore preserves the current database as a rollback file")
		}
		report, err := store.RestoreBackup(context.Background(), *backupPath, *databasePath)
		if err != nil {
			return err
		}
		return printJSON(report)
	case "prune":
		flags := flag.NewFlagSet("prune", flag.ContinueOnError)
		databasePath := flags.String("db", environment("DB_PATH", "data/game.db"), "SQLite database path")
		eventDays := flags.Int("event-days", 180, "days of Jira activity events to retain")
		auditDays := flags.Int("audit-days", 365, "days of administrative audit to retain")
		dryRun := flags.Bool("dry-run", true, "preview candidate counts without deleting data")
		apply := flags.Bool("apply", false, "apply deletions after creating the required backup")
		backupPath := flags.String("backup", "", "new backup file required with --apply")
		confirmation := flags.String("confirm", "", "must be PRUNE when applying deletions")
		if err := flags.Parse(args[1:]); err != nil {
			return err
		}
		if err := requireDatabase(*databasePath); err != nil {
			return err
		}
		if *apply {
			if *confirmation != "PRUNE" {
				return errors.New("prune apply requires --confirm PRUNE")
			}
			if *backupPath == "" {
				return errors.New("prune apply requires --backup <new-backup-file>")
			}
		}
		database, err := store.Open(*databasePath)
		if err != nil {
			return err
		}
		defer database.Close()
		if !*apply {
			report, pruneErr := database.PruneOperationalData(context.Background(), *eventDays, *auditDays, time.Now(), true)
			if pruneErr != nil {
				return pruneErr
			}
			// The flag is retained for explicit, script-readable dry-run intent. A
			// destructive run still requires --apply regardless of this value.
			report.DryRun = *dryRun
			if !*dryRun {
				return errors.New("--dry-run=false does not delete data; pass --apply with backup and confirmation")
			}
			return printJSON(report)
		}
		backupReport, err := database.Backup(context.Background(), *backupPath)
		if err != nil {
			return err
		}
		report, err := database.PruneOperationalData(context.Background(), *eventDays, *auditDays, time.Now(), false)
		if err != nil {
			return err
		}
		return printJSON(struct {
			Backup      store.BackupReport      `json:"backup"`
			Maintenance store.MaintenanceReport `json:"maintenance"`
		}{Backup: backupReport, Maintenance: report})
	default:
		return fmt.Errorf("unknown command %q; use backup, verify, restore, or prune", args[0])
	}
}

func requireDatabase(path string) error {
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("source database does not exist: %s", path)
	}
	if err != nil {
		return fmt.Errorf("inspect source database: %w", err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("source database is not a regular file: %s", path)
	}
	return nil
}

func environment(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func printJSON(value any) error {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(value)
}
