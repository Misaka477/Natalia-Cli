package workflowtools

import (
	"fmt"
	"strings"
	"sync"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
	workflowcore "github.com/Misaka477/Natalia-Cli/internal/workflow"
)

var (
	defaultMu       sync.RWMutex
	defaultRegistry = &workflowcore.Registry{}
)

func SetDefaultRegistry(r *workflowcore.Registry) {
	defaultMu.Lock()
	defer defaultMu.Unlock()
	if r == nil {
		r = &workflowcore.Registry{}
	}
	defaultRegistry = r
}

func registryOrDefault(r *workflowcore.Registry) *workflowcore.Registry {
	if r != nil {
		return r
	}
	defaultMu.RLock()
	defer defaultMu.RUnlock()
	return defaultRegistry
}

type List struct {
	Registry *workflowcore.Registry
}

func (t *List) Name() string        { return "workflow_list" }
func (t *List) Description() string { return "列出已导入的 Natalia workflow" }
func (t *List) Required() []string  { return []string{} }
func (t *List) Parameters() map[string]llm.Property {
	return map[string]llm.Property{}
}

func (t *List) Execute(args map[string]any) (string, error) {
	items := registryOrDefault(t.Registry).List()
	if len(items) == 0 {
		return "没有可用的 workflow", nil
	}
	var b strings.Builder
	for _, wf := range items {
		desc := wf.Description
		if desc == "" {
			desc = wf.Source
		}
		fmt.Fprintf(&b, "- %s: %s (%d steps)\n", wf.Name, desc, len(wf.Steps))
	}
	return strings.TrimSpace(b.String()), nil
}

type Read struct {
	Registry *workflowcore.Registry
}

func (t *Read) Name() string        { return "workflow_read" }
func (t *Read) Description() string { return "读取某个 workflow 的 canonical Natalia 表示" }
func (t *Read) Required() []string  { return []string{"name"} }
func (t *Read) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"name": {Type: "string", Description: "workflow 名称"}}
}

func (t *Read) Execute(args map[string]any) (string, error) {
	name, _ := args["name"].(string)
	if strings.TrimSpace(name) == "" {
		return "", fmt.Errorf("name 是必填参数")
	}
	wf := registryOrDefault(t.Registry).Get(name)
	if wf == nil {
		return "", fmt.Errorf("workflow %s 不存在", name)
	}
	return wf.Format(), nil
}
