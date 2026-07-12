package processmgr

import (
	"context"
	"path/filepath"
	"strings"
	"sync"
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

func TestSubscribeCompleteFiresOnProcessExit(t *testing.T) {
	m := New()
	var mu sync.Mutex
	var completed []Session
	detach := m.SubscribeComplete(func(sess Session) {
		mu.Lock()
		completed = append(completed, sess)
		mu.Unlock()
	})
	defer detach()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "exit 0"}})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, sess.ID, StatusExited)
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		got := append([]Session(nil), completed...)
		mu.Unlock()
		if len(got) == 1 && got[0].ID == sess.ID && got[0].Status == StatusExited && got[0].ExitCode != nil && *got[0].ExitCode == 0 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	mu.Lock()
	defer mu.Unlock()
	t.Fatalf("expected completion callback for %s, got %+v", sess.ID, completed)
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

func TestRestartReusesStartOptionsAndRedactsEnvSummary(t *testing.T) {
	m := New()
	dir := t.TempDir()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "printf \"$VISIBLE:$API_KEY\\n\""}, Cwd: dir, Env: []string{"VISIBLE=ok", "API_KEY=super-secret"}})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, sess.ID, StatusExited)
	status, ok := m.Status(sess.ID)
	if !ok || strings.Join(status.EnvSummary, ",") != "VISIBLE=ok,API_KEY=[redacted]" {
		t.Fatalf("expected redacted env summary, ok=%v status=%+v", ok, status)
	}
	output, ok := m.Output(sess.ID, 10)
	if !ok || !strings.Contains(joinOutput(output), "ok:super-secret") {
		t.Fatalf("expected real process env to be passed to child, output=%+v", output)
	}
	restarted, err := m.Restart(context.Background(), sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if restarted.ID == sess.ID || restarted.Cwd != dir || strings.Join(restarted.EnvSummary, ",") != "VISIBLE=ok,API_KEY=[redacted]" {
		t.Fatalf("restart did not preserve sanitized start options: old=%+v new=%+v", sess, restarted)
	}
	waitForStatus(t, m, restarted.ID, StatusExited)
}

func TestCleanupFinishedRemovesOnlyOldCompletedSessions(t *testing.T) {
	m := New()
	done, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "true"}})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, done.ID, StatusExited)
	running, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "while true; do sleep 1; done"}})
	if err != nil {
		t.Fatal(err)
	}
	removed := m.CleanupFinished(0)
	if removed != 1 {
		t.Fatalf("expected one completed session removed, got %d list=%+v", removed, m.List())
	}
	if _, ok := m.Status(done.ID); ok {
		t.Fatalf("expected completed session %s to be removed", done.ID)
	}
	if status, ok := m.Status(running.ID); !ok || status.Status != StatusRunning {
		t.Fatalf("expected running session to remain, ok=%v status=%+v", ok, status)
	}
	if err := m.Stop(running.ID); err != nil {
		t.Fatal(err)
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
