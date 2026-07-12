package plan

import (
	"os"
	"path/filepath"
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

func TestDiscoverAndFindBySlug(t *testing.T) {
	workDir := t.TempDir()
	for _, rel := range []string{"plans/Roadmap.md", ".natalia/plans/Feature Plan.md", ".kilo/plans/Kilo Plan.md"} {
		path := filepath.Join(workDir, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("- [ ] step"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	plans, err := Discover(workDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(plans) != 3 || plans[0].Slug != "roadmap" || plans[1].Slug != "feature-plan" || plans[2].Slug != "kilo-plan" {
		t.Fatalf("unexpected discovered plans: %+v", plans)
	}
	path, err := FindBySlug(workDir, "feature-plan")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(filepath.ToSlash(path), ".natalia/plans/Feature Plan.md") {
		t.Fatalf("unexpected slug lookup path: %s", path)
	}
}

func TestFindBySlugReportsAmbiguousPlans(t *testing.T) {
	workDir := t.TempDir()
	for _, rel := range []string{"plans/Roadmap.md", ".kilo/plans/Roadmap.md"} {
		path := filepath.Join(workDir, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("- [ ] step"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := FindBySlug(workDir, "roadmap"); err == nil || !strings.Contains(err.Error(), "ambiguous") {
		t.Fatalf("expected ambiguous slug error, got %v", err)
	}
}
