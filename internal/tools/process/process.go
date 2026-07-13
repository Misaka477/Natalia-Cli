package process

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/processmgr"
)

type Start struct{}

func (t *Start) Name() string { return "process_start" }
func (t *Start) Description() string {
	return "启动由 Natalia 管理的后台进程，返回 process session id"
}
func (t *Start) Required() []string { return []string{"command"} }
func (t *Start) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"command":      {Type: "string", Description: "要启动的命令路径或可执行名"},
		"args":         {Type: "array", Description: "可选，命令参数数组"},
		"cwd":          {Type: "string", Description: "可选，工作目录，必须已存在"},
		"env":          {Type: "object", Description: "可选，附加环境变量；secret/token/password/key 名称会在状态中 redacted"},
		"kind":         {Type: "string", Description: "可选，process|background|interactive|mcp，默认 process"},
		"idle_timeout": {Type: "integer", Description: "可选，空闲自动停止秒数，0 表示不限制"},
		"max_lifetime": {Type: "integer", Description: "可选，最大运行秒数，0 表示不限制"},
	}
}
func (t *Start) Execute(args map[string]any) (string, error) {
	command, _ := args["command"].(string)
	if command == "" {
		return "", fmt.Errorf("command required")
	}
	argv, err := parseArgs(args["args"])
	if err != nil {
		return "", err
	}
	env, err := parseEnv(args["env"])
	if err != nil {
		return "", err
	}
	cwd, _ := args["cwd"].(string)
	kind := parseKind(args)
	idleTimeout, err := durationSecondsArg(args["idle_timeout"], 0, 0, 86400)
	if err != nil {
		return "", err
	}
	maxLifetime, err := durationSecondsArg(args["max_lifetime"], 0, 0, 86400)
	if err != nil {
		return "", err
	}
	sess, err := processmgr.DefaultManager().Start(context.Background(), processmgr.StartOptions{Command: command, Args: argv, Cwd: cwd, Env: env, Kind: kind, IdleTimeout: idleTimeout, MaxLifetime: maxLifetime})
	if err != nil {
		return "", err
	}
	return formatSession(sess), nil
}

type List struct{}

func (t *List) Name() string                        { return "process_list" }
func (t *List) Description() string                 { return "列出 Natalia 管理的进程" }
func (t *List) Required() []string                  { return nil }
func (t *List) Parameters() map[string]llm.Property { return map[string]llm.Property{} }
func (t *List) Execute(args map[string]any) (string, error) {
	sessions := processmgr.DefaultManager().List()
	items := make([]processmgr.Session, 0, len(sessions))
	for _, sess := range sessions {
		if sess.Kind == processmgr.KindProcess {
			items = append(items, sess)
		}
	}
	return formatSessions(items), nil
}

type Status struct{}

func (t *Status) Name() string        { return "process_status" }
func (t *Status) Description() string { return "查看 Natalia 管理进程的状态" }
func (t *Status) Required() []string  { return []string{"id"} }
func (t *Status) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"id": {Type: "string", Description: "process session id"}}
}
func (t *Status) Execute(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	sess, ok := processmgr.DefaultManager().Status(id)
	if !ok {
		return "", fmt.Errorf("unknown process session %q", id)
	}
	return formatSession(sess), nil
}

type Output struct{}

func (t *Output) Name() string        { return "process_output" }
func (t *Output) Description() string { return "读取 Natalia 管理进程的最近输出" }
func (t *Output) Required() []string  { return []string{"id"} }
func (t *Output) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":   {Type: "string", Description: "process session id"},
		"tail": {Type: "integer", Description: "可选，最近多少行，默认全部 retained tail"},
	}
}
func (t *Output) Execute(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	tail := intArg(args["tail"])
	lines, ok := processmgr.DefaultManager().Output(id, tail)
	if !ok {
		return "", fmt.Errorf("unknown process session %q", id)
	}
	if len(lines) == 0 {
		return "<no output>", nil
	}
	var b strings.Builder
	for _, line := range lines {
		fmt.Fprintf(&b, "%s: %s\n", line.Stream, line.Text)
	}
	return strings.TrimRight(b.String(), "\n"), nil
}

type Stop struct{}

func (t *Stop) Name() string        { return "process_stop" }
func (t *Stop) Description() string { return "停止 Natalia 管理的进程" }
func (t *Stop) Required() []string  { return []string{"id"} }
func (t *Stop) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"id": {Type: "string", Description: "process session id"}}
}

type Restart struct{}

func (t *Restart) Name() string { return "process_restart" }
func (t *Restart) Description() string {
	return "重启 Natalia 管理的进程，复用原 command/args/cwd/env"
}
func (t *Restart) Required() []string { return []string{"id"} }
func (t *Restart) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"id": {Type: "string", Description: "process session id"}}
}
func (t *Restart) Execute(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	sess, err := processmgr.DefaultManager().Restart(context.Background(), id)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("process restarted\nold_id: %s\nnew_id: %s\n%s", id, sess.ID, formatSession(sess)), nil
}

type Attach struct{}

func (t *Attach) Name() string { return "process_attach" }
func (t *Attach) Description() string {
	return "重新附加到 Natalia 管理的进程，恢复事件/状态关注"
}
func (t *Attach) Required() []string { return []string{"id"} }
func (t *Attach) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"id": {Type: "string", Description: "process session id"}}
}
func (t *Attach) Execute(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	sess, err := processmgr.DefaultManager().Attach(id)
	if err != nil {
		return "", err
	}
	return "已附加进程\n" + formatSession(sess), nil
}

type Detach struct{}

func (t *Detach) Name() string { return "process_detach" }
func (t *Detach) Description() string {
	return "从 Natalia 管理的进程 detach；进程继续运行但状态标记为 detached"
}
func (t *Detach) Required() []string { return []string{"id"} }
func (t *Detach) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"id": {Type: "string", Description: "process session id"}}
}
func (t *Detach) Execute(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	sess, err := processmgr.DefaultManager().Detach(id)
	if err != nil {
		return "", err
	}
	return "已 detach 进程\n" + formatSession(sess), nil
}

type Cleanup struct{}

func (t *Cleanup) Name() string { return "process_cleanup" }
func (t *Cleanup) Description() string {
	return "清理已完成的进程，并可按 idle/max lifetime 停止运行中的进程；返回受影响 ID"
}
func (t *Cleanup) Required() []string { return nil }
func (t *Cleanup) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"finished_max_age": {Type: "integer", Description: "可选，完成后保留秒数，默认 0"},
		"idle_timeout":     {Type: "integer", Description: "可选，运行中进程空闲秒数阈值，0 表示不检查"},
		"max_lifetime":     {Type: "integer", Description: "可选，运行中进程最大运行秒数阈值，0 表示不检查"},
		"detect_stale":     {Type: "boolean", Description: "可选，检查 PID 是否已失效"},
		"dry_run":          {Type: "boolean", Description: "可选，仅预览即将清理的进程而不实际操作"},
	}
}
func (t *Cleanup) Execute(args map[string]any) (string, error) {
	finishedMaxAge, err := durationSecondsArg(args["finished_max_age"], 0, 0, 86400*30)
	if err != nil {
		return "", err
	}
	idleTimeout, err := durationSecondsArg(args["idle_timeout"], 0, 0, 86400)
	if err != nil {
		return "", err
	}
	maxLifetime, err := durationSecondsArg(args["max_lifetime"], 0, 0, 86400)
	if err != nil {
		return "", err
	}
	dryRun := boolArg(args["dry_run"])
	result := processmgr.DefaultManager().Sweep(processmgr.SweepOptions{FinishedMaxAge: finishedMaxAge, IdleTimeout: idleTimeout, MaxLifetime: maxLifetime, DetectStale: boolArg(args["detect_stale"]), DryRun: dryRun})
	return fmtCleanupResult("process cleanup", result, dryRun), nil
}

type Audit struct{}

func (t *Audit) Name() string { return "process_audit" }
func (t *Audit) Description() string {
	return "查看 Natalia 进程管理审计日志，secret env 只显示 redacted 摘要"
}
func (t *Audit) Required() []string { return nil }
func (t *Audit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"tail":   {Type: "integer", Description: "可选，最近多少条审计记录，默认全部"},
		"format": {Type: "string", Description: "可选，输出格式：text 或 json，默认 text"},
	}
}
func (t *Audit) Execute(args map[string]any) (string, error) {
	tail := intArg(args["tail"])
	entries := processmgr.DefaultManager().AuditLog()
	filtered := make([]processmgr.AuditEntry, 0, len(entries))
	for _, entry := range entries {
		if entry.Kind == processmgr.KindProcess {
			filtered = append(filtered, entry)
		}
	}
	entries = filtered
	if tail > 0 && tail < len(entries) {
		entries = entries[len(entries)-tail:]
	}
	if len(entries) == 0 {
		return "<no process audit entries>", nil
	}
	format, _ := args["format"].(string)
	if format == "json" {
		return auditEntriesJSON(entries), nil
	}
	var b strings.Builder
	for _, entry := range entries {
		fmt.Fprintf(&b, "%s %s id=%s kind=%s status=%s command=%s %s", entry.Time.Format(time.RFC3339), entry.Action, entry.SessionID, entry.Kind, entry.Status, entry.Command, strings.Join(entry.Args, " "))
		if len(entry.EnvSummary) > 0 {
			fmt.Fprintf(&b, " env=%s", strings.Join(entry.EnvSummary, ","))
		}
		b.WriteByte('\n')
	}
	return strings.TrimRight(b.String(), "\n"), nil
}

func (t *Stop) Execute(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	if err := processmgr.DefaultManager().Stop(id); err != nil {
		return "", err
	}
	sess, _ := processmgr.DefaultManager().Status(id)
	return "已停止进程\n" + formatSession(sess), nil
}

func parseEnv(raw any) ([]string, error) {
	if raw == nil {
		return nil, nil
	}
	items, ok := raw.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("env must be an object")
	}
	env := make([]string, 0, len(items))
	for key, value := range items {
		if strings.TrimSpace(key) == "" || strings.Contains(key, "=") {
			return nil, fmt.Errorf("env key %q is invalid", key)
		}
		text, ok := value.(string)
		if !ok {
			return nil, fmt.Errorf("env[%s] must be a string", key)
		}
		env = append(env, key+"="+text)
	}
	return env, nil
}

func parseArgs(raw any) ([]string, error) {
	if raw == nil {
		return nil, nil
	}
	items, ok := raw.([]any)
	if !ok {
		return nil, fmt.Errorf("args must be an array")
	}
	args := make([]string, 0, len(items))
	for i, item := range items {
		s, ok := item.(string)
		if !ok {
			return nil, fmt.Errorf("args[%d] must be a string", i)
		}
		args = append(args, s)
	}
	return args, nil
}

func parseKind(args map[string]any) processmgr.Kind {
	kind, _ := args["kind"].(string)
	switch processmgr.Kind(kind) {
	case processmgr.KindBackground, processmgr.KindInteractive, processmgr.KindMCP:
		return processmgr.Kind(kind)
	default:
		return processmgr.KindProcess
	}
}

func intArg(raw any) int {
	switch v := raw.(type) {
	case int:
		return v
	case float64:
		return int(v)
	default:
		return 0
	}
}

func durationSecondsArg(raw any, defaultValue, minValue, maxValue int) (time.Duration, error) {
	if raw == nil {
		return time.Duration(defaultValue) * time.Second, nil
	}
	value := intArg(raw)
	if value == 0 {
		switch raw.(type) {
		case int, float64:
		default:
			return 0, fmt.Errorf("duration must be an integer number of seconds")
		}
	}
	if value < minValue || value > maxValue {
		return 0, fmt.Errorf("duration must be between %d and %d seconds", minValue, maxValue)
	}
	return time.Duration(value) * time.Second, nil
}

func boolArg(raw any) bool {
	switch v := raw.(type) {
	case bool:
		return v
	case string:
		return strings.EqualFold(strings.TrimSpace(v), "true") || strings.TrimSpace(v) == "1" || strings.EqualFold(strings.TrimSpace(v), "yes")
	default:
		return false
	}
}

func formatSessions(sessions []processmgr.Session) string {
	if len(sessions) == 0 {
		return "<no managed processes>"
	}
	var b strings.Builder
	for _, sess := range sessions {
		b.WriteString(formatSession(&sess))
		b.WriteString("\n---\n")
	}
	return strings.TrimRight(b.String(), "\n-")
}

func formatSession(sess *processmgr.Session) string {
	if sess == nil {
		return "<nil process session>"
	}
	return formatSessionCommon("process", sess)
}

func fmtCleanupResult(label string, result processmgr.SweepResult, dryRun bool) string {
	var b strings.Builder
	b.WriteString(label)
	if dryRun {
		b.WriteString(" dry-run")
	}
	b.WriteString(fmt.Sprintf(" complete\nremoved: %d\nstopped: %d\nstale: %d", result.Removed, result.Stopped, result.Stale))
	if len(result.AffectedIDs) > 0 {
		b.WriteString("\naffected_ids: " + strings.Join(result.AffectedIDs, ", "))
	}
	return b.String()
}

func auditEntriesJSON(entries []processmgr.AuditEntry) string {
	var b strings.Builder
	b.WriteByte('[')
	for i, entry := range entries {
		if i > 0 {
			b.WriteString(",\n ")
		}
		fmt.Fprintf(&b, `{"event_id":%q,"action":%q,"session_id":%q,"kind":%q,"status":%q,"command":%q,"time":%q}`, entry.EventID, entry.Action, entry.SessionID, entry.Kind, entry.Status, entry.Command, entry.Time.Format(time.RFC3339))
	}
	b.WriteByte(']')
	return b.String()
}

func formatSessionCommon(kindLabel string, sess *processmgr.Session) string {
	if sess == nil {
		return fmt.Sprintf("<nil %s session>", kindLabel)
	}
	exitCode := ""
	if sess.ExitCode != nil {
		exitCode = fmt.Sprintf("\nexit_code: %d", *sess.ExitCode)
	}
	errLine := ""
	if sess.Error != "" {
		errLine = "\nerror: " + sess.Error
	}
	envLine := ""
	if len(sess.EnvSummary) > 0 {
		envLine = "\nenv: " + strings.Join(sess.EnvSummary, ", ")
	}
	attachedLine := fmt.Sprintf("\nattached: %t", sess.Attached)
	lifetimeLine := ""
	if sess.IdleTimeout > 0 {
		lifetimeLine += fmt.Sprintf("\nidle_timeout: %s", sess.IdleTimeout)
	}
	if sess.MaxLifetime > 0 {
		lifetimeLine += fmt.Sprintf("\nmax_lifetime: %s", sess.MaxLifetime)
	}
	duration := ""
	if !sess.StartedAt.IsZero() && !sess.ExitedAt.IsZero() {
		duration = fmt.Sprintf("\nduration: %s", sess.ExitedAt.Sub(sess.StartedAt).Round(time.Millisecond))
	}
	startedAt := ""
	if !sess.StartedAt.IsZero() {
		startedAt = "\nstarted_at: " + sess.StartedAt.Format(time.RFC3339)
	}
	return fmt.Sprintf("id: %s\nkind: %s\nstatus: %s\npid: %d\ncommand: %s %s%s%s%s%s%s%s%s", sess.ID, sess.Kind, sess.Status, sess.PID, sess.Command, strings.Join(sess.Args, " "), attachedLine, startedAt, duration, lifetimeLine, envLine, exitCode, errLine)
}
