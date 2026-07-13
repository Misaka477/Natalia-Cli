package interactivemgr

import (
	"context"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/secret"
)

func TestInteractiveShellWriteReadAndStop(t *testing.T) {
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

	if err := m.Stop(sess.ID); err != nil {
		t.Fatal(err)
	}
	status, ok := m.Status(sess.ID)
	if !ok || status.Status != StatusStopped {
		t.Fatalf("expected stopped status, ok=%v status=%+v", ok, status)
	}
}

func TestInteractiveWaitForOnlyMatchesUnreadOutput(t *testing.T) {
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

func TestInteractiveSensitiveWriteRedactsFutureReads(t *testing.T) {
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
	m := New()
	var mu sync.Mutex
	var events []Event
	detachSub := m.Subscribe(func(event Event) {
		mu.Lock()
		events = append(events, event)
		mu.Unlock()
	})
	defer detachSub()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-i"}, Rows: 24, Cols: 80})
	if err != nil {
		skipIfPTYUnsupported(t, err)
		t.Fatal(err)
	}
	defer m.Stop(sess.ID)
	if _, err := m.Detach(sess.ID); err != nil {
		t.Fatal(err)
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
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		got := append([]Event(nil), events...)
		mu.Unlock()
		if hasInteractiveEvent(got, EventStarted, sess.ID) && hasInteractiveEvent(got, EventDetached, sess.ID) && hasInteractiveEvent(got, EventAttached, sess.ID) && hasInteractiveEvent(got, EventResized, sess.ID) && hasInteractiveOutput(got, sess.ID, "event_ready") {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	mu.Lock()
	defer mu.Unlock()
	t.Fatalf("expected lifecycle/output events, got %+v", events)
}

func TestInteractiveEnterKeyAndStop(t *testing.T) {
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
	cases := map[string]string{
		"\x1b[31mred\x1b[0m\r\n": "red",
		"plain":                  "plain",
		"a\r\nb\r":               "a\nb",
		"\x1b[1;32mok\x1b[0m":    "ok",
	}
	for input, want := range cases {
		if got := cleanTerminal(input); got != want {
			t.Fatalf("cleanTerminal(%q)=%q want %q", input, got, want)
		}
	}
}

func TestDetectPromptCoversShellAndCustomWaitPatterns(t *testing.T) {
	waitRe := regexp.MustCompile(`READY>`)
	cases := []struct {
		name string
		tail string
		re   *regexp.Regexp
		want string
	}{
		{name: "wait regex", tail: "noise\nREADY>", re: waitRe, want: "READY>"},
		{name: "shell dollar", tail: "output\nuser@host$", want: "user@host$"},
		{name: "root hash", tail: "root#", want: "root#"},
		{name: "question", tail: "Continue?", want: "Continue?"},
		{name: "password", tail: "Password:", want: "Password:"},
		{name: "select", tail: "Select project:", want: "Select project:"},
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
