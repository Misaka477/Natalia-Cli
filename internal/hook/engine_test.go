package hook

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestHookEngineRunsMatchingShellHooksWithJSONInput(t *testing.T) {
	dir := t.TempDir()
	outputPath := filepath.Join(dir, "hook.json")
	engine := NewEngine([]HookDef{
		{ID: "ignored", Event: EventPostToolUse, Target: "write_file", Command: "exit 9", Cwd: dir},
		{ID: "pre-write", Event: EventPreToolUse, Target: "write_*", Command: "tee hook.json >/dev/null && printf observed", Cwd: dir, Timeout: time.Second},
	})

	results := engine.Trigger(nil, EventPreToolUse, "write_file", map[string]any{"path": "notes.txt", "size": float64(12)})
	if len(results) != 1 {
		t.Fatalf("expected one matching hook, got %+v", results)
	}
	result := results[0]
	if result.ID != "pre-write" || result.Error != "" || strings.TrimSpace(result.Stdout) != "observed" || !result.Matched {
		t.Fatalf("unexpected hook result: %+v", result)
	}
	raw, err := os.ReadFile(outputPath)
	if err != nil {
		t.Fatalf("expected hook to write JSON input: %v", err)
	}
	var input TriggerInput
	if err := json.Unmarshal(raw, &input); err != nil {
		t.Fatalf("hook stdin was not JSON: %v", err)
	}
	if input.Event != EventPreToolUse || input.Target != "write_file" || input.InputData["path"] != "notes.txt" || input.InputData["size"] != float64(12) {
		t.Fatalf("unexpected hook stdin payload: %+v", input)
	}
}

func TestHookEngineReportsFailuresAndTimeoutsWithoutStoppingOtherHooks(t *testing.T) {
	engine := NewEngine([]HookDef{
		{ID: "fails", Event: EventNotification, Target: "*", Command: "printf bad >&2; exit 7"},
		{ID: "slow", Event: EventNotification, Target: "*", Command: "sleep 2", Timeout: 20 * time.Millisecond},
		{ID: "ok", Event: EventNotification, Target: "*", Command: "printf ok"},
	})

	results := engine.Trigger(nil, EventNotification, "build", map[string]any{"message": "done"})
	if len(results) != 3 {
		t.Fatalf("expected three hook results, got %+v", results)
	}
	byID := map[string]HookResult{}
	for _, result := range results {
		byID[result.ID] = result
	}
	if byID["ok"].Error != "" || strings.TrimSpace(byID["ok"].Stdout) != "ok" {
		t.Fatalf("expected ok hook to succeed, got %+v", byID["ok"])
	}
	if byID["fails"].Error == "" || !strings.Contains(byID["fails"].Stderr, "bad") {
		t.Fatalf("expected failed hook to report stderr/error, got %+v", byID["fails"])
	}
	if !byID["slow"].TimedOut || !strings.Contains(byID["slow"].Error, "timed out") {
		t.Fatalf("expected timeout hook to be visible, got %+v", byID["slow"])
	}
}

func TestHookShellRedactsOutputAndStripsInheritedSensitiveEnv(t *testing.T) {
	t.Setenv("NATALIA_TEST_API_KEY", "host-secret")
	engine := NewEngine([]HookDef{{ID: "env", Event: EventNotification, Target: "*", Command: `printf "${NATALIA_TEST_API_KEY:-missing} token=stdout-secret"; printf " password=stderr-secret" >&2`}})
	results := engine.Trigger(context.Background(), EventNotification, "build", nil)
	if len(results) != 1 {
		t.Fatalf("expected one hook result, got %+v", results)
	}
	result := results[0]
	if strings.Contains(result.Stdout, "host-secret") || strings.Contains(result.Stdout, "stdout-secret") || strings.Contains(result.Stderr, "stderr-secret") {
		t.Fatalf("expected hook output redaction and env stripping, got %+v", result)
	}
	if !strings.Contains(result.Stdout, "missing") || !strings.Contains(result.Stdout, "[redacted]") || !strings.Contains(result.Stderr, "[redacted]") {
		t.Fatalf("expected redaction markers and missing env, got %+v", result)
	}
}

func TestHookEngineReturnsCopiesAndIgnoresInvalidPatterns(t *testing.T) {
	engine := NewEngine([]HookDef{{ID: "copy", Event: EventPreToolUse, Target: "[", Command: "exit 1"}})
	hooks := engine.Hooks()
	hooks[0].Command = "mutated"
	if engine.Hooks()[0].Command == "mutated" {
		t.Fatal("expected Hooks to return a copy")
	}
	if results := engine.Trigger(nil, EventPreToolUse, "read_file", nil); len(results) != 0 {
		t.Fatalf("expected invalid target pattern not to match, got %+v", results)
	}
}

func TestHookEngineRoutesCommandlessHooksToWireHandler(t *testing.T) {
	engine := NewEngine([]HookDef{{ID: "wire-sub", Event: EventPreToolUse, Target: "read_file"}})
	var received WireHookRequest
	engine.OnWireHook = func(ctx context.Context, req WireHookRequest) HookResult {
		received = req
		return HookResult{ID: req.SubscriptionID, Event: req.Event, Target: req.Target, Matched: true, Stdout: "wire-ok"}
	}
	results := engine.Trigger(context.Background(), EventPreToolUse, "read_file", map[string]any{"path": "README.md"})
	if len(results) != 1 || results[0].Error != "" || results[0].Stdout != "wire-ok" {
		t.Fatalf("unexpected wire hook result: %+v", results)
	}
	if received.SubscriptionID != "wire-sub" || received.Event != EventPreToolUse || received.Target != "read_file" || received.InputData["path"] != "README.md" {
		t.Fatalf("unexpected wire hook request: %+v", received)
	}
}

func TestHookEngineWireHandlerDefaultsResultMetadata(t *testing.T) {
	engine := NewEngine([]HookDef{{ID: "wire-defaults", Event: EventPostToolUse, Target: "grep"}})
	engine.OnWireHook = func(ctx context.Context, req WireHookRequest) HookResult {
		return HookResult{Stdout: `{"action":"allow"}`}
	}
	results := engine.Trigger(context.Background(), EventPostToolUse, "grep", map[string]any{"result": "match"})
	if len(results) != 1 {
		t.Fatalf("expected one result, got %+v", results)
	}
	if results[0].ID != "wire-defaults" || results[0].Event != EventPostToolUse || results[0].Target != "grep" || !results[0].Matched || results[0].Stdout != `{"action":"allow"}` {
		t.Fatalf("expected defaulted wire hook metadata, got %+v", results[0])
	}
}

func TestHookEngineParsesStructuredShellResponseAndAudits(t *testing.T) {
	engine := NewEngine([]HookDef{{ID: "policy", Event: EventPreToolUse, Target: "run_shell", Command: `printf '{"action":"deny","reason":"no shell"}'`}})
	results := engine.Trigger(context.Background(), EventPreToolUse, "run_shell", map[string]any{"command": "rm -rf tmp"})
	if len(results) != 1 || results[0].Response.Action != "deny" || results[0].Response.Reason != "no shell" {
		t.Fatalf("expected structured deny response, got %+v", results)
	}
	audit := engine.AuditLog()
	if len(audit) != 1 || audit[0].HookID != "policy" || audit[0].Action != "deny" || audit[0].Reason != "no shell" {
		t.Fatalf("expected audited hook response, got %+v", audit)
	}
}

func TestHookEngineWireHandlerStructuredResponse(t *testing.T) {
	engine := NewEngine([]HookDef{{ID: "wire-policy", Event: EventPreToolUse, Target: "edit_file"}})
	engine.OnWireHook = func(ctx context.Context, req WireHookRequest) HookResult {
		return HookResult{Response: HookResponse{Action: "modify", ModifiedInputData: map[string]any{"note": "observed"}}}
	}
	results := engine.Trigger(context.Background(), EventPreToolUse, "edit_file", map[string]any{"path": "a.txt"})
	if len(results) != 1 || results[0].Response.Action != "modify" || results[0].Response.ModifiedInputData["note"] != "observed" {
		t.Fatalf("expected structured wire response, got %+v", results)
	}
}

func TestHookEngineReportsMissingWireHandler(t *testing.T) {
	engine := NewEngine([]HookDef{{ID: "wire-sub", Event: EventNotification, Target: "*"}})
	results := engine.Trigger(context.Background(), EventNotification, "build", nil)
	if len(results) != 1 || !strings.Contains(results[0].Error, "wire hook handler") {
		t.Fatalf("expected missing wire handler error, got %+v", results)
	}
}
