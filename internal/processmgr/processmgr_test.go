package processmgr

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestStartCapturesOutputAndStatus(t *testing.T) {
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "printf 'hello\\n'; printf 'err\\n' >&2"}})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, sess.ID, StatusExited)
	status, ok := m.Status(sess.ID)
	if !ok || status.PID == 0 || status.ExitCode == nil || *status.ExitCode != 0 {
		t.Fatalf("unexpected status: ok=%v status=%+v", ok, status)
	}
	output, ok := m.Output(sess.ID, 10)
	if !ok {
		t.Fatal("expected output")
	}
	joined := joinOutput(output)
	if !strings.Contains(joined, "stdout:hello") || !strings.Contains(joined, "stderr:err") {
		t.Fatalf("unexpected output: %+v", output)
	}
}

func TestStartValidatesCwd(t *testing.T) {
	m := New()
	_, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "true"}, Cwd: filepath.Join(t.TempDir(), "missing")})
	if err == nil || !strings.Contains(err.Error(), "cwd") {
		t.Fatalf("expected cwd validation error, got %v", err)
	}
}

func TestListAndTail(t *testing.T) {
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "printf 'a\\nb\\nc\\n'"}, MaxTail: 2})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, sess.ID, StatusExited)
	if len(m.List()) != 1 {
		t.Fatalf("expected one session, got %+v", m.List())
	}
	output, ok := m.Output(sess.ID, 10)
	if !ok || len(output) != 2 || output[0].Text != "b" || output[1].Text != "c" {
		t.Fatalf("expected retained tail b/c, ok=%v output=%+v", ok, output)
	}
}

func TestStopTerminatesProcessGroup(t *testing.T) {
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "while true; do sleep 1; done"}})
	if err != nil {
		t.Fatal(err)
	}
	if err := m.Stop(sess.ID); err != nil {
		t.Fatal(err)
	}
	status, ok := m.Status(sess.ID)
	if !ok || status.Status != StatusStopped {
		t.Fatalf("expected stopped status, ok=%v status=%+v", ok, status)
	}
}

func waitForStatus(t *testing.T, m *Manager, id string, status Status) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		s, ok := m.Status(id)
		if ok && s.Status == status {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	s, _ := m.Status(id)
	t.Fatalf("timed out waiting for %s, got %+v", status, s)
}

func joinOutput(lines []OutputLine) string {
	var b strings.Builder
	for _, line := range lines {
		b.WriteString(line.Stream)
		b.WriteString(":")
		b.WriteString(line.Text)
		b.WriteString("\n")
	}
	return b.String()
}
