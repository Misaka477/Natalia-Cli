package workflow

import (
	"fmt"
	"strings"
)

type PlanSummary struct {
	Steps        []string
	SideEffects  []string
	Endpoints    []string
	RequiresAuth []string
	Sandbox      bool
	HasApproval  bool
}

func SummarizePlan(plan *ExecutionPlan) *PlanSummary {
	s := &PlanSummary{}
	for _, step := range plan.Steps {
		collectSummary(step, s)
	}
	return s
}

func collectSummary(step *PlanStep, s *PlanSummary) {
	name := step.ID
	if name == "" {
		name = "(unnamed)"
	}
	entry := fmt.Sprintf("%s [%s]", name, step.Kind)
	s.Steps = append(s.Steps, entry)

	switch step.Kind {
	case "set":
		s.SideEffects = append(s.SideEffects, entry)
	case "export":
		s.SideEffects = append(s.SideEffects, entry)
	case "call":
		s.Endpoints = append(s.Endpoints, entry)
		s.RequiresAuth = append(s.RequiresAuth, entry)
	}

	for _, child := range step.Children {
		collectSummary(child, s)
	}
}

func DryRun(doc *Document) (*PlanSummary, error) {
	if _, err := ValidateWorkflow(doc); err != nil {
		return nil, err
	}
	plan, _, err := Compile(doc)
	if err != nil {
		return nil, err
	}
	return SummarizePlan(plan), nil
}

func (s *PlanSummary) String() string {
	var b strings.Builder
	b.WriteString("Plan Summary:\n")
	b.WriteString(fmt.Sprintf("  Steps: %d\n", len(s.Steps)))
	if len(s.SideEffects) > 0 {
		b.WriteString(fmt.Sprintf("  Side Effects: %v\n", s.SideEffects))
	}
	if len(s.Endpoints) > 0 {
		b.WriteString(fmt.Sprintf("  Endpoints: %v\n", s.Endpoints))
	}
	if len(s.RequiresAuth) > 0 {
		b.WriteString(fmt.Sprintf("  Requires Auth: %v\n", s.RequiresAuth))
	}
	if s.Sandbox {
		b.WriteString("  Sandbox: true\n")
	}
	if s.HasApproval {
		b.WriteString("  Has Approval: true\n")
	}
	return strings.TrimRight(b.String(), "\n")
}
