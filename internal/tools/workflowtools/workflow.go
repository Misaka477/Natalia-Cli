package workflowtools

import (
	"fmt"
	"os"
	"path/filepath"
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

type Run struct {
	Registry  *workflowcore.Registry
	StatePath string
}

func (t *Run) Name() string { return "workflow_run" }
func (t *Run) Description() string {
	return "开始执行 workflow，返回当前步骤指令并可持久化运行状态"
}
func (t *Run) Required() []string { return []string{"name"} }
func (t *Run) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"name":       {Type: "string", Description: "workflow 名称"},
		"state_path": {Type: "string", Description: "可选，保存运行状态 JSON 的路径"},
	}
}

func (t *Run) Execute(args map[string]any) (string, error) {
	name, _ := args["name"].(string)
	if strings.TrimSpace(name) == "" {
		return "", fmt.Errorf("name 是必填参数")
	}
	state, instruction, err := registryOrDefault(t.Registry).Run(name)
	if err != nil {
		return "", err
	}
	statePath, _ := args["state_path"].(string)
	if strings.TrimSpace(statePath) == "" {
		statePath = t.StatePath
	}
	if strings.TrimSpace(statePath) != "" {
		clean := filepath.Clean(statePath)
		if !filepath.IsAbs(clean) {
			wd, _ := os.Getwd()
			clean = filepath.Join(wd, clean)
		}
		if err := workflowcore.SaveRunState(clean, *state); err != nil {
			return "", err
		}
		instruction += "\n\nWorkflow state saved to: " + clean
	}
	return instruction, nil
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
