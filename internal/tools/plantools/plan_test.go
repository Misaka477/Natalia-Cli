package plantools

import (
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/plan"
)

func TestPlanToolsEnterStatusAndExitThroughDefaultManager(t *testing.T) {
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })

	entered, err := (&Enter{}).Execute(map[string]any{"path": "plans/Feature Plan.md", "reason": "prepare"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(entered, "plan_mode: enabled") || !strings.Contains(entered, "feature-plan") || !strings.Contains(entered, "prepare") {
		t.Fatalf("unexpected enter output: %q", entered)
	}
	status, err := (&Status{}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if status != entered {
		t.Fatalf("expected status to match entered state, status=%q entered=%q", status, entered)
	}
	exited, err := (&Exit{}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if exited != "plan_mode: disabled" {
		t.Fatalf("unexpected exit output: %q", exited)
	}
}

func TestPlanToolsUseInjectedManager(t *testing.T) {
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })
	manager := &plan.Manager{}
	if _, err := (&Enter{Manager: manager}).Execute(map[string]any{"path": "plans/Injected.md"}); err != nil {
		t.Fatal(err)
	}
	if !manager.Status().Enabled || manager.Status().Slug != "injected" {
		t.Fatalf("expected injected manager to be updated, got %+v", manager.Status())
	}
	if plan.Status().Enabled {
		t.Fatalf("default manager should not be updated by injected tool, got %+v", plan.Status())
	}
	out, err := (&Status{Manager: manager}).Execute(nil)
	if err != nil || !strings.Contains(out, "injected") {
		t.Fatalf("expected injected status, out=%q err=%v", out, err)
	}
}

func TestPlanToolSchemas(t *testing.T) {
	if (&Enter{}).Name() != "plan_mode_enter" || (&Exit{}).Name() != "plan_mode_exit" || (&Status{}).Name() != "plan_mode_status" {
		t.Fatal("unexpected plan tool names")
	}
	if (&Enter{}).Parameters()["path"].Type != "string" {
		t.Fatalf("expected enter path schema")
	}
}
