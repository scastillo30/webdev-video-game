package jira

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

type envelope struct {
	Type string
	ID   string
	Data any
}

type Service struct {
	source       Source
	repository   Repository
	pollInterval time.Duration
	mu           sync.Mutex
	subscribers  map[chan envelope]struct{}
}

func NewService(source Source, repository Repository, pollInterval time.Duration) *Service {
	if pollInterval < 10*time.Second {
		pollInterval = 60 * time.Second
	}
	return &Service{source: source, repository: repository, pollInterval: pollInterval, subscribers: map[chan envelope]struct{}{}}
}

func (s *Service) Start(ctx context.Context) {
	go func() {
		s.poll(ctx)
		ticker := time.NewTicker(s.pollInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.poll(ctx)
			}
		}
	}()
}

func (s *Service) poll(ctx context.Context) {
	now := time.Now().UTC()
	attempt := now.Format(time.RFC3339Nano)
	previous, err := s.repository.JiraSnapshot(ctx, 1)
	if err != nil {
		log.Printf("read Jira sync state: %v", err)
		return
	}
	var since time.Time
	if previous.Connection.LastSuccessAt != nil {
		since, _ = time.Parse(time.RFC3339Nano, *previous.Connection.LastSuccessAt)
	}
	batch, err := s.source.Fetch(ctx, since)
	if err != nil {
		state := Connection{State: "reconnecting", Configured: s.source.Configured(), LastAttemptAt: &attempt, LastSuccessAt: previous.Connection.LastSuccessAt, Message: err.Error()}
		if errors.Is(err, ErrNotConfigured) {
			state.State = "disconnected"
		}
		if storeErr := s.repository.SetJiraConnection(ctx, state); storeErr != nil {
			log.Printf("store Jira connection state: %v", storeErr)
			return
		}
		s.publish(envelope{Type: "connection", Data: state})
		return
	}
	success := time.Now().UTC().Format(time.RFC3339Nano)
	state := Connection{State: "live", Configured: true, LastAttemptAt: &attempt, LastSuccessAt: &success, Message: "Jira connected"}
	accepted, err := s.repository.ApplyJiraBatch(ctx, batch, state)
	if err != nil {
		log.Printf("apply Jira batch: %v", err)
		return
	}
	s.publish(envelope{Type: "connection", Data: state})
	for _, event := range accepted {
		s.publish(envelope{Type: "activity", ID: event.EventID, Data: event})
	}
}

func (s *Service) SnapshotHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	snapshot, err := s.repository.JiraSnapshot(r.Context(), 100)
	if err != nil {
		http.Error(w, `{"error":"snapshot unavailable"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(snapshot)
}

func (s *Service) EventsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	channel := s.subscribe()
	defer s.unsubscribe(channel)
	if snapshot, err := s.repository.JiraSnapshot(r.Context(), 100); err == nil {
		_ = writeEvent(w, envelope{Type: "snapshot", Data: snapshot})
		flusher.Flush()
	}
	keepAlive := time.NewTicker(20 * time.Second)
	defer keepAlive.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case event := <-channel:
			if writeEvent(w, event) != nil {
				return
			}
			flusher.Flush()
		case <-keepAlive.C:
			_, _ = fmt.Fprint(w, ": keep-alive\n\n")
			flusher.Flush()
		}
	}
}

func writeEvent(w http.ResponseWriter, event envelope) error {
	data, err := json.Marshal(event.Data)
	if err != nil {
		return err
	}
	if event.ID != "" {
		if _, err = fmt.Fprintf(w, "id: %s\n", event.ID); err != nil {
			return err
		}
	}
	_, err = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, data)
	return err
}

func (s *Service) subscribe() chan envelope {
	channel := make(chan envelope, 32)
	s.mu.Lock()
	s.subscribers[channel] = struct{}{}
	s.mu.Unlock()
	return channel
}

func (s *Service) unsubscribe(channel chan envelope) {
	s.mu.Lock()
	delete(s.subscribers, channel)
	s.mu.Unlock()
}

func (s *Service) publish(event envelope) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for channel := range s.subscribers {
		select {
		case channel <- event:
		default:
			// A slow display can recover from the next snapshot instead of blocking ingestion.
		}
	}
}
