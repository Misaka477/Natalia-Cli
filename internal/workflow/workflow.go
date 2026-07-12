package workflow

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

type Workflow struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description,omitempty"`
	Source      string `yaml:"source,omitempty"`
	Steps       []Step `yaml:"steps"`
}

type Step struct {
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
		return nil, "", fmt.Errorf("workflow %q not found", name)
	}
	state := &RunState{WorkflowName: wf.Name, Source: wf.Source, CurrentStep: 1, TotalSteps: len(wf.Steps), Status: "running"}
	return state, formatRunInstruction(*wf, *state), nil
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
	if err := loadMatches(filepath.Join(workDir, ".natalia", "commands", "*.md"), func(source string, data []byte) (*Workflow, error) {
		return ImportMarkdownCommand(source, string(data))
	}); err != nil {
		return nil, err
	}
	for _, wf := range discoverGeneratedWorkflows(workDir) {
		r.Add(wf)
	}
	return r, nil
}

func discoverGeneratedWorkflows(workDir string) []Workflow {
	var out []Workflow
	if data, err := os.ReadFile(filepath.Join(workDir, "package.json")); err == nil {
		if workflows, err := ImportPackageJSONScripts("package.json", data); err == nil {
			out = append(out, workflows...)
		}
	}
	for _, name := range []string{"Makefile", "makefile"} {
		if data, err := os.ReadFile(filepath.Join(workDir, name)); err == nil {
			if workflows, err := ImportMakefileTargets(name, data); err == nil {
				out = append(out, workflows...)
			}
			break
		}
	}
	if matches, err := filepath.Glob(filepath.Join(workDir, ".github", "workflows", "*.yml")); err == nil {
		sort.Strings(matches)
		for _, match := range matches {
			if data, err := os.ReadFile(match); err == nil {
				if wf, err := ImportGitHubActionsWorkflow(relativeSource(workDir, match), data); err == nil {
					out = append(out, *wf)
				}
			}
		}
	}
	if matches, err := filepath.Glob(filepath.Join(workDir, ".github", "workflows", "*.yaml")); err == nil {
		sort.Strings(matches)
		for _, match := range matches {
			if data, err := os.ReadFile(match); err == nil {
				if wf, err := ImportGitHubActionsWorkflow(relativeSource(workDir, match), data); err == nil {
					out = append(out, *wf)
				}
			}
		}
	}
	return out
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
	body, meta := splitFrontmatter(content)
	name := strings.TrimSpace(meta["name"])
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(source), filepath.Ext(source))
	}
	description := strings.TrimSpace(meta["description"])
	steps := stepsFromMarkdown(body)
	if len(steps) == 0 {
		text := strings.TrimSpace(body)
		if text != "" {
			steps = append(steps, Step{Title: firstLine(text), Prompt: text, Kind: "prompt"})
		}
	}
	return normalize(Workflow{Name: name, Description: description, Source: source, Steps: steps})
}

func ImportPackageJSONScripts(source string, data []byte) ([]Workflow, error) {
	var pkg struct {
		Scripts map[string]string `json:"scripts"`
	}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, fmt.Errorf("parse package.json scripts: %w", err)
	}
	names := make([]string, 0, len(pkg.Scripts))
	for name := range pkg.Scripts {
		names = append(names, name)
	}
	sort.Strings(names)
	out := make([]Workflow, 0, len(names))
	for _, name := range names {
		cmd := strings.TrimSpace(pkg.Scripts[name])
		if cmd == "" {
			continue
		}
		wf, err := normalize(Workflow{Name: "npm-" + slug(name), Description: "package.json script: " + name, Source: source, Steps: []Step{{Title: "Run npm script " + name, Prompt: "Run `npm run " + name + "`\n\nCommand: " + cmd, Kind: "shell"}}})
		if err == nil {
			out = append(out, *wf)
		}
	}
	return out, nil
}

func ImportMakefileTargets(source string, data []byte) ([]Workflow, error) {
	var out []Workflow
	seen := map[string]bool{}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "\t") || strings.HasPrefix(strings.TrimSpace(line), "#") || strings.TrimSpace(line) == "" {
			continue
		}
		name, _, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		name = strings.TrimSpace(name)
		if name == "" || strings.ContainsAny(name, " $(){}") || strings.HasPrefix(name, ".") || seen[name] {
			continue
		}
		seen[name] = true
		wf, err := normalize(Workflow{Name: "make-" + slug(name), Description: "Makefile target: " + name, Source: source, Steps: []Step{{Title: "Run make target " + name, Prompt: "Run `make " + name + "`", Kind: "shell"}}})
		if err == nil {
			out = append(out, *wf)
		}
	}
	return out, nil
}

func ImportGitHubActionsWorkflow(source string, data []byte) (*Workflow, error) {
	var raw struct {
		Name string `yaml:"name"`
		Jobs map[string]struct {
			Name  string `yaml:"name"`
			Steps []struct {
				Name string `yaml:"name"`
				Run  string `yaml:"run"`
				Uses string `yaml:"uses"`
			} `yaml:"steps"`
		} `yaml:"jobs"`
	}
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse GitHub Actions workflow: %w", err)
	}
	name := raw.Name
	if strings.TrimSpace(name) == "" {
		name = strings.TrimSuffix(filepath.Base(source), filepath.Ext(source))
	}
	steps := make([]Step, 0)
	jobNames := make([]string, 0, len(raw.Jobs))
	for jobName := range raw.Jobs {
		jobNames = append(jobNames, jobName)
	}
	sort.Strings(jobNames)
	for _, jobName := range jobNames {
		job := raw.Jobs[jobName]
		jobTitle := job.Name
		if jobTitle == "" {
			jobTitle = jobName
		}
		for i, step := range job.Steps {
			title := strings.TrimSpace(step.Name)
			if title == "" {
				title = fmt.Sprintf("%s step %d", jobTitle, i+1)
			}
			prompt := strings.TrimSpace(step.Run)
			kind := "shell"
			if prompt == "" && step.Uses != "" {
				prompt = "GitHub Action uses: " + strings.TrimSpace(step.Uses)
				kind = "action"
			}
			if prompt == "" {
				continue
			}
			steps = append(steps, Step{Title: jobTitle + ": " + title, Prompt: prompt, Kind: kind})
		}
	}
	return normalize(Workflow{Name: "github-" + slug(name), Description: "GitHub Actions workflow: " + name, Source: source, Steps: steps})
}

func formatRunInstruction(wf Workflow, state RunState) string {
	step := wf.Steps[0]
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

func splitFrontmatter(content string) (string, map[string]string) {
	meta := map[string]string{}
	content = strings.TrimPrefix(content, "\ufeff")
	if !strings.HasPrefix(content, "---") {
		return content, meta
	}
	parts := strings.SplitN(content, "---", 3)
	if len(parts) < 3 {
		return content, meta
	}
	for _, line := range strings.Split(parts[1], "\n") {
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		meta[strings.TrimSpace(strings.ToLower(key))] = strings.Trim(strings.TrimSpace(value), `"'`)
	}
	return strings.TrimSpace(parts[2]), meta
}

var checklistRe = regexp.MustCompile(`^\s*[-*]\s+\[[ xX]\]\s+(.+)$`)

func stepsFromMarkdown(content string) []Step {
	var steps []Step
	var current *Step
	flush := func() {
		if current == nil {
			return
		}
		current.Prompt = strings.TrimSpace(current.Prompt)
		steps = append(steps, *current)
		current = nil
	}
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if match := checklistRe.FindStringSubmatch(line); len(match) == 2 {
			flush()
			current = &Step{Title: strings.TrimSpace(match[1]), Kind: "task"}
			continue
		}
		if strings.HasPrefix(trimmed, "## ") {
			flush()
			current = &Step{Title: strings.TrimSpace(strings.TrimPrefix(trimmed, "## ")), Kind: "task"}
			continue
		}
		if current != nil {
			current.Prompt += line + "\n"
		}
	}
	flush()
	return steps
}

func firstLine(text string) string {
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(strings.TrimPrefix(line, "#"))
		if line != "" {
			return line
		}
	}
	return "Run command"
}

func slug(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var b strings.Builder
	lastDash := false
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash && b.Len() > 0 {
			b.WriteByte('-')
			lastDash = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "script"
	}
	return out
}

func relativeSource(workDir, pathValue string) string {
	if rel, err := filepath.Rel(workDir, pathValue); err == nil && !strings.HasPrefix(rel, "..") {
		return filepath.ToSlash(rel)
	}
	return filepath.ToSlash(pathValue)
}
