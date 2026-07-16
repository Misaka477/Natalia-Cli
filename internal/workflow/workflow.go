package workflow

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

type Workflow struct {
	Name        string       `yaml:"name"`
	Description string       `yaml:"description,omitempty"`
	Source      string       `yaml:"source,omitempty"`
	Steps       []LegacyStep `yaml:"steps"`
}

type LegacyStep struct {
	ID     string `yaml:"id,omitempty"`
	Title  string `yaml:"title"`
	Prompt string `yaml:"prompt,omitempty"`
	Kind   string `yaml:"kind,omitempty"`
}

type Registry struct {
	workflows   []Workflow
	diagnostics []Diagnostic
}

type Diagnostic struct {
	Source string
	Loaded bool
	Reason string
}

type RunState struct {
	WorkflowName string `json:"workflow_name"`
	Source       string `json:"source,omitempty"`
	CurrentStep  int    `json:"current_step"`
	TotalSteps   int    `json:"total_steps"`
	Status       string `json:"status"`
}

func (wf Workflow) SourceCategory() string {
	source := wf.Source
	if source == "builtin" {
		return "Built-in"
	}
	if strings.Contains(source, ".natalia/workflows/") {
		return "Natalia workflow"
	}
	if strings.Contains(source, ".natalia/commands/") {
		return "Markdown command"
	}
	if strings.Contains(source, ".github/workflows/") {
		return "GitHub Actions"
	}
	if source == "package.json" {
		return "Package script"
	}
	if source == "Makefile" || source == "makefile" {
		return "Make target"
	}
	return "Custom"
}

func (r *Registry) List() []Workflow {
	if r == nil {
		return nil
	}
	return append([]Workflow(nil), r.workflows...)
}

func (r *Registry) Diagnostics() []Diagnostic {
	if r == nil {
		return nil
	}
	return append([]Diagnostic(nil), r.diagnostics...)
}

func (r *Registry) Get(name string) *Workflow {
	if r == nil {
		return nil
	}
	for i := range r.workflows {
		if strings.EqualFold(r.workflows[i].Name, name) {
			wf := r.workflows[i]
			return &wf
		}
	}
	return nil
}

func (r *Registry) Candidates(name string) []Workflow {
	if r == nil || name == "" {
		return nil
	}
	lowerName := strings.ToLower(name)
	var candidates []Workflow
	for i := range r.workflows {
		wf := r.workflows[i]
		lowerWfName := strings.ToLower(wf.Name)
		if strings.HasPrefix(lowerWfName, lowerName) || strings.Contains(lowerWfName, lowerName) {
			candidates = append(candidates, wf)
		}
	}
	return candidates
}

var builtinWorkflows = []Workflow{
	{
		Name:        "builtin-demo",
		Description: "Built-in dry-run demo workflow",
		Source:      "builtin",
		Steps: []LegacyStep{
			{
				ID:     "step-1",
				Title:  "Inspect workspace",
				Prompt: "Inspect the current workspace and report what you find. Do not make any changes.",
				Kind:   "task",
			},
			{
				ID:     "step-2",
				Title:  "Dry-run summary",
				Prompt: "Based on your inspection, summarize what a real workflow might do. This is a dry-run only.",
				Kind:   "task",
			},
		},
	},
}

func Builtin() []Workflow {
	out := make([]Workflow, len(builtinWorkflows))
	copy(out, builtinWorkflows)
	return out
}

func (r *Registry) Add(wf Workflow) {
	if r == nil {
		return
	}
	if r.Get(wf.Name) != nil {
		return
	}
	r.workflows = append(r.workflows, wf)
}

func (r *Registry) Run(name string) (*RunState, string, error) {
	wf := r.Get(name)
	if wf == nil {
		hint := formatNotFoundHint(r.Candidates(name), r.List())
		return nil, "", fmt.Errorf("workflow %q not found. %s", name, hint)
	}
	state := NewRunState(*wf)
	return state, formatRunInstruction(*wf, *state), nil
}

func NewRunState(wf Workflow) *RunState {
	status := "running"
	currentStep := 1
	if len(wf.Steps) == 0 {
		status = "completed"
		currentStep = 0
	}
	return &RunState{WorkflowName: wf.Name, Source: wf.Source, CurrentStep: currentStep, TotalSteps: len(wf.Steps), Status: status}
}

func AdvanceRunState(wf Workflow, state *RunState) error {
	if state == nil {
		return fmt.Errorf("workflow state is required")
	}
	if !strings.EqualFold(state.WorkflowName, wf.Name) {
		return fmt.Errorf("state workflow %q does not match workflow %q", state.WorkflowName, wf.Name)
	}
	if state.Status == "completed" {
		return nil
	}
	if state.TotalSteps == 0 {
		state.TotalSteps = len(wf.Steps)
	}
	if state.CurrentStep <= 0 {
		state.CurrentStep = 1
	}
	if state.CurrentStep >= state.TotalSteps {
		state.CurrentStep = state.TotalSteps
		state.Status = "completed"
		return nil
	}
	state.CurrentStep++
	state.Status = "running"
	return nil
}

func FormatRunInstruction(wf Workflow, state RunState) string {
	return formatRunInstruction(wf, state)
}

func SaveRunState(path string, state RunState) error {
	if strings.TrimSpace(path) == "" {
		return fmt.Errorf("workflow state path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, raw, 0644)
}

func LoadRunState(path string) (*RunState, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var state RunState
	if err := json.Unmarshal(raw, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func Discover(workDir string) (*Registry, error) {
	r := &Registry{}
	loadMatches := func(pattern string, loader func(string, []byte) (*Workflow, error)) error {
		matches, err := filepath.Glob(pattern)
		if err != nil {
			return err
		}
		sort.Strings(matches)
		for _, match := range matches {
			data, err := os.ReadFile(match)
			if err != nil {
				r.diagnostics = append(r.diagnostics, Diagnostic{Source: relativeSource(workDir, match), Loaded: false, Reason: err.Error()})
				continue
			}
			wf, err := loader(relativeSource(workDir, match), data)
			if err == nil {
				r.Add(*wf)
				r.diagnostics = append(r.diagnostics, Diagnostic{Source: relativeSource(workDir, match), Loaded: true})
			} else {
				r.diagnostics = append(r.diagnostics, Diagnostic{Source: relativeSource(workDir, match), Loaded: false, Reason: err.Error()})
			}
		}
		return nil
	}
	if err := loadMatches(filepath.Join(workDir, ".natalia", "workflows", "*.yaml"), func(source string, data []byte) (*Workflow, error) {
		return LoadYAML(source, strings.NewReader(string(data)))
	}); err != nil {
		return nil, err
	}
	if err := loadMatches(filepath.Join(workDir, ".natalia", "workflows", "*.yml"), func(source string, data []byte) (*Workflow, error) {
		return LoadYAML(source, strings.NewReader(string(data)))
	}); err != nil {
		return nil, err
	}
	if matches, err := filepath.Glob(filepath.Join(workDir, ".natalia", "commands", "*.md")); err == nil {
		for _, match := range matches {
			r.diagnostics = append(r.diagnostics, Diagnostic{
				Source: relativeSource(workDir, match),
				Loaded: false,
				Reason: "legacy markdown command import removed: use a native workflow YAML in .natalia/workflows/ instead",
			})
		}
	}
	if data, err := os.ReadFile(filepath.Join(workDir, "package.json")); err == nil {
		var pkg struct {
			Scripts map[string]string `json:"scripts"`
		}
		if json.Unmarshal(data, &pkg) == nil && len(pkg.Scripts) > 0 {
			r.diagnostics = append(r.diagnostics, Diagnostic{
				Source: "package.json",
				Loaded: false,
				Reason: "legacy package.json script import removed: use a native Makefile provider via 'workflow plan Makefile' instead",
			})
		}
	}
	for _, name := range []string{"Makefile", "makefile"} {
		if _, err := os.ReadFile(filepath.Join(workDir, name)); err == nil {
			r.diagnostics = append(r.diagnostics, Diagnostic{
				Source: name,
				Loaded: false,
				Reason: "legacy Makefile target import removed: use the native Makefile provider via 'workflow plan Makefile' instead",
			})
			break
		}
	}
	for _, glob := range []string{filepath.Join(workDir, ".github", "workflows", "*.yml"), filepath.Join(workDir, ".github", "workflows", "*.yaml")} {
		if matches, err := filepath.Glob(glob); err == nil {
			for _, match := range matches {
				r.diagnostics = append(r.diagnostics, Diagnostic{
					Source: relativeSource(workDir, match),
					Loaded: false,
					Reason: "legacy GitHub Actions workflow import removed: use a native workflow YAML in .natalia/workflows/ instead",
				})
			}
		}
	}
	return r, nil
}

func (wf Workflow) Format() string {
	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n", wf.Name)
	if wf.Description != "" {
		fmt.Fprintf(&b, "\n%s\n", wf.Description)
	}
	if wf.Source != "" {
		fmt.Fprintf(&b, "\nSource: %s\n", wf.Source)
	}
	b.WriteString("\nSteps:\n")
	for i, step := range wf.Steps {
		fmt.Fprintf(&b, "%d. %s [%s]\n", i+1, step.Title, step.Kind)
		if step.Prompt != "" {
			fmt.Fprintf(&b, "   %s\n", strings.ReplaceAll(step.Prompt, "\n", "\n   "))
		}
	}
	return strings.TrimSpace(b.String())
}

func LoadYAML(source string, r io.Reader) (*Workflow, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	var wf Workflow
	if err := yaml.Unmarshal(data, &wf); err != nil {
		return nil, fmt.Errorf("parse workflow YAML: %w", err)
	}
	if wf.Source == "" {
		wf.Source = source
	}
	return normalize(wf)
}

func ImportMarkdownCommand(source, content string) (*Workflow, error) {
	return nil, fmt.Errorf("legacy markdown command import removed: create a native workflow YAML in .natalia/workflows/")
}

func ImportPackageJSONScripts(source string, data []byte) ([]Workflow, error) {
	return nil, fmt.Errorf("legacy package.json script import removed: use a native Makefile provider via 'workflow plan Makefile'")
}

func ImportMakefileTargets(source string, data []byte) ([]Workflow, error) {
	return nil, fmt.Errorf("legacy Makefile target import removed: use the native Makefile provider via 'workflow plan Makefile'")
}

func ImportGitHubActionsWorkflow(source string, data []byte) (*Workflow, error) {
	return nil, fmt.Errorf("legacy GitHub Actions workflow import removed: use a native workflow YAML in .natalia/workflows/")
}

func formatRunInstruction(wf Workflow, state RunState) string {
	if len(wf.Steps) == 0 {
		return fmt.Sprintf("Workflow %q has no steps.\ncurrent_step: 0\ntotal_steps: 0\nstatus: completed\nnext_action: no workflow steps remain", wf.Name)
	}
	idx := state.CurrentStep - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(wf.Steps) {
		idx = len(wf.Steps) - 1
	}
	step := wf.Steps[idx]
	var b strings.Builder
	fmt.Fprintf(&b, "Execute workflow %q from %s.\n", wf.Name, displaySource(wf.Source))
	fmt.Fprintf(&b, "Progress: step %d/%d.\n\n", state.CurrentStep, state.TotalSteps)
	fmt.Fprintf(&b, "Current step: %s [%s]\n", step.Title, step.Kind)
	if step.Prompt != "" {
		b.WriteString(step.Prompt)
	}
	return strings.TrimSpace(b.String())
}

func displaySource(source string) string {
	if source == "" {
		return "<unknown>"
	}
	return source
}

func normalize(wf Workflow) (*Workflow, error) {
	wf.Name = strings.TrimSpace(wf.Name)
	if wf.Name == "" {
		return nil, fmt.Errorf("workflow name is required")
	}
	if len(wf.Steps) == 0 {
		return nil, fmt.Errorf("workflow %q has no steps", wf.Name)
	}
	for i := range wf.Steps {
		step := &wf.Steps[i]
		step.Title = strings.TrimSpace(step.Title)
		step.Prompt = strings.TrimSpace(step.Prompt)
		step.Kind = strings.TrimSpace(step.Kind)
		if step.Title == "" {
			return nil, fmt.Errorf("workflow %q step %d title is required", wf.Name, i+1)
		}
		if step.ID == "" {
			step.ID = fmt.Sprintf("step-%d", i+1)
		}
		if step.Kind == "" {
			step.Kind = "task"
		}
	}
	return &wf, nil
}

func relativeSource(workDir, pathValue string) string {
	if rel, err := filepath.Rel(workDir, pathValue); err == nil && !strings.HasPrefix(rel, "..") {
		return filepath.ToSlash(rel)
	}
	return filepath.ToSlash(pathValue)
}

func formatNotFoundHint(candidates []Workflow, all []Workflow) string {
	if len(candidates) > 0 {
		names := make([]string, 0, len(candidates))
		for _, c := range candidates {
			names = append(names, c.Name)
		}
		return "did you mean: " + strings.Join(names, ", ") + "?"
	}
	if len(all) > 0 {
		names := make([]string, 0, len(all))
		for _, item := range all {
			names = append(names, item.Name)
		}
		return "available: " + strings.Join(names, ", ")
	}
	return "add .yaml files to .natalia/workflows/"
}
