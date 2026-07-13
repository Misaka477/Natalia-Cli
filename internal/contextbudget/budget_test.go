package contextbudget

import (
	"strings"
	"testing"
)

func TestLimitToolResultKeepsSmallContent(t *testing.T) {
	content := "small result"
	if got := LimitToolResult(content, 20); got != content {
		t.Fatalf("expected small content unchanged, got %q", got)
	}
}

func TestLimitToolResultDoesNotTruncateLargeContent(t *testing.T) {
	content := strings.Repeat("x", 1000)
	got := LimitToolResult(content, 200)
	if got != content {
		t.Fatalf("expected large content unchanged, got %q", got)
	}
}

func TestLimitToolResultDisabled(t *testing.T) {
	content := strings.Repeat("x", 1000)
	if got := LimitToolResult(content, 0); got != content {
		t.Fatal("expected maxChars <= 0 to disable truncation")
	}
}

func TestBudgetToolResultDoesNotSummarizeShellFailure(t *testing.T) {
	content := strings.Join([]string{
		strings.Repeat("setup noise\n", 80),
		"pkg/example_test.go:12: expected true got false",
		"--- FAIL: TestExample (0.01s)",
		strings.Repeat("more noise\n", 80),
		"STDERR:",
		"go test failed",
		"ERROR: exit status 1",
	}, "\n")
	got := BudgetToolResult("run_shell", content, 500)
	if got != content {
		t.Fatalf("expected shell failure output unchanged, got %q", got)
	}
}

func TestBudgetToolResultDoesNotCollapseNonShellTool(t *testing.T) {
	content := strings.Repeat("noise\n", 100) + "ERROR: bad"
	got := BudgetToolResult("read_file", content, 200)
	if got != content {
		t.Fatalf("expected non-shell output unchanged, got %q", got)
	}
}

func TestCollapseRepeatedLinesNoOp(t *testing.T) {
	content := strings.Join([]string{"same", "same", "same", "same", "same", "next"}, "\n")
	got := CollapseRepeatedLines(content, 3)
	if got != content {
		t.Fatalf("expected repeated lines unchanged, got %q", got)
	}
}

func TestBudgetToolResultKeepsRepeatedLines(t *testing.T) {
	content := strings.Repeat("same line\n", 100)
	got := BudgetToolResult("read_file", content, 1000)
	if got != content {
		t.Fatalf("expected repeated lines unchanged, got %q", got)
	}
}

func TestBudgetToolResultKeepsNonFileLargeContent(t *testing.T) {
	var b strings.Builder
	b.WriteString("head\n")
	for i := 0; i < 80; i++ {
		b.WriteString("middle filler ")
		b.WriteString(string(rune('a' + i%26)))
		b.WriteString("\n")
	}
	b.WriteString("tail")
	content := b.String()
	got := BudgetToolResult("web_fetch", content, 400)
	if got != content {
		t.Fatalf("expected non-file output unchanged, got %q", got)
	}
}

func TestContextBudgetPureFailureHelpers(t *testing.T) {
	for _, line := range []string{"ERROR: bad", "--- FAIL: TestX", "panic: boom", "file not found", "cannot compile", "FAIL"} {
		if !isFailureLine(line) || !hasFailureLine("ok\n"+line+"\nmore") {
			t.Fatalf("expected failure line detection for %q", line)
		}
	}
	if isFailureLine("all good") || hasFailureLine("all good\nno issues") {
		t.Fatal("expected non-failure content not to be classified as failure")
	}
}

func TestLegacyFailureHelpersRemainPure(t *testing.T) {
	longShell := strings.Repeat("noise\n", 100) + "STDERR:\ncompiler failed"
	if !shouldSummarizeShell("run_shell", longShell, len(longShell), 100) {
		t.Fatal("expected large shell stderr output to be summarized")
	}
	if shouldSummarizeShell("read_file", longShell, len(longShell), 100) {
		t.Fatal("expected non-shell tool not to use shell summarizer")
	}
	if shouldSummarizeShell("run_shell", longShell, len(longShell), 0) {
		t.Fatal("expected maxChars <= 0 to disable summarization")
	}
	content := strings.Repeat("plain output\n", 80)
	got := summarizeShellFailure(content, 200)
	if got != content {
		t.Fatalf("expected legacy fallback to preserve content after truncation disabled, got %q", got)
	}
}

func TestLimitToolResultSmallMaxCharsStillNoOp(t *testing.T) {
	content := strings.Repeat("x", 300)
	got := LimitToolResult(content, 10)
	if got != content {
		t.Fatalf("expected small maxChars not to truncate, got %q", got)
	}
}

func TestCollapseRepeatedLinesDisabledAndEmpty(t *testing.T) {
	if got := CollapseRepeatedLines("same\nsame", 0); got != "same\nsame" {
		t.Fatalf("expected maxRepeats <= 0 to disable collapse, got %q", got)
	}
	if got := CollapseRepeatedLines("", 3); got != "" {
		t.Fatalf("expected empty content unchanged, got %q", got)
	}
}
