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

func TestPlanToolSchemas(t *testing.T) {
	if (&Enter{}).Name() != "plan_mode_enter" || (&Exit{}).Name() != "plan_mode_exit" || (&Status{}).Name() != "plan_mode_status" {
		t.Fatal("unexpected plan tool names")
	}
	if (&Enter{}).Parameters()["path"].Type != "string" {
		t.Fatalf("expected enter path schema")
	}
}
