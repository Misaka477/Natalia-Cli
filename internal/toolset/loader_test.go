package toolset

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/agentspec"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/plan"
)

func TestRegisterDefaultToolsFromAgentSpec(t *testing.T) {
	r := NewRegistry()
	if err := RegisterDefaultTools(r); err != nil {
		t.Fatalf("RegisterDefaultTools failed: %v", err)
	}
	for _, name := range []string{"read_file", "write_file", "run_shell", "web_fetch", "file_info", "todo_set", "ask_user", "process_restart", "process_attach", "process_detach", "process_cleanup", "process_audit", "interactive_start", "interactive_attach", "interactive_detach", "interactive_resize", "interactive_transcript", "background_start", "background_restart", "background_cleanup", "background_audit", "workflow_list", "workflow_read", "plan_mode_enter", "plan_mode_status"} {
		if _, ok := r.Get(name); !ok {
			t.Fatalf("expected tool %q to be registered", name)
		}
	}

	dir := t.TempDir()
	filePath := filepath.Join(dir, "fixture.txt")
	if err := os.WriteFile(filePath, []byte("loader-ok\n"), 0644); err != nil {
		t.Fatal(err)
	}
	readTool, _ := r.Get("read_file")
	read, err := readTool.Execute(map[string]any{"path": filePath, "limit": "all"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(read, "loader-ok") {
		t.Fatalf("registered read_file did not read fixture, got %q", read)
	}
	globTool, _ := r.Get("glob")
	glob, err := globTool.Execute(map[string]any{"pattern": "*.txt", "path": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(glob, "fixture.txt") {
		t.Fatalf("registered glob did not find fixture, got %q", glob)
	}
	shellTool, _ := r.Get("run_shell")
	shell, err := shellTool.Execute(map[string]any{"command": "printf loader-shell-ok", "timeout": "5"})
	if err != nil {
		t.Fatal(err)
	}
	if shell != "loader-shell-ok" {
		t.Fatalf("registered run_shell returned %q", shell)
	}
}

func TestDefaultToolsetExecutesModelStyleToolFlowEndToEnd(t *testing.T) {
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })
	r := NewRegistry()
	if err := RegisterDefaultTools(r); err != nil {
		t.Fatalf("RegisterDefaultTools failed: %v", err)
	}
	defs := r.ToToolDefs()
	assertToolDefRequired(t, defs, "read_file", []string{"path"})
	assertToolDefRequired(t, defs, "write_file", []string{"path", "content"})
	assertToolDefRequired(t, defs, "run_shell", []string{"command"})

	dir := t.TempDir()
	path := filepath.Join(dir, "flow.txt")
	mustExecTool(t, r, "write_file", map[string]any{"path": path, "content": "alpha\nbeta\n"}, "已写入")
	mustExecTool(t, r, "read_file", map[string]any{"path": path, "limit": "all"}, "alpha")
	mustExecTool(t, r, "edit_file", map[string]any{"path": path, "old_string": "beta", "new_string": "BETA"}, "替换 1 处")
	mustExecTool(t, r, "grep", map[string]any{"pattern": "BETA", "path": dir, "include": "*.txt"}, "BETA")
	mustExecTool(t, r, "glob", map[string]any{"pattern": "*.txt", "path": dir}, "flow.txt")
	mustExecTool(t, r, "run_shell", map[string]any{"command": "printf shell-ok", "cwd": dir, "timeout": "5"}, "shell-ok")
	mustExecTool(t, r, "todo_set", map[string]any{"items": []any{"one", "two"}}, "2")
	mustExecTool(t, r, "todo_done", map[string]any{"index": float64(2)}, "完成")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte("<html><body><h1>Toolset Web OK</h1><script>bad()</script></body></html>"))
	}))
	defer server.Close()
	mustExecTool(t, r, "web_fetch", map[string]any{"url": server.URL}, "Toolset Web OK")
	mustExecTool(t, r, "file_info", map[string]any{"path": path}, "MIME:")
}

func TestDefaultToolsetWriteToolsRespectPlanModeGuard(t *testing.T) {
	plan.Exit()
	t.Cleanup(func() { plan.Exit() })
	r := NewRegistry()
	if err := RegisterDefaultTools(r); err != nil {
		t.Fatalf("RegisterDefaultTools failed: %v", err)
	}
	dir := t.TempDir()
	plan.Enter("", filepath.Join(dir, "plans", "roadmap.md"), "guard test")
	writeTool, _ := r.Get("write_file")
	blockedPath := filepath.Join(dir, "main.go")
	if _, err := writeTool.Execute(map[string]any{"path": blockedPath, "content": "package main"}); err == nil || !strings.Contains(err.Error(), "plan mode blocks") {
		t.Fatalf("expected plan mode write block, got %v", err)
	}
	planDir := filepath.Join(dir, "plans")
	if err := os.MkdirAll(planDir, 0755); err != nil {
		t.Fatal(err)
	}
	planPath := filepath.Join(planDir, "roadmap.md")
	if result, err := writeTool.Execute(map[string]any{"path": planPath, "content": "# Plan"}); err != nil || !strings.Contains(result, "已写入") {
		t.Fatalf("expected plan path write to succeed, result=%q err=%v", result, err)
	}
}

func assertToolDefRequired(t *testing.T, defs []llm.ToolDef, name string, want []string) {
	t.Helper()
	for _, def := range defs {
		if def.Function.Name != name {
			continue
		}
		for _, required := range want {
			found := false
			for _, got := range def.Function.Parameters.Required {
				if got == required {
					found = true
					break
				}
			}
			if !found {
				t.Fatalf("tool %s required fields %v missing %s", name, def.Function.Parameters.Required, required)
			}
		}
		return
	}
	t.Fatalf("tool def %s not found in %+v", name, defs)
}

func mustExecTool(t *testing.T, r *Registry, name string, args map[string]any, want string) {
	t.Helper()
	tool, ok := r.Get(name)
	if !ok {
		t.Fatalf("tool %s not registered", name)
	}
	result, err := tool.Execute(args)
	if err != nil {
		t.Fatalf("tool %s failed with args %+v: %v", name, args, err)
	}
	if !strings.Contains(result, want) {
		t.Fatalf("tool %s result missing %q: %q", name, want, result)
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
