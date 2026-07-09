package worker

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/aquama/natalia-cli/internal/chat"
	"github.com/aquama/natalia-cli/internal/llm"
	"github.com/aquama/natalia-cli/internal/rule"
	"github.com/aquama/natalia-cli/internal/soul"
	"github.com/aquama/natalia-cli/internal/toolset"
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
	Rule      string
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

func New(id, task, ruleName string, llmClient *llm.Client, tools *toolset.Registry) (*Worker, error) {
	r, err := rule.Get(ruleName)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithCancel(context.Background())

	eng := soul.NewEngine(llmClient, tools)
	w := &Worker{
		ID:        id,
		Rule:      ruleName,
		Task:      task,
		Status:    StatusIdle,
		Engine:    eng,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		ctx:       ctx,
		cancel:    cancel,
	}

	eng.Rule = r
	if len(eng.Context.Messages) == 0 {
		eng.Context.Messages = append(eng.Context.Messages, chat.Message{
			Role:    chat.RoleSystem,
			Content: r.Prompt,
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
	w.Status = StatusRunning
	w.UpdatedAt = time.Now()
	w.mu.Unlock()

	go func() {
		for w.Engine.Context.StepCount < w.Engine.Context.MaxSteps {
			if w.ctx.Err() != nil {
				w.mu.Lock()
				w.Status = StatusPaused
				w.UpdatedAt = time.Now()
				w.mu.Unlock()
				return
			}

			cp := w.Engine.Context.SaveCheckpoint()

			var msg *chat.Message
			var llmErr error

			outcome := w.Engine.Step(w.ctx)
			if outcome.StopReason == "error" {
				llmErr = fmt.Errorf("%s", outcome.FinalMessage)
			} else {
				msg = &chat.Message{Role: chat.RoleAssistant, Content: outcome.FinalMessage}
			}

			if llmErr != nil {
				if llmErr.Error() == "context canceled" {
					w.mu.Lock()
					w.Status = StatusPaused
					w.UpdatedAt = time.Now()
					w.mu.Unlock()
					return
				}
				w.addLog(LogEntry{
					Step:  w.Engine.Context.StepCount,
					Error: llmErr.Error(),
				})
				if llmErr.Error() == "API error" {
					cp.Restore(w.Engine.Context)
					continue
				}
				w.mu.Lock()
				w.Status = StatusFailed
				w.UpdatedAt = time.Now()
				w.mu.Unlock()
				return
			}

			if msg != nil {
				w.Engine.Context.Messages = append(w.Engine.Context.Messages, *msg)
			}

			if len(msg.ToolCalls) > 0 {
				for _, tc := range msg.ToolCalls {
					w.addLog(LogEntry{
						Step:  w.Engine.Context.StepCount,
						Tool:  tc.Function.Name,
						Args:  parseArgs(tc.Function.Arguments),
					})
				}
				// Execute tool calls (simplified - run each)
				for _, tc := range msg.ToolCalls {
					tool, ok := w.Engine.Tools.Get(tc.Function.Name)
					if !ok {
						continue
					}
					if w.Engine.Rule != nil && !w.Engine.Rule.ToolFilter(tc.Function.Name, parseArgs(tc.Function.Arguments)) {
						w.Engine.Context.Messages = append(w.Engine.Context.Messages, chat.Message{
							Role: chat.RoleTool, ToolCallID: tc.ID,
							Content: fmt.Sprintf("规则 %q 不允许使用 %s", w.Engine.Rule.Name, tc.Function.Name),
							Name:    tc.Function.Name,
						})
						continue
					}
					args := parseArgs(tc.Function.Arguments)
					result, err := tool.Execute(args)
					resultStr := result
					if err != nil {
						resultStr = fmt.Sprintf("错误: %v", err)
					}
					w.Engine.Context.Messages = append(w.Engine.Context.Messages, chat.Message{
						Role: chat.RoleTool, ToolCallID: tc.ID,
						Content: resultStr, Name: tc.Function.Name,
					})
					w.addLog(LogEntry{
						Step: w.Engine.Context.StepCount,
						Tool: tc.Function.Name, Args: args,
						Result: resultStr, Error: errStr(err),
					})
				}
			} else {
				w.mu.Lock()
				w.Status = StatusCompleted
				w.UpdatedAt = time.Now()
				w.mu.Unlock()
				w.addLog(LogEntry{
					Step: w.Engine.Context.StepCount,
					Result: msg.Content,
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

func (p *Pool) Spawn(task, ruleName string, llmClient *llm.Client, tools *toolset.Registry) (*Worker, error) {
	p.mu.Lock()
	id := fmt.Sprintf("w%d", p.nextID)
	p.nextID++
	p.mu.Unlock()

	w, err := New(id, task, ruleName, llmClient, tools)
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
	// Simple JSON-like parser for arguments
	_ = raw
	return m
}

func errStr(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
