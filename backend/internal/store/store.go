package store

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	_ "modernc.org/sqlite"
	"sort"
	"strings"
	"time"
)

//go:embed migrations/*.sql
var migrations embed.FS

type Character struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Role             string  `json:"role"`
	Epithet          string  `json:"epithet"`
	Bio              string  `json:"bio"`
	Accent           string  `json:"accent"`
	AnimationPath    string  `json:"animationPath"`
	PosterPath       string  `json:"posterPath"`
	ThumbPath        string  `json:"thumbPath"`
	CommentThumbPath string  `json:"commentThumbPath"`
	JiraActivityURL  *string `json:"jiraActivityUrl"`
	WorkEmail        *string `json:"workEmail"`
	LinkedLogin      *string `json:"linkedLoginUsername"`
}
type Store struct{ db *sql.DB }

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err = db.Exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;"); err != nil {
		return nil, err
	}
	if err = applyMigrations(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}
func (s *Store) Close() error                   { return s.db.Close() }
func (s *Store) Ping(ctx context.Context) error { return s.db.PingContext(ctx) }

func applyMigrations(db *sql.DB) error {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}
	entries, err := migrations.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)
	for _, name := range names {
		var applied int
		if err := db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE version=?", name).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if applied > 0 {
			continue
		}
		body, err := migrations.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("begin migration %s: %w", name, err)
		}
		if _, err = tx.Exec(string(body)); err == nil {
			_, err = tx.Exec("INSERT INTO schema_migrations(version) VALUES(?)", name)
		}
		if err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if err = tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %s: %w", name, err)
		}
	}
	return nil
}

const fields = "id,name,role,epithet,bio,accent,animation_path,poster_path,thumb_path,comment_thumb_path,jira_activity_url,work_email,linked_login_username"

func scan(scanner interface{ Scan(...any) error }) (Character, error) {
	var c Character
	var activityURL, workEmail, linkedLogin sql.NullString
	err := scanner.Scan(&c.ID, &c.Name, &c.Role, &c.Epithet, &c.Bio, &c.Accent, &c.AnimationPath, &c.PosterPath, &c.ThumbPath, &c.CommentThumbPath, &activityURL, &workEmail, &linkedLogin)
	c.JiraActivityURL, c.WorkEmail, c.LinkedLogin = ptr(activityURL), ptr(workEmail), ptr(linkedLogin)
	return c, err
}
func (s *Store) List() ([]Character, error) {
	rows, err := s.db.Query("SELECT " + fields + " FROM characters ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Character{}
	for rows.Next() {
		c, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
func (s *Store) Get(id string) (Character, error) {
	return scan(s.db.QueryRow("SELECT "+fields+" FROM characters WHERE id=?", id))
}
func (s *Store) Create(c Character) (Character, error) {
	if c.ID == "" || c.Name == "" || c.Role == "" {
		return c, errors.New("id, name and role are required")
	}
	_, err := s.db.Exec("INSERT INTO characters(id,name,role,epithet,bio,accent,animation_path,poster_path,thumb_path,comment_thumb_path,jira_activity_url,work_email,linked_login_username) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", c.ID, c.Name, c.Role, c.Epithet, c.Bio, c.Accent, c.AnimationPath, c.PosterPath, c.ThumbPath, c.CommentThumbPath, nullable(c.JiraActivityURL), nullable(c.WorkEmail), nullable(c.LinkedLogin))
	return c, err
}
func (s *Store) Update(id string, c Character) (Character, error) {
	c.ID = id
	result, err := s.db.Exec("UPDATE characters SET name=?,role=?,epithet=?,bio=?,accent=?,animation_path=?,poster_path=?,thumb_path=?,comment_thumb_path=?,jira_activity_url=?,work_email=?,linked_login_username=?,updated_at=? WHERE id=?", c.Name, c.Role, c.Epithet, c.Bio, c.Accent, c.AnimationPath, c.PosterPath, c.ThumbPath, c.CommentThumbPath, nullable(c.JiraActivityURL), nullable(c.WorkEmail), nullable(c.LinkedLogin), time.Now().UTC().Format(time.RFC3339), id)
	if err != nil {
		return c, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return c, sql.ErrNoRows
	}
	return c, nil
}

func nullable(value *string) any {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil
	}
	return strings.TrimSpace(*value)
}
func (s *Store) Delete(id string) error {
	result, err := s.db.Exec("DELETE FROM characters WHERE id=?", id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
