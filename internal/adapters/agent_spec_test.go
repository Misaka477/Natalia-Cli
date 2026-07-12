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
