package background

import (
	"context"
	"fmt"
	"strings"

	"github.com/aquama/natalia-cli/internal/llm"
	"github.com/aquama/natalia-cli/internal/processmgr"
)

type Start struct{}

func (t *Start) Name() string { return "background_start" }
func (t *Start) Description() string {
	return "启动由 Natalia 管理的后台任务，适合 dev server、watcher 或长时间命令"
}
func (t *Start) Required() []string { return []string{"command"} }
func (t *Start) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"command":  {Type: "string", Description: "要启动的命令路径或可执行名"},
		"args":     {Type: "array", Description: "可选，命令参数数组"},
		"cwd":      {Type: "string", Description: "可选，工作目录，必须已存在"},
		"max_tail": {Type: "integer", Description: "可选，保留最近多少行输出，默认 1000，范围 1-10000"},
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
	maxTail, err := intArg(args["max_tail"], 1000, 1, 10000)
	if err != nil {
		return "", err
	}
	cwd, _ := args["cwd"].(string)
	sess, err := processmgr.DefaultManager().Start(context.Background(), processmgr.StartOptions{Kind: processmgr.KindBackground, Command: command, Args: argv, Cwd: cwd, MaxTail: maxTail})
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
		"id":   {Type: "string", Description: "background task session id"},
		"tail": {Type: "integer", Description: "可选，最近多少行，默认全部 retained tail"},
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
	return fmt.Sprintf("id: %s\nkind: %s\nstatus: %s\npid: %d\ncommand: %s %s%s%s", sess.ID, sess.Kind, sess.Status, sess.PID, sess.Command, strings.Join(sess.Args, " "), exitCode, errLine)
}
