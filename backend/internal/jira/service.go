package jira

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

type envelope struct {
	Type string
	ID   string
	Data any
}

type Service struct {
	source          Source
	repository      Repository
	pollInterval    atomic.Int64
	intervalUpdates chan time.Duration
	mu              sync.Mutex
	subscribers     map[chan envelope]struct{}
}

func NewService(source Source, repository Repository, pollInterval time.Duration) *Service {
	service := &Service{source: source, repository: repository, intervalUpdates: make(chan time.Duration, 1), subscribers: map[chan envelope]struct{}{}}
	service.pollInterval.Store(int64(normalizePollInterval(pollInterval)))
	return service
}

func (s *Service) Start(ctx context.Context) {
	go func() {
		s.poll(ctx)
		timer := time.NewTimer(s.currentPollInterval())
		defer timer.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-timer.C:
				s.poll(ctx)
				timer.Reset(s.currentPollInterval())
			case interval := <-s.intervalUpdates:
				if !timer.Stop() {
					select {
					case <-timer.C:
					default:
					}
				}
				timer.Reset(interval)
			}
		}
	}()
}

func (s *Service) SetPollInterval(interval time.Duration) {
	interval = normalizePollInterval(interval)
	s.pollInterval.Store(int64(interval))
	select {
	case s.intervalUpdates <- interval:
	default:
		select {
		case <-s.intervalUpdates:
		default:
		}
		select {
		case s.intervalUpdates <- interval:
		default:
		}
	}
}

func (s *Service) currentPollInterval() time.Duration {
	return time.Duration(s.pollInterval.Load())
}

func normalizePollInterval(interval time.Duration) time.Duration {
	if interval < 10*time.Second {
		return 60 * time.Second
	}
	if interval > time.Hour {
		return time.Hour
	}
	return interval
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
		stateName := "reconnecting"
		if previous.Connection.LastSuccessAt != nil {
			stateName = "stale"
		}
		state := Connection{State: stateName, Configured: s.source.Configured(), LastAttemptAt: &attempt, LastSuccessAt: previous.Connection.LastSuccessAt, Message: err.Error()}
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
