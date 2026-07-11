package toolset

import (
	"testing"

	"github.com/aquama/natalia-cli/internal/agentspec"
)

func TestRegisterDefaultToolsFromAgentSpec(t *testing.T) {
	r := NewRegistry()
	if err := RegisterDefaultTools(r); err != nil {
		t.Fatalf("RegisterDefaultTools failed: %v", err)
	}
	for _, name := range []string{"read_file", "write_file", "run_shell", "web_fetch", "todo_set", "ask_user"} {
		if _, ok := r.Get(name); !ok {
			t.Fatalf("expected tool %q to be registered", name)
		}
	}
}

func TestRegisterFromAgentSpecFiltersTools(t *testing.T) {
	spec := &agentspec.ResolvedAgentSpec{
		Tools:        []string{"natalia/tools/file:Read", "natalia/tools/file:Write", "natalia/tools/shell:Run"},
		AllowedTools: []string{"read_file", "write_file"},
		ExcludeTools: []string{"write_file"},
	}
	r := NewRegistry()
	if err := RegisterFromAgentSpec(r, spec); err != nil {
		t.Fatalf("RegisterFromAgentSpec failed: %v", err)
	}
	if _, ok := r.Get("read_file"); !ok {
		t.Fatal("expected read_file to be registered")
	}
	if _, ok := r.Get("write_file"); ok {
		t.Fatal("expected write_file to be excluded")
	}
	if _, ok := r.Get("run_shell"); ok {
		t.Fatal("expected run_shell to be filtered by allowed tools")
	}
}

func TestRegisterFromAgentSpecRejectsUnknownTool(t *testing.T) {
	err := RegisterFromAgentSpec(NewRegistry(), &agentspec.ResolvedAgentSpec{Tools: []string{"unknown:Tool"}})
	if err == nil {
		t.Fatal("expected unknown tool error")
	}
}
