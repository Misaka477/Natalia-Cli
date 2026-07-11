package shell

import (
	"strings"
	"testing"
)

func TestRunRejectsInvalidTimeout(t *testing.T) {
	_, err := (&Run{}).Execute(map[string]any{"command": "true", "timeout": "abc"})
	if err == nil || !strings.Contains(err.Error(), "timeout") {
		t.Fatalf("expected timeout error, got %v", err)
	}
}

func TestRunSchemaGeneratedFromParams(t *testing.T) {
	run := &Run{}
	props := run.Parameters()
	required := run.Required()
	if props["command"].Type != "string" || props["timeout"].Description == "" {
		t.Fatalf("unexpected shell schema: %+v", props)
	}
	if len(required) != 1 || required[0] != "command" {
		t.Fatalf("unexpected required fields: %+v", required)
	}
}

func TestRunDescriptionLoadedFromMarkdown(t *testing.T) {
	desc := (&Run{}).Description()
	if !strings.Contains(desc, "Execute a short shell command") || !strings.Contains(desc, "timeout") {
		t.Fatalf("expected markdown description, got %q", desc)
	}
}

func TestRunReportsTimeout(t *testing.T) {
	result, err := (&Run{}).Execute(map[string]any{"command": "sleep 2", "timeout": "1"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "TIMEOUT:") || !strings.Contains(result, "ERROR:") {
		t.Fatalf("expected timeout result, got %q", result)
	}
}

func TestLimitOutput(t *testing.T) {
	result := limitOutput(strings.Repeat("x", 200), 120)
	if len(result) > 120 || !strings.Contains(result, "output truncated") {
		t.Fatalf("expected truncated output marker, got %q", result)
	}
}
