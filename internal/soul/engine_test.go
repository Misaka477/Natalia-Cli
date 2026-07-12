package soul

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/aquama/natalia-cli/internal/approval"
	"github.com/aquama/natalia-cli/internal/chat"
	"github.com/aquama/natalia-cli/internal/compaction"
	"github.com/aquama/natalia-cli/internal/display"
	"github.com/aquama/natalia-cli/internal/llm"
	"github.com/aquama/natalia-cli/internal/mode"
	filetool "github.com/aquama/natalia-cli/internal/tools/file"
	shelltool "github.com/aquama/natalia-cli/internal/tools/shell"
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

type richEventTool struct{}

func (richEventTool) Name() string                                { return "rich_event_tool" }
func (richEventTool) Description() string                         { return "rich event test tool" }
func (richEventTool) Execute(args map[string]any) (string, error) { return "legacy", nil }
func (richEventTool) Parameters() map[string]llm.Property         { return nil }
func (richEventTool) Required() []string                          { return nil }
func (richEventTool) ExecuteReturn(args map[string]any) (toolset.ToolReturn, error) {
	block, err := display.NewBlock(display.BlockDiff, "patch", display.DiffBlock{Path: "main.go", Diff: "--- a/main.go"})
	if err != nil {
		return toolset.ToolReturn{}, err
	}
	return toolset.ToolReturn{ModelText: "model summary", Display: []display.Block{block}}, nil
}

type namedTool string

func (n namedTool) Name() string                                { return string(n) }
func (n namedTool) Description() string                         { return string(n) + " test tool" }
func (n namedTool) Execute(args map[string]any) (string, error) { return "ok", nil }
func (n namedTool) Parameters() map[string]llm.Property         { return nil }
func (n namedTool) Required() []string                          { return nil }

type largeResultTool struct{}

func (largeResultTool) Name() string        { return "large_result" }
func (largeResultTool) Description() string { return "large result test tool" }
func (largeResultTool) Execute(args map[string]any) (string, error) {
	return strings.Repeat("x", 1000), nil
}
func (largeResultTool) Parameters() map[string]llm.Property { return nil }
func (largeResultTool) Required() []string                  { return nil }

type shellFailureTool struct{}

func (shellFailureTool) Name() string        { return "run_shell" }
func (shellFailureTool) Description() string { return "shell failure test tool" }
func (shellFailureTool) Execute(args map[string]any) (string, error) {
	return strings.Repeat("noise\n", 100) + "--- FAIL: TestExample (0.01s)\nERROR: exit status 1", nil
}
func (shellFailureTool) Parameters() map[string]llm.Property { return nil }
func (shellFailureTool) Required() []string                  { return nil }

type countingReadTool struct {
	count int
}

func (t *countingReadTool) Name() string        { return "read_file" }
func (t *countingReadTool) Description() string { return "counting read test tool" }
func (t *countingReadTool) Execute(args map[string]any) (string, error) {
	t.count++
	return fmt.Sprintf("read %d", t.count), nil
}
func (t *countingReadTool) Parameters() map[string]llm.Property { return nil }
func (t *countingReadTool) Required() []string                  { return nil }

type noOpWriteTool struct{}

func (noOpWriteTool) Name() string                                { return "write_file" }
func (noOpWriteTool) Description() string                         { return "write test tool" }
func (noOpWriteTool) Execute(args map[string]any) (string, error) { return "written", nil }
func (noOpWriteTool) Parameters() map[string]llm.Property         { return nil }
func (noOpWriteTool) Required() []string                          { return nil }

type noOpShellTool struct{}

func (noOpShellTool) Name() string                                { return "run_shell" }
func (noOpShellTool) Description() string                         { return "shell test tool" }
func (noOpShellTool) Execute(args map[string]any) (string, error) { return "shell ok", nil }
func (noOpShellTool) Parameters() map[string]llm.Property         { return nil }
func (noOpShellTool) Required() []string                          { return nil }

type shelltoolForTest struct {
	executed  bool
	confirmed bool
}

func (t *shelltoolForTest) Name() string        { return "run_shell" }
func (t *shelltoolForTest) Description() string { return "shell test tool" }
func (t *shelltoolForTest) Execute(args map[string]any) (string, error) {
	t.executed = true
	t.confirmed = shelltool.IsDangerConfirmed(args)
	return "shell ok", nil
}
func (t *shelltoolForTest) Parameters() map[string]llm.Property { return nil }
func (t *shelltoolForTest) Required() []string                  { return nil }

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

func TestExecuteToolCallEmitsDisplayBlocks(t *testing.T) {
	tools := toolset.NewRegistry()
	tools.Register(richEventTool{})
	engine := NewEngine(nil, tools)

	var results []ToolResultEvent
	engine.OnToolResult = func(event ToolResultEvent) { results = append(results, event) }

	err := engine.executeToolCall(chat.ToolCall{
		ID:   "tc_display",
		Type: "function",
		Function: chat.ToolCallFunc{
			Name:      "rich_event_tool",
			Arguments: `{}`,
		},
	})
	if err != nil {
		t.Fatalf("executeToolCall failed: %v", err)
	}
	if len(engine.Context.Messages) != 1 || engine.Context.Messages[0].Content != "model summary" {
		t.Fatalf("expected model text in context, got %+v", engine.Context.Messages)
	}
	if len(results) != 1 || results[0].Content != "model summary" || len(results[0].Display) != 1 || results[0].Display[0].Type != display.BlockDiff {
		t.Fatalf("unexpected tool result event: %+v", results)
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

func TestExecuteToolCallBudgetsToolResultInContext(t *testing.T) {
	tools := toolset.NewRegistry()
	tools.Register(largeResultTool{})
	engine := NewEngine(nil, tools)
	engine.ToolResultMaxChars = 200
	var emitted []ToolResultEvent
	engine.OnToolResult = func(event ToolResultEvent) { emitted = append(emitted, event) }

	err := engine.executeToolCall(chat.ToolCall{
		ID:   "tc_large",
		Type: "function",
		Function: chat.ToolCallFunc{
			Name:      "large_result",
			Arguments: `{}`,
		},
	})
	if err != nil {
		t.Fatalf("executeToolCall failed: %v", err)
	}
	if len(engine.Context.Messages) != 1 {
		t.Fatalf("expected one tool message, got %d", len(engine.Context.Messages))
	}
	content := engine.Context.Messages[0].Content
	if len(content) > 200 || !strings.Contains(content, "[tool result truncated:") {
		t.Fatalf("expected budgeted context result, got len=%d content=%q", len(content), content)
	}
	if len(emitted) != 1 || len(emitted[0].Content) != 1000 {
		t.Fatalf("expected full result in event, got %+v", emitted)
	}
}

func TestExecuteToolCallSummarizesShellFailureInContext(t *testing.T) {
	tools := toolset.NewRegistry()
	tools.Register(shellFailureTool{})
	engine := NewEngine(nil, tools)
	engine.ToolResultMaxChars = 300

	err := engine.executeToolCall(chat.ToolCall{
		ID:   "tc_shell",
		Type: "function",
		Function: chat.ToolCallFunc{
			Name:      "run_shell",
			Arguments: `{"command":"go test ./..."}`,
		},
	})
	if err != nil {
		t.Fatalf("executeToolCall failed: %v", err)
	}
	content := engine.Context.Messages[0].Content
	if len(content) > 300 || !strings.Contains(content, "[shell/test output summarized:") || !strings.Contains(content, "--- FAIL: TestExample") {
		t.Fatalf("expected summarized shell failure, got len=%d content=%q", len(content), content)
	}
}

func TestExecuteToolCallCachesReadFileAndRefreshesAfterWrite(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "cached.txt")
	if err := os.WriteFile(path, []byte("cached"), 0644); err != nil {
		t.Fatal(err)
	}
	reader := &countingReadTool{}
	tools := toolset.NewRegistry()
	tools.Register(reader)
	tools.Register(&filetool.Write{})
	engine := NewEngine(nil, tools)

	readCall := chat.ToolCall{ID: "tc_read", Type: "function", Function: chat.ToolCallFunc{Name: "read_file", Arguments: fmt.Sprintf(`{"path":%q}`, path)}}
	if err := engine.executeToolCall(readCall); err != nil {
		t.Fatal(err)
	}
	if err := engine.executeToolCall(readCall); err != nil {
		t.Fatal(err)
	}
	if reader.count != 1 {
		t.Fatalf("expected second read_file call to use cache, executed %d times", reader.count)
	}

	writeCall := chat.ToolCall{ID: "tc_write", Type: "function", Function: chat.ToolCallFunc{Name: "write_file", Arguments: fmt.Sprintf(`{"path":%q,"content":"new"}`, path)}}
	if err := engine.executeToolCall(writeCall); err != nil {
		t.Fatal(err)
	}
	if err := engine.executeToolCall(readCall); err != nil {
		t.Fatal(err)
	}
	if reader.count != 1 {
		t.Fatalf("expected write_file to refresh read cache without re-executing read_file, executed %d times", reader.count)
	}
	last := engine.Context.Messages[len(engine.Context.Messages)-1].Content
	if !strings.Contains(last, "1: new") {
		t.Fatalf("expected refreshed cache to contain new file content, got %q", last)
	}
}

func TestExecuteToolCallRefreshesReadCacheAfterEdit(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "cached.txt")
	if err := os.WriteFile(path, []byte("old value"), 0644); err != nil {
		t.Fatal(err)
	}
	reader := &countingReadTool{}
	tools := toolset.NewRegistry()
	tools.Register(reader)
	tools.Register(&filetool.Edit{})
	engine := NewEngine(nil, tools)

	readCall := chat.ToolCall{ID: "tc_read", Type: "function", Function: chat.ToolCallFunc{Name: "read_file", Arguments: fmt.Sprintf(`{"path":%q}`, path)}}
	if err := engine.executeToolCall(readCall); err != nil {
		t.Fatal(err)
	}
	if reader.count != 1 {
		t.Fatalf("expected initial read_file execution, got %d", reader.count)
	}

	editCall := chat.ToolCall{ID: "tc_edit", Type: "function", Function: chat.ToolCallFunc{Name: "edit_file", Arguments: fmt.Sprintf(`{"path":%q,"old_string":"old","new_string":"new"}`, path)}}
	if err := engine.executeToolCall(editCall); err != nil {
		t.Fatal(err)
	}
	if err := engine.executeToolCall(readCall); err != nil {
		t.Fatal(err)
	}
	if reader.count != 1 {
		t.Fatalf("expected edit_file to refresh read cache without re-executing read_file, executed %d times", reader.count)
	}
	last := engine.Context.Messages[len(engine.Context.Messages)-1].Content
	if !strings.Contains(last, "1: new value") {
		t.Fatalf("expected refreshed cache to contain edited file content, got %q", last)
	}
}

func TestExecuteToolCallDangerousShellRequiresExplicitApproval(t *testing.T) {
	tools := toolset.NewRegistry()
	tools.Register(&shelltoolForTest{})
	engine := NewEngine(nil, tools)
	requested := false
	engine.Approver = &approval.Approver{Mode: approval.ModeJustDoIt, RequestFunc: func(toolName, description string) bool {
		requested = true
		return false
	}}

	err := engine.executeToolCall(chat.ToolCall{ID: "tc_danger", Type: "function", Function: chat.ToolCallFunc{Name: "run_shell", Arguments: `{"command":"sudo rm -rf /"}`}})
	if err != nil {
		t.Fatalf("executeToolCall failed: %v", err)
	}
	if !requested {
		t.Fatal("expected explicit approval request")
	}
	if len(engine.Context.Messages) != 1 || !strings.Contains(engine.Context.Messages[0].Content, "未获用户二次确认") {
		t.Fatalf("expected dangerous shell rejection in context, got %+v", engine.Context.Messages)
	}
}

func TestExecuteToolCallDangerousShellRunsAfterExplicitApproval(t *testing.T) {
	tools := toolset.NewRegistry()
	shellTool := &shelltoolForTest{}
	tools.Register(shellTool)
	engine := NewEngine(nil, tools)
	engine.Approver = &approval.Approver{Mode: approval.ModeJustDoIt, RequestFunc: func(toolName, description string) bool { return true }}

	err := engine.executeToolCall(chat.ToolCall{ID: "tc_danger", Type: "function", Function: chat.ToolCallFunc{Name: "run_shell", Arguments: `{"command":"sudo rm -rf /"}`}})
	if err != nil {
		t.Fatalf("executeToolCall failed: %v", err)
	}
	if !shellTool.executed || !shellTool.confirmed {
		t.Fatalf("expected shell tool to execute with confirmation, executed=%v confirmed=%v", shellTool.executed, shellTool.confirmed)
	}
}

func TestExecuteToolCallInvalidatesReadCacheAfterShell(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "cached.txt")
	if err := os.WriteFile(path, []byte("cached"), 0644); err != nil {
		t.Fatal(err)
	}
	reader := &countingReadTool{}
	tools := toolset.NewRegistry()
	tools.Register(reader)
	tools.Register(noOpShellTool{})
	engine := NewEngine(nil, tools)

	readCall := chat.ToolCall{ID: "tc_read", Type: "function", Function: chat.ToolCallFunc{Name: "read_file", Arguments: fmt.Sprintf(`{"path":%q}`, path)}}
	if err := engine.executeToolCall(readCall); err != nil {
		t.Fatal(err)
	}
	if err := engine.executeToolCall(readCall); err != nil {
		t.Fatal(err)
	}
	if reader.count != 1 {
		t.Fatalf("expected cache hit before shell, executed %d times", reader.count)
	}

	shellCall := chat.ToolCall{ID: "tc_shell", Type: "function", Function: chat.ToolCallFunc{Name: "run_shell", Arguments: `{"command":"touch cached.txt"}`}}
	if err := engine.executeToolCall(shellCall); err != nil {
		t.Fatal(err)
	}
	if err := engine.executeToolCall(readCall); err != nil {
		t.Fatal(err)
	}
	if reader.count != 2 {
		t.Fatalf("expected shell to invalidate read_file cache, executed %d times", reader.count)
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
