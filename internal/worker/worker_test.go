package worker

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
)

type workerTool struct{}

func (workerTool) Name() string                                { return "read_file" }
func (workerTool) Description() string                         { return "echo test tool" }
func (workerTool) Execute(args map[string]any) (string, error) { return "worker-tool-ok", nil }
func (workerTool) Parameters() map[string]llm.Property         { return nil }
func (workerTool) Required() []string                          { return nil }

func TestPoolSpawnRunsToolCallAndCompletes(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		requestCount++
		var req llm.ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("decode request: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if requestCount == 1 {
			if len(req.Tools) != 1 || req.Tools[0].Function.Name != "read_file" {
				t.Errorf("worker did not expose expected tool schema: %+v", req.Tools)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"choices": []map[string]any{{"message": map[string]any{
					"role": "assistant",
					"tool_calls": []map[string]any{{
						"id":   "tc_echo",
						"type": "function",
						"function": map[string]any{
							"name":      "read_file",
							"arguments": `{"value":"ok"}`,
						},
					}},
				}}},
				"usage": map[string]any{"completion_tokens": 1, "total_tokens": 1},
			})
			return
		}
		toolResultSeen := false
		for _, msg := range req.Messages {
			if msg.Role == chat.RoleTool && msg.ToolCallID == "tc_echo" && strings.Contains(msg.Content, "worker-tool-ok") {
				toolResultSeen = true
			}
		}
		if !toolResultSeen {
			t.Errorf("worker second request missing tool result: %+v", req.Messages)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": "worker-final-ok"}}},
			"usage":   map[string]any{"completion_tokens": 1, "total_tokens": 2},
		})
	}))
	defer server.Close()

	tools := toolset.NewRegistry()
	tools.Register(workerTool{})
	pool := NewPool()
	w, err := pool.Spawn("run echo tool", "code", llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock", APIKey: "test"}), tools)
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, w, StatusCompleted)
	if got := pool.Get(w.ID); got != w {
		t.Fatalf("expected pool get to return spawned worker")
	}
	logs := w.GetLogs()
	if len(logs) < 2 || logs[0].Tool != "read_file" || logs[len(logs)-1].Result != "worker-final-ok" {
		t.Fatalf("expected tool and final result logs, got %+v", logs)
	}
	if requestCount < 2 {
		t.Fatalf("expected two LLM requests, got %d", requestCount)
	}
}

func TestPoolSubscribeReceivesWorkerEvents(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		if requestCount == 1 {
			_ = json.NewEncoder(w).Encode(map[string]any{"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "tool_calls": []map[string]any{{"id": "tc_read", "type": "function", "function": map[string]any{"name": "read_file", "arguments": `{}`}}}}}}})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": "done"}}}})
	}))
	defer server.Close()
	tools := toolset.NewRegistry()
	tools.Register(workerTool{})
	pool := NewPool()
	events := make(chan Event, 8)
	detach := pool.Subscribe(func(event Event) { events <- event })
	defer detach()
	w, err := pool.Spawn("subtask", "code", llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock", APIKey: "test"}), tools)
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, w, StatusCompleted)
	seenCreated, seenRunning, seenToolLog, seenCompleted := false, false, false, false
	deadline := time.After(time.Second)
	for !(seenCreated && seenRunning && seenToolLog && seenCompleted) {
		select {
		case event := <-events:
			if event.WorkerID != w.ID {
				t.Fatalf("unexpected worker id in event: %+v", event)
			}
			switch {
			case event.Event == "created":
				seenCreated = true
			case event.Event == "status" && event.Status == StatusRunning:
				seenRunning = true
			case event.Event == "status" && event.Status == StatusCompleted:
				seenCompleted = true
			case event.Event == "log" && event.Log != nil && event.Log.Tool == "read_file":
				seenToolLog = true
			}
		case <-deadline:
			t.Fatalf("timed out waiting for worker events: created=%t running=%t tool=%t completed=%t", seenCreated, seenRunning, seenToolLog, seenCompleted)
		}
	}
}

func TestPoolSpawnWithTimeoutFailsBlockedWorker(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": "late"}}}})
	}))
	defer server.Close()

	pool := NewPool()
	w, err := pool.SpawnWithOptions("blocked", "code", llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock", APIKey: "test"}), toolset.NewRegistry(), SpawnOptions{Timeout: 30 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, w, StatusFailed)
	logs := w.GetLogs()
	if len(logs) == 0 || !strings.Contains(logs[0].Error, "context deadline exceeded") {
		t.Fatalf("expected timeout error log, got %+v", logs)
	}
}

func TestParseArgs(t *testing.T) {
	m := parseArgs(`{"path": "test.txt", "count": 3}`)
	if m["path"] != "test.txt" {
		t.Fatalf("expected parsed path, got %v", m["path"])
	}
	if m["count"] != float64(3) {
		t.Fatalf("expected parsed count, got %v", m["count"])
	}
	if malformed := parseArgs("not-json"); malformed == nil || len(malformed) != 0 {
		t.Fatalf("expected empty map for malformed JSON, got %v", malformed)
	}
}

func TestWorkerStopTransitionsToStopped(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
	}))
	defer server.Close()
	defer close(release)
	pool := NewPool()
	w, err := pool.Spawn("block", "code", llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock", APIKey: "test"}), toolset.NewRegistry())
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, w, StatusRunning)
	w.Stop()
	waitForStatus(t, w, StatusStopped)
	if err := w.Resume(); err == nil || !strings.Contains(err.Error(), "only paused workers") {
		t.Fatalf("expected stopped worker resume rejection, got %v", err)
	}
}

func TestPoolCleanupRemovesCompletedWorkers(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": "done"}}}})
	}))
	defer server.Close()
	pool := NewPool()
	w, err := pool.Spawn("cleanup test", "code", llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock", APIKey: "test"}), toolset.NewRegistry())
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, w, StatusCompleted)
	affected := pool.Cleanup()
	if len(affected) != 1 || affected[0] != w.ID {
		t.Fatalf("expected cleanup to remove one worker, got %v", affected)
	}
	if pool.Get(w.ID) != nil {
		t.Fatal("expected worker to be removed after cleanup")
	}
}

func TestPoolAuditLogStoresEvents(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": "done"}}}})
	}))
	defer server.Close()
	pool := NewPool()
	w, err := pool.Spawn("audit test", "code", llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock", APIKey: "test"}), toolset.NewRegistry())
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, w, StatusCompleted)
	entries := pool.AuditLog()
	if len(entries) < 2 {
		t.Fatalf("expected at least 2 audit entries, got %d", len(entries))
	}
	if entries[0].Event != "created" || entries[0].WorkerID != w.ID {
		t.Fatalf("expected created event, got %+v", entries[0])
	}
	seenCompleted := false
	for _, e := range entries {
		if e.Event == "status" && e.Status == StatusCompleted && e.WorkerID == w.ID {
			seenCompleted = true
		}
	}
	if !seenCompleted {
		t.Fatalf("expected completed status event in audit log, got %+v", entries)
	}
}

func TestPoolRemoveWorker(t *testing.T) {
	pool := NewPool()
	w, err := pool.SpawnWithOptions("remove test", "code", nil, toolset.NewRegistry(), SpawnOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !pool.Remove(w.ID) {
		t.Fatal("expected Remove to return true for existing worker")
	}
	if pool.Remove("nonexistent") {
		t.Fatal("expected Remove to return false for nonexistent worker")
	}
	if pool.Get(w.ID) != nil {
		t.Fatal("expected worker to be removed")
	}
}

func TestPoolStatusReturnsWorker(t *testing.T) {
	pool := NewPool()
	w, err := pool.SpawnWithOptions("status test", "code", nil, toolset.NewRegistry(), SpawnOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if got := pool.Status(w.ID); got != w {
		t.Fatal("expected Status to return the same worker")
	}
	if pool.Status("nonexistent") != nil {
		t.Fatal("expected Status to return nil for nonexistent")
	}
}

func waitForStatus(t *testing.T, w *Worker, status Status) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if w.GetStatus() == status {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s, got %s", status, w.GetStatus())
}
