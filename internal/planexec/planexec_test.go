package planexec

import (
	"strings"
	"testing"
)

func TestParseChecklistSteps(t *testing.T) {
	session := Parse("PLANS/My Plan.md", "# Plan\n- [x] done\n- [X] also done\n- [ ] next task\n* [ ] another task")
	if session.Slug != "my-plan" {
		t.Fatalf("unexpected slug: %q", session.Slug)
	}
	if len(session.Steps) != 4 || !session.Steps[0].Done || !session.Steps[1].Done || session.Steps[2].Text != "next task" || session.Steps[2].Line != 4 {
		t.Fatalf("unexpected steps: %+v", session.Steps)
	}
	next, ok := session.NextOpenStep()
	if !ok || next.Text != "next task" {
		t.Fatalf("unexpected next step: %+v ok=%v", next, ok)
	}
}

func TestPlanSessionBoundaryMethods(t *testing.T) {
	if got := (*Session)(nil).Instruction(); got != "" {
		t.Fatalf("expected nil instruction empty, got %q", got)
	}
	if _, ok := (*Session)(nil).NextOpenStep(); ok {
		t.Fatal("expected nil session to have no next step")
	}
	if _, ok := (*Session)(nil).MarkNextDone(); ok {
		t.Fatal("expected nil session mark done to fail")
	}
	session := Parse("done.md", "- [x] done")
	if _, ok := session.NextOpenStep(); ok {
		t.Fatal("expected all-done plan to have no open step")
	}
	if _, ok := session.MarkNextDone(); ok {
		t.Fatal("expected all-done plan mark to fail")
	}
	status := strings.Join(session.StatusLines(), "\n")
	if strings.Contains(status, "next_step:") || !strings.Contains(status, "plan_steps: 1/1 done") {
		t.Fatalf("unexpected all-done status: %q", status)
	}
}

func TestSlugFromPathVariants(t *testing.T) {
	cases := map[string]string{
		"PLANS/My Plan.md":       "my-plan",
		"复杂计划.md":                "plan",
		"feature_123.go.md":      "feature-123-go",
		"!!!.md":                 "plan",
		"nested/release-v2.0.md": "release-v2-0",
		"spaces and CAPS.txt":    "spaces-and-caps",
	}
	for path, want := range cases {
		if got := slugFromPath(path); got != want {
			t.Fatalf("slugFromPath(%q)=%q want %q", path, got, want)
		}
	}
}

func TestParseWithoutChecklistStillProducesUsableSession(t *testing.T) {
	session := Parse("notes.md", "# Notes\nNo checklist here")
	if len(session.Steps) != 0 || session.Slug != "notes" {
		t.Fatalf("unexpected no-checklist session: %+v", session)
	}
	instruction := session.Instruction()
	if !strings.Contains(instruction, "未找到 checklist 未完成项") || !strings.Contains(instruction, "No checklist here") {
		t.Fatalf("expected fallback instruction for no checklist, got %q", instruction)
	}
}

func TestInstructionIncludesNextOpenStep(t *testing.T) {
	session := Parse("plan.md", "- [x] done\n- [ ] implement feature")
	instruction := session.Instruction()
	if !strings.Contains(instruction, "implement feature") || !strings.Contains(instruction, "计划 slug: plan") {
		t.Fatalf("unexpected instruction: %q", instruction)
	}
}

func TestMarkNextDone(t *testing.T) {
	session := Parse("plan.md", "- [x] done\n- [ ] first\n- [ ] second")
	marked, ok := session.MarkNextDone()
	if !ok || marked.Text != "first" || !marked.Done {
		t.Fatalf("unexpected marked step: %+v ok=%v", marked, ok)
	}
	next, ok := session.NextOpenStep()
	if !ok || next.Text != "second" {
		t.Fatalf("unexpected next step after mark: %+v ok=%v", next, ok)
	}
	if !strings.Contains(strings.Join(session.StatusLines(), "\n"), "plan_steps: 2/3 done") {
		t.Fatalf("expected updated status lines, got %+v", session.StatusLines())
	}
}

func TestStatusLinesWithoutPlan(t *testing.T) {
	lines := (*Session)(nil).StatusLines()
	if len(lines) != 1 || lines[0] != "plan: <none>" {
		t.Fatalf("unexpected nil status lines: %+v", lines)
	}
}
