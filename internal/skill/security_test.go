package skill

import (
	"strings"
	"testing"
)

func TestApprovedTools_DefaultMode(t *testing.T) {
	requested := []string{"bash", "read", "write", "edit", "exec"}
	approved := ApprovedTools(requested, "default")
	expected := []string{"bash", "read", "write", "edit"}
	if len(approved) != len(expected) {
		t.Fatalf("expected %d approved, got %d: %v", len(expected), len(approved), approved)
	}
	for i, a := range approved {
		if a != expected[i] {
			t.Errorf("approved[%d] = %q, want %q", i, a, expected[i])
		}
	}
}

func TestApprovedTools_RestrictedMode(t *testing.T) {
	requested := []string{"bash", "read", "write", "glob", "grep", "exec"}
	approved := ApprovedTools(requested, "restricted")
	expected := []string{"read", "glob", "grep"}
	if len(approved) != len(expected) {
		t.Fatalf("expected %d approved, got %d: %v", len(expected), len(approved), approved)
	}
	for i, a := range approved {
		if a != expected[i] {
			t.Errorf("approved[%d] = %q, want %q", i, a, expected[i])
		}
	}
}

func TestApprovedTools_SandboxMode(t *testing.T) {
	requested := []string{"bash", "read", "write", "edit", "glob", "grep"}
	approved := ApprovedTools(requested, "sandbox")
	expected := []string{"read", "glob", "grep"}
	if len(approved) != len(expected) {
		t.Fatalf("expected %d approved, got %d: %v", len(expected), len(approved), approved)
	}
}

func TestApprovedTools_FullMode(t *testing.T) {
	requested := []string{"bash", "read", "agent", "write"}
	approved := ApprovedTools(requested, "full")
	if len(approved) != 4 {
		t.Fatalf("expected 4 approved, got %d: %v", len(approved), approved)
	}
}

func TestApprovedTools_UnknownModeFallsBackToDefault(t *testing.T) {
	requested := []string{"bash", "read", "exec"}
	approved := ApprovedTools(requested, "unknown-mode")
	if len(approved) != 2 {
		t.Fatalf("expected 2 approved (default mode fallback), got %d: %v", len(approved), approved)
	}
}

func TestApprovedTools_EmptyRequested(t *testing.T) {
	approved := ApprovedTools(nil, "default")
	if len(approved) != 0 {
		t.Fatalf("expected empty result for nil requested, got %v", approved)
	}
	approved = ApprovedTools([]string{}, "default")
	if len(approved) != 0 {
		t.Fatalf("expected empty result for empty requested, got %v", approved)
	}
}

func TestApprovedTools_CaseInsensitive(t *testing.T) {
	requested := []string{"Bash", "READ", "Write"}
	approved := ApprovedTools(requested, "default")
	if len(approved) != 3 {
		t.Fatalf("expected 3 approved (case-insensitive), got %d: %v", len(approved), approved)
	}
}

func TestEvaluatePolicy_NilFrontmatter(t *testing.T) {
	policy, warnings := EvaluatePolicy(nil, "default")
	if policy == nil {
		t.Fatal("expected non-nil policy")
	}
	if len(policy.AllowedTools) != 0 {
		t.Errorf("expected empty allowed tools, got %v", policy.AllowedTools)
	}
	if len(warnings) != 0 {
		t.Errorf("expected no warnings, got %v", warnings)
	}
}

func TestEvaluatePolicy_BasicFrontmatter(t *testing.T) {
	fm := &SkillFrontmatter{
		Name:         "test",
		Description:  "test skill",
		AllowedTools: []string{"bash", "read"},
	}

	policy, warnings := EvaluatePolicy(fm, "default")
	if policy == nil {
		t.Fatal("expected non-nil policy")
	}
	if len(policy.AllowedTools) != 2 {
		t.Errorf("expected 2 allowed tools, got %v", policy.AllowedTools)
	}
	if policy.RequireApproval {
		t.Error("expected RequireApproval false by default")
	}
	if policy.MaxScriptCalls != 10 {
		t.Errorf("expected MaxScriptCalls=10, got %d", policy.MaxScriptCalls)
	}
	if policy.SandboxRequired {
		t.Error("expected SandboxRequired false for default mode")
	}
	if len(warnings) != 0 {
		t.Errorf("expected no warnings, got %v", warnings)
	}
}

func TestEvaluatePolicy_DeniedTool(t *testing.T) {
	fm := &SkillFrontmatter{
		Name:         "test",
		Description:  "test",
		AllowedTools: []string{"bash", "exec", "script"},
	}

	policy, warnings := EvaluatePolicy(fm, "default")
	if len(policy.AllowedTools) != 1 {
		t.Errorf("expected 1 approved tool (bash), got %v", policy.AllowedTools)
	}
	if len(warnings) != 2 {
		t.Fatalf("expected 2 warnings for denied tools, got %v", warnings)
	}
	if !strings.Contains(warnings[0], "exec") || !strings.Contains(warnings[1], "script") {
		t.Errorf("warnings should mention denied tools, got %v", warnings)
	}
}

func TestEvaluatePolicy_ToolPolicyRequireApproval(t *testing.T) {
	fm := &SkillFrontmatter{
		Name:         "test",
		Description:  "test",
		AllowedTools: []string{"bash"},
		ToolPolicy: &ToolPolicy{
			"bash": {RequireApproval: true},
		},
	}

	policy, warnings := EvaluatePolicy(fm, "default")
	if !policy.RequireApproval {
		t.Error("expected RequireApproval true from ToolPolicy")
	}
	if len(warnings) != 0 {
		t.Errorf("expected no warnings, got %v", warnings)
	}
}

func TestEvaluatePolicy_ToolPolicyMaxCalls(t *testing.T) {
	fm := &SkillFrontmatter{
		Name:         "test",
		Description:  "test",
		AllowedTools: []string{"bash"},
		ToolPolicy: &ToolPolicy{
			"bash": {MaxCalls: 5},
		},
	}

	policy, _ := EvaluatePolicy(fm, "default")
	if policy.MaxScriptCalls != 5 {
		t.Errorf("expected MaxScriptCalls=5, got %d", policy.MaxScriptCalls)
	}
}

func TestEvaluatePolicy_SandboxMode(t *testing.T) {
	fm := &SkillFrontmatter{
		Name:         "test",
		Description:  "test",
		AllowedTools: []string{"bash", "read"},
	}

	policy, warnings := EvaluatePolicy(fm, "sandbox")
	if !policy.SandboxRequired {
		t.Error("expected SandboxRequired true for sandbox mode")
	}
	if len(policy.AllowedTools) != 1 || policy.AllowedTools[0] != "read" {
		t.Fatalf("expected 1 approved (read) in sandbox, got %v", policy.AllowedTools)
	}
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning for bash being denied, got %v", warnings)
	}
}

func TestEvaluatePolicy_DeniedToolsInPolicy(t *testing.T) {
	fm := &SkillFrontmatter{
		Name:         "test",
		Description:  "test",
		AllowedTools: []string{"bash", "edit"},
		ToolPolicy: &ToolPolicy{
			"edit": {
				Denied: []string{"write"},
			},
		},
	}

	_, warnings := EvaluatePolicy(fm, "default")
	found := false
	for _, w := range warnings {
		if strings.Contains(w, "write") && strings.Contains(w, "denied") {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected warning about denied tool 'write', got %v", warnings)
	}
}

func TestEvaluatePolicy_FullMode(t *testing.T) {
	fm := &SkillFrontmatter{
		Name:         "test",
		Description:  "test",
		AllowedTools: []string{"bash", "agent", "exec"},
	}

	policy, _ := EvaluatePolicy(fm, "full")
	found := make(map[string]bool)
	for _, t := range policy.AllowedTools {
		found[t] = true
	}
	for _, want := range []string{"bash", "agent", "exec"} {
		if !found[want] {
			t.Errorf("expected %q in full mode approved tools, got %v", want, policy.AllowedTools)
		}
	}
}
