package diffutil

import (
	"fmt"
	"strings"
)

const (
	DefaultContextLines = 3
	DefaultMaxDiffLines = 400
	largeDiffCellLimit  = 4_000_000
)

type op struct {
	kind byte
	line string
}

func Unified(path, before, after string) string {
	return UnifiedWithOptions(path, before, after, DefaultContextLines, DefaultMaxDiffLines)
}

func UnifiedWithOptions(path, before, after string, contextLines, maxDiffLines int) string {
	if contextLines < 0 {
		contextLines = DefaultContextLines
	}
	if maxDiffLines <= 0 {
		maxDiffLines = DefaultMaxDiffLines
	}
	beforeLines := splitLines(before)
	afterLines := splitLines(after)
	var ops []op
	if len(beforeLines)*len(afterLines) > largeDiffCellLimit {
		ops = coarseOps(beforeLines, afterLines)
	} else {
		ops = lineOps(beforeLines, afterLines)
	}
	lines := []string{fmt.Sprintf("--- a/%s", path), fmt.Sprintf("+++ b/%s", path)}
	lines = append(lines, hunkLines(ops, contextLines)...)
	return strings.Join(truncateLines(lines, maxDiffLines), "\n")
}

func splitLines(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, "\n")
	if strings.HasSuffix(s, "\n") {
		parts = parts[:len(parts)-1]
	}
	return parts
}

func lineOps(before, after []string) []op {
	n, m := len(before), len(after)
	dp := make([][]int, n+1)
	for i := range dp {
		dp[i] = make([]int, m+1)
	}
	for i := n - 1; i >= 0; i-- {
		for j := m - 1; j >= 0; j-- {
			if before[i] == after[j] {
				dp[i][j] = dp[i+1][j+1] + 1
			} else if dp[i+1][j] >= dp[i][j+1] {
				dp[i][j] = dp[i+1][j]
			} else {
				dp[i][j] = dp[i][j+1]
			}
		}
	}
	var ops []op
	for i, j := 0, 0; i < n || j < m; {
		if i < n && j < m && before[i] == after[j] {
			ops = append(ops, op{kind: ' ', line: before[i]})
			i++
			j++
		} else if j >= m || (i < n && dp[i+1][j] >= dp[i][j+1]) {
			ops = append(ops, op{kind: '-', line: before[i]})
			i++
		} else {
			ops = append(ops, op{kind: '+', line: after[j]})
			j++
		}
	}
	return ops
}

func coarseOps(before, after []string) []op {
	ops := make([]op, 0, len(before)+len(after))
	for _, line := range before {
		ops = append(ops, op{kind: '-', line: line})
	}
	for _, line := range after {
		ops = append(ops, op{kind: '+', line: line})
	}
	return ops
}

func hunkLines(ops []op, contextLines int) []string {
	var hunks []string
	oldLine, newLine := 1, 1
	for i := 0; i < len(ops); {
		if ops[i].kind == ' ' {
			oldLine++
			newLine++
			i++
			continue
		}
		start := max(0, i-contextLines)
		oldStart, newStart := oldLineAt(ops, start)
		end := i
		lastChange := i
		for end < len(ops) {
			if ops[end].kind != ' ' {
				lastChange = end
			}
			if end-lastChange >= contextLines && end > i {
				break
			}
			end++
		}
		if end < len(ops) {
			end = max(lastChange+1, end-contextLines+1)
		}
		oldCount, newCount := countRange(ops[start:end])
		hunks = append(hunks, fmt.Sprintf("@@ -%d,%d +%d,%d @@", oldStart, oldCount, newStart, newCount))
		for _, op := range ops[start:end] {
			hunks = append(hunks, string(op.kind)+op.line)
		}
		for i < end {
			if ops[i].kind != '+' {
				oldLine++
			}
			if ops[i].kind != '-' {
				newLine++
			}
			i++
		}
	}
	return hunks
}

func oldLineAt(ops []op, idx int) (int, int) {
	oldLine, newLine := 1, 1
	for i := 0; i < idx; i++ {
		if ops[i].kind != '+' {
			oldLine++
		}
		if ops[i].kind != '-' {
			newLine++
		}
	}
	return oldLine, newLine
}

func countRange(ops []op) (int, int) {
	oldCount, newCount := 0, 0
	for _, op := range ops {
		if op.kind != '+' {
			oldCount++
		}
		if op.kind != '-' {
			newCount++
		}
	}
	return oldCount, newCount
}

func truncateLines(lines []string, maxLines int) []string {
	if len(lines) <= maxLines {
		return lines
	}
	out := append([]string{}, lines[:maxLines]...)
	out = append(out, fmt.Sprintf("[diff truncated: showing %d of %d lines]", maxLines, len(lines)))
	return out
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
