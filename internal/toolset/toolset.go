package toolset

import (
	"fmt"
	"sync"

	"github.com/aquama/natalia-cli/internal/chat"
	"github.com/aquama/natalia-cli/internal/llm"
)

type Tool interface {
	Name() string
	Description() string
	Execute(args map[string]any) (string, error)
	Parameters() map[string]llm.Property
	Required() []string
}

type Registry struct {
	mu    sync.RWMutex
	tools map[string]Tool
}

func NewRegistry() *Registry {
	return &Registry{
		tools: make(map[string]Tool),
	}
}

func (r *Registry) Register(t Tool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tools[t.Name()] = t
}

func (r *Registry) Get(name string) (Tool, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.tools[name]
	return t, ok
}

func (r *Registry) List() []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]Tool, 0, len(r.tools))
	for _, t := range r.tools {
		list = append(list, t)
	}
	return list
}

func (r *Registry) ToToolDefs() []llm.ToolDef {
	r.mu.RLock()
	defer r.mu.RUnlock()
	defs := make([]llm.ToolDef, 0, len(r.tools))
	for _, t := range r.tools {
		props := t.Parameters()
		if props == nil {
			props = make(map[string]llm.Property)
		}
		defs = append(defs, llm.ToolDef{
			Type: "function",
			Function: llm.Function{
				Name:        t.Name(),
				Description: t.Description(),
				Parameters: llm.Parameters{
					Type:       "object",
					Properties: props,
					Required:   t.Required(),
				},
			},
		})
	}
	return defs
}

type Dedup struct {
	mu          sync.Mutex
	history     []chat.ToolResult
	repetitions map[string]int
}

func NewDedup() *Dedup {
	return &Dedup{
		history:     make([]chat.ToolResult, 0),
		repetitions: make(map[string]int),
	}
}

func (d *Dedup) Record(name string, args map[string]any, result, errMsg string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.history = append(d.history, chat.ToolResult{
		Name: name, Args: args, Result: result, Error: errMsg,
	})
}

func (d *Dedup) Count(name string, args map[string]any) int {
	d.mu.Lock()
	defer d.mu.Unlock()
	key := fmt.Sprintf("%s:%v", name, args)
	d.repetitions[key]++
	return d.repetitions[key]
}

func (d *Dedup) ResetTurn() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.repetitions = make(map[string]int)
}

func (d *Dedup) Check(name string, args map[string]any) (warn string, stop bool) {
	count := d.Count(name, args)
	switch {
	case count >= 12:
		return "强制终止：重复工具调用 12 次", true
	case count >= 8:
		return fmt.Sprintf("⚠️ 你已重复 %s %d 次，立即停止所有工具调用", name, count), false
	case count >= 5:
		return fmt.Sprintf("⚠️ 你已重复 %s %d 次，注意", name, count), false
	case count >= 3:
		return fmt.Sprintf("➡️ 你已重复 %s %d 次，请检查", name, count), false
	}
	return "", false
}
