package mode

import (
	"strings"
	"testing"
)

func TestBuiltinModesExposeExpectedRoutingAndPrompts(t *testing.T) {
	want := map[string]string{
		"code":  "编程模式",
		"ask":   "问答模式",
		"plan":  "规划模式",
		"debug": "调试模式",
		"chat":  "聊天模式",
	}
	listed := strings.Join(List(), "\n")
	for name, display := range want {
		m, err := Get(name)
		if err != nil {
			t.Fatalf("expected builtin mode %s: %v", name, err)
		}
		if m.DisplayName != display || strings.TrimSpace(m.Prompt) == "" || m.ToolFilter == nil {
			t.Fatalf("mode %s is incomplete: %+v", name, m)
		}
		if !strings.Contains(listed, name+" (") {
			t.Fatalf("List() omitted mode %s from %q", name, listed)
		}
	}
	if _, err := Get("nonexistent"); err == nil {
		t.Fatal("expected error for unknown mode")
	}
}

func TestModeToolPolicyMatrix(t *testing.T) {
	cases := []struct {
		mode string
		tool string
		args map[string]any
		want bool
	}{
		{mode: "code", tool: "write_file", want: true},
		{mode: "code", tool: "run_shell", want: true},
		{mode: "code", tool: "read_file", want: true},
		{mode: "code", tool: "ask_user", want: true},
		{mode: "code", tool: "process_restart", want: true},
		{mode: "code", tool: "process_cleanup", want: true},
		{mode: "code", tool: "interactive_cleanup", want: true},
		{mode: "code", tool: "background_restart", want: true},
		{mode: "code", tool: "interactive_resize", want: true},
		{mode: "code", tool: "unknown_tool_xyz", want: false},
		{mode: "ask", tool: "read_file", want: true},
		{mode: "ask", tool: "grep", want: true},
		{mode: "ask", tool: "ask_user", want: true},
		{mode: "ask", tool: "process_status", want: true},
		{mode: "ask", tool: "process_audit", want: true},
		{mode: "ask", tool: "background_output", want: true},
		{mode: "ask", tool: "interactive_transcript", want: true},
		{mode: "ask", tool: "process_restart", want: false},
		{mode: "ask", tool: "interactive_resize", want: false},
		{mode: "ask", tool: "background_restart", want: false},
		{mode: "ask", tool: "write_file", want: false},
		{mode: "ask", tool: "run_shell", want: false},
		{mode: "ask", tool: "unknown_tool_xyz", want: false},
		{mode: "chat", tool: "web_search", want: true},
		{mode: "chat", tool: "ask_user", want: true},
		{mode: "chat", tool: "process_list", want: true},
		{mode: "chat", tool: "background_audit", want: true},
		{mode: "chat", tool: "interactive_list", want: true},
		{mode: "chat", tool: "todo_list", want: true},
		{mode: "chat", tool: "read_file", want: false},
		{mode: "chat", tool: "run_shell", want: false},
		{mode: "chat", tool: "unknown_tool_xyz", want: false},
		{mode: "debug", tool: "write_file", want: true},
		{mode: "debug", tool: "run_shell", want: true},
		{mode: "debug", tool: "read_file", want: true},
		{mode: "debug", tool: "unknown_tool_xyz", want: false},
		{mode: "plan", tool: "read_file", args: map[string]any{"path": "src/main.go"}, want: true},
		{mode: "plan", tool: "write_file", args: map[string]any{"path": "PLANS/arch.md"}, want: true},
		{mode: "plan", tool: "write_file", args: map[string]any{"path": "docs/PLANS/arch.md"}, want: true},
		{mode: "plan", tool: "write_file", args: map[string]any{"path": "src/main.go"}, want: false},
		{mode: "plan", tool: "write_file", args: nil, want: false},
		{mode: "plan", tool: "write_file", args: map[string]any{"path": 123}, want: false},
		{mode: "plan", tool: "edit_file", args: map[string]any{"path": "src/main.go"}, want: false},
		{mode: "plan", tool: "run_shell", want: false},
		{mode: "plan", tool: "unknown_tool_xyz", want: false},
	}
	for _, tc := range cases {
		t.Run(tc.mode+"/"+tc.tool, func(t *testing.T) {
			m, err := Get(tc.mode)
			if err != nil {
				t.Fatal(err)
			}
			if got := m.ToolFilter(tc.tool, tc.args); got != tc.want {
				t.Fatalf("ToolFilter(%s, %+v)=%v want %v", tc.tool, tc.args, got, tc.want)
			}
		})
	}
}
