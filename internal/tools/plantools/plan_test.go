package plantools

import (
	"os"
	"path/filepath"
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
	if !strings.Contains(status, "plan_mode: enabled") || !strings.Contains(status, "feature-plan") || !strings.Contains(status, "prepare") {
		t.Fatalf("expected status to contain entered state, status=%q entered=%q", status, entered)
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

func TestPlanModeEnterCreateTemplate(t *testing.T) {
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })

	dir := t.TempDir()
	chdir(t, dir)
	planPath := filepath.Join(dir, "plans", "Test Plan.md")

	_, err := (&Enter{}).Execute(map[string]any{"path": planPath, "create_template": true})
	if err != nil {
		t.Fatalf("expected enter with create_template to succeed, got %v", err)
	}

	if _, err := os.Stat(planPath); err != nil {
		t.Fatalf("expected plan template to be created, got %v", err)
	}

	data, err := os.ReadFile(planPath)
	if err != nil {
		t.Fatalf("expected to read plan template, got %v", err)
	}
	if !strings.Contains(string(data), "- [ ] TODO") {
		t.Fatalf("expected template to contain checklist item, got %s", string(data))
	}
}

func TestPlanModeEnterCreateTemplateSkipsExisting(t *testing.T) {
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })

	dir := t.TempDir()
	chdir(t, dir)
	planPath := filepath.Join(dir, "plans", "Existing.md")
	if err := os.MkdirAll(filepath.Dir(planPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(planPath, []byte("# Existing\n\ncustom content"), 0644); err != nil {
		t.Fatal(err)
	}

	_, err := (&Enter{}).Execute(map[string]any{"path": planPath, "create_template": true})
	if err != nil {
		t.Fatalf("expected enter with create_template on existing file to succeed, got %v", err)
	}

	data, err := os.ReadFile(planPath)
	if err != nil {
		t.Fatalf("expected to read existing plan, got %v", err)
	}
	if !strings.Contains(string(data), "custom content") {
		t.Fatalf("expected existing file to be preserved, got %s", string(data))
	}
}

func TestPlanModeStatusShowsFileInfo(t *testing.T) {
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })

	dir := t.TempDir()
	chdir(t, dir)
	planPath := filepath.Join(dir, "plans", "Status.md")
	content := "# Status\n\n- [x] done\n- [ ] todo\n"
	if err := os.MkdirAll(filepath.Dir(planPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(planPath, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	(&Enter{}).Execute(map[string]any{"path": planPath})

	out, err := (&Status{}).Execute(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "plan_exists: yes") {
		t.Fatalf("expected plan_exists: yes, got %q", out)
	}
	if !strings.Contains(out, "checklist: 1/2 done") {
		t.Fatalf("expected checklist summary, got %q", out)
	}
	if !strings.Contains(out, "next_step: todo") {
		t.Fatalf("expected next_step, got %q", out)
	}
}

func TestPlanModeEnterRejectsWorkspaceExternalPath(t *testing.T) {
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })

	dir := t.TempDir()
	chdir(t, dir)
	outside := filepath.Join(filepath.Dir(dir), "outside-workspace", "plans", "Plan.md")
	_, err := (&Enter{}).Execute(map[string]any{"path": outside, "create_template": true})
	if err == nil || !strings.Contains(err.Error(), "workspace policy") {
		t.Fatalf("expected workspace policy rejection, got %v", err)
	}
	if plan.Status().Enabled {
		t.Fatalf("plan mode should not be enabled after rejected path, got %+v", plan.Status())
	}
	if _, statErr := os.Stat(outside); !os.IsNotExist(statErr) {
		t.Fatalf("outside plan should not have been created, stat err=%v", statErr)
	}
}

func TestPlanModeEnterRejectsNonPlanPath(t *testing.T) {
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })

	dir := t.TempDir()
	chdir(t, dir)
	path := filepath.Join(dir, "notes", "Plan.md")
	_, err := (&Enter{}).Execute(map[string]any{"path": path, "create_template": true})
	if err == nil || !strings.Contains(err.Error(), "plans directory") {
		t.Fatalf("expected plan directory rejection, got %v", err)
	}
	if _, statErr := os.Stat(path); !os.IsNotExist(statErr) {
		t.Fatalf("non-plan template should not have been created, stat err=%v", statErr)
	}
}

func TestPlanModeEnterOutputUsesResolvedPath(t *testing.T) {
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })

	dir := t.TempDir()
	chdir(t, dir)
	out, err := (&Enter{}).Execute(map[string]any{"path": "plans/Resolved.md", "create_template": true})
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(dir, "plans", "Resolved.md")
	if !strings.Contains(out, "plan_path: "+want) {
		t.Fatalf("expected resolved path %q in output, got %q", want, out)
	}
}

func chdir(t *testing.T, dir string) {
	t.Helper()
	old, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := os.Chdir(old); err != nil {
			t.Fatalf("restore cwd: %v", err)
		}
	})
}
