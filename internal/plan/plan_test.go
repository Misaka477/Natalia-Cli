package plan

import (
	"strings"
	"testing"
)

func TestManagerEnterStatusAndExit(t *testing.T) {
	m := &Manager{}
	state := m.Enter("", "plans/Implement Feature.md", "design first")
	if !state.Enabled || state.Slug != "implement-feature" || state.Path != "plans/Implement Feature.md" || state.Reason != "design first" {
		t.Fatalf("unexpected entered state: %+v", state)
	}
	if lines := strings.Join(m.Status().Lines(), "\n"); !strings.Contains(lines, "plan_mode: enabled") || !strings.Contains(lines, "implement-feature") {
		t.Fatalf("unexpected status lines: %q", lines)
	}
	prev := m.Exit()
	if !prev.Enabled || m.Status().Enabled {
		t.Fatalf("expected exit to return previous state and clear current state, prev=%+v current=%+v", prev, m.Status())
	}
}

func TestIsPlanPathAllowsOnlyPlanLocations(t *testing.T) {
	allowed := []string{"plans/roadmap.md", ".natalia/plans/roadmap.md", ".kilo/plans/roadmap.md", "/repo/PLANS/roadmap.md"}
	for _, path := range allowed {
		if !IsPlanPath(path) {
			t.Fatalf("expected %s to be a plan path", path)
		}
	}
	blocked := []string{"main.go", "../plans/escape.md", "", "."}
	for _, path := range blocked {
		if IsPlanPath(path) {
			t.Fatalf("expected %s not to be a plan path", path)
		}
	}
}

func TestGuardWriteBlocksNonPlanPathsOnlyWhileEnabled(t *testing.T) {
	m := &Manager{}
	if err := m.GuardWrite("main.go"); err != nil {
		t.Fatalf("disabled plan mode should allow writes, got %v", err)
	}
	m.Enter("", "plans/roadmap.md", "planning")
	if err := m.GuardWrite("plans/roadmap.md"); err != nil {
		t.Fatalf("plan path should be allowed, got %v", err)
	}
	err := m.GuardWrite("main.go")
	if err == nil || !strings.Contains(err.Error(), "plan mode blocks") {
		t.Fatalf("expected non-plan write block, got %v", err)
	}
}
