package jira

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type DisabledSource struct{}

func (DisabledSource) Configured() bool { return false }
func (DisabledSource) Fetch(context.Context, time.Time) (Batch, error) {
	return Batch{}, ErrNotConfigured
}

type CloudConfig struct {
	BaseURL  string
	Email    string
	APIToken string
	JQL      string
}

type CloudSource struct {
	config CloudConfig
	client *http.Client
}

func NewCloudSource(config CloudConfig, client *http.Client) Source {
	config.BaseURL = strings.TrimRight(config.BaseURL, "/")
	if config.BaseURL == "" || config.Email == "" || config.APIToken == "" || config.JQL == "" {
		return DisabledSource{}
	}
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	return &CloudSource{config: config, client: client}
}

func (s *CloudSource) Configured() bool { return true }

type cloudSearchResponse struct {
	Issues []struct {
		Key    string `json:"key"`
		Fields struct {
			Summary   string `json:"summary"`
			IssueType struct {
				Name string `json:"name"`
			} `json:"issuetype"`
			Status struct {
				Name           string `json:"name"`
				StatusCategory struct {
					Key string `json:"key"`
				} `json:"statusCategory"`
			} `json:"status"`
			Assignee *struct {
				AccountID   string `json:"accountId"`
				DisplayName string `json:"displayName"`
			} `json:"assignee"`
			Priority *struct {
				Name string `json:"name"`
			} `json:"priority"`
			Project struct {
				Key string `json:"key"`
			} `json:"project"`
			Updated string  `json:"updated"`
			DueDate *string `json:"duedate"`
		} `json:"fields"`
		Changelog struct {
			Histories []struct {
				ID      string `json:"id"`
				Created string `json:"created"`
				Author  *struct {
					AccountID   string `json:"accountId"`
					DisplayName string `json:"displayName"`
				} `json:"author"`
				Items []struct {
					Field      string `json:"field"`
					FromString string `json:"fromString"`
					ToString   string `json:"toString"`
				} `json:"items"`
			} `json:"histories"`
		} `json:"changelog"`
	} `json:"issues"`
}

func (s *CloudSource) Fetch(ctx context.Context, since time.Time) (Batch, error) {
	endpoint, err := url.Parse(s.config.BaseURL + "/rest/api/3/search/jql")
	if err != nil {
		return Batch{}, err
	}
	query := endpoint.Query()
	query.Set("jql", s.config.JQL)
	query.Set("maxResults", "100")
	query.Set("expand", "changelog")
	query.Set("fields", "summary,issuetype,status,assignee,priority,project,updated,duedate")
	endpoint.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return Batch{}, err
	}
	req.SetBasicAuth(s.config.Email, s.config.APIToken)
	req.Header.Set("Accept", "application/json")
	response, err := s.client.Do(req)
	if err != nil {
		return Batch{}, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return Batch{}, fmt.Errorf("Jira search returned %s", response.Status)
	}
	var payload cloudSearchResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return Batch{}, fmt.Errorf("decode Jira response: %w", err)
	}
	return normalizeCloudResponse(payload, s.config.BaseURL, since), nil
}

func normalizeCloudResponse(payload cloudSearchResponse, baseURL string, since time.Time) Batch {
	batch := Batch{Issues: make([]IssueSnapshot, 0, len(payload.Issues))}
	for _, raw := range payload.Issues {
		var assigneeID, assigneeName, priority *string
		if raw.Fields.Assignee != nil {
			assigneeID = String(raw.Fields.Assignee.AccountID)
			assigneeName = String(raw.Fields.Assignee.DisplayName)
		}
		if raw.Fields.Priority != nil {
			priority = String(raw.Fields.Priority.Name)
		}
		issueURL := strings.TrimRight(baseURL, "/") + "/browse/" + url.PathEscape(raw.Key)
		issue := IssueSnapshot{
			IssueKey: raw.Key, Summary: raw.Fields.Summary, IssueType: raw.Fields.IssueType.Name,
			Status: raw.Fields.Status.Name, StatusCategory: raw.Fields.Status.StatusCategory.Key,
			AssigneeID: assigneeID, AssigneeName: assigneeName, Priority: priority,
			ProjectKey: raw.Fields.Project.Key, UpdatedAt: raw.Fields.Updated, DueDate: raw.Fields.DueDate,
			IssueURL: issueURL,
		}
		batch.Issues = append(batch.Issues, issue)
		if since.IsZero() {
			continue
		}
		for _, history := range raw.Changelog.Histories {
			created, err := parseJiraTime(history.Created)
			if err != nil || !created.After(since) {
				continue
			}
			for index, item := range history.Items {
				if !strings.EqualFold(item.Field, "status") {
					continue
				}
				var authorID, authorName *string
				if history.Author != nil {
					authorID = String(history.Author.AccountID)
					authorName = String(history.Author.DisplayName)
				}
				batch.Events = append(batch.Events, ActivityEvent{
					EventID: fmt.Sprintf("%s:%s:%d", raw.Key, history.ID, index), IssueKey: raw.Key,
					AuthorID: authorID, AuthorName: authorName, AssigneeID: assigneeID, AssigneeName: assigneeName,
					Action: "MOVED", PreviousStatus: String(item.FromString), NewStatus: String(item.ToString),
					CurrentStatus: String(raw.Fields.Status.Name), OccurredAt: created.UTC().Format(time.RFC3339Nano),
					IssueSummary: raw.Fields.Summary, IssueURL: issueURL,
				})
			}
		}
	}
	return batch
}

func parseJiraTime(value string) (time.Time, error) {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.000-0700", "2006-01-02T15:04:05-0700"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported Jira timestamp %q", value)
}
