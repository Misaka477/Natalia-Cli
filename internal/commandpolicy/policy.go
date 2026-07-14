package commandpolicy

import (
	"fmt"
	"strings"
)

const confirmationArg = "__natalia_command_policy_confirmed"

type Level string

const (
	LevelAllow            Level = "allow"
	LevelExplicitApproval Level = "explicit_approval"
	LevelHardDeny         Level = "hard_deny"
)

// Decision describes whether a command needs explicit user confirmation.
// Callers must reject unconfirmed commands; the engine is responsible for
// obtaining that confirmation through the configured approval transport.
type Decision struct {
	Level   Level
	Reason  string
	Rule    string
	Command string
}

func (d Decision) RequiresConfirmation() bool { return d.Level == LevelExplicitApproval }

// Evaluate applies the shared destructive-command policy to a program and
// its arguments. It intentionally operates on a normalized command line so
// shell, process, background, and PTY entry points share the same boundary.
func Evaluate(command string, args []string) Decision {
	line := strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(command+" "+strings.Join(args, " "))), " "))
	patterns := []struct {
		level Level
		text  string
	}{
		{LevelHardDeny, "rm -rf /"},
		{LevelHardDeny, "rm -fr /"},
		{LevelHardDeny, "mkfs"},
		{LevelHardDeny, "mke2fs"},
		{LevelHardDeny, "mkswap"},
		{LevelHardDeny, ":(){ :|:& };:"},
		{LevelHardDeny, "dd if=/dev/"},
		{LevelHardDeny, " of=/dev/"},
		{LevelHardDeny, "> /dev/"},
		{LevelHardDeny, ">/dev/"},
		{LevelExplicitApproval, "shutdown"},
		{LevelExplicitApproval, "reboot"},
		{LevelExplicitApproval, "halt"},
		{LevelExplicitApproval, "poweroff"},
		{LevelExplicitApproval, "curl "},
		{LevelExplicitApproval, "wget "},
	}
	for _, entry := range patterns {
		if !strings.Contains(line, entry.text) {
			continue
		}
		switch entry.text {
		case "rm -rf /", "rm -fr /":
			if matchesRootTarget(line, entry.text) {
				return Decision{Level: entry.level, Reason: fmt.Sprintf("matched dangerous command pattern %q", entry.text), Rule: entry.text, Command: line}
			}
			continue
		case "curl ", "wget ":
			if strings.Contains(line, "| sh") || strings.Contains(line, "| bash") {
				return Decision{Level: entry.level, Reason: "remote download piped to shell", Rule: "curl|bash", Command: line}
			}
			continue
		case "dd if=/dev/":
			if strings.Contains(line, " of=/dev/") || strings.Contains(line, " of=/dev/") {
				return Decision{Level: entry.level, Reason: fmt.Sprintf("matched dangerous command pattern %q", entry.text+" of=/dev/"), Rule: entry.text+" of=/dev/", Command: line}
			}
			continue
		}
		return Decision{Level: entry.level, Reason: fmt.Sprintf("matched dangerous command pattern %q", entry.text), Rule: entry.text, Command: line}
	}
	if matchesRootTarget(line, "chmod -r /") || matchesRootTarget(line, "chown -r /") {
		return Decision{Level: LevelHardDeny, Reason: "recursive ownership or permission change on root filesystem", Rule: "chmod/chown -r /", Command: line}
	}
	if strings.Contains(line, "> /proc/") || strings.Contains(line, ">/proc/") || strings.Contains(line, "> /sys/") || strings.Contains(line, ">/sys/") || strings.Contains(line, "tee /proc/") || strings.Contains(line, "tee /sys/") {
		return Decision{Level: LevelExplicitApproval, Reason: "writes to kernel control filesystem", Rule: "write /proc /sys", Command: line}
	}
	return Decision{Level: LevelAllow, Command: line}
}

func matchesRootTarget(line, prefix string) bool {
	idx := strings.Index(line, prefix)
	if idx < 0 {
		return false
	}
	rest := strings.TrimSpace(line[idx+len(prefix):])
	return rest == "" || strings.HasPrefix(rest, "*") || strings.HasPrefix(rest, ";") || strings.HasPrefix(rest, "&&") || strings.HasPrefix(rest, "||")
}

func MarkConfirmed(args map[string]any) { args[confirmationArg] = true }

func IsConfirmed(args map[string]any) bool {
	confirmed, _ := args[confirmationArg].(bool)
	return confirmed
}

func RequireConfirmation(args map[string]any, decision Decision) error {
	switch decision.Level {
	case LevelHardDeny:
		return fmt.Errorf("dangerous command is hard denied: %s", decision.Reason)
	case LevelExplicitApproval:
		if !IsConfirmed(args) {
			return fmt.Errorf("dangerous command requires explicit user confirmation: %s", decision.Reason)
		}
	case LevelAllow:
	}
	return nil
}
