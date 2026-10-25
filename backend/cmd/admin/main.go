package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
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
		return errors.New("usage: webdev-admin <backup|verify|restore> [options]")
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
	default:
		return fmt.Errorf("unknown command %q; use backup, verify, or restore", args[0])
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
