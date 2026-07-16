package workflowtools

import (
	"path/filepath"
	"strings"
	"testing"

	workflowcore "github.com/Misaka477/Natalia-Cli/internal/workflow"
)

func TestWorkflowToolsListAndReadCanonicalRegistry(t *testing.T) {
	r := &workflowcore.Registry{}
	r.Add(workflowcore.Workflow{Name: "review", Description: "Review changes", Source: ".natalia/commands/review.md", Steps: []workflowcore.LegacyStep{{ID: "step-1", Title: "Inspect diff", Kind: "task"}}})

	list, err := (&List{Registry: r}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(list, "review") || !strings.Contains(list, "1 steps") || !strings.Contains(list, "Markdown command") || !strings.Contains(list, "[Markdown command]") {
		t.Fatalf("unexpected list output: %q", list)
	}
	read, err := (&Read{Registry: r}).Execute(map[string]any{"name": "review"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(read, "# review") || !strings.Contains(read, "Inspect diff") || !strings.Contains(read, "Source: .natalia/commands/review.md") {
		t.Fatalf("unexpected read output: %q", read)
	}
}

func TestWorkflowReadValidatesNameAndUnknownWorkflow(t *testing.T) {
	r := &workflowcore.Registry{}
	if _, err := (&Read{Registry: r}).Execute(map[string]any{}); err == nil || !strings.Contains(err.Error(), "name") {
		t.Fatalf("expected missing name error, got %v", err)
	}
	if _, err := (&Read{Registry: r}).Execute(map[string]any{"name": "missing"}); err == nil || !strings.Contains(err.Error(), "not found") || !strings.Contains(err.Error(), ".natalia/workflows") {
		t.Fatalf("expected missing workflow error, got %v", err)
	}
}

func TestWorkflowListEmptyShowsDiscoveryHint(t *testing.T) {
	out, err := (&List{Registry: &workflowcore.Registry{}}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "no workflows available") || !strings.Contains(out, ".natalia/workflows") || !strings.Contains(out, "Makefile") {
		t.Fatalf("expected empty workflow hint, got %q", out)
	}
}

func TestWorkflowRunDryRunDoesNotPersistState(t *testing.T) {
	r := &workflowcore.Registry{}
	r.Add(workflowcore.Workflow{Name: "review", Source: ".natalia/commands/review.md", Steps: []workflowcore.LegacyStep{{ID: "step-1", Title: "Inspect diff", Prompt: "Run git diff", Kind: "task"}}})
	out, err := (&Run{Registry: r}).Execute(map[string]any{"name": "review", "dry_run": true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "[dry-run]") || !strings.Contains(out, "Inspect diff") || !strings.Contains(out, "1 steps") {
		t.Fatalf("unexpected dry_run output: %q", out)
	}
}

func TestWorkflowRunDescriptionWarnsAboutRealExecution(t *testing.T) {
	run := &Run{}
	if !strings.Contains(run.Description(), "dry_run=true") || !strings.Contains(run.Description(), "workspace") {
		t.Fatalf("workflow_run description should distinguish dry-run from real execution: %q", run.Description())
	}
	if got := run.Parameters()["dry_run"].Description; !strings.Contains(got, "audits/automation") || !strings.Contains(got, "side effects") {
		t.Fatalf("workflow_run dry_run schema should warn about automation safety, got %q", got)
	}
}

func TestWorkflowRunReturnsInstructionAndPersistsState(t *testing.T) {
	r := &workflowcore.Registry{}
	r.Add(workflowcore.Workflow{Name: "review", Source: ".natalia/commands/review.md", Steps: []workflowcore.LegacyStep{{ID: "step-1", Title: "Inspect diff", Prompt: "Run git diff", Kind: "task"}}})
	statePath := filepath.Join(t.TempDir(), "workflow-state.json")
	out, err := (&Run{Registry: r}).Execute(map[string]any{"name": "review", "state_path": statePath})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "Execute workflow") || !strings.Contains(out, "Run git diff") || !strings.Contains(out, statePath) || !strings.Contains(out, "current_step: 1") || !strings.Contains(out, "next_action:") {
		t.Fatalf("unexpected workflow_run output: %q", out)
	}
	state, err := workflowcore.LoadRunState(statePath)
	if err != nil {
		t.Fatal(err)
	}
	if state.WorkflowName != "review" || state.CurrentStep != 1 || state.TotalSteps != 1 {
		t.Fatalf("unexpected persisted state: %+v", state)
	}
}

func TestWorkflowRunStateMachineCanAdvanceAndComplete(t *testing.T) {
	r := &workflowcore.Registry{}
	r.Add(workflowcore.Workflow{Name: "review", Source: ".natalia/commands/review.md", Steps: []workflowcore.LegacyStep{
		{ID: "step-1", Title: "Inspect diff", Prompt: "Run git diff", Kind: "task"},
		{ID: "step-2", Title: "Report", Prompt: "Write summary", Kind: "task"},
	}})
	statePath := filepath.Join(t.TempDir(), "workflow-state.json")
	runner := &Run{Registry: r}

	out, err := runner.Execute(map[string]any{"name": "review", "state_path": statePath})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "status: running") || !strings.Contains(out, "current_step: 1") || !strings.Contains(out, "total_steps: 2") || !strings.Contains(out, "action=complete_step") {
		t.Fatalf("unexpected start output: %q", out)
	}

	out, err = runner.Execute(map[string]any{"name": "review", "state_path": statePath, "action": "status"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "action: status") || !strings.Contains(out, "current_step: 1") || !strings.Contains(out, "state_loaded: true") {
		t.Fatalf("unexpected status output: %q", out)
	}

	out, err = runner.Execute(map[string]any{"name": "review", "state_path": statePath, "action": "complete_step"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "action: complete_step") || !strings.Contains(out, "current_step: 2") || !strings.Contains(out, "Write summary") {
		t.Fatalf("expected workflow to advance to step 2, got %q", out)
	}
	state, err := workflowcore.LoadRunState(statePath)
	if err != nil {
		t.Fatal(err)
	}
	if state.CurrentStep != 2 || state.Status != "running" {
		t.Fatalf("expected persisted step 2 running state, got %+v", state)
	}

	out, err = runner.Execute(map[string]any{"name": "review", "state_path": statePath, "action": "complete_step"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "status: completed") || !strings.Contains(out, "current_step: 2") || !strings.Contains(out, "workflow complete") {
		t.Fatalf("expected completed workflow output, got %q", out)
	}
	state, err = workflowcore.LoadRunState(statePath)
	if err != nil {
		t.Fatal(err)
	}
	if state.Status != "completed" || state.CurrentStep != 2 {
		t.Fatalf("expected completed persisted state, got %+v", state)
	}
}

func TestWorkflowRunRestartAndInvalidAction(t *testing.T) {
	r := &workflowcore.Registry{}
	r.Add(workflowcore.Workflow{Name: "review", Source: ".natalia/commands/review.md", Steps: []workflowcore.LegacyStep{{Title: "Inspect"}}})
	r.Add(workflowcore.Workflow{Name: "release", Source: ".natalia/workflows/release.yaml", Steps: []workflowcore.LegacyStep{{Title: "Ship"}}})
	statePath := filepath.Join(t.TempDir(), "workflow-state.json")
	if err := workflowcore.SaveRunState(statePath, workflowcore.RunState{WorkflowName: "release", CurrentStep: 1, TotalSteps: 1, Status: "running"}); err != nil {
		t.Fatal(err)
	}
	runner := &Run{Registry: r}
	if _, err := runner.Execute(map[string]any{"name": "review", "state_path": statePath}); err == nil || !strings.Contains(err.Error(), "belongs to workflow") {
		t.Fatalf("expected mismatched state error, got %v", err)
	}
	out, err := runner.Execute(map[string]any{"name": "review", "state_path": statePath, "action": "restart"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "action: restart") || !strings.Contains(out, "current_step: 1") {
		t.Fatalf("unexpected restart output: %q", out)
	}
	if _, err := runner.Execute(map[string]any{"name": "review", "action": "skip"}); err == nil || !strings.Contains(err.Error(), "valid actions") {
		t.Fatalf("expected invalid action error, got %v", err)
	}
}

func TestWorkflowReadShowsCandidatesOnUnknownName(t *testing.T) {
	r := &workflowcore.Registry{}
	r.Add(workflowcore.Workflow{Name: "review", Source: ".natalia/commands/review.md", Steps: []workflowcore.LegacyStep{{Title: "Inspect diff"}}})
	r.Add(workflowcore.Workflow{Name: "release", Source: ".natalia/workflows/release.yaml", Steps: []workflowcore.LegacyStep{{Title: "Test"}}})
	r.Add(workflowcore.Workflow{Name: "releasenotes", Source: ".natalia/workflows/releasenotes.yaml", Steps: []workflowcore.LegacyStep{{Title: "Notes"}}})
	_, err := (&Read{Registry: r}).Execute(map[string]any{"name": "rele"})
	if err == nil || !strings.Contains(err.Error(), "did you mean") || !strings.Contains(err.Error(), "release") || !strings.Contains(err.Error(), "releasenotes") {
		t.Fatalf("expected candidate hint, got %v", err)
	}
}

func TestWorkflowRunShowsCandidatesOnUnknownName(t *testing.T) {
	r := &workflowcore.Registry{}
	r.Add(workflowcore.Workflow{Name: "review", Source: ".natalia/commands/review.md", Steps: []workflowcore.LegacyStep{{Title: "Inspect diff"}}})
	_, err := (&Run{Registry: r}).Execute(map[string]any{"name": "rev"})
	if err == nil || !strings.Contains(err.Error(), "did you mean") || !strings.Contains(err.Error(), "review") {
		t.Fatalf("expected candidate hint, got %v", err)
	}
}
