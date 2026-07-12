package agentspec

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadDefaultAgentSpec(t *testing.T) {
	spec, err := LoadDefaultAgentSpec()
	if err != nil {
		t.Fatalf("LoadDefaultAgentSpec failed: %v", err)
	}
	if spec.Name != "default" {
		t.Fatalf("expected default agent, got %q", spec.Name)
	}
	if len(spec.Tools) == 0 {
		t.Fatal("expected default tools")
	}
	if spec.ModelProfile != "default" {
		t.Fatalf("expected default model profile, got %q", spec.ModelProfile)
	}
	if spec.Modes["plan"].ModelProfile != "strongest" || spec.Modes["debug"].ModelProfile != "strongest" {
		t.Fatalf("expected plan/debug to use strongest model, got %+v", spec.Modes)
	}
	prompt, err := spec.RenderSystemPrompt(TemplateArgs{WorkDir: "/tmp/work", Now: "now", Shell: "/bin/zsh"})
	if err != nil {
		t.Fatalf("RenderSystemPrompt failed: %v", err)
	}
	if !strings.Contains(prompt, "当前工作目录: /tmp/work") || !strings.Contains(prompt, "Shell: /bin/zsh") {
		t.Fatalf("template args were not rendered: %s", prompt)
	}
}

func TestLoadAgentSpecExtendsDefault(t *testing.T) {
	dir := t.TempDir()
	childPath := filepath.Join(dir, "child.yaml")
	if err := os.WriteFile(childPath, []byte(`version: 1
agent:
  extend: default
  name: coder
  system_prompt_args:
    Extra: value
  allowed_tools:
    - read_file
  exclude_tools:
    - run_shell
  modes:
    review:
      extends: code
      model_profile: strong
      permission_profile: read_only
      system_prompt_path: ./review.md
      tools:
        exclude:
          - write_file
  subagents:
    helper:
      path: ./helper.yaml
      description: Helper agent
`), 0644); err != nil {
		t.Fatal(err)
	}
	spec, err := LoadAgentSpec(childPath)
	if err != nil {
		t.Fatalf("LoadAgentSpec failed: %v", err)
	}
	if spec.Name != "coder" {
		t.Fatalf("expected child name, got %q", spec.Name)
	}
	if len(spec.Tools) == 0 {
		t.Fatal("expected tools inherited from default")
	}
	if spec.SystemPromptArgs["Extra"] != "value" {
		t.Fatalf("expected merged prompt args, got %v", spec.SystemPromptArgs)
	}
	if len(spec.AllowedTools) != 1 || spec.AllowedTools[0] != "read_file" {
		t.Fatalf("expected merged allowed tools, got %+v", spec.AllowedTools)
	}
	if got := spec.Subagents["helper"].Path; got != filepath.Join(dir, "helper.yaml") {
		t.Fatalf("expected resolved subagent path, got %q", got)
	}
	review := spec.Modes["review"]
	if review.Extends != "code" || review.ModelProfile != "strong" || review.PermissionProfile != "read_only" {
		t.Fatalf("expected merged review mode, got %+v", review)
	}
	if review.SystemPromptPath != filepath.Join(dir, "review.md") {
		t.Fatalf("expected resolved mode prompt path, got %q", review.SystemPromptPath)
	}
	if len(review.Tools.Exclude) != 1 || review.Tools.Exclude[0] != "write_file" {
		t.Fatalf("expected mode tool exclusions, got %+v", review.Tools)
	}
}

func TestLoadAgentSpecRelativeExtend(t *testing.T) {
	dir := t.TempDir()
	basePath := filepath.Join(dir, "base.yaml")
	childPath := filepath.Join(dir, "child.yaml")
	if err := os.WriteFile(filepath.Join(dir, "system.md"), []byte("hello {{.WorkDir}}"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(basePath, []byte(`version: 1
agent:
  name: base
  system_prompt_path: ./system.md
  tools:
    - natalia/tools/file:Read
`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(childPath, []byte(`version: 1
agent:
  extend: ./base.yaml
  name: child
  tools:
    - natalia/tools/file:Write
`), 0644); err != nil {
		t.Fatal(err)
	}
	spec, err := LoadAgentSpec(childPath)
	if err != nil {
		t.Fatalf("LoadAgentSpec failed: %v", err)
	}
	if spec.Name != "child" || len(spec.Tools) != 1 || spec.Tools[0] != "natalia/tools/file:Write" {
		t.Fatalf("unexpected resolved spec: %+v", spec)
	}
	if spec.SystemPromptPath != filepath.Join(dir, "system.md") {
		t.Fatalf("expected inherited resolved prompt path, got %q", spec.SystemPromptPath)
	}
}

func TestLoadAgentSpecRendersCustomPromptArgsFromRelativeSpec(t *testing.T) {
	dir := t.TempDir()
	specPath := filepath.Join(dir, "agent.yaml")
	if err := os.WriteFile(filepath.Join(dir, "system.md"), []byte("work={{.WorkDir}} extra={{.Extra}} shell={{.Shell}}"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(specPath, []byte(`version: 1
agent:
  name: custom
  system_prompt_path: ./system.md
  system_prompt_args:
    Extra: custom-value
  tools:
    - natalia/tools/file:Read
`), 0644); err != nil {
		t.Fatal(err)
	}
	spec, err := LoadAgentSpec(specPath)
	if err != nil {
		t.Fatal(err)
	}
	prompt, err := spec.RenderSystemPrompt(TemplateArgs{WorkDir: "/repo", Shell: "/bin/bash"})
	if err != nil {
		t.Fatal(err)
	}
	if prompt != "work=/repo extra=custom-value shell=/bin/bash" {
		t.Fatalf("unexpected rendered prompt: %q", prompt)
	}
}

func TestLoadAgentSpecRejectsUnsupportedVersion(t *testing.T) {
	dir := t.TempDir()
	specPath := filepath.Join(dir, "agent.yaml")
	if err := os.WriteFile(specPath, []byte(`version: 99
agent:
  name: future
`), 0644); err != nil {
		t.Fatal(err)
	}
	_, err := LoadAgentSpec(specPath)
	if err == nil || !strings.Contains(err.Error(), "unsupported agent spec version") {
		t.Fatalf("expected unsupported version error, got %v", err)
	}
}

func TestLoadAgentSpecRejectsExtendCycle(t *testing.T) {
	dir := t.TempDir()
	aPath := filepath.Join(dir, "a.yaml")
	bPath := filepath.Join(dir, "b.yaml")
	if err := os.WriteFile(aPath, []byte(`version: 1
agent:
  extend: ./b.yaml
  name: a
  system_prompt_path: ./system.md
  tools:
    - natalia/tools/file:Read
`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(bPath, []byte(`version: 1
agent:
  extend: ./a.yaml
  name: b
  system_prompt_path: ./system.md
  tools:
    - natalia/tools/file:Read
`), 0644); err != nil {
		t.Fatal(err)
	}
	_, err := LoadAgentSpec(aPath)
	if err == nil || !strings.Contains(err.Error(), "extend cycle") {
		t.Fatalf("expected extend cycle error, got %v", err)
	}
}
