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
