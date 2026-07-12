package process

import (
	"context"
	"fmt"
	"strings"

	"github.com/aquama/natalia-cli/internal/llm"
	"github.com/aquama/natalia-cli/internal/processmgr"
)

var manager = processmgr.New()

type Start struct{}

func (t *Start) Name() string { return "process_start" }
func (t *Start) Description() string {
	return "启动由 Natalia 管理的后台进程，返回 process session id"
}
func (t *Start) Required() []string { return []string{"command"} }
func (t *Start) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"command": {Type: "string", Description: "要启动的命令路径或可执行名"},
		"args":    {Type: "array", Description: "可选，命令参数数组"},
		"cwd":     {Type: "string", Description: "可选，工作目录，必须已存在"},
		"kind":    {Type: "string", Description: "可选，process|background|interactive|mcp，默认 process"},
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
	cwd, _ := args["cwd"].(string)
	kind := parseKind(args)
	sess, err := manager.Start(context.Background(), processmgr.StartOptions{Command: command, Args: argv, Cwd: cwd, Kind: kind})
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
	return formatSessions(manager.List()), nil
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
	sess, ok := manager.Status(id)
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
	lines, ok := manager.Output(id, tail)
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
func (t *Stop) Execute(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	if err := manager.Stop(id); err != nil {
		return "", err
	}
	sess, _ := manager.Status(id)
	return "已停止进程\n" + formatSession(sess), nil
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
