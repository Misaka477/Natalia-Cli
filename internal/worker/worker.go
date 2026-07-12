package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

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
	Step      int
	Tool      string
	Args      map[string]any
	Result    string
	Error     string
	Reasoning string
	Timestamp time.Time
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
	mu        sync.RWMutex

	ctx    context.Context
	cancel context.CancelFunc
}

type SpawnOptions struct {
	Timeout time.Duration
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
	w.mu.Lock()
	if w.Engine == nil || w.Engine.Dedup == nil {
		w.Status = StatusFailed
		w.UpdatedAt = time.Now()
		w.mu.Unlock()
		return
	}
	w.Status = StatusRunning
	w.UpdatedAt = time.Now()
	w.mu.Unlock()

	go func() {
		w.Engine.Dedup.ResetTurn()
		for w.Engine.Context.StepCount < w.Engine.Context.MaxSteps {
			if w.ctx.Err() != nil {
				w.mu.Lock()
				w.Status = StatusPaused
				w.UpdatedAt = time.Now()
				w.mu.Unlock()
				return
			}

			cp := w.Engine.Context.SaveCheckpoint()

			outcome := w.Engine.Step(w.ctx)
			if outcome.StopReason == "error" {
				if outcome.FinalMessage == "context canceled" {
					w.mu.Lock()
					w.Status = StatusPaused
					w.UpdatedAt = time.Now()
					w.mu.Unlock()
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
				w.mu.Lock()
				w.Status = StatusFailed
				w.UpdatedAt = time.Now()
				w.mu.Unlock()
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
				w.mu.Lock()
				w.Status = StatusCompleted
				w.UpdatedAt = time.Now()
				w.mu.Unlock()
				w.addLog(LogEntry{
					Step:   w.Engine.Context.StepCount,
					Result: outcome.FinalMessage,
				})
				return
			}
		}
		w.mu.Lock()
		w.Status = StatusCompleted
		w.UpdatedAt = time.Now()
		w.mu.Unlock()
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
	w.mu.Unlock()
}

type Pool struct {
	mu      sync.RWMutex
	workers map[string]*Worker
	nextID  int
}

func NewPool() *Pool {
	return &Pool{workers: make(map[string]*Worker), nextID: 1}
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

	p.mu.Lock()
	p.workers[id] = w
	p.mu.Unlock()

	w.Start()
	return w, nil
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
