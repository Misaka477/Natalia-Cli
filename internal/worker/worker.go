package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/approval"
	"github.com/Misaka477/Natalia-Cli/internal/chat"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/mode"
	"github.com/Misaka477/Natalia-Cli/internal/soul"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
)

type Status string

const (
	StatusIdle      Status = "idle"
	StatusRunning   Status = "running"
	StatusPaused    Status = "paused"
	StatusStopped   Status = "stopped"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
)

type LogEntry struct {
	Step      int            `json:"step,omitempty"`
	Tool      string         `json:"tool,omitempty"`
	Args      map[string]any `json:"args,omitempty"`
	Result    string         `json:"result,omitempty"`
	Error     string         `json:"error,omitempty"`
	Reasoning string         `json:"reasoning,omitempty"`
	Timestamp time.Time      `json:"timestamp,omitempty"`
}

type Worker struct {
	ID           string
	Mode         string
	ModelProfile string
	Task         string
	Status       Status
	Attached     bool
	Engine       *soul.Engine
	Logs         []LogEntry
	CreatedAt    time.Time
	UpdatedAt    time.Time
	OnLog        func(LogEntry)
	OnStatus     func(Status)
	mu           sync.RWMutex

	ctx        context.Context
	cancel     context.CancelFunc
	stopped    bool
	generation int
	done       chan struct{}
}

type SpawnOptions struct {
	Timeout      time.Duration
	Approver     *approval.Approver
	ModelProfile string
}

func New(id, task, modeName string, llmClient *llm.Client, tools *toolset.Registry) (*Worker, error) {
	return NewWithOptions(id, task, modeName, llmClient, tools, SpawnOptions{})
}

func NewWithOptions(id, task, modeName string, llmClient *llm.Client, tools *toolset.Registry, opts SpawnOptions) (*Worker, error) {
	m, err := mode.Get(modeName)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithCancel(context.Background())
	if opts.Timeout > 0 {
		ctx, cancel = context.WithTimeout(context.Background(), opts.Timeout)
	}

	eng := soul.NewEngine(llmClient, tools)
	w := &Worker{
		ID:           id,
		Mode:         modeName,
		ModelProfile: opts.ModelProfile,
		Task:         task,
		Status:       StatusIdle,
		Attached:     true,
		Engine:       eng,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		ctx:          ctx,
		cancel:       cancel,
	}

	eng.Mode = m
	eng.Approver = opts.Approver
	if len(eng.Context.Messages) == 0 {
		eng.Context.Messages = append(eng.Context.Messages, chat.Message{
			Role:    chat.RoleSystem,
			Content: m.Prompt,
		})
	}
	eng.Context.Messages = append(eng.Context.Messages, chat.Message{
		Role:    chat.RoleUser,
		Content: task,
	})

	return w, nil
}

func (w *Worker) Start() {
	if w.Engine == nil || w.Engine.Dedup == nil || w.Engine.LLM == nil {
		w.setStatus(StatusFailed)
		return
	}
	w.mu.Lock()
	if w.Status == StatusRunning {
		w.mu.Unlock()
		return
	}
	w.generation++
	gen := w.generation
	prevDone := w.done
	w.done = make(chan struct{})
	w.stopped = false
	w.mu.Unlock()
	w.setStatus(StatusRunning)

	if prevDone != nil {
		<-prevDone
	}

	go func() {
		defer close(w.done)
		w.runGeneration(gen)
	}()
}

func (w *Worker) runGeneration(gen int) {
	w.Engine.Dedup.ResetTurn()
	for w.Engine.Context.StepCount < w.Engine.Context.MaxSteps {
		w.mu.RLock()
		currentGen := w.generation
		stopped := w.stopped
		w.mu.RUnlock()
		if currentGen != gen {
			w.setCancelledStatus()
			return
		}
		if stopped || w.ctx.Err() != nil {
			w.setCancelledStatus()
			return
		}

		cp := w.Engine.Context.SaveCheckpoint()

		outcome := w.Engine.Step(w.ctx)
		if outcome.StopReason == "error" {
			if outcome.FinalMessage == "context canceled" {
				w.setCancelledStatus()
				return
			}
			w.addLog(LogEntry{
				Step:  w.Engine.Context.StepCount,
				Error: outcome.FinalMessage,
			})
			if outcome.FinalMessage == "API error" {
				cp.Restore(w.Engine.Context)
				continue
			}
			w.setStatus(StatusFailed)
			return
		}

		if outcome.StopReason == "tool_called" {
			for i := len(w.Engine.Context.Messages) - 1; i >= 0; i-- {
				msg := w.Engine.Context.Messages[i]
				if msg.Role != chat.RoleAssistant || len(msg.ToolCalls) == 0 {
					continue
				}
				for _, tc := range msg.ToolCalls {
					w.addLog(LogEntry{Step: w.Engine.Context.StepCount, Tool: tc.Function.Name, Args: parseArgs(tc.Function.Arguments)})
				}
				break
			}
			continue
		}
		if outcome.StopReason == "back_to_future" {
			cp.Restore(w.Engine.Context)
			continue
		}
		if outcome.StopReason == "no_tool_calls" {
			w.setStatus(StatusCompleted)
			w.addLog(LogEntry{
				Step:   w.Engine.Context.StepCount,
				Result: outcome.FinalMessage,
			})
			return
		}
	}
	w.setStatus(StatusCompleted)
}

func (w *Worker) Stop() {
	w.mu.Lock()
	if w.Status != StatusRunning {
		w.mu.Unlock()
		return
	}
	w.stopped = true
	cancel := w.cancel
	w.mu.Unlock()
	w.setStatus(StatusStopped)
	if cancel != nil {
		cancel()
	}
}

func (w *Worker) Resume() error {
	w.mu.Lock()
	if w.Status != StatusPaused {
		status := w.Status
		w.mu.Unlock()
		return fmt.Errorf("worker is %s; only paused workers can be resumed", status)
	}
	done := w.done
	w.mu.Unlock()
	if done != nil {
		<-done
	}
	w.mu.Lock()
	if w.Status != StatusPaused {
		w.mu.Unlock()
		return fmt.Errorf("worker is %s; only paused workers can be resumed", w.Status)
	}
	w.stopped = false
	w.ctx, w.cancel = context.WithCancel(context.Background())
	w.mu.Unlock()
	w.Start()
	return nil
}

func (w *Worker) setCancelledStatus() {
	w.mu.RLock()
	stopped := w.stopped
	w.mu.RUnlock()
	if stopped {
		w.setStatus(StatusStopped)
		return
	}
	w.setStatus(StatusPaused)
}

func (w *Worker) Attach() bool {
	return w.setAttached(true)
}

func (w *Worker) Detach() bool {
	return w.setAttached(false)
}

func (w *Worker) IsAttached() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.Attached
}

func (w *Worker) GetLogs() []LogEntry {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.Logs
}

func (w *Worker) GetStatus() Status {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.Status
}

func (w *Worker) addLog(entry LogEntry) {
	w.mu.Lock()
	entry.Timestamp = time.Now()
	w.Logs = append(w.Logs, entry)
	w.UpdatedAt = time.Now()
	onLog := w.OnLog
	w.mu.Unlock()
	if onLog != nil {
		onLog(entry)
	}
}

func (w *Worker) setStatus(status Status) {
	w.mu.Lock()
	changed := w.Status != status
	w.Status = status
	w.UpdatedAt = time.Now()
	onStatus := w.OnStatus
	w.mu.Unlock()
	if changed && onStatus != nil {
		onStatus(status)
	}
}

func (w *Worker) setAttached(attached bool) bool {
	w.mu.Lock()
	changed := w.Attached != attached
	w.Attached = attached
	w.UpdatedAt = time.Now()
	w.mu.Unlock()
	return changed
}

type Event struct {
	WorkerID     string    `json:"worker_id"`
	Task         string    `json:"task,omitempty"`
	Mode         string    `json:"mode,omitempty"`
	ModelProfile string    `json:"model_profile,omitempty"`
	Event        string    `json:"event"`
	Status       Status    `json:"status,omitempty"`
	Attached     bool      `json:"attached"`
	Log          *LogEntry `json:"log,omitempty"`
	Time         time.Time `json:"time,omitempty"`
}

type AuditEntry struct {
	EventID      string    `json:"event_id"`
	WorkerID     string    `json:"worker_id"`
	Task         string    `json:"task,omitempty"`
	Mode         string    `json:"mode,omitempty"`
	ModelProfile string    `json:"model_profile,omitempty"`
	Event        string    `json:"event"`
	Status       Status    `json:"status,omitempty"`
	Attached     bool      `json:"attached"`
	Time         time.Time `json:"time"`
}

type Pool struct {
	mu          sync.RWMutex
	workers     map[string]*Worker
	subscribers map[uint64]func(Event)
	nextID      int
	nextSubID   uint64
	audit       []AuditEntry
	auditID     uint64
	maxAudit    int
}

func NewPool() *Pool {
	return &Pool{workers: make(map[string]*Worker), subscribers: make(map[uint64]func(Event)), nextID: 1, maxAudit: 1000}
}

func (p *Pool) Subscribe(fn func(Event)) func() {
	if fn == nil {
		return func() {}
	}
	p.mu.Lock()
	p.nextSubID++
	id := p.nextSubID
	p.subscribers[id] = fn
	p.mu.Unlock()
	return func() {
		p.mu.Lock()
		delete(p.subscribers, id)
		p.mu.Unlock()
	}
}

func (p *Pool) Spawn(task, modeName string, llmClient *llm.Client, tools *toolset.Registry) (*Worker, error) {
	return p.SpawnWithOptions(task, modeName, llmClient, tools, SpawnOptions{})
}

func (p *Pool) SpawnWithOptions(task, modeName string, llmClient *llm.Client, tools *toolset.Registry, opts SpawnOptions) (*Worker, error) {
	p.mu.Lock()
	id := fmt.Sprintf("w%d", p.nextID)
	p.nextID++
	p.mu.Unlock()

	w, err := NewWithOptions(id, task, modeName, llmClient, tools, opts)
	if err != nil {
		return nil, err
	}
	w.OnLog = func(entry LogEntry) {
		entryCopy := entry
		p.emit(Event{WorkerID: w.ID, Task: w.Task, Mode: w.Mode, ModelProfile: w.ModelProfile, Event: "log", Log: &entryCopy, Attached: w.IsAttached(), Time: entry.Timestamp})
	}
	w.OnStatus = func(status Status) {
		p.emit(Event{WorkerID: w.ID, Task: w.Task, Mode: w.Mode, ModelProfile: w.ModelProfile, Event: "status", Status: status, Attached: w.IsAttached(), Time: time.Now()})
	}

	p.mu.Lock()
	p.workers[id] = w
	p.mu.Unlock()
	p.emit(Event{WorkerID: w.ID, Task: w.Task, Mode: w.Mode, ModelProfile: w.ModelProfile, Event: "created", Status: w.GetStatus(), Attached: w.IsAttached(), Time: time.Now()})

	w.Start()
	return w, nil
}

func (p *Pool) emit(event Event) {
	p.mu.Lock()
	p.auditID++
	eventID := fmt.Sprintf("wevt_%d", p.auditID)
	p.audit = append(p.audit, AuditEntry{
		EventID:      eventID,
		WorkerID:     event.WorkerID,
		Task:         event.Task,
		Mode:         event.Mode,
		ModelProfile: event.ModelProfile,
		Event:        event.Event,
		Status:       event.Status,
		Attached:     event.Attached,
		Time:         event.Time,
	})
	if len(p.audit) > p.maxAudit {
		p.audit = p.audit[len(p.audit)-p.maxAudit:]
	}
	subscribers := make([]func(Event), 0, len(p.subscribers))
	for _, fn := range p.subscribers {
		subscribers = append(subscribers, fn)
	}
	p.mu.Unlock()
	for _, fn := range subscribers {
		fn(event)
	}
}

func (p *Pool) Get(id string) *Worker {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.workers[id]
}

func (p *Pool) List() []*Worker {
	p.mu.RLock()
	defer p.mu.RUnlock()
	list := make([]*Worker, 0, len(p.workers))
	for _, w := range p.workers {
		list = append(list, w)
	}
	return list
}

func (p *Pool) Stop(id string) {
	w := p.Get(id)
	if w != nil {
		w.Stop()
	}
}

func (p *Pool) Attach(id string) bool {
	w := p.Get(id)
	if w == nil {
		return false
	}
	w.Attach()
	p.emit(Event{WorkerID: w.ID, Task: w.Task, Mode: w.Mode, ModelProfile: w.ModelProfile, Event: "attach", Status: w.GetStatus(), Attached: w.IsAttached(), Time: time.Now()})
	return true
}

func (p *Pool) Detach(id string) bool {
	w := p.Get(id)
	if w == nil {
		return false
	}
	w.Detach()
	p.emit(Event{WorkerID: w.ID, Task: w.Task, Mode: w.Mode, ModelProfile: w.ModelProfile, Event: "detach", Status: w.GetStatus(), Attached: w.IsAttached(), Time: time.Now()})
	return true
}

func (p *Pool) Resume(id string) {
	w := p.Get(id)
	if w != nil {
		_ = w.Resume()
	}
}

func (p *Pool) Remove(id string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if _, ok := p.workers[id]; ok {
		delete(p.workers, id)
		return true
	}
	return false
}

func (p *Pool) Cleanup() []string {
	var affected []string
	p.mu.Lock()
	for id, w := range p.workers {
		w.mu.RLock()
		status := w.Status
		w.mu.RUnlock()
		if status == StatusCompleted || status == StatusFailed || status == StatusStopped {
			affected = append(affected, id)
		}
	}
	for _, id := range affected {
		delete(p.workers, id)
	}
	p.mu.Unlock()
	if len(affected) > 0 {
		for _, id := range affected {
			p.emit(Event{WorkerID: id, Event: "cleanup", Status: StatusCompleted, Time: time.Now()})
		}
	}
	return affected
}

func (p *Pool) AuditLog() []AuditEntry {
	p.mu.RLock()
	defer p.mu.RUnlock()
	out := make([]AuditEntry, len(p.audit))
	copy(out, p.audit)
	return out
}

func (p *Pool) Status(id string) *Worker {
	return p.Get(id)
}

func parseArgs(raw string) map[string]any {
	m := make(map[string]any)
	_ = json.Unmarshal([]byte(raw), &m)
	return m
}
