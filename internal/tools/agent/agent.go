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
func (t *Spawn) Description() string { return "创建一个子 agent 执行独立任务" }
func (t *Spawn) Required() []string  { return []string{"task"} }
func (t *Spawn) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"task":          {Type: "string", Description: "子 agent 要执行的任务描述"},
		"mode":          {Type: "string", Description: "模式（code/ask/plan/debug/chat），默认 code"},
		"foreground":    {Type: "boolean", Description: "可选，true 时等待子 agent 完成或超时后返回输出摘要"},
		"timeout_sec":   {Type: "integer", Description: "可选，子 agent 超时秒数；foreground 默认 30，background 默认 0 不限制，最大 3600"},
		"model_profile": {Type: "string", Description: "可选，覆盖子 agent 使用的 model profile；默认继承当前 runtime profile"},
		"allowed_tools": {Type: "array", Description: "可选，子 agent 允许使用的工具名列表；为空表示继承当前工具集"},
		"exclude_tools": {Type: "array", Description: "可选，子 agent 禁用的工具名列表"},
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
func (t *List) Description() string                 { return "列出所有子 agent 及其状态" }
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
func (t *Output) Description() string { return "查看子 agent 的完整输出日志" }
func (t *Output) Required() []string  { return []string{"agent_id"} }
func (t *Output) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"agent_id": {Type: "string", Description: "子 agent ID（如 w1）"},
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
	return "attach 子 agent，使其事件继续转发到当前 Wire/runtime 视图"
}
func (t *Attach) Required() []string { return []string{"agent_id"} }
func (t *Attach) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"agent_id": {Type: "string", Description: "子 agent ID（如 w1）"}}
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
	return "detach 子 agent；agent 继续运行，但可在 UI 中隐藏实时事件"
}
func (t *Detach) Required() []string { return []string{"agent_id"} }
func (t *Detach) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"agent_id": {Type: "string", Description: "子 agent ID（如 w1）"}}
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
func (t *Stop) Description() string { return "停止正在运行的子 agent" }
func (t *Stop) Required() []string  { return []string{"agent_id"} }
func (t *Stop) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"agent_id": {Type: "string", Description: "子 agent ID（如 w1）"}}
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
	w.Stop()
	return fmt.Sprintf("stopped agent %s\nstatus: %s", id, w.GetStatus()), nil
}

type Resume struct{ Pool *worker.Pool }

func (t *Resume) Name() string        { return "agent_resume" }
func (t *Resume) Description() string { return "恢复已暂停的子 agent" }
func (t *Resume) Required() []string  { return []string{"agent_id"} }
func (t *Resume) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"agent_id": {Type: "string", Description: "子 agent ID（如 w1）"}}
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
func (t *Status) Description() string { return "查看单个子 agent 的详细状态" }
func (t *Status) Required() []string  { return []string{"agent_id"} }
func (t *Status) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"agent_id": {Type: "string", Description: "子 agent ID（如 w1）"}}
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

func (t *Cleanup) Name() string        { return "agent_cleanup" }
func (t *Cleanup) Description() string { return "清理已完成的子 agent，释放资源" }
func (t *Cleanup) Required() []string  { return []string{} }
func (t *Cleanup) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"dry_run": {Type: "boolean", Description: "可选，仅预览即将清理的 agent 而不实际操作"}}
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
			return "agent cleanup dry-run: no agents to clean up", nil
		}
		return fmt.Sprintf("agent cleanup dry-run\nwould_remove: %d\naffected_ids: %s", len(affected), strings.Join(affected, ", ")), nil
	}
	affected := t.Pool.Cleanup()
	if len(affected) == 0 {
		return "agent cleanup complete: no agents to clean up", nil
	}
	return fmt.Sprintf("agent cleanup complete\nremoved: %d\naffected_ids: %s", len(affected), strings.Join(affected, ", ")), nil
}

type Audit struct{ Pool *worker.Pool }

func (t *Audit) Name() string        { return "agent_audit" }
func (t *Audit) Description() string { return "查看子 agent 审计日志" }
func (t *Audit) Required() []string  { return []string{} }
func (t *Audit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"tail":   {Type: "integer", Description: "可选，最近多少条审计记录，默认全部"},
		"format": {Type: "string", Description: "可选，输出格式：text 或 json，默认 text"},
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
			fmt.Fprintf(&b, `{"event_id":%q,"worker_id":%q,"event":%q,"status":%q,"time":%q}`, entry.EventID, entry.WorkerID, entry.Event, entry.Status, entry.Time.Format(time.RFC3339))
		}
		b.WriteByte(']')
		return b.String(), nil
	}
	var b strings.Builder
	for _, entry := range entries {
		fmt.Fprintf(&b, "%s %s id=%s event=%s status=%s attached=%t\n", entry.Time.Format(time.RFC3339), entry.EventID, entry.WorkerID, entry.Event, entry.Status, entry.Attached)
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
