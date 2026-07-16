package workflow

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
)

func ValidateWorkflow(doc *Document) ([]string, error) {
	if doc.OWSVersion == "" {
		return nil, fmt.Errorf("workflow document must specify 'ows' version")
	}
	if doc.Name == "" {
		return nil, fmt.Errorf("workflow document must specify 'name'")
	}
	if doc.Do == nil {
		return nil, fmt.Errorf("workflow document must contain a 'do' block")
	}
	var warnings []string
	if len(doc.Do.Steps) == 0 {
		warnings = append(warnings, "workflow document 'do' block has no steps")
	}
	for i, step := range doc.Do.Steps {
		if step.ID == "" {
			warnings = append(warnings, fmt.Sprintf("step %d has no 'id'", i+1))
		}
	}
	return warnings, nil
}

func PlanWorkflow(doc *Document) (string, error) {
	plan, profile, err := Compile(doc)
	if err != nil {
		return "", err
	}
	var b strings.Builder
	fmt.Fprintf(&b, "Profile: %s\n", profile.Profile)
	if len(profile.Unsupported) > 0 {
		fmt.Fprintf(&b, "Unsupported: %v\n", profile.Unsupported)
	}
	if len(profile.Warnings) > 0 {
		fmt.Fprintf(&b, "Warnings: %v\n", profile.Warnings)
	}
	b.WriteString("Plan:\n")
	for _, step := range plan.Steps {
		formatPlanStep(&b, step, "  ")
	}
	return b.String(), nil
}

func formatPlanStep(b *strings.Builder, step *PlanStep, indent string) {
	id := step.ID
	if id == "" {
		id = "(unnamed)"
	}
	fmt.Fprintf(b, "%s%s [%s]\n", indent, id, step.Kind)
	for _, child := range step.Children {
		formatPlanStep(b, child, indent+"  ")
	}
}

func ExecuteWorkflow(ctx context.Context, doc *Document, activity ActivityFunc) (*Run, error) {
	plan, _, err := Compile(doc)
	if err != nil {
		return nil, err
	}
	store := NewMemoryEventStore()
	runtime := NewRuntime(store, activity)
	return runtime.StartRun(ctx, doc, plan)
}

func ShowRun(run *Run) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Run ID: %s\n", run.ID)
	if run.Document != nil {
		fmt.Fprintf(&b, "Workflow: %s\n", run.Document.Name)
	}
	fmt.Fprintf(&b, "Status: %s\n", run.Status)
	fmt.Fprintf(&b, "Completed: %d steps\n", len(run.CompletedSteps))
	fmt.Fprintf(&b, "Failed: %d steps\n", len(run.FailedSteps))
	if len(run.ActivityResults) > 0 {
		b.WriteString("Results:\n")
		for id, result := range run.ActivityResults {
			fmt.Fprintf(&b, "  %s: %s", id, result.Status)
			if result.Error != "" {
				fmt.Fprintf(&b, " (error: %s)", result.Error)
			}
			b.WriteString("\n")
		}
	}
	return strings.TrimRight(b.String(), "\n")
}

func ListWorkflows(workflowDir string) string {
	var b strings.Builder

	matches, _ := filepath.Glob(filepath.Join(workflowDir, "*.yaml"))
	ymlMatches, _ := filepath.Glob(filepath.Join(workflowDir, "*.yml"))
	matches = append(matches, ymlMatches...)
	sort.Strings(matches)
	for _, match := range matches {
		doc, err := ParseFile(match)
		if err != nil {
			continue
		}
		fmt.Fprintf(&b, "Document: %s (version %s)\n", doc.Name, doc.OWSVersion)
		if doc.Namespace != "" {
			fmt.Fprintf(&b, "  Namespace: %s\n", doc.Namespace)
		}
	}

	providers := []Provider{
		&MakeProvider{},
		&TaskfileProvider{},
		&ScriptProvider{},
		&GitHubProvider{},
	}
	for _, p := range providers {
		tasks, err := p.Detect(workflowDir)
		if err != nil {
			continue
		}
		for _, task := range tasks {
			fmt.Fprintf(&b, "Native: %s (%s)\n", task.Name, p.Name())
		}
	}
	return strings.TrimRight(b.String(), "\n")
}
