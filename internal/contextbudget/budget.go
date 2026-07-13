package contextbudget

import (
	"fmt"
	"strings"
)

const DefaultToolResultMaxChars = 0

func BudgetToolResult(toolName, content string, maxChars int) string {
	return content
}

func CollapseRepeatedLines(content string, maxRepeats int) string {
	return content
}

func LimitToolResult(content string, maxChars int) string {
	return content
}

func shouldSummarizeShell(toolName, content string, originalLen, maxChars int) bool {
	if maxChars <= 0 || originalLen <= maxChars {
		return false
	}
	if toolName != "run_shell" {
		return false
	}
	return strings.Contains(content, "\nERROR:") || strings.Contains(content, "STDERR:") || hasFailureLine(content)
}

func summarizeShellFailure(content string, maxChars int) string {
	lines := strings.Split(content, "\n")
	interesting := make([]string, 0, 32)
	seen := make(map[int]bool)
	for i, line := range lines {
		if isFailureLine(line) {
			start := max(0, i-1)
			end := min(len(lines), i+2)
			for j := start; j < end; j++ {
				if !seen[j] {
					interesting = append(interesting, lines[j])
					seen[j] = true
				}
			}
		}
	}
	if len(interesting) == 0 {
		return LimitToolResult(content, maxChars)
	}

	tailStart := max(0, len(lines)-20)
	tail := lines[tailStart:]
	var b strings.Builder
	b.WriteString(fmt.Sprintf("[shell/test output summarized: original %d bytes]\n", len(content)))
	b.WriteString("\nKey failure lines:\n")
	b.WriteString(strings.Join(interesting, "\n"))
	b.WriteString("\n\nTail:\n")
	b.WriteString(strings.Join(tail, "\n"))
	return LimitToolResult(b.String(), maxChars)
}

func hasFailureLine(content string) bool {
	for _, line := range strings.Split(content, "\n") {
		if isFailureLine(line) {
			return true
		}
	}
	return false
}

func isFailureLine(line string) bool {
	lower := strings.ToLower(line)
	markers := []string{"error", "failed", "failure", "panic", "fatal", "exception", "undefined", "cannot", "not found", "no such file"}
	for _, marker := range markers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return strings.HasPrefix(line, "--- FAIL:") || strings.HasPrefix(line, "FAIL")
}
