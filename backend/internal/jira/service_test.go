package jira

import (
	"context"
	"errors"
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
