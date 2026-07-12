package approval

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"sync"
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
		"write_file":        true,
		"edit_file":         true,
		"run_shell":         true,
		"process_start":     true,
		"process_stop":      true,
		"background_start":  true,
		"background_stop":   true,
		"interactive_start": true,
		"interactive_write": true,
		"interactive_keys":  true,
		"interactive_stop":  true,
		"agent_spawn":       true,
		"agent_stop":        true,
		"agent_resume":      true,
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
	Mode        Mode
	RequestFunc func(toolName, description string) bool
}

func New(mode Mode) *Approver {
	return &Approver{Mode: mode}
}

func (a *Approver) Request(toolName, description string) bool {
	switch a.Mode {
	case ModeJustDoIt:
		return true
	case ModeReadOnly:
		return false
	default:
		if a.RequestFunc != nil {
			return a.RequestFunc(toolName, description)
		}
		return a.interactivePrompt(toolName, description)
	}
}

func (a *Approver) RequestExplicit(toolName, description string) bool {
	if a == nil || a.Mode == ModeReadOnly {
		return false
	}
	if a.RequestFunc != nil {
		return a.RequestFunc(toolName, description)
	}
	return a.interactivePrompt(toolName, description)
}

func (a *Approver) interactivePrompt(tool, desc string) bool {
	fmt.Fprintf(os.Stderr, "\n[审批] %s: %s\n", tool, desc)
	fmt.Fprint(os.Stderr, "允许执行？[Y/n] ")

	reader := bufio.NewReader(os.Stdin)
	response, _ := reader.ReadString('\n')
	response = strings.TrimSpace(strings.ToLower(response))

	return response != "n" && response != "no"
}
