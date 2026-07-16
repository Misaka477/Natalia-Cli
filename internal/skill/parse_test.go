package skill

import (
	"strings"
	"testing"
)

func TestParseSKILLReader_ValidFull(t *testing.T) {
	input := `---
name: test-skill
description: A test skill
license: MIT
compatibility:
  natalia: ">=1.0.0"
  claude: "^3.5"
metadata:
  author: test
  version: "1.0.0"
allowed-tools:
  - bash
  - read
invocation:
  type: macro
  macro: /test
tool-policy:
  bash:
    require-approval: true
    allowed:
      - ls
    denied:
      - rm
    max-calls: 10
paths:
  - src/
  - test/
model: claude-sonnet-4
effort: high
context:
  fork: true
  agent: test-agent
  sub-agents:
    - helper
openai:
  title: Test Skill
  group: testing
  icon: test
  prompt: Run tests
  description: OpenAI metadata
---
# Body content

Here is the skill body.`

	fm, body, err := ParseSKILLReader(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}

	if fm.Name != "test-skill" {
		t.Errorf("Name = %q, want %q", fm.Name, "test-skill")
	}
	if fm.Description != "A test skill" {
		t.Errorf("Description = %q, want %q", fm.Description, "A test skill")
	}
	if fm.License != "MIT" {
		t.Errorf("License = %q, want %q", fm.License, "MIT")
	}
	if fm.Compatibility["natalia"] != ">=1.0.0" {
		t.Errorf("Compatibility[natalia] = %q, want %q", fm.Compatibility["natalia"], ">=1.0.0")
	}
	if fm.Metadata["author"] != "test" {
		t.Errorf("Metadata[author] = %q, want %q", fm.Metadata["author"], "test")
	}
	if len(fm.AllowedTools) != 2 || fm.AllowedTools[0] != "bash" {
		t.Errorf("AllowedTools = %v, want [bash read]", fm.AllowedTools)
	}
	if fm.Invocation == nil || fm.Invocation.Type != "macro" || fm.Invocation.Macro != "/test" {
		t.Errorf("Invocation = %+v", fm.Invocation)
	}
	if fm.ToolPolicy == nil {
		t.Fatal("ToolPolicy is nil")
	}
	bashRule := (*fm.ToolPolicy)["bash"]
	if !bashRule.RequireApproval || bashRule.MaxCalls != 10 {
		t.Errorf("ToolPolicy[bash] = %+v", bashRule)
	}
	if len(fm.Paths) != 2 || fm.Paths[0] != "src/" {
		t.Errorf("Paths = %v", fm.Paths)
	}
	if fm.Model != "claude-sonnet-4" {
		t.Errorf("Model = %q", fm.Model)
	}
	if fm.Effort != "high" {
		t.Errorf("Effort = %q", fm.Effort)
	}
	if fm.Context == nil || !fm.Context.Fork || fm.Context.Agent != "test-agent" {
		t.Errorf("Context = %+v", fm.Context)
	}
	if fm.CodexMetadata == nil || fm.CodexMetadata.Title != "Test Skill" || fm.CodexMetadata.Group != "testing" {
		t.Errorf("CodexMetadata = %+v", fm.CodexMetadata)
	}
	if !strings.Contains(body, "Body content") {
		t.Errorf("body = %q, should contain Body content", body)
	}
}

func TestParseSKILLReader_MissingName(t *testing.T) {
	input := `---
description: no name
---
body`
	_, _, err := ParseSKILLReader(strings.NewReader(input))
	if err == nil || !strings.Contains(err.Error(), "name is required") {
		t.Fatalf("expected 'name is required' error, got %v", err)
	}
}

func TestParseSKILLReader_MissingDescription(t *testing.T) {
	input := `---
name: no-desc
---
body`
	_, _, err := ParseSKILLReader(strings.NewReader(input))
	if err == nil || !strings.Contains(err.Error(), "description is required") {
		t.Fatalf("expected 'description is required' error, got %v", err)
	}
}

func TestParseSKILLReader_NoFrontmatter(t *testing.T) {
	input := `# Just a skill
Some content`
	_, _, err := ParseSKILLReader(strings.NewReader(input))
	if err == nil || !strings.Contains(err.Error(), "name is required") {
		t.Fatalf("expected 'name is required' error, got %v", err)
	}
}

func TestParseSKILLReader_ClaudeExtensions(t *testing.T) {
	input := `---
name: claude-skill
description: Claude extension test
invocation:
  type: prompt
  prompt: "You are a test agent"
tool-policy:
  read:
    require-approval: false
  edit:
    allowed:
      - "*.go"
    denied:
      - "vendor/*"
context:
  fork: false
  sub-agents:
    - sub1
    - sub2
---
Body`

	fm, _, err := ParseSKILLReader(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}

	if fm.Invocation.Type != "prompt" || fm.Invocation.Prompt != "You are a test agent" {
		t.Errorf("Invocation = %+v", fm.Invocation)
	}

	readRule := (*fm.ToolPolicy)["read"]
	if readRule.RequireApproval {
		t.Error("read.RequireApproval should be false")
	}
	editRule := (*fm.ToolPolicy)["edit"]
	if len(editRule.Allowed) != 1 || editRule.Allowed[0] != "*.go" {
		t.Errorf("edit.Allowed = %v", editRule.Allowed)
	}

	if fm.Context.Fork || fm.Context.Agent != "" {
		t.Errorf("Context = %+v", fm.Context)
	}
	if len(fm.Context.SubAgents) != 2 || fm.Context.SubAgents[1] != "sub2" {
		t.Errorf("SubAgents = %v", fm.Context.SubAgents)
	}
}

func TestParseSKILLReader_CodexExtensions(t *testing.T) {
	input := `---
name: codex-skill
description: Codex extension test
openai:
  title: Codex Skill
  group: development
  icon: code
  prompt: Write code
  description: A codex skill
---
Body`

	fm, _, err := ParseSKILLReader(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}

	if fm.CodexMetadata == nil {
		t.Fatal("CodexMetadata is nil")
	}
	if fm.CodexMetadata.Title != "Codex Skill" {
		t.Errorf("Title = %q", fm.CodexMetadata.Title)
	}
	if fm.CodexMetadata.Group != "development" {
		t.Errorf("Group = %q", fm.CodexMetadata.Group)
	}
	if fm.CodexMetadata.Icon != "code" {
		t.Errorf("Icon = %q", fm.CodexMetadata.Icon)
	}
	if fm.CodexMetadata.Prompt != "Write code" {
		t.Errorf("Prompt = %q", fm.CodexMetadata.Prompt)
	}
	if fm.CodexMetadata.Description != "A codex skill" {
		t.Errorf("Description = %q", fm.CodexMetadata.Description)
	}
}

func TestParseSKILLReader_EmptyBody(t *testing.T) {
	input := `---
name: empty-body
description: No body content
---`
	fm, body, err := ParseSKILLReader(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	if fm.Name != "empty-body" {
		t.Errorf("Name = %q", fm.Name)
	}
	if body != "" {
		t.Errorf("body should be empty, got %q", body)
	}
}

func TestParseSKILLReader_YAMLParseError(t *testing.T) {
	input := `---
name: broken
description: broken
invalid_yaml: [key: value
---`
	_, _, err := ParseSKILLReader(strings.NewReader(input))
	if err == nil || !strings.Contains(err.Error(), "parsing frontmatter YAML") {
		t.Fatalf("expected YAML parse error, got %v", err)
	}
}

func TestParseSKILLReader_IncompleteFrontmatter(t *testing.T) {
	input := `---
name: incomplete
description: no closing delimiter`
	_, _, err := ParseSKILLReader(strings.NewReader(input))
	if err == nil || !strings.Contains(err.Error(), "no closing ---") {
		t.Fatalf("expected 'no closing ---' error, got %v", err)
	}
}

func TestValidate_Valid(t *testing.T) {
	fm := &SkillFrontmatter{
		Name:        "valid",
		Description: "A valid skill",
		License:     "MIT",
	}
	result := Validate(fm)
	if !result.Valid {
		t.Fatalf("expected valid, got errors: %v, warnings: %v", result.Errors, result.Warnings)
	}
	if len(result.Errors) > 0 {
		t.Errorf("unexpected errors: %v", result.Errors)
	}
}

func TestValidate_EmptyNameAndDescription(t *testing.T) {
	fm := &SkillFrontmatter{}
	result := Validate(fm)
	if result.Valid {
		t.Fatal("expected invalid")
	}
	if len(result.Errors) != 2 {
		t.Fatalf("expected 2 errors, got %v", result.Errors)
	}
}

func TestValidate_UnknownLicense(t *testing.T) {
	fm := &SkillFrontmatter{
		Name:        "test",
		Description: "test",
		License:     "Proprietary",
	}
	result := Validate(fm)
	if !result.Valid {
		t.Fatalf("expected valid with warning, got errors: %v", result.Errors)
	}
	if len(result.Warnings) != 1 || !strings.Contains(result.Warnings[0], "unusual license") {
		t.Fatalf("expected unusual license warning, got %v", result.Warnings)
	}
}

func TestValidate_CompatibilityVersionRange(t *testing.T) {
	tests := []struct {
		rangeStr string
		valid    bool
	}{
		{">=1.0.0", true},
		{"^3.5", true},
		{"~1.2", true},
		{"1.x", true},
		{"*", true},
		{">=1.0.0 <2.0.0", true},
		{"", false},
	}

	for _, tt := range tests {
		result := isValidVersionRange(tt.rangeStr)
		if result != tt.valid {
			t.Errorf("isValidVersionRange(%q) = %v, want %v", tt.rangeStr, result, tt.valid)
		}
	}
}

func TestValidate_CompatibilityWarnings(t *testing.T) {
	fm := &SkillFrontmatter{
		Name:        "test",
		Description: "test",
		Compatibility: map[string]string{
			"natalia": ">=1.0.0",
			"invalid": "",
			"claude":  "^3.5",
		},
	}
	result := Validate(fm)
	if !result.Valid {
		t.Fatalf("expected valid, got errors: %v", result.Errors)
	}
	if len(result.Warnings) > 0 {
		t.Fatalf("expected no warnings for valid ranges, got %v", result.Warnings)
	}
}

func TestValidate_EmptyCompatibilityKey(t *testing.T) {
	fm := &SkillFrontmatter{
		Name:        "test",
		Description: "test",
		Compatibility: map[string]string{
			"": ">=1.0.0",
		},
	}
	result := Validate(fm)
	if !result.Valid {
		t.Fatalf("expected valid, got errors: %v", result.Errors)
	}
	found := false
	for _, w := range result.Warnings {
		if strings.Contains(w, "compatibility key is empty") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected empty key warning, got %v", result.Warnings)
	}
}

func TestParseSKILLReader_PreservesBodyDelimiters(t *testing.T) {
	input := `---
name: has-inline-code
description: Code blocks with ---
---
Here is inline --- delimiter
\` + "`" + `---
code block
\` + "`" + `
`

	fm, body, err := ParseSKILLReader(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	if fm.Name != "has-inline-code" {
		t.Errorf("Name = %q", fm.Name)
	}
	if !strings.Contains(body, "inline --- delimiter") {
		t.Errorf("body should contain inline ---, got %q", body)
	}
}

func TestParseSKILL_FileNotFound(t *testing.T) {
	_, _, err := ParseSKILL("/nonexistent/path/SKILL.md")
	if err == nil {
		t.Fatal("expected error for nonexistent file")
	}
}
