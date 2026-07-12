package interactive

import (
	"regexp"
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/interactivemgr"
)

func resetManager() {
	interactivemgr.ResetDefaultManagerForTest()
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

	written, err := (&Write{}).Execute(map[string]any{"id": id, "input": "printf tool_ready\\n\n", "wait_for": "tool_ready", "idle_timeout_ms": float64(50), "max_wait_ms": float64(1000)})
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
	if got := formatObservation(nil); got != "<nil observation>" {
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
