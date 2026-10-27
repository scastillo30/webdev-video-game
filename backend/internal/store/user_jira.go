package store

import (
	"context"
	"database/sql"
	"strings"
	"time"
)

type EmployeeMatch struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	PhotoURL string `json:"photo_url"`
}

func normalizeIdentity(value string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(value))), " ")
}

func usernameKey(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if index := strings.IndexByte(value, '@'); index >= 0 {
		value = value[:index]
	}
	return value
}

func (s *Store) MatchEmployee(ctx context.Context, displayName, jiraUsername string) (*EmployeeMatch, error) {
	characters, err := s.List()
	if err != nil {
		return nil, err
	}
	normalizedName := normalizeIdentity(displayName)
	for _, character := range characters {
		if normalizedName != "" && normalizeIdentity(character.Name) == normalizedName {
			return employeeMatch(character), nil
		}
	}
	username := usernameKey(jiraUsername)
	if username == "" {
		return nil, nil
	}
	for _, character := range characters {
		nameParts := strings.Fields(normalizeIdentity(character.Name))
		firstLast := ""
		if len(nameParts) >= 2 {
			firstLast = nameParts[0] + "." + nameParts[len(nameParts)-1]
		}
		workEmail, linkedLogin := "", ""
		if character.WorkEmail != nil {
			workEmail = usernameKey(*character.WorkEmail)
		}
		if character.LinkedLogin != nil {
			linkedLogin = usernameKey(*character.LinkedLogin)
		}
		if username == workEmail || username == firstLast || username == linkedLogin {
			return employeeMatch(character), nil
		}
	}
	return nil, nil
}

func employeeMatch(character Character) *EmployeeMatch {
	photo := character.CommentThumbPath
	if photo == "" {
		photo = character.ThumbPath
	}
	return &EmployeeMatch{ID: character.ID, Name: character.Name, PhotoURL: photo}
}

func (s *Store) EmployeeByJiraAccount(ctx context.Context, accountKey string) (*EmployeeMatch, error) {
	var character Character
	query := `SELECT ` + fields + ` FROM characters c JOIN character_game_profiles p ON p.character_id=c.id WHERE lower(p.jira_account_id)=lower(?)`
	value, err := scan(s.db.QueryRowContext(ctx, query, strings.TrimSpace(accountKey)))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	character = value
	return employeeMatch(character), nil
}

func (s *Store) JiraUserDisplayName(ctx context.Context, userID, host, accountKey string) (string, bool, error) {
	var displayName string
	err := s.db.QueryRowContext(ctx, `SELECT display_name FROM jira_user_cache WHERE user_id=? AND host=? AND account_key=?`, userID, host, accountKey).Scan(&displayName)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	return displayName, err == nil, err
}

func (s *Store) SaveJiraUserDisplayName(ctx context.Context, userID, host, accountKey, displayName string) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO jira_user_cache(user_id,host,account_key,display_name,last_synced_at) VALUES(?,?,?,?,?)
		ON CONFLICT(user_id,host,account_key) DO UPDATE SET display_name=excluded.display_name,last_synced_at=excluded.last_synced_at`,
		userID, host, accountKey, displayName, time.Now().UTC().Format(time.RFC3339Nano))
	return err
}

func (s *Store) UserJiraLastSync(ctx context.Context, userID, host string) (*string, error) {
	var value string
	err := s.db.QueryRowContext(ctx, `SELECT last_sync_at FROM jira_user_sync WHERE user_id=? AND host=?`, userID, host).Scan(&value)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &value, nil
}

func (s *Store) RecordUserJiraSync(ctx context.Context, userID, host string, syncedAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO jira_user_sync(user_id,host,last_sync_at) VALUES(?,?,?)
		ON CONFLICT(user_id,host) DO UPDATE SET last_sync_at=excluded.last_sync_at`,
		userID, host, syncedAt.UTC().Format(time.RFC3339Nano))
	return err
}
