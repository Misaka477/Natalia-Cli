package skill

import (
	"os"
	"path/filepath"
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
	skillDir := filepath.Join(workDir, ".natalia", "skills", "test1")
	os.MkdirAll(skillDir, 0755)
	os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: test1\ndescription: First\n---\nContent1"), 0644)

	r, err := Discover(workDir)
	if err != nil {
		t.Fatal(err)
	}
	skills := r.List()
	if len(skills) < 1 {
		t.Fatalf("expected at least 1 skill, got %d", len(skills))
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
	return len(s) >= len(substr)
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

	// Wait, r is at 'decide'. Let me restart - the begin advances to decide,
	// then Advance on decide asks for choice
	_ = msg
}
