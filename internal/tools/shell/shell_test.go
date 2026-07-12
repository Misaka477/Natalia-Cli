package shell

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/display"
)

func TestRunRejectsInvalidTimeout(t *testing.T) {
	_, err := (&Run{}).Execute(map[string]any{"command": "true", "timeout": "abc"})
	if err == nil || !strings.Contains(err.Error(), "timeout") {
		t.Fatalf("expected timeout error, got %v", err)
	}
}

func TestRunSchemaDescriptionAndExecution(t *testing.T) {
	run := &Run{}
	props := run.Parameters()
	required := run.Required()
	if props["command"].Type != "string" || props["timeout"].Description == "" || props["cwd"].Description == "" || props["max_output"].Description == "" || props["shell"].Description == "" || props["env"].Description == "" {
		t.Fatalf("unexpected shell schema: %+v", props)
	}
	if len(required) != 1 || required[0] != "command" {
		t.Fatalf("unexpected required fields: %+v", required)
	}
	desc := run.Description()
	if !strings.Contains(desc, "Execute a short shell command") || !strings.Contains(desc, "timeout") {
		t.Fatalf("expected markdown description, got %q", desc)
	}
	result, err := run.Execute(map[string]any{"command": "printf schema-ok", "timeout": "5"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "schema-ok") {
		t.Fatalf("expected real command output, got %q", result)
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
	commands := []string{
		"rm -rf /",
		"rm -rf /*",
		"sudo rm -rf /",
		"sudo rm -rf /*",
		"mkfs /dev/sda",
		"dd if=/dev/zero of=/dev/sda",
		":(){ :|:& };:",
	}
	for _, command := range commands {
		t.Run(command, func(t *testing.T) {
			_, err := (&Run{}).Execute(map[string]any{"command": command})
			if err == nil || !strings.Contains(err.Error(), "dangerous") || !strings.Contains(err.Error(), "confirmation") {
				t.Fatalf("expected dangerous command rejection, got %v", err)
			}
		})
	}
}

func TestDangerousCommandReasonAllowsSafeCommands(t *testing.T) {
	for _, command := range []string{"rm file.txt", "rm -rf ./tmp", "sudo ls /", "printf safe"} {
		if reason := DangerousCommandReason(command); reason != "" {
			t.Fatalf("expected %q to be allowed, got reason %q", command, reason)
		}
	}
}

func TestDangerConfirmationFlag(t *testing.T) {
	args := map[string]any{}
	if IsDangerConfirmed(args) {
		t.Fatal("expected new args to be unconfirmed")
	}
	MarkDangerConfirmed(args)
	if !IsDangerConfirmed(args) {
		t.Fatal("expected danger confirmation flag")
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

func TestResolveShellAllowsOnlySupportedShells(t *testing.T) {
	cases := map[string]string{"": "/bin/bash", "bash": "/bin/bash", "/bin/bash": "/bin/bash", "sh": "/bin/sh", "/bin/sh": "/bin/sh"}
	for input, want := range cases {
		got, err := resolveShell(input)
		if err != nil || got != want {
			t.Fatalf("resolveShell(%q)=%q err=%v want %q", input, got, err, want)
		}
	}
	if _, err := resolveShell("zsh"); err == nil {
		t.Fatal("expected unsupported shell error")
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

func TestSensitiveEnvNamePatterns(t *testing.T) {
	for _, name := range []string{"SECRET", "MY_TOKEN", "DB_PASSWORD", "SSH_PRIVATE_KEY", "ACCESS_KEY_ID", "API_KEY", "KEY", "OPENAI_KEY"} {
		if !isSensitiveEnvName(name) {
			t.Fatalf("expected %s to be sensitive", name)
		}
	}
	for _, name := range []string{"NATALIA_TEST_VALUE", "MONKEY", "KEYSTONE"} {
		if isSensitiveEnvName(name) {
			t.Fatalf("expected %s to be allowed", name)
		}
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
