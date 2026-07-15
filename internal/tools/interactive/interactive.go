package interactive

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/commandpolicy"
	"github.com/Misaka477/Natalia-Cli/internal/interactivemgr"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
)

type manager interface {
	Start(context.Context, interactivemgr.StartOptions) (*interactivemgr.Session, error)
	List() []interactivemgr.Session
	Status(string) (*interactivemgr.Session, bool)
	Attach(string) (*interactivemgr.Session, error)
	Detach(string) (*interactivemgr.Session, error)
	Resize(string, int, int) (*interactivemgr.Session, error)
	Transcript(string, int, int) (interactivemgr.TranscriptPage, error)
	CleanupFinished(time.Duration) int
	Observe(string, interactivemgr.ObserveOptions) (*interactivemgr.Observation, error)
	Write(string, string, bool, interactivemgr.ObserveOptions) (*interactivemgr.Observation, error)
	SendKey(string, string, interactivemgr.ObserveOptions) (*interactivemgr.Observation, error)
	Stop(string) error
}

var currentManager = func() manager { return interactivemgr.DefaultManager() }

type Start struct{}

func (t *Start) Name() string { return "interactive_start" }
func (t *Start) Description() string {
	return "start an interactive PTY session for REPLs, installers, scaffolds, or prompt-driven CLIs"
}
func (t *Start) Required() []string { return []string{"command"} }
func (t *Start) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"command":         {Type: "string", Description: "command path or executable name"},
		"args":            {Type: "array", Description: "optional, command arguments array"},
		"cwd":             {Type: "string", Description: "optional, working directory; must already exist"},
		"rows":            {Type: "integer", Description: "optional, PTY rows; default 24, range 10-200"},
		"cols":            {Type: "integer", Description: "optional, PTY columns; default 80, range 20-400"},
		"wait_for":        {Type: "string", Description: "optional, prompt regex to wait for after startup"},
		"idle_timeout_ms": {Type: "integer", Description: "optional, output silence duration before considering input needed; default 200"},
		"max_wait_ms":     {Type: "integer", Description: "optional, max observation time; default 2000"},
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
	if err := commandpolicy.RequireConfirmation(args, commandpolicy.Evaluate(command, argv)); err != nil {
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
	mgr := currentManager()
	sess, err := mgr.Start(context.Background(), interactivemgr.StartOptions{Command: command, Args: argv, Cwd: cwd, Rows: rows, Cols: cols, DecisionID: decisionIDFromArgs(args)})
	if err != nil {
		return "", err
	}
	obs, err := mgr.Observe(sess.ID, observeOpts)
	if err != nil {
		return "", err
	}
	return formatSession(sess) + "\n" + formatObservation(obs, explicitTail(args)), nil
}

type Read struct{}

func (t *Read) Name() string { return "interactive_read" }
func (t *Read) Description() string {
	return "observe an interactive PTY session until prompt, silence, or timeout"
}
func (t *Read) Required() []string { return []string{"id"} }
func (t *Read) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":              {Type: "string", Description: "interactive session id"},
		"wait_for":        {Type: "string", Description: "optional, prompt regex to wait for"},
		"idle_timeout_ms": {Type: "integer", Description: "optional, output silence duration before considering input needed; default 200"},
		"max_wait_ms":     {Type: "integer", Description: "optional, max observation time; default 2000"},
		"tail_bytes":      {Type: "integer", Description: "optional, only used for explicit tail slice requests; default no truncation"},
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
	obs, err := currentManager().Observe(id, observeOpts)
	if err != nil {
		return "", err
	}
	return formatObservation(obs, explicitTail(args)), nil
}

type Write struct{}

func (t *Write) Name() string { return "interactive_write" }
func (t *Write) Description() string {
	return "write input to an interactive PTY session and return observation; single-line input appends Enter by default, input=\"\" with submit=true sends an empty Enter, set submit=false for partial input"
}
func (t *Write) Required() []string { return []string{"id", "input"} }
func (t *Write) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":              {Type: "string", Description: "interactive session id"},
		"input":           {Type: "string", Description: "input to write; submitted as a line by default; empty string is valid with submit=true to send Enter"},
		"submit":          {Type: "boolean", Description: "optional, default true; false writes without Enter, for chunked input; submit=false with empty input is a no-op observation"},
		"sensitive":       {Type: "boolean", Description: "optional, true marks secret input; the input is not echoed back"},
		"wait_for":        {Type: "string", Description: "optional, prompt regex to wait for after write"},
		"idle_timeout_ms": {Type: "integer", Description: "optional, output silence duration before considering input needed; default 200"},
		"max_wait_ms":     {Type: "integer", Description: "optional, max observation time; default 2000"},
		"tail_bytes":      {Type: "integer", Description: "optional, only used for explicit tail slice requests; default no truncation"},
	}
}
func (t *Write) Execute(args map[string]any) (string, error) {
	id, err := requireID(args)
	if err != nil {
		return "", err
	}
	rawInput, ok := args["input"]
	if !ok {
		return "", fmt.Errorf("input required")
	}
	input, ok := rawInput.(string)
	if !ok {
		return "", fmt.Errorf("input must be a string")
	}
	submit := true
	if raw, ok := args["submit"].(bool); ok {
		submit = raw
	}
	if submit && !strings.HasSuffix(input, "\n") && !strings.HasSuffix(input, "\r") {
		input += "\r"
	}
	sensitive, _ := args["sensitive"].(bool)
	observeOpts, err := observeOptions(args, !sensitive)
	if err != nil {
		return "", err
	}
	obs, err := currentManager().Write(id, input, sensitive, observeOpts)
	if err != nil {
		return "", err
	}
	if sensitive {
		obs.NewOutput = "[redacted after sensitive input]"
		obs.Tail = ""
		obs.Truncated = false
	}
	return formatObservation(obs, explicitTail(args)), nil
}

type Keys struct{}

func (t *Keys) Name() string { return "interactive_keys" }
func (t *Keys) Description() string {
	return "send special keys (Enter, Ctrl-C, Ctrl-D, Tab, Esc, etc.) to an interactive PTY session"
}
func (t *Keys) Required() []string { return []string{"id", "key"} }
func (t *Keys) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":              {Type: "string", Description: "interactive session id"},
		"key":             {Type: "string", Description: "enter|ctrl-c|ctrl-d|tab|esc"},
		"wait_for":        {Type: "string", Description: "optional, prompt regex to wait for after sending key"},
		"idle_timeout_ms": {Type: "integer", Description: "optional, output silence duration before considering input needed; default 200"},
		"max_wait_ms":     {Type: "integer", Description: "optional, max observation time; default 2000"},
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
	obs, err := currentManager().SendKey(id, key, observeOpts)
	if err != nil {
		return "", err
	}
	return formatObservation(obs, explicitTail(args)), nil
}

type Stop struct{}

func (t *Stop) Name() string        { return "interactive_stop" }
func (t *Stop) Description() string { return "stop an interactive PTY session" }
func (t *Stop) Required() []string  { return []string{"id"} }
func (t *Stop) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"id": {Type: "string", Description: "interactive session id"}}
}
func (t *Stop) Execute(args map[string]any) (string, error) {
	id, err := requireID(args)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(id, "proc_") {
		return "", fmt.Errorf("%q looks like a process session id; use process_stop for proc_* sessions", id)
	}
	if strings.HasPrefix(id, "bg_") {
		return "", fmt.Errorf("%q looks like a background task id; use background_stop for bg_* sessions", id)
	}
	mgr := currentManager()
	if err := mgr.Stop(id); err != nil {
		return "", err
	}
	sess, _ := mgr.Status(id)
	return "interactive session stopped\n" + formatSession(sess), nil
}

type Attach struct{}

func (t *Attach) Name() string        { return "interactive_attach" }
func (t *Attach) Description() string { return "re-attach to an interactive PTY session" }
func (t *Attach) Required() []string  { return []string{"id"} }
func (t *Attach) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"id": {Type: "string", Description: "interactive session id"}}
}
func (t *Attach) Execute(args map[string]any) (string, error) {
	id, err := requireID(args)
	if err != nil {
		return "", err
	}
	sess, err := currentManager().Attach(id)
	if err != nil {
		return "", err
	}
	return "interactive session attached\n" + formatSession(sess), nil
}

type Detach struct{}

func (t *Detach) Name() string { return "interactive_detach" }
func (t *Detach) Description() string {
	return "detach an interactive PTY session; the process keeps running"
}
func (t *Detach) Required() []string { return []string{"id"} }
func (t *Detach) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"id": {Type: "string", Description: "interactive session id"}}
}
func (t *Detach) Execute(args map[string]any) (string, error) {
	id, err := requireID(args)
	if err != nil {
		return "", err
	}
	sess, err := currentManager().Detach(id)
	if err != nil {
		return "", err
	}
	return "interactive session detached\n" + formatSession(sess), nil
}

type Resize struct{}

func (t *Resize) Name() string        { return "interactive_resize" }
func (t *Resize) Description() string { return "resize an interactive PTY session window" }
func (t *Resize) Required() []string  { return []string{"id", "rows", "cols"} }
func (t *Resize) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":   {Type: "string", Description: "interactive session id"},
		"rows": {Type: "integer", Description: "PTY rows, range 10-200"},
		"cols": {Type: "integer", Description: "PTY columns, range 20-400"},
	}
}
func (t *Resize) Execute(args map[string]any) (string, error) {
	id, err := requireID(args)
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
	sess, err := currentManager().Resize(id, rows, cols)
	if err != nil {
		return "", err
	}
	return "interactive session resized\n" + formatSession(sess), nil
}

type Transcript struct{}

func (t *Transcript) Name() string { return "interactive_transcript" }
func (t *Transcript) Description() string {
	return "page through an interactive PTY transcript; sensitive input is shown redacted"
}

type Cleanup struct{}

func (t *Cleanup) Name() string { return "interactive_cleanup" }
func (t *Cleanup) Description() string {
	return "clean up stopped, exited, or failed interactive PTY sessions"
}
func (t *Cleanup) Required() []string { return nil }
func (t *Cleanup) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"finished_max_age": {Type: "integer", Description: "optional, retention seconds for finished sessions; default 0"},
	}
}
func (t *Cleanup) Execute(args map[string]any) (string, error) {
	maxAge, err := intArg(args["finished_max_age"], 0, 0, 86400*30, "finished_max_age")
	if err != nil {
		return "", err
	}
	removed := currentManager().CleanupFinished(time.Duration(maxAge) * time.Second)
	return fmt.Sprintf("interactive cleanup complete\nremoved: %d", removed), nil
}
func (t *Transcript) Required() []string { return []string{"id"} }
func (t *Transcript) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":     {Type: "string", Description: "interactive session id"},
		"offset": {Type: "integer", Description: "可选，字节偏移，默认 0"},
		"limit":  {Type: "integer", Description: "可选，读取字节数，默认 4096"},
	}
}
func (t *Transcript) Execute(args map[string]any) (string, error) {
	id, err := requireID(args)
	if err != nil {
		return "", err
	}
	offset, err := intArg(args["offset"], 0, 0, 10000000, "offset")
	if err != nil {
		return "", err
	}
	limit, err := intArg(args["limit"], 4096, 1, 200000, "limit")
	if err != nil {
		return "", err
	}
	page, err := currentManager().Transcript(id, offset, limit)
	if err != nil {
		return "", err
	}
	return formatTranscript(page), nil
}

type List struct{}

func (t *List) Name() string                        { return "interactive_list" }
func (t *List) Description() string                 { return "list interactive PTY sessions" }
func (t *List) Required() []string                  { return nil }
func (t *List) Parameters() map[string]llm.Property { return map[string]llm.Property{} }
func (t *List) Execute(args map[string]any) (string, error) {
	sessions := currentManager().List()
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

func explicitTail(args map[string]any) bool {
	if args == nil {
		return false
	}
	_, ok := args["tail_bytes"]
	return ok
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
	tailBytes := 0
	if _, ok := args["tail_bytes"]; ok {
		var err error
		tailBytes, err = intArg(args["tail_bytes"], 0, 256, 1024*1024, "tail_bytes")
		if err != nil {
			return interactivemgr.ObserveOptions{}, err
		}
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

func decisionIDFromArgs(args map[string]any) string {
	if args == nil {
		return ""
	}
	raw, ok := args["__natalia_policy_decision_id"]
	if !ok {
		return ""
	}
	id, _ := raw.(string)
	return id
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
	detachedAt := ""
	if !sess.DetachedAt.IsZero() {
		detachedAt = "\ndetached_at: " + sess.DetachedAt.Format(time.RFC3339)
	}
	return fmt.Sprintf("id: %s\nstatus: %s\npid: %d\ncommand: %s %s\nattached: %t\nsize: %dx%d%s%s%s", sess.ID, sess.Status, sess.PID, sess.Command, strings.Join(sess.Args, " "), sess.Attached, sess.Rows, sess.Cols, detachedAt, exitCode, errLine)
}

func formatObservation(obs *interactivemgr.Observation, includeTail bool) string {
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
	if includeTail && obs.Tail != "" {
		fmt.Fprintf(&b, "tail:\n%s", obs.Tail)
	}
	return strings.TrimRight(b.String(), "\n")
}

func formatTranscript(page interactivemgr.TranscriptPage) string {
	var b strings.Builder
	if page.Text == "" {
		b.WriteString("<empty transcript>\n")
	} else {
		b.WriteString(page.Text)
		b.WriteByte('\n')
	}
	fmt.Fprintf(&b, "page: offset=%d next_offset=%d total=%d has_more=%t",
		page.Offset, page.NextOffset, page.Total, page.HasMore)
	if page.HasMore {
		fmt.Fprintf(&b, " — use interactive_transcript(id=..., offset=%d, limit=4096) to read next page",
			page.NextOffset)
	}
	return strings.TrimRight(b.String(), "\n")
}
