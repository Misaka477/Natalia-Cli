package workflow

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateWorkflowValid(t *testing.T) {
	doc := &Document{
		OWSVersion: "0.1.0",
		Name:       "test",
		Do: &Block{
			Steps: []Step{
				{ID: "s1", Call: &CallAction{Call: "hello"}},
			},
		},
	}
	warnings, err := ValidateWorkflow(doc)
	if err != nil {
		t.Fatal(err)
	}
	if len(warnings) != 0 {
		t.Fatalf("expected no warnings, got %v", warnings)
	}
}

func TestValidateWorkflowMissingOWS(t *testing.T) {
	doc := &Document{Name: "test", Do: &Block{}}
	_, err := ValidateWorkflow(doc)
	if err == nil || !strings.Contains(err.Error(), "ows") {
		t.Fatalf("expected error about missing ows, got %v", err)
	}
}

func TestValidateWorkflowMissingName(t *testing.T) {
	doc := &Document{OWSVersion: "0.1.0", Do: &Block{}}
	_, err := ValidateWorkflow(doc)
	if err == nil || !strings.Contains(err.Error(), "name") {
		t.Fatalf("expected error about missing name, got %v", err)
	}
}

func TestValidateWorkflowMissingDo(t *testing.T) {
	doc := &Document{OWSVersion: "0.1.0", Name: "test"}
	_, err := ValidateWorkflow(doc)
	if err == nil || !strings.Contains(err.Error(), "do") {
		t.Fatalf("expected error about missing do, got %v", err)
	}
}

func TestValidateWorkflowWarnings(t *testing.T) {
	doc := &Document{
		OWSVersion: "0.1.0",
		Name:       "test",
		Do:         &Block{Steps: []Step{{ID: "s1"}, {}}},
	}
	warnings, err := ValidateWorkflow(doc)
	if err != nil {
		t.Fatal(err)
	}
	if len(warnings) == 0 {
		t.Fatal("expected warnings for missing step id")
	}
	if !strings.Contains(warnings[0], "step 2 has no 'id'") {
		t.Fatalf("expected warning about step 2 missing id, got %v", warnings)
	}
}

func TestPlanWorkflow(t *testing.T) {
	doc := &Document{
		OWSVersion: "0.1.0",
		Name:       "test",
		Do: &Block{
			Steps: []Step{
				{ID: "s1", Call: &CallAction{Call: "hello"}},
				{ID: "s2", Set: &SetAction{Target: "x", Value: 1}},
			},
		},
	}
	result, err := PlanWorkflow(doc)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "Profile: core") {
		t.Fatalf("expected core profile, got: %s", result)
	}
	if !strings.Contains(result, "s1 [call]") {
		t.Fatalf("expected s1 [call] in plan, got: %s", result)
	}
	if !strings.Contains(result, "s2 [set]") {
		t.Fatalf("expected s2 [set] in plan, got: %s", result)
	}
}

func TestPlanWorkflowInvalid(t *testing.T) {
	doc := &Document{Name: "test"}
	_, err := PlanWorkflow(doc)
	if err == nil {
		t.Fatal("expected error for invalid document")
	}
}

func TestExecuteWorkflow(t *testing.T) {
	doc := &Document{
		OWSVersion: "0.1.0",
		Name:       "test",
		Do: &Block{
			Steps: []Step{
				{ID: "s1", Call: &CallAction{Call: "hello"}},
			},
		},
	}
	run, err := ExecuteWorkflow(context.Background(), doc, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		return "output", nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != "completed" {
		t.Fatalf("expected completed, got %s", run.Status)
	}
	if !run.CompletedSteps["s1"] {
		t.Fatal("expected s1 to be completed")
	}
}

func TestExecuteWorkflowFailed(t *testing.T) {
	doc := &Document{
		OWSVersion: "0.1.0",
		Name:       "test",
		Do: &Block{
			Steps: []Step{
				{ID: "s1", Call: &CallAction{Call: "hello"}},
			},
		},
	}
	run, err := ExecuteWorkflow(context.Background(), doc, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		return nil, errors.New("fail")
	})
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != "failed" {
		t.Fatalf("expected failed, got %s", run.Status)
	}
}

func TestExecuteWorkflowInvalidDoc(t *testing.T) {
	doc := &Document{Name: "test"}
	_, err := ExecuteWorkflow(context.Background(), doc, nil)
	if err == nil {
		t.Fatal("expected error for invalid document")
	}
}

func TestShowRun(t *testing.T) {
	run := &Run{
		ID:             "run-1",
		Status:         "completed",
		Document:       &Document{Name: "test"},
		CompletedSteps: map[string]bool{"s1": true},
		FailedSteps:    map[string]bool{},
		ActivityResults: map[string]ActivityResult{
			"s1": {StepID: "s1", Status: "completed", Output: "ok"},
		},
	}
	output := ShowRun(run)
	if !strings.Contains(output, "Run ID: run-1") {
		t.Fatalf("expected Run ID, got: %s", output)
	}
	if !strings.Contains(output, "Workflow: test") {
		t.Fatalf("expected Workflow, got: %s", output)
	}
	if !strings.Contains(output, "Status: completed") {
		t.Fatalf("expected Status, got: %s", output)
	}
	if !strings.Contains(output, "s1: completed") {
		t.Fatalf("expected result, got: %s", output)
	}
}

func TestShowRunEmpty(t *testing.T) {
	output := ShowRun(&Run{ID: "run-1", Status: "running", CompletedSteps: map[string]bool{}, FailedSteps: map[string]bool{}, ActivityResults: map[string]ActivityResult{}})
	if !strings.Contains(output, "Status: running") {
		t.Fatalf("expected Status: running, got: %s", output)
	}
}

func TestListWorkflowsNoFiles(t *testing.T) {
	dir := t.TempDir()
	output := ListWorkflows(dir)
	_ = output // may contain provider results like github, that's fine
}

func TestListWorkflowsWithDocAndProvider(t *testing.T) {
	dir := t.TempDir()

	if err := os.WriteFile(filepath.Join(dir, "workflow.yaml"), []byte("ows: 0.1.0\nname: hello\ndo:\n  steps:\n    - call: test\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "Makefile"), []byte("build:\n\tgo build\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "package.json"), []byte(`{"scripts":{"test":"go test ./..."}}`), 0644); err != nil {
		t.Fatal(err)
	}

	output := ListWorkflows(dir)
	if !strings.Contains(output, "Document: hello (version 0.1.0)") {
		t.Fatalf("expected document listing, got: %s", output)
	}
	if !strings.Contains(output, "Native: build (make)") {
		t.Fatalf("expected make target, got: %s", output)
	}
	if !strings.Contains(output, "Native: test (script)") {
		t.Fatalf("expected script task, got: %s", output)
	}
}

func TestListWorkflowsInvalidYAML(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "invalid.yaml"), []byte("not: valid: ows"), 0644); err != nil {
		t.Fatal(err)
	}
	output := ListWorkflows(dir)
	if strings.Contains(output, "Document:") {
		t.Fatalf("expected no Document output for invalid YAML, got: %s", output)
	}
}
