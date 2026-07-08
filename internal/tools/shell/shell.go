package shell

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/aquama/natalia-cli/internal/llm"
)

type Run struct{}

func (t *Run) Name() string        { return "run_shell" }
func (t *Run) Description() string { return "执行 shell 命令并返回输出" }
func (t *Run) Required() []string  { return []string{"command"} }
func (t *Run) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"command": {Type: "string", Description: "要执行的 shell 命令"},
		"timeout": {Type: "string", Description: "可选，超时秒数，默认 60"},
	}
}
func (t *Run) Execute(args map[string]any) (string, error) {
	cmdStr, _ := args["command"].(string)
	if cmdStr == "" {
		return "", fmt.Errorf("command required")
	}
	timeout := 60
	if t, ok := args["timeout"].(string); ok {
		fmt.Sscanf(t, "%d", &timeout)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "/bin/bash", "-c", cmdStr)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	var result strings.Builder
	if stdout.Len() > 0 {
		result.WriteString(stdout.String())
	}
	if stderr.Len() > 0 {
		result.WriteString("\nSTDERR:\n" + stderr.String())
	}
	if err != nil {
		result.WriteString(fmt.Sprintf("\nERROR: %v", err))
	}
	return result.String(), nil
}
