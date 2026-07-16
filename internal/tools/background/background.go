package background

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

func (t *Start) Name() string { return "background_start" }
func (t *Start) Description() string {
	return "start a long-running background task managed by Natalia, suitable for dev servers, watchers, or long commands"
}
func (t *Start) Required() []string { return []string{"command"} }
func (t *Start) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"command":      {Type: "string", Description: "command path or executable name"},
		"args":         {Type: "array", Description: "optional, command arguments array"},
		"cwd":          {Type: "string", Description: "optional, working directory; must already exist"},
		"env":          {Type: "object", Description: "optional, additional environment variables; secret/token/password/key names are redacted in status"},
		"max_tail":     {Type: "integer", Description: "optional, recent output lines to retain; default 1000, range 1-10000"},
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
	sess, err := processmgr.DefaultManager().Start(context.Background(), processmgr.StartOptions{Kind: processmgr.KindBackground, Command: command, Args: argv, Cwd: cwd, Env: env, MaxTail: maxTail, IdleTimeout: idleTimeout, MaxLifetime: maxLifetime, DecisionID: decisionIDFromArgs(args)})
	if err != nil {
		return "", err
	}
	return "background task started\n" + formatSession(sess), nil
}

type List struct{}

func (t *List) Name() string                        { return "background_list" }
func (t *List) Description() string                 { return "list background tasks managed by Natalia" }
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
func (t *Output) Description() string { return "read recent output from a background task" }
func (t *Output) Required() []string  { return []string{"id"} }
func (t *Output) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":     {Type: "string", Description: "background task session id"},
		"tail":   {Type: "integer", Description: "optional, recent lines to return; default all retained tail"},
		"offset": {Type: "integer", Description: "optional, pagination start line (0-based); takes precedence over tail when set"},
		"limit":  {Type: "integer", Description: "optional, pagination line count; use with offset"},
		"format": {Type: "string", Description: "optional, output format: text or json; default text"},
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
		sess, _ := processmgr.DefaultManager().Status(id)
		page, ok := processmgr.DefaultManager().OutputPage(id, offset, limit)
		if !ok {
			return "", fmt.Errorf("unknown background task %q", id)
		}
		return formatOutputPage(page, sess), nil
	}
	tail, err := intArg(args["tail"], 0, 0, 10000)
	if err != nil {
		return "", err
	}
	sess, _ := processmgr.DefaultManager().Status(id)
	page, ok := backgroundOutputPage(id, tail)
	if !ok {
		return "", fmt.Errorf("unknown background task %q", id)
	}
	format, _ := args["format"].(string)
	if format == "json" {
		data, err := json.Marshal(page.Lines)
		if err != nil {
			return "", err
		}
		return string(data), nil
	}
	return formatOutputPage(page, sess), nil
}

func backgroundOutputPage(id string, tail int) (processmgr.OutputPage, bool) {
	page, ok := processmgr.DefaultManager().OutputPage(id, 0, 0)
	if !ok {
		return processmgr.OutputPage{}, false
	}
	if tail > 0 && tail < len(page.Lines) {
		page.Offset = len(page.Lines) - tail
		page.Lines = append([]processmgr.OutputLine(nil), page.Lines[page.Offset:]...)
		page.NextOffset = page.Offset + len(page.Lines)
		page.HasMore = false
	}
	return page, true
}

type Restart struct{}

func (t *Restart) Name() string { return "background_restart" }
func (t *Restart) Description() string {
	return "restart a Natalia-managed background task, reusing the original command/args/cwd/env/lifetime settings"
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
	return fmt.Sprintf("background task restarted\nold_id: %s\nnew_id: %s\n%s", id, sess.ID, formatSession(sess)), nil
}

type Stop struct{}

func (t *Stop) Name() string        { return "background_stop" }
func (t *Stop) Description() string { return "stop a Natalia-managed background task" }
func (t *Stop) Required() []string  { return []string{"id"} }
func (t *Stop) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"id":         {Type: "string", Description: "background task session id"},
		"signal":     {Type: "string", Description: "optional, signal to send: TERM, INT, KILL; default TERM"},
		"grace":      {Type: "integer", Description: "optional, seconds to wait for graceful stop; default 2"},
		"kill_after": {Type: "integer", Description: "optional, seconds after grace to force kill; default equals grace"},
	}
}
func (t *Stop) Execute(args map[string]any) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id required")
	}
	if err := requireBackground(id); err != nil {
		return "", err
	}
	opts := processmgr.StopOptions{}
	if sig, _ := args["signal"].(string); sig != "" {
		s, err := parseSignal(sig)
		if err != nil {
			return "", err
		}
		opts.Signal = s
	}
	if grace, _ := intArg(args["grace"], 0, 0, 3600); grace > 0 {
		opts.Grace = time.Duration(grace) * time.Second
	}
	if killAfter, _ := intArg(args["kill_after"], 0, 0, 3600); killAfter > 0 {
		opts.KillAfter = time.Duration(killAfter) * time.Second
	}
	before, ok := processmgr.DefaultManager().Status(id)
	if !ok {
		return "", fmt.Errorf("unknown background task %q", id)
	}
	if before.Status != processmgr.StatusRunning {
		return fmt.Sprintf("background task was already %s before stop\nstop_result: already_%s\nnext_action: no stop signal was sent; inspect output/status or cleanup if no longer needed\n%s", before.Status, before.Status, formatSession(before)), nil
	}
	if err := processmgr.DefaultManager().StopWithOptions(id, opts); err != nil {
		return "", err
	}
	sess, _ := processmgr.DefaultManager().Status(id)
	return "background task stopped\nstop_result: stopped_now\nnext_action: confirm status/output, then cleanup if no longer needed\n" + formatSession(sess), nil
}

type Cleanup struct{}

func (t *Cleanup) Name() string { return "background_cleanup" }
func (t *Cleanup) Description() string {
	return "clean up finished background tasks and optionally stop running ones by idle/max lifetime; returns affected IDs, remaining status summary, and next_action"
}
func (t *Cleanup) Required() []string { return nil }
func (t *Cleanup) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"finished_max_age": {Type: "integer", Description: "optional, retention seconds for finished tasks; default 0"},
		"idle_timeout":     {Type: "integer", Description: "optional, idle seconds threshold for running tasks; 0 means disabled"},
		"max_lifetime":     {Type: "integer", Description: "optional, max runtime seconds threshold for running tasks; 0 means disabled"},
		"detect_stale":     {Type: "boolean", Description: "optional, check if PID is no longer valid"},
		"dry_run":          {Type: "boolean", Description: "optional, preview tasks to clean up without taking action"},
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
	result := processmgr.DefaultManager().Sweep(processmgr.SweepOptions{FinishedMaxAge: finishedMaxAge, IdleTimeout: idleTimeout, MaxLifetime: maxLifetime, DetectStale: boolArg(args["detect_stale"]), DryRun: dryRun, Kind: processmgr.KindBackground})
	return formatCleanupResult(result, dryRun), nil
}

func formatCleanupResult(result processmgr.SweepResult, dryRun bool) string {
	var b strings.Builder
	b.WriteString("background cleanup")
	if dryRun {
		b.WriteString(" dry-run")
	}
	fmt.Fprintf(&b, " complete\nremoved: %d\nstopped: %d\nstale: %d", result.Removed, result.Stopped, result.Stale)
	if dryRun {
		fmt.Fprintf(&b, "\nwould_remove: %d\nwould_stop: %d", result.Removed, result.Stopped+result.Stale)
	}
	if len(result.AffectedIDs) > 0 {
		b.WriteString("\naffected_ids: " + strings.Join(result.AffectedIDs, ", "))
	}
	b.WriteString("\n" + cleanupStatusLine())
	if dryRun {
		b.WriteString("\nnext_action: rerun without dry_run to remove/stop affected background resources, or inspect status/output first")
	} else if result.Removed == 0 && result.Stopped == 0 && result.Stale == 0 {
		b.WriteString("\nnext_action: no background cleanup needed")
	} else {
		b.WriteString("\nnext_action: inspect background_list/background_status to confirm remaining resources")
	}
	return b.String()
}

func cleanupStatusLine() string {
	counts := map[processmgr.Status]int{}
	total := 0
	for _, sess := range processmgr.DefaultManager().List() {
		if sess.Kind != processmgr.KindBackground {
			continue
		}
		total++
		counts[sess.Status]++
	}
	return fmt.Sprintf("remaining_resources: resource_type=%s total=%d running=%d exited=%d stopped=%d failed=%d", processmgr.KindBackground, total, counts[processmgr.StatusRunning], counts[processmgr.StatusExited], counts[processmgr.StatusStopped], counts[processmgr.StatusFailed])
}

type Audit struct{}

func (t *Audit) Name() string { return "background_audit" }
func (t *Audit) Description() string {
	return "view background task audit log; secret env values are redacted; JSON includes event_id/resource_type/resource_id/action/status/time"
}
func (t *Audit) Required() []string { return nil }
func (t *Audit) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"tail":   {Type: "integer", Description: "optional, recent audit entries to return; default all"},
		"format": {Type: "string", Description: "optional, output format: text or json; default text"},
	}
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
	format, _ := args["format"].(string)
	if format == "json" {
		return auditEntriesJSON(filtered), nil
	}
	var b strings.Builder
	for _, entry := range filtered {
		fmt.Fprintf(&b, "%s event_id=%s resource_type=%s resource_id=%s background_id=%s action=%s status=%s command=%s %s", entry.Time.Format(time.RFC3339), entry.EventID, entry.Kind, entry.SessionID, entry.SessionID, entry.Action, entry.Status, entry.Command, strings.Join(entry.Args, " "))
		if len(entry.EnvSummary) > 0 {
			fmt.Fprintf(&b, " env=%s", strings.Join(entry.EnvSummary, ","))
		}
		b.WriteByte('\n')
	}
	return strings.TrimRight(b.String(), "\n"), nil
}

func auditEntriesJSON(entries []processmgr.AuditEntry) string {
	var b strings.Builder
	b.WriteByte('[')
	for i, entry := range entries {
		if i > 0 {
			b.WriteString(",\n ")
		}
		fmt.Fprintf(&b, `{"event_id":%q,"resource_type":%q,"resource_id":%q,"session_id":%q,"action":%q,"event":%q,"kind":%q,"status":%q,"command":%q,"time":%q}`, entry.EventID, entry.Kind, entry.SessionID, entry.SessionID, entry.Action, entry.Action, entry.Kind, entry.Status, entry.Command, entry.Time.Format(time.RFC3339))
	}
	b.WriteByte(']')
	return b.String()
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

func formatOutputPage(page processmgr.OutputPage, sess *processmgr.Session) string {
	if len(page.Lines) == 0 {
		return fmt.Sprintf("<no output>\n%s\n%s", backgroundNoOutputHint(sess), backgroundOutputMetadataLine(page, sess))
	}
	var b strings.Builder
	for _, line := range page.Lines {
		fmt.Fprintf(&b, "%s: %s\n", line.Stream, line.Text)
	}
	b.WriteString(backgroundOutputMetadataLine(page, sess))
	return strings.TrimRight(b.String(), "\n")
}

func backgroundOutputMetadataLine(page processmgr.OutputPage, sess *processmgr.Session) string {
	status := page.Status
	started := page.StartedAt
	lastActive := page.LastActive
	if sess != nil {
		status = sess.Status
		started = sess.StartedAt
		lastActive = sess.LastActivityAt
	}
	return fmt.Sprintf("output_status: status=%s retained_lines=%d max_tail=%d dropped_lines=%d offset=%d next_offset=%d has_more=%t runtime=%s last_activity=%s", status, page.Retained, page.MaxTail, page.Dropped, page.Offset, page.NextOffset, page.HasMore, backgroundDurationSince(started), backgroundDurationSince(lastActive))
}

func backgroundNoOutputHint(sess *processmgr.Session) string {
	if sess == nil {
		return "no_output_reason: session metadata unavailable"
	}
	if sess.Status == processmgr.StatusRunning {
		return "no_output_reason: background task is still running but no stdout/stderr lines are currently retained; command may be silent or output may not have arrived yet; retry later or inspect status"
	}
	return fmt.Sprintf("no_output_reason: background task is %s and no stdout/stderr lines are currently retained", sess.Status)
}

func backgroundDurationSince(t time.Time) string {
	if t.IsZero() {
		return "unknown"
	}
	return time.Since(t).Round(time.Millisecond).String() + " ago"
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
	duration := ""
	if !sess.StartedAt.IsZero() && !sess.ExitedAt.IsZero() {
		duration = fmt.Sprintf("\nduration: %s", sess.ExitedAt.Sub(sess.StartedAt).Round(time.Millisecond))
	}
	startedAt := ""
	if !sess.StartedAt.IsZero() {
		startedAt = "\nstarted_at: " + sess.StartedAt.Format(time.RFC3339)
	}
	return fmt.Sprintf("id: %s\nkind: %s\nstatus: %s\npid: %d\ncommand: %s %s\nattached: %t%s%s%s%s%s%s", sess.ID, sess.Kind, sess.Status, sess.PID, sess.Command, strings.Join(sess.Args, " "), sess.Attached, startedAt, duration, lifetimeLine, envLine, exitCode, errLine)
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
