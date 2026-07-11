package shell

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/aquama/natalia-cli/internal/llm"
	"github.com/aquama/natalia-cli/internal/toolschema"
)

type Run struct{}

const maxShellOutputBytes = 20000

//go:embed run.md
var runDescription string

type RunParams struct {
	Command string `json:"command" description:"要执行的 shell 命令"`
	Timeout string `json:"timeout,omitempty" description:"可选，超时秒数，默认 60，最大 600"`
}

func (t *Run) Name() string        { return "run_shell" }
func (t *Run) Description() string { return strings.TrimSpace(runDescription) }
func (t *Run) Parameters() map[string]llm.Property {
	props, _ := toolschema.FromStruct(RunParams{})
	return props
}
func (t *Run) Required() []string {
	_, required := toolschema.FromStruct(RunParams{})
	return required
}
func (t *Run) Execute(args map[string]any) (string, error) {
	params, err := toolschema.Decode[RunParams](args)
	if err != nil {
		return "", err
	}
	timeout := 60
	if params.Timeout != "" {
		parsed, err := strconv.Atoi(strings.TrimSpace(params.Timeout))
		if err != nil || parsed < 1 {
			return "", fmt.Errorf("timeout must be a positive integer number of seconds")
		}
		if parsed > 600 {
			return "", fmt.Errorf("timeout must be <= 600 seconds")
		}
		timeout = parsed
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "/bin/bash", "-c", params.Command)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	var result strings.Builder
	if ctx.Err() == context.DeadlineExceeded {
		result.WriteString(fmt.Sprintf("TIMEOUT: command exceeded %d seconds\n", timeout))
	}
	if stdout.Len() > 0 {
		result.WriteString(limitOutput(stdout.String(), maxShellOutputBytes))
	}
	if stderr.Len() > 0 {
		result.WriteString("\nSTDERR:\n" + limitOutput(stderr.String(), maxShellOutputBytes))
	}
	if err != nil {
		result.WriteString(fmt.Sprintf("\nERROR: %v", err))
	}
	return result.String(), nil
}

func limitOutput(s string, maxBytes int) string {
	if maxBytes <= 0 || len(s) <= maxBytes {
		return s
	}
	marker := fmt.Sprintf("\n[output truncated: original %d bytes, kept %d bytes]", len(s), maxBytes)
	keep := maxBytes - len(marker)
	if keep < 1 {
		return s[:maxBytes]
	}
	return s[:keep] + marker
}
