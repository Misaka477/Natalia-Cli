package skilltools

import (
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/skill"
)

func TestSkillToolsListAndReadThroughRegistry(t *testing.T) {
	registry := &skill.Registry{}
	registry.Add(skill.Skill{Name: "review", Description: "Review code", Content: "Use review checklist", Scope: "project"})

	listed, err := (&List{Registry: registry}).Execute(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(listed, "review") || !strings.Contains(listed, "Review code") || !strings.Contains(listed, "project") {
		t.Fatalf("unexpected skill list output: %q", listed)
	}

	content, err := (&Read{Registry: registry}).Execute(map[string]any{"name": "review"})
	if err != nil {
		t.Fatal(err)
	}
	if content != "Use review checklist" {
		t.Fatalf("unexpected skill content: %q", content)
	}
}

func TestSkillToolsReturnUsefulErrorsAndEmptyList(t *testing.T) {
	registry := &skill.Registry{}
	listed, err := (&List{Registry: registry}).Execute(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if listed != "没有可用的技能" {
		t.Fatalf("unexpected empty list: %q", listed)
	}
	if _, err := (&Read{Registry: registry}).Execute(map[string]any{}); err == nil || !strings.Contains(err.Error(), "name") {
		t.Fatalf("expected missing name error, got %v", err)
	}
	if _, err := (&Read{Registry: registry}).Execute(map[string]any{"name": "missing"}); err == nil || !strings.Contains(err.Error(), "missing") {
		t.Fatalf("expected missing skill error, got %v", err)
	}
}
