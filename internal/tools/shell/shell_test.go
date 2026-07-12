package shell

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/aquama/natalia-cli/internal/display"
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
	if props["command"].Type != "string" || props["timeout"].Description == "" || props["cwd"].Description == "" || props["max_output"].Description == "" || props["shell"].Description == "" || props["env"].Description == "" {
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

func TestRunExecuteReturnIncludesShellDisplay(t *testing.T) {
	ret, err := (&Run{}).ExecuteReturn(map[string]any{"command": "printf hello", "timeout": "5"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(ret.ModelText, "hello") || len(ret.Display) != 1 || ret.Display[0].Type != display.BlockShell {
		t.Fatalf("expected shell display block, got %+v", ret)
	}
	var payload display.ShellBlock
	if err := json.Unmarshal(ret.Display[0].Data, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Command != "printf hello" || !strings.Contains(payload.Output, "hello") {
		t.Fatalf("unexpected shell display payload: %+v", payload)
	}
}

func TestRunWithCWD(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "marker.txt"), []byte("ok"), 0644); err != nil {
		t.Fatal(err)
	}
	result, err := (&Run{}).Execute(map[string]any{"command": "pwd && ls marker.txt", "cwd": dir})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, dir) || !strings.Contains(result, "marker.txt") {
		t.Fatalf("expected command to run in cwd, got %q", result)
	}
}

func TestRunRejectsInvalidCWD(t *testing.T) {
	_, err := (&Run{}).Execute(map[string]any{"command": "true", "cwd": filepath.Join(t.TempDir(), "missing")})
	if err == nil || !strings.Contains(err.Error(), "cwd") {
		t.Fatalf("expected cwd validation error, got %v", err)
	}
}

func TestRunMaxOutput(t *testing.T) {
	result, err := (&Run{}).Execute(map[string]any{"command": "printf 123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890", "max_output": "80"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "output truncated") || len(result) > 80 {
		t.Fatalf("expected max_output truncation, got %q", result)
	}
}

func TestRunBlocksDangerousCommand(t *testing.T) {
	_, err := (&Run{}).Execute(map[string]any{"command": "sudo rm -rf /"})
	if err == nil || !strings.Contains(err.Error(), "dangerous") || !strings.Contains(err.Error(), "confirmation") {
		t.Fatalf("expected dangerous command rejection, got %v", err)
	}
}

func TestRunShellParameter(t *testing.T) {
	result, err := (&Run{}).Execute(map[string]any{"command": "printf ok", "shell": "sh"})
	if err != nil {
		t.Fatal(err)
	}
	if result != "ok" {
		t.Fatalf("expected sh command output, got %q", result)
	}
}

func TestRunRejectsInvalidShell(t *testing.T) {
	_, err := (&Run{}).Execute(map[string]any{"command": "true", "shell": "/bin/zsh"})
	if err == nil || !strings.Contains(err.Error(), "shell") {
		t.Fatalf("expected shell validation error, got %v", err)
	}
}

func TestRunEnvAllowlist(t *testing.T) {
	result, err := (&Run{}).Execute(map[string]any{"command": "printf $NATALIA_TEST_VALUE", "env": map[string]any{"NATALIA_TEST_VALUE": "ok"}})
	if err != nil {
		t.Fatal(err)
	}
	if result != "ok" {
		t.Fatalf("expected env output, got %q", result)
	}
}

func TestRunRejectsSensitiveEnvName(t *testing.T) {
	_, err := (&Run{}).Execute(map[string]any{"command": "true", "env": map[string]any{"API_KEY": "secret"}})
	if err == nil || !strings.Contains(err.Error(), "sensitive") || strings.Contains(err.Error(), "secret") {
		t.Fatalf("expected sensitive env name rejection without value leak, got %v", err)
	}
}

func TestRunRejectsInvalidEnvName(t *testing.T) {
	_, err := (&Run{}).Execute(map[string]any{"command": "true", "env": map[string]any{"BAD-NAME": "x"}})
	if err == nil || !strings.Contains(err.Error(), "invalid") {
		t.Fatalf("expected invalid env name rejection, got %v", err)
	}
}

func TestLimitOutput(t *testing.T) {
	result := limitOutput(strings.Repeat("x", 200), 120)
	if len(result) > 120 || !strings.Contains(result, "output truncated") {
		t.Fatalf("expected truncated output marker, got %q", result)
	}
}
