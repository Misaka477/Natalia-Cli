package worker

import (
	"testing"
	"time"
)

func TestNewWorker(t *testing.T) {
	w := &Worker{
		ID:        "w1",
		Rule:      "code",
		Task:      "test",
		Status:    StatusIdle,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if w.ID != "w1" {
		t.Errorf("expected w1, got %s", w.ID)
	}
	if w.Status != StatusIdle {
		t.Errorf("expected idle, got %s", w.Status)
	}
}

func TestPoolNew(t *testing.T) {
	p := NewPool()
	if p == nil {
		t.Fatal("pool should not be nil")
	}
}

func TestPoolList(t *testing.T) {
	p := NewPool()
	list := p.List()
	if len(list) != 0 {
		t.Errorf("expected empty list, got %d", len(list))
	}
}

func TestPoolGetNonExistent(t *testing.T) {
	p := NewPool()
	w := p.Get("nonexistent")
	if w != nil {
		t.Error("expected nil for nonexistent worker")
	}
}

func TestStatusTransition(t *testing.T) {
	w := &Worker{Status: StatusIdle}
	if w.GetStatus() != StatusIdle {
		t.Error("expected idle")
	}
	w.Status = StatusRunning
	if w.GetStatus() != StatusRunning {
		t.Error("expected running")
	}
}

func TestLogEntry(t *testing.T) {
	w := &Worker{}
	w.addLog(LogEntry{
		Step: 1,
		Tool: "read_file",
	})
	w.addLog(LogEntry{
		Step: 2,
		Tool: "write_file",
	})
	logs := w.GetLogs()
	if len(logs) != 2 {
		t.Fatalf("expected 2 logs, got %d", len(logs))
	}
	if logs[0].Tool != "read_file" {
		t.Errorf("expected read_file, got %s", logs[0].Tool)
	}
	if logs[1].Tool != "write_file" {
		t.Errorf("expected write_file, got %s", logs[1].Tool)
	}
}

func TestStopResumeWorker(t *testing.T) {
	w := &Worker{Status: StatusRunning}
	w.Stop() // no-op since cancel is nil, but should not panic
	if w.Status != StatusRunning {
		t.Error("status should remain running (cancel is nil)")
	}
	w.Resume() // should not panic
}

func TestParseArgs(t *testing.T) {
	m := parseArgs(`{"path": "test.txt"}`)
	if m == nil {
		t.Error("expected non-nil map")
	}
}
