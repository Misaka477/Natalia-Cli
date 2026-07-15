package process

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"syscall"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/commandpolicy"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/processmgr"
)

type Start struct{}

func (t *Start) Name() string { return "process_start" }
func (t *Start) Description() string {
	return "start a background process managed by Natalia, returns process session id"
}
func (t *Start) Required() []string { return []string{"command"} }
func (t *Start) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"command":      {Type: "string", Description: "command path or executable name"},
		"args":         {Type: "array", Description: "optional, command arguments array"},
		"cwd":          {Type: "string", Description: "optional, working directory; must already exist"},
		"env":          {Type: "object", Description: "optional, additional environment variables; secret/token/password/key names are redacted in status"},
		"kind":         {Type: "string", Description: "optional, process|background|interactive|mcp; default process"},
		"idle_timeout": {Type: "integer", Description: "optional, idle auto-stop seconds; 0 means unlimited"},
		"max_lifetime": {Type: "integer", Description: "optional, max runtime seconds; 0 means unlimited"},
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
	sess, err := processmgr.DefaultManager().Start(context.Background(), processmgr.StartOptions{Command: command, Args: argv, Cwd: cwd, Env: env, Kind: kind, IdleTimeout: idleTimeout, MaxLifetime: maxLifetime, DecisionID: decisionIDFromArgs(args)})
	if err != nil {
		return "", err
	}
	return formatSession(sess), nil
}

type List struct{}

func (t *List) Name() string                        { return "process_list" }
func (t *List) Description() string                 { return "list processes managed by Natalia" }
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
func (t *Status) Description() string { return "check status of a Natalia-managed process" }
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
func (t *Output) Description() string { return "read recent output from a Natalia-managed process" }
func (t *Output) Required() []string  { return []string{"id"} }
func (t *Output) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":     {Type: "string", Description: "process session id"},
		"tail":   {Type: "integer", Description: "optional, recent lines to return; default all retained tail"},
		"format": {Type: "string", Description: "optional, output format: text or json; default text"},
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
	format, _ := args["format"].(string)
	if format == "json" {
		data, err := json.Marshal(lines)
		if err != nil {
			return "", err
		}
		return string(data), nil
	}
	var b strings.Builder
	for _, line := range lines {
		fmt.Fprintf(&b, "%s: %s\n", line.Stream, line.Text)
	}
	return strings.TrimRight(b.String(), "\n"), nil
}

type Stop struct{}

func (t *Stop) Name() string        { return "process_stop" }
func (t *Stop) Description() string { return "stop a Natalia-managed process" }
func (t *Stop) Required() []string  { return []string{"id"} }
func (t *Stop) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":         {Type: "string", Description: "process session id"},
		"signal":     {Type: "string", Description: "optional, signal to send: TERM, INT, KILL; default TERM"},
		"grace":      {Type: "integer", Description: "optional, seconds to wait for graceful stop; default 2"},
		"kill_after": {Type: "integer", Description: "optional, seconds after grace to force kill; default equals grace"},
	}
}

type Restart struct{}

func (t *Restart) Name() string { return "process_restart" }
func (t *Restart) Description() string {
	return "restart a Natalia-managed process, reusing the original command/args/cwd/env"
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
	return "re-attach to a Natalia-managed process and resume event/state observation"
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
	return "detach from a Natalia-managed process; the process continues running but state is marked detached"
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
	return "clean up finished processes and optionally stop running ones by idle/max lifetime; returns affected IDs"
}
func (t *Cleanup) Required() []string { return nil }
func (t *Cleanup) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"finished_max_age": {Type: "integer", Description: "optional, retention seconds for finished processes; default 0"},
		"idle_timeout":     {Type: "integer", Description: "optional, idle seconds threshold for running processes; 0 means disabled"},
		"max_lifetime":     {Type: "integer", Description: "optional, max runtime seconds threshold for running processes; 0 means disabled"},
		"detect_stale":     {Type: "boolean", Description: "optional, check if PID is no longer valid"},
		"dry_run":          {Type: "boolean", Description: "optional, preview processes to clean up without taking action"},
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
	result := processmgr.DefaultManager().Sweep(processmgr.SweepOptions{FinishedMaxAge: finishedMaxAge, IdleTimeout: idleTimeout, MaxLifetime: maxLifetime, DetectStale: boolArg(args["detect_stale"]), DryRun: dryRun, Kind: processmgr.KindProcess})
	return fmtCleanupResult("process cleanup", result, dryRun), nil
}

type Audit struct{}

func (t *Audit) Name() string { return "process_audit" }
func (t *Audit) Description() string {
	return "view Natalia process management audit log; secret env values are shown redacted"
}
func (t *Audit) Required() []string { return nil }
func (t *Audit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"tail":   {Type: "integer", Description: "optional, recent audit entries to return; default all"},
		"format": {Type: "string", Description: "optional, output format: text or json; default text"},
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
	if strings.HasPrefix(id, "tty_") {
		return "", fmt.Errorf("%q looks like an interactive PTY session id; use interactive_stop for tty_* sessions", id)
	}
	if strings.HasPrefix(id, "bg_") {
		return "", fmt.Errorf("%q looks like a background task id; use background_stop for bg_* sessions", id)
	}
	opts := processmgr.StopOptions{}
	if sig, _ := args["signal"].(string); sig != "" {
		s, err := parseSignal(sig)
		if err != nil {
			return "", err
		}
		opts.Signal = s
	}
	if grace, _ := args["grace"].(float64); grace > 0 {
		opts.Grace = time.Duration(int(grace)) * time.Second
	}
	if killAfter, _ := args["kill_after"].(float64); killAfter > 0 {
		opts.KillAfter = time.Duration(killAfter) * time.Second
	}
	if err := processmgr.DefaultManager().StopWithOptions(id, opts); err != nil {
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

func parseSignal(raw string) (syscall.Signal, error) {
	switch strings.ToUpper(raw) {
	case "TERM":
		return syscall.SIGTERM, nil
	case "INT":
		return syscall.SIGINT, nil
	case "KILL":
		return syscall.SIGKILL, nil
	default:
		return 0, fmt.Errorf("unsupported signal %q: only TERM, INT, KILL are allowed", raw)
	}
}
