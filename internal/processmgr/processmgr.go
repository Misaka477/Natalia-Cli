package processmgr

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

type Status string

const (
	StatusRunning Status = "running"
	StatusExited  Status = "exited"
	StatusStopped Status = "stopped"
	StatusFailed  Status = "failed"
)

type Kind string

const (
	KindProcess     Kind = "process"
	KindBackground  Kind = "background"
	KindInteractive Kind = "interactive"
	KindMCP         Kind = "mcp"
)

type StartOptions struct {
	Kind        Kind
	Command     string
	Args        []string
	Cwd         string
	Env         []string
	MaxTail     int
	IdleTimeout time.Duration
	MaxLifetime time.Duration
}

type Session struct {
	ID             string
	Kind           Kind
	Command        string
	Args           []string
	Cwd            string
	Status         Status
	PID            int
	StartedAt      time.Time
	LastActivityAt time.Time
	ExitedAt       time.Time
	DetachedAt     time.Time
	ExitCode       *int
	Error          string
	EnvSummary     []string
	Attached       bool
	IdleTimeout    time.Duration
	MaxLifetime    time.Duration
}

type OutputLine struct {
	Stream string
	Text   string
	Time   time.Time
}

type OutputPage struct {
	Lines      []OutputLine
	Total      int
	Offset     int
	NextOffset int
	HasMore    bool
}

type EventType string

const (
	EventStarted  EventType = "started"
	EventOutput   EventType = "output"
	EventExited   EventType = "exited"
	EventFailed   EventType = "failed"
	EventStopped  EventType = "stopped"
	EventAttached EventType = "attached"
	EventDetached EventType = "detached"
	EventCleanup  EventType = "cleanup"
	EventStale    EventType = "stale"
)

type Event struct {
	Type    EventType
	Session Session
	Output  *OutputLine
	Message string
	Time    time.Time
}

type AuditEntry struct {
	Action     string
	SessionID  string
	Kind       Kind
	Status     Status
	Command    string
	Args       []string
	Cwd        string
	EnvSummary []string
	Time       time.Time
}

type SweepOptions struct {
	FinishedMaxAge time.Duration
	IdleTimeout    time.Duration
	MaxLifetime    time.Duration
	DetectStale    bool
}

type SweepResult struct {
	Removed int
	Stopped int
	Stale   int
}

type Manager struct {
	mu        sync.RWMutex
	nextID    uint64
	nextSubID uint64
	sessions  map[string]*managedSession
	callbacks map[uint64]func(Event)
	audit     []AuditEntry
}

var defaultManager = New()

func DefaultManager() *Manager {
	return defaultManager
}

func ResetDefaultManagerForTest() {
	defaultManager = New()
}

type managedSession struct {
	manager *Manager
	mu      sync.RWMutex
	meta    Session
	cmd     *exec.Cmd
	cancel  context.CancelFunc
	maxTail int
	output  []OutputLine
	done    chan struct{}
	opts    StartOptions
}

func New() *Manager {
	return &Manager{sessions: make(map[string]*managedSession), callbacks: make(map[uint64]func(Event))}
}

func (m *Manager) Subscribe(fn func(Event)) func() {
	if fn == nil {
		return func() {}
	}
	id := atomic.AddUint64(&m.nextSubID, 1)
	m.mu.Lock()
	m.callbacks[id] = fn
	m.mu.Unlock()
	return func() {
		m.mu.Lock()
		delete(m.callbacks, id)
		m.mu.Unlock()
	}
}

func (m *Manager) SubscribeComplete(fn func(Session)) func() {
	if fn == nil {
		return func() {}
	}
	return m.Subscribe(func(event Event) {
		if event.Type == EventExited || event.Type == EventFailed || event.Type == EventStopped {
			fn(event.Session)
		}
	})
}

func (m *Manager) Start(ctx context.Context, opts StartOptions) (*Session, error) {
	if opts.Command == "" {
		return nil, fmt.Errorf("command is required")
	}
	if opts.Kind == "" {
		opts.Kind = KindProcess
	}
	if opts.MaxTail <= 0 {
		opts.MaxTail = 1000
	}
	if opts.Cwd != "" {
		info, err := os.Stat(opts.Cwd)
		if err != nil {
			return nil, fmt.Errorf("cwd check failed: %w", err)
		}
		if !info.IsDir() {
			return nil, fmt.Errorf("cwd is not a directory: %s", opts.Cwd)
		}
	}

	runCtx, cancel := context.WithCancel(ctx)
	cmd := exec.CommandContext(runCtx, opts.Command, opts.Args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Dir = opts.Cwd
	if len(opts.Env) > 0 {
		cmd.Env = append(os.Environ(), opts.Env...)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		cancel()
		return nil, err
	}

	now := time.Now()
	id := fmt.Sprintf("proc_%d", atomic.AddUint64(&m.nextID, 1))
	optsCopy := opts
	optsCopy.Args = append([]string(nil), opts.Args...)
	optsCopy.Env = append([]string(nil), opts.Env...)
	ms := &managedSession{
		manager: m,
		meta:    Session{ID: id, Kind: opts.Kind, Command: opts.Command, Args: append([]string(nil), opts.Args...), Cwd: opts.Cwd, Status: StatusRunning, PID: cmd.Process.Pid, StartedAt: now, LastActivityAt: now, EnvSummary: summarizeEnv(opts.Env), Attached: true, IdleTimeout: opts.IdleTimeout, MaxLifetime: opts.MaxLifetime},
		cmd:     cmd, cancel: cancel, maxTail: opts.MaxTail, done: make(chan struct{}),
		opts: optsCopy,
	}
	m.mu.Lock()
	m.sessions[id] = ms
	m.appendAuditLocked("start", ms.meta)
	m.mu.Unlock()
	m.notify(Event{Type: EventStarted, Session: *ms.snapshot(), Time: now})

	go ms.capture("stdout", stdout)
	go ms.capture("stderr", stderr)
	go ms.wait()
	return ms.snapshot(), nil
}

func (m *Manager) List() []Session {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		out = append(out, *s.snapshot())
	}
	return out
}

func (m *Manager) Status(id string) (*Session, bool) {
	ms, ok := m.get(id)
	if !ok {
		return nil, false
	}
	return ms.snapshot(), true
}

func (m *Manager) Output(id string, tail int) ([]OutputLine, bool) {
	ms, ok := m.get(id)
	if !ok {
		return nil, false
	}
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	if tail <= 0 || tail > len(ms.output) {
		tail = len(ms.output)
	}
	out := append([]OutputLine(nil), ms.output[len(ms.output)-tail:]...)
	return out, true
}

func (m *Manager) OutputPage(id string, offset, limit int) (OutputPage, bool) {
	ms, ok := m.get(id)
	if !ok {
		return OutputPage{}, false
	}
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	total := len(ms.output)
	if offset < 0 {
		offset = 0
	}
	if offset > total {
		offset = total
	}
	end := total
	if limit > 0 && offset+limit < end {
		end = offset + limit
	}
	lines := append([]OutputLine(nil), ms.output[offset:end]...)
	return OutputPage{Lines: lines, Total: total, Offset: offset, NextOffset: end, HasMore: end < total}, true
}

func (m *Manager) Stop(id string) error {
	ms, ok := m.get(id)
	if !ok {
		return fmt.Errorf("unknown process session %q", id)
	}
	ms.mu.RLock()
	pid := ms.meta.PID
	status := ms.meta.Status
	ms.mu.RUnlock()
	if status != StatusRunning {
		return nil
	}
	now := time.Now()
	ms.mu.Lock()
	if ms.meta.Status == StatusRunning {
		ms.meta.Status = StatusStopped
		ms.meta.LastActivityAt = now
	}
	ms.mu.Unlock()
	m.recordAudit("stop", ms.snapshot())
	ms.cancel()
	if pid > 0 {
		_ = syscall.Kill(-pid, syscall.SIGTERM)
	}
	select {
	case <-ms.done:
	case <-time.After(2 * time.Second):
		if pid > 0 {
			_ = syscall.Kill(-pid, syscall.SIGKILL)
		}
		<-ms.done
	}
	return nil
}

func (m *Manager) Restart(ctx context.Context, id string) (*Session, error) {
	ms, ok := m.get(id)
	if !ok {
		return nil, fmt.Errorf("unknown process session %q", id)
	}
	ms.mu.RLock()
	opts := ms.opts
	status := ms.meta.Status
	ms.mu.RUnlock()
	if status == StatusRunning {
		if err := m.Stop(id); err != nil {
			return nil, err
		}
	}
	m.recordAudit("restart", ms.snapshot())
	return m.Start(ctx, opts)
}

func (m *Manager) Attach(id string) (*Session, error) {
	ms, ok := m.get(id)
	if !ok {
		return nil, fmt.Errorf("unknown process session %q", id)
	}
	ms.mu.Lock()
	now := time.Now()
	ms.meta.Attached = true
	ms.meta.DetachedAt = time.Time{}
	ms.meta.LastActivityAt = now
	ms.mu.Unlock()
	snapshot := ms.snapshot()
	m.recordAudit("attach", snapshot)
	m.notify(Event{Type: EventAttached, Session: *snapshot, Time: now})
	return snapshot, nil
}

func (m *Manager) Detach(id string) (*Session, error) {
	ms, ok := m.get(id)
	if !ok {
		return nil, fmt.Errorf("unknown process session %q", id)
	}
	ms.mu.Lock()
	now := time.Now()
	ms.meta.Attached = false
	ms.meta.DetachedAt = now
	ms.meta.LastActivityAt = now
	ms.mu.Unlock()
	snapshot := ms.snapshot()
	m.recordAudit("detach", snapshot)
	m.notify(Event{Type: EventDetached, Session: *snapshot, Time: now})
	return snapshot, nil
}

func (m *Manager) CleanupFinished(maxAge time.Duration) int {
	if maxAge < 0 {
		maxAge = 0
	}
	cutoff := time.Now().Add(-maxAge)
	removed := 0
	var removedEvents []Event
	m.mu.Lock()
	for id, session := range m.sessions {
		snapshot := session.snapshot()
		if snapshot.Status == StatusRunning {
			continue
		}
		if !snapshot.ExitedAt.IsZero() && snapshot.ExitedAt.Before(cutoff) {
			delete(m.sessions, id)
			m.appendAuditLocked("cleanup", *snapshot)
			removedEvents = append(removedEvents, Event{Type: EventCleanup, Session: *snapshot, Message: "removed completed session", Time: time.Now()})
			removed++
		}
	}
	m.mu.Unlock()
	for _, event := range removedEvents {
		m.notify(event)
	}
	return removed
}

func (m *Manager) Sweep(opts SweepOptions) SweepResult {
	result := SweepResult{Removed: m.CleanupFinished(opts.FinishedMaxAge)}
	now := time.Now()
	for _, sess := range m.List() {
		if sess.Status != StatusRunning {
			continue
		}
		if opts.DetectStale && !processAlive(sess.PID) {
			if ms, ok := m.get(sess.ID); ok {
				ms.mu.Lock()
				ms.meta.Status = StatusFailed
				ms.meta.ExitedAt = now
				ms.meta.LastActivityAt = now
				ms.meta.Error = "process is no longer alive"
				ms.mu.Unlock()
				snapshot := ms.snapshot()
				m.recordAudit("stale", snapshot)
				m.notify(Event{Type: EventStale, Session: *snapshot, Message: snapshot.Error, Time: now})
				result.Stale++
			}
			continue
		}
		idleTimeout := opts.IdleTimeout
		if idleTimeout <= 0 {
			idleTimeout = sess.IdleTimeout
		}
		maxLifetime := opts.MaxLifetime
		if maxLifetime <= 0 {
			maxLifetime = sess.MaxLifetime
		}
		if idleTimeout > 0 && now.Sub(sess.LastActivityAt) >= idleTimeout {
			if err := m.Stop(sess.ID); err == nil {
				result.Stopped++
			}
			continue
		}
		if maxLifetime > 0 && now.Sub(sess.StartedAt) >= maxLifetime {
			if err := m.Stop(sess.ID); err == nil {
				result.Stopped++
			}
		}
	}
	return result
}

func (m *Manager) StartSweeper(ctx context.Context, interval time.Duration, opts SweepOptions) func() {
	if interval <= 0 {
		interval = time.Minute
	}
	ctx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				m.Sweep(opts)
			}
		}
	}()
	return func() {
		cancel()
		<-done
	}
}

func (m *Manager) AuditLog() []AuditEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := append([]AuditEntry(nil), m.audit...)
	for i := range out {
		out[i].Args = append([]string(nil), out[i].Args...)
		out[i].EnvSummary = append([]string(nil), out[i].EnvSummary...)
	}
	return out
}

func (m *Manager) get(id string) (*managedSession, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ms, ok := m.sessions[id]
	return ms, ok
}

func (s *managedSession) capture(stream string, r io.Reader) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		s.appendOutput(stream, scanner.Text())
	}
}

func (s *managedSession) appendOutput(stream, text string) {
	s.mu.Lock()
	now := time.Now()
	s.meta.LastActivityAt = now
	line := OutputLine{Stream: stream, Text: text, Time: now}
	s.output = append(s.output, line)
	if len(s.output) > s.maxTail {
		s.output = append([]OutputLine(nil), s.output[len(s.output)-s.maxTail:]...)
	}
	snapshot := s.meta
	s.mu.Unlock()
	if s.manager != nil {
		s.manager.notify(Event{Type: EventOutput, Session: snapshot, Output: &line, Time: now})
	}
}

func (s *managedSession) wait() {
	err := s.cmd.Wait()
	s.mu.Lock()
	now := time.Now()
	s.meta.ExitedAt = now
	s.meta.LastActivityAt = now
	finalStatus := s.meta.Status
	if s.meta.Status == StatusRunning {
		if err != nil {
			s.meta.Status = StatusFailed
			s.meta.Error = err.Error()
		} else {
			s.meta.Status = StatusExited
		}
		finalStatus = s.meta.Status
	}
	if s.cmd.ProcessState != nil {
		code := s.cmd.ProcessState.ExitCode()
		s.meta.ExitCode = &code
	}
	close(s.done)
	s.mu.Unlock()
	if s.manager != nil {
		snapshot := s.snapshot()
		s.manager.recordAudit(string(finalStatus), snapshot)
		eventType := EventExited
		switch finalStatus {
		case StatusFailed:
			eventType = EventFailed
		case StatusStopped:
			eventType = EventStopped
		}
		s.manager.notify(Event{Type: eventType, Session: *snapshot, Time: time.Now()})
	}
}

func (m *Manager) notify(event Event) {
	m.mu.RLock()
	callbacks := make([]func(Event), 0, len(m.callbacks))
	for _, fn := range m.callbacks {
		callbacks = append(callbacks, fn)
	}
	m.mu.RUnlock()
	for _, fn := range callbacks {
		fn(event)
	}
}

func (s *managedSession) snapshot() *Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	copy := s.meta
	copy.Args = append([]string(nil), s.meta.Args...)
	copy.EnvSummary = append([]string(nil), s.meta.EnvSummary...)
	return &copy
}

func (m *Manager) recordAudit(action string, sess *Session) {
	if sess == nil {
		return
	}
	m.mu.Lock()
	m.appendAuditLocked(action, *sess)
	m.mu.Unlock()
}

func (m *Manager) appendAuditLocked(action string, sess Session) {
	m.audit = append(m.audit, AuditEntry{Action: action, SessionID: sess.ID, Kind: sess.Kind, Status: sess.Status, Command: sess.Command, Args: append([]string(nil), sess.Args...), Cwd: sess.Cwd, EnvSummary: append([]string(nil), sess.EnvSummary...), Time: time.Now()})
}

func processAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	err := syscall.Kill(pid, 0)
	return err == nil || err == syscall.EPERM
}

func summarizeEnv(env []string) []string {
	if len(env) == 0 {
		return nil
	}
	out := make([]string, 0, len(env))
	for _, item := range env {
		key, value, ok := strings.Cut(item, "=")
		if !ok {
			out = append(out, item)
			continue
		}
		if isSecretEnvName(key) {
			value = "[redacted]"
		}
		out = append(out, key+"="+value)
	}
	return out
}

func isSecretEnvName(name string) bool {
	upper := strings.ToUpper(name)
	for _, marker := range []string{"SECRET", "TOKEN", "PASSWORD", "PRIVATE_KEY", "ACCESS_KEY", "API_KEY"} {
		if strings.Contains(upper, marker) {
			return true
		}
	}
	return strings.HasSuffix(upper, "_KEY")
}
