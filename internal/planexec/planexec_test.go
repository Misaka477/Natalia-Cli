package planexec

import (
	"strings"
	"testing"
)

func TestParseChecklistSteps(t *testing.T) {
	session := Parse("PLANS/My Plan.md", "# Plan\n- [x] done\n- [ ] next task\n* [ ] another task")
	if session.Slug != "my-plan" {
		t.Fatalf("unexpected slug: %q", session.Slug)
	}
	if len(session.Steps) != 3 || !session.Steps[0].Done || session.Steps[1].Text != "next task" || session.Steps[1].Line != 3 {
		t.Fatalf("unexpected steps: %+v", session.Steps)
	}
	next, ok := session.NextOpenStep()
	if !ok || next.Text != "next task" {
		t.Fatalf("unexpected next step: %+v ok=%v", next, ok)
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
