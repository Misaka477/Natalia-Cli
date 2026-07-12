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
	ID        string
	Mode      string
	Task      string
	Status    Status
	Engine    *soul.Engine
	Logs      []LogEntry
	CreatedAt time.Time
	UpdatedAt time.Time
	OnLog     func(LogEntry)
	OnStatus  func(Status)
	mu        sync.RWMutex

	ctx    context.Context
	cancel context.CancelFunc
}

type SpawnOptions struct {
	Timeout  time.Duration
	Approver *approval.Approver
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
		ID:        id,
		Mode:      modeName,
		Task:      task,
		Status:    StatusIdle,
		Engine:    eng,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		ctx:       ctx,
		cancel:    cancel,
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
	if w.Engine == nil || w.Engine.Dedup == nil {
		w.setStatus(StatusFailed)
		return
	}
	w.setStatus(StatusRunning)

	go func() {
		w.Engine.Dedup.ResetTurn()
		for w.Engine.Context.StepCount < w.Engine.Context.MaxSteps {
			if w.ctx.Err() != nil {
				w.setStatus(StatusPaused)
				return
			}

			cp := w.Engine.Context.SaveCheckpoint()

			outcome := w.Engine.Step(w.ctx)
			if outcome.StopReason == "error" {
				if outcome.FinalMessage == "context canceled" {
					w.setStatus(StatusPaused)
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
	}()
}

func (w *Worker) Stop() {
	if w.cancel != nil {
		w.cancel()
	}
}

func (w *Worker) Resume() {
	w.ctx, w.cancel = context.WithCancel(context.Background())
	w.Start()
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

type Event struct {
	WorkerID string    `json:"worker_id"`
	Task     string    `json:"task,omitempty"`
	Mode     string    `json:"mode,omitempty"`
	Event    string    `json:"event"`
	Status   Status    `json:"status,omitempty"`
	Log      *LogEntry `json:"log,omitempty"`
	Time     time.Time `json:"time,omitempty"`
}

type Pool struct {
	mu          sync.RWMutex
	workers     map[string]*Worker
	subscribers map[uint64]func(Event)
	nextID      int
	nextSubID   uint64
}

func NewPool() *Pool {
	return &Pool{workers: make(map[string]*Worker), subscribers: make(map[uint64]func(Event)), nextID: 1}
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
		p.emit(Event{WorkerID: w.ID, Task: w.Task, Mode: w.Mode, Event: "log", Log: &entryCopy, Time: entry.Timestamp})
	}
	w.OnStatus = func(status Status) {
		p.emit(Event{WorkerID: w.ID, Task: w.Task, Mode: w.Mode, Event: "status", Status: status, Time: time.Now()})
	}

	p.mu.Lock()
	p.workers[id] = w
	p.mu.Unlock()
	p.emit(Event{WorkerID: w.ID, Task: w.Task, Mode: w.Mode, Event: "created", Status: w.GetStatus(), Time: time.Now()})

	w.Start()
	return w, nil
}

func (p *Pool) emit(event Event) {
	p.mu.RLock()
	subscribers := make([]func(Event), 0, len(p.subscribers))
	for _, fn := range p.subscribers {
		subscribers = append(subscribers, fn)
	}
	p.mu.RUnlock()
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

func (p *Pool) Resume(id string) {
	w := p.Get(id)
	if w != nil {
		w.Resume()
	}
}

func parseArgs(raw string) map[string]any {
	m := make(map[string]any)
	_ = json.Unmarshal([]byte(raw), &m)
	return m
}
