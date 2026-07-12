package workflowtools

import (
	"strings"
	"testing"

	workflowcore "github.com/Misaka477/Natalia-Cli/internal/workflow"
)

func TestWorkflowToolsListAndReadCanonicalRegistry(t *testing.T) {
	r := &workflowcore.Registry{}
	r.Add(workflowcore.Workflow{Name: "review", Description: "Review changes", Source: ".natalia/commands/review.md", Steps: []workflowcore.Step{{ID: "step-1", Title: "Inspect diff", Kind: "task"}}})

	list, err := (&List{Registry: r}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(list, "review") || !strings.Contains(list, "1 steps") {
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
	if _, err := (&Read{Registry: r}).Execute(map[string]any{"name": "missing"}); err == nil || !strings.Contains(err.Error(), "不存在") {
		t.Fatalf("expected missing workflow error, got %v", err)
	}
}
