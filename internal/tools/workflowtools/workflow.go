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
	return "start or advance a workflow and return explicit state. dry_run=true previews safely. dry_run=false with action=start initializes real execution state and may lead to workspace reads/writes or commands depending on workflow steps. Use action=status to inspect state, action=complete_step after finishing the current step, or action=restart to reset."
}
func (t *Run) Required() []string { return []string{"name"} }
func (t *Run) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"name":       {Type: "string", Description: "workflow name"},
		"state_path": {Type: "string", Description: "optional, path to load/save run state JSON; required to persist and advance a multi-step run across calls"},
		"dry_run":    {Type: "boolean", Description: "optional, preview without initializing real execution state when true; use true for audits/automation unless side effects are intended"},
		"action":     {Type: "string", Enum: []string{"start", "status", "complete_step", "restart"}, Description: "optional, default start. start resumes existing state_path if present or initializes; status only reports current state; complete_step marks the current step done and advances; restart resets state to step 1."},
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

	wf := registryOrDefault(t.Registry).Get(name)
	if wf == nil {
		candidates := registryOrDefault(t.Registry).Candidates(name)
		return "", fmt.Errorf("workflow %q not found. %s", name, workflowHint(registryOrDefault(t.Registry), candidates))
	}
	action := strings.TrimSpace(stringArg(args["action"], "start"))
	if action == "" {
		action = "start"
	}
	statePath, _ := args["state_path"].(string)
	if strings.TrimSpace(statePath) == "" {
		statePath = t.StatePath
	}
	statePath = cleanStatePath(statePath)
	state, loaded, err := loadWorkflowState(statePath)
	if err != nil {
		return "", err
	}
	if loaded && !strings.EqualFold(state.WorkflowName, wf.Name) && action != "restart" {
		return "", fmt.Errorf("state_path belongs to workflow %q, not %q; use the matching workflow name or action=restart to reset", state.WorkflowName, wf.Name)
	}
	if !loaded || action == "restart" {
		state = workflowcore.NewRunState(*wf)
	}
	saveState := action != "status"
	switch action {
	case "start":
		// Existing state is intentionally resumed; new state starts at step 1.
	case "status":
		if state == nil {
			state = workflowcore.NewRunState(*wf)
		}
	case "complete_step":
		if err := workflowcore.AdvanceRunState(*wf, state); err != nil {
			return "", err
		}
	case "restart":
		// State already reset above.
	default:
		return "", fmt.Errorf("invalid action %q; valid actions: start, status, complete_step, restart", action)
	}
	instruction := formatRunOutput(*wf, *state, action, loaded, statePath)
	if strings.TrimSpace(statePath) != "" {
		if saveState {
			if err := workflowcore.SaveRunState(statePath, *state); err != nil {
				return "", err
			}
		}
	}
	return instruction, nil
}

func stringArg(raw any, fallback string) string {
	if value, ok := raw.(string); ok {
		return value
	}
	return fallback
}

func cleanStatePath(statePath string) string {
	if strings.TrimSpace(statePath) == "" {
		return ""
	}
	clean := filepath.Clean(statePath)
	if !filepath.IsAbs(clean) {
		wd, _ := os.Getwd()
		clean = filepath.Join(wd, clean)
	}
	return clean
}

func loadWorkflowState(statePath string) (*workflowcore.RunState, bool, error) {
	if strings.TrimSpace(statePath) == "" {
		return nil, false, nil
	}
	state, err := workflowcore.LoadRunState(statePath)
	if err == nil {
		return state, true, nil
	}
	if os.IsNotExist(err) {
		return nil, false, nil
	}
	return nil, false, fmt.Errorf("load workflow state: %w", err)
}

func formatRunOutput(wf workflowcore.Workflow, state workflowcore.RunState, action string, loaded bool, statePath string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "workflow: %s\n", wf.Name)
	fmt.Fprintf(&b, "action: %s\n", action)
	fmt.Fprintf(&b, "status: %s\n", state.Status)
	fmt.Fprintf(&b, "current_step: %d\n", state.CurrentStep)
	fmt.Fprintf(&b, "total_steps: %d\n", state.TotalSteps)
	if statePath != "" {
		fmt.Fprintf(&b, "state_path: %s\n", statePath)
		if loaded {
			b.WriteString("state_loaded: true\n")
		} else {
			b.WriteString("state_loaded: false\n")
		}
	} else {
		b.WriteString("state_path: <not persisted>\n")
	}
	if state.Status == "completed" {
		b.WriteString("next_action: workflow complete; no more steps remain\n")
		return strings.TrimSpace(b.String())
	}
	if statePath == "" {
		b.WriteString("next_action: execute the current step, then call workflow_run with action=complete_step; provide state_path to persist multi-step progress across calls\n\n")
	} else {
		b.WriteString("next_action: execute the current step, then call workflow_run with action=complete_step and the same state_path\n\n")
	}
	b.WriteString(workflowcore.FormatRunInstruction(wf, state))
	return strings.TrimSpace(b.String())
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
