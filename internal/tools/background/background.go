package background

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/processmgr"
	"github.com/Misaka477/Natalia-Cli/internal/tools/shell"
)

type Start struct{}

func (t *Start) Name() string { return "background_start" }
func (t *Start) Description() string {
	return "启动由 Natalia 管理的后台任务，适合 dev server、watcher 或长时间命令"
}
func (t *Start) Required() []string { return []string{"command"} }
func (t *Start) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"command":      {Type: "string", Description: "要启动的命令路径或可执行名"},
		"args":         {Type: "array", Description: "可选，命令参数数组"},
		"cwd":          {Type: "string", Description: "可选，工作目录，必须已存在"},
		"env":          {Type: "object", Description: "可选，附加环境变量；secret/token/password/key 名称会在状态中 redacted"},
		"max_tail":     {Type: "integer", Description: "可选，保留最近多少行输出，默认 1000，范围 1-10000"},
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
	if reason := shell.DangerousCommandReason(strings.TrimSpace(command + " " + strings.Join(argv, " "))); reason != "" {
		return "", fmt.Errorf("dangerous background command blocked: %s", reason)
	}
	env, err := parseEnv(args["env"])
	if err != nil {
		return "", err
	}
	maxTail, err := intArg(args["max_tail"], 1000, 1, 10000)
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
	cwd, _ := args["cwd"].(string)
	sess, err := processmgr.DefaultManager().Start(context.Background(), processmgr.StartOptions{Kind: processmgr.KindBackground, Command: command, Args: argv, Cwd: cwd, Env: env, MaxTail: maxTail, IdleTimeout: idleTimeout, MaxLifetime: maxLifetime})
	if err != nil {
		return "", err
	}
	return "background task started\n" + formatSession(sess), nil
}

type List struct{}

func (t *List) Name() string                        { return "background_list" }
func (t *List) Description() string                 { return "列出 Natalia 管理的后台任务" }
func (t *List) Required() []string                  { return nil }
func (t *List) Parameters() map[string]llm.Property { return map[string]llm.Property{} }
func (t *List) Execute(args map[string]any) (string, error) {
	sessions := processmgr.DefaultManager().List()
	items := make([]processmgr.Session, 0, len(sessions))
	for _, sess := range sessions {
		if sess.Kind == processmgr.KindBackground {
			items = append(items, sess)
		}
	}
	return formatSessions(items), nil
}

type Output struct{}

func (t *Output) Name() string        { return "background_output" }
func (t *Output) Description() string { return "读取后台任务的最近输出" }
func (t *Output) Required() []string  { return []string{"id"} }
func (t *Output) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":     {Type: "string", Description: "background task session id"},
		"tail":   {Type: "integer", Description: "可选，最近多少行，默认全部 retained tail"},
		"offset": {Type: "integer", Description: "可选，分页起始行，从 0 开始；设置后优先于 tail"},
		"limit":  {Type: "integer", Description: "可选，分页读取行数；配合 offset 使用"},
	}
}
func (t *Output) Execute(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	if err := requireBackground(id); err != nil {
		return "", err
	}
	if args["offset"] != nil || args["limit"] != nil {
		offset, err := intArg(args["offset"], 0, 0, 1000000)
		if err != nil {
			return "", err
		}
		limit, err := intArg(args["limit"], 100, 1, 10000)
		if err != nil {
			return "", err
		}
		page, ok := processmgr.DefaultManager().OutputPage(id, offset, limit)
		if !ok {
			return "", fmt.Errorf("unknown background task %q", id)
		}
		return formatOutputPage(page), nil
	}
	tail, err := intArg(args["tail"], 0, 0, 10000)
	if err != nil {
		return "", err
	}
	lines, ok := processmgr.DefaultManager().Output(id, tail)
	if !ok {
		return "", fmt.Errorf("unknown background task %q", id)
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

type Restart struct{}

func (t *Restart) Name() string { return "background_restart" }
func (t *Restart) Description() string {
	return "重启 Natalia 管理的后台任务，复用原 command/args/cwd/env/lifetime 设置"
}
func (t *Restart) Required() []string { return []string{"id"} }
func (t *Restart) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"id": {Type: "string", Description: "background task session id"}}
}
func (t *Restart) Execute(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	if err := requireBackground(id); err != nil {
		return "", err
	}
	sess, err := processmgr.DefaultManager().Restart(context.Background(), id)
	if err != nil {
		return "", err
	}
	return "background task restarted\n" + formatSession(sess), nil
}

type Stop struct{}

func (t *Stop) Name() string        { return "background_stop" }
func (t *Stop) Description() string { return "停止 Natalia 管理的后台任务" }
func (t *Stop) Required() []string  { return []string{"id"} }
func (t *Stop) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"id": {Type: "string", Description: "background task session id"}}
}
func (t *Stop) Execute(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	if err := requireBackground(id); err != nil {
		return "", err
	}
	if err := processmgr.DefaultManager().Stop(id); err != nil {
		return "", err
	}
	sess, _ := processmgr.DefaultManager().Status(id)
	return "background task stopped\n" + formatSession(sess), nil
}

type Cleanup struct{}

func (t *Cleanup) Name() string { return "background_cleanup" }
func (t *Cleanup) Description() string {
	return "清理已完成后台任务，并可按 idle/max lifetime 停止运行中的后台任务"
}
func (t *Cleanup) Required() []string { return nil }
func (t *Cleanup) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"finished_max_age": {Type: "integer", Description: "可选，完成后保留秒数，默认 0"},
		"idle_timeout":     {Type: "integer", Description: "可选，运行中任务空闲秒数阈值，0 表示不检查"},
		"max_lifetime":     {Type: "integer", Description: "可选，运行中任务最大运行秒数阈值，0 表示不检查"},
		"detect_stale":     {Type: "boolean", Description: "可选，检查 PID 是否已失效"},
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
	result := processmgr.DefaultManager().Sweep(processmgr.SweepOptions{FinishedMaxAge: finishedMaxAge, IdleTimeout: idleTimeout, MaxLifetime: maxLifetime, DetectStale: boolArg(args["detect_stale"])})
	return fmt.Sprintf("background cleanup complete\nremoved: %d\nstopped: %d\nstale: %d", result.Removed, result.Stopped, result.Stale), nil
}

type Audit struct{}

func (t *Audit) Name() string { return "background_audit" }
func (t *Audit) Description() string {
	return "查看后台任务审计日志，secret env 只显示 redacted 摘要"
}
func (t *Audit) Required() []string { return nil }
func (t *Audit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"tail": {Type: "integer", Description: "可选，最近多少条审计记录，默认全部"}}
}
func (t *Audit) Execute(args map[string]any) (string, error) {
	tail, err := intArg(args["tail"], 0, 0, 10000)
	if err != nil {
		return "", err
	}
	entries := processmgr.DefaultManager().AuditLog()
	filtered := make([]processmgr.AuditEntry, 0, len(entries))
	for _, entry := range entries {
		if entry.Kind == processmgr.KindBackground {
			filtered = append(filtered, entry)
		}
	}
	if tail > 0 && tail < len(filtered) {
		filtered = filtered[len(filtered)-tail:]
	}
	if len(filtered) == 0 {
		return "<no background audit entries>", nil
	}
	var b strings.Builder
	for _, entry := range filtered {
		fmt.Fprintf(&b, "%s %s id=%s status=%s command=%s %s", entry.Time.Format(time.RFC3339), entry.Action, entry.SessionID, entry.Status, entry.Command, strings.Join(entry.Args, " "))
		if len(entry.EnvSummary) > 0 {
			fmt.Fprintf(&b, " env=%s", strings.Join(entry.EnvSummary, ","))
		}
		b.WriteByte('\n')
	}
	return strings.TrimRight(b.String(), "\n"), nil
}

func requireBackground(id string) error {
	sess, ok := processmgr.DefaultManager().Status(id)
	if !ok {
		return fmt.Errorf("unknown background task %q", id)
	}
	if sess.Kind != processmgr.KindBackground {
		return fmt.Errorf("session %q is %s, not background", id, sess.Kind)
	}
	return nil
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

func intArg(raw any, defaultValue, minValue, maxValue int) (int, error) {
	if raw == nil {
		return defaultValue, nil
	}
	var value int
	switch v := raw.(type) {
	case int:
		value = v
	case float64:
		if v != float64(int(v)) {
			return 0, fmt.Errorf("value must be an integer")
		}
		value = int(v)
	default:
		return 0, fmt.Errorf("value must be an integer")
	}
	if value < minValue || value > maxValue {
		return 0, fmt.Errorf("value must be between %d and %d", minValue, maxValue)
	}
	return value, nil
}

func durationSecondsArg(raw any, defaultValue, minValue, maxValue int) (time.Duration, error) {
	value, err := intArg(raw, defaultValue, minValue, maxValue)
	if err != nil {
		return 0, fmt.Errorf("duration must be an integer number of seconds")
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

func formatOutputPage(page processmgr.OutputPage) string {
	if len(page.Lines) == 0 {
		return fmt.Sprintf("<no output>\npage: offset=%d next_offset=%d total=%d has_more=%t", page.Offset, page.NextOffset, page.Total, page.HasMore)
	}
	var b strings.Builder
	for _, line := range page.Lines {
		fmt.Fprintf(&b, "%s: %s\n", line.Stream, line.Text)
	}
	fmt.Fprintf(&b, "page: offset=%d next_offset=%d total=%d has_more=%t", page.Offset, page.NextOffset, page.Total, page.HasMore)
	return strings.TrimRight(b.String(), "\n")
}

func formatSessions(sessions []processmgr.Session) string {
	if len(sessions) == 0 {
		return "<no background tasks>"
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
		return "<nil background task>"
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
	lifetimeLine := ""
	if sess.IdleTimeout > 0 {
		lifetimeLine += fmt.Sprintf("\nidle_timeout: %s", sess.IdleTimeout)
	}
	if sess.MaxLifetime > 0 {
		lifetimeLine += fmt.Sprintf("\nmax_lifetime: %s", sess.MaxLifetime)
	}
	return fmt.Sprintf("id: %s\nkind: %s\nstatus: %s\npid: %d\ncommand: %s %s\nattached: %t%s%s%s%s", sess.ID, sess.Kind, sess.Status, sess.PID, sess.Command, strings.Join(sess.Args, " "), sess.Attached, lifetimeLine, envLine, exitCode, errLine)
}
