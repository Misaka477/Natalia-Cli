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
