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

func TestLimitToolResultTruncatesLargeContent(t *testing.T) {
	content := strings.Repeat("x", 1000)
	got := LimitToolResult(content, 200)
	if len(got) > 200 {
		t.Fatalf("expected result <= 200 bytes, got %d", len(got))
	}
	if !strings.Contains(got, "[tool result truncated:") {
		t.Fatalf("expected truncation marker, got %q", got)
	}
}

func TestLimitToolResultDisabled(t *testing.T) {
	content := strings.Repeat("x", 1000)
	if got := LimitToolResult(content, 0); got != content {
		t.Fatal("expected maxChars <= 0 to disable truncation")
	}
}

func TestBudgetToolResultSummarizesShellFailure(t *testing.T) {
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
	if len(got) > 500 {
		t.Fatalf("expected summarized result <= 500 bytes, got %d", len(got))
	}
	for _, want := range []string{"[shell/test output summarized:", "--- FAIL: TestExample", "ERROR: exit status 1"} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected summary to contain %q, got %q", want, got)
		}
	}
	if strings.Count(got, "setup noise") > 5 {
		t.Fatalf("expected noisy prefix to be reduced, got %q", got)
	}
}

func TestBudgetToolResultDoesNotSummarizeNonShellTool(t *testing.T) {
	content := strings.Repeat("noise\n", 100) + "ERROR: bad"
	got := BudgetToolResult("read_file", content, 200)
	if strings.Contains(got, "[shell/test output summarized:") {
		t.Fatalf("expected non-shell result to use generic truncation, got %q", got)
	}
	if !strings.Contains(got, "[repeated line omitted") {
		t.Fatalf("expected repeated lines to be collapsed, got %q", got)
	}
}

func TestCollapseRepeatedLines(t *testing.T) {
	content := strings.Join([]string{"same", "same", "same", "same", "same", "next"}, "\n")
	got := CollapseRepeatedLines(content, 3)
	if strings.Count(got, "same") != 3 {
		t.Fatalf("expected three repeated lines to remain, got %q", got)
	}
	if !strings.Contains(got, "[repeated line omitted 2 times]") {
		t.Fatalf("expected repeated line marker, got %q", got)
	}
	if !strings.HasSuffix(got, "next") {
		t.Fatalf("expected following line to remain, got %q", got)
	}
}

func TestBudgetToolResultCollapsesRepeatedLinesBeforeTruncation(t *testing.T) {
	content := strings.Repeat("same line\n", 100)
	got := BudgetToolResult("read_file", content, 1000)
	if strings.Count(got, "same line") != 3 {
		t.Fatalf("expected repeated lines collapsed, got %q", got)
	}
	if !strings.Contains(got, "[repeated line omitted") {
		t.Fatalf("expected repeated line marker, got %q", got)
	}
}

func TestBudgetToolResultUsesGenericLimitForNonFileLargeContent(t *testing.T) {
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
	if strings.Contains(got, "[large file sliced:") {
		t.Fatalf("expected non-file result not to use file slicing, got %q", got)
	}
	if !strings.Contains(got, "[tool result truncated:") {
		t.Fatalf("expected generic truncation, got %q", got)
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

func TestShouldSummarizeShellAndFallbackSummary(t *testing.T) {
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
	if !strings.Contains(got, "[tool result truncated:") || strings.Contains(got, "[shell/test output summarized:") {
		t.Fatalf("expected fallback generic truncation when no failure lines, got %q", got)
	}
}

func TestLimitToolResultSmallMaxCharsFloorsAt128(t *testing.T) {
	content := strings.Repeat("x", 300)
	got := LimitToolResult(content, 10)
	if len(got) > 128 || !strings.Contains(got, "[tool result truncated:") {
		t.Fatalf("expected small maxChars to floor at 128 with marker, len=%d got=%q", len(got), got)
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
