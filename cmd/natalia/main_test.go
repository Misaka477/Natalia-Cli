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

	"github.com/Misaka477/Natalia-Cli/internal/approval"
	"github.com/Misaka477/Natalia-Cli/internal/autoflow"
	"github.com/Misaka477/Natalia-Cli/internal/chat"
	"github.com/Misaka477/Natalia-Cli/internal/config"
	"github.com/Misaka477/Natalia-Cli/internal/hook"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/notifications"
	"github.com/Misaka477/Natalia-Cli/internal/plan"
	"github.com/Misaka477/Natalia-Cli/internal/planexec"
	"github.com/Misaka477/Natalia-Cli/internal/processmgr"
	"github.com/Misaka477/Natalia-Cli/internal/session"
	"github.com/Misaka477/Natalia-Cli/internal/soul"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
	"github.com/Misaka477/Natalia-Cli/internal/wire"
	"github.com/Misaka477/Natalia-Cli/internal/worker"
)

func testBoolPtr(v bool) *bool { return &v }

type bridgeReadTool struct{}

func (bridgeReadTool) Name() string                           { return "read_file" }
func (bridgeReadTool) Description() string                    { return "bridge read" }
func (bridgeReadTool) Execute(map[string]any) (string, error) { return "ok", nil }
func (bridgeReadTool) Parameters() map[string]llm.Property    { return nil }
func (bridgeReadTool) Required() []string                     { return nil }

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
	engine.Context.Messages = append(engine.Context.Messages, chat.Message{Role: chat.RoleUser, Content: "12345678"})
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
		"context_tokens: 2/128000 (0.0% estimated)",
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

func TestBuildEngineAttachesConfiguredHooks(t *testing.T) {
	dir := t.TempDir()
	cfg := &config.Config{
		DefaultProfile:     "default",
		Providers:          map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles:           map[string]config.Profile{"default": {Provider: "p", Model: "base"}},
		Hooks: []config.HookDef{
			{ID: "notify", Event: "Notification", Target: "build", Command: "tee hook.json >/dev/null", Cwd: dir, TimeoutSec: 1},
		},
	}
	engine := buildEngine(cfg, toolset.NewRegistry(), false)
	if engine.Hooks == nil || len(engine.Hooks.Hooks()) != 1 {
		t.Fatalf("expected buildEngine to attach configured hooks, got %+v", engine.Hooks)
	}
	if len(engine.InjectionProviders) == 0 {
		t.Fatal("expected buildEngine to attach default injection providers")
	}
	results := engine.Hooks.Trigger(context.Background(), hook.EventNotification, "build", map[string]any{"message": "done"})
	if len(results) != 1 || results[0].Error != "" {
		t.Fatalf("expected configured hook to run, got %+v", results)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "hook.json"))
	if err != nil {
		t.Fatal(err)
	}
	var input hook.TriggerInput
	if err := json.Unmarshal(raw, &input); err != nil {
		t.Fatal(err)
	}
	if input.Event != hook.EventNotification || input.Target != "build" || input.InputData["message"] != "done" {
		t.Fatalf("unexpected hook payload: %+v", input)
	}
}

func TestBuildEngineLoadsModeAwareMCPTools(t *testing.T) {
	resetMCPClientsForTest(t)
	cfg := &config.Config{
		DefaultProfile:     "default",
		Providers:          map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "p", Model: "base", Mode: "code", Modes: map[string]config.ModeProfile{
				"code": {MCPServers: []string{"fixture"}},
			}},
		},
		MCPServers: map[string]config.MCPServerConfig{
			"fixture": {Command: os.Args[0], Args: []string{"-test.run=TestNataliaMCPStubServer", "--", "natalia-mcp-stub"}, TimeoutSec: 2, AllowedTools: []string{"echo"}, ReadOnly: true},
		},
	}
	tools := toolset.NewRegistry()
	engine := buildEngine(cfg, tools, false)
	tool, ok := tools.Get("mcp_fixture_echo")
	if !ok {
		t.Fatalf("expected MCP tool to be registered")
	}
	if engine.Mode == nil || !engine.Mode.ToolFilter("mcp_fixture_echo", nil) {
		t.Fatalf("expected current mode to allow configured MCP server tools")
	}
	if approval.IsWriteTool("mcp_fixture_echo") {
		t.Fatal("read_only MCP server tool should not require approval")
	}
	out, err := tool.Execute(map[string]any{"text": "from natalia"})
	if err != nil {
		t.Fatal(err)
	}
	if out != "from natalia" {
		t.Fatalf("unexpected MCP tool output: %q", out)
	}
	if _, ok := tools.Get("mcp_fixture_mutate"); ok {
		t.Fatal("excluded or non-allowed MCP tool should not be registered")
	}
}

func TestBuildEngineRegistersMutatingMCPToolsForApproval(t *testing.T) {
	resetMCPClientsForTest(t)
	cfg := &config.Config{
		DefaultProfile:     "default",
		Providers:          map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "p", Model: "base", Modes: map[string]config.ModeProfile{"code": {MCPServers: []string{"fixture"}}}},
		},
		MCPServers: map[string]config.MCPServerConfig{
			"fixture": {Command: os.Args[0], Args: []string{"-test.run=TestNataliaMCPStubServer", "--", "natalia-mcp-stub"}, TimeoutSec: 2, AllowedTools: []string{"mutate"}},
		},
	}
	tools := toolset.NewRegistry()
	_ = buildEngine(cfg, tools, false)
	if _, ok := tools.Get("mcp_fixture_mutate"); !ok {
		t.Fatal("expected mutating MCP tool to be registered")
	}
	if !approval.IsWriteTool("mcp_fixture_mutate") {
		t.Fatal("non-read_only MCP server tool should require approval")
	}
}

func TestLoadMCPServersKeepsGoodServerWhenAnotherFails(t *testing.T) {
	resetMCPClientsForTest(t)
	cfg := &config.Config{MCPServers: map[string]config.MCPServerConfig{
		"bad":     {Command: filepath.Join(t.TempDir(), "missing-mcp")},
		"fixture": {Command: os.Args[0], Args: []string{"-test.run=TestNataliaMCPStubServer", "--", "natalia-mcp-stub"}, TimeoutSec: 2, AllowedTools: []string{"echo"}, ReadOnly: true},
	}}
	tools := toolset.NewRegistry()
	err := loadMCPServers(cfg, tools, &config.ModeProfile{MCPServers: []string{"bad", "fixture"}})
	if err == nil || !strings.Contains(err.Error(), "bad:") {
		t.Fatalf("expected bad server error while continuing, got %v", err)
	}
	if _, ok := tools.Get("mcp_fixture_echo"); !ok {
		t.Fatal("expected good server tool to be registered despite another server failing")
	}
}

func TestCloseMCPClientsClearsAndStopsTrackedClients(t *testing.T) {
	resetMCPClientsForTest(t)
	client, err := mcpClientForServer("fixture", config.MCPServerConfig{Command: os.Args[0], Args: []string{"-test.run=TestNataliaMCPStubServer", "--", "natalia-mcp-stub"}, TimeoutSec: 2})
	if err != nil {
		t.Fatal(err)
	}
	if client == nil || len(mcpClients) != 1 {
		t.Fatalf("expected tracked MCP client, got %+v", mcpClients)
	}
	closeMCPClients()
	if len(mcpClients) != 0 {
		t.Fatalf("expected MCP clients to be cleared, got %+v", mcpClients)
	}
}

func resetMCPClientsForTest(t *testing.T) {
	t.Helper()
	closeMCPClients()
	t.Cleanup(func() {
		closeMCPClients()
	})
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

func TestSessionsRestoreRestoresRuntimePlanAndMessages(t *testing.T) {
	oldStore := sessStore
	oldSession := currentSession
	oldRuntime := runtime
	oldPlan := currentPlan
	oldConfig := activeConfig
	plan.Exit()
	t.Cleanup(func() {
		sessStore = oldStore
		currentSession = oldSession
		runtime = oldRuntime
		currentPlan = oldPlan
		activeConfig = oldConfig
		plan.Exit()
	})

	sessStore = &session.SessionStore{BaseDir: t.TempDir()}
	sess := sessStore.NewSession("base-model")
	planPath := filepath.Join(t.TempDir(), "roadmap.md")
	if err := os.WriteFile(planPath, []byte("# Plan\n\n- [ ] first\n- [ ] second"), 0644); err != nil {
		t.Fatal(err)
	}
	currentSession = sess
	activeConfig = nil
	runtime = runtimeOverrides{Mode: "debug", ModelProfile: "strongest", PermissionProfile: "read_only"}
	currentPlan = planexec.Parse(planPath, "# Plan\n\n- [ ] first\n- [ ] second")
	currentPlan.MarkNextDone()
	plan.Enter("roadmap", planPath, "test")
	persistCurrentSessionState()
	if err := sessStore.AppendMessage(sess.ID, chat.Message{Role: chat.RoleUser, Content: "remember me"}); err != nil {
		t.Fatal(err)
	}

	currentSession = nil
	runtime = runtimeOverrides{}
	currentPlan = nil
	plan.Exit()
	cfg := &config.Config{
		DefaultProfile: "default",
		Providers:      map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		ModelProfiles: map[string]config.ModelProfile{
			"strongest": {Provider: "p", Model: "strong-model"},
		},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "p", Model: "base-model", Mode: "code"},
		},
	}
	tools := toolset.NewRegistry()
	engine := buildEngine(cfg, tools, false)

	output := captureStdout(t, func() { handleSessions("/sessions restore 1", cfg, &engine, tools, false) })
	if !strings.Contains(output, "已恢复会话") {
		t.Fatalf("expected restore output, got %q", output)
	}
	if currentSession == nil || currentSession.ID != sess.ID {
		t.Fatalf("expected current session restored, got %+v", currentSession)
	}
	if runtime.Mode != "debug" || runtime.ModelProfile != "strongest" || runtime.PermissionProfile != "read_only" {
		t.Fatalf("expected runtime restored, got %+v", runtime)
	}
	if currentPlan == nil || currentPlan.Path != planPath || !currentPlan.Steps[0].Done || currentPlan.Steps[1].Done {
		t.Fatalf("expected plan restored with persisted done line, got %+v", currentPlan)
	}
	if step, ok := currentPlan.NextOpenStep(); !ok || step.Text != "second" {
		t.Fatalf("expected current disk checklist to determine next open step, step=%+v ok=%v", step, ok)
	}
	if plan.Status().Enabled != true || plan.Status().Path != planPath {
		t.Fatalf("expected plan mode restored, got %+v", plan.Status())
	}
	found := false
	for _, msg := range engine.Context.Messages {
		if msg.Role == chat.RoleUser && msg.Content == "remember me" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected restored messages in engine context: %+v", engine.Context.Messages)
	}
	if engine.Snapshotter == nil {
		t.Fatal("expected restore to attach snapshotter for restored session")
	}
}

func TestSessionsListShowsContextTokens(t *testing.T) {
	oldStore := sessStore
	t.Cleanup(func() { sessStore = oldStore })
	sessStore = &session.SessionStore{BaseDir: t.TempDir()}
	sess := sessStore.NewSession("base-model")
	if err := sessStore.AppendMessage(sess.ID, chat.Message{Role: chat.RoleUser, Content: "12345678"}); err != nil {
		t.Fatal(err)
	}
	output := captureStdout(t, func() { handleSessions("/sessions", nil, nil, toolset.NewRegistry(), false) })
	if !strings.Contains(output, "context_tokens=2") || !strings.Contains(output, sess.ID) {
		t.Fatalf("expected sessions list to show context token estimate and id, got %q", output)
	}
}

func TestPersistCurrentSessionStateStoresConfiguredAdditionalDirs(t *testing.T) {
	oldStore := sessStore
	oldSession := currentSession
	oldRuntime := runtime
	oldConfig := activeConfig
	t.Cleanup(func() {
		sessStore = oldStore
		currentSession = oldSession
		runtime = oldRuntime
		activeConfig = oldConfig
	})
	dir := t.TempDir()
	sessStore = &session.SessionStore{BaseDir: t.TempDir()}
	currentSession = sessStore.NewSession("base-model")
	runtime = runtimeOverrides{Mode: "code"}
	activeConfig = &config.Config{
		DefaultProfile:     "default",
		Providers:          map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "p", Model: "base-model", Mode: "code", AdditionalDirs: []string{dir, "", dir}},
		},
	}

	persistCurrentSessionState()
	state, err := sessStore.LoadState(currentSession.ID)
	if err != nil {
		t.Fatalf("LoadState failed: %v", err)
	}
	if len(state.AdditionalDirs) != 1 || state.AdditionalDirs[0] != dir {
		t.Fatalf("expected deduplicated configured additional dirs, got %+v", state.AdditionalDirs)
	}
}

func TestSessionsRestoreWarnsAndDropsStaleRuntimeOverrides(t *testing.T) {
	oldStore := sessStore
	oldSession := currentSession
	oldRuntime := runtime
	oldConfig := activeConfig
	t.Cleanup(func() {
		sessStore = oldStore
		currentSession = oldSession
		runtime = oldRuntime
		activeConfig = oldConfig
	})
	sessStore = &session.SessionStore{BaseDir: t.TempDir()}
	sess := sessStore.NewSession("base-model")
	missingDir := filepath.Join(t.TempDir(), "missing")
	notDir := filepath.Join(t.TempDir(), "file.txt")
	if err := os.WriteFile(notDir, []byte("not a dir"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := sessStore.SaveState(sess.ID, session.State{Mode: "ghost", ModelProfile: "deleted", PermissionProfile: "missing", AdditionalDirs: []string{missingDir, notDir}}); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{
		DefaultProfile:     "default",
		Providers:          map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "p", Model: "base-model", Mode: "code"},
		},
	}
	engine := buildEngine(cfg, toolset.NewRegistry(), false)

	output := captureStdout(t, func() { handleSessions("/sessions restore 1", cfg, &engine, toolset.NewRegistry(), false) })
	for _, want := range []string{"已恢复会话", "已忽略已失效 mode", "已忽略已失效 model_profile", "已忽略已失效 permission_profile", "additional_dir", "不是目录"} {
		if !strings.Contains(output, want) {
			t.Fatalf("expected restore output to contain %q, got %q", want, output)
		}
	}
	if runtime != (runtimeOverrides{}) {
		t.Fatalf("expected stale overrides to be dropped, got %+v", runtime)
	}
	if engine.Mode == nil || engine.Mode.Name != "code" {
		t.Fatalf("expected restored engine to fall back to code mode, got %+v", engine.Mode)
	}
}

func TestFormatElapsedForTurnDisplay(t *testing.T) {
	if got := formatElapsed(1500 * time.Millisecond); got != "1s" {
		t.Fatalf("expected truncated seconds, got %q", got)
	}
	if got := formatElapsed(250 * time.Millisecond); got != "250ms" {
		t.Fatalf("expected milliseconds, got %q", got)
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
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })
	in := strings.NewReader(`{"jsonrpc":"2.0","method":"set_plan_mode","id":"plan_1","params":{"enabled":true}}` + "\n")
	out := &bytes.Buffer{}

	if err := runWire(nil, toolset.NewRegistry(), in, out, false); err != nil {
		t.Fatalf("runWire failed: %v", err)
	}

	msgs := decodeWireRPCOutput(t, out.String())
	if !hasWireRPCID(msgs, `"plan_1"`) || !hasWireEventType(t, msgs, wire.EventStatusUpdate) {
		t.Fatalf("expected status update event and response, got %s", out.String())
	}
	if state := plan.Status(); !state.Enabled || state.Reason != "wire set_plan_mode" {
		t.Fatalf("expected wire set_plan_mode to update plan state, got %+v", state)
	}
}

func TestRunWireSetRuntimeProfileEmitsStatusAndPreservesState(t *testing.T) {
	oldRuntime := runtime
	runtime = runtimeOverrides{}
	t.Cleanup(func() { runtime = oldRuntime })
	cfg := &config.Config{
		DefaultProfile: "default",
		Providers:      map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		ModelProfiles: map[string]config.ModelProfile{
			"cheap": {Provider: "p", Model: "cheap-model"},
		},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "p", Model: "base", Mode: "code", Modes: map[string]config.ModeProfile{"ask": {ModelProfile: "cheap", PermissionProfile: "read_only"}}},
		},
	}
	in := strings.NewReader(`{"jsonrpc":"2.0","method":"set_runtime_profile","id":"runtime_1","params":{"mode":"ask","model_profile":"cheap","permission_profile":"read_only"}}` + "\n")
	out := &bytes.Buffer{}

	if err := runWire(cfg, toolset.NewRegistry(), in, out, false); err != nil {
		t.Fatalf("runWire failed: %v", err)
	}
	msgs := decodeWireRPCOutput(t, out.String())
	if !hasWireRPCID(msgs, `"runtime_1"`) {
		t.Fatalf("expected runtime response, got %s", out.String())
	}
	idx := wireEventIndex(t, msgs, wire.EventStatusUpdate)
	if idx < 0 {
		t.Fatalf("expected status update event, got %s", out.String())
	}
	status := decodeStatusUpdatePayload(t, msgs[idx])
	if status.Mode != "ask" || status.ModelProfile != "cheap" || status.PermissionProfile != "read_only" || status.Model != "cheap-model" {
		t.Fatalf("unexpected status update: %+v", status)
	}
	if status.ContextTokens == nil || *status.ContextTokens < 0 || status.MaxContextTokens == nil || *status.MaxContextTokens <= 0 || status.ContextUsage == nil || *status.ContextUsage < 0 {
		t.Fatalf("expected status update to expose context token window, got %+v", status)
	}
	if runtime.Mode != "ask" || runtime.ModelProfile != "cheap" || runtime.PermissionProfile != "read_only" {
		t.Fatalf("expected runtime override updated, got %+v", runtime)
	}
}

func TestRunWireRestoreSessionRestoresStateAndPublishesStatus(t *testing.T) {
	oldRuntime := runtime
	oldPlan := currentPlan
	runtime = runtimeOverrides{}
	currentPlan = nil
	t.Cleanup(func() { runtime = oldRuntime; currentPlan = oldPlan; plan.Exit() })
	store := &session.SessionStore{BaseDir: t.TempDir()}
	sess := store.NewSession("base-model")
	if err := store.SaveState(sess.ID, session.State{Mode: "debug", ModelProfile: "cheap", PermissionProfile: "read_only"}); err != nil {
		t.Fatal(err)
	}
	if err := store.AppendMessage(sess.ID, chat.Message{Role: chat.RoleUser, Content: "12345678"}); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{
		DefaultProfile:     "default",
		Providers:          map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		ModelProfiles:      map[string]config.ModelProfile{"cheap": {Provider: "p", Model: "cheap-model"}},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "p", Model: "base", Mode: "code"},
		},
	}
	in := strings.NewReader(fmt.Sprintf(`{"jsonrpc":"2.0","method":"restore_session","id":"restore_1","params":{"session_id":%q}}`, sess.ID) + "\n")
	out := &bytes.Buffer{}

	if err := runWireWithOptions(cfg, toolset.NewRegistry(), in, out, false, wireRunOptions{SessionStore: store}); err != nil {
		t.Fatalf("runWireWithOptions failed: %v", err)
	}
	msgs := decodeWireRPCOutput(t, out.String())
	idx := wireEventIndex(t, msgs, wire.EventStatusUpdate)
	if idx < 0 || !hasWireRPCID(msgs, `"restore_1"`) {
		t.Fatalf("expected restore status event and response, got %s", out.String())
	}
	status := decodeStatusUpdatePayload(t, msgs[idx])
	if status.Mode != "debug" || status.ModelProfile != "cheap" || status.PermissionProfile != "read_only" || status.Model != "cheap-model" || status.ContextTokens == nil || *status.ContextTokens == 0 {
		t.Fatalf("unexpected restored status: %+v", status)
	}
	result := decodeRPCResult[struct {
		Status           string   `json:"status"`
		SessionID        string   `json:"session_id"`
		MessagesRestored int      `json:"messages_restored"`
		Warnings         []string `json:"warnings"`
	}](t, msgs[wireRPCIDIndex(msgs, `"restore_1"`)].Result)
	if result.Status != "restored" || result.SessionID != sess.ID || result.MessagesRestored != 1 || len(result.Warnings) != 0 {
		t.Fatalf("unexpected restore result: %+v", result)
	}
	if runtime.Mode != "debug" || runtime.ModelProfile != "cheap" || runtime.PermissionProfile != "read_only" {
		t.Fatalf("expected runtime restored, got %+v", runtime)
	}
}

func TestRunWireListSessionsReturnsStateSummaries(t *testing.T) {
	store := &session.SessionStore{BaseDir: t.TempDir()}
	sess := store.NewSession("base-model")
	if err := store.SaveState(sess.ID, session.State{Mode: "debug", ModelProfile: "cheap", PermissionProfile: "read_only", PlanMode: true, PlanSlug: "roadmap", PlanPath: "plans/roadmap.md"}); err != nil {
		t.Fatal(err)
	}
	if err := store.AppendMessage(sess.ID, chat.Message{Role: chat.RoleUser, Content: "12345678"}); err != nil {
		t.Fatal(err)
	}
	in := strings.NewReader(`{"jsonrpc":"2.0","method":"list_sessions","id":"sessions_1","params":{}}` + "\n")
	out := &bytes.Buffer{}
	if err := runWireWithOptions(nil, toolset.NewRegistry(), in, out, false, wireRunOptions{SessionStore: store}); err != nil {
		t.Fatalf("runWireWithOptions failed: %v", err)
	}
	msgs := decodeWireRPCOutput(t, out.String())
	idx := wireRPCIDIndex(msgs, `"sessions_1"`)
	if idx < 0 {
		t.Fatalf("expected list_sessions response, got %s", out.String())
	}
	result := decodeRPCResult[struct {
		Sessions []struct {
			ID                string `json:"id"`
			Model             string `json:"model"`
			ContextTokens     int    `json:"context_tokens"`
			Mode              string `json:"mode"`
			ModelProfile      string `json:"model_profile"`
			PermissionProfile string `json:"permission_profile"`
			PlanMode          bool   `json:"plan_mode"`
			PlanSlug          string `json:"plan_slug"`
		} `json:"sessions"`
	}](t, msgs[idx].Result)
	found := false
	for _, got := range result.Sessions {
		if got.ID == sess.ID {
			found = true
			if got.Model != "base-model" || got.ContextTokens != 2 || got.Mode != "debug" || got.ModelProfile != "cheap" || got.PermissionProfile != "read_only" || !got.PlanMode || got.PlanSlug != "roadmap" {
				t.Fatalf("unexpected session summary: %+v", got)
			}
		}
	}
	if !found {
		t.Fatalf("expected original session in list, got %+v", result.Sessions)
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
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })
	store := &session.SessionStore{BaseDir: t.TempDir()}
	dir := t.TempDir()
	cfg := &config.Config{
		DefaultProfile:     "default",
		Providers:          map[string]config.Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "p", Model: "base-model", AdditionalDirs: []string{dir}},
		},
	}
	in := strings.NewReader(`{"jsonrpc":"2.0","method":"set_plan_mode","id":"plan_record","params":{"enabled":true}}` + "\n")
	out := &bytes.Buffer{}

	if err := runWireWithOptions(cfg, toolset.NewRegistry(), in, out, false, wireRunOptions{SessionStore: store}); err != nil {
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
	state, err := store.LoadState(sessions[0].ID)
	if err != nil {
		t.Fatalf("load wire session state: %v", err)
	}
	if state.Version != session.StateVersion || !state.PlanMode || len(state.AdditionalDirs) != 1 || state.AdditionalDirs[0] != dir {
		t.Fatalf("expected wire session plan state persisted, got %+v", state)
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
	statusIndex := wireEventIndex(t, msgs, wire.EventStatusUpdate)
	if statusIndex < turnEndIndex || statusIndex > responseIndex {
		t.Fatalf("expected StatusUpdate with context tokens after TurnEnd and before prompt response, got %s", out.String())
	}
	status := decodeStatusUpdatePayload(t, msgs[statusIndex])
	if status.ContextTokens == nil || *status.ContextTokens == 0 || status.MaxContextTokens == nil || *status.MaxContextTokens <= 0 {
		t.Fatalf("expected prompt StatusUpdate to expose non-zero context tokens, got %+v", status)
	}
	if status.TurnRunning == nil || *status.TurnRunning || status.TurnElapsedMS == nil || *status.TurnElapsedMS < 0 {
		t.Fatalf("expected final prompt StatusUpdate to expose completed elapsed time, got %+v", status)
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

func TestRequestWireHookPublishesHookRequestAndReturnsResult(t *testing.T) {
	hookRequestSeq = 0
	w := wire.NewWire()
	requests, cancel := w.UISide().SubscribeRaw()
	defer cancel()

	resultCh := make(chan hook.HookResult, 1)
	go func() {
		resultCh <- requestWireHook(context.Background(), w, hook.WireHookRequest{SubscriptionID: "sub_1", Event: hook.EventPreToolUse, Target: "read_file", InputData: map[string]any{"path": "README.md"}})
	}()

	msg := receiveWireMessageForTest(t, requests)
	if msg.Request == nil || msg.Request.Type != wire.RequestHook || msg.Request.ID != "hook_1" {
		t.Fatalf("expected hook request, got %+v", msg)
	}
	var payload wire.HookRequest
	if err := json.Unmarshal(msg.Request.Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.SubscriptionID != "sub_1" || payload.Event != string(hook.EventPreToolUse) || payload.Target != "read_file" || payload.InputData["path"] != "README.md" {
		t.Fatalf("unexpected hook request payload: %+v", payload)
	}
	w.ResolveResponse("hook_1", json.RawMessage(`{"status":"ok"}`))

	select {
	case result := <-resultCh:
		if result.Error != "" || result.ID != "sub_1" || result.Event != hook.EventPreToolUse || result.Target != "read_file" || result.Stdout != `{"status":"ok"}` {
			t.Fatalf("unexpected hook result: %+v", result)
		}
	case <-time.After(time.Second):
		t.Fatal("hook request did not receive response")
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
	engine.Context.Messages = append(engine.Context.Messages, chat.Message{Role: chat.RoleUser, Content: "12345678"})
	engine.OnCompact("compacted to 2 tokens")
	notification := receiveWireMessageForTest(t, msgs)
	if notification.Event == nil || notification.Event.Type != wire.EventNotification {
		t.Fatalf("expected compaction Notification event, got %+v", notification)
	}
	status := receiveWireMessageForTest(t, msgs)
	if status.Event == nil || status.Event.Type != wire.EventStatusUpdate {
		t.Fatalf("expected compaction StatusUpdate event, got %+v", status)
	}
	var statusPayload wire.StatusUpdate
	if err := json.Unmarshal(status.Event.Payload, &statusPayload); err != nil {
		t.Fatal(err)
	}
	if statusPayload.ContextTokens == nil || *statusPayload.ContextTokens != 2 || statusPayload.MaxContextTokens == nil || *statusPayload.MaxContextTokens <= 0 {
		t.Fatalf("expected compaction status token diagnostics, got %+v", statusPayload)
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

func TestRunWirePromptWaitsForHookRequestResponseEndToEnd(t *testing.T) {
	hookRequestSeq = 0
	llmCalls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		llmCalls++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"hook complete"}}],"usage":{"total_tokens":2}}`))
	}))
	defer server.Close()

	cfg := &config.Config{
		DefaultProfile: "default",
		Providers: map[string]config.Provider{
			"mock": {BaseURL: server.URL, APIKey: "test-key"},
		},
		PermissionProfiles: config.DefaultPermissionProfiles(),
		Profiles: map[string]config.Profile{
			"default": {Provider: "mock", Model: "mock-model", MaxSteps: 2, AutoApprove: "ask"},
		},
		Hooks: []config.HookDef{{ID: "wire-prompt", Event: string(hook.EventUserPromptSubmit), Target: "user_prompt"}},
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
	_, _ = fmt.Fprintln(inW, `{"jsonrpc":"2.0","method":"prompt","id":"prompt_hook","params":{"user_input":"trigger hook"}}`)
	hookID := ""
	var collected []wire.RPCMessage
	for hookID == "" {
		msg := receiveRPCMessageForTest(t, msgs)
		collected = append(collected, msg)
		if msg.Method != wire.MethodRequest {
			continue
		}
		var payload wire.TypedPayload
		if err := json.Unmarshal(msg.Params, &payload); err != nil {
			t.Fatalf("decode hook request params: %v", err)
		}
		if payload.Type != string(wire.RequestHook) {
			continue
		}
		if err := json.Unmarshal(msg.ID, &hookID); err != nil {
			t.Fatalf("decode hook id: %v", err)
		}
		var hookPayload wire.HookRequest
		if err := json.Unmarshal(payload.Payload, &hookPayload); err != nil {
			t.Fatalf("decode hook payload: %v", err)
		}
		if hookPayload.SubscriptionID != "wire-prompt" || hookPayload.Event != string(hook.EventUserPromptSubmit) || hookPayload.Target != "user_prompt" || hookPayload.InputData["user_input"] != "trigger hook" {
			t.Fatalf("unexpected hook payload: %+v", hookPayload)
		}
	}
	if llmCalls != 0 {
		t.Fatalf("expected hook response before LLM request, llmCalls=%d", llmCalls)
	}
	_, _ = fmt.Fprintf(inW, `{"jsonrpc":"2.0","id":%q,"result":{"status":"ok"}}`+"\n", hookID)
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
	if llmCalls != 1 {
		t.Fatalf("expected exactly one LLM request after hook response, got %d", llmCalls)
	}
	if !hasWireEventType(t, collected, wire.EventTurnEnd) || !hasWireRPCID(collected, `"prompt_hook"`) {
		t.Fatalf("expected turn end and prompt response, got %+v", collected)
	}
	if wireEventIndex(t, collected, wire.EventTurnEnd) > wireRPCIDIndex(collected, `"prompt_hook"`) {
		t.Fatalf("expected TurnEnd before prompt response, got %+v", collected)
	}
}

func TestBridgeProcessNotificationsPublishesWireAndInjection(t *testing.T) {
	processmgr.ResetDefaultManagerForTest()
	notifications.ResetDefaultStoreForTest()
	defer processmgr.ResetDefaultManagerForTest()
	defer notifications.ResetDefaultStoreForTest()
	w := wire.NewWire()
	msgs, cancel := w.UISide().SubscribeRaw()
	defer cancel()
	engine := soul.NewEngine(nil, toolset.NewRegistry())
	detach := bridgeProcessNotifications(engine, w)
	defer detach()
	sess, err := processmgr.DefaultManager().Start(context.Background(), processmgr.StartOptions{Kind: processmgr.KindBackground, Command: "/bin/sh", Args: []string{"-c", "exit 0"}})
	if err != nil {
		t.Fatal(err)
	}
	var notification wire.Notification
	deadline := time.After(2 * time.Second)
	for notification.Message == "" {
		select {
		case msg := <-msgs:
			if msg.Event == nil || msg.Event.Type != wire.EventNotification {
				continue
			}
			if err := json.Unmarshal(msg.Event.Payload, &notification); err != nil {
				t.Fatal(err)
			}
		case <-deadline:
			t.Fatalf("timed out waiting for background notification for %s", sess.ID)
		}
	}
	if notification.Title != "Background task completed" || !strings.Contains(notification.Message, sess.ID) || !strings.Contains(notification.Message, "exit_code=0") {
		t.Fatalf("unexpected wire notification: %+v", notification)
	}
	provider := soul.NotificationInjectionProvider{Store: notifications.DefaultStore()}
	injections, err := provider.GetInjections(nil, engine)
	if err != nil {
		t.Fatalf("GetInjections failed: %v", err)
	}
	if len(injections) != 1 || !strings.Contains(injections[0].Content, sess.ID) || !strings.Contains(injections[0].Content, "Background task completed") {
		t.Fatalf("expected background notification injection, got %+v", injections)
	}
}

func TestBridgeWorkerEventsPublishesSubagentWireEvents(t *testing.T) {
	oldPool := workerPool
	t.Cleanup(func() { workerPool = oldPool })
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
	workerPool = worker.NewPool()
	w := wire.NewWire()
	msgs, cancel := w.UISide().SubscribeRaw()
	defer cancel()
	detach := bridgeWorkerEvents(w)
	defer detach()
	tools := toolset.NewRegistry()
	tools.Register(bridgeReadTool{})
	workerInstance, err := workerPool.Spawn("bridge subagent", "code", llm.NewClient(llm.Config{BaseURL: server.URL, Model: "mock", APIKey: "test"}), tools)
	if err != nil {
		t.Fatal(err)
	}
	var seenCreated, seenToolLog, seenCompleted bool
	deadline := time.After(2 * time.Second)
	for !(seenCreated && seenToolLog && seenCompleted) {
		select {
		case msg := <-msgs:
			if msg.Event == nil || msg.Event.Type != wire.EventSubagentEvent {
				continue
			}
			var sub wire.SubagentEvent
			if err := json.Unmarshal(msg.Event.Payload, &sub); err != nil {
				t.Fatal(err)
			}
			if sub.ID != workerInstance.ID {
				t.Fatalf("unexpected subagent id: %+v", sub)
			}
			var payload worker.Event
			if err := json.Unmarshal(sub.Payload, &payload); err != nil {
				t.Fatal(err)
			}
			switch {
			case sub.Event == "created":
				seenCreated = true
			case sub.Event == "log" && payload.Log != nil && payload.Log.Tool == "read_file":
				seenToolLog = true
			case sub.Event == "status" && payload.Status == worker.StatusCompleted:
				seenCompleted = true
			}
		case <-deadline:
			t.Fatalf("timed out waiting for subagent wire events: created=%t tool=%t completed=%t", seenCreated, seenToolLog, seenCompleted)
		}
	}
}

func TestInteractiveWireRendererRendersContentStatusAndNotification(t *testing.T) {
	var out bytes.Buffer
	var errOut bytes.Buffer
	w, stop := startInteractiveWireRenderer(&out, &errOut)

	publishWireContent(w, wire.ContentThink, "thinking")
	publishWireContent(w, wire.ContentText, "answer")
	running := true
	elapsed := int64(1500)
	status, err := wire.NewEvent(wire.EventStatusUpdate, wire.StatusUpdate{TurnRunning: &running, TurnElapsedMS: &elapsed})
	if err != nil {
		t.Fatal(err)
	}
	w.SoulSide.PublishEvent(status)
	notification, err := wire.NewEvent(wire.EventNotification, wire.Notification{Title: "Background task completed", Message: "proc_1 exited"})
	if err != nil {
		t.Fatal(err)
	}
	w.SoulSide.PublishEvent(notification)
	end, err := wire.NewEvent(wire.EventTurnEnd, wire.TurnEnd{})
	if err != nil {
		t.Fatal(err)
	}
	w.SoulSide.PublishEvent(end)
	stop()

	if !strings.Contains(out.String(), "thinking") || !strings.Contains(out.String(), "answer") || !strings.Contains(out.String(), "\x1b[38;5;245m") || !strings.Contains(out.String(), "\x1b[0m") {
		t.Fatalf("expected renderer output to include reasoning color and answer, got %q", out.String())
	}
	if !strings.Contains(errOut.String(), "[elapsed 1s]") || !strings.Contains(errOut.String(), "Background task completed") || !strings.Contains(errOut.String(), "proc_1 exited") {
		t.Fatalf("expected stderr renderer output to include elapsed status and notification, got %q", errOut.String())
	}
}

func TestConfigureEngineForWireFeedsInteractiveRenderer(t *testing.T) {
	var out bytes.Buffer
	var errOut bytes.Buffer
	w, stop := startInteractiveWireRenderer(&out, &errOut)
	engine := soul.NewEngine(nil, toolset.NewRegistry())
	configureEngineForWire(engine, w)

	engine.OnReasoning("reason")
	engine.OnToken("final")
	end, err := wire.NewEvent(wire.EventTurnEnd, wire.TurnEnd{})
	if err != nil {
		t.Fatal(err)
	}
	w.SoulSide.PublishEvent(end)
	stop()

	if !strings.Contains(out.String(), "reason") || !strings.Contains(out.String(), "final") {
		t.Fatalf("expected engine callbacks to render through wire, got %q", out.String())
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

func TestNataliaMCPStubServer(t *testing.T) {
	if len(os.Args) == 0 || os.Args[len(os.Args)-1] != "natalia-mcp-stub" {
		return
	}
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		var req struct {
			JSONRPC string          `json:"jsonrpc"`
			ID      uint64          `json:"id"`
			Method  string          `json:"method"`
			Params  json.RawMessage `json:"params"`
		}
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			continue
		}
		resp := map[string]any{"jsonrpc": "2.0", "id": req.ID}
		switch req.Method {
		case "initialize":
			resp["result"] = map[string]any{"protocolVersion": "2024-11-05"}
		case "tools/list":
			resp["result"] = map[string]any{"tools": []map[string]any{
				{"name": "echo", "description": "Echo text", "inputSchema": map[string]any{"type": "object", "required": []string{"text"}, "properties": map[string]any{"text": map[string]any{"type": "string"}}}},
				{"name": "mutate", "description": "Mutate state", "inputSchema": map[string]any{"type": "object"}},
			}}
		case "tools/call":
			var params struct {
				Name      string         `json:"name"`
				Arguments map[string]any `json:"arguments"`
			}
			_ = json.Unmarshal(req.Params, &params)
			if params.Name == "echo" {
				resp["result"] = map[string]any{"content": []map[string]any{{"type": "text", "text": params.Arguments["text"]}}}
			} else if params.Name == "mutate" {
				resp["result"] = map[string]any{"content": []map[string]any{{"type": "text", "text": "mutated"}}}
			} else {
				resp["error"] = map[string]any{"code": -32601, "message": "unknown tool"}
			}
		default:
			resp["error"] = map[string]any{"code": -32601, "message": "unknown method"}
		}
		raw, _ := json.Marshal(resp)
		fmt.Println(string(raw))
	}
	os.Exit(0)
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

func decodeStatusUpdatePayload(t *testing.T, msg wire.RPCMessage) wire.StatusUpdate {
	t.Helper()
	var payload wire.TypedPayload
	if err := json.Unmarshal(msg.Params, &payload); err != nil {
		t.Fatalf("decode status update params: %v", err)
	}
	if payload.Type != string(wire.EventStatusUpdate) {
		t.Fatalf("expected StatusUpdate payload, got %s", payload.Type)
	}
	var status wire.StatusUpdate
	if err := json.Unmarshal(payload.Payload, &status); err != nil {
		t.Fatalf("decode status update payload: %v", err)
	}
	return status
}

func decodeRPCResult[T any](t *testing.T, raw json.RawMessage) T {
	t.Helper()
	var result T
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatalf("decode rpc result: %v", err)
	}
	return result
}
