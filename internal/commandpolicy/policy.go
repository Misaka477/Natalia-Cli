package commandpolicy

import (
	"fmt"
	"strings"
)

const confirmationArg = "__natalia_command_policy_confirmed"

// Decision describes whether a command needs explicit user confirmation.
// Callers must reject unconfirmed commands; the engine is responsible for
// obtaining that confirmation through the configured approval transport.
type Decision struct {
	Reason string
}

func (d Decision) RequiresConfirmation() bool { return d.Reason != "" }

// Evaluate applies the shared destructive-command policy to a program and
// its arguments. It intentionally operates on a normalized command line so
// shell, process, background, and PTY entry points share the same boundary.
func Evaluate(command string, args []string) Decision {
	line := strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(command+" "+strings.Join(args, " "))), " "))
	patterns := []string{
		"rm -rf ~", "rm -rf $home",
		"mkfs", "mke2fs", "mkswap", ":(){ :|:& };:",
		"dd if=/dev/", " of=/dev/", "> /dev/",
		"shutdown", "reboot", "halt", "poweroff",
		"curl ", "wget ",
	}
	if matchesRootTarget(line, "rm -rf /") || matchesRootTarget(line, "rm -fr /") {
		return Decision{Reason: "matched dangerous command pattern \"rm -rf /\""}
	}
	if matchesRootTarget(line, "chmod -r /") || matchesRootTarget(line, "chown -r /") {
		return Decision{Reason: "recursive ownership or permission change on root filesystem"}
	}
	for _, pattern := range patterns {
		if !strings.Contains(line, pattern) {
			continue
		}
		if pattern == "curl " || pattern == "wget " {
			if strings.Contains(line, "| sh") || strings.Contains(line, "| bash") {
				return Decision{Reason: "remote download piped to shell"}
			}
			continue
		}
		return Decision{Reason: fmt.Sprintf("matched dangerous command pattern %q", pattern)}
	}
	if strings.Contains(line, "> /proc/") || strings.Contains(line, ">/proc/") || strings.Contains(line, "> /sys/") || strings.Contains(line, ">/sys/") || strings.Contains(line, "tee /proc/") || strings.Contains(line, "tee /sys/") {
		return Decision{Reason: "writes to kernel control filesystem"}
	}
	return Decision{}
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
	if decision.RequiresConfirmation() && !IsConfirmed(args) {
		return fmt.Errorf("dangerous command requires explicit user confirmation: %s", decision.Reason)
	}
	return nil
}
