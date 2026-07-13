package terminalui

import (
	"strings"
	"testing"
)

func TestThemeLabelPreservesPlainText(t *testing.T) {
	got := NewTheme().Label(KindStep, "step 2")
	if !strings.Contains(got, "[step 2]") {
		t.Fatalf("expected styled label to preserve searchable text, got %q", got)
	}
}

func TestThemeChecklistPreservesPlainText(t *testing.T) {
	theme := NewTheme()
	for _, want := range []string{"- [x] done", "- [ ] todo"} {
		got := theme.Checklist(strings.Contains(want, "[x]"), strings.TrimPrefix(strings.TrimPrefix(want, "- [x] "), "- [ ] "))
		if !strings.Contains(got, want) {
			t.Fatalf("expected checklist line to preserve %q, got %q", want, got)
		}
	}
}

func TestThemeReasoningKeepsContent(t *testing.T) {
	got := NewTheme().Reasoning("thinking")
	if !strings.Contains(got, "thinking") {
		t.Fatalf("expected reasoning style to keep content, got %q", got)
	}
}
