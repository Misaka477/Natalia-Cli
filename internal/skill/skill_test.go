package skill

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadSkill(t *testing.T) {
	dir := t.TempDir()
	skillDir := filepath.Join(dir, "myskill")
	os.MkdirAll(skillDir, 0755)
	content := `---
name: my-skill
description: A test skill
---

# My Skill

Instructions here.`
	os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte(content), 0644)

	s, err := loadSkill(skillDir, "project")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "my-skill" {
		t.Errorf("expected my-skill, got %s", s.Name)
	}
	if s.Description != "A test skill" {
		t.Errorf("expected 'A test skill', got %s", s.Description)
	}
	if !contains(s.Content, "Instructions here") {
		t.Error("content should contain instructions")
	}
	if s.Scope != "project" {
		t.Errorf("expected project scope, got %s", s.Scope)
	}
}

func TestLoadSkillNoFrontmatter(t *testing.T) {
	dir := t.TempDir()
	skillDir := filepath.Join(dir, "test-skill")
	os.MkdirAll(skillDir, 0755)
	os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("Just content"), 0644)

	s, err := loadSkill(skillDir, "user")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "test-skill" {
		t.Errorf("expected test-skill, got %s", s.Name)
	}
}

func TestDiscover(t *testing.T) {
	workDir := t.TempDir()
	t.Setenv("HOME", t.TempDir())
	skillDir := filepath.Join(workDir, ".natalia", "skills", "test1")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: test1\ndescription: First\n---\nContent1"), 0644); err != nil {
		t.Fatal(err)
	}

	r, err := Discover(workDir)
	if err != nil {
		t.Fatal(err)
	}
	skills := r.List()
	if len(skills) != 1 || skills[0].Name != "test1" || skills[0].Description != "First" || skills[0].Content != "Content1" || skills[0].Scope != "project" {
		t.Fatalf("expected concrete discovered project skill, got %+v", skills)
	}
}

func TestDiscoverProjectSkillOverridesUserSkill(t *testing.T) {
	workDir := t.TempDir()
	home := t.TempDir()
	t.Setenv("HOME", home)
	writeSkill(t, filepath.Join(home, ".config", "natalia-cli", "skills", "shared"), "shared", "User version", "user content")
	writeSkill(t, filepath.Join(workDir, ".natalia", "skills", "shared"), "shared", "Project version", "project content")
	writeSkill(t, filepath.Join(home, ".config", "natalia-cli", "skills", "user-only"), "user-only", "User only", "user only content")

	r, err := Discover(workDir)
	if err != nil {
		t.Fatal(err)
	}
	shared := r.Get("shared")
	if shared == nil || shared.Scope != "project" || shared.Description != "Project version" || shared.Content != "project content" {
		t.Fatalf("expected project skill to override user skill, got %+v", shared)
	}
	userOnly := r.Get("user-only")
	if userOnly == nil || userOnly.Scope != "user" || userOnly.Content != "user only content" {
		t.Fatalf("expected user-only skill to be discovered, got %+v", userOnly)
	}
}

func TestRegistryFormatForPromptGroupsScopesAndOmitsBuiltin(t *testing.T) {
	if got := (&Registry{}).FormatForPrompt(); got != "" {
		t.Fatalf("expected empty registry prompt to be empty, got %q", got)
	}
	r := &Registry{}
	r.Add(Skill{Name: "project-a", Description: "Project A", Scope: "project"})
	r.Add(Skill{Name: "user-a", Description: "User A", Scope: "user"})
	r.Add(Skill{Name: "builtin-a", Description: "Builtin A", Scope: "builtin"})
	prompt := r.FormatForPrompt()
	for _, want := range []string{"## 可用技能", "### 项目技能", "- project-a: Project A", "### 用户技能", "- user-a: User A", "skill_read <name>"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected prompt to contain %q, got %q", want, prompt)
		}
	}
	if strings.Contains(prompt, "builtin-a") {
		t.Fatalf("expected builtin skills to be omitted by current prompt contract, got %q", prompt)
	}
}

func writeSkill(t *testing.T, dir, name, description, content string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	data := "---\nname: " + name + "\ndescription: " + description + "\n---\n" + content
	if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(data), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestRegistryGet(t *testing.T) {
	r := &Registry{}
	r.Add(Skill{Name: "test-skill", Description: "test"})
	s := r.Get("test-skill")
	if s == nil {
		t.Fatal("expected to find skill")
	}
	if s.Name != "test-skill" {
		t.Errorf("expected test-skill, got %s", s.Name)
	}
}

func TestRegistryGetCaseInsensitive(t *testing.T) {
	r := &Registry{}
	r.Add(Skill{Name: "MySkill"})
	s := r.Get("myskill")
	if s == nil {
		t.Fatal("expected case-insensitive match")
	}
}

func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}

func TestParseFlow(t *testing.T) {
	yaml := `
nodes:
  - id: begin
    label: BEGIN
    kind: begin
  - id: step1
    label: "Step 1"
    kind: task
  - id: end
    label: END
    kind: end
edges:
  - src: begin
    dst: step1
  - src: step1
    dst: end
`
	f, err := ParseFlow(yaml)
	if err != nil {
		t.Fatal(err)
	}
	if f.BeginID() != "begin" {
		t.Errorf("expected begin, got %s", f.BeginID())
	}
	if f.Node("step1") == nil {
		t.Error("step1 node should exist")
	}
}

func TestFlowRunner(t *testing.T) {
	yaml := `
nodes:
  - id: begin
    label: BEGIN
    kind: begin
  - id: task1
    label: "Do something"
    kind: task
  - id: end
    label: END
    kind: end
edges:
  - src: begin
    dst: task1
  - src: task1
    dst: end
`
	f, _ := ParseFlow(yaml)
	r := NewFlowRunner(f)

	// Begin auto-advances
	node, prompt, err := r.Advance("")
	if err != nil {
		t.Fatal(err)
	}
	if node == nil || node.ID != "task1" {
		t.Errorf("expected task1, got %v", node)
	}
	if prompt != "Do something" {
		t.Errorf("expected 'Do something', got %s", prompt)
	}

	// Task advances to end
	node, _, err = r.Advance("")
	if err != nil {
		t.Fatal(err)
	}
	if !r.IsDone() {
		t.Error("should be done")
	}
}

func TestFlowDecision(t *testing.T) {
	yaml := `
nodes:
  - id: begin
    label: BEGIN
    kind: begin
  - id: decide
    label: "Choose path"
    kind: decision
  - id: pathA
    label: "Path A"
    kind: task
  - id: pathB
    label: "Path B"
    kind: task
  - id: end
    label: END
    kind: end
edges:
  - src: begin
    dst: decide
  - src: decide
    dst: pathA
    label: A
  - src: decide
    dst: pathB
    label: B
  - src: pathA
    dst: end
  - src: pathB
    dst: end
`
	f, _ := ParseFlow(yaml)
	r := NewFlowRunner(f)

	r.Advance("") // begin → decide

	// Decision without choice should return options
	_, msg, _ := r.Advance("")
	if !contains(msg, "A") || !contains(msg, "B") {
		t.Errorf("expected options A and B, got %s", msg)
	}

	node, msg, err := r.Advance("B")
	if err != nil {
		t.Fatal(err)
	}
	if node == nil || node.ID != "pathB" || msg != "Path B" {
		t.Fatalf("expected pathB after choice B, node=%+v msg=%q", node, msg)
	}
	node, _, err = r.Advance("")
	if err != nil {
		t.Fatal(err)
	}
	if node == nil || node.Kind != NodeEnd || !r.IsDone() {
		t.Fatalf("expected flow to reach end, node=%+v done=%v", node, r.IsDone())
	}
}

func TestFlowRunnerErrorAndBoundaryPaths(t *testing.T) {
	f, err := ParseFlow(`
nodes:
  - id: begin
    label: BEGIN
    kind: begin
  - id: decide
    label: Pick one
    kind: decision
  - id: end
    label: END
    kind: end
edges:
  - src: begin
    dst: decide
  - src: decide
    dst: end
    label: done
`)
	if err != nil {
		t.Fatal(err)
	}
	r := NewFlowRunner(f)
	if _, _, err := r.Advance(""); err != nil {
		t.Fatal(err)
	}
	if _, _, err := r.Advance("missing"); err == nil || !strings.Contains(err.Error(), "invalid choice") {
		t.Fatalf("expected invalid decision choice error, got %v", err)
	}
	if _, _, err := r.Advance("done"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := r.Advance(""); err == nil || !strings.Contains(err.Error(), "已结束") {
		t.Fatalf("expected already done error, got %v", err)
	}
}
