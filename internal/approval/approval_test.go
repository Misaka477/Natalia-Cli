package approval

import (
	"testing"
)

func TestNew(t *testing.T) {
	a := New(ModeJustDoIt)
	if a.Mode != ModeJustDoIt {
		t.Errorf("expected ModeJustDoIt, got %s", a.Mode)
	}
}

func TestFuckMode(t *testing.T) {
	a := New(ModeJustDoIt)
	if !a.Request("write_file", "test") {
		t.Error("fuck mode should approve everything")
	}
	if !a.Request("run_shell", "test") {
		t.Error("fuck mode should approve everything")
	}
}

func TestReadOnlyMode(t *testing.T) {
	a := New(ModeReadOnly)
	if a.Request("write_file", "test") {
		t.Error("read_only mode should reject write_file")
	}
	if a.Request("edit_file", "test") {
		t.Error("read_only mode should reject edit_file")
	}
	if a.Request("run_shell", "test") {
		t.Error("read_only mode should reject run_shell")
	}
}

func TestWriteTools(t *testing.T) {
	if !WriteTools["write_file"] {
		t.Error("write_file should be in WriteTools")
	}
	if !WriteTools["edit_file"] {
		t.Error("edit_file should be in WriteTools")
	}
	if !WriteTools["run_shell"] {
		t.Error("run_shell should be in WriteTools")
	}
	if WriteTools["read_file"] {
		t.Error("read_file should NOT be in WriteTools")
	}
	if WriteTools["glob"] {
		t.Error("glob should NOT be in WriteTools")
	}
}

func TestDefaultMode(t *testing.T) {
	a := New("")
	// Empty mode defaults to ask, which uses interactivePrompt.
	// In non-interactive test, we can't test the prompt.
	// Just verify the approver is created.
	if a == nil {
		t.Error("approver should not be nil")
	}
}
