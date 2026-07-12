package background

import (
	"context"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/aquama/natalia-cli/internal/processmgr"
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
