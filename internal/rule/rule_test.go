package rule

import "testing"

func TestGet(t *testing.T) {
	r, err := Get("code")
	if err != nil {
		t.Fatal(err)
	}
	if r.Name != "code" {
		t.Errorf("expected code, got %s", r.Name)
	}
	if r.Prompt == "" {
		t.Error("code rule should have a prompt")
	}
}

func TestGetInvalid(t *testing.T) {
	_, err := Get("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent rule")
	}
}

func TestList(t *testing.T) {
	names := List()
	if len(names) != 5 {
		t.Fatalf("expected 5 rules, got %d", len(names))
	}
}

func TestFilterCode(t *testing.T) {
	r, _ := Get("code")
	if !r.ToolFilter("write_file", nil) {
		t.Error("code mode should allow write_file")
	}
	if !r.ToolFilter("run_shell", nil) {
		t.Error("code mode should allow run_shell")
	}
}

func TestFilterAsk(t *testing.T) {
	r, _ := Get("ask")
	if r.ToolFilter("write_file", nil) {
		t.Error("ask mode should NOT allow write_file")
	}
	if r.ToolFilter("run_shell", nil) {
		t.Error("ask mode should NOT allow run_shell")
	}
	if !r.ToolFilter("read_file", nil) {
		t.Error("ask mode should allow read_file")
	}
	if !r.ToolFilter("grep", nil) {
		t.Error("ask mode should allow grep")
	}
}

func TestFilterChat(t *testing.T) {
	r, _ := Get("chat")
	if r.ToolFilter("write_file", nil) {
		t.Error("chat mode should NOT allow write_file")
	}
	if r.ToolFilter("run_shell", nil) {
		t.Error("chat mode should NOT allow run_shell")
	}
	if r.ToolFilter("read_file", nil) {
		t.Error("chat mode should NOT allow read_file")
	}
}

func TestFilterDebug(t *testing.T) {
	r, _ := Get("debug")
	if !r.ToolFilter("run_shell", nil) {
		t.Error("debug mode should allow run_shell")
	}
	if !r.ToolFilter("write_file", nil) {
		t.Error("debug mode should allow write_file")
	}
	if !r.ToolFilter("read_file", nil) {
		t.Error("debug mode should allow read_file")
	}
}

func TestFilterPlanWritesToPlansDir(t *testing.T) {
	r, _ := Get("plan")
	if !r.ToolFilter("write_file", map[string]any{"path": "PLANS/arch.md"}) {
		t.Error("plan mode should allow write_file to PLANS/")
	}
	if r.ToolFilter("write_file", map[string]any{"path": "src/main.go"}) {
		t.Error("plan mode should NOT allow write_file outside PLANS/")
	}
	if r.ToolFilter("run_shell", nil) {
		t.Error("plan mode should NOT allow run_shell")
	}
	if !r.ToolFilter("read_file", map[string]any{"path": "src/main.go"}) {
		t.Error("plan mode should allow read_file anywhere")
	}
}
