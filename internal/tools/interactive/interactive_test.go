package interactive

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/interactivemgr"
)

func resetManager() {
	interactivemgr.ResetDefaultManagerForTest()
	currentManager = func() manager { return interactivemgr.DefaultManager() }
}

type fakeManager struct {
	sessions  []interactivemgr.Session
	lastOpts  interactivemgr.ObserveOptions
	lastInput string
	stopped   bool
}

func (m *fakeManager) Start(ctx context.Context, opts interactivemgr.StartOptions) (*interactivemgr.Session, error) {
	if opts.Command != "fake-cli" || len(opts.Args) != 1 || opts.Args[0] != "--repl" || opts.Rows != 30 || opts.Cols != 120 {
		return nil, fmt.Errorf("unexpected start options: %+v", opts)
	}
	sess := interactivemgr.Session{ID: "tty_fake", Command: opts.Command, Args: opts.Args, Status: interactivemgr.StatusRunning, PID: 123, Attached: true, Rows: opts.Rows, Cols: opts.Cols}
	m.sessions = []interactivemgr.Session{sess}
	return &sess, nil
}

func (m *fakeManager) List() []interactivemgr.Session {
	return append([]interactivemgr.Session(nil), m.sessions...)
}

func (m *fakeManager) Status(id string) (*interactivemgr.Session, bool) {
	for _, sess := range m.sessions {
		if sess.ID == id {
			if m.stopped {
				sess.Status = interactivemgr.StatusStopped
			}
			return &sess, true
		}
	}
	return nil, false
}

func (m *fakeManager) Attach(id string) (*interactivemgr.Session, error) {
	sess, ok := m.Status(id)
	if !ok {
		return nil, fmt.Errorf("missing")
	}
	sess.Attached = true
	m.sessions[0] = *sess
	return sess, nil
}

func (m *fakeManager) Detach(id string) (*interactivemgr.Session, error) {
	sess, ok := m.Status(id)
	if !ok {
		return nil, fmt.Errorf("missing")
	}
	sess.Attached = false
	m.sessions[0] = *sess
	return sess, nil
}

func (m *fakeManager) Resize(id string, rows, cols int) (*interactivemgr.Session, error) {
	sess, ok := m.Status(id)
	if !ok {
		return nil, fmt.Errorf("missing")
	}
	sess.Rows = rows
	sess.Cols = cols
	m.sessions[0] = *sess
	return sess, nil
}

func (m *fakeManager) Transcript(id string, offset, limit int) (interactivemgr.TranscriptPage, error) {
	return interactivemgr.TranscriptPage{Text: "ready> ok", Total: 9, Offset: offset, NextOffset: offset + len("ready> ok"), HasMore: false}, nil
}

func (m *fakeManager) CleanupFinished(maxAge time.Duration) int {
	removed := 0
	kept := m.sessions[:0]
	for _, sess := range m.sessions {
		if sess.Status == interactivemgr.StatusStopped || sess.Status == interactivemgr.StatusExited || sess.Status == interactivemgr.StatusFailed {
			removed++
			continue
		}
		kept = append(kept, sess)
	}
	m.sessions = kept
	return removed
}

func (m *fakeManager) Observe(id string, opts interactivemgr.ObserveOptions) (*interactivemgr.Observation, error) {
	m.lastOpts = opts
	return &interactivemgr.Observation{SessionID: id, Status: interactivemgr.StatusWaitingForInput, NewOutput: "ready>", Tail: "ready>", DetectedPrompt: "ready>", Suggestion: "send input"}, nil
}

func (m *fakeManager) Write(id, input string, sensitive bool, opts interactivemgr.ObserveOptions) (*interactivemgr.Observation, error) {
	m.lastInput = input
	m.lastOpts = opts
	return &interactivemgr.Observation{SessionID: id, Status: interactivemgr.StatusWaitingForInput, NewOutput: input + "ok", Tail: input + "ok", Suggestion: "continue"}, nil
}

func (m *fakeManager) SendKey(id, key string, opts interactivemgr.ObserveOptions) (*interactivemgr.Observation, error) {
	m.lastInput = key
	m.lastOpts = opts
	return &interactivemgr.Observation{SessionID: id, Status: interactivemgr.StatusWaitingForInput, NewOutput: "key:" + key, Tail: "key:" + key, Suggestion: "continue"}, nil
}

func (m *fakeManager) Stop(id string) error {
	m.stopped = true
	for i := range m.sessions {
		if m.sessions[i].ID == id {
			m.sessions[i].Status = interactivemgr.StatusStopped
		}
	}
	return nil
}

func TestInteractiveToolsFallbackManagerCoversExecuteFlow(t *testing.T) {
	resetManager()
	fake := &fakeManager{}
	currentManager = func() manager { return fake }
	t.Cleanup(resetManager)

	started, err := (&Start{}).Execute(map[string]any{"command": "fake-cli", "args": []any{"--repl"}, "rows": float64(30), "cols": float64(120), "wait_for": "ready>", "idle_timeout_ms": float64(50), "max_wait_ms": float64(500)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(started, "id: tty_fake") || !strings.Contains(started, "detected_prompt: ready>") || fake.lastOpts.WaitFor != "ready>" || fake.lastOpts.IdleTimeout != 50*time.Millisecond {
		t.Fatalf("unexpected start output/options: output=%q opts=%+v", started, fake.lastOpts)
	}

	readIncremental, err := (&Read{}).Execute(map[string]any{"id": "tty_fake"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(readIncremental, "tail:\n") || !strings.Contains(readIncremental, "new_output:\nready>") {
		t.Fatalf("default read should return clean incremental output without tail duplication, got %q", readIncremental)
	}

	read, err := (&Read{}).Execute(map[string]any{"id": "tty_fake", "tail_bytes": float64(512)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(read, "tail:\nready>") || fake.lastOpts.TailBytes != 512 {
		t.Fatalf("unexpected read output/options: output=%q opts=%+v", read, fake.lastOpts)
	}

	written, err := (&Write{}).Execute(map[string]any{"id": "tty_fake", "input": "secret\n", "sensitive": true})
	if err != nil {
		t.Fatal(err)
	}
	if fake.lastInput != "secret\n" || strings.Contains(written, "secret") || !strings.Contains(written, "redacted") {
		t.Fatalf("sensitive write was not routed/redacted: input=%q output=%q", fake.lastInput, written)
	}

	keyed, err := (&Keys{}).Execute(map[string]any{"id": "tty_fake", "key": "enter"})
	if err != nil {
		t.Fatal(err)
	}
	if fake.lastInput != "enter" || !strings.Contains(keyed, "key:enter") {
		t.Fatalf("key was not routed through manager: input=%q output=%q", fake.lastInput, keyed)
	}

	listed, err := (&List{}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(listed, "tty_fake") {
		t.Fatalf("expected fake session in list, got %q", listed)
	}
	detached, err := (&Detach{}).Execute(map[string]any{"id": "tty_fake"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(detached, "attached: false") {
		t.Fatalf("expected detached fake session, got %q", detached)
	}
	attached, err := (&Attach{}).Execute(map[string]any{"id": "tty_fake"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(attached, "attached: true") {
		t.Fatalf("expected attached fake session, got %q", attached)
	}
	resized, err := (&Resize{}).Execute(map[string]any{"id": "tty_fake", "rows": float64(40), "cols": float64(100)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(resized, "size: 40x100") {
		t.Fatalf("expected resized fake session, got %q", resized)
	}
	transcript, err := (&Transcript{}).Execute(map[string]any{"id": "tty_fake", "offset": float64(0), "limit": float64(20)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(transcript, "ready> ok") || !strings.Contains(transcript, "has_more=false") {
		t.Fatalf("expected transcript page, got %q", transcript)
	}
	stopped, err := (&Stop{}).Execute(map[string]any{"id": "tty_fake"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stopped, "status: stopped") {
		t.Fatalf("expected stopped fake session, got %q", stopped)
	}
	cleaned, err := (&Cleanup{}).Execute(map[string]any{"finished_max_age": float64(0)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(cleaned, "removed: 1") {
		t.Fatalf("expected cleanup result, got %q", cleaned)
	}
}

func TestInteractiveWriteSubmitsSingleLineByDefault(t *testing.T) {
	resetManager()
	fake := &fakeManager{}
	currentManager = func() manager { return fake }
	t.Cleanup(resetManager)

	if _, err := (&Write{}).Execute(map[string]any{"id": "tty_fake", "input": "echo ready"}); err != nil {
		t.Fatal(err)
	}
	if fake.lastInput != "echo ready\r" {
		t.Fatalf("expected default write to submit line, got %q", fake.lastInput)
	}
	if _, err := (&Write{}).Execute(map[string]any{"id": "tty_fake", "input": "partial", "submit": false}); err != nil {
		t.Fatal(err)
	}
	if fake.lastInput != "partial" {
		t.Fatalf("expected submit=false to preserve partial input, got %q", fake.lastInput)
	}
}

func TestInteractiveToolsStartWriteReadListStop(t *testing.T) {
	resetManager()
	start, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": []any{"-i"}, "idle_timeout_ms": float64(50), "max_wait_ms": float64(500)})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	id := extractID(t, start)
	defer (&Stop{}).Execute(map[string]any{"id": id})

	written, err := (&Write{}).Execute(map[string]any{"id": id, "input": "printf tool_ready\\n", "wait_for": "tool_ready", "idle_timeout_ms": float64(50), "max_wait_ms": float64(1000)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(written, "tool_ready") || !strings.Contains(written, "status: waiting_for_input") {
		t.Fatalf("unexpected write observation: %q", written)
	}

	listed, err := (&List{}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(listed, id) {
		t.Fatalf("expected list to contain %s, got %q", id, listed)
	}

	stopped, err := (&Stop{}).Execute(map[string]any{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stopped, "status: stopped") {
		t.Fatalf("expected stopped output, got %q", stopped)
	}
}

func TestInteractiveSensitiveWriteRedactsObservation(t *testing.T) {
	resetManager()
	sess, err := interactivemgr.DefaultManager().Start(nil, interactivemgr.StartOptions{Command: "/bin/sh", Args: []string{"-i"}})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	defer interactivemgr.DefaultManager().Stop(sess.ID)

	out, err := (&Write{}).Execute(map[string]any{"id": sess.ID, "input": "secret-value\n", "sensitive": true, "idle_timeout_ms": float64(50), "max_wait_ms": float64(500)})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "secret-value") || !strings.Contains(out, "redacted") {
		t.Fatalf("expected redacted sensitive output, got %q", out)
	}
}

func TestInteractiveKeysEnterAndStop(t *testing.T) {
	resetManager()
	sess, err := interactivemgr.DefaultManager().Start(nil, interactivemgr.StartOptions{Command: "/bin/sh", Args: []string{"-i"}})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	out, err := (&Keys{}).Execute(map[string]any{"id": sess.ID, "key": "enter", "idle_timeout_ms": float64(50), "max_wait_ms": float64(1000)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "status: waiting_for_input") && !strings.Contains(out, "status: running") {
		t.Fatalf("expected running shell after enter, got %q", out)
	}
	stopped, err := (&Stop{}).Execute(map[string]any{"id": sess.ID})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stopped, "status: stopped") {
		t.Fatalf("expected stopped session, got %q", stopped)
	}
}

func TestInteractiveRejectsInvalidObserveArgs(t *testing.T) {
	resetManager()
	_, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "idle_timeout_ms": float64(1)})
	if err == nil || !strings.Contains(err.Error(), "idle_timeout_ms") {
		t.Fatalf("expected idle timeout validation error, got %v", err)
	}
}

func TestInteractivePureValidationAndFormattingPaths(t *testing.T) {
	resetManager()
	listed, err := (&List{}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if listed != "<no interactive sessions>" {
		t.Fatalf("expected empty interactive list, got %q", listed)
	}
	if _, err := (&Start{}).Execute(map[string]any{}); err == nil || !strings.Contains(err.Error(), "command") {
		t.Fatalf("expected missing command error, got %v", err)
	}
	if _, err := (&Write{}).Execute(map[string]any{"id": "tty_1"}); err == nil || !strings.Contains(err.Error(), "input") {
		t.Fatalf("expected missing input error, got %v", err)
	}
	if _, err := (&Keys{}).Execute(map[string]any{"id": "tty_1"}); err == nil || !strings.Contains(err.Error(), "key") {
		t.Fatalf("expected missing key error, got %v", err)
	}
	if _, err := parseArgs("bad"); err == nil || !strings.Contains(err.Error(), "array") {
		t.Fatalf("expected parseArgs type error, got %v", err)
	}
	if _, err := intArg("bad", 24, 10, 200, "rows"); err == nil || !strings.Contains(err.Error(), "rows") {
		t.Fatalf("expected intArg type error, got %v", err)
	}
	if _, err := intArg(float64(9), 24, 10, 200, "rows"); err == nil || !strings.Contains(err.Error(), "between") {
		t.Fatalf("expected intArg range error, got %v", err)
	}
	if got := formatObservation(nil, false); got != "<nil observation>" {
		t.Fatalf("unexpected nil observation formatting: %q", got)
	}
	if got := formatSession(nil); got != "<nil interactive session>" {
		t.Fatalf("unexpected nil session formatting: %q", got)
	}
}

func TestInteractiveObserveOptionBoundaries(t *testing.T) {
	if _, err := observeOptions(map[string]any{"tail_bytes": float64(255)}, true); err == nil || !strings.Contains(err.Error(), "tail_bytes") {
		t.Fatalf("expected tail_bytes min error, got %v", err)
	}
	if _, err := observeOptions(map[string]any{"max_wait_ms": float64(19)}, true); err == nil || !strings.Contains(err.Error(), "max_wait_ms") {
		t.Fatalf("expected max_wait_ms min error, got %v", err)
	}
	opts, err := observeOptions(map[string]any{"wait_for": "ready", "idle_timeout_ms": float64(50), "max_wait_ms": float64(100), "tail_bytes": float64(512)}, false)
	if err != nil {
		t.Fatal(err)
	}
	if opts.WaitFor != "ready" || opts.IncludeOutput || opts.TailBytes != 512 {
		t.Fatalf("unexpected observe options: %+v", opts)
	}
}

func extractID(t *testing.T, output string) string {
	t.Helper()
	re := regexp.MustCompile(`id: (tty_\d+)`)
	m := re.FindStringSubmatch(output)
	if len(m) != 2 {
		t.Fatalf("could not extract id from %q", output)
	}
	return m[1]
}

func skipIfPTYUnsupported(t *testing.T, err error) {
	t.Helper()
	if strings.Contains(err.Error(), "operation not permitted") || strings.Contains(err.Error(), "inappropriate ioctl") {
		t.Skipf("PTY not supported in this environment: %v", err)
	}
}
