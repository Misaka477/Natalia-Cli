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
	defaultRegistry = r
}

type Run struct {
	Registry  *workflowcore.Registry
	StatePath string
}

func (t *Run) Name() string { return "workflow_run" }
func (t *Run) Description() string {
	return "start executing a workflow and return the current step instruction; dry_run=true previews safely, dry_run=false initializes real execution state and may lead to workspace reads/writes or commands depending on workflow steps"
}
func (t *Run) Required() []string { return []string{"name"} }
func (t *Run) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"name":       {Type: "string", Description: "workflow name"},
		"state_path": {Type: "string", Description: "optional, path to save run state JSON"},
		"dry_run":    {Type: "boolean", Description: "optional, preview without initializing real execution state when true; use true for audits/automation unless side effects are intended"},
	}
}

func (t *Run) Execute(args map[string]any) (string, error) {
	refreshDefaultRegistry()
	name, _ := args["name"].(string)
	if strings.TrimSpace(name) == "" {
		return "", fmt.Errorf("name is required")
	}

	dryRun := false
	if d, ok := args["dry_run"].(bool); ok {
		dryRun = d
	}

	if dryRun {
		wf := registryOrDefault(t.Registry).Get(name)
		if wf == nil {
			candidates := registryOrDefault(t.Registry).Candidates(name)
			return "", fmt.Errorf("workflow %q not found. %s", name, workflowHint(registryOrDefault(t.Registry), candidates))
		}
		return fmt.Sprintf("[dry-run] Workflow %q has %d steps.\n%s", wf.Name, len(wf.Steps), wf.Format()), nil
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

// refreshDefaultRegistry re-scans .natalia/workflows/ and .natalia/commands/
// from the current working directory and replaces the default registry.
// This ensures newly added workflow files are discovered without a restart.
func refreshDefaultRegistry() {
	defaultMu.Lock()
	defer defaultMu.Unlock()
	wd, err := os.Getwd()
	if err != nil {
		return
	}
	r, err := workflowcore.Discover(wd)
	if err == nil {
		for _, wf := range workflowcore.Builtin() {
			r.Add(wf)
		}
		defaultRegistry = r
	}
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
func (t *List) Description() string { return "list imported Natalia workflows" }
func (t *List) Required() []string  { return []string{} }
func (t *List) Parameters() map[string]llm.Property {
	return map[string]llm.Property{}
}

func (t *List) Execute(args map[string]any) (string, error) {
	refreshDefaultRegistry()
	items := registryOrDefault(t.Registry).List()
	if len(items) == 0 {
		return "no workflows available. " + workflowHint(registryOrDefault(t.Registry), nil), nil
	}
	var b strings.Builder
	for _, wf := range items {
		desc := wf.Description
		if desc == "" {
			desc = wf.Source
		}
		fmt.Fprintf(&b, "- %s [%s]: %s (%d steps)\n", wf.Name, wf.SourceCategory(), desc, len(wf.Steps))
	}
	return strings.TrimSpace(b.String()), nil
}

type Read struct {
	Registry *workflowcore.Registry
}

func (t *Read) Name() string        { return "workflow_read" }
func (t *Read) Description() string { return "read the canonical Natalia representation of a workflow" }
func (t *Read) Required() []string  { return []string{"name"} }
func (t *Read) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"name": {Type: "string", Description: "workflow name"}}
}

func (t *Read) Execute(args map[string]any) (string, error) {
	refreshDefaultRegistry()
	name, _ := args["name"].(string)
	if strings.TrimSpace(name) == "" {
		return "", fmt.Errorf("name is required")
	}
	wf := registryOrDefault(t.Registry).Get(name)
	if wf == nil {
		candidates := registryOrDefault(t.Registry).Candidates(name)
		return "", fmt.Errorf("workflow %s not found. %s", name, workflowHint(registryOrDefault(t.Registry), candidates))
	}
	return wf.Format(), nil
}

func workflowHint(r *workflowcore.Registry, candidates []workflowcore.Workflow) string {
	if len(candidates) > 0 {
		names := make([]string, 0, len(candidates))
		for _, c := range candidates {
			names = append(names, c.Name)
		}
		return "did you mean: " + strings.Join(names, ", ") + "?"
	}
	items := r.List()
	if len(items) > 0 {
		names := make([]string, 0, len(items))
		for _, item := range items {
			names = append(names, item.Name)
		}
		return "available: " + strings.Join(names, ", ")
	}
	return "add .yaml files to .natalia/workflows/ or .md files to .natalia/commands/; package.json scripts and Makefile targets are also imported automatically."
}
