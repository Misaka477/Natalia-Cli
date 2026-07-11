package soul

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aquama/natalia-cli/internal/chat"
	"github.com/aquama/natalia-cli/internal/compaction"
	"github.com/aquama/natalia-cli/internal/llm"
	"github.com/aquama/natalia-cli/internal/mode"
	"github.com/aquama/natalia-cli/internal/toolset"
)

type snapshotStub struct {
	rolledBackTo int
}

func (s *snapshotStub) Checkpoint(int, []string) (string, error) { return "", nil }
func (s *snapshotStub) Rollback(step int) error {
	s.rolledBackTo = step
	return nil
}

func TestRollbackToRestoresContext(t *testing.T) {
	engine := NewEngine(nil, toolset.NewRegistry())
	snapshotter := &snapshotStub{}
	engine.Snapshotter = snapshotter
	engine.Context.Messages = append(engine.Context.Messages, chat.Message{Role: chat.RoleUser, Content: "before"})
	engine.Context.StepCount = 1
	engine.Context.SaveCheckpoint()
	engine.Context.Messages = append(engine.Context.Messages, chat.Message{Role: chat.RoleAssistant, Content: "after"})
	engine.Context.StepCount = 2

	if _, err := engine.RollbackTo(1); err != nil {
		t.Fatalf("RollbackTo failed: %v", err)
	}
	if snapshotter.rolledBackTo != 1 || engine.Context.StepCount != 1 || len(engine.Context.Messages) != 1 {
		t.Fatalf("rollback did not restore state: snapshot=%d step=%d messages=%v", snapshotter.rolledBackTo, engine.Context.StepCount, engine.Context.Messages)
	}
}

type eventTool struct{}

func (eventTool) Name() string                                { return "event_tool" }
func (eventTool) Description() string                         { return "event test tool" }
func (eventTool) Execute(args map[string]any) (string, error) { return "tool ok", nil }
func (eventTool) Parameters() map[string]llm.Property         { return nil }
func (eventTool) Required() []string                          { return nil }

type namedTool string

func (n namedTool) Name() string                                { return string(n) }
func (n namedTool) Description() string                         { return string(n) + " test tool" }
func (n namedTool) Execute(args map[string]any) (string, error) { return "ok", nil }
func (n namedTool) Parameters() map[string]llm.Property         { return nil }
func (n namedTool) Required() []string                          { return nil }

func TestExecuteToolCallEmitsEvents(t *testing.T) {
	tools := toolset.NewRegistry()
	tools.Register(eventTool{})
	engine := NewEngine(nil, tools)

	var calls []ToolCallEvent
	var results []ToolResultEvent
	engine.OnToolCall = func(event ToolCallEvent) { calls = append(calls, event) }
	engine.OnToolResult = func(event ToolResultEvent) { results = append(results, event) }

	err := engine.executeToolCall(chat.ToolCall{
		ID:   "tc_1",
		Type: "function",
		Function: chat.ToolCallFunc{
			Name:      "event_tool",
			Arguments: `{"path":"test.txt"}`,
		},
	})
	if err != nil {
		t.Fatalf("executeToolCall failed: %v", err)
	}
	if len(calls) != 1 || calls[0].ID != "tc_1" || calls[0].Name != "event_tool" || calls[0].Arguments["path"] != "test.txt" {
		t.Fatalf("unexpected tool call events: %+v", calls)
	}
	if len(results) != 1 || results[0].ToolCallID != "tc_1" || results[0].Name != "event_tool" || results[0].Content != "tool ok" || results[0].Error != "" {
		t.Fatalf("unexpected tool result events: %+v", results)
	}
}

func TestGetToolDefsRespectsModeFilter(t *testing.T) {
	tools := toolset.NewRegistry()
	tools.Register(namedTool("read_file"))
	tools.Register(namedTool("write_file"))
	engine := NewEngine(nil, tools)
	engine.Mode = &mode.Mode{Name: "read_only_test", ToolFilter: func(name string, args map[string]any) bool {
		return name == "read_file"
	}}

	defs := engine.getToolDefs()
	if len(defs) != 1 || defs[0].Function.Name != "read_file" {
		t.Fatalf("expected only read_file schema, got %+v", defs)
	}
}

func TestAgentLoopEmitsCompactionLifecycleCallbacks(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read request body: %v", err)
		}
		var req llm.ChatRequest
		if err := json.Unmarshal(body, &req); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		content := "final"
		if len(req.Messages) > 0 && req.Messages[0].Role == chat.RoleSystem && req.Messages[0].Content == "You are a helpful assistant that compacts conversation context." {
			content = "compact summary"
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": content}}},
			"usage":   map[string]any{"completion_tokens": 2, "total_tokens": 3},
		})
	}))
	defer server.Close()

	engine := NewEngine(llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock"}), toolset.NewRegistry())
	engine.Compactor = compaction.NewSimpleCompaction()
	engine.MaxContextSize = 10
	engine.CompactRatio = 0.5
	engine.AutoCompact = true
	engine.Context.MaxSteps = 1
	engine.Context.Messages = append(engine.Context.Messages,
		chat.Message{Role: chat.RoleUser, Content: "first message with enough content to compact"},
		chat.Message{Role: chat.RoleAssistant, Content: "second message with enough content to compact"},
		chat.Message{Role: chat.RoleUser, Content: "third message with enough content to compact"},
	)

	var events []string
	engine.OnCompactBegin = func() { events = append(events, "compact_begin") }
	engine.OnCompactEnd = func() { events = append(events, "compact_end") }
	engine.OnStepBegin = func(int) { events = append(events, "step_begin") }

	outcome := engine.agentLoop()
	if outcome.StopReason != "no_tool_calls" || outcome.FinalMessage != "final" {
		t.Fatalf("unexpected outcome: %+v", outcome)
	}
	want := []string{"compact_begin", "compact_end", "step_begin"}
	if len(events) != len(want) {
		t.Fatalf("expected events %v, got %v", want, events)
	}
	for i := range want {
		if events[i] != want[i] {
			t.Fatalf("expected events %v, got %v", want, events)
		}
	}
}
