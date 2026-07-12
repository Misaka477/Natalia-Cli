package interactivemgr

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/creack/pty"
)

type Status string

const (
	StatusRunning         Status = "running"
	StatusWaitingForInput Status = "waiting_for_input"
	StatusExited          Status = "exited"
	StatusStopped         Status = "stopped"
	StatusFailed          Status = "failed"
)

type StartOptions struct {
	Command string
	Args    []string
	Cwd     string
	Rows    int
	Cols    int
	MaxTail int
}

type ObserveOptions struct {
	WaitFor       string
	IdleTimeout   time.Duration
	MaxWait       time.Duration
	TailBytes     int
	IncludeOutput bool
}

type Session struct {
	ID             string
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

type Observation struct {
	SessionID      string
	Status         Status
	ExitCode       *int
	NewOutput      string
	Tail           string
	DetectedPrompt string
	Truncated      bool
	Suggestion     string
}

type Manager struct {
	mu       sync.RWMutex
	nextID   uint64
	sessions map[string]*managedSession
}

type managedSession struct {
	mu         sync.RWMutex
	meta       Session
	cmd        *exec.Cmd
	pty        *os.File
	cancel     context.CancelFunc
	maxTail    int
	buf        []byte
	lastRead   int
	outputCond *sync.Cond
	done       chan struct{}
	stopped    bool
}

var defaultManager = New()

func New() *Manager {
	return &Manager{sessions: make(map[string]*managedSession)}
}

func DefaultManager() *Manager {
	return defaultManager
}

func ResetDefaultManagerForTest() {
	defaultManager = New()
}

func (m *Manager) Start(ctx context.Context, opts StartOptions) (*Session, error) {
	if opts.Command == "" {
		return nil, fmt.Errorf("command is required")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if opts.MaxTail <= 0 {
		opts.MaxTail = 64 * 1024
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
	rows, cols := opts.Rows, opts.Cols
	if rows <= 0 {
		rows = 24
	}
	if cols <= 0 {
		cols = 80
	}

	runCtx, cancel := context.WithCancel(ctx)
	cmd := exec.CommandContext(runCtx, opts.Command, opts.Args...)
	cmd.Dir = opts.Cwd
	cmd.Env = os.Environ()
	f, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: uint16(rows), Cols: uint16(cols)})
	if err != nil {
		cancel()
		return nil, err
	}
	now := time.Now()
	id := fmt.Sprintf("tty_%d", atomic.AddUint64(&m.nextID, 1))
	ms := &managedSession{
		meta: Session{ID: id, Command: opts.Command, Args: append([]string(nil), opts.Args...), Cwd: opts.Cwd, Status: StatusRunning, PID: cmd.Process.Pid, StartedAt: now, LastActivityAt: now},
		cmd:  cmd, pty: f, cancel: cancel, maxTail: opts.MaxTail, done: make(chan struct{}),
	}
	ms.outputCond = sync.NewCond(&ms.mu)
	m.mu.Lock()
	m.sessions[id] = ms
	m.mu.Unlock()
	go ms.capture()
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

func (m *Manager) Observe(id string, opts ObserveOptions) (*Observation, error) {
	ms, ok := m.get(id)
	if !ok {
		return nil, fmt.Errorf("unknown interactive session %q", id)
	}
	return ms.observe(opts)
}

func (m *Manager) Write(id, input string, sensitive bool, opts ObserveOptions) (*Observation, error) {
	ms, ok := m.get(id)
	if !ok {
		return nil, fmt.Errorf("unknown interactive session %q", id)
	}
	redactFrom := ms.markReadBoundary()
	if err := ms.write(input); err != nil {
		return nil, err
	}
	obs, err := ms.observe(opts)
	if sensitive {
		ms.redactFrom(redactFrom)
	}
	return obs, err
}

func (m *Manager) SendKey(id, key string, opts ObserveOptions) (*Observation, error) {
	seq, err := keySequence(key)
	if err != nil {
		return nil, err
	}
	return m.Write(id, seq, false, opts)
}

func (m *Manager) Stop(id string) error {
	ms, ok := m.get(id)
	if !ok {
		return fmt.Errorf("unknown interactive session %q", id)
	}
	ms.mu.RLock()
	pid := ms.meta.PID
	status := ms.meta.Status
	ms.mu.RUnlock()
	if status == StatusExited || status == StatusFailed || status == StatusStopped {
		return nil
	}
	ms.mu.Lock()
	ms.stopped = true
	ms.mu.Unlock()
	ms.cancel()
	_ = ms.pty.Close()
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
	ms.meta.Status = StatusStopped
	ms.mu.Unlock()
	return nil
}

func (m *Manager) get(id string) (*managedSession, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ms, ok := m.sessions[id]
	return ms, ok
}

func (s *managedSession) capture() {
	buf := make([]byte, 4096)
	for {
		n, err := s.pty.Read(buf)
		if n > 0 {
			s.appendOutput(buf[:n])
		}
		if err != nil {
			if err != io.EOF && !strings.Contains(err.Error(), "file already closed") {
				s.mu.Lock()
				if s.meta.Status == StatusRunning || s.meta.Status == StatusWaitingForInput {
					s.meta.Error = err.Error()
				}
				s.mu.Unlock()
			}
			return
		}
	}
}

func (s *managedSession) appendOutput(chunk []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	s.meta.LastActivityAt = now
	s.buf = append(s.buf, chunk...)
	if len(s.buf) > s.maxTail {
		drop := len(s.buf) - s.maxTail
		s.buf = append([]byte(nil), s.buf[drop:]...)
		if s.lastRead < drop {
			s.lastRead = 0
		} else {
			s.lastRead -= drop
		}
	}
	if s.meta.Status == StatusWaitingForInput {
		s.meta.Status = StatusRunning
	}
	s.outputCond.Broadcast()
}

func (s *managedSession) write(input string) error {
	s.mu.RLock()
	status := s.meta.Status
	s.mu.RUnlock()
	if status != StatusRunning && status != StatusWaitingForInput {
		return fmt.Errorf("interactive session is %s", status)
	}
	_, err := s.pty.Write([]byte(input))
	return err
}

func (s *managedSession) markReadBoundary() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastRead = len(s.buf)
	return s.lastRead
}

func (s *managedSession) redactFrom(start int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if start < 0 || start >= len(s.buf) {
		return
	}
	s.buf = append(append([]byte(nil), s.buf[:start]...), []byte("[secret redacted]\n")...)
	if s.lastRead > len(s.buf) {
		s.lastRead = len(s.buf)
	}
}

func (s *managedSession) observe(opts ObserveOptions) (*Observation, error) {
	if opts.IdleTimeout <= 0 {
		opts.IdleTimeout = 200 * time.Millisecond
	}
	if opts.MaxWait <= 0 {
		opts.MaxWait = 2 * time.Second
	}
	if opts.TailBytes <= 0 {
		opts.TailBytes = 4096
	}
	var waitRe *regexp.Regexp
	if opts.WaitFor != "" {
		compiled, err := regexp.Compile(opts.WaitFor)
		if err != nil {
			return nil, fmt.Errorf("wait_for regex invalid: %w", err)
		}
		waitRe = compiled
	}
	deadline := time.Now().Add(opts.MaxWait)
	lastLen := -1
	lastChange := time.Now()
	waitMatched := false
	for {
		s.mu.Lock()
		currentLen := len(s.buf)
		status := s.meta.Status
		full := append([]byte(nil), s.buf...)
		unread := append([]byte(nil), s.buf[s.lastRead:]...)
		if status == StatusExited || status == StatusFailed || status == StatusStopped {
			s.mu.Unlock()
			return s.makeObservation(full, opts, waitRe), nil
		}
		if waitRe != nil && waitRe.Match(unread) {
			waitMatched = true
		}
		if currentLen != lastLen {
			lastLen = currentLen
			lastChange = time.Now()
		}
		if time.Since(lastChange) >= opts.IdleTimeout {
			s.meta.Status = StatusWaitingForInput
			s.mu.Unlock()
			return s.makeObservation(full, opts, waitRe), nil
		}
		if waitMatched && opts.IdleTimeout <= 0 {
			s.meta.Status = StatusWaitingForInput
			s.mu.Unlock()
			return s.makeObservation(full, opts, waitRe), nil
		}
		if time.Now().After(deadline) {
			s.mu.Unlock()
			return s.makeObservation(full, opts, waitRe), nil
		}
		s.mu.Unlock()
		time.Sleep(20 * time.Millisecond)
	}
}

func (s *managedSession) makeObservation(full []byte, opts ObserveOptions, waitRe *regexp.Regexp) *Observation {
	s.mu.Lock()
	defer s.mu.Unlock()
	newOutput := ""
	if opts.IncludeOutput && s.lastRead <= len(s.buf) {
		newOutput = cleanTerminal(string(s.buf[s.lastRead:]))
	}
	s.lastRead = len(s.buf)
	tailBytes := opts.TailBytes
	truncated := false
	if len(full) > tailBytes {
		full = full[len(full)-tailBytes:]
		truncated = true
	}
	tail := cleanTerminal(string(full))
	detected := detectPrompt(newOutput, waitRe)
	if detected == "" {
		detected = detectPrompt(tail, nil)
	}
	suggestion := "continue observing"
	if s.meta.Status == StatusWaitingForInput {
		suggestion = "send input or stop the session"
	}
	if s.meta.Status == StatusExited || s.meta.Status == StatusStopped || s.meta.Status == StatusFailed {
		suggestion = "session ended"
	}
	return &Observation{SessionID: s.meta.ID, Status: s.meta.Status, ExitCode: s.meta.ExitCode, NewOutput: newOutput, Tail: tail, DetectedPrompt: detected, Truncated: truncated, Suggestion: suggestion}
}

func (s *managedSession) wait() {
	err := s.cmd.Wait()
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	s.meta.ExitedAt = now
	s.meta.LastActivityAt = now
	if s.stopped {
		s.meta.Status = StatusStopped
	} else if err != nil {
		s.meta.Status = StatusFailed
		s.meta.Error = err.Error()
	} else {
		s.meta.Status = StatusExited
	}
	if s.cmd.ProcessState != nil {
		code := s.cmd.ProcessState.ExitCode()
		s.meta.ExitCode = &code
	}
	s.outputCond.Broadcast()
	close(s.done)
}

func (s *managedSession) snapshot() *Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	copy := s.meta
	copy.Args = append([]string(nil), s.meta.Args...)
	return &copy
}

func keySequence(key string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case "enter":
		return "\r", nil
	case "ctrl-c", "ctrl_c", "c-c":
		return "\x03", nil
	case "ctrl-d", "ctrl_d", "c-d":
		return "\x04", nil
	case "tab":
		return "\t", nil
	case "escape", "esc":
		return "\x1b", nil
	default:
		return "", fmt.Errorf("unsupported key %q", key)
	}
}

func detectPrompt(tail string, waitRe *regexp.Regexp) string {
	if waitRe != nil {
		if match := waitRe.FindString(tail); match != "" {
			return match
		}
	}
	lines := strings.Split(strings.TrimRight(tail, "\r\n"), "\n")
	if len(lines) == 0 {
		return ""
	}
	last := strings.TrimSpace(lines[len(lines)-1])
	if last == "" {
		return ""
	}
	patterns := []string{"?", ">", "$", "#", ":", "continue?", "password:"}
	lower := strings.ToLower(last)
	for _, p := range patterns {
		if strings.HasSuffix(lower, p) || strings.Contains(lower, p) {
			return last
		}
	}
	return ""
}

func cleanTerminal(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	return strings.TrimRight(stripANSI(s), "\n")
}

func stripANSI(s string) string {
	var out bytes.Buffer
	inEsc := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		if inEsc {
			if (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') {
				inEsc = false
			}
			continue
		}
		if c == 0x1b {
			inEsc = true
			continue
		}
		out.WriteByte(c)
	}
	return out.String()
}
