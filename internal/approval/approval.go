package approval

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type Mode string

const (
	ModeJustDoIt Mode = "just_do_it"
	ModeAsk      Mode = "ask"
	ModeReadOnly Mode = "read_only"
)

var WriteTools = map[string]bool{
	"write_file":       true,
	"edit_file":        true,
	"run_shell":        true,
	"process_start":    true,
	"process_stop":     true,
	"background_start": true,
	"background_stop":  true,
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
