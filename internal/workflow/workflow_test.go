package workflow

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadYAMLBuildsCanonicalWorkflow(t *testing.T) {
	wf, err := LoadYAML("natalia.yaml", strings.NewReader(`
name: bugfix
description: Fix a bug safely
steps:
  - title: Reproduce
    prompt: Run the failing test
  - id: patch
    title: Patch
    kind: code
`))
	if err != nil {
		t.Fatal(err)
	}
	if wf.Name != "bugfix" || wf.Source != "natalia.yaml" || len(wf.Steps) != 2 {
		t.Fatalf("unexpected workflow: %+v", wf)
	}
	if wf.Steps[0].ID != "step-1" || wf.Steps[0].Kind != "task" || wf.Steps[1].ID != "patch" || wf.Steps[1].Kind != "code" {
		t.Fatalf("unexpected normalized steps: %+v", wf.Steps)
	}
}

func TestImportMarkdownCommandConvertsChecklistToCanonicalWorkflow(t *testing.T) {
	wf, err := ImportMarkdownCommand(".tool/commands/review.md", `---
name: review
description: Review code
---

# Review Command

- [ ] Inspect diff
Use git diff and identify risky changes.

- [ ] Report findings
List bugs first.
`)
	if err != nil {
		t.Fatal(err)
	}
	if wf.Name != "review" || wf.Description != "Review code" || wf.Source != ".tool/commands/review.md" || len(wf.Steps) != 2 {
		t.Fatalf("unexpected imported workflow: %+v", wf)
	}
	if wf.Steps[0].Title != "Inspect diff" || !strings.Contains(wf.Steps[0].Prompt, "git diff") || wf.Steps[1].Title != "Report findings" {
		t.Fatalf("unexpected imported steps: %+v", wf.Steps)
	}
}

func TestImportMarkdownCommandFallsBackToSinglePromptStep(t *testing.T) {
	wf, err := ImportMarkdownCommand("commands/explain.md", "Explain the selected code clearly.")
	if err != nil {
		t.Fatal(err)
	}
	if wf.Name != "explain" || len(wf.Steps) != 1 || wf.Steps[0].Title != "Explain the selected code clearly." || wf.Steps[0].Kind != "prompt" {
		t.Fatalf("unexpected fallback workflow: %+v", wf)
	}
}

func TestWorkflowValidationRejectsMissingRequiredFields(t *testing.T) {
	if _, err := LoadYAML("bad.yaml", strings.NewReader("steps: []")); err == nil || !strings.Contains(err.Error(), "name is required") {
		t.Fatalf("expected missing name error, got %v", err)
	}
	if _, err := LoadYAML("bad.yaml", strings.NewReader("name: empty\nsteps: []")); err == nil || !strings.Contains(err.Error(), "has no steps") {
		t.Fatalf("expected no steps error, got %v", err)
	}
}

func TestDiscoverLoadsNataliaYAMLAndMarkdownCommandWorkflows(t *testing.T) {
	workDir := t.TempDir()
	workflowDir := filepath.Join(workDir, ".natalia", "workflows")
	commandDir := filepath.Join(workDir, ".natalia", "commands")
	if err := os.MkdirAll(workflowDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(commandDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workflowDir, "release.yaml"), []byte(`name: release
description: Ship safely
steps:
  - title: Run tests
`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(commandDir, "review.md"), []byte(`---
description: Review changes
---
- [ ] Inspect diff
- [ ] Report findings
`), 0644); err != nil {
		t.Fatal(err)
	}

	r, err := Discover(workDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.List()) != 2 {
		t.Fatalf("expected two workflows, got %+v", r.List())
	}
	release := r.Get("release")
	if release == nil || release.Source != ".natalia/workflows/release.yaml" || release.Steps[0].Title != "Run tests" {
		t.Fatalf("unexpected release workflow: %+v", release)
	}
	review := r.Get("review")
	if review == nil || review.Source != ".natalia/commands/review.md" || len(review.Steps) != 2 || review.Steps[0].Title != "Inspect diff" {
		t.Fatalf("unexpected review workflow: %+v", review)
	}
	formatted := review.Format()
	if !strings.Contains(formatted, "# review") || !strings.Contains(formatted, "Inspect diff") || !strings.Contains(formatted, "Source: .natalia/commands/review.md") {
		t.Fatalf("unexpected formatted workflow: %q", formatted)
	}
}

func TestImportPackageJSONScriptsBuildsShellWorkflows(t *testing.T) {
	workflows, err := ImportPackageJSONScripts("package.json", []byte(`{"scripts":{"test":"go test ./...","lint":"go vet ./...","empty":""}}`))
	if err != nil {
		t.Fatal(err)
	}
	if len(workflows) != 2 || workflows[0].Name != "npm-lint" || workflows[1].Name != "npm-test" {
		t.Fatalf("unexpected package workflows: %+v", workflows)
	}
	if workflows[1].Steps[0].Kind != "shell" || !strings.Contains(workflows[1].Steps[0].Prompt, "npm run test") || !strings.Contains(workflows[1].Steps[0].Prompt, "go test ./...") {
		t.Fatalf("unexpected package workflow step: %+v", workflows[1].Steps)
	}
}

func TestImportMakefileTargetsBuildsShellWorkflows(t *testing.T) {
	workflows, err := ImportMakefileTargets("Makefile", []byte("# comment\nbuild: deps\n\tgo build ./...\n.PHONY: test\ntest:\n\tgo test ./...\n"))
	if err != nil {
		t.Fatal(err)
	}
	if len(workflows) != 2 || workflows[0].Name != "make-build" || workflows[1].Name != "make-test" {
		t.Fatalf("unexpected Makefile workflows: %+v", workflows)
	}
	if workflows[0].Steps[0].Kind != "shell" || !strings.Contains(workflows[0].Steps[0].Prompt, "make build") {
		t.Fatalf("unexpected Makefile workflow step: %+v", workflows[0].Steps)
	}
}

func TestDiscoverIncludesPackageScriptsAndMakefileTargets(t *testing.T) {
	workDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(workDir, "package.json"), []byte(`{"scripts":{"test":"go test ./..."}}`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workDir, "Makefile"), []byte("build:\n\tgo build ./...\n"), 0644); err != nil {
		t.Fatal(err)
	}
	r, err := Discover(workDir)
	if err != nil {
		t.Fatal(err)
	}
	if r.Get("npm-test") == nil || r.Get("make-build") == nil {
		t.Fatalf("expected generated workflows from package scripts and Makefile, got %+v", r.List())
	}
}

func TestImportGitHubActionsWorkflowBuildsCanonicalShellSteps(t *testing.T) {
	wf, err := ImportGitHubActionsWorkflow(".github/workflows/ci.yml", []byte(`name: CI
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: go test ./...
`))
	if err != nil {
		t.Fatal(err)
	}
	if wf.Name != "github-ci" || wf.Source != ".github/workflows/ci.yml" || len(wf.Steps) != 2 {
		t.Fatalf("unexpected GitHub workflow: %+v", wf)
	}
	if wf.Steps[0].Kind != "action" || !strings.Contains(wf.Steps[0].Prompt, "actions/checkout") || wf.Steps[1].Kind != "shell" || !strings.Contains(wf.Steps[1].Prompt, "go test") {
		t.Fatalf("unexpected GitHub workflow steps: %+v", wf.Steps)
	}
}

func TestDiscoverIncludesGitHubActionsAndDiagnostics(t *testing.T) {
	workDir := t.TempDir()
	dir := filepath.Join(workDir, ".github", "workflows")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "ci.yml"), []byte("name: CI\njobs:\n  test:\n    steps:\n      - run: go test ./...\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(workDir, ".natalia", "workflows"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workDir, ".natalia", "workflows", "bad.yaml"), []byte("name: bad\nsteps: ["), 0644); err != nil {
		t.Fatal(err)
	}
	r, err := Discover(workDir)
	if err != nil {
		t.Fatal(err)
	}
	if r.Get("github-ci") == nil {
		t.Fatalf("expected GitHub Actions workflow, got %+v", r.List())
	}
	foundBad := false
	for _, diag := range r.Diagnostics() {
		if diag.Source == ".natalia/workflows/bad.yaml" && !diag.Loaded && strings.Contains(diag.Reason, "parse") {
			foundBad = true
		}
	}
	if !foundBad {
		t.Fatalf("expected bad workflow diagnostic, got %+v", r.Diagnostics())
	}
}

func TestWorkflowSourceCategory(t *testing.T) {
	tests := []struct {
		source   string
		expected string
	}{
		{".natalia/workflows/release.yaml", "Natalia workflow"},
		{".natalia/commands/review.md", "Markdown command"},
		{".github/workflows/ci.yml", "GitHub Actions"},
		{"package.json", "Package script"},
		{"Makefile", "Make target"},
		{"makefile", "Make target"},
		{"custom/path/workflow.yaml", "Custom"},
		{"builtin", "Built-in"},
	}
	for _, tc := range tests {
		wf := Workflow{Name: "test", Source: tc.source, Steps: []Step{{Title: "Step 1"}}}
		if got := wf.SourceCategory(); got != tc.expected {
			t.Errorf("SourceCategory(%q) = %q, want %q", tc.source, got, tc.expected)
		}
	}
}

func TestWorkflowRunAndStatePersistence(t *testing.T) {
	r := &Registry{}
	r.Add(Workflow{Name: "release", Source: ".natalia/workflows/release.yaml", Steps: []Step{{ID: "step-1", Title: "Test", Prompt: "Run tests", Kind: "shell"}}})
	state, instruction, err := r.Run("release")
	if err != nil {
		t.Fatal(err)
	}
	if state.WorkflowName != "release" || state.CurrentStep != 1 || state.TotalSteps != 1 || !strings.Contains(instruction, "Run tests") {
		t.Fatalf("unexpected run state/instruction: %+v %q", state, instruction)
	}
	path := filepath.Join(t.TempDir(), "state.json")
	if err := SaveRunState(path, *state); err != nil {
		t.Fatal(err)
	}
	loaded, err := LoadRunState(path)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.WorkflowName != "release" || loaded.Status != "running" {
		t.Fatalf("unexpected loaded workflow state: %+v", loaded)
	}
}

func TestAdvanceRunState(t *testing.T) {
	wf := Workflow{Name: "release", Source: ".natalia/workflows/release.yaml", Steps: []Step{{ID: "step-1", Title: "Test"}, {ID: "step-2", Title: "Ship"}}}
	state := NewRunState(wf)
	if state.CurrentStep != 1 || state.TotalSteps != 2 || state.Status != "running" {
		t.Fatalf("unexpected initial state: %+v", state)
	}
	if err := AdvanceRunState(wf, state); err != nil {
		t.Fatal(err)
	}
	if state.CurrentStep != 2 || state.Status != "running" {
		t.Fatalf("expected step 2 running, got %+v", state)
	}
	if err := AdvanceRunState(wf, state); err != nil {
		t.Fatal(err)
	}
	if state.CurrentStep != 2 || state.Status != "completed" {
		t.Fatalf("expected completed at final step, got %+v", state)
	}
	if err := AdvanceRunState(Workflow{Name: "other", Steps: []Step{{Title: "x"}}}, state); err == nil || !strings.Contains(err.Error(), "does not match") {
		t.Fatalf("expected workflow mismatch error, got %v", err)
	}
}

func TestRegistryCandidates(t *testing.T) {
	r := &Registry{}
	r.Add(Workflow{Name: "release", Source: ".natalia/workflows/release.yaml", Steps: []Step{{Title: "Test"}}})
	r.Add(Workflow{Name: "review", Source: ".natalia/commands/review.md", Steps: []Step{{Title: "Inspect"}}})
	r.Add(Workflow{Name: "releasenotes", Source: ".natalia/workflows/releasenotes.yaml", Steps: []Step{{Title: "Notes"}}})

	tests := []struct {
		query     string
		wantCount int
		wantNames []string
	}{
		{"release", 2, []string{"release", "releasenotes"}},
		{"relea", 2, []string{"release", "releasenotes"}},
		{"view", 1, []string{"review"}},
		{"missing", 0, nil},
		{"", 0, nil},
	}
	for _, tc := range tests {
		got := r.Candidates(tc.query)
		if len(got) != tc.wantCount {
			t.Fatalf("Candidates(%q) count = %d, want %d", tc.query, len(got), tc.wantCount)
		}
		for i, name := range tc.wantNames {
			if got[i].Name != name {
				t.Fatalf("Candidates(%q)[%d].Name = %q, want %q", tc.query, i, got[i].Name, name)
			}
		}
	}
}

func TestBuiltinDemoWorkflow(t *testing.T) {
	builtins := Builtin()
	if len(builtins) != 1 {
		t.Fatalf("expected 1 builtin workflow, got %d", len(builtins))
	}
	wf := builtins[0]
	if wf.Name != "builtin-demo" {
		t.Fatalf("expected builtin-demo, got %s", wf.Name)
	}
	if wf.Source != "builtin" {
		t.Fatalf("expected source builtin, got %s", wf.Source)
	}
	if wf.SourceCategory() != "Built-in" {
		t.Fatalf("expected Built-in category, got %s", wf.SourceCategory())
	}
	if len(wf.Steps) != 2 {
		t.Fatalf("expected 2 steps, got %d", len(wf.Steps))
	}
	if wf.Steps[0].Kind != "task" || wf.Steps[1].Kind != "task" {
		t.Fatalf("expected task steps")
	}
}
