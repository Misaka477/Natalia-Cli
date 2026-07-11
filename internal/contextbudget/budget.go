package contextbudget

import (
	"fmt"
	"strings"
)

const DefaultToolResultMaxChars = 12000

func BudgetToolResult(toolName, content string, maxChars int) string {
	originalLen := len(content)
	content = CollapseRepeatedLines(content, 3)
	if shouldSummarizeShell(toolName, content, originalLen, maxChars) {
		return summarizeShellFailure(content, maxChars)
	}
	return LimitToolResult(content, maxChars)
}

func CollapseRepeatedLines(content string, maxRepeats int) string {
	if maxRepeats <= 0 || content == "" {
		return content
	}
	lines := strings.Split(content, "\n")
	out := make([]string, 0, len(lines))
	last := ""
	repeats := 0
	skipped := 0
	flushSkipped := func() {
		if skipped > 0 {
			out = append(out, fmt.Sprintf("[repeated line omitted %d times]", skipped))
			skipped = 0
		}
	}
	for _, line := range lines {
		if line == last {
			repeats++
			if repeats <= maxRepeats {
				out = append(out, line)
			} else {
				skipped++
			}
			continue
		}
		flushSkipped()
		last = line
		repeats = 1
		out = append(out, line)
	}
	flushSkipped()
	return strings.Join(out, "\n")
}

func LimitToolResult(content string, maxChars int) string {
	if maxChars <= 0 || len(content) <= maxChars {
		return content
	}
	if maxChars < 128 {
		maxChars = 128
	}
	marker := fmt.Sprintf("\n\n[tool result truncated: original %d bytes, kept %d bytes]", len(content), maxChars)
	keep := maxChars - len(marker)
	if keep < 1 {
		keep = maxChars
		marker = ""
	}
	return content[:keep] + marker
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
