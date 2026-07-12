package hook

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"path"
	"strings"
	"sync"
	"time"
)

type EventType string

const (
	EventPreToolUse       EventType = "PreToolUse"
	EventPostToolUse      EventType = "PostToolUse"
	EventUserPromptSubmit EventType = "UserPromptSubmit"
	EventStop             EventType = "Stop"
	EventStopFailure      EventType = "StopFailure"
	EventNotification     EventType = "Notification"
)

type HookDef struct {
	ID         string        `yaml:"id,omitempty"`
	Event      EventType     `yaml:"event"`
	Target     string        `yaml:"target,omitempty"`
	Command    string        `yaml:"command,omitempty"`
	Cwd        string        `yaml:"cwd,omitempty"`
	Timeout    time.Duration `yaml:"-"`
	TimeoutSec int           `yaml:"timeout_sec,omitempty"`
	OnFailure  string        `yaml:"on_failure,omitempty"`
}

type Engine struct {
	hooks      []HookDef
	mu         sync.Mutex
	audit      []AuditEntry
	OnWireHook func(context.Context, WireHookRequest) HookResult
}

type WireHookRequest struct {
	SubscriptionID string
	Event          EventType
	Target         string
	InputData      map[string]any
}

type TriggerInput struct {
	Event     EventType      `json:"event"`
	Target    string         `json:"target"`
	InputData map[string]any `json:"input_data,omitempty"`
}

type HookResult struct {
	ID        string
	Event     EventType
	Target    string
	Command   string
	Matched   bool
	Duration  time.Duration
	Stdout    string
	Stderr    string
	Error     string
	TimedOut  bool
	Response  HookResponse
	OnFailure string
}

type HookResponse struct {
	Action            string         `json:"action,omitempty"`
	Reason            string         `json:"reason,omitempty"`
	Message           string         `json:"message,omitempty"`
	ModifiedInputData map[string]any `json:"modified_input_data,omitempty"`
}

type AuditEntry struct {
	At       time.Time
	HookID   string
	Event    EventType
	Target   string
	Action   string
	Reason   string
	Error    string
	TimedOut bool
	Duration time.Duration
}

func NewEngine(hooks []HookDef) *Engine {
	copyHooks := append([]HookDef(nil), hooks...)
	return &Engine{hooks: copyHooks}
}

func (e *Engine) Hooks() []HookDef {
	if e == nil {
		return nil
	}
	return append([]HookDef(nil), e.hooks...)
}

func (e *Engine) AuditLog() []AuditEntry {
	if e == nil {
		return nil
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	return append([]AuditEntry(nil), e.audit...)
}

func (e *Engine) Trigger(ctx context.Context, event EventType, target string, inputData map[string]any) []HookResult {
	if e == nil || len(e.hooks) == 0 {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	input := TriggerInput{Event: event, Target: target, InputData: inputData}
	var wg sync.WaitGroup
	results := make(chan HookResult, len(e.hooks))
	for _, def := range e.hooks {
		if !matches(def, event, target) {
			continue
		}
		wg.Add(1)
		go func(def HookDef) {
			defer wg.Done()
			if strings.TrimSpace(def.Command) == "" {
				results <- e.runWireHook(ctx, def, input)
				return
			}
			results <- runShellHook(ctx, def, input)
		}(def)
	}
	wg.Wait()
	close(results)
	out := make([]HookResult, 0, len(results))
	for result := range results {
		result.Response = normalizeResponse(result.Response)
		out = append(out, result)
		e.recordAudit(result)
	}
	return out
}

func (e *Engine) recordAudit(result HookResult) {
	if e == nil {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	e.audit = append(e.audit, AuditEntry{At: time.Now(), HookID: result.ID, Event: result.Event, Target: result.Target, Action: result.Response.Action, Reason: result.Response.Reason, Error: result.Error, TimedOut: result.TimedOut, Duration: result.Duration})
	if len(e.audit) > 200 {
		e.audit = append([]AuditEntry(nil), e.audit[len(e.audit)-200:]...)
	}
}

func (e *Engine) runWireHook(ctx context.Context, def HookDef, input TriggerInput) HookResult {
	started := time.Now()
	result := HookResult{ID: def.ID, Event: def.Event, Target: def.Target, Matched: true, OnFailure: def.OnFailure}
	defer func() { result.Duration = time.Since(started) }()
	if e.OnWireHook == nil {
		result.Error = "wire hook handler is not configured"
		return result
	}
	request := WireHookRequest{SubscriptionID: def.ID, Event: input.Event, Target: input.Target, InputData: input.InputData}
	result = e.OnWireHook(ctx, request)
	if result.ID == "" {
		result.ID = def.ID
	}
	if result.Event == "" {
		result.Event = input.Event
	}
	if result.Target == "" {
		result.Target = input.Target
	}
	result.Matched = true
	if result.OnFailure == "" {
		result.OnFailure = def.OnFailure
	}
	result.Response = normalizeResponse(result.Response)
	return result
}

func normalizeResponse(resp HookResponse) HookResponse {
	resp.Action = strings.ToLower(strings.TrimSpace(resp.Action))
	if resp.Action == "" {
		resp.Action = "allow"
	}
	switch resp.Action {
	case "allow", "deny", "modify":
	default:
		resp.Reason = strings.TrimSpace(resp.Reason)
		if resp.Reason == "" {
			resp.Reason = "unknown hook response action: " + resp.Action
		}
		resp.Action = "allow"
	}
	resp.Reason = strings.TrimSpace(resp.Reason)
	resp.Message = strings.TrimSpace(resp.Message)
	return resp
}

func matches(def HookDef, event EventType, target string) bool {
	if def.Event != event {
		return false
	}
	pattern := strings.TrimSpace(def.Target)
	if pattern == "" || pattern == "*" {
		return true
	}
	if pattern == target {
		return true
	}
	matched, err := path.Match(pattern, target)
	return err == nil && matched
}

func runShellHook(parent context.Context, def HookDef, input TriggerInput) HookResult {
	started := time.Now()
	result := HookResult{ID: def.ID, Event: def.Event, Target: def.Target, Command: def.Command, Matched: true, OnFailure: def.OnFailure}
	defer func() { result.Duration = time.Since(started) }()
	if strings.TrimSpace(def.Command) == "" {
		result.Error = "hook command is empty"
		return result
	}
	raw, err := json.Marshal(input)
	if err != nil {
		result.Error = fmt.Sprintf("marshal hook input: %v", err)
		return result
	}
	timeout := def.Timeout
	if timeout <= 0 && def.TimeoutSec > 0 {
		timeout = time.Duration(def.TimeoutSec) * time.Second
	}
	ctx := parent
	cancel := func() {}
	if timeout > 0 {
		ctx, cancel = context.WithTimeout(parent, timeout)
	}
	defer cancel()

	cmd := exec.CommandContext(ctx, "/bin/sh", "-c", def.Command)
	cmd.Dir = def.Cwd
	cmd.Stdin = bytes.NewReader(raw)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err = cmd.Run()
	result.Stdout = stdout.String()
	result.Stderr = stderr.String()
	if ctx.Err() == context.DeadlineExceeded {
		result.TimedOut = true
		result.Error = fmt.Sprintf("hook timed out after %s", timeout)
		return result
	}
	if err != nil {
		result.Error = err.Error()
	}
	result.Response = parseHookResponse(result.Stdout)
	return result
}

func parseHookResponse(stdout string) HookResponse {
	text := strings.TrimSpace(stdout)
	if text == "" || !strings.HasPrefix(text, "{") {
		return normalizeResponse(HookResponse{})
	}
	var resp HookResponse
	if err := json.Unmarshal([]byte(text), &resp); err != nil {
		return normalizeResponse(HookResponse{})
	}
	return normalizeResponse(resp)
}
