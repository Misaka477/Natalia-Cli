package process

import (
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

func TestProcessStartStatusOutputList(t *testing.T) {
	resetManager()
	start := &Start{}
	result, err := start.Execute(map[string]any{"command": "/bin/sh", "args": []any{"-c", "printf 'hello\\n'"}})
	if err != nil {
		t.Fatal(err)
	}
	id := extractProcessID(t, result)
	waitForProcessStatus(t, id, "exited")

	status, err := (&Status{}).Execute(map[string]any{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(status, "status: exited") || !strings.Contains(status, "exit_code: 0") {
		t.Fatalf("unexpected status: %q", status)
	}
	output, err := (&Output{}).Execute(map[string]any{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(output, "stdout: hello") {
		t.Fatalf("unexpected output: %q", output)
	}
	list, err := (&List{}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(list, id) {
		t.Fatalf("expected list to contain id %s, got %q", id, list)
	}
}

func TestProcessStartWithCWDAndOutputTail(t *testing.T) {
	resetManager()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "marker.txt"), []byte("ok"), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": []any{"-c", "pwd; ls marker.txt; printf 'line1\\nline2\\nline3\\n'"}, "cwd": dir})
	if err != nil {
		t.Fatal(err)
	}
	id := extractProcessID(t, result)
	waitForProcessStatus(t, id, "exited")
	output, err := (&Output{}).Execute(map[string]any{"id": id, "tail": float64(2)})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(output, "line1") || !strings.Contains(output, "line2") || !strings.Contains(output, "line3") {
		t.Fatalf("expected process output tail, got %q", output)
	}
}

func TestProcessStop(t *testing.T) {
	resetManager()
	result, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": []any{"-c", "while true; do sleep 1; done"}})
	if err != nil {
		t.Fatal(err)
	}
	id := extractProcessID(t, result)
	stopped, err := (&Stop{}).Execute(map[string]any{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stopped, "status: stopped") {
		t.Fatalf("expected stopped output, got %q", stopped)
	}
}

func TestProcessRestartReusesEnvAndRedactsStatus(t *testing.T) {
	resetManager()
	result, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": []any{"-c", "printf \"$VISIBLE:$API_KEY\\n\""}, "env": map[string]any{"VISIBLE": "ok", "API_KEY": "super-secret"}})
	if err != nil {
		t.Fatal(err)
	}
	id := extractProcessID(t, result)
	waitForProcessStatus(t, id, "exited")
	status, err := (&Status{}).Execute(map[string]any{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(status, "VISIBLE=ok") || !strings.Contains(status, "API_KEY=[redacted]") || strings.Contains(status, "super-secret") {
		t.Fatalf("expected redacted env status, got %q", status)
	}
	restarted, err := (&Restart{}).Execute(map[string]any{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	newID := extractProcessID(t, restarted)
	if newID == id || !strings.Contains(restarted, "已重启进程") || !strings.Contains(restarted, "API_KEY=[redacted]") {
		t.Fatalf("unexpected restart output: %q", restarted)
	}
	waitForProcessStatus(t, newID, "exited")
	output, err := (&Output{}).Execute(map[string]any{"id": newID})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(output, "ok:") || strings.Contains(output, "super-secret") {
		t.Fatalf("expected restarted process to strip sensitive env, got %q", output)
	}
}

func TestProcessAttachDetachCleanupAndAudit(t *testing.T) {
	resetManager()
	result, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": []any{"-c", "while true; do sleep 1; done"}, "env": map[string]any{"TOKEN": "super-secret"}, "idle_timeout": float64(1)})
	if err != nil {
		t.Fatal(err)
	}
	id := extractProcessID(t, result)
	detached, err := (&Detach{}).Execute(map[string]any{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(detached, "attached: false") {
		t.Fatalf("expected detached output, got %q", detached)
	}
	attached, err := (&Attach{}).Execute(map[string]any{"id": id})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(attached, "attached: true") || !strings.Contains(attached, "idle_timeout: 1s") {
		t.Fatalf("expected attached output with lifetime metadata, got %q", attached)
	}
	time.Sleep(1100 * time.Millisecond)
	cleanup, err := (&Cleanup{}).Execute(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(cleanup, "stopped: 1") {
		t.Fatalf("expected cleanup to stop idle process, got %q", cleanup)
	}
	audit, err := (&Audit{}).Execute(map[string]any{"tail": float64(10)})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(audit, "detach") || !strings.Contains(audit, "attach") || !strings.Contains(audit, "TOKEN=[redacted]") || strings.Contains(audit, "super-secret") {
		t.Fatalf("expected redacted attach/detach audit, got %q", audit)
	}
}

func TestProcessStartRejectsInvalidArgs(t *testing.T) {
	resetManager()
	_, err := (&Start{}).Execute(map[string]any{"command": "/bin/sh", "args": "bad"})
	if err == nil || !strings.Contains(err.Error(), "args") {
		t.Fatalf("expected args validation error, got %v", err)
	}
}

func TestProcessEmptyUnknownAndFormattingPaths(t *testing.T) {
	resetManager()
	listed, err := (&List{}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if listed != "<no managed processes>" {
		t.Fatalf("expected empty process list, got %q", listed)
	}
	for _, tool := range []struct {
		name string
		run  func() (string, error)
	}{
		{name: "status", run: func() (string, error) { return (&Status{}).Execute(map[string]any{"id": "missing"}) }},
		{name: "output", run: func() (string, error) { return (&Output{}).Execute(map[string]any{"id": "missing"}) }},
		{name: "stop", run: func() (string, error) { return (&Stop{}).Execute(map[string]any{"id": "missing"}) }},
		{name: "restart", run: func() (string, error) { return (&Restart{}).Execute(map[string]any{"id": "missing"}) }},
		{name: "attach", run: func() (string, error) { return (&Attach{}).Execute(map[string]any{"id": "missing"}) }},
		{name: "detach", run: func() (string, error) { return (&Detach{}).Execute(map[string]any{"id": "missing"}) }},
	} {
		_, err := tool.run()
		if err == nil || !strings.Contains(err.Error(), "unknown process session") {
			t.Fatalf("expected unknown session error for %s, got %v", tool.name, err)
		}
	}
	if got := formatSession(nil); got != "<nil process session>" {
		t.Fatalf("unexpected nil process session formatting: %q", got)
	}
}

func TestProcessParseKindAndIntArg(t *testing.T) {
	cases := map[string]processmgr.Kind{"background": processmgr.KindBackground, "interactive": processmgr.KindInteractive, "mcp": processmgr.KindMCP, "process": processmgr.KindProcess, "bad": processmgr.KindProcess, "": processmgr.KindProcess}
	for raw, want := range cases {
		if got := parseKind(map[string]any{"kind": raw}); got != want {
			t.Fatalf("parseKind(%q)=%q want %q", raw, got, want)
		}
	}
	if intArg(float64(3)) != 3 || intArg(4) != 4 || intArg("bad") != 0 {
		t.Fatal("unexpected process intArg behavior")
	}
	if _, err := parseEnv("bad"); err == nil || !strings.Contains(err.Error(), "env") {
		t.Fatalf("expected invalid env error, got %v", err)
	}
	if _, err := durationSecondsArg("bad", 0, 0, 10); err == nil || !strings.Contains(err.Error(), "duration") {
		t.Fatalf("expected invalid duration error, got %v", err)
	}
	if !boolArg("yes") || boolArg("no") {
		t.Fatal("unexpected boolArg behavior")
	}
}

func extractProcessID(t *testing.T, output string) string {
	t.Helper()
	re := regexp.MustCompile(`id: (proc_\d+)`)
	m := re.FindStringSubmatch(output)
	if len(m) != 2 {
		t.Fatalf("could not extract process id from %q", output)
	}
	return m[1]
}

func waitForProcessStatus(t *testing.T, id, want string) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		status, err := (&Status{}).Execute(map[string]any{"id": id})
		if err == nil && strings.Contains(status, "status: "+want) {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	status, _ := (&Status{}).Execute(map[string]any{"id": id})
	t.Fatalf("timed out waiting for status %s, got %q", want, status)
}
