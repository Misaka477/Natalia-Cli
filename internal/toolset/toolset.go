package toolset

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/toolreturn"
)

type Tool interface {
	Name() string
	Description() string
	Execute(args map[string]any) (string, error)
	Parameters() map[string]llm.Property
	Required() []string
}

type RichTool interface {
	Tool
	ExecuteReturn(args map[string]any) (toolreturn.Return, error)
}

type ToolReturn = toolreturn.Return

func Execute(t Tool, args map[string]any) (ToolReturn, error) {
	if rich, ok := t.(RichTool); ok {
		ret, err := rich.ExecuteReturn(args)
		if ret.ModelText == "" && len(ret.Display) == 0 && err == nil {
			ret.ModelText = "工具执行完成"
		}
		return ret, err
	}
	text, err := t.Execute(args)
	return toolreturn.Return{ModelText: text, IsError: err != nil}, err
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

func (r *Registry) Filtered(allowed, excluded []string) *Registry {
	allowedSet := stringSet(allowed)
	excludedSet := stringSet(excluded)
	out := NewRegistry()
	r.mu.RLock()
	defer r.mu.RUnlock()
	for name, tool := range r.tools {
		if len(allowedSet) > 0 && !allowedSet[name] {
			continue
		}
		if excludedSet[name] {
			continue
		}
		out.tools[name] = tool
	}
	return out
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
					Required:   nonilRequired(t.Required()),
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

// pollSafeTools are read-only polling tools that should never be dedup-blocked.
var pollSafeTools = map[string]bool{
	"agent_output":           true,
	"agent_list":             true,
	"interactive_read":       true,
	"interactive_transcript": true,
	"interactive_list":       true,
	"interactive_cleanup":    true,
	"process_output":         true,
	"process_list":           true,
	"process_status":         true,
	"background_output":      true,
	"background_list":        true,
	"todo_list":              true,
	"plan_mode_status":       true,
	"workflow_list":          true,
	"workflow_read":          true,
	"skill_list":             true,
	"skill_read":             true,
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
	key := dedupKey(name, args)
	d.repetitions[key]++
	return d.repetitions[key]
}

func dedupKey(name string, args map[string]any) string {
	data, err := json.Marshal(args)
	if err != nil {
		return fmt.Sprintf("%s:%v", name, args)
	}
	return name + ":" + string(data)
}

func (d *Dedup) ResetTurn() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.repetitions = make(map[string]int)
}

func (d *Dedup) Check(name string, args map[string]any) (warn string, stop bool) {
	// Poll-safe tools should never be dedup-blocked
	if pollSafeTools[name] {
		return "", false
	}
	count := d.Count(name, args)
	switch {
	case count >= 12:
		return "[natalia] Repeated tool call blocked: " + name + " called 12+ times with same args", true
	case count >= 8:
		return "[natalia] Repeated tool call: " + name + " (" + fmt.Sprint(count) + "x) — stop and reassess", false
	case count >= 5:
		return "[natalia] Repeated tool call: " + name + " (" + fmt.Sprint(count) + "x) — check if stuck", false
	case count >= 3:
		return "[natalia] Repeated tool call: " + name + " (" + fmt.Sprint(count) + "x)", false
	}
	return "", false
}

func nonilRequired(req []string) []string {
	if req == nil {
		return []string{}
	}
	return req
}
