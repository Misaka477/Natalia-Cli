package processmgr

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
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
	Kind    Kind
	Command string
	Args    []string
	Cwd     string
	Env     []string
	MaxTail int
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
	ExitCode       *int
	Error          string
}

type OutputLine struct {
	Stream string
	Text   string
	Time   time.Time
}

type Manager struct {
	mu       sync.RWMutex
	nextID   uint64
	sessions map[string]*managedSession
}

var defaultManager = New()

func DefaultManager() *Manager {
	return defaultManager
}

func ResetDefaultManagerForTest() {
	defaultManager = New()
}

type managedSession struct {
	mu      sync.RWMutex
	meta    Session
	cmd     *exec.Cmd
	cancel  context.CancelFunc
	maxTail int
	output  []OutputLine
	done    chan struct{}
}

func New() *Manager {
	return &Manager{sessions: make(map[string]*managedSession)}
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
	ms := &managedSession{
		meta: Session{ID: id, Kind: opts.Kind, Command: opts.Command, Args: append([]string(nil), opts.Args...), Cwd: opts.Cwd, Status: StatusRunning, PID: cmd.Process.Pid, StartedAt: now, LastActivityAt: now},
		cmd:  cmd, cancel: cancel, maxTail: opts.MaxTail, done: make(chan struct{}),
	}
	m.mu.Lock()
	m.sessions[id] = ms
	m.mu.Unlock()

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
	ms.mu.Lock()
	if ms.meta.Status == StatusExited || ms.meta.Status == StatusFailed {
		ms.meta.Status = StatusStopped
	}
	ms.mu.Unlock()
	return nil
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
	defer s.mu.Unlock()
	now := time.Now()
	s.meta.LastActivityAt = now
	s.output = append(s.output, OutputLine{Stream: stream, Text: text, Time: now})
	if len(s.output) > s.maxTail {
		s.output = append([]OutputLine(nil), s.output[len(s.output)-s.maxTail:]...)
	}
}

func (s *managedSession) wait() {
	err := s.cmd.Wait()
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	s.meta.ExitedAt = now
	s.meta.LastActivityAt = now
	if s.meta.Status == StatusRunning {
		if err != nil {
			s.meta.Status = StatusFailed
			s.meta.Error = err.Error()
		} else {
			s.meta.Status = StatusExited
		}
	}
	if s.cmd.ProcessState != nil {
		code := s.cmd.ProcessState.ExitCode()
		s.meta.ExitCode = &code
	}
	close(s.done)
}

func (s *managedSession) snapshot() *Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	copy := s.meta
	copy.Args = append([]string(nil), s.meta.Args...)
	return &copy
}
