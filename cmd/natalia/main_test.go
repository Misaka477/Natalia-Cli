package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/aquama/natalia-cli/internal/autoflow"
	"github.com/aquama/natalia-cli/internal/chat"
	"github.com/aquama/natalia-cli/internal/config"
	"github.com/aquama/natalia-cli/internal/planexec"
	"github.com/aquama/natalia-cli/internal/session"
	"github.com/aquama/natalia-cli/internal/soul"
	"github.com/aquama/natalia-cli/internal/toolset"
	"github.com/aquama/natalia-cli/internal/wire"
)

func testBoolPtr(v bool) *bool { return &v }

func TestModeFromEffectiveCustomMode(t *testing.T) {
	eff := &config.EffectiveProfile{
		Mode: "review",
		ModeConfig: config.ModeProfile{
			Extends:      "code",
			Description:  "Review Mode",
			SystemPrompt: "review prompt",
			Tools:        config.ToolPolicy{Exclude: []string{"write_file"}},
		},
	}
	m, err := modeFromEffective(eff)
	if err != nil {
		t.Fatalf("modeFromEffective failed: %v", err)
	}
	if m.Name != "review" || m.DisplayName != "Review Mode" || m.Prompt != "review prompt" {
		t.Fatalf("unexpected custom mode: %+v", m)
	}
	if !m.ToolFilter("read_file", nil) {
		t.Fatal("custom mode should inherit read_file from code")
	}
	if m.ToolFilter("write_file", nil) {
		t.Fatal("custom mode should exclude write_file")
	}
}

func TestModeFromEffectiveToolAllowList(t *testing.T) {
	eff := &config.EffectiveProfile{
		Mode: "code",
		ModeConfig: config.ModeProfile{
			Tools: config.ToolPolicy{Allowed: []string{"read_file"}},
		},
	}
	m, err := modeFromEffective(eff)
	if err != nil {
		t.Fatalf("modeFromEffective failed: %v", err)
	}
	if !m.ToolFilter("read_file", nil) {
		t.Fatal("allow list should keep read_file")
	}
	if m.ToolFilter("grep", nil) {
		t.Fatal("allow list should filter out grep")
	}
}

func TestModeFromEffectiveSystemPromptPath(t *testing.T) {
	dir := t.TempDir()
	promptPath := filepath.Join(dir, "review.md")
	if err := os.WriteFile(promptPath, []byte("prompt from file"), 0644); err != nil {
		t.Fatal(err)
	}
	eff := &config.EffectiveProfile{
		Mode: "review",
		ModeConfig: config.ModeProfile{
			Extends:          "code",
			SystemPromptPath: promptPath,
		},
	}
	m, err := modeFromEffective(eff)
	if err != nil {
		t.Fatalf("modeFromEffective failed: %v", err)
	}
	if m.Prompt != "prompt from file" {
		t.Fatalf("expected prompt from file, got %q", m.Prompt)
	}
}

func TestModeFromEffectiveRejectsUnknownMode(t *testing.T) {
	_, err := modeFromEffective(&config.EffectiveProfile{Mode: "missing"})
	if err == nil {
		t.Fatal("expected unknown mode error")
	}
}

func TestStatusLinesShowRuntimeRoutingDetails(t *testing.T) {
	oldRuntime := runtime
	runtime = runtimeOverrides{Mode: "debug", ModelProfile: "cheap", PermissionProfile: "read_only"}
	t.Cleanup(func() { runtime = oldRuntime })

	cfg := &config.Config{
		DefaultProfile: "default",
		Providers:      map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		ModelProfiles: map[string]config.ModelProfile{
			"cheap": {Provider: "p", Model: "cheap-model", ReasoningEffort: "low", ThinkingEnabled: testBoolPtr(true), Stream: testBoolPtr(true)},
		},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {
				Provider: "p",
				Model:    "base",
				Modes: map[string]config.ModeProfile{
					"debug": {Tools: config.ToolPolicy{Exclude: []string{"write_file"}}},
				},
			},
		},
	}
	engine := soul.NewEngine(nil, toolset.NewRegistry())
	m, err := modeFromEffective(&config.EffectiveProfile{Mode: "debug", ModeConfig: cfg.Profiles["default"].Modes["debug"]})
	if err != nil {
		t.Fatalf("modeFromEffective failed: %v", err)
	}
	engine.Mode = m

	lines, err := statusLines(cfg, engine)
	if err != nil {
		t.Fatalf("statusLines failed: %v", err)
	}
	joined := strings.Join(lines, "\n")
	for _, want := range []string{
		"mode: debug (manual override)",
		"model_profile: cheap (manual override)",
		"permission_profile: read_only (manual override)",
		"model: cheap-model",
		"reasoning_effort: high",
		"thinking_enabled: true",
		"stream: true",
		"tools: exclude-list (1 tools)",
	} {
		if !strings.Contains(joined, want) {
			t.Fatalf("expected status to contain %q, got:\n%s", want, joined)
		}
	}
}

func TestApplyAutoflowDecisionSwitchesToDebugPreservingState(t *testing.T) {
	oldRuntime := runtime
	runtime = runtimeOverrides{Mode: "code", ModelProfile: "cheap", PermissionProfile: "read_only"}
	t.Cleanup(func() { runtime = oldRuntime })

	cfg := &config.Config{
		DefaultProfile: "default",
		Providers:      map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		ModelProfiles: map[string]config.ModelProfile{
			"cheap":     {Provider: "p", Model: "cheap-model"},
			"strongest": {Provider: "p", Model: "strongest-model", ReasoningEffort: "high"},
		},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "p", Model: "base", Mode: "code"},
		},
	}
	tools := toolset.NewRegistry()
	engine := buildEngine(cfg, tools, false)
	engine.Context.Messages = append(engine.Context.Messages, chat.Message{Role: chat.RoleUser, Content: "user context"})
	oldContext := engine.Context
	oldCache := engine.ToolCache

	applyAutoflowDecision(autoflow.Decision{Action: autoflow.ActionDebug, TargetMode: "debug"}, cfg, &engine, tools, false)
	if runtime.Mode != "debug" || runtime.ModelProfile != "" || runtime.PermissionProfile != "" {
		t.Fatalf("expected runtime switched to debug with cleared overrides, got %+v", runtime)
	}
	if engine.Mode == nil || engine.Mode.Name != "debug" {
		t.Fatalf("expected rebuilt engine in debug mode, got %+v", engine.Mode)
	}
	if engine.Context != oldContext || engine.ToolCache != oldCache {
		t.Fatal("expected escalation to preserve context and tool cache")
	}
	if len(engine.Context.Messages) < 2 || engine.Context.Messages[len(engine.Context.Messages)-1].Content != "user context" {
		t.Fatalf("expected conversation context preserved, got %+v", engine.Context.Messages)
	}
}

func TestApplyAutoflowDecisionRecoversPreviousModePreservingState(t *testing.T) {
	oldRuntime := runtime
	runtime = runtimeOverrides{Mode: "debug", ModelProfile: "cheap", PermissionProfile: "read_only"}
	t.Cleanup(func() { runtime = oldRuntime })

	cfg := &config.Config{
		DefaultProfile: "default",
		Providers:      map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		ModelProfiles: map[string]config.ModelProfile{
			"cheap":     {Provider: "p", Model: "cheap-model"},
			"strongest": {Provider: "p", Model: "strongest-model"},
		},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "p", Model: "base", Mode: "code"},
		},
	}
	tools := toolset.NewRegistry()
	engine := buildEngine(cfg, tools, false)
	oldContext := engine.Context

	applyAutoflowDecision(autoflow.Decision{Action: autoflow.ActionRecoveredMode, TargetMode: "code"}, cfg, &engine, tools, false)
	if runtime.Mode != "code" || runtime.ModelProfile != "" || runtime.PermissionProfile != "" {
		t.Fatalf("expected runtime recovered to code with cleared overrides, got %+v", runtime)
	}
	if engine.Mode == nil || engine.Mode.Name != "code" || engine.Context != oldContext {
		t.Fatalf("expected engine recovered to code preserving state, mode=%+v context=%v", engine.Mode, engine.Context == oldContext)
	}
}

func TestMaybeRecordAutoflowDisabledSkipsEscalator(t *testing.T) {
	escalator := &autoflow.Escalator{Threshold: 1}
	decision := maybeRecordAutoflow(false, escalator, &soul.Outcome{StopReason: "error"}, nil)
	if decision.Action != autoflow.ActionNone || escalator.Consecutive != 0 {
		t.Fatalf("expected disabled auto to skip state changes, decision=%+v escalator=%+v", decision, escalator)
	}
}

func TestHandleAutoCommandTogglesAndResets(t *testing.T) {
	enabled := true
	escalator := &autoflow.Escalator{Threshold: 1}
	escalator.Record(&soul.Outcome{StopReason: "error"}, "code")

	output := captureStdout(t, func() { handleAuto("/auto off", &enabled, escalator) })
	if enabled || escalator.AutoDebug || escalator.PreviousMode != "" || !strings.Contains(output, "auto 已关闭") {
		t.Fatalf("expected auto off to disable and reset, enabled=%v escalator=%+v output=%q", enabled, escalator, output)
	}

	output = captureStdout(t, func() { handleAuto("/auto on", &enabled, escalator) })
	if !enabled || !strings.Contains(output, "auto 已开启") {
		t.Fatalf("expected auto on, enabled=%v output=%q", enabled, output)
	}
}

func TestHandleAutoCommandStatus(t *testing.T) {
	oldPlan := currentPlan
	currentPlan = nil
	t.Cleanup(func() { currentPlan = oldPlan })
	enabled := true
	escalator := &autoflow.Escalator{Threshold: 1, Consecutive: 1, AutoDebug: true, PreviousMode: "code"}
	output := captureStdout(t, func() { handleAuto("/auto", &enabled, escalator) })
	for _, want := range []string{"auto: on", "failure_threshold: 1", "consecutive_failures: 1", "auto_debug: true", "previous_mode: code", "plan: <none>"} {
		if !strings.Contains(output, want) {
			t.Fatalf("expected output to contain %q, got %q", want, output)
		}
	}
}

func TestHandleAutoCommandStatusShowsPlan(t *testing.T) {
	oldPlan := currentPlan
	currentPlan = nil
	t.Cleanup(func() { currentPlan = oldPlan })
	enabled := true
	escalator := &autoflow.Escalator{Threshold: 1}
	dir := t.TempDir()
	planPath := filepath.Join(dir, "plan.md")
	if err := os.WriteFile(planPath, []byte("- [x] done\n- [ ] next item"), 0644); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{DefaultProfile: "default", Providers: map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}}, Profiles: map[string]config.Profile{"default": {Provider: "p", Model: "base"}}, PermissionProfiles: config.DefaultPermissionProfiles()}
	engine := buildEngine(cfg, toolset.NewRegistry(), false)
	captureStdout(t, func() { handleExecutePlan("/execute-plan "+planPath, cfg, &engine, toolset.NewRegistry(), false) })
	output := captureStdout(t, func() { handleAuto("/auto", &enabled, escalator) })
	for _, want := range []string{"plan: plan", "plan_steps: 1/2 done", "next_step: line 2: next item"} {
		if !strings.Contains(output, want) {
			t.Fatalf("expected output to contain %q, got %q", want, output)
		}
	}
}

func TestHandlePlanCommandMarksNextDone(t *testing.T) {
	oldPlan := currentPlan
	currentPlan = nil
	t.Cleanup(func() { currentPlan = oldPlan })
	dir := t.TempDir()
	planPath := filepath.Join(dir, "plan.md")
	if err := os.WriteFile(planPath, []byte("- [ ] first\n- [ ] second"), 0644); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{DefaultProfile: "default", Providers: map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}}, Profiles: map[string]config.Profile{"default": {Provider: "p", Model: "base"}}, PermissionProfiles: config.DefaultPermissionProfiles()}
	engine := buildEngine(cfg, toolset.NewRegistry(), false)
	captureStdout(t, func() { handleExecutePlan("/execute-plan "+planPath, cfg, &engine, toolset.NewRegistry(), false) })

	output := captureStdout(t, func() { handlePlan("/plan done") })
	for _, want := range []string{"已标记完成: line 1: first", "下一未完成项: line 2: second"} {
		if !strings.Contains(output, want) {
			t.Fatalf("expected output to contain %q, got %q", want, output)
		}
	}
	output = captureStdout(t, func() { handlePlan("/plan status") })
	if !strings.Contains(output, "plan_steps: 1/2 done") || !strings.Contains(output, "next_step: line 2: second") {
		t.Fatalf("expected updated plan status, got %q", output)
	}
}

func TestHandlePlanCommandClear(t *testing.T) {
	oldPlan := currentPlan
	currentPlan = planexec.Parse("plan.md", "- [ ] task")
	t.Cleanup(func() { currentPlan = oldPlan })
	output := captureStdout(t, func() { handlePlan("/plan clear") })
	if currentPlan != nil || !strings.Contains(output, "已清除当前计划") {
		t.Fatalf("expected plan cleared, currentPlan=%+v output=%q", currentPlan, output)
	}
}

func TestHandleExecutePlanLoadsPlanAndQueuesSteer(t *testing.T) {
	oldRuntime := runtime
	runtime = runtimeOverrides{Mode: "debug", ModelProfile: "cheap", PermissionProfile: "read_only"}
	oldPlan := currentPlan
	currentPlan = nil
	t.Cleanup(func() { runtime = oldRuntime; currentPlan = oldPlan })

	dir := t.TempDir()
	planPath := filepath.Join(dir, "plan.md")
	if err := os.WriteFile(planPath, []byte("# Plan\n\n- [ ] next task"), 0644); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{
		DefaultProfile:     "default",
		Providers:          map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "p", Model: "base", Mode: "debug"},
		},
	}
	tools := toolset.NewRegistry()
	engine := buildEngine(cfg, tools, false)
	oldContext := engine.Context

	output := captureStdout(t, func() { handleExecutePlan("/execute-plan "+planPath, cfg, &engine, tools, false) })
	if !strings.Contains(output, "已载入计划") || !strings.Contains(output, "下一未完成项: line 3: next task") || runtime.Mode != "code" || runtime.ModelProfile != "" || runtime.PermissionProfile != "" {
		t.Fatalf("expected plan loaded and runtime switched to code, output=%q runtime=%+v", output, runtime)
	}
	if currentPlan == nil || currentPlan.Slug != "plan" {
		t.Fatalf("expected current plan session, got %+v", currentPlan)
	}
	if engine.Mode == nil || engine.Mode.Name != "code" || engine.Context != oldContext {
		t.Fatalf("expected rebuilt code engine preserving context, mode=%+v context=%v", engine.Mode, engine.Context == oldContext)
	}
	steer, ok := engine.Steer.Pop()
	if !ok || !strings.Contains(steer, "# Plan") || !strings.Contains(steer, planPath) || !strings.Contains(steer, "下一未完成项（line 3）：next task") {
		t.Fatalf("expected queued plan steer, ok=%v steer=%q", ok, steer)
	}
}

func TestHandleExecutePlanRejectsNonMarkdown(t *testing.T) {
	cfg := &config.Config{DefaultProfile: "default"}
	engine := soul.NewEngine(nil, toolset.NewRegistry())
	output := captureStdout(t, func() { handleExecutePlan("/execute-plan plan.txt", cfg, &engine, toolset.NewRegistry(), false) })
	if !strings.Contains(output, "必须是 .md") {
		t.Fatalf("expected markdown validation error, got %q", output)
	}
}

func TestRunOnceStreamDoesNotPrintReasoningOrDuplicateFinal(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprintln(w, `data: {"choices":[{"delta":{"reasoning_content":"hidden reasoning"}}]}`)
		_, _ = fmt.Fprintln(w)
		_, _ = fmt.Fprintln(w, `data: {"choices":[{"delta":{"content":"pong"}}]}`)
		_, _ = fmt.Fprintln(w)
		_, _ = fmt.Fprintln(w, "data: [DONE]")
	}))
	defer server.Close()

	cfg := &config.Config{
		DefaultProfile: "default",
		Providers:      map[string]config.Provider{"mock": {BaseURL: server.URL, APIKey: "test-key"}},
		Profiles: map[string]config.Profile{
			"default": {Provider: "mock", Model: "mock-model", Stream: true, MaxSteps: 1},
		},
		PermissionProfiles: config.DefaultPermissionProfiles(),
	}
	output := captureStdout(t, func() {
		runOnce(cfg, toolset.NewRegistry(), "reply pong")
	})
	if strings.Contains(output, "hidden reasoning") {
		t.Fatalf("expected reasoning to be suppressed, got %q", output)
	}
	if strings.Count(output, "pong") != 1 {
		t.Fatalf("expected exactly one pong, got %q", output)
	}
}

func captureStdout(t *testing.T, fn func()) string {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdout = w
	fn()
	_ = w.Close()
	os.Stdout = old
	data, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestRunWireInitializeWithoutConfig(t *testing.T) {
	in := strings.NewReader(`{"jsonrpc":"2.0","method":"initialize","id":"init_1","params":{}}` + "\n")
	out := &bytes.Buffer{}

	if err := runWire(nil, toolset.NewRegistry(), in, out, false); err != nil {
		t.Fatalf("runWire failed: %v", err)
	}

	msgs := decodeWireRPCOutput(t, out.String())
	if len(msgs) != 1 || string(msgs[0].ID) != `"init_1"` || msgs[0].Error != nil {
		t.Fatalf("unexpected initialize output: %s", out.String())
	}
}

func TestRunWireSetPlanModeEmitsStatusUpdate(t *testing.T) {
	in := strings.NewReader(`{"jsonrpc":"2.0","method":"set_plan_mode","id":"plan_1","params":{"enabled":true}}` + "\n")
	out := &bytes.Buffer{}

	if err := runWire(nil, toolset.NewRegistry(), in, out, false); err != nil {
		t.Fatalf("runWire failed: %v", err)
	}

	msgs := decodeWireRPCOutput(t, out.String())
	if !hasWireRPCID(msgs, `"plan_1"`) || !hasWireEventType(t, msgs, wire.EventStatusUpdate) {
		t.Fatalf("expected status update event and response, got %s", out.String())
	}
}

func TestRunWireSteerAndCancel(t *testing.T) {
	in := strings.NewReader(strings.Join([]string{
		`{"jsonrpc":"2.0","method":"steer","id":"steer_1","params":{"user_input":"extra"}}`,
		`{"jsonrpc":"2.0","method":"cancel","id":"cancel_1"}`,
		"",
	}, "\n"))
	out := &bytes.Buffer{}

	if err := runWire(nil, toolset.NewRegistry(), in, out, false); err != nil {
		t.Fatalf("runWire failed: %v", err)
	}

	msgs := decodeWireRPCOutput(t, out.String())
	if !hasWireRPCID(msgs, `"steer_1"`) || !hasWireRPCID(msgs, `"cancel_1"`) {
		t.Fatalf("expected steer and cancel responses, got %s", out.String())
	}
}

func TestRunWireRecordsWireJSONL(t *testing.T) {
	store := &session.SessionStore{BaseDir: t.TempDir()}
	in := strings.NewReader(`{"jsonrpc":"2.0","method":"set_plan_mode","id":"plan_record","params":{"enabled":true}}` + "\n")
	out := &bytes.Buffer{}

	if err := runWireWithOptions(nil, toolset.NewRegistry(), in, out, false, wireRunOptions{SessionStore: store}); err != nil {
		t.Fatalf("runWireWithOptions failed: %v", err)
	}
	sessions := store.List()
	if len(sessions) != 1 {
		t.Fatalf("expected one wire session, got %d", len(sessions))
	}
	data, err := os.ReadFile(filepath.Join(sessions[0].Dir, "wire.jsonl"))
	if err != nil {
		t.Fatalf("read wire.jsonl: %v", err)
	}
	messages, err := wire.Replay(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("replay wire.jsonl: %v", err)
	}
	if len(messages) != 1 || messages[0].Event == nil || messages[0].Event.Type != wire.EventStatusUpdate {
		t.Fatalf("expected recorded StatusUpdate, got %+v", messages)
	}
}

func TestRunWireReplayOutputsJSONRPC(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wire.jsonl")
	var records bytes.Buffer
	recorder := wire.NewRecorder(&records)
	event, err := wire.NewEvent(wire.EventContentPart, wire.ContentPart{Type: wire.ContentText, Text: "hello"})
	if err != nil {
		t.Fatal(err)
	}
	req, err := wire.NewRequest("approval_1", wire.RequestApproval, wire.ApprovalRequest{ID: "approval_1", Action: "write_file"})
	if err != nil {
		t.Fatal(err)
	}
	if err := recorder.Record(wire.WireMessage{Kind: wire.MessageEvent, Event: &event}); err != nil {
		t.Fatal(err)
	}
	if err := recorder.Record(wire.WireMessage{Kind: wire.MessageRequest, Request: &req}); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, records.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}

	out := &bytes.Buffer{}
	if err := runWireReplay(path, out); err != nil {
		t.Fatalf("runWireReplay failed: %v", err)
	}
	msgs := decodeWireRPCOutput(t, out.String())
	if len(msgs) != 2 {
		t.Fatalf("expected two replayed rpc messages, got %d: %s", len(msgs), out.String())
	}
	if msgs[0].Method != wire.MethodEvent || msgs[1].Method != wire.MethodRequest || string(msgs[1].ID) != `"approval_1"` {
		t.Fatalf("unexpected replay output: %s", out.String())
	}
}

func TestRunWirePromptEmitsToolEvents(t *testing.T) {
	filePath := filepath.Join(t.TempDir(), "fixture.txt")
	if err := os.WriteFile(filePath, []byte("fixture content"), 0644); err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read request body: %v", err)
		}
		var req struct {
			Messages []struct {
				Role string `json:"role"`
			} `json:"messages"`
		}
		if err := json.Unmarshal(body, &req); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		if len(req.Messages) > 0 && req.Messages[len(req.Messages)-1].Role == "tool" {
			_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"done"}}],"usage":{"total_tokens":2}}`))
			return
		}
		response := map[string]any{
			"choices": []map[string]any{{
				"message": map[string]any{
					"role":    "assistant",
					"content": "",
					"tool_calls": []map[string]any{{
						"id":   "tc_read",
						"type": "function",
						"function": map[string]any{
							"name":      "read_file",
							"arguments": `{"path":"` + filePath + `"}`,
						},
					}},
				},
			}},
			"usage": map[string]any{"total_tokens": 1},
		}
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	cfg := &config.Config{
		DefaultProfile: "default",
		Providers: map[string]config.Provider{
			"mock": {BaseURL: server.URL, APIKey: "test-key"},
		},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "mock", Model: "mock-model", MaxSteps: 4, AutoApprove: "ask"},
		},
	}
	tools := toolset.NewRegistry()
	registerTools(tools)
	in := strings.NewReader(`{"jsonrpc":"2.0","method":"prompt","id":"prompt_1","params":{"user_input":"read fixture"}}` + "\n")
	out := &bytes.Buffer{}

	if err := runWire(cfg, tools, in, out, false); err != nil {
		t.Fatalf("runWire failed: %v", err)
	}

	msgs := decodeWireRPCOutput(t, out.String())
	if !hasWireEventType(t, msgs, wire.EventStepBegin) || !hasWireEventType(t, msgs, wire.EventToolCall) || !hasWireEventType(t, msgs, wire.EventToolResult) || !hasWireEventType(t, msgs, wire.EventTurnEnd) {
		t.Fatalf("expected step/tool/turn events, got %s", out.String())
	}
	if !hasWireRPCID(msgs, `"prompt_1"`) {
		t.Fatalf("expected prompt response, got %s", out.String())
	}
	turnEndIndex := wireEventIndex(t, msgs, wire.EventTurnEnd)
	responseIndex := wireRPCIDIndex(msgs, `"prompt_1"`)
	if turnEndIndex < 0 || responseIndex < 0 || turnEndIndex > responseIndex {
		t.Fatalf("expected TurnEnd before prompt response, got %s", out.String())
	}
}

func TestRequestWireApprovalApprovesResponse(t *testing.T) {
	approvalRequestSeq = 0
	w := wire.NewWire()
	requests, cancel := w.UISide().SubscribeRaw()
	defer cancel()

	resultCh := make(chan bool, 1)
	go func() {
		resultCh <- requestWireApproval(context.Background(), w, "write_file", "write_file test")
	}()

	msg := receiveWireMessageForTest(t, requests)
	if msg.Request == nil || msg.Request.Type != wire.RequestApproval || msg.Request.ID != "approval_1" {
		t.Fatalf("expected approval request, got %+v", msg)
	}
	w.ResolveResponse("approval_1", json.RawMessage(`{"request_id":"approval_1","response":"approve"}`))

	select {
	case approved := <-resultCh:
		if !approved {
			t.Fatal("expected approval response to approve request")
		}
	case <-time.After(time.Second):
		t.Fatal("approval did not receive response")
	}
}

func TestConfigureEngineForWirePublishesCompactionEvents(t *testing.T) {
	w := wire.NewWire()
	msgs, cancel := w.UISide().SubscribeRaw()
	defer cancel()
	engine := soul.NewEngine(nil, toolset.NewRegistry())
	configureEngineForWire(engine, w)

	engine.OnCompactBegin()
	engine.OnCompactEnd()

	begin := receiveWireMessageForTest(t, msgs)
	if begin.Event == nil || begin.Event.Type != wire.EventCompactionBegin {
		t.Fatalf("expected CompactionBegin event, got %+v", begin)
	}
	end := receiveWireMessageForTest(t, msgs)
	if end.Event == nil || end.Event.Type != wire.EventCompactionEnd {
		t.Fatalf("expected CompactionEnd event, got %+v", end)
	}
}

func TestRunWireApprovalWritesFileEndToEnd(t *testing.T) {
	approvalRequestSeq = 0
	dir := t.TempDir()
	filePath := filepath.Join(dir, "approved.txt")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read request body: %v", err)
		}
		var req struct {
			Messages []struct {
				Role string `json:"role"`
			} `json:"messages"`
		}
		if err := json.Unmarshal(body, &req); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		if len(req.Messages) > 0 && req.Messages[len(req.Messages)-1].Role == "tool" {
			_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"done"}}],"usage":{"total_tokens":2}}`))
			return
		}
		response := map[string]any{
			"choices": []map[string]any{{
				"message": map[string]any{
					"role":    "assistant",
					"content": "",
					"tool_calls": []map[string]any{{
						"id":   "tc_write",
						"type": "function",
						"function": map[string]any{
							"name":      "write_file",
							"arguments": `{"path":"` + filePath + `","content":"approved content"}`,
						},
					}},
				},
			}},
			"usage": map[string]any{"total_tokens": 1},
		}
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	cfg := &config.Config{
		DefaultProfile: "default",
		Providers: map[string]config.Provider{
			"mock": {BaseURL: server.URL, APIKey: "test-key"},
		},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "mock", Model: "mock-model", MaxSteps: 4, AutoApprove: "ask"},
		},
	}
	tools := toolset.NewRegistry()
	registerTools(tools)
	inR, inW := io.Pipe()
	outR, outW := io.Pipe()
	runErr := make(chan error, 1)
	go func() {
		runErr <- runWire(cfg, tools, inR, outW, false)
		_ = outW.Close()
	}()

	msgs, scanErr := scanWireOutput(outR)
	_, _ = fmt.Fprintln(inW, `{"jsonrpc":"2.0","method":"prompt","id":"prompt_approval","params":{"user_input":"write approved file"}}`)
	approvalID := ""
	var collected []wire.RPCMessage
	for approvalID == "" {
		msg := receiveRPCMessageForTest(t, msgs)
		collected = append(collected, msg)
		if msg.Method != wire.MethodRequest {
			continue
		}
		var payload wire.TypedPayload
		if err := json.Unmarshal(msg.Params, &payload); err != nil {
			t.Fatalf("decode request params: %v", err)
		}
		if payload.Type == string(wire.RequestApproval) {
			if err := json.Unmarshal(msg.ID, &approvalID); err != nil {
				t.Fatalf("decode approval id: %v", err)
			}
		}
	}
	_, _ = fmt.Fprintf(inW, `{"jsonrpc":"2.0","id":%q,"result":{"request_id":%q,"response":"approve"}}`+"\n", approvalID, approvalID)
	_ = inW.Close()

	for msg := range msgs {
		collected = append(collected, msg)
	}
	if err := <-scanErr; err != nil {
		t.Fatalf("scan output failed: %v", err)
	}
	if err := <-runErr; err != nil {
		t.Fatalf("runWire failed: %v", err)
	}
	data, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("expected approved file to be written: %v", err)
	}
	if string(data) != "approved content" {
		t.Fatalf("unexpected file content: %q", data)
	}
	if !hasWireEventType(t, collected, wire.EventToolResult) || !hasWireEventType(t, collected, wire.EventTurnEnd) || !hasWireRPCID(collected, `"prompt_approval"`) {
		t.Fatalf("expected tool result, turn end, and prompt response, got %+v", collected)
	}
}

func decodeWireRPCOutput(t *testing.T, output string) []wire.RPCMessage {
	t.Helper()
	lines := strings.Split(strings.TrimSpace(output), "\n")
	msgs := make([]wire.RPCMessage, 0, len(lines))
	for _, line := range lines {
		if line == "" {
			continue
		}
		var msg wire.RPCMessage
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			t.Fatalf("decode line %q: %v", line, err)
		}
		msgs = append(msgs, msg)
	}
	return msgs
}

func scanWireOutput(r io.Reader) (<-chan wire.RPCMessage, <-chan error) {
	msgs := make(chan wire.RPCMessage, 32)
	errs := make(chan error, 1)
	go func() {
		defer close(msgs)
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			var msg wire.RPCMessage
			if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
				errs <- err
				return
			}
			msgs <- msg
		}
		errs <- scanner.Err()
	}()
	return msgs, errs
}

func receiveRPCMessageForTest(t *testing.T, ch <-chan wire.RPCMessage) wire.RPCMessage {
	t.Helper()
	select {
	case msg, ok := <-ch:
		if !ok {
			t.Fatal("wire output closed before expected message")
		}
		return msg
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for wire output")
		return wire.RPCMessage{}
	}
}

func receiveWireMessageForTest(t *testing.T, ch <-chan wire.WireMessage) wire.WireMessage {
	t.Helper()
	select {
	case msg := <-ch:
		return msg
	case <-time.After(time.Second):
		t.Fatal("wire message was not published")
		return wire.WireMessage{}
	}
}

func hasWireRPCID(msgs []wire.RPCMessage, id string) bool {
	return wireRPCIDIndex(msgs, id) >= 0
}

func wireRPCIDIndex(msgs []wire.RPCMessage, id string) int {
	for i, msg := range msgs {
		if string(msg.ID) == id {
			return i
		}
	}
	return -1
}

func hasWireEventType(t *testing.T, msgs []wire.RPCMessage, eventType wire.EventType) bool {
	return wireEventIndex(t, msgs, eventType) >= 0
}

func wireEventIndex(t *testing.T, msgs []wire.RPCMessage, eventType wire.EventType) int {
	t.Helper()
	for i, msg := range msgs {
		if msg.Method != wire.MethodEvent {
			continue
		}
		var payload wire.TypedPayload
		if err := json.Unmarshal(msg.Params, &payload); err != nil {
			t.Fatalf("decode event params: %v", err)
		}
		if payload.Type == string(eventType) {
			return i
		}
	}
	return -1
}
