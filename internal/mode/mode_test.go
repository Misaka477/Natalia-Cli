package mode

import "testing"

func TestGet(t *testing.T) {
	m, err := Get("code")
	if err != nil {
		t.Fatal(err)
	}
	if m.Name != "code" {
		t.Errorf("expected code, got %s", m.Name)
	}
	if m.Prompt == "" {
		t.Error("code mode should have a prompt")
	}
}

func TestGetInvalid(t *testing.T) {
	_, err := Get("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent mode")
	}
}

func TestList(t *testing.T) {
	names := List()
	if len(names) != 5 {
		t.Fatalf("expected 5 modes, got %d", len(names))
	}
}

func TestFilterCode(t *testing.T) {
	m, _ := Get("code")
	if !m.ToolFilter("write_file", nil) {
		t.Error("code mode should allow write_file")
	}
	if !m.ToolFilter("run_shell", nil) {
		t.Error("code mode should allow run_shell")
	}
}

func TestFilterAsk(t *testing.T) {
	m, _ := Get("ask")
	if m.ToolFilter("write_file", nil) {
		t.Error("ask mode should NOT allow write_file")
	}
	if m.ToolFilter("run_shell", nil) {
		t.Error("ask mode should NOT allow run_shell")
	}
	if !m.ToolFilter("read_file", nil) {
		t.Error("ask mode should allow read_file")
	}
	if !m.ToolFilter("grep", nil) {
		t.Error("ask mode should allow grep")
	}
}

func TestFilterChat(t *testing.T) {
	m, _ := Get("chat")
	if m.ToolFilter("write_file", nil) {
		t.Error("chat mode should NOT allow write_file")
	}
	if m.ToolFilter("run_shell", nil) {
		t.Error("chat mode should NOT allow run_shell")
	}
	if m.ToolFilter("read_file", nil) {
		t.Error("chat mode should NOT allow read_file")
	}
}

func TestFilterDebug(t *testing.T) {
	m, _ := Get("debug")
	if !m.ToolFilter("run_shell", nil) {
		t.Error("debug mode should allow run_shell")
	}
	if !m.ToolFilter("write_file", nil) {
		t.Error("debug mode should allow write_file")
	}
	if !m.ToolFilter("read_file", nil) {
		t.Error("debug mode should allow read_file")
	}
}

func TestFilterPlanWritesToPlansDir(t *testing.T) {
	m, _ := Get("plan")
	if !m.ToolFilter("write_file", map[string]any{"path": "PLANS/arch.md"}) {
		t.Error("plan mode should allow write_file to PLANS/")
	}
	if m.ToolFilter("write_file", map[string]any{"path": "src/main.go"}) {
		t.Error("plan mode should NOT allow write_file outside PLANS/")
	}
	if m.ToolFilter("run_shell", nil) {
		t.Error("plan mode should NOT allow run_shell")
	}
	if !m.ToolFilter("read_file", map[string]any{"path": "src/main.go"}) {
		t.Error("plan mode should allow read_file anywhere")
	}
}
