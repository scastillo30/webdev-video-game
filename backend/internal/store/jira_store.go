package store

import (
	"context"
	"database/sql"
	"time"
	"webdev-mmorpg/backend/internal/jira"
)

func (s *Store) ApplyJiraBatch(ctx context.Context, batch jira.Batch, connection jira.Connection) ([]jira.ActivityEvent, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	observedAt := time.Now().UTC().Format(time.RFC3339Nano)
	for _, issue := range batch.Issues {
		_, err = tx.ExecContext(ctx, `INSERT INTO jira_issue_snapshots(
			issue_key,summary,issue_type,status,status_category,assignee_id,assignee_name,priority,project_key,updated_at,due_date,issue_url,observed_at
		) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(issue_key) DO UPDATE SET
			summary=excluded.summary,issue_type=excluded.issue_type,status=excluded.status,status_category=excluded.status_category,
			assignee_id=excluded.assignee_id,assignee_name=excluded.assignee_name,priority=excluded.priority,project_key=excluded.project_key,
			updated_at=excluded.updated_at,due_date=excluded.due_date,issue_url=excluded.issue_url,observed_at=excluded.observed_at`,
			issue.IssueKey, issue.Summary, issue.IssueType, issue.Status, issue.StatusCategory, issue.AssigneeID, issue.AssigneeName,
			issue.Priority, issue.ProjectKey, issue.UpdatedAt, issue.DueDate, issue.IssueURL, observedAt)
		if err != nil {
			return nil, err
		}
	}
	accepted := make([]jira.ActivityEvent, 0, len(batch.Events))
	for _, event := range batch.Events {
		result, insertErr := tx.ExecContext(ctx, `INSERT OR IGNORE INTO jira_activity_events(
			event_id,issue_key,author_id,author_name,assignee_id,assignee_name,action,previous_status,new_status,current_status,occurred_at,issue_summary,issue_url
		) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, event.EventID, event.IssueKey, event.AuthorID, event.AuthorName, event.AssigneeID,
			event.AssigneeName, event.Action, event.PreviousStatus, event.NewStatus, event.CurrentStatus, event.OccurredAt,
			event.IssueSummary, event.IssueURL)
		if insertErr != nil {
			return nil, insertErr
		}
		if rows, _ := result.RowsAffected(); rows == 1 {
			accepted = append(accepted, event)
		}
	}
	if err = setConnection(ctx, tx, connection); err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return accepted, nil
}

func (s *Store) SetJiraConnection(ctx context.Context, connection jira.Connection) error {
	_, err := s.db.ExecContext(ctx, `UPDATE jira_sync_state SET state=?,configured=?,last_attempt_at=?,last_success_at=?,message=? WHERE singleton=1`,
		connection.State, connection.Configured, connection.LastAttemptAt, connection.LastSuccessAt, connection.Message)
	return err
}

type sqlExecutor interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func setConnection(ctx context.Context, executor sqlExecutor, connection jira.Connection) error {
	_, err := executor.ExecContext(ctx, `UPDATE jira_sync_state SET state=?,configured=?,last_attempt_at=?,last_success_at=?,message=? WHERE singleton=1`,
		connection.State, connection.Configured, connection.LastAttemptAt, connection.LastSuccessAt, connection.Message)
	return err
}

func (s *Store) JiraSnapshot(ctx context.Context, limit int) (jira.Snapshot, error) {
	if limit < 1 || limit > 500 {
		limit = 100
	}
	snapshot := jira.Snapshot{Issues: []jira.IssueSnapshot{}, Events: []jira.ActivityEvent{}}
	rows, err := s.db.QueryContext(ctx, `SELECT issue_key,summary,issue_type,status,status_category,assignee_id,assignee_name,priority,project_key,updated_at,due_date,issue_url FROM jira_issue_snapshots ORDER BY updated_at DESC`)
	if err != nil {
		return snapshot, err
	}
	for rows.Next() {
		var issue jira.IssueSnapshot
		var assigneeID, assigneeName, priority, dueDate sql.NullString
		if err = rows.Scan(&issue.IssueKey, &issue.Summary, &issue.IssueType, &issue.Status, &issue.StatusCategory, &assigneeID, &assigneeName,
			&priority, &issue.ProjectKey, &issue.UpdatedAt, &dueDate, &issue.IssueURL); err != nil {
			rows.Close()
			return snapshot, err
		}
		issue.AssigneeID, issue.AssigneeName, issue.Priority, issue.DueDate = ptr(assigneeID), ptr(assigneeName), ptr(priority), ptr(dueDate)
		snapshot.Issues = append(snapshot.Issues, issue)
	}
	if err = rows.Close(); err != nil {
		return snapshot, err
	}
	rows, err = s.db.QueryContext(ctx, `SELECT event_id,issue_key,author_id,author_name,assignee_id,assignee_name,action,previous_status,new_status,current_status,occurred_at,issue_summary,issue_url FROM jira_activity_events ORDER BY occurred_at DESC LIMIT ?`, limit)
	if err != nil {
		return snapshot, err
	}
	for rows.Next() {
		var event jira.ActivityEvent
		var authorID, authorName, assigneeID, assigneeName, previousStatus, newStatus, currentStatus sql.NullString
		if err = rows.Scan(&event.EventID, &event.IssueKey, &authorID, &authorName, &assigneeID, &assigneeName, &event.Action,
			&previousStatus, &newStatus, &currentStatus, &event.OccurredAt, &event.IssueSummary, &event.IssueURL); err != nil {
			rows.Close()
			return snapshot, err
		}
		event.AuthorID, event.AuthorName = ptr(authorID), ptr(authorName)
		event.AssigneeID, event.AssigneeName = ptr(assigneeID), ptr(assigneeName)
		event.PreviousStatus, event.NewStatus, event.CurrentStatus = ptr(previousStatus), ptr(newStatus), ptr(currentStatus)
		snapshot.Events = append(snapshot.Events, event)
	}
	if err = rows.Close(); err != nil {
		return snapshot, err
	}
	var lastAttempt, lastSuccess sql.NullString
	if err = s.db.QueryRowContext(ctx, `SELECT state,configured,last_attempt_at,last_success_at,message FROM jira_sync_state WHERE singleton=1`).Scan(
		&snapshot.Connection.State, &snapshot.Connection.Configured, &lastAttempt, &lastSuccess, &snapshot.Connection.Message); err != nil {
		return snapshot, err
	}
	snapshot.Connection.LastAttemptAt, snapshot.Connection.LastSuccessAt = ptr(lastAttempt), ptr(lastSuccess)
	return snapshot, nil
}

func ptr(value sql.NullString) *string {
	if !value.Valid || value.String == "" {
		return nil
	}
	return &value.String
}
