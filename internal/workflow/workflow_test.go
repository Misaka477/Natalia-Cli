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

func TestImportMarkdownCommandStubReturnsMigrationError(t *testing.T) {
	_, err := ImportMarkdownCommand("commands/review.md", "# old content")
	if err == nil || !strings.Contains(err.Error(), "legacy") {
		t.Fatalf("expected legacy migration error, got %v", err)
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

func TestDiscoverLoadsNataliaYAMLAndReportsMarkdownCommandMigration(t *testing.T) {
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
	if len(r.List()) != 1 {
		t.Fatalf("expected one workflow, got %+v", r.List())
	}
	release := r.Get("release")
	if release == nil || release.Source != ".natalia/workflows/release.yaml" || release.Steps[0].Title != "Run tests" {
		t.Fatalf("unexpected release workflow: %+v", release)
	}
	foundMigration := false
	for _, diag := range r.Diagnostics() {
		if strings.Contains(diag.Source, "review.md") && strings.Contains(diag.Reason, "legacy") {
			foundMigration = true
			break
		}
	}
	if !foundMigration {
		t.Fatalf("expected migration diagnostic for legacy command, got %+v", r.Diagnostics())
	}
}

func TestImportPackageJSONScriptsStubReturnsMigrationError(t *testing.T) {
	_, err := ImportPackageJSONScripts("package.json", []byte(`{"scripts":{"test":"go test ./..."}}`))
	if err == nil || !strings.Contains(err.Error(), "legacy") {
		t.Fatalf("expected legacy migration error, got %v", err)
	}
}

func TestImportMakefileTargetsStubReturnsMigrationError(t *testing.T) {
	_, err := ImportMakefileTargets("Makefile", []byte("build:\n\tgo build ./...\n"))
	if err == nil || !strings.Contains(err.Error(), "legacy") {
		t.Fatalf("expected legacy migration error, got %v", err)
	}
}

func TestDiscoverReportsPackageScriptAndMakefileMigrationDiagnostics(t *testing.T) {
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
	if len(r.List()) != 0 {
		t.Fatalf("expected no workflows from legacy imports, got %d", len(r.List()))
	}
	foundPkg := false
	foundMake := false
	for _, diag := range r.Diagnostics() {
		if diag.Source == "package.json" && strings.Contains(diag.Reason, "legacy") {
			foundPkg = true
		}
		if diag.Source == "Makefile" && strings.Contains(diag.Reason, "legacy") {
			foundMake = true
		}
	}
	if !foundPkg {
		t.Fatalf("expected migration diagnostic for package.json, got %+v", r.Diagnostics())
	}
	if !foundMake {
		t.Fatalf("expected migration diagnostic for Makefile, got %+v", r.Diagnostics())
	}
}

func TestImportGitHubActionsWorkflowStubReturnsMigrationError(t *testing.T) {
	_, err := ImportGitHubActionsWorkflow(".github/workflows/ci.yml", []byte("name: CI\njobs:\n  test:\n    steps:\n      - run: go test ./...\n"))
	if err == nil || !strings.Contains(err.Error(), "legacy") {
		t.Fatalf("expected legacy migration error, got %v", err)
	}
}

func TestDiscoverReportsGitHubActionsMigrationAndNativeDiagnostics(t *testing.T) {
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
	if r.Get("github-ci") != nil {
		t.Fatalf("expected no GitHub Actions workflow, got %+v", r.List())
	}
	foundBad := false
	foundGHA := false
	for _, diag := range r.Diagnostics() {
		if diag.Source == ".natalia/workflows/bad.yaml" && !diag.Loaded && strings.Contains(diag.Reason, "parse") {
			foundBad = true
		}
		if strings.Contains(diag.Source, ".github/workflows/ci.yml") && strings.Contains(diag.Reason, "legacy") {
			foundGHA = true
		}
	}
	if !foundBad {
		t.Fatalf("expected bad workflow diagnostic, got %+v", r.Diagnostics())
	}
	if !foundGHA {
		t.Fatalf("expected GitHub Actions migration diagnostic, got %+v", r.Diagnostics())
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
		wf := Workflow{Name: "test", Source: tc.source, Steps: []LegacyStep{{Title: "Step 1"}}}
		if got := wf.SourceCategory(); got != tc.expected {
			t.Errorf("SourceCategory(%q) = %q, want %q", tc.source, got, tc.expected)
		}
	}
}

func TestWorkflowRunAndStatePersistence(t *testing.T) {
	r := &Registry{}
	r.Add(Workflow{Name: "release", Source: ".natalia/workflows/release.yaml", Steps: []LegacyStep{{ID: "step-1", Title: "Test", Prompt: "Run tests", Kind: "shell"}}})
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
	wf := Workflow{Name: "release", Source: ".natalia/workflows/release.yaml", Steps: []LegacyStep{{ID: "step-1", Title: "Test"}, {ID: "step-2", Title: "Ship"}}}
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
	if err := AdvanceRunState(Workflow{Name: "other", Steps: []LegacyStep{{Title: "x"}}}, state); err == nil || !strings.Contains(err.Error(), "does not match") {
		t.Fatalf("expected workflow mismatch error, got %v", err)
	}
}

func TestRegistryCandidates(t *testing.T) {
	r := &Registry{}
	r.Add(Workflow{Name: "release", Source: ".natalia/workflows/release.yaml", Steps: []LegacyStep{{Title: "Test"}}})
	r.Add(Workflow{Name: "review", Source: ".natalia/commands/review.md", Steps: []LegacyStep{{Title: "Inspect"}}})
	r.Add(Workflow{Name: "releasenotes", Source: ".natalia/workflows/releasenotes.yaml", Steps: []LegacyStep{{Title: "Notes"}}})

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

func TestImportDiagnosticStructHoldsMigrationMetadata(t *testing.T) {
	d := ImportDiagnostic{
		Source:      "markdown_checklist",
		Description: "legacy markdown checklist import",
		Suggestion:  "use a native workflow YAML in .natalia/workflows/",
	}
	if d.Source != "markdown_checklist" || d.Description != "legacy markdown checklist import" || d.Suggestion != "use a native workflow YAML in .natalia/workflows/" {
		t.Fatalf("unexpected ImportDiagnostic fields: %+v", d)
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
