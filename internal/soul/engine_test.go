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
	"sync"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/approval"
	"github.com/Misaka477/Natalia-Cli/internal/chat"
	"github.com/Misaka477/Natalia-Cli/internal/compaction"
	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/hook"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/mode"
	"github.com/Misaka477/Natalia-Cli/internal/notifications"
	"github.com/Misaka477/Natalia-Cli/internal/plan"
	filetool "github.com/Misaka477/Natalia-Cli/internal/tools/file"
	shelltool "github.com/Misaka477/Natalia-Cli/internal/tools/shell"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
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

func TestSteerQueueConcurrentPushPop(t *testing.T) {
	q := &SteerQueue{}
	const total = 1000
	var producers sync.WaitGroup
	for i := 0; i < 4; i++ {
		producers.Add(1)
		go func() {
			defer producers.Done()
			for j := 0; j < total/4; j++ {
				q.Push("steer")
			}
		}()
	}
	producers.Wait()
	count := 0
	for {
		_, ok := q.Pop()
		if !ok {
			break
		}
		count++
	}
	if count != total {
		t.Fatalf("expected %d queued steer messages, got %d", total, count)
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

type recordingInjectionProvider struct {
	compacted int
}

func (p *recordingInjectionProvider) GetInjections(history []chat.Message, engine *Engine) ([]Injection, error) {
	return nil, nil
}

func (p *recordingInjectionProvider) OnContextCompacted() error {
	p.compacted++
	return nil
}

func (p *recordingInjectionProvider) OnAfkChanged(bool) error { return nil }

func TestNotificationInjectionProviderDrainsStore(t *testing.T) {
	store := notifications.NewStore()
	store.Add("background", "Background task completed", "proc_1 exited")
	provider := NotificationInjectionProvider{Store: store}
	injections, err := provider.GetInjections(nil, NewEngine(nil, toolset.NewRegistry()))
	if err != nil {
		t.Fatalf("GetInjections failed: %v", err)
	}
	if len(injections) != 1 || injections[0].Type != "notifications" || !strings.Contains(injections[0].Content, "proc_1 exited") {
		t.Fatalf("unexpected notification injection: %+v", injections)
	}
	again, err := provider.GetInjections(nil, NewEngine(nil, toolset.NewRegistry()))
	if err != nil {
		t.Fatalf("second GetInjections failed: %v", err)
	}
	if len(again) != 0 {
		t.Fatalf("expected notification store to be drained, got %+v", again)
	}
}

func TestPlanModeAndAFKInjectionProvidersUseRuntimeState(t *testing.T) {
	plan.Exit()
	defer plan.Exit()
	if injections, err := (PlanModeInjectionProvider{}).GetInjections(nil, nil); err != nil || len(injections) != 0 {
		t.Fatalf("expected no plan injection outside plan mode, got %+v err=%v", injections, err)
	}
	plan.Enter("test-plan", filepath.Join(t.TempDir(), "plans", "test.md"), "test")
	planInjections, err := (PlanModeInjectionProvider{}).GetInjections(nil, nil)
	if err != nil || len(planInjections) != 1 || planInjections[0].Type != "plan_mode" {
		t.Fatalf("expected plan mode injection, got %+v err=%v", planInjections, err)
	}
	af := &AFKInjectionProvider{}
	engine := NewEngine(nil, toolset.NewRegistry())
	engine.Context.Messages = append(engine.Context.Messages, chat.Message{Role: chat.RoleSystem, Content: "system"})
	engine.InjectionProviders = []InjectionProvider{PlanModeInjectionProvider{}, af}
	engine.SetAFK(true)
	cleanup := engine.injectDynamicStepMessages()
	if len(engine.Context.Messages) < 2 || !strings.Contains(engine.Context.Messages[1].Content, "[plan_mode]") || !strings.Contains(engine.Context.Messages[1].Content, "[afk]") {
		t.Fatalf("expected plan and afk injections in temporary system message: %+v", engine.Context.Messages)
	}
	diag := engine.LastInjectionDiagnostics()
	if len(diag) != 2 || diag[0].Count != 1 || diag[1].Count != 1 {
		t.Fatalf("expected injection diagnostics, got %+v", diag)
	}
	cleanup()
	if len(engine.Context.Messages) != 1 {
		t.Fatalf("expected temporary injection cleanup, got %+v", engine.Context.Messages)
	}
}

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

func TestExecuteToolCallStopsWhenPreHookDenies(t *testing.T) {
	tools := toolset.NewRegistry()
	tools.Register(eventTool{})
	engine := NewEngine(nil, tools)
	engine.Hooks = hook.NewEngine([]hook.HookDef{{ID: "deny", Event: hook.EventPreToolUse, Target: "event_tool", Command: `printf '{"action":"deny","reason":"policy"}'`}})
	var results []ToolResultEvent
	engine.OnToolResult = func(event ToolResultEvent) { results = append(results, event) }
	err := engine.executeToolCall(chat.ToolCall{ID: "tc_deny", Type: "function", Function: chat.ToolCallFunc{Name: "event_tool", Arguments: `{}`}})
	if err != nil {
		t.Fatalf("executeToolCall failed: %v", err)
	}
	if len(results) != 1 || !strings.Contains(results[0].Content, "hook") || !strings.Contains(results[0].Content, "policy") {
		t.Fatalf("expected hook denial tool result, got %+v", results)
	}
	if audit := engine.Hooks.AuditLog(); len(audit) != 1 || audit[0].Action != "deny" {
		t.Fatalf("expected hook audit deny, got %+v", audit)
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

func TestExecuteToolCallRunsRealFileToolEndToEnd(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "engine-real.txt")
	if err := os.WriteFile(path, []byte("engine-real-ok\n"), 0644); err != nil {
		t.Fatal(err)
	}
	tools := toolset.NewRegistry()
	tools.Register(&filetool.Read{})
	engine := NewEngine(nil, tools)
	var results []ToolResultEvent
	engine.OnToolResult = func(event ToolResultEvent) { results = append(results, event) }

	err := engine.executeToolCall(chat.ToolCall{ID: "tc_real_read", Type: "function", Function: chat.ToolCallFunc{Name: "read_file", Arguments: fmt.Sprintf(`{"path":%q,"limit":"all"}`, path)}})
	if err != nil {
		t.Fatalf("executeToolCall real read_file failed: %v", err)
	}
	if len(engine.Context.Messages) != 1 || engine.Context.Messages[0].Role != chat.RoleTool || !strings.Contains(engine.Context.Messages[0].Content, "engine-real-ok") {
		t.Fatalf("expected real read_file result in tool context, got %+v", engine.Context.Messages)
	}
	if len(results) != 1 || results[0].Name != "read_file" || !strings.Contains(results[0].Content, "engine-real-ok") {
		t.Fatalf("expected real read_file result event, got %+v", results)
	}
}

func TestStreamToolCallNormalizesMissingIDAndType(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte(`data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"run_shell","arguments":"{\"command\":\"true\"}"}}]}}]}` + "\n"))
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	tools := toolset.NewRegistry()
	tools.Register(noOpShellTool{})
	engine := NewEngine(llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock", Timeout: time.Second}), tools)
	engine.Stream = true
	engine.OnToken = func(string) {}
	engine.Context.MaxSteps = 1
	outcome, err := engine.Run("run true")
	if err != nil {
		t.Fatal(err)
	}
	if outcome == nil || outcome.StopReason != "max_steps" {
		t.Fatalf("expected max_steps after one tool step, got %+v", outcome)
	}
	if len(engine.Context.Messages) != 3 {
		t.Fatalf("expected system, assistant tool call, and tool result messages, got %+v", engine.Context.Messages)
	}
	assistant := engine.Context.Messages[1]
	toolResult := engine.Context.Messages[2]
	if len(assistant.ToolCalls) != 1 || assistant.ToolCalls[0].ID == "" || assistant.ToolCalls[0].Type != "function" {
		t.Fatalf("expected normalized assistant tool call, got %+v", assistant.ToolCalls)
	}
	if toolResult.Role != chat.RoleTool || toolResult.ToolCallID != assistant.ToolCalls[0].ID {
		t.Fatalf("expected tool result to reference normalized tool call ID, assistant=%+v tool=%+v", assistant, toolResult)
	}
}

func TestExecuteToolCallTriggersPreAndPostHooksWithRealToolResult(t *testing.T) {
	dir := t.TempDir()
	readPath := filepath.Join(dir, "input.txt")
	if err := os.WriteFile(readPath, []byte("hooked content"), 0644); err != nil {
		t.Fatal(err)
	}
	prePath := filepath.Join(dir, "pre.json")
	postPath := filepath.Join(dir, "post.json")
	tools := toolset.NewRegistry()
	tools.Register(&filetool.Read{})
	engine := NewEngine(nil, tools)
	engine.Hooks = hook.NewEngine([]hook.HookDef{
		{ID: "pre", Event: hook.EventPreToolUse, Target: "read_file", Command: "tee pre.json >/dev/null", Cwd: dir, Timeout: time.Second},
		{ID: "post", Event: hook.EventPostToolUse, Target: "read_file", Command: "tee post.json >/dev/null", Cwd: dir, Timeout: time.Second},
	})
	var emitted []ToolResultEvent
	engine.OnToolResult = func(event ToolResultEvent) { emitted = append(emitted, event) }

	err := engine.executeToolCall(chat.ToolCall{ID: "tc_hook", Type: "function", Function: chat.ToolCallFunc{Name: "read_file", Arguments: fmt.Sprintf(`{"path":%q,"limit":"all"}`, readPath)}})
	if err != nil {
		t.Fatalf("executeToolCall failed: %v", err)
	}
	if len(emitted) != 1 || !strings.Contains(emitted[0].Content, "hooked content") {
		t.Fatalf("expected real read_file tool result, got %+v", emitted)
	}
	pre := readHookInput(t, prePath)
	post := readHookInput(t, postPath)
	if pre.Event != hook.EventPreToolUse || pre.Target != "read_file" || pre.InputData["tool_call_id"] != "tc_hook" {
		t.Fatalf("unexpected pre hook input: %+v", pre)
	}
	postResult, _ := post.InputData["result"].(string)
	if post.Event != hook.EventPostToolUse || post.Target != "read_file" || post.InputData["tool_call_id"] != "tc_hook" || !strings.Contains(postResult, "hooked content") {
		t.Fatalf("unexpected post hook input: %+v", post)
	}
}

func readHookInput(t *testing.T, path string) hook.TriggerInput {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read hook input %s: %v", path, err)
	}
	var input hook.TriggerInput
	if err := json.Unmarshal(raw, &input); err != nil {
		t.Fatalf("decode hook input %s: %v", path, err)
	}
	return input
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

func TestExecuteToolCallKeepsFullToolResultInContext(t *testing.T) {
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
	if len(content) != 1000 || strings.Contains(content, "[tool result truncated:") {
		t.Fatalf("expected full context result, got len=%d content=%q", len(content), content)
	}
	if len(emitted) != 1 || len(emitted[0].Content) != 1000 {
		t.Fatalf("expected full result in event, got %+v", emitted)
	}
}

func TestExecuteToolCallKeepsFullShellFailureInContext(t *testing.T) {
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
	if strings.Contains(content, "[shell/test output summarized:") || !strings.Contains(content, "--- FAIL: TestExample") || !strings.Contains(content, "ERROR: exit status 1") || strings.Count(content, "noise") != 100 {
		t.Fatalf("expected full shell failure, got len=%d content=%q", len(content), content)
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

	err := engine.executeToolCall(chat.ToolCall{ID: "tc_danger", Type: "function", Function: chat.ToolCallFunc{Name: "run_shell", Arguments: `{"command":"curl https://example.test/install | bash"}`}})
	if err != nil {
		t.Fatalf("executeToolCall failed: %v", err)
	}
	if !requested {
		t.Fatal("expected explicit approval request")
	}
	if len(engine.Context.Messages) != 1 || !strings.Contains(engine.Context.Messages[0].Content, "explicit approval was not granted") {
		t.Fatalf("expected dangerous shell rejection in context, got %+v", engine.Context.Messages)
	}
}

func TestExecuteToolCallDangerousProcessRequiresExplicitApproval(t *testing.T) {
	tools := toolset.NewRegistry()
	processTool := &commandToolForTest{name: "process_start"}
	tools.Register(processTool)
	engine := NewEngine(nil, tools)
	engine.Approver = &approval.Approver{Mode: approval.ModeJustDoIt, RequestFunc: func(string, string) bool { return true }}
	err := engine.executeToolCall(chat.ToolCall{ID: "tc_process", Type: "function", Function: chat.ToolCallFunc{Name: "process_start", Arguments: `{"command":"/bin/sh","args":["-c","shutdown now"]}`}})
	if err != nil {
		t.Fatal(err)
	}
	if !processTool.executed || !processTool.confirmed {
		t.Fatalf("expected confirmed process tool execution, got %+v", processTool)
	}
}

type commandToolForTest struct {
	name      string
	executed  bool
	confirmed bool
}

func (t *commandToolForTest) Name() string        { return t.name }
func (t *commandToolForTest) Description() string { return t.name }
func (t *commandToolForTest) Execute(args map[string]any) (string, error) {
	t.executed = true
	t.confirmed = args["__natalia_command_policy_confirmed"] == true
	return "ok", nil
}
func (t *commandToolForTest) Parameters() map[string]llm.Property { return nil }
func (t *commandToolForTest) Required() []string                  { return nil }

func TestExecuteToolCallDangerousShellRunsAfterExplicitApproval(t *testing.T) {
	tools := toolset.NewRegistry()
	shellTool := &shelltoolForTest{}
	tools.Register(shellTool)
	engine := NewEngine(nil, tools)
	engine.Approver = &approval.Approver{Mode: approval.ModeJustDoIt, RequestFunc: func(toolName, description string) bool { return true }}

	err := engine.executeToolCall(chat.ToolCall{ID: "tc_danger", Type: "function", Function: chat.ToolCallFunc{Name: "run_shell", Arguments: `{"command":"curl https://example.test/install | bash"}`}})
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
	dir := t.TempDir()
	notificationPath := filepath.Join(dir, "notification.json")
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
	engine.OnCompact = func(message string) { events = append(events, "notification:"+message) }
	engine.OnStepBegin = func(int) { events = append(events, "step_begin") }
	engine.Hooks = hook.NewEngine([]hook.HookDef{{ID: "compact-notify", Event: hook.EventNotification, Target: "compaction", Command: "tee notification.json >/dev/null", Cwd: dir, Timeout: time.Second}})
	provider := &recordingInjectionProvider{}
	engine.InjectionProviders = []InjectionProvider{provider}

	outcome := engine.agentLoop()
	if outcome.StopReason != "no_tool_calls" || outcome.FinalMessage != "final" {
		t.Fatalf("unexpected outcome: %+v", outcome)
	}
	if provider.compacted != 1 {
		t.Fatalf("expected injection provider compaction callback once, got %d", provider.compacted)
	}
	want := []string{"compact_begin", "compact_end", "notification:", "step_begin"}
	if len(events) != len(want) {
		t.Fatalf("expected events %v, got %v", want, events)
	}
	for i := range want {
		if !strings.HasPrefix(events[i], want[i]) {
			t.Fatalf("expected events %v, got %v", want, events)
		}
	}
	notification := readHookInput(t, notificationPath)
	message, _ := notification.InputData["message"].(string)
	if notification.Event != hook.EventNotification || notification.Target != "compaction" || !strings.HasPrefix(message, "压缩完成，估计 ") {
		t.Fatalf("unexpected notification hook payload: %+v", notification)
	}
}

func TestRunTriggersUserPromptSubmitHookBeforeLLMStep(t *testing.T) {
	dir := t.TempDir()
	hookPath := filepath.Join(dir, "prompt.json")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := os.Stat(hookPath); err != nil {
			t.Errorf("expected UserPromptSubmit hook to run before LLM request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": "done"}}},
			"usage":   map[string]any{"completion_tokens": 1, "total_tokens": 2},
		})
	}))
	defer server.Close()

	engine := NewEngine(llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock"}), toolset.NewRegistry())
	engine.PrefetchEnabled = false
	engine.Context.MaxSteps = 1
	engine.Hooks = hook.NewEngine([]hook.HookDef{{ID: "prompt", Event: hook.EventUserPromptSubmit, Target: "user_prompt", Command: "tee prompt.json >/dev/null", Cwd: dir, Timeout: time.Second}})
	outcome, err := engine.Run("please continue")
	if err != nil {
		t.Fatal(err)
	}
	if outcome.FinalMessage != "done" || outcome.StopReason != "no_tool_calls" {
		t.Fatalf("unexpected outcome: %+v", outcome)
	}
	input := readHookInput(t, hookPath)
	if input.Event != hook.EventUserPromptSubmit || input.Target != "user_prompt" || input.InputData["user_input"] != "please continue" {
		t.Fatalf("unexpected prompt hook payload: %+v", input)
	}
}

func TestRunInjectsDynamicSystemMessageForStepOnly(t *testing.T) {
	var seenMessages []chat.Message
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read request body: %v", err)
		}
		var req llm.ChatRequest
		if err := json.Unmarshal(body, &req); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		seenMessages = req.Messages
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": "done"}}},
			"usage":   map[string]any{"completion_tokens": 1, "total_tokens": 2},
		})
	}))
	defer server.Close()

	engine := NewEngine(llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock"}), toolset.NewRegistry())
	engine.PrefetchEnabled = false
	engine.Context.MaxSteps = 1
	engine.Context.Messages = append(engine.Context.Messages, chat.Message{Role: chat.RoleSystem, Content: "base system"})
	engine.InjectionProviders = []InjectionProvider{SafetyInjectionProvider{}}
	outcome, err := engine.Run("need safe action")
	if err != nil {
		t.Fatal(err)
	}
	if outcome.FinalMessage != "done" {
		t.Fatalf("unexpected outcome: %+v", outcome)
	}
	if len(seenMessages) != 3 || seenMessages[0].Content != "base system" || seenMessages[1].Role != chat.RoleSystem || !strings.Contains(seenMessages[1].Content, "Safety reminder") || seenMessages[2].Content != "need safe action" {
		t.Fatalf("expected injected system message only in LLM request, got %+v", seenMessages)
	}
	if len(engine.Context.Messages) != 3 || strings.Contains(engine.Context.Messages[1].Content, "Safety reminder") {
		t.Fatalf("dynamic injection leaked into persistent context: %+v", engine.Context.Messages)
	}
}

func TestRunTriggersStopHookAfterSuccessfulTurn(t *testing.T) {
	dir := t.TempDir()
	hookPath := filepath.Join(dir, "stop.json")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": "completed"}}},
			"usage":   map[string]any{"completion_tokens": 1, "total_tokens": 2},
		})
	}))
	defer server.Close()

	engine := NewEngine(llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock"}), toolset.NewRegistry())
	engine.PrefetchEnabled = false
	engine.Context.MaxSteps = 1
	engine.Hooks = hook.NewEngine([]hook.HookDef{{ID: "stop", Event: hook.EventStop, Target: "run", Command: "tee stop.json >/dev/null", Cwd: dir, Timeout: time.Second}})
	outcome, err := engine.Run("finish cleanly")
	if err != nil {
		t.Fatal(err)
	}
	if outcome.StopReason != "no_tool_calls" || outcome.FinalMessage != "completed" {
		t.Fatalf("unexpected outcome: %+v", outcome)
	}
	input := readHookInput(t, hookPath)
	if input.Event != hook.EventStop || input.Target != "run" || input.InputData["user_input"] != "finish cleanly" || input.InputData["stop_reason"] != "no_tool_calls" || input.InputData["final_message"] != "completed" {
		t.Fatalf("unexpected stop hook payload: %+v", input)
	}
}

func TestRunTriggersStopFailureHookOnLLMError(t *testing.T) {
	dir := t.TempDir()
	hookPath := filepath.Join(dir, "failure.json")

	engine := NewEngine(llm.NewClient(llm.Config{BaseURL: "http://127.0.0.1:1", Model: "mock"}), toolset.NewRegistry())
	engine.PrefetchEnabled = false
	engine.Context.MaxSteps = 1
	engine.Hooks = hook.NewEngine([]hook.HookDef{{ID: "failure", Event: hook.EventStopFailure, Target: "run", Command: "tee failure.json >/dev/null", Cwd: dir, Timeout: time.Second}})
	outcome, err := engine.Run("this will fail")
	if err != nil {
		t.Fatal(err)
	}
	if outcome == nil || outcome.StopReason != "error" {
		t.Fatalf("expected error outcome, got %+v", outcome)
	}
	input := readHookInput(t, hookPath)
	if input.Event != hook.EventStopFailure || input.Target != "run" || input.InputData["user_input"] != "this will fail" {
		t.Fatalf("unexpected failure hook payload: %+v", input)
	}
	errorText, _ := input.InputData["final_message"].(string)
	if !strings.Contains(errorText, "request") && !strings.Contains(errorText, "connect") {
		t.Fatalf("expected LLM error in hook payload, got %+v", input)
	}
}

func TestStreamStepTreatsEmptyAssistantResponseAsError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	engine := NewEngine(llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock", Timeout: time.Second}), toolset.NewRegistry())
	engine.Stream = true
	engine.OnToken = func(string) {}
	engine.Context.MaxSteps = 1
	outcome, err := engine.Run("hello")
	if err != nil {
		t.Fatal(err)
	}
	if outcome == nil || outcome.StopReason != "error" || !strings.Contains(outcome.FinalMessage, "empty assistant response") {
		t.Fatalf("expected empty stream response error, got %+v", outcome)
	}
}
