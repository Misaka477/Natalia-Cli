package workflow

import (
	"strings"
	"testing"
)

func TestSummarizePlan(t *testing.T) {
	plan := &ExecutionPlan{
		Steps: []*PlanStep{
			{ID: "s1", Kind: "set"},
			{ID: "s2", Kind: "call"},
			{ID: "s3", Kind: "export"},
		},
	}
	s := SummarizePlan(plan)
	if len(s.Steps) != 3 {
		t.Fatalf("expected 3 steps, got %d", len(s.Steps))
	}
	if len(s.SideEffects) != 2 {
		t.Fatalf("expected 2 side effects (set + export), got %d: %v", len(s.SideEffects), s.SideEffects)
	}
	if len(s.Endpoints) != 1 {
		t.Fatalf("expected 1 endpoint, got %d: %v", len(s.Endpoints), s.Endpoints)
	}
	if len(s.RequiresAuth) != 1 {
		t.Fatalf("expected 1 requires auth, got %d: %v", len(s.RequiresAuth), s.RequiresAuth)
	}
}

func TestSummarizePlanEmpty(t *testing.T) {
	plan := &ExecutionPlan{}
	s := SummarizePlan(plan)
	if len(s.Steps) != 0 {
		t.Fatalf("expected 0 steps, got %d", len(s.Steps))
	}
	if len(s.SideEffects) != 0 {
		t.Fatalf("expected 0 side effects, got %d", len(s.SideEffects))
	}
}

func TestSummarizePlanWithChildren(t *testing.T) {
	plan := &ExecutionPlan{
		Steps: []*PlanStep{
			{
				ID:   "root",
				Kind: "if",
				Children: []*PlanStep{
					{ID: "child1", Kind: "call"},
					{ID: "child2", Kind: "set"},
				},
			},
		},
	}
	s := SummarizePlan(plan)
	if len(s.Steps) != 3 {
		t.Fatalf("expected 3 steps (root + 2 children), got %d: %v", len(s.Steps), s.Steps)
	}
	if len(s.SideEffects) != 1 {
		t.Fatalf("expected 1 side effect, got %d: %v", len(s.SideEffects), s.SideEffects)
	}
	if len(s.Endpoints) != 1 {
		t.Fatalf("expected 1 endpoint, got %d: %v", len(s.Endpoints), s.Endpoints)
	}
}

func TestSummarizePlanUnnamedStep(t *testing.T) {
	plan := &ExecutionPlan{
		Steps: []*PlanStep{
			{Kind: "call"},
		},
	}
	s := SummarizePlan(plan)
	if len(s.Steps) != 1 {
		t.Fatalf("expected 1 step, got %d", len(s.Steps))
	}
	if !strings.Contains(s.Steps[0], "(unnamed)") {
		t.Fatalf("expected (unnamed) in step, got %s", s.Steps[0])
	}
}

func TestDryRunValid(t *testing.T) {
	doc := &Document{
		OWSVersion: "0.1.0",
		Name:       "test",
		Do: &Block{
			Steps: []Step{
				{ID: "s1", Call: &CallAction{Call: "hello"}},
			},
		},
	}
	s, err := DryRun(doc)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Steps) != 1 {
		t.Fatalf("expected 1 step, got %d", len(s.Steps))
	}
	if len(s.Endpoints) != 1 {
		t.Fatalf("expected 1 endpoint, got %d", len(s.Endpoints))
	}
}

func TestDryRunInvalidDoc(t *testing.T) {
	doc := &Document{Name: "test"}
	_, err := DryRun(doc)
	if err == nil {
		t.Fatal("expected error for invalid document")
	}
}

func TestPlanSummaryString(t *testing.T) {
	s := &PlanSummary{
		Steps:        []string{"s1 [call]"},
		SideEffects:  []string{"s1 [call]"},
		Endpoints:    []string{"s1 [call]"},
		RequiresAuth: []string{"s1 [call]"},
		Sandbox:      true,
		HasApproval:  true,
	}
	str := s.String()
	if !strings.Contains(str, "Steps: 1") {
		t.Fatalf("expected Steps count, got: %s", str)
	}
	if !strings.Contains(str, "Side Effects") {
		t.Fatalf("expected Side Effects, got: %s", str)
	}
	if !strings.Contains(str, "Endpoints") {
		t.Fatalf("expected Endpoints, got: %s", str)
	}
	if !strings.Contains(str, "Requires Auth") {
		t.Fatalf("expected Requires Auth, got: %s", str)
	}
	if !strings.Contains(str, "Sandbox: true") {
		t.Fatalf("expected Sandbox, got: %s", str)
	}
	if !strings.Contains(str, "Has Approval: true") {
		t.Fatalf("expected Has Approval, got: %s", str)
	}
}

func TestPlanSummaryStringEmpty(t *testing.T) {
	s := &PlanSummary{}
	str := s.String()
	if !strings.Contains(str, "Steps: 0") {
		t.Fatalf("expected Steps: 0, got: %s", str)
	}
}

func TestDryRunNoSideEffects(t *testing.T) {
	doc := &Document{
		OWSVersion: "0.1.0",
		Name:       "noop",
		Do: &Block{
			Steps: []Step{
				{ID: "s1", Wait: &WaitAction{Duration: "1s"}},
			},
		},
	}
	s, err := DryRun(doc)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.SideEffects) != 0 {
		t.Fatalf("expected no side effects, got %v", s.SideEffects)
	}
	if len(s.Endpoints) != 0 {
		t.Fatalf("expected no endpoints, got %v", s.Endpoints)
	}
}
