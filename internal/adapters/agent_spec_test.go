package adapters

import (
	"strings"
	"testing"
)

func TestImportGenericAgentSpecYAMLConvertsToResolvedAgentSpec(t *testing.T) {
	spec, err := ImportGenericAgentSpecYAML([]byte(`
name: external-coder
system_prompt_path: ./system.md
model_profile: strong
when_to_use: coding tasks
tools:
  - read_file
  - grep
allowed_tools:
  - read_file
exclude_tools:
  - run_shell
modes:
  review:
    extends: code
    permission_profile: read_only
    tools:
      exclude: [write_file]
subagents:
  explore:
    path: ./explore.yaml
    description: Explore code
`))
	if err != nil {
		t.Fatal(err)
	}
	if spec.Name != "external-coder" || spec.ModelProfile != "strong" || spec.WhenToUse != "coding tasks" || len(spec.Tools) != 2 {
		t.Fatalf("unexpected converted spec: %+v", spec)
	}
	if spec.Modes["review"].PermissionProfile != "read_only" || spec.Modes["review"].Tools.Exclude[0] != "write_file" {
		t.Fatalf("unexpected converted modes: %+v", spec.Modes)
	}
	if spec.Subagents["explore"].Description != "Explore code" {
		t.Fatalf("unexpected converted subagents: %+v", spec.Subagents)
	}
}

func TestImportGenericAgentSpecYAMLRejectsMissingName(t *testing.T) {
	if _, err := ImportGenericAgentSpecYAML([]byte("tools: [read_file]")); err == nil || !strings.Contains(err.Error(), "name") {
		t.Fatalf("expected missing name error, got %v", err)
	}
}

func TestImportKimiAgentSpecYAMLBestEffort(t *testing.T) {
	res, err := ImportKimiAgentSpecYAML("agents/default/agent.yaml", []byte(`version: 1
agent:
  name: kimi-coder
  model_profile: strong
  tools: [read_file, grep]
  allowed_tools: [read_file]
  modes:
    review:
      permission_profile: read_only
`))
	if err != nil {
		t.Fatal(err)
	}
	if res.Spec.Name != "kimi-coder" || res.Spec.ModelProfile != "strong" || len(res.Spec.Tools) != 2 || res.Diagnostic.Format != "kimi" || res.Diagnostic.Source != "agents/default/agent.yaml" {
		t.Fatalf("unexpected Kimi import: %+v", res)
	}
	if res.Spec.Modes["review"].PermissionProfile != "read_only" || len(res.Diagnostic.Notes) == 0 {
		t.Fatalf("expected modes and diagnostics, got %+v", res)
	}
}

func TestImportKiloAgentMarkdownBestEffort(t *testing.T) {
	res, err := ImportKiloAgentMarkdown(".kilo/agent/reviewer.md", []byte(`---
name: reviewer
description: Review code
tools: read_file, grep
---
You review code and report bugs first.
`))
	if err != nil {
		t.Fatal(err)
	}
	if res.Spec.Name != "reviewer" || res.Spec.WhenToUse != "Review code" || !strings.Contains(res.Spec.SystemPromptArgs["INLINE_PROMPT"], "report bugs") || res.Diagnostic.Format != "kilo" {
		t.Fatalf("unexpected Kilo import: %+v", res)
	}
	if len(res.Spec.AllowedTools) != 2 || res.Spec.AllowedTools[0] != "read_file" || len(res.Diagnostic.Notes) == 0 {
		t.Fatalf("expected tools and diagnostics, got %+v", res)
	}
}
