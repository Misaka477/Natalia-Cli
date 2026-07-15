package interactivemgr

import (
	"context"
	"fmt"
	"io"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/secret"
)

func TestInteractiveShellWriteReadAndStop(t *testing.T) {
	t.Parallel()
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}, MaxTail: 4096})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	defer m.Stop(sess.ID)
	if _, err := m.Observe(sess.ID, ObserveOptions{IdleTimeout: 50 * time.Millisecond, MaxWait: time.Second, IncludeOutput: true}); err != nil {
		t.Fatal(err)
	}

	obs, err := m.Write(sess.ID, "printf ready\\n\n", false, ObserveOptions{WaitFor: "ready", IdleTimeout: 50 * time.Millisecond, MaxWait: time.Second, IncludeOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(obs.Tail, "ready") || obs.Status != StatusWaitingForInput {
		t.Fatalf("unexpected observation: %+v", obs)
	}
	if strings.Count(obs.NewOutput, "printf ready") > 1 {
		t.Fatalf("expected command echo at most once, got %q", obs.NewOutput)
	}
	page, err := m.Transcript(sess.ID, 0, 4096)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(page.Text, "ready") || page.Total == 0 {
		t.Fatalf("expected direct-submit output in transcript, got %+v", page)
	}

	if err := m.Stop(sess.ID); err != nil {
		t.Fatal(err)
	}
	status, ok := m.Status(sess.ID)
	if !ok || status.Status != StatusStopped {
		t.Fatalf("expected stopped status, ok=%v status=%+v", ok, status)
	}
}

func TestInteractiveWaitForOnlyMatchesUnreadOutput(t *testing.T) {
	t.Parallel()
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}, MaxTail: 4096})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	defer m.Stop(sess.ID)

	first, err := m.Write(sess.ID, "printf first_marker\\n\n", false, ObserveOptions{WaitFor: "first_marker", IdleTimeout: 50 * time.Millisecond, MaxWait: time.Second, IncludeOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(first.NewOutput, "first_marker") {
		t.Fatalf("expected first output, got %+v", first)
	}
	second, err := m.Write(sess.ID, "printf second_marker\\n\n", false, ObserveOptions{WaitFor: "first_marker", IdleTimeout: 80 * time.Millisecond, MaxWait: 300 * time.Millisecond, IncludeOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if second.DetectedPrompt == "first_marker" {
		t.Fatalf("wait_for detected historical output, got %+v", second)
	}
	if !strings.Contains(second.NewOutput, "second_marker") {
		t.Fatalf("expected second output, got %+v", second)
	}
}

func TestInteractiveDefaultObservationDoesNotTruncateTail(t *testing.T) {
	t.Parallel()
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	defer m.Stop(sess.ID)
	long := strings.Repeat("x", 9000)
	obs, err := m.Write(sess.ID, "printf '"+long+"'\n", false, ObserveOptions{WaitFor: strings.Repeat("x", 80), IdleTimeout: 50 * time.Millisecond, MaxWait: time.Second, IncludeOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if obs.Truncated || !strings.Contains(obs.Tail, long) || !strings.Contains(obs.NewOutput, long) {
		t.Fatalf("expected default observation to keep full output, truncated=%t tail_len=%d new_len=%d", obs.Truncated, len(obs.Tail), len(obs.NewOutput))
	}
}

func TestInteractiveSensitiveWriteRedactsFutureReads(t *testing.T) {
	t.Parallel()
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}, MaxTail: 4096})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	defer m.Stop(sess.ID)

	if _, err := m.Write(sess.ID, "secret-value\n", true, ObserveOptions{IdleTimeout: 80 * time.Millisecond, MaxWait: time.Second, IncludeOutput: true}); err != nil {
		t.Fatal(err)
	}
	obs, err := m.Observe(sess.ID, ObserveOptions{IdleTimeout: 50 * time.Millisecond, MaxWait: 300 * time.Millisecond, IncludeOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(obs.Tail, "secret-value") || strings.Contains(obs.NewOutput, "secret-value") {
		t.Fatalf("secret leaked after sensitive write: %+v", obs)
	}
	if !strings.Contains(obs.Tail, "secret redacted") {
		t.Fatalf("expected redaction marker, got %+v", obs)
	}
	page, err := m.Transcript(sess.ID, 0, 4096)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(page.Text, "secret-value") || !strings.Contains(page.Text, "secret redacted") {
		t.Fatalf("expected redacted transcript, got %+v", page)
	}
}

func TestInteractiveStartStripsInheritedSensitiveEnv(t *testing.T) {
	t.Setenv("NATALIA_TEST_API_KEY", "host-secret")
	secret.SetEnvAllowlist(nil)
	t.Cleanup(func() { secret.SetEnvAllowlist(nil) })
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}, MaxTail: 4096})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	defer m.Stop(sess.ID)
	obs, err := m.Write(sess.ID, "printf ${NATALIA_TEST_API_KEY:-missing}\\n\n", false, ObserveOptions{WaitFor: "missing", IdleTimeout: 50 * time.Millisecond, MaxWait: time.Second, IncludeOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(obs.Tail, "host-secret") || !strings.Contains(obs.Tail, "missing") {
		t.Fatalf("expected inherited sensitive env to be stripped, got %+v", obs)
	}
}

func TestInteractiveOutputRedactsSensitivePatterns(t *testing.T) {
	t.Parallel()
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}, MaxTail: 4096})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	defer m.Stop(sess.ID)
	obs, err := m.Write(sess.ID, "printf 'token=pty-secret safe=ok'\\n\n", false, ObserveOptions{WaitFor: "safe=ok", IdleTimeout: 50 * time.Millisecond, MaxWait: time.Second, IncludeOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(obs.Tail, "pty-secret") || !strings.Contains(obs.Tail, "token=[redacted]") || !strings.Contains(obs.Tail, "safe=ok") {
		t.Fatalf("expected redacted interactive output, got %+v", obs)
	}
}

func TestInteractiveEventsAttachDetachResizeAndTranscript(t *testing.T) {
	t.Parallel()
	m := New()
	events := make(chan Event, 8)
	detachSub := m.Subscribe(func(event Event) {
		events <- event
	})
	defer detachSub()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}, Rows: 24, Cols: 80})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	defer m.Stop(sess.ID)
	detached, err := m.Detach(sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if detached.Attached || detached.Status != StatusWaitingForInput || detached.DetachedAt.IsZero() {
		t.Fatalf("expected detached session to wait for input, got %+v", detached)
	}
	attached, err := m.Attach(sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !attached.Attached {
		t.Fatalf("expected attached session, got %+v", attached)
	}
	resized, err := m.Resize(sess.ID, 30, 100)
	if err != nil {
		t.Fatal(err)
	}
	if resized.Rows != 30 || resized.Cols != 100 {
		t.Fatalf("expected resized session, got %+v", resized)
	}
	if _, err := m.Write(sess.ID, "printf event_ready\\n\n", false, ObserveOptions{WaitFor: "event_ready", IdleTimeout: 50 * time.Millisecond, MaxWait: time.Second, IncludeOutput: true}); err != nil {
		t.Fatal(err)
	}
	page, err := m.Transcript(sess.ID, 0, 4096)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(page.Text, "event_ready") || page.Total == 0 {
		t.Fatalf("expected transcript page with command output, got %+v", page)
	}
	seenStarted, seenDetached, seenAttached, seenResized, seenOutput := false, false, false, false, false
	deadline := time.After(time.Second)
	for !(seenStarted && seenDetached && seenAttached && seenResized && seenOutput) {
		select {
		case event := <-events:
			switch {
			case event.Type == EventStarted && event.Session.ID == sess.ID:
				seenStarted = true
			case event.Type == EventDetached && event.Session.ID == sess.ID:
				seenDetached = true
			case event.Type == EventAttached && event.Session.ID == sess.ID:
				seenAttached = true
			case event.Type == EventResized && event.Session.ID == sess.ID:
				seenResized = true
			case event.Type == EventOutput && event.Session.ID == sess.ID && strings.Contains(event.Output, "event_ready"):
				seenOutput = true
			}
		case <-deadline:
			t.Fatalf("expected lifecycle/output events, got started=%t detached=%t attached=%t resized=%t output=%t", seenStarted, seenDetached, seenAttached, seenResized, seenOutput)
		}
	}
}

func TestInteractiveCleanupRemovesStoppedSessions(t *testing.T) {
	t.Parallel()
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	if err := m.Stop(sess.ID); err != nil {
		t.Fatal(err)
	}
	if removed := m.CleanupFinished(0); removed != 1 {
		t.Fatalf("expected one stopped session removed, got %d", removed)
	}
	if _, ok := m.Status(sess.ID); ok {
		t.Fatal("expected cleaned session to be unavailable")
	}
}

func TestInteractiveEnterKeyAndStop(t *testing.T) {
	t.Parallel()
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	obs, err := m.SendKey(sess.ID, "enter", ObserveOptions{IdleTimeout: 50 * time.Millisecond, MaxWait: time.Second, IncludeOutput: true})
	if err != nil {
		t.Fatal(err)
	}
	if obs.Status != StatusWaitingForInput && obs.Status != StatusRunning {
		t.Fatalf("expected running shell after enter, got %+v", obs)
	}
	if err := m.Stop(sess.ID); err != nil {
		t.Fatal(err)
	}
	status, ok := m.Status(sess.ID)
	if !ok || status.Status != StatusStopped {
		t.Fatalf("expected stopped status, ok=%v status=%+v", ok, status)
	}
}

func TestInteractiveRejectsInvalidKey(t *testing.T) {
	t.Parallel()
	cases := map[string]string{"enter": "\r", "ctrl-c": "\x03", "ctrl_d": "\x04", "tab": "\t", "esc": "\x1b"}
	for key, want := range cases {
		got, err := keySequence(key)
		if err != nil || got != want {
			t.Fatalf("keySequence(%q)=%q err=%v want %q", key, got, err, want)
		}
	}
	if _, err := keySequence("bad"); err == nil {
		t.Fatal("expected invalid key error")
	}
}

func TestCleanTerminalStripsANSI(t *testing.T) {
	t.Parallel()
	cases := map[string]string{
		"\x1b[31mred\x1b[0m\r\n": "red",
		"plain":                  "plain",
		"a\r\nb\r":               "a\nb",
		"abc\b \bD":              "abD",
		"abcdef\rxyz":            "xyz",
		"long_line\rshort\n":     "short",
		"abc\x1b[2Kdef\r\n":      "def",
		"abcdef\x1b[1Kghi":       "ghi",
		"abc\x1b[Gdef":           "def",
		"before\x1b[2Jafter":     "after",
		">>> abc\r>>> ":          ">>> ",
		// Tab completion candidate suppression: 2+ short lines between prompt redraws
		"randrange\r\nrandom\r\nrandint\r\n>>> import random\n":                             ">>> import random",
		">>> x\r\x1b[K>>> x = \r\x1b[K>>> x = [i*i for i in range(3)]\r\n[0, 1, 4]\r\n>>> ": ">>> x = [i*i for i in range(3)]\n[0, 1, 4]\n>>> ",
		"\x1b[1;32mok\x1b[0m":            "ok",
		"\x1b]633;A\a(base) user@host$ ": "(base) user@host$ ",
		"\x1b]633;P;start=abc;machineid=mid;user=aquama;hostname=host\a(base) $ ": "(base) $ ",
		"\x1b]0;title\x1b\\prompt$ ": "prompt$ ",
	}
	for input, want := range cases {
		if got := cleanTerminal(input); got != want {
			t.Fatalf("cleanTerminal(%q)=%q want %q", input, got, want)
		}
	}
}

func TestPTYClosedErrorsAreNormalEOF(t *testing.T) {
	t.Parallel()
	if !isPTYClosedError(io.EOF) {
		t.Fatal("io.EOF should be treated as closed PTY")
	}
	if !isPTYClosedError(fmt.Errorf("read /dev/ptmx: input/output error")) {
		t.Fatal("Linux PTY EIO should be treated as closed PTY")
	}
	if isPTYClosedError(fmt.Errorf("permission denied")) {
		t.Fatal("unrelated errors should not be treated as closed PTY")
	}
}

func TestDetectPromptCoversShellAndCustomWaitPatterns(t *testing.T) {
	t.Parallel()
	waitRe := regexp.MustCompile(`READY>`)
	cases := []struct {
		name string
		tail string
		re   *regexp.Regexp
		want string
	}{
		{name: "wait regex", tail: "noise\nREADY>", re: waitRe, want: "READY>"},
		{name: "shell dollar", tail: "output\nuser@host$", want: "user@host$"},
		{name: "prompt before trailing blank line", tail: "output\nbash-5.3$ \n\n", want: "bash-5.3$"},
		{name: "root hash", tail: "root#", want: "root#"},
		{name: "question", tail: "Continue?", want: "Continue?"},
		{name: "password", tail: "Password:", want: "Password:"},
		{name: "chinese password", tail: "输出\n请输入密码：", want: "请输入密码："},
		{name: "mixed password", tail: "Enter password: 请输入密码:", want: "Enter password: 请输入密码:"},
		{name: "select", tail: "Select project:", want: "Select project:"},
		{name: "chinese select", tail: "请选择项目：", want: "请选择项目："},
		{name: "chinese confirm", tail: "确认继续？[Y/n]", want: "确认继续？[Y/n]"},
		{name: "yes no", tail: "Overwrite file? [y/N]", want: "Overwrite file? [y/N]"},
		{name: "none", tail: "just output\nnext line", want: ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := detectPrompt(tc.tail, tc.re); got != tc.want {
				t.Fatalf("detectPrompt(%q)=%q want %q", tc.tail, got, tc.want)
			}
		})
	}
}

func TestMakeObservationDetectPromptFallbackAndLiteralWaitFor(t *testing.T) {
	t.Parallel()
	buf := []byte("history\n确认继续？[Y/n]")
	sess := &managedSession{meta: Session{ID: "tty_test", Status: StatusWaitingForInput}, buf: buf, lastRead: len(buf)}
	obs := sess.makeObservation(buf, ObserveOptions{IncludeOutput: true}, nil)
	if obs.NewOutput != "" || obs.DetectedPrompt != "确认继续？[Y/n]" {
		t.Fatalf("expected prompt fallback from tail when new output is empty, got %+v", obs)
	}

	waitLiteral := "选择项目 (1/2):"
	waitRe := regexp.MustCompile(regexp.QuoteMeta(waitLiteral))
	buf = []byte("noise\n" + waitLiteral)
	sess = &managedSession{meta: Session{ID: "tty_test", Status: StatusWaitingForInput}, buf: buf, lastRead: 0}
	obs = sess.makeObservation(buf, ObserveOptions{IncludeOutput: true}, waitRe)
	if obs.DetectedPrompt != waitLiteral {
		t.Fatalf("expected literal wait_for with regex-special characters to match exactly, got %+v", obs)
	}
}

func hasInteractiveEvent(events []Event, typ EventType, id string) bool {
	for _, event := range events {
		if event.Type == typ && event.Session.ID == id {
			return true
		}
	}
	return false
}

func hasInteractiveOutput(events []Event, id, text string) bool {
	for _, event := range events {
		if event.Type == EventOutput && event.Session.ID == id && strings.Contains(event.Output, text) {
			return true
		}
	}
	return false
}

func skipIfPTYUnsupported(t *testing.T, err error) {
	t.Helper()
	if strings.Contains(err.Error(), "operation not permitted") || strings.Contains(err.Error(), "inappropriate ioctl") {
		t.Skipf("PTY not supported in this environment: %v", err)
	}
}

func TestInteractiveTranscriptEventsCaptureInputAndOutput(t *testing.T) {
	t.Parallel()
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}, MaxTail: 4096})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	defer m.Stop(sess.ID)

	if _, err := m.Write(sess.ID, "printf 'hello\\n'\n", false, ObserveOptions{WaitFor: "hello", IdleTimeout: 50 * time.Millisecond, MaxWait: time.Second, IncludeOutput: true}); err != nil {
		t.Fatal(err)
	}

	events, err := m.Events(sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) == 0 {
		t.Fatal("expected at least one transcript event")
	}
	hasInput := false
	hasOutput := false
	for _, evt := range events {
		switch evt.Type {
		case TranscriptEventInput:
			hasInput = true
			if !strings.Contains(string(evt.Data), "printf") {
				t.Fatalf("expected input event to contain command, got %q", string(evt.Data))
			}
		case TranscriptEventOutput:
			hasOutput = true
		}
	}
	if !hasInput {
		t.Fatal("expected at least one input event")
	}
	if !hasOutput {
		t.Fatal("expected at least one output event")
	}
}

func TestInteractiveTranscriptEventsOrder(t *testing.T) {
	t.Parallel()
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}, MaxTail: 4096})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	defer m.Stop(sess.ID)

	if _, err := m.Write(sess.ID, "echo test\n", false, ObserveOptions{WaitFor: "test", IdleTimeout: 50 * time.Millisecond, MaxWait: time.Second, IncludeOutput: true}); err != nil {
		t.Fatal(err)
	}

	events, err := m.Events(sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) < 2 {
		t.Fatalf("expected at least 2 events, got %d", len(events))
	}
	hasInput := false
	hasOutput := false
	lastTime := time.Time{}
	for _, evt := range events {
		if evt.Type == TranscriptEventInput {
			hasInput = true
		}
		if evt.Type == TranscriptEventOutput {
			hasOutput = true
		}
		if evt.Time.Before(lastTime) {
			t.Fatalf("expected events to be in chronological order, got %v before %v", lastTime, evt.Time)
		}
		lastTime = evt.Time
	}
	if !hasInput {
		t.Fatal("expected at least one input event")
	}
	if !hasOutput {
		t.Fatal("expected at least one output event")
	}
}
