package workflow

import (
	"fmt"
	"sync"
	"time"
)

type EventType string

const (
	EventRunStarted        EventType = "run_started"
	EventStepStarted       EventType = "step_started"
	EventStepCompleted     EventType = "step_completed"
	EventStepFailed        EventType = "step_failed"
	EventRunCompleted      EventType = "run_completed"
	EventRunFailed         EventType = "run_failed"
	EventRunCancelled      EventType = "run_cancelled"
	EventActivityScheduled EventType = "activity_scheduled"
	EventActivityCompleted EventType = "activity_completed"
	EventActivityFailed    EventType = "activity_failed"
)

type Event struct {
	ID        string    `json:"id"`
	RunID     string    `json:"run_id"`
	Type      EventType `json:"type"`
	Timestamp time.Time `json:"timestamp"`
	Data      any       `json:"data,omitempty"`
}

type EventStore interface {
	Append(event Event) error
	GetEvents(runID string) ([]Event, error)
	GetLatest(runID string) (Event, error)
}

type MemoryEventStore struct {
	mu     sync.Mutex
	events map[string][]Event
}

func NewMemoryEventStore() *MemoryEventStore {
	return &MemoryEventStore{
		events: make(map[string][]Event),
	}
}

func (s *MemoryEventStore) Append(event Event) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events[event.RunID] = append(s.events[event.RunID], event)
	return nil
}

func (s *MemoryEventStore) GetEvents(runID string) ([]Event, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	events := s.events[runID]
	result := make([]Event, len(events))
	copy(result, events)
	return result, nil
}

func (s *MemoryEventStore) GetLatest(runID string) (Event, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	events := s.events[runID]
	if len(events) == 0 {
		return Event{}, fmt.Errorf("no events for run %s", runID)
	}
	return events[len(events)-1], nil
}
