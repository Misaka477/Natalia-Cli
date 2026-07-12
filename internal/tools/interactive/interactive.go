package interactive

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/interactivemgr"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
)

type Start struct{}

func (t *Start) Name() string { return "interactive_start" }
func (t *Start) Description() string {
	return "启动交互式 PTY session，用于 REPL、installer、脚手架或需要 prompt 的 CLI"
}
func (t *Start) Required() []string { return []string{"command"} }
func (t *Start) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"command":         {Type: "string", Description: "要启动的命令路径或可执行名"},
		"args":            {Type: "array", Description: "可选，命令参数数组"},
		"cwd":             {Type: "string", Description: "可选，工作目录，必须已存在"},
		"rows":            {Type: "integer", Description: "可选，PTY 行数，默认 24，范围 10-200"},
		"cols":            {Type: "integer", Description: "可选，PTY 列数，默认 80，范围 20-400"},
		"wait_for":        {Type: "string", Description: "可选，启动后等待的 prompt 正则"},
		"idle_timeout_ms": {Type: "integer", Description: "可选，输出静默多久视为等待输入，默认 200"},
		"max_wait_ms":     {Type: "integer", Description: "可选，最长观察时间，默认 2000"},
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
	rows, err := intArg(args["rows"], 24, 10, 200, "rows")
	if err != nil {
		return "", err
	}
	cols, err := intArg(args["cols"], 80, 20, 400, "cols")
	if err != nil {
		return "", err
	}
	cwd, _ := args["cwd"].(string)
	observeOpts, err := observeOptions(args, true)
	if err != nil {
		return "", err
	}
	sess, err := interactivemgr.DefaultManager().Start(context.Background(), interactivemgr.StartOptions{Command: command, Args: argv, Cwd: cwd, Rows: rows, Cols: cols})
	if err != nil {
		return "", err
	}
	obs, err := interactivemgr.DefaultManager().Observe(sess.ID, observeOpts)
	if err != nil {
		return "", err
	}
	return formatSession(sess) + "\n" + formatObservation(obs), nil
}

type Read struct{}

func (t *Read) Name() string { return "interactive_read" }
func (t *Read) Description() string {
	return "观察交互式 PTY session，直到 prompt、静默或超时"
}
func (t *Read) Required() []string { return []string{"id"} }
func (t *Read) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":              {Type: "string", Description: "interactive session id"},
		"wait_for":        {Type: "string", Description: "可选，等待的 prompt 正则"},
		"idle_timeout_ms": {Type: "integer", Description: "可选，输出静默多久视为等待输入，默认 200"},
		"max_wait_ms":     {Type: "integer", Description: "可选，最长观察时间，默认 2000"},
		"tail_bytes":      {Type: "integer", Description: "可选，tail 字节数，默认 4096"},
	}
}
func (t *Read) Execute(args map[string]any) (string, error) {
	id, err := requireID(args)
	if err != nil {
		return "", err
	}
	observeOpts, err := observeOptions(args, true)
	if err != nil {
		return "", err
	}
	obs, err := interactivemgr.DefaultManager().Observe(id, observeOpts)
	if err != nil {
		return "", err
	}
	return formatObservation(obs), nil
}

type Write struct{}

func (t *Write) Name() string { return "interactive_write" }
func (t *Write) Description() string {
	return "向交互式 PTY session 写入输入，然后返回 observation；写入后必须观察输出再继续"
}
func (t *Write) Required() []string { return []string{"id", "input"} }
func (t *Write) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":              {Type: "string", Description: "interactive session id"},
		"input":           {Type: "string", Description: "要写入的输入；需要提交时包含换行"},
		"sensitive":       {Type: "boolean", Description: "可选，true 表示 secret 输入，不在返回中回显输入"},
		"wait_for":        {Type: "string", Description: "可选，写入后等待的 prompt 正则"},
		"idle_timeout_ms": {Type: "integer", Description: "可选，输出静默多久视为等待输入，默认 200"},
		"max_wait_ms":     {Type: "integer", Description: "可选，最长观察时间，默认 2000"},
		"tail_bytes":      {Type: "integer", Description: "可选，tail 字节数，默认 4096"},
	}
}
func (t *Write) Execute(args map[string]any) (string, error) {
	id, err := requireID(args)
	if err != nil {
		return "", err
	}
	input, _ := args["input"].(string)
	if input == "" {
		return "", fmt.Errorf("input required")
	}
	sensitive, _ := args["sensitive"].(bool)
	observeOpts, err := observeOptions(args, !sensitive)
	if err != nil {
		return "", err
	}
	obs, err := interactivemgr.DefaultManager().Write(id, input, sensitive, observeOpts)
	if err != nil {
		return "", err
	}
	if sensitive {
		obs.NewOutput = ""
		obs.Tail = "[redacted after sensitive input]"
		obs.Truncated = false
	}
	return formatObservation(obs), nil
}

type Keys struct{}

func (t *Keys) Name() string { return "interactive_keys" }
func (t *Keys) Description() string {
	return "向交互式 PTY session 发送 Enter、Ctrl-C、Ctrl-D、Tab、Esc 等特殊键"
}
func (t *Keys) Required() []string { return []string{"id", "key"} }
func (t *Keys) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":              {Type: "string", Description: "interactive session id"},
		"key":             {Type: "string", Description: "enter|ctrl-c|ctrl-d|tab|esc"},
		"wait_for":        {Type: "string", Description: "可选，发送后等待的 prompt 正则"},
		"idle_timeout_ms": {Type: "integer", Description: "可选，输出静默多久视为等待输入，默认 200"},
		"max_wait_ms":     {Type: "integer", Description: "可选，最长观察时间，默认 2000"},
	}
}
func (t *Keys) Execute(args map[string]any) (string, error) {
	id, err := requireID(args)
	if err != nil {
		return "", err
	}
	key, _ := args["key"].(string)
	if key == "" {
		return "", fmt.Errorf("key required")
	}
	observeOpts, err := observeOptions(args, true)
	if err != nil {
		return "", err
	}
	obs, err := interactivemgr.DefaultManager().SendKey(id, key, observeOpts)
	if err != nil {
		return "", err
	}
	return formatObservation(obs), nil
}

type Stop struct{}

func (t *Stop) Name() string        { return "interactive_stop" }
func (t *Stop) Description() string { return "停止交互式 PTY session" }
func (t *Stop) Required() []string  { return []string{"id"} }
func (t *Stop) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"id": {Type: "string", Description: "interactive session id"}}
}
func (t *Stop) Execute(args map[string]any) (string, error) {
	id, err := requireID(args)
	if err != nil {
		return "", err
	}
	if err := interactivemgr.DefaultManager().Stop(id); err != nil {
		return "", err
	}
	sess, _ := interactivemgr.DefaultManager().Status(id)
	return "interactive session stopped\n" + formatSession(sess), nil
}

type List struct{}

func (t *List) Name() string                        { return "interactive_list" }
func (t *List) Description() string                 { return "列出交互式 PTY sessions" }
func (t *List) Required() []string                  { return nil }
func (t *List) Parameters() map[string]llm.Property { return map[string]llm.Property{} }
func (t *List) Execute(args map[string]any) (string, error) {
	sessions := interactivemgr.DefaultManager().List()
	if len(sessions) == 0 {
		return "<no interactive sessions>", nil
	}
	var b strings.Builder
	for _, sess := range sessions {
		b.WriteString(formatSession(&sess))
		b.WriteString("\n---\n")
	}
	return strings.TrimRight(b.String(), "\n-"), nil
}

func requireID(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	return id, nil
}

func observeOptions(args map[string]any, includeOutput bool) (interactivemgr.ObserveOptions, error) {
	waitFor, _ := args["wait_for"].(string)
	idle, err := intArg(args["idle_timeout_ms"], 200, 20, 60000, "idle_timeout_ms")
	if err != nil {
		return interactivemgr.ObserveOptions{}, err
	}
	maxWait, err := intArg(args["max_wait_ms"], 2000, 20, 120000, "max_wait_ms")
	if err != nil {
		return interactivemgr.ObserveOptions{}, err
	}
	tailBytes, err := intArg(args["tail_bytes"], 4096, 256, 200000, "tail_bytes")
	if err != nil {
		return interactivemgr.ObserveOptions{}, err
	}
	return interactivemgr.ObserveOptions{WaitFor: waitFor, IdleTimeout: time.Duration(idle) * time.Millisecond, MaxWait: time.Duration(maxWait) * time.Millisecond, TailBytes: tailBytes, IncludeOutput: includeOutput}, nil
}

func parseArgs(raw any) ([]string, error) {
	if raw == nil {
		return nil, nil
	}
	items, ok := raw.([]any)
	if !ok {
		return nil, fmt.Errorf("args must be an array")
	}
	out := make([]string, 0, len(items))
	for i, item := range items {
		s, ok := item.(string)
		if !ok {
			return nil, fmt.Errorf("args[%d] must be a string", i)
		}
		out = append(out, s)
	}
	return out, nil
}

func intArg(raw any, defaultValue, minValue, maxValue int, name string) (int, error) {
	if raw == nil {
		return defaultValue, nil
	}
	var value int
	switch v := raw.(type) {
	case int:
		value = v
	case float64:
		if v != float64(int(v)) {
			return 0, fmt.Errorf("%s must be an integer", name)
		}
		value = int(v)
	default:
		return 0, fmt.Errorf("%s must be an integer", name)
	}
	if value < minValue || value > maxValue {
		return 0, fmt.Errorf("%s must be between %d and %d", name, minValue, maxValue)
	}
	return value, nil
}

func formatSession(sess *interactivemgr.Session) string {
	if sess == nil {
		return "<nil interactive session>"
	}
	exitCode := ""
	if sess.ExitCode != nil {
		exitCode = fmt.Sprintf("\nexit_code: %d", *sess.ExitCode)
	}
	errLine := ""
	if sess.Error != "" {
		errLine = "\nerror: " + sess.Error
	}
	return fmt.Sprintf("id: %s\nstatus: %s\npid: %d\ncommand: %s %s%s%s", sess.ID, sess.Status, sess.PID, sess.Command, strings.Join(sess.Args, " "), exitCode, errLine)
}

func formatObservation(obs *interactivemgr.Observation) string {
	if obs == nil {
		return "<nil observation>"
	}
	var b strings.Builder
	fmt.Fprintf(&b, "observation:\nsession_id: %s\nstatus: %s\n", obs.SessionID, obs.Status)
	if obs.ExitCode != nil {
		fmt.Fprintf(&b, "exit_code: %d\n", *obs.ExitCode)
	}
	if obs.DetectedPrompt != "" {
		fmt.Fprintf(&b, "detected_prompt: %s\n", obs.DetectedPrompt)
	}
	fmt.Fprintf(&b, "suggested_next_action: %s\n", obs.Suggestion)
	if obs.Truncated {
		b.WriteString("truncated: true\n")
	}
	if obs.NewOutput != "" {
		fmt.Fprintf(&b, "new_output:\n%s\n", obs.NewOutput)
	}
	if obs.Tail != "" {
		fmt.Fprintf(&b, "tail:\n%s", obs.Tail)
	}
	return strings.TrimRight(b.String(), "\n")
}
