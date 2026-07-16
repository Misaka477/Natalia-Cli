package agent

import (
	"fmt"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/approval"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/mode"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
	"github.com/Misaka477/Natalia-Cli/internal/worker"
)

type Spawn struct {
	Pool                  *worker.Pool
	Client                *llm.Client
	Tools                 *toolset.Registry
	Approver              *approval.Approver
	ClientForModelProfile func(string) (*llm.Client, error)
}

func (t *Spawn) Name() string        { return "agent_spawn" }
func (t *Spawn) Description() string { return "spawn a sub-agent to perform an independent task" }
func (t *Spawn) Required() []string  { return []string{"task"} }
func (t *Spawn) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"task":          {Type: "string", Description: "task description for the sub-agent"},
		"mode":          {Type: "string", Description: "mode (code/ask/plan/debug/chat); default code"},
		"foreground":    {Type: "boolean", Description: "optional, wait for sub-agent completion or timeout and return summary when true"},
		"timeout_sec":   {Type: "integer", Description: "optional, sub-agent timeout seconds; default 30 for foreground, 0 unlimited for background, max 3600"},
		"model_profile": {Type: "string", Description: "optional, override the model profile for the sub-agent; defaults to current runtime profile"},
		"allowed_tools": {Type: "array", Description: "optional, tool names the sub-agent may use; empty means inherit current toolset"},
		"exclude_tools": {Type: "array", Description: "optional, tool names disabled for the sub-agent"},
	}
}
func (t *Spawn) Execute(args map[string]any) (string, error) {
	task, _ := args["task"].(string)
	if task == "" {
		return "", fmt.Errorf("task is required")
	}
	if t.Pool == nil {
		return "", fmt.Errorf("agent system unavailable")
	}
	modeName, _ := args["mode"].(string)
	if modeName == "" {
		modeName = "code"
	}
	if _, err := mode.Get(modeName); err != nil {
		return "", fmt.Errorf("unknown mode %q; valid modes: %s", modeName, strings.Join(validModeNames(), ", "))
	}
	foreground, _ := args["foreground"].(bool)
	timeoutSec, err := parseTimeoutSec(args["timeout_sec"], foreground)
	if err != nil {
		return "", err
	}
	client := t.Client
	modelProfile, _ := args["model_profile"].(string)
	modelProfile = strings.TrimSpace(modelProfile)
	if modelProfile != "" {
		if t.ClientForModelProfile == nil {
			return "", fmt.Errorf("model_profile override is not available")
		}
		client, err = t.ClientForModelProfile(modelProfile)
		if err != nil {
			return "", err
		}
	}
	childTools, err := childToolRegistry(t.Tools, args)
	if err != nil {
		return "", err
	}
	w, err := t.Pool.SpawnWithOptions(task, modeName, client, childTools, worker.SpawnOptions{Timeout: time.Duration(timeoutSec) * time.Second, Approver: t.Approver, ModelProfile: modelProfile})
	if err != nil {
		return "", fmt.Errorf("创建子 agent 失败: %w", err)
	}
	if foreground {
		completed := waitForWorker(w, time.Duration(timeoutSec)*time.Second)
		detail := formatWorkerDetail(w)
		if !completed {
			detail = fmt.Sprintf("timeout after %ds — worker still running\n%s", timeoutSec, detail)
		}
		return detail, nil
	}
	profileLine := ""
	if modelProfile != "" {
		profileLine = "\n模型配置: " + modelProfile
	}
	return fmt.Sprintf("子 agent %s 已创建\n任务: %s\n模式: %s%s\n状态: %s", w.ID, task, modeName, profileLine, w.Status), nil
}

func validModeNames() []string {
	names := make([]string, 0, len(mode.Modes))
	for _, item := range mode.Modes {
		names = append(names, item.Name)
	}
	return names
}

func childToolRegistry(base *toolset.Registry, args map[string]any) (*toolset.Registry, error) {
	if base == nil {
		return nil, nil
	}
	allowed, err := parseStringList(args["allowed_tools"], "allowed_tools")
	if err != nil {
		return nil, err
	}
	excluded, err := parseStringList(args["exclude_tools"], "exclude_tools")
	if err != nil {
		return nil, err
	}
	if len(allowed) == 0 && len(excluded) == 0 {
		return base, nil
	}
	return base.Filtered(allowed, excluded), nil
}

func parseStringList(raw any, name string) ([]string, error) {
	if raw == nil {
		return nil, nil
	}
	items, ok := raw.([]any)
	if !ok {
		return nil, fmt.Errorf("%s must be an array", name)
	}
	out := make([]string, 0, len(items))
	for i, item := range items {
		s, ok := item.(string)
		if !ok || strings.TrimSpace(s) == "" {
			return nil, fmt.Errorf("%s[%d] must be a non-empty string", name, i)
		}
		out = append(out, strings.TrimSpace(s))
	}
	return out, nil
}

type List struct{ Pool *worker.Pool }

func (t *List) Name() string                        { return "agent_list" }
func (t *List) Description() string                 { return "list all sub-agents and their statuses" }
func (t *List) Required() []string                  { return []string{} }
func (t *List) Parameters() map[string]llm.Property { return map[string]llm.Property{} }
func (t *List) Execute(args map[string]any) (string, error) {
	if t.Pool == nil {
		return "", fmt.Errorf("agent system unavailable")
	}
	workers := t.Pool.List()
	if len(workers) == 0 {
		return "没有子 agent", nil
	}
	var b strings.Builder
	for _, w := range workers {
		logs := w.GetLogs()
		last := ""
		if len(logs) > 0 {
			last = logs[len(logs)-1].Tool
			if last == "" {
				last = logs[len(logs)-1].Result
			}
		}
		profile := ""
		if w.ModelProfile != "" {
			profile = " model_profile=" + w.ModelProfile
		}
		b.WriteString(fmt.Sprintf("%s [%s] attached=%t %s%s", w.ID, w.Status, w.IsAttached(), w.Task, profile))
		if last != "" {
			b.WriteString(" → " + truncate(last, 40))
		}
		b.WriteString(fmt.Sprintf(" (%d steps)\n", len(logs)))
	}
	return strings.TrimSpace(b.String()), nil
}

type Output struct{ Pool *worker.Pool }

func (t *Output) Name() string        { return "agent_output" }
func (t *Output) Description() string { return "view full output log of a sub-agent" }
func (t *Output) Required() []string  { return []string{"agent_id"} }
func (t *Output) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"agent_id": {Type: "string", Description: "sub-agent ID (e.g. w1)"},
	}
}
func (t *Output) Execute(args map[string]any) (string, error) {
	id, _ := args["agent_id"].(string)
	if id == "" {
		return "", fmt.Errorf("agent_id is required")
	}
	if t.Pool == nil {
		return "", fmt.Errorf("agent system unavailable")
	}
	w := t.Pool.Get(id)
	if w == nil {
		return "", fmt.Errorf("agent %s not found", id)
	}
	logs := w.GetLogs()
	if len(logs) == 0 {
		return "子 agent 还没有输出", nil
	}
	var b strings.Builder
	for _, entry := range logs {
		if entry.Tool != "" {
			b.WriteString(fmt.Sprintf("[%s] %s %v\n", w.ID, entry.Tool, entry.Args))
		}
		if entry.Result != "" {
			b.WriteString(fmt.Sprintf("  → %s\n", truncate(entry.Result, 100)))
		}
		if entry.Error != "" {
			b.WriteString(fmt.Sprintf("  ⚠ %s\n", entry.Error))
		}
	}
	return strings.TrimSpace(b.String()), nil
}

type Attach struct{ Pool *worker.Pool }

func (t *Attach) Name() string { return "agent_attach" }
func (t *Attach) Description() string {
	return "attach a sub-agent so its events continue forwarding to the current Wire/runtime view"
}
func (t *Attach) Required() []string { return []string{"agent_id"} }
func (t *Attach) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"agent_id": {Type: "string", Description: "sub-agent ID (e.g. w1)"}}
}
func (t *Attach) Execute(args map[string]any) (string, error) {
	id, err := requireAgentID(args)
	if err != nil {
		return "", err
	}
	if t.Pool == nil {
		return "", fmt.Errorf("agent system unavailable")
	}
	w := t.Pool.Get(id)
	if w == nil {
		return "", fmt.Errorf("agent %s not found", id)
	}
	t.Pool.Attach(id)
	return fmt.Sprintf("已 attach 子 agent %s\n%s", id, formatWorkerDetail(w)), nil
}

type Detach struct{ Pool *worker.Pool }

func (t *Detach) Name() string { return "agent_detach" }
func (t *Detach) Description() string {
	return "detach a sub-agent; the agent keeps running but live events are hidden from the UI"
}
func (t *Detach) Required() []string { return []string{"agent_id"} }
func (t *Detach) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"agent_id": {Type: "string", Description: "sub-agent ID (e.g. w1)"}}
}
func (t *Detach) Execute(args map[string]any) (string, error) {
	id, err := requireAgentID(args)
	if err != nil {
		return "", err
	}
	if t.Pool == nil {
		return "", fmt.Errorf("agent system unavailable")
	}
	w := t.Pool.Get(id)
	if w == nil {
		return "", fmt.Errorf("agent %s not found", id)
	}
	t.Pool.Detach(id)
	return fmt.Sprintf("已 detach 子 agent %s\n%s", id, formatWorkerDetail(w)), nil
}

type Stop struct{ Pool *worker.Pool }

func (t *Stop) Name() string        { return "agent_stop" }
func (t *Stop) Description() string { return "stop a running sub-agent" }
func (t *Stop) Required() []string  { return []string{"agent_id"} }
func (t *Stop) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"agent_id": {Type: "string", Description: "sub-agent ID (e.g. w1)"}}
}
func (t *Stop) Execute(args map[string]any) (string, error) {
	id, err := requireAgentID(args)
	if err != nil {
		return "", err
	}
	if t.Pool == nil {
		return "", fmt.Errorf("agent system unavailable")
	}
	w := t.Pool.Get(id)
	if w == nil {
		return "", fmt.Errorf("agent %s not found", id)
	}
	before := w.GetStatus()
	if before != worker.StatusRunning {
		return fmt.Sprintf("agent was already %s before stop\nstop_result: already_%s\nnext_action: no cancellation was sent; inspect output/status or cleanup if no longer needed\n%s", before, before, formatWorkerDetail(w)), nil
	}
	w.Stop()
	return fmt.Sprintf("stopped agent %s\nstop_result: stopped_now\nnext_action: confirm status/output, then cleanup if no longer needed\nstatus: %s", id, w.GetStatus()), nil
}

type Resume struct{ Pool *worker.Pool }

func (t *Resume) Name() string        { return "agent_resume" }
func (t *Resume) Description() string { return "resume a paused sub-agent" }
func (t *Resume) Required() []string  { return []string{"agent_id"} }
func (t *Resume) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"agent_id": {Type: "string", Description: "sub-agent ID (e.g. w1)"}}
}
func (t *Resume) Execute(args map[string]any) (string, error) {
	id, err := requireAgentID(args)
	if err != nil {
		return "", err
	}
	if t.Pool == nil {
		return "", fmt.Errorf("agent system unavailable")
	}
	w := t.Pool.Get(id)
	if w == nil {
		return "", fmt.Errorf("agent %s not found", id)
	}
	if err := w.Resume(); err != nil {
		return "", fmt.Errorf("agent %s %w", id, err)
	}
	return fmt.Sprintf("resumed agent %s\nstatus: %s", id, w.GetStatus()), nil
}

func requireAgentID(args map[string]any) (string, error) {
	id, _ := args["agent_id"].(string)
	if id == "" {
		return "", fmt.Errorf("agent_id is required")
	}
	return id, nil
}

type Restart struct{ Pool *worker.Pool }

func (t *Restart) Name() string { return "agent_restart" }
func (t *Restart) Description() string {
	return "restart a finished or failed sub-agent, creating a new worker ID"
}
func (t *Restart) Required() []string { return []string{"agent_id"} }
func (t *Restart) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"agent_id": {Type: "string", Description: "sub-agent ID to restart (e.g. w1)"},
	}
}
func (t *Restart) Execute(args map[string]any) (string, error) {
	id, err := requireAgentID(args)
	if err != nil {
		return "", err
	}
	if t.Pool == nil {
		return "", fmt.Errorf("agent system unavailable")
	}
	if t.Pool.Get(id) == nil {
		return "", fmt.Errorf("agent %s not found", id)
	}
	newW, err := t.Pool.Restart(id)
	if err != nil {
		return "", fmt.Errorf("restart agent %s: %w", id, err)
	}
	return fmt.Sprintf("restarted agent %s -> %s\ntask: %s\nmode: %s\nstatus: %s", id, newW.ID, newW.Task, newW.Mode, newW.GetStatus()), nil
}

func parseTimeoutSec(raw any, foreground bool) (int, error) {
	defaultValue := 0
	if foreground {
		defaultValue = 30
	}
	if raw == nil {
		return defaultValue, nil
	}
	var value int
	switch v := raw.(type) {
	case int:
		value = v
	case float64:
		if v != float64(int(v)) {
			return 0, fmt.Errorf("timeout_sec must be an integer")
		}
		value = int(v)
	default:
		return 0, fmt.Errorf("timeout_sec must be an integer")
	}
	if value < 0 || value > 3600 {
		return 0, fmt.Errorf("timeout_sec must be between 0 and 3600")
	}
	return value, nil
}

func waitForWorker(w *worker.Worker, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		status := w.GetStatus()
		if status == worker.StatusCompleted || status == worker.StatusFailed || status == worker.StatusPaused {
			return true
		}
		time.Sleep(20 * time.Millisecond)
	}
	return false
}

func formatWorkerDetail(w *worker.Worker) string {
	logs := w.GetLogs()
	var b strings.Builder
	profile := ""
	if w.ModelProfile != "" {
		profile = " model_profile=" + w.ModelProfile
	}
	fmt.Fprintf(&b, "%s [%s] attached=%t %s%s\n", w.ID, w.GetStatus(), w.IsAttached(), w.Task, profile)
	for _, entry := range logs {
		if entry.Tool != "" {
			fmt.Fprintf(&b, "[%s] %s %v\n", w.ID, entry.Tool, entry.Args)
		}
		if entry.Result != "" {
			fmt.Fprintf(&b, "  -> %s\n", truncate(entry.Result, 200))
		}
		if entry.Error != "" {
			fmt.Fprintf(&b, "  error: %s\n", entry.Error)
		}
	}
	return strings.TrimSpace(b.String())
}

type Status struct{ Pool *worker.Pool }

func (t *Status) Name() string        { return "agent_status" }
func (t *Status) Description() string { return "view detailed status of a single sub-agent" }
func (t *Status) Required() []string  { return []string{"agent_id"} }
func (t *Status) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"agent_id": {Type: "string", Description: "sub-agent ID (e.g. w1)"}}
}
func (t *Status) Execute(args map[string]any) (string, error) {
	id, err := requireAgentID(args)
	if err != nil {
		return "", err
	}
	if t.Pool == nil {
		return "", fmt.Errorf("agent system unavailable")
	}
	w := t.Pool.Get(id)
	if w == nil {
		return "", fmt.Errorf("agent %s not found", id)
	}
	return formatWorkerDetail(w), nil
}

type Cleanup struct{ Pool *worker.Pool }

func (t *Cleanup) Name() string { return "agent_cleanup" }
func (t *Cleanup) Description() string {
	return "clean up finished sub-agents and free resources; returns affected IDs, remaining status summary, and next_action"
}
func (t *Cleanup) Required() []string { return []string{} }
func (t *Cleanup) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"dry_run": {Type: "boolean", Description: "optional, preview agents to clean up without taking action"}}
}
func (t *Cleanup) Execute(args map[string]any) (string, error) {
	if t.Pool == nil {
		return "", fmt.Errorf("agent system unavailable")
	}
	dryRun := false
	if v, ok := args["dry_run"].(bool); ok {
		dryRun = v
	}
	if dryRun {
		all := t.Pool.List()
		var affected []string
		for _, w := range all {
			s := w.GetStatus()
			if s == worker.StatusCompleted || s == worker.StatusFailed || s == worker.StatusStopped {
				affected = append(affected, w.ID)
			}
		}
		if len(affected) == 0 {
			return "agent cleanup dry-run: no agents to clean up\n" + agentCleanupStatusLine(t.Pool) + "\nnext_action: no agent cleanup needed", nil
		}
		return fmt.Sprintf("agent cleanup dry-run\nwould_remove: %d\naffected_ids: %s\n%s\nnext_action: rerun without dry_run to remove affected agent resources, or inspect agent_status/agent_output first", len(affected), strings.Join(affected, ", "), agentCleanupStatusLine(t.Pool)), nil
	}
	affected := t.Pool.Cleanup()
	if len(affected) == 0 {
		return "agent cleanup complete: no agents to clean up\n" + agentCleanupStatusLine(t.Pool) + "\nnext_action: no agent cleanup needed", nil
	}
	return fmt.Sprintf("agent cleanup complete\nremoved: %d\naffected_ids: %s\n%s\nnext_action: inspect agent_list/agent_status to confirm remaining resources", len(affected), strings.Join(affected, ", "), agentCleanupStatusLine(t.Pool)), nil
}

func agentCleanupStatusLine(pool *worker.Pool) string {
	counts := map[worker.Status]int{}
	total := 0
	if pool != nil {
		for _, w := range pool.List() {
			total++
			counts[w.GetStatus()]++
		}
	}
	return fmt.Sprintf("remaining_resources: resource_type=agent total=%d running=%d completed=%d stopped=%d failed=%d paused=%d idle=%d", total, counts[worker.StatusRunning], counts[worker.StatusCompleted], counts[worker.StatusStopped], counts[worker.StatusFailed], counts[worker.StatusPaused], counts[worker.StatusIdle])
}

type Audit struct{ Pool *worker.Pool }

func (t *Audit) Name() string { return "agent_audit" }
func (t *Audit) Description() string {
	return "view sub-agent audit log; text output distinguishes agent_id from event_id, JSON includes event_id/resource_type/resource_id/action/status/time"
}
func (t *Audit) Required() []string { return []string{} }
func (t *Audit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"tail":   {Type: "integer", Description: "optional, recent audit entries to return; default all"},
		"format": {Type: "string", Description: "optional, output format: text or json; default text"},
	}
}
func (t *Audit) Execute(args map[string]any) (string, error) {
	if t.Pool == nil {
		return "", fmt.Errorf("agent system unavailable")
	}
	tail := 0
	if v, ok := args["tail"]; ok {
		switch vv := v.(type) {
		case float64:
			tail = int(vv)
		case int:
			tail = vv
		}
	}
	entries := t.Pool.AuditLog()
	if tail > 0 && tail < len(entries) {
		entries = entries[len(entries)-tail:]
	}
	if len(entries) == 0 {
		return "<no agent audit entries>", nil
	}
	format, _ := args["format"].(string)
	if format == "json" {
		var b strings.Builder
		b.WriteByte('[')
		for i, entry := range entries {
			if i > 0 {
				b.WriteString(",\n ")
			}
			fmt.Fprintf(&b, `{"event_id":%q,"resource_type":"agent","resource_id":%q,"agent_id":%q,"worker_id":%q,"action":%q,"event":%q,"status":%q,"time":%q}`, entry.EventID, entry.WorkerID, entry.WorkerID, entry.WorkerID, entry.Event, entry.Event, entry.Status, entry.Time.Format(time.RFC3339))
		}
		b.WriteByte(']')
		return b.String(), nil
	}
	var b strings.Builder
	for _, entry := range entries {
		fmt.Fprintf(&b, "%s event_id=%s agent_id=%s resource_type=agent action=%s status=%s attached=%t\n", entry.Time.Format(time.RFC3339), entry.EventID, entry.WorkerID, entry.Event, entry.Status, entry.Attached)
	}
	return strings.TrimSpace(b.String()), nil
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n-1]) + "…"
}
