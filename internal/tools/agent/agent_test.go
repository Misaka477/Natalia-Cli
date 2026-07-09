package agent

import (
	"testing"
)

func TestSpawnName(t *testing.T) {
	s := &Spawn{}
	if s.Name() != "agent_spawn" {
		t.Errorf("expected agent_spawn, got %s", s.Name())
	}
}

func TestListName(t *testing.T) {
	l := &List{}
	if l.Name() != "agent_list" {
		t.Errorf("expected agent_list, got %s", l.Name())
	}
}

func TestOutputName(t *testing.T) {
	o := &Output{}
	if o.Name() != "agent_output" {
		t.Errorf("expected agent_output, got %s", o.Name())
	}
}

func TestSpawnWithoutPool(t *testing.T) {
	s := &Spawn{}
	// Without pool, Execute would fail
	_, err := s.Execute(map[string]any{"task": "test"})
	if err == nil {
		t.Error("expected error (pool is nil)")
	}
}

func TestOutputWithoutPool(t *testing.T) {
	o := &Output{}
	_, err := o.Execute(map[string]any{"agent_id": "w1"})
	if err == nil {
		t.Error("expected error (pool is nil)")
	}
}

func TestTruncate(t *testing.T) {
	if truncate("hello", 3) != "he…" {
		t.Errorf("expected 'hel…', got %s", truncate("hello", 3))
	}
	if truncate("hi", 3) != "hi" {
		t.Errorf("expected 'hi', got %s", truncate("hi", 3))
	}
}

func TestSpawnMissingTask(t *testing.T) {
	s := &Spawn{}
	_, err := s.Execute(map[string]any{})
	if err == nil {
		t.Error("expected error for missing task")
	}
}

func TestOutputMissingID(t *testing.T) {
	o := &Output{}
	_, err := o.Execute(map[string]any{})
	if err == nil {
		t.Error("expected error for missing agent_id")
	}
}
