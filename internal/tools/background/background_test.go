package background

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/processmgr"
)

func resetManager() {
	processmgr.ResetDefaultManagerForTest()
}

func TestBackgroundStartOutputList(t *testing.T) {
	resetManager()
	result, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": []any{"-c", "printf 'ready\\n'"}})
	if err != nil {
		t.Fatal(err)
	}
	id := extractBackgroundID(t, result)
	waitForBackgroundStatus(t, id, "exited")

	output, err := (&Output{}).Execute(map[string]any{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(output, "stdout: ready") {
		t.Fatalf("unexpected output: %q", output)
	}
	list, err := (&List{}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(list, id) || !strings.Contains(list, "kind: background") {
		t.Fatalf("unexpected list: %q", list)
	}
}

func TestBackgroundOutputWithTailAndCWD(t *testing.T) {
	resetManager()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "marker.txt"), []byte("ok"), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": []any{"-c", "pwd; ls marker.txt; printf 'line1\\nline2\\nline3\\n'"}, "cwd": dir})
	if err != nil {
		t.Fatal(err)
	}
	id := extractBackgroundID(t, result)
	waitForBackgroundStatus(t, id, "exited")

	output, err := (&Output{}).Execute(map[string]any{"id": id, "tail": float64(2)})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(output, "line1") || !strings.Contains(output, "line2") || !strings.Contains(output, "line3") {
		t.Fatalf("expected tail output to keep last two lines, got %q", output)
	}
	paged, err := (&Output{}).Execute(map[string]any{"id": id, "offset": float64(3), "limit": float64(2)})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(paged, "line1") || !strings.Contains(paged, "line2") || !strings.Contains(paged, "line3") || !strings.Contains(paged, "next_offset=5") {
		t.Fatalf("expected paged background output, got %q", paged)
	}
}

func TestBackgroundStop(t *testing.T) {
	resetManager()
	result, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": []any{"-c", "while true; do sleep 1; done"}})
	if err != nil {
		t.Fatal(err)
	}
	id := extractBackgroundID(t, result)
	stopped, err := (&Stop{}).Execute(map[string]any{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stopped, "status: stopped") {
		t.Fatalf("expected stopped output, got %q", stopped)
	}
}

func TestBackgroundRestartCleanupAuditAndRedaction(t *testing.T) {
	resetManager()
	result, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": []any{"-c", "printf \"$VISIBLE:$API_KEY\\n\""}, "env": map[string]any{"VISIBLE": "ok", "API_KEY": "super-secret"}, "idle_timeout": float64(1)})
	if err != nil {
		t.Fatal(err)
	}
	id := extractBackgroundID(t, result)
	waitForBackgroundStatus(t, id, "exited")
	if !strings.Contains(result, "API_KEY=[redacted]") || strings.Contains(result, "super-secret") {
		t.Fatalf("expected redacted background start output, got %q", result)
	}
	restarted, err := (&Restart{}).Execute(map[string]any{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	newID := extractBackgroundID(t, restarted)
	if newID == id || !strings.Contains(restarted, "background task restarted") || !strings.Contains(restarted, "idle_timeout: 1s") {
		t.Fatalf("unexpected restart output: %q", restarted)
	}
	waitForBackgroundStatus(t, newID, "exited")
	output, err := (&Output{}).Execute(map[string]any{"id": newID})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(output, "ok:super-secret") {
		t.Fatalf("expected restarted background to receive env, got %q", output)
	}
	cleanup, err := (&Cleanup{}).Execute(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(cleanup, "removed:") {
		t.Fatalf("expected cleanup output, got %q", cleanup)
	}
	audit, err := (&Audit{}).Execute(map[string]any{"tail": float64(20)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(audit, "start") || !strings.Contains(audit, "restart") || !strings.Contains(audit, "API_KEY=[redacted]") || strings.Contains(audit, "super-secret") {
		t.Fatalf("expected redacted background audit, got %q", audit)
	}
}

func TestBackgroundCleanupStopsIdleTaskAndDangerousCommandBlocked(t *testing.T) {
	resetManager()
	result, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": []any{"-c", "while true; do sleep 1; done"}, "idle_timeout": float64(1)})
	if err != nil {
		t.Fatal(err)
	}
	id := extractBackgroundID(t, result)
	time.Sleep(1100 * time.Millisecond)
	cleanup, err := (&Cleanup{}).Execute(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(cleanup, "stopped: 1") {
		t.Fatalf("expected idle cleanup stop, got %q", cleanup)
	}
	waitForBackgroundStatus(t, id, "stopped")
	_, err = (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": []any{"-c", "rm -rf /"}})
	if err == nil || !strings.Contains(err.Error(), "dangerous") {
		t.Fatalf("expected dangerous command rejection, got %v", err)
	}
}

func TestBackgroundRejectsNonBackgroundSession(t *testing.T) {
	resetManager()
	sess, err := processmgr.DefaultManager().Start(context.Background(), processmgr.StartOptions{Command: "/bin/sh", Args: []string{"-c", "true"}})
	if err != nil {
		t.Fatal(err)
	}
	_, err = (&Output{}).Execute(map[string]any{"id": sess.ID})
	if err == nil || !strings.Contains(err.Error(), "not background") {
		t.Fatalf("expected kind validation error, got %v", err)
	}
}

func TestBackgroundStartRejectsInvalidMaxTail(t *testing.T) {
	resetManager()
	_, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "max_tail": float64(0)})
	if err == nil || !strings.Contains(err.Error(), "between") {
		t.Fatalf("expected max_tail validation error, got %v", err)
	}
}

func TestBackgroundEmptyListUnknownAndFormattingPaths(t *testing.T) {
	resetManager()
	listed, err := (&List{}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if listed != "<no background tasks>" {
		t.Fatalf("expected empty background list, got %q", listed)
	}
	for _, tool := range []struct {
		name string
		run  func() (string, error)
	}{
		{name: "output", run: func() (string, error) { return (&Output{}).Execute(map[string]any{"id": "missing"}) }},
		{name: "stop", run: func() (string, error) { return (&Stop{}).Execute(map[string]any{"id": "missing"}) }},
		{name: "restart", run: func() (string, error) { return (&Restart{}).Execute(map[string]any{"id": "missing"}) }},
	} {
		_, err := tool.run()
		if err == nil || !strings.Contains(err.Error(), "unknown background task") {
			t.Fatalf("expected unknown background error for %s, got %v", tool.name, err)
		}
	}
	if got := formatSession(nil); got != "<nil background task>" {
		t.Fatalf("unexpected nil background session formatting: %q", got)
	}
}

func TestBackgroundRejectsInvalidArgsAndIntTypes(t *testing.T) {
	resetManager()
	if _, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": "bad"}); err == nil || !strings.Contains(err.Error(), "args") {
		t.Fatalf("expected args type error, got %v", err)
	}
	if _, err := (&Output{}).Execute(map[string]any{"id": "missing", "tail": "bad"}); err == nil || !strings.Contains(err.Error(), "unknown background task") {
		t.Fatalf("expected unknown id checked before tail validation, got %v", err)
	}
	if _, err := intArg("bad", 0, 0, 10); err == nil || !strings.Contains(err.Error(), "integer") {
		t.Fatalf("expected intArg type error, got %v", err)
	}
	if _, err := parseEnv("bad"); err == nil || !strings.Contains(err.Error(), "env") {
		t.Fatalf("expected parseEnv type error, got %v", err)
	}
	if _, err := durationSecondsArg("bad", 0, 0, 10); err == nil || !strings.Contains(err.Error(), "duration") {
		t.Fatalf("expected duration type error, got %v", err)
	}
	if !boolArg("true") || boolArg("false") {
		t.Fatal("unexpected boolArg behavior")
	}
}

func extractBackgroundID(t *testing.T, output string) string {
	t.Helper()
	re := regexp.MustCompile(`id: (proc_\d+)`)
	m := re.FindStringSubmatch(output)
	if len(m) != 2 {
		t.Fatalf("could not extract background id from %q", output)
	}
	return m[1]
}

func waitForBackgroundStatus(t *testing.T, id, want string) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		sess, ok := processmgr.DefaultManager().Status(id)
		if ok && string(sess.Status) == want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	sess, _ := processmgr.DefaultManager().Status(id)
	t.Fatalf("timed out waiting for status %s, got %+v", want, sess)
}
