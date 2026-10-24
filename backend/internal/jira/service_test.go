package jira

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type failingSource struct{ configured bool }

func (source failingSource) Configured() bool { return source.configured }
func (failingSource) Fetch(context.Context, time.Time) (Batch, error) {
	return Batch{}, errors.New("temporary Jira outage")
}

type memoryRepository struct {
	snapshot   Snapshot
	connection Connection
}

func (repository *memoryRepository) ApplyJiraBatch(context.Context, Batch, Connection) ([]ActivityEvent, error) {
	return nil, nil
}
func (repository *memoryRepository) SetJiraConnection(_ context.Context, connection Connection) error {
	repository.connection = connection
	return nil
}
func (repository *memoryRepository) JiraSnapshot(context.Context, int) (Snapshot, error) {
	return repository.snapshot, nil
}

func TestPollKeepsCachedDataExplicitlyStale(t *testing.T) {
	lastSuccess := time.Now().Add(-time.Minute).UTC().Format(time.RFC3339Nano)
	repository := &memoryRepository{snapshot: Snapshot{Connection: Connection{State: "live", Configured: true, LastSuccessAt: &lastSuccess}}}
	service := NewService(failingSource{configured: true}, repository, 60*time.Second)
	service.poll(context.Background())
	if repository.connection.State != "stale" || repository.connection.LastSuccessAt == nil {
		t.Fatalf("expected cached Jira state to be marked stale, got %#v", repository.connection)
	}
	diagnostics := service.Diagnostics()
	if diagnostics.PollCount != 1 || diagnostics.FailedPolls != 1 || diagnostics.SuccessfulPolls != 0 {
		t.Fatalf("unexpected poll diagnostics: %#v", diagnostics)
	}
}

func TestPollIntervalIsBoundedAndUpdateable(t *testing.T) {
	service := NewService(failingSource{}, &memoryRepository{}, time.Second)
	if service.currentPollInterval() != 60*time.Second {
		t.Fatalf("unsafe short interval was not normalized: %s", service.currentPollInterval())
	}
	service.SetPollInterval(30 * time.Second)
	if service.currentPollInterval() != 30*time.Second {
		t.Fatalf("interval update was not applied: %s", service.currentPollInterval())
	}
	service.SetPollInterval(2 * time.Hour)
	if service.currentPollInterval() != time.Hour {
		t.Fatalf("interval cap was not applied: %s", service.currentPollInterval())
	}
}

func TestDiagnosticsAndManualRefreshHandler(t *testing.T) {
	repository := &memoryRepository{snapshot: Snapshot{Connection: Connection{State: "disconnected"}}}
	service := NewService(DisabledSource{}, repository, 45*time.Second)
	channel := service.subscribe()
	defer service.unsubscribe(channel)
	before := service.Diagnostics()
	if before.PollIntervalSeconds != 45 || before.SubscriberCount != 1 {
		t.Fatalf("unexpected diagnostics before refresh: %#v", before)
	}
	response := httptest.NewRecorder()
	service.RefreshHandler(response, httptest.NewRequest(http.MethodPost, "/api/jira/refresh", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("manual refresh returned %d: %s", response.Code, response.Body.String())
	}
	after := service.Diagnostics()
	if after.PollCount != 1 || after.FailedPolls != 0 || after.SkippedPolls != 1 {
		t.Fatalf("manual refresh was not recorded: %#v", after)
	}
	response = httptest.NewRecorder()
	service.RefreshHandler(response, httptest.NewRequest(http.MethodGet, "/api/jira/refresh", nil))
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("GET refresh returned %d", response.Code)
	}
}
