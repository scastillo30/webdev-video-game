package jira

import (
	"context"
	"errors"
	"time"
)

var ErrNotConfigured = errors.New("Jira integration is not configured")

type IssueSnapshot struct {
	IssueKey       string  `json:"issueKey"`
	Summary        string  `json:"summary"`
	IssueType      string  `json:"issueType"`
	Status         string  `json:"status"`
	StatusCategory string  `json:"statusCategory"`
	AssigneeID     *string `json:"assigneeId"`
	AssigneeName   *string `json:"assigneeName"`
	Priority       *string `json:"priority"`
	ProjectKey     string  `json:"projectKey"`
	UpdatedAt      string  `json:"updatedAt"`
	DueDate        *string `json:"dueDate"`
	IssueURL       string  `json:"issueUrl"`
}

type ActivityEvent struct {
	EventID        string  `json:"eventId"`
	IssueKey       string  `json:"issueKey"`
	AuthorID       *string `json:"authorId"`
	AuthorName     *string `json:"authorName"`
	AssigneeID     *string `json:"assigneeId"`
	AssigneeName   *string `json:"assigneeName"`
	Action         string  `json:"action"`
	PreviousStatus *string `json:"previousStatus"`
	NewStatus      *string `json:"newStatus"`
	CurrentStatus  *string `json:"currentStatus"`
	OccurredAt     string  `json:"occurredAt"`
	IssueSummary   string  `json:"issueSummary"`
	IssueURL       string  `json:"issueUrl"`
}

type Batch struct {
	Issues []IssueSnapshot
	Events []ActivityEvent
}

type Connection struct {
	State         string  `json:"state"`
	Configured    bool    `json:"configured"`
	LastAttemptAt *string `json:"lastAttemptAt"`
	LastSuccessAt *string `json:"lastSuccessAt"`
	Message       string  `json:"message"`
}

type Snapshot struct {
	Issues     []IssueSnapshot `json:"issues"`
	Events     []ActivityEvent `json:"events"`
	Connection Connection      `json:"connection"`
}

type Source interface {
	Configured() bool
	Fetch(context.Context, time.Time) (Batch, error)
}

type Repository interface {
	ApplyJiraBatch(context.Context, Batch, Connection) ([]ActivityEvent, error)
	SetJiraConnection(context.Context, Connection) error
	JiraSnapshot(context.Context, int) (Snapshot, error)
}

func String(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
