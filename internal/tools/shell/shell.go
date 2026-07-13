package shell

import (
	"bytes"
	"context"
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/secret"
	"github.com/Misaka477/Natalia-Cli/internal/toolreturn"
	"github.com/Misaka477/Natalia-Cli/internal/toolschema"
)

type Run struct{}

const maxShellOutputBytes = 50000
const dangerConfirmedArg = "__natalia_danger_confirmed"

//go:embed run.md
var runDescription string

var (
	outputCacheMu sync.RWMutex
	outputCache   = map[string]string{}
)

func cacheOutput(data string) string {
	raw := make([]byte, 8)
	rand.Read(raw)
	id := "sh_" + hex.EncodeToString(raw)
	outputCacheMu.Lock()
	outputCache[id] = data
	outputCacheMu.Unlock()
	return id
}

func readCachedOutput(id string, offset, limit int) (string, bool) {
	outputCacheMu.RLock()
	data, ok := outputCache[id]
	outputCacheMu.RUnlock()
	if !ok {
		return "", false
	}
	if offset < 0 {
		offset = 0
	}
	if offset >= len(data) {
		return "", true
	}
	slice := data[offset:]
	if limit > 0 && len(slice) > limit {
		slice = slice[:limit]
	}
	return slice, true
}

type RunParams struct {
	Command   string            `json:"command,omitempty" description:"要执行的 shell 命令。执行后输出会被自动缓存，大输出自动截断但不丢失"`
	Timeout   string            `json:"timeout,omitempty" description:"可选，超时秒数，默认 60，最大 600"`
	CWD       string            `json:"cwd,omitempty" description:"可选，命令工作目录，必须是已存在目录"`
	MaxOutput string            `json:"max_output,omitempty" description:"可选，最大输出字节数，默认 50000，最大 200000"`
	Shell     string            `json:"shell,omitempty" description:"可选，shell 路径或名称；允许 /bin/bash、bash、/bin/sh、sh，默认 /bin/bash"`
	Env       map[string]string `json:"env,omitempty" description:"可选，附加环境变量；变量名必须安全且不得包含 secret/token/password/key 等敏感名称"`
	OutputID  string            `json:"output_id,omitempty" description:"可选，读取此前命令缓存的全量输出片段；指定此参数时不执行新命令，仅配合 offset/limit 读取"`
	Offset    int               `json:"offset,omitempty" description:"可选，缓存读取起始字节；仅配合 output_id 使用"`
	Limit     int               `json:"limit,omitempty" description:"可选，缓存读取最大字节数；仅配合 output_id 使用"`
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
	// Normalize numeric params from float64 to string if needed
	for _, key := range []string{"timeout", "max_output"} {
		if v, ok := args[key]; ok {
			if n, ok := v.(float64); ok {
				args[key] = fmt.Sprintf("%.0f", n)
			}
		}
	}
	params, err := toolschema.Decode[RunParams](args)
	if err != nil {
		return toolreturn.Return{IsError: true}, err
	}

	// Cache read path: no command, just output_id
	if params.Command == "" && params.OutputID != "" {
		slice, ok := readCachedOutput(params.OutputID, params.Offset, params.Limit)
		if !ok {
			return toolreturn.Return{IsError: true}, fmt.Errorf("cached output %q not found (may have expired)", params.OutputID)
		}
		meta := ""
		if params.Offset <= 0 && slice != "" {
			meta = fmt.Sprintf("--- cached output %s (offset=0 limit=%d) ---\n", params.OutputID, params.Limit)
		} else {
			meta = fmt.Sprintf("--- cached output %s (offset=%d limit=%d) ---\n", params.OutputID, params.Offset, params.Limit)
		}
		return toolreturn.Return{ModelText: secret.RedactString(meta + slice)}, nil
	}

	if params.Command == "" {
		return toolreturn.Return{IsError: true}, fmt.Errorf("command is required")
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
	timedOut := ctx.Err() == context.DeadlineExceeded

	var fullOutput strings.Builder
	if timedOut {
		fullOutput.WriteString(fmt.Sprintf("TIMEOUT: command exceeded %d seconds\n", timeout))
	}
	stdoutStr := stdout.String()
	stderrStr := stderr.String()
	if stdoutStr != "" {
		fullOutput.WriteString(stdoutStr)
	}
	if stderrStr != "" {
		fullOutput.WriteString("\nSTDERR:\n" + stderrStr)
	}
	if err != nil {
		fullOutput.WriteString(fmt.Sprintf("\nERROR: %v", err))
	}
	fullStr := secret.RedactString(fullOutput.String())

	// Always cache full output; show cached_id in result
	cacheID := cacheOutput(fullStr)
	var modelText string
	if len(fullStr) > maxOutput {
		modelText = fmt.Sprintf("output_cached_id=%s\n[showing first %d of %d bytes; use run_shell(output_id=%q) to read more]\n%s",
			cacheID, maxOutput, len(fullStr), cacheID, limitOutput(fullStr, maxOutput))
	} else {
		modelText = fmt.Sprintf("output_cached_id=%s\n%s", cacheID, fullStr)
	}

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
