package approval

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"

	"github.com/Misaka477/Natalia-Cli/internal/display"
)

type Mode string

const (
	ModeJustDoIt Mode = "just_do_it"
	ModeAsk      Mode = "ask"
	ModeReadOnly Mode = "read_only"
)

var (
	writeToolsMu sync.RWMutex
	WriteTools   = map[string]bool{
		"write_file":          true,
		"edit_file":           true,
		"run_shell":           true,
		"process_start":       true,
		"process_stop":        true,
		"process_restart":     true,
		"process_attach":      true,
		"process_detach":      true,
		"process_cleanup":     true,
		"background_start":    true,
		"background_stop":     true,
		"background_restart":  true,
		"background_cleanup":  true,
		"interactive_start":   true,
		"interactive_write":   true,
		"interactive_keys":    true,
		"interactive_stop":    true,
		"interactive_cleanup": true,
		"interactive_attach":  true,
		"interactive_detach":  true,
		"interactive_resize":  true,
		"agent_spawn":         true,
		"agent_attach":        true,
		"agent_detach":        true,
		"agent_stop":          true,
		"agent_resume":        true,
	}
)

func RegisterWriteTool(name string) {
	name = strings.TrimSpace(name)
	if name == "" {
		return
	}
	writeToolsMu.Lock()
	defer writeToolsMu.Unlock()
	WriteTools[name] = true
}

func IsWriteTool(name string) bool {
	writeToolsMu.RLock()
	defer writeToolsMu.RUnlock()
	return WriteTools[name]
}

type Approver struct {
	Mode               Mode
	RequestFunc        func(toolName, description string) bool
	RequestDisplayFunc func(toolName, description string, blocks []display.Block) bool
}

func New(mode Mode) *Approver {
	return &Approver{Mode: mode}
}

func (a *Approver) Request(toolName, description string) bool {
	return a.RequestWithDisplay(toolName, description, nil)
}

func (a *Approver) RequestWithDisplay(toolName, description string, blocks []display.Block) bool {
	switch a.Mode {
	case ModeJustDoIt:
		return true
	case ModeReadOnly:
		return false
	default:
		if a.RequestDisplayFunc != nil {
			return a.RequestDisplayFunc(toolName, description, blocks)
		}
		if a.RequestFunc != nil {
			return a.RequestFunc(toolName, description)
		}
		return a.interactivePrompt(toolName, description, blocks)
	}
}

func (a *Approver) RequestExplicit(toolName, description string) bool {
	return a.RequestExplicitWithDisplay(toolName, description, nil)
}

func (a *Approver) RequestExplicitWithDisplay(toolName, description string, blocks []display.Block) bool {
	if a == nil || a.Mode == ModeReadOnly {
		return false
	}
	if a.RequestDisplayFunc != nil {
		return a.RequestDisplayFunc(toolName, description, blocks)
	}
	if a.RequestFunc != nil {
		return a.RequestFunc(toolName, description)
	}
	return a.interactivePrompt(toolName, description, blocks)
}

func (a *Approver) interactivePrompt(tool, desc string, blocks []display.Block) bool {
	fmt.Fprintf(os.Stderr, "\n[审批] %s: %s\n", tool, desc)
	for _, block := range blocks {
		renderDisplayBlock(os.Stderr, block)
	}
	fmt.Fprint(os.Stderr, "允许执行？[Y/n] ")

	reader := bufio.NewReader(os.Stdin)
	response, _ := reader.ReadString('\n')
	response = strings.TrimSpace(strings.ToLower(response))

	return response != "n" && response != "no"
}

func renderDisplayBlock(out *os.File, block display.Block) {
	switch block.Type {
	case display.BlockDiff:
		var diff display.DiffBlock
		if json.Unmarshal(block.Data, &diff) == nil {
			fmt.Fprintf(out, "\n[diff] %s\n%s\n", diff.Path, diff.Diff)
		}
	case display.BlockShell:
		var shell display.ShellBlock
		if json.Unmarshal(block.Data, &shell) == nil {
			fmt.Fprintf(out, "\n[shell] %s\n%s\n", shell.Command, shell.Output)
		}
	}
}
