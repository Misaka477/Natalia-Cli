package skill

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestListSkills_Empty(t *testing.T) {
	r := NewSkillRegistry()
	output := ListSkills(r)
	if !strings.Contains(output, "no skills registered") {
		t.Errorf("expected 'no skills registered', got %q", output)
	}
}

func TestListSkills_Nil(t *testing.T) {
	output := ListSkills(nil)
	if !strings.Contains(output, "no skills registered") {
		t.Errorf("expected 'no skills registered', got %q", output)
	}
}

func TestListSkills_WithEntries(t *testing.T) {
	r := NewSkillRegistry()
	r.Register("/a", &SkillFrontmatter{Name: "alpha", Description: "first skill"}, "", "root", nil, "user")
	r.Register("/b", &SkillFrontmatter{Name: "beta", Description: "second skill"}, "", "root", nil, "project")

	output := ListSkills(r)
	if !strings.Contains(output, "user:alpha") {
		t.Errorf("expected user:alpha in output, got %q", output)
	}
	if !strings.Contains(output, "project:beta") {
		t.Errorf("expected project:beta in output, got %q", output)
	}
	if !strings.Contains(output, "first skill") {
		t.Errorf("expected 'first skill' in output, got %q", output)
	}
	if !strings.Contains(output, "second skill") {
		t.Errorf("expected 'second skill' in output, got %q", output)
	}
}

func TestListSkills_ShowsDisabled(t *testing.T) {
	r := NewSkillRegistry()
	r.Register("/a", &SkillFrontmatter{Name: "alpha", Description: "first"}, "", "root", nil, "user")
	r.SetDisabled("user:alpha", true)

	output := ListSkills(r)
	if !strings.Contains(output, "[disabled]") {
		t.Errorf("expected [disabled] marker in output, got %q", output)
	}
}

func TestShowSkill_NilEntry(t *testing.T) {
	output := ShowSkill(nil)
	if output != "skill not found" {
		t.Errorf("expected 'skill not found', got %q", output)
	}
}

func TestShowSkill_FullEntry(t *testing.T) {
	entry := &Entry{
		QualifiedName: "user:test-skill",
		Metadata: &SkillFrontmatter{
			Name:         "test-skill",
			Description:  "A test skill",
			License:      "MIT",
			AllowedTools: []string{"bash", "read"},
			Invocation:   &ClaudeInvocation{Type: "macro", Macro: "/test"},
			Compatibility: map[string]string{
				"natalia": ">=1.0.0",
			},
		},
		Body: "This is the body content of the skill.",
	}

	output := ShowSkill(entry)
	for _, want := range []string{"user:test-skill", "test-skill", "A test skill", "MIT", "bash, read", "macro=/test", "body content"} {
		if !strings.Contains(output, want) {
			t.Errorf("expected output to contain %q, got %q", want, output)
		}
	}
}

func TestShowSkill_MinimalEntry(t *testing.T) {
	entry := &Entry{
		QualifiedName: "project:minimal",
		Metadata: &SkillFrontmatter{
			Name:        "minimal",
			Description: "",
		},
		Body: "",
	}

	output := ShowSkill(entry)
	if !strings.Contains(output, "project:minimal") {
		t.Errorf("expected project:minimal in output, got %q", output)
	}
}

func TestValidateSkills_Empty(t *testing.T) {
	r := NewSkillRegistry()
	results := ValidateSkills(r)
	if len(results) != 1 || !strings.Contains(results[0], "no skills registered") {
		t.Errorf("expected 'no skills registered', got %v", results)
	}
}

func TestValidateSkills_Nil(t *testing.T) {
	results := ValidateSkills(nil)
	if len(results) != 1 || !strings.Contains(results[0], "no skills registered") {
		t.Errorf("expected 'no skills registered', got %v", results)
	}
}

func TestValidateSkills_AllValid(t *testing.T) {
	r := NewSkillRegistry()
	r.Register("/a", &SkillFrontmatter{Name: "valid1", Description: "first"}, "", "r1", nil, "user")
	r.Register("/b", &SkillFrontmatter{Name: "valid2", Description: "second"}, "", "r2", nil, "project")

	results := ValidateSkills(r)
	for _, res := range results {
		if !strings.HasSuffix(res, ": OK") {
			t.Errorf("expected OK result, got %q", res)
		}
	}
}

func TestValidateSkills_WithErrors(t *testing.T) {
	r := NewSkillRegistry()
	r.Register("/a", &SkillFrontmatter{Name: "", Description: "missing name"}, "", "r1", nil, "user")
	r.Register("/b", &SkillFrontmatter{Name: "ok", Description: "valid"}, "", "r2", nil, "project")

	results := ValidateSkills(r)
	foundError := false
	foundOK := false
	for _, res := range results {
		if strings.Contains(res, "ERROR: name is required") {
			foundError = true
		}
		if strings.HasSuffix(res, ": OK") {
			foundOK = true
		}
	}
	if !foundError {
		t.Errorf("expected ERROR for missing name, got %v", results)
	}
	if !foundOK {
		t.Errorf("expected OK for valid skill, got %v", results)
	}
}

func TestValidateSkills_WithWarnings(t *testing.T) {
	r := NewSkillRegistry()
	r.Register("/a", &SkillFrontmatter{
		Name:        "test",
		Description: "test",
		License:     "Proprietary",
	}, "", "r1", nil, "user")

	results := ValidateSkills(r)
	foundWarning := false
	for _, res := range results {
		if strings.Contains(res, "WARNING: unusual license") {
			foundWarning = true
		}
	}
	if !foundWarning {
		t.Errorf("expected WARNING for unusual license, got %v", results)
	}
}

func TestEnableSkill_NotFound(t *testing.T) {
	r := NewSkillRegistry()
	_, err := EnableSkill(r, "user:nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent skill")
	}
}

func TestEnableSkill_Success(t *testing.T) {
	r := NewSkillRegistry()
	fm := &SkillFrontmatter{Name: "test", Description: "test skill"}
	r.Register("/a", fm, "body content", "root", nil, "user")

	act, err := EnableSkill(r, "user:test")
	if err != nil {
		t.Fatal(err)
	}
	if act == nil {
		t.Fatal("expected non-nil activation")
	}
	if !act.IsActive() {
		t.Error("expected activation to be active")
	}
	if act.Body() != "body content" {
		t.Errorf("expected body 'body content', got %q", act.Body())
	}
}

func TestEnableSkill_ReEnabledAfterDisable(t *testing.T) {
	r := NewSkillRegistry()
	fm := &SkillFrontmatter{Name: "test", Description: "test skill"}
	r.Register("/a", fm, "body", "root", nil, "user")

	err := DisableSkill(r, "user:test")
	if err != nil {
		t.Fatal(err)
	}
	if !r.IsDisabled("user:test") {
		t.Error("expected skill to be disabled")
	}

	act, err := EnableSkill(r, "user:test")
	if err != nil {
		t.Fatal(err)
	}
	if act == nil {
		t.Fatal("expected non-nil activation after re-enable")
	}
	if !act.IsActive() {
		t.Error("expected activation to be active")
	}
	if r.IsDisabled("user:test") {
		t.Error("expected skill to no longer be disabled after enable")
	}
}

func TestDisableSkill_NotFound(t *testing.T) {
	r := NewSkillRegistry()
	err := DisableSkill(r, "user:nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent skill")
	}
}

func TestDisableSkill_Success(t *testing.T) {
	r := NewSkillRegistry()
	fm := &SkillFrontmatter{Name: "test", Description: "test skill"}
	r.Register("/a", fm, "", "root", nil, "user")

	err := DisableSkill(r, "user:test")
	if err != nil {
		t.Fatal(err)
	}
	if !r.IsDisabled("user:test") {
		t.Error("expected skill to be marked as disabled")
	}
}

func TestEnableDisableLifecycle(t *testing.T) {
	r := NewSkillRegistry()
	fm := &SkillFrontmatter{Name: "cycle", Description: "lifecycle test"}
	r.Register("/a", fm, "body", "root", nil, "user")

	act, err := EnableSkill(r, "user:cycle")
	if err != nil {
		t.Fatal(err)
	}
	if !act.IsActive() {
		t.Error("expected active after enable")
	}

	err = DisableSkill(r, "user:cycle")
	if err != nil {
		t.Fatal(err)
	}
	if !r.IsDisabled("user:cycle") {
		t.Error("expected disabled after disable")
	}

	act2, err := EnableSkill(r, "user:cycle")
	if err != nil {
		t.Fatal(err)
	}
	if !act2.IsActive() {
		t.Error("expected active after re-enable")
	}
	if r.IsDisabled("user:cycle") {
		t.Error("expected not disabled after re-enable")
	}
	if act2 == act {
		t.Error("expected new activation after re-enable")
	}
}

func TestReloadSkills(t *testing.T) {
	tmpDir := t.TempDir()
	skillDir := filepath.Join(tmpDir, "my-skill")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: my-skill\ndescription: A test\n---\nBody content"), 0644); err != nil {
		t.Fatal(err)
	}

	reg, err := ReloadSkills([]string{tmpDir}, 10)
	if err != nil {
		t.Fatal(err)
	}
	if reg == nil {
		t.Fatal("expected non-nil registry")
	}

	entries := reg.List()
	if len(entries) != 1 {
		t.Fatalf("expected 1 skill, got %d", len(entries))
	}

	entry, err := reg.Resolve("user:my-skill")
	if err != nil {
		t.Fatal(err)
	}
	if entry.Metadata.Name != "my-skill" {
		t.Errorf("Name = %q", entry.Metadata.Name)
	}
	if entry.Metadata.Description != "A test" {
		t.Errorf("Description = %q", entry.Metadata.Description)
	}
}

func TestReloadSkills_Budget(t *testing.T) {
	tmpDir := t.TempDir()
	for _, name := range []string{"skill-a", "skill-b", "skill-c"} {
		d := filepath.Join(tmpDir, name)
		os.MkdirAll(d, 0755)
		os.WriteFile(filepath.Join(d, "SKILL.md"), []byte("---\nname: "+name+"\ndescription: test\n---\nbody"), 0644)
	}

	reg, err := ReloadSkills([]string{tmpDir}, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(reg.List()) != 2 {
		t.Errorf("expected 2 skills (budget=2), got %d", len(reg.List()))
	}
}

func TestReloadSkills_InvalidRoot(t *testing.T) {
	reg, err := ReloadSkills([]string{"/nonexistent"}, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(reg.List()) != 0 {
		t.Errorf("expected 0 skills for invalid root, got %d", len(reg.List()))
	}
}

func TestInvokeSkill_NilActivation(t *testing.T) {
	_, err := InvokeSkill(nil, nil)
	if err == nil {
		t.Fatal("expected error for nil activation")
	}
}

func TestInvokeSkill_Inactive(t *testing.T) {
	a := &Activation{}
	a.Deactivate()
	_, err := InvokeSkill(a, nil)
	if err == nil {
		t.Fatal("expected error for inactive skill")
	}
}

func TestInvokeSkill_NoInvocation(t *testing.T) {
	entry := &Entry{
		QualifiedName: "user:test",
		Metadata:      &SkillFrontmatter{Name: "test", Description: "test"},
	}
	a := &Activation{entry: entry, active: true}
	_, err := InvokeSkill(a, nil)
	if err == nil {
		t.Fatal("expected error for no invocation")
	}
}

func TestInvokeSkill_Macro(t *testing.T) {
	entry := &Entry{
		QualifiedName: "user:test",
		Metadata: &SkillFrontmatter{
			Name:        "test",
			Description: "test",
			Invocation:  &ClaudeInvocation{Type: "macro", Macro: "/test"},
		},
	}
	a := &Activation{entry: entry, active: true}

	result, err := InvokeSkill(a, nil)
	if err != nil {
		t.Fatal(err)
	}
	if result != "/test" {
		t.Errorf("expected '/test', got %q", result)
	}
}

func TestInvokeSkill_MacroWithArgs(t *testing.T) {
	entry := &Entry{
		QualifiedName: "user:test",
		Metadata: &SkillFrontmatter{
			Name:        "test",
			Description: "test",
			Invocation:  &ClaudeInvocation{Type: "macro", Macro: "/test"},
		},
	}
	a := &Activation{entry: entry, active: true}

	result, err := InvokeSkill(a, []string{"arg1", "arg2"})
	if err != nil {
		t.Fatal(err)
	}
	if result != "/test arg1 arg2" {
		t.Errorf("expected '/test arg1 arg2', got %q", result)
	}
}

func TestInvokeSkill_Prompt(t *testing.T) {
	entry := &Entry{
		QualifiedName: "user:test",
		Metadata: &SkillFrontmatter{
			Name:        "test",
			Description: "test",
			Invocation:  &ClaudeInvocation{Type: "prompt", Prompt: "You are a helpful assistant"},
		},
	}
	a := &Activation{entry: entry, active: true}

	result, err := InvokeSkill(a, nil)
	if err != nil {
		t.Fatal(err)
	}
	if result != "You are a helpful assistant" {
		t.Errorf("expected prompt text, got %q", result)
	}
}

func TestInvokeSkill_PromptWithArgs(t *testing.T) {
	entry := &Entry{
		QualifiedName: "user:test",
		Metadata: &SkillFrontmatter{
			Name:        "test",
			Description: "test",
			Invocation:  &ClaudeInvocation{Type: "prompt", Prompt: "You are a helpful assistant"},
		},
	}
	a := &Activation{entry: entry, active: true}

	result, err := InvokeSkill(a, []string{"extra context"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "extra context") {
		t.Errorf("expected prompt to include args, got %q", result)
	}
}

func TestInvokeSkill_UnknownType(t *testing.T) {
	entry := &Entry{
		QualifiedName: "user:test",
		Metadata: &SkillFrontmatter{
			Name:        "test",
			Description: "test",
			Invocation:  &ClaudeInvocation{Type: "unknown"},
		},
	}
	a := &Activation{entry: entry, active: true}

	_, err := InvokeSkill(a, nil)
	if err == nil {
		t.Fatal("expected error for unknown invocation type")
	}
}

func TestInvokeSkill_NilEntry(t *testing.T) {
	a := &Activation{active: true}
	_, err := InvokeSkill(a, nil)
	if err == nil {
		t.Fatal("expected error for nil entry")
	}
}

func TestListSkills_SortsByQualifiedName(t *testing.T) {
	r := NewSkillRegistry()
	r.Register("/c", &SkillFrontmatter{Name: "charlie", Description: "third"}, "", "r", nil, "project")
	r.Register("/a", &SkillFrontmatter{Name: "alpha", Description: "first"}, "", "r", nil, "user")
	r.Register("/b", &SkillFrontmatter{Name: "bravo", Description: "second"}, "", "r", nil, "user")

	output := ListSkills(r)
	lines := strings.Split(strings.TrimSpace(output), "\n")
	// Header + 3 entries
	if len(lines) != 4 {
		t.Fatalf("expected 4 lines, got %d: %v", len(lines), lines)
	}

	names := make([]string, 3)
	for i, line := range lines[1:] {
		parts := strings.Fields(line)
		if len(parts) > 0 {
			names[i] = parts[0]
		}
	}

	expected := []string{"project:charlie", "user:alpha", "user:bravo"}
	for i, n := range expected {
		if names[i] != n {
			t.Errorf("position %d: expected %q, got %q", i, n, names[i])
		}
	}
}

func TestShowSkill_WithResources(t *testing.T) {
	entry := &Entry{
		QualifiedName: "user:res-skill",
		Metadata: &SkillFrontmatter{
			Name:        "res-skill",
			Description: "has resources",
		},
		Body:      "body",
		Resources: []string{"script.sh", "config.json"},
	}

	output := ShowSkill(entry)
	if !strings.Contains(output, "script.sh") {
		t.Errorf("expected resources in output, got %q", output)
	}
	if !strings.Contains(output, "config.json") {
		t.Errorf("expected resources in output, got %q", output)
	}
}

func TestValidateSkills_SortsByQualifiedName(t *testing.T) {
	r := NewSkillRegistry()
	r.Register("/b", &SkillFrontmatter{Name: "beta", Description: "second"}, "", "r", nil, "user")
	r.Register("/a", &SkillFrontmatter{Name: "alpha", Description: "first"}, "", "r", nil, "user")

	results := ValidateSkills(r)
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	if !strings.HasPrefix(results[0], "user:alpha") {
		t.Errorf("expected user:alpha first, got %q", results[0])
	}
	if !strings.HasPrefix(results[1], "user:beta") {
		t.Errorf("expected user:beta second, got %q", results[1])
	}
}

func TestEnableSkill_NilRegistry(t *testing.T) {
	_, err := EnableSkill(nil, "user:test")
	if err == nil {
		t.Fatal("expected error for nil registry")
	}
}

func TestDisableSkill_NilRegistry(t *testing.T) {
	err := DisableSkill(nil, "user:test")
	if err == nil {
		t.Fatal("expected error for nil registry")
	}
}
