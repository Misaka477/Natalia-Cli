package approval

import "testing"

func TestApprovalModesEnforceRuntimePolicy(t *testing.T) {
	justDoIt := New(ModeJustDoIt)
	if !justDoIt.Request("write_file", "write") {
		t.Fatal("just_do_it should approve normal requests")
	}
	justDoIt.RequestFunc = func(toolName, description string) bool {
		return toolName == "run_shell" && description == "danger"
	}
	if !justDoIt.RequestExplicit("run_shell", "danger") {
		t.Fatal("explicit requests should route through explicit confirmation callback")
	}

	readOnly := New(ModeReadOnly)
	for _, tool := range []string{"write_file", "edit_file", "run_shell", "interactive_write", "agent_spawn"} {
		if readOnly.Request(tool, "blocked") {
			t.Fatalf("read_only should reject %s", tool)
		}
		if readOnly.RequestExplicit(tool, "blocked") {
			t.Fatalf("read_only should reject explicit %s", tool)
		}
	}
}

func TestAskModeRoutesNormalAndExplicitRequestsToCallback(t *testing.T) {
	a := New(ModeAsk)
	var calls []string
	a.RequestFunc = func(toolName, description string) bool {
		calls = append(calls, toolName+":"+description)
		return toolName == "write_file" || description == "explicit ok"
	}

	if !a.Request("write_file", "normal") {
		t.Fatal("expected callback approval for write_file")
	}
	if a.Request("run_shell", "normal") {
		t.Fatal("expected callback rejection for run_shell")
	}
	if !a.RequestExplicit("run_shell", "explicit ok") {
		t.Fatal("expected explicit callback approval")
	}
	want := []string{"write_file:normal", "run_shell:normal", "run_shell:explicit ok"}
	if len(calls) != len(want) {
		t.Fatalf("expected calls %v, got %v", want, calls)
	}
	for i := range want {
		if calls[i] != want[i] {
			t.Fatalf("expected calls %v, got %v", want, calls)
		}
	}
}

func TestWriteToolsCoversAllMutatingRuntimeTools(t *testing.T) {
	mutating := []string{"write_file", "edit_file", "run_shell", "process_start", "process_stop", "process_restart", "process_attach", "process_detach", "process_cleanup", "background_start", "background_stop", "background_restart", "background_cleanup", "interactive_start", "interactive_write", "interactive_keys", "interactive_stop", "interactive_attach", "interactive_detach", "interactive_resize", "agent_spawn", "agent_attach", "agent_detach", "agent_stop", "agent_resume"}
	for _, tool := range mutating {
		if !IsWriteTool(tool) {
			t.Fatalf("expected %s to require approval", tool)
		}
	}
	readOnly := []string{"read_file", "glob", "grep", "web_fetch", "agent_list", "interactive_read", "interactive_list", "interactive_transcript", "process_audit", "background_audit"}
	for _, tool := range readOnly {
		if IsWriteTool(tool) {
			t.Fatalf("expected %s to remain read-only", tool)
		}
	}
}

func TestRegisterWriteToolAddsDynamicMutatingTool(t *testing.T) {
	name := "mcp_test_write"
	if IsWriteTool(name) {
		t.Fatalf("test tool %s should not be registered before test", name)
	}
	RegisterWriteTool(name)
	if !IsWriteTool(name) {
		t.Fatalf("expected %s to require approval after dynamic registration", name)
	}
	RegisterWriteTool(" ")
	if IsWriteTool(" ") {
		t.Fatal("blank dynamic tool name should be ignored")
	}
}

func TestNilApproverExplicitRequestIsRejected(t *testing.T) {
	var approver *Approver
	if approver.RequestExplicit("run_shell", "danger") {
		t.Fatal("nil approver should reject explicit requests")
	}
}
