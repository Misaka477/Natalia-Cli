package processmgr

import (
	"context"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/secret"
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

func TestSubscribePublishesLifecycleOutputAndAttachDetachEvents(t *testing.T) {
	m := New()
	var mu sync.Mutex
	var events []Event
	detach := m.Subscribe(func(event Event) {
		mu.Lock()
		events = append(events, event)
		mu.Unlock()
	})
	defer detach()

	running, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "while true; do sleep 1; done"}})
	if err != nil {
		t.Fatal(err)
	}
	detached, err := m.Detach(running.ID)
	if err != nil {
		t.Fatal(err)
	}
	if detached.Attached {
		t.Fatalf("expected detached session, got %+v", detached)
	}
	attached, err := m.Attach(running.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !attached.Attached {
		t.Fatalf("expected attached session, got %+v", attached)
	}
	if err := m.Stop(running.ID); err != nil {
		t.Fatal(err)
	}

	done, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "printf 'hello\\n'"}})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, done.ID, StatusExited)

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		got := append([]Event(nil), events...)
		mu.Unlock()
		if hasEvent(got, EventStarted, running.ID) && hasEvent(got, EventDetached, running.ID) && hasEvent(got, EventAttached, running.ID) && hasEvent(got, EventStopped, running.ID) && hasOutputEvent(got, done.ID, "hello") && hasEvent(got, EventExited, done.ID) {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	mu.Lock()
	defer mu.Unlock()
	t.Fatalf("expected lifecycle/output events, got %+v", events)
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
	page, ok := m.OutputPage(sess.ID, 0, 10)
	if !ok || page.Retained != 2 || page.Dropped != 1 || page.MaxTail != 2 || page.Status != StatusExited {
		t.Fatalf("expected output retention metadata, ok=%v page=%+v", ok, page)
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
	if !ok || !strings.Contains(joinOutput(output), "ok:") || strings.Contains(joinOutput(output), "super-secret") {
		t.Fatalf("expected sensitive process env to be stripped from child, output=%+v", output)
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

func TestStartStripsInheritedSensitiveEnvAndAllowlistCanPassThrough(t *testing.T) {
	t.Setenv("NATALIA_TEST_API_KEY", "host-secret")
	secret.SetEnvAllowlist(nil)
	t.Cleanup(func() { secret.SetEnvAllowlist(nil) })
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "printf ${NATALIA_TEST_API_KEY:-missing}"}})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, sess.ID, StatusExited)
	output, _ := m.Output(sess.ID, 10)
	if strings.Contains(joinOutput(output), "host-secret") || !strings.Contains(joinOutput(output), "missing") {
		t.Fatalf("expected inherited sensitive env to be stripped, output=%+v", output)
	}

	secret.SetEnvAllowlist([]string{"NATALIA_TEST_API_KEY"})
	allowed, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "printf $NATALIA_TEST_API_KEY"}})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, allowed.ID, StatusExited)
	output, _ = m.Output(allowed.ID, 10)
	if !strings.Contains(joinOutput(output), "host-secret") {
		t.Fatalf("expected allowlisted inherited sensitive env to pass through, output=%+v", output)
	}
}

func TestStartRedactsSensitiveOutput(t *testing.T) {
	m := New()
	sess, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "printf 'token=process-secret safe=ok'"}})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, sess.ID, StatusExited)
	output, _ := m.Output(sess.ID, 10)
	joined := joinOutput(output)
	if strings.Contains(joined, "process-secret") || !strings.Contains(joined, "token=[redacted]") || !strings.Contains(joined, "safe=ok") {
		t.Fatalf("expected redacted process output, got %s", joined)
	}
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

func TestSweepStopsExpiredSessionsAndAuditIsRedacted(t *testing.T) {
	m := New()
	running, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "while true; do sleep 1; done"}, Env: []string{"VISIBLE=ok", "TOKEN=secret"}, IdleTimeout: time.Nanosecond})
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(time.Millisecond)
	result := m.Sweep(SweepOptions{})
	if result.Stopped != 1 {
		t.Fatalf("expected one idle session stopped, got %+v", result)
	}
	status, ok := m.Status(running.ID)
	if !ok || status.Status != StatusStopped {
		t.Fatalf("expected stopped session after sweep, ok=%v status=%+v", ok, status)
	}
	done, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "true"}})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, done.ID, StatusExited)
	if removed := m.CleanupFinished(0); removed < 1 {
		t.Fatalf("expected completed cleanup to remove at least one session, got %d", removed)
	}
	audit := m.AuditLog()
	joined := formatAuditForTest(audit)
	if !strings.Contains(joined, "start") || !strings.Contains(joined, "stop") || !strings.Contains(joined, "cleanup") || !strings.Contains(joined, "TOKEN=[redacted]") || strings.Contains(joined, "secret") {
		t.Fatalf("expected redacted start/stop/cleanup audit, got %s", joined)
	}
}

func TestStartSweeperRunsUntilStopped(t *testing.T) {
	m := New()
	done, err := m.Start(context.Background(), StartOptions{Command: "/bin/sh", Args: []string{"-c", "true"}})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, done.ID, StatusExited)
	stop := m.StartSweeper(context.Background(), 10*time.Millisecond, SweepOptions{FinishedMaxAge: 0})
	defer stop()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if _, ok := m.Status(done.ID); !ok {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("expected sweeper to remove completed session %s", done.ID)
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

func hasEvent(events []Event, typ EventType, id string) bool {
	for _, event := range events {
		if event.Type == typ && event.Session.ID == id {
			return true
		}
	}
	return false
}

func hasOutputEvent(events []Event, id, text string) bool {
	for _, event := range events {
		if event.Type == EventOutput && event.Session.ID == id && event.Output != nil && event.Output.Text == text {
			return true
		}
	}
	return false
}

func formatAuditForTest(entries []AuditEntry) string {
	var b strings.Builder
	for _, entry := range entries {
		b.WriteString(entry.Action)
		b.WriteByte(' ')
		b.WriteString(strings.Join(entry.EnvSummary, ","))
		b.WriteByte('\n')
	}
	return b.String()
}

func TestSweepKindIsolation(t *testing.T) {
	m := New()
	proc, err := m.Start(context.Background(), StartOptions{Kind: KindProcess, Command: "/bin/sh", Args: []string{"-c", "exit 0"}})
	if err != nil {
		t.Fatal(err)
	}
	bg, err := m.Start(context.Background(), StartOptions{Kind: KindBackground, Command: "/bin/sh", Args: []string{"-c", "exit 0"}})
	if err != nil {
		t.Fatal(err)
	}
	waitForStatus(t, m, proc.ID, StatusExited)
	waitForStatus(t, m, bg.ID, StatusExited)

	processSweep := m.Sweep(SweepOptions{FinishedMaxAge: 0, Kind: KindProcess})
	if processSweep.Removed != 1 {
		t.Fatalf("expected process sweep to remove 1, got %d", processSweep.Removed)
	}
	if len(processSweep.AffectedIDs) != 1 || processSweep.AffectedIDs[0] != proc.ID {
		t.Fatalf("expected process sweep to affect %s, got %v", proc.ID, processSweep.AffectedIDs)
	}
	if _, ok := m.Status(bg.ID); !ok {
		t.Fatalf("background session should not be removed by process sweep")
	}

	backgroundSweep := m.Sweep(SweepOptions{FinishedMaxAge: 0, Kind: KindBackground})
	if backgroundSweep.Removed != 1 {
		t.Fatalf("expected background sweep to remove 1, got %d", backgroundSweep.Removed)
	}
	if len(backgroundSweep.AffectedIDs) != 1 || backgroundSweep.AffectedIDs[0] != bg.ID {
		t.Fatalf("expected background sweep to affect %s, got %v", bg.ID, backgroundSweep.AffectedIDs)
	}
	if _, ok := m.Status(proc.ID); ok {
		t.Fatalf("process session should not be removed by background sweep")
	}
}
