package skill

import (
	"fmt"
	"strings"
)

type Policy struct {
	AllowedTools    []string
	RequireApproval bool
	MaxScriptCalls  int
	SandboxRequired bool
}

var modeAllowlists = map[string][]string{
	"default":    {"bash", "read", "write", "edit", "glob", "grep", "webfetch", "browser", "tool"},
	"restricted": {"read", "glob", "grep", "webfetch"},
	"sandbox":    {"read", "glob", "grep"},
	"full":       {"bash", "read", "write", "edit", "glob", "grep", "webfetch", "browser", "tool", "exec", "script", "agent"},
}

func ApprovedTools(requested []string, mode string) []string {
	allowlist, ok := modeAllowlists[mode]
	if !ok {
		allowlist = modeAllowlists["default"]
	}
	allowedSet := make(map[string]bool, len(allowlist))
	for _, t := range allowlist {
		allowedSet[strings.ToLower(t)] = true
	}
	var result []string
	for _, t := range requested {
		if allowedSet[strings.ToLower(t)] {
			result = append(result, t)
		}
	}
	return result
}

func findDisallowed(requested []string, mode string) []string {
	allowlist, ok := modeAllowlists[mode]
	if !ok {
		allowlist = modeAllowlists["default"]
	}
	allowedSet := make(map[string]bool, len(allowlist))
	for _, t := range allowlist {
		allowedSet[strings.ToLower(t)] = true
	}
	var denied []string
	for _, t := range requested {
		if !allowedSet[strings.ToLower(t)] {
			denied = append(denied, t)
		}
	}
	return denied
}

func EvaluatePolicy(skillFM *SkillFrontmatter, mode string) (*Policy, []string) {
	var warnings []string
	if skillFM == nil {
		return &Policy{}, warnings
	}

	approved := ApprovedTools(skillFM.AllowedTools, mode)
	for _, d := range findDisallowed(skillFM.AllowedTools, mode) {
		warnings = append(warnings, fmt.Sprintf("tool %q is not allowed in mode %q", d, mode))
	}

	requireApproval := false
	maxCalls := 10

	if skillFM.ToolPolicy != nil {
		for tool, rule := range *skillFM.ToolPolicy {
			if rule.RequireApproval {
				requireApproval = true
			}
			if rule.MaxCalls > 0 && rule.MaxCalls < maxCalls {
				maxCalls = rule.MaxCalls
			}
			for _, deniedTool := range rule.Denied {
				warnings = append(warnings, fmt.Sprintf("tool %q denied for parent tool %q", deniedTool, tool))
			}
		}
	}

	return &Policy{
		AllowedTools:    approved,
		RequireApproval: requireApproval,
		MaxScriptCalls:  maxCalls,
		SandboxRequired: mode == "sandbox",
	}, warnings
}
