package shell

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/secret"
	"github.com/Misaka477/Natalia-Cli/internal/toolreturn"
	"github.com/Misaka477/Natalia-Cli/internal/toolschema"
)

type Run struct{}

const maxShellOutputBytes = 20000
const dangerConfirmedArg = "__natalia_danger_confirmed"

//go:embed run.md
var runDescription string

type RunParams struct {
	Command   string            `json:"command" description:"要执行的 shell 命令"`
	Timeout   string            `json:"timeout,omitempty" description:"可选，超时秒数，默认 60，最大 600"`
	CWD       string            `json:"cwd,omitempty" description:"可选，命令工作目录，必须是已存在目录"`
	MaxOutput string            `json:"max_output,omitempty" description:"可选，最大输出字节数，默认 20000，最大 200000"`
	Shell     string            `json:"shell,omitempty" description:"可选，shell 路径或名称；允许 /bin/bash、bash、/bin/sh、sh，默认 /bin/bash"`
	Env       map[string]string `json:"env,omitempty" description:"可选，附加环境变量；变量名必须安全且不得包含 secret/token/password/key 等敏感名称"`
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
	ret, err := t.ExecuteReturn(args)
	return ret.ModelText, err
}

func (t *Run) ExecuteReturn(args map[string]any) (toolreturn.Return, error) {
	params, err := toolschema.Decode[RunParams](args)
	if err != nil {
		return toolreturn.Return{IsError: true}, err
	}
	if reason := DangerousCommandReason(params.Command); reason != "" && !dangerConfirmed(args) {
		return toolreturn.Return{IsError: true}, fmt.Errorf("dangerous command requires explicit user confirmation: %s", reason)
	}
	shellPath, err := resolveShell(params.Shell)
	if err != nil {
		return toolreturn.Return{IsError: true}, err
	}
	env, err := buildSafeEnv(params.Env)
	if err != nil {
		return toolreturn.Return{IsError: true}, err
	}
	timeout := 60
	if params.Timeout != "" {
		parsed, err := strconv.Atoi(strings.TrimSpace(params.Timeout))
		if err != nil || parsed < 1 {
			return toolreturn.Return{IsError: true}, fmt.Errorf("timeout must be a positive integer number of seconds")
		}
		if parsed > 600 {
			return toolreturn.Return{IsError: true}, fmt.Errorf("timeout must be <= 600 seconds")
		}
		timeout = parsed
	}
	maxOutput := maxShellOutputBytes
	if params.MaxOutput != "" {
		parsed, err := strconv.Atoi(strings.TrimSpace(params.MaxOutput))
		if err != nil || parsed < 1 {
			return toolreturn.Return{IsError: true}, fmt.Errorf("max_output must be a positive integer number of bytes")
		}
		if parsed > 200000 {
			return toolreturn.Return{IsError: true}, fmt.Errorf("max_output must be <= 200000 bytes")
		}
		maxOutput = parsed
	}
	if params.CWD != "" {
		info, err := os.Stat(params.CWD)
		if err != nil {
			return toolreturn.Return{IsError: true}, fmt.Errorf("cwd check failed: %w", err)
		}
		if !info.IsDir() {
			return toolreturn.Return{IsError: true}, fmt.Errorf("cwd is not a directory: %s", params.CWD)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, shellPath, "-c", params.Command)
	if params.CWD != "" {
		cmd.Dir = params.CWD
	}
	cmd.Env = env
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	exitCode := 0
	if cmd.ProcessState != nil {
		exitCode = cmd.ProcessState.ExitCode()
	}
	var result strings.Builder
	timedOut := ctx.Err() == context.DeadlineExceeded
	if timedOut {
		result.WriteString(fmt.Sprintf("TIMEOUT: command exceeded %d seconds\n", timeout))
	}
	if stdout.Len() > 0 {
		result.WriteString(limitOutput(stdout.String(), maxOutput))
	}
	if stderr.Len() > 0 {
		result.WriteString("\nSTDERR:\n" + limitOutput(stderr.String(), maxOutput))
	}
	if err != nil {
		result.WriteString(fmt.Sprintf("\nERROR: %v", err))
	}
	modelText := secret.RedactString(result.String())
	block, blockErr := display.NewBlock(display.BlockShell, params.Command, display.ShellBlock{
		Command:  params.Command,
		ExitCode: exitCode,
		Output:   modelText,
		TimedOut: timedOut,
	})
	if blockErr != nil {
		return toolreturn.Return{ModelText: modelText, IsError: err != nil}, nil
	}
	return toolreturn.Return{ModelText: modelText, Display: []display.Block{block}, IsError: err != nil}, nil
}

func DangerousCommandReason(command string) string {
	normalized := strings.ToLower(strings.Join(strings.Fields(command), " "))
	blocked := []string{
		"rm -rf /",
		"rm -rf /*",
		"sudo rm -rf /",
		"sudo rm -rf /*",
		"mkfs",
		"dd if=/dev/zero of=/dev/",
		":(){ :|:& };:",
	}
	for _, pattern := range blocked {
		if strings.Contains(normalized, pattern) {
			return pattern
		}
	}
	return ""
}

func MarkDangerConfirmed(args map[string]any) {
	args[dangerConfirmedArg] = true
}

func dangerConfirmed(args map[string]any) bool {
	return IsDangerConfirmed(args)
}

func IsDangerConfirmed(args map[string]any) bool {
	confirmed, _ := args[dangerConfirmedArg].(bool)
	return confirmed
}

func resolveShell(shell string) (string, error) {
	shell = strings.TrimSpace(shell)
	if shell == "" {
		return "/bin/bash", nil
	}
	switch shell {
	case "/bin/bash", "bash":
		return "/bin/bash", nil
	case "/bin/sh", "sh":
		return "/bin/sh", nil
	default:
		return "", fmt.Errorf("shell must be one of /bin/bash, bash, /bin/sh, sh")
	}
}

func buildSafeEnv(extra map[string]string) ([]string, error) {
	env := secret.SanitizedEnv()
	for name, value := range extra {
		if err := secret.ValidateEnvName(name); err != nil {
			return nil, err
		}
		env = append(env, name+"="+value)
	}
	return env, nil
}

func isSensitiveEnvName(name string) bool {
	return secret.IsSensitiveName(name)
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
