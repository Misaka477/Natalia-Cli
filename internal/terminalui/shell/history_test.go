package shell

import (
	"testing"
)

func TestNewHistory(t *testing.T) {
	h := NewHistory(10)
	if h == nil {
		t.Fatal("NewHistory returned nil")
	}
	if got := h.Current(); got != "" {
		t.Fatalf("Current() = %q, want empty", got)
	}
}

func TestHistoryUpDownEmpty(t *testing.T) {
	h := NewHistory(10)
	if got := h.Up(); got != "" {
		t.Fatalf("Up() = %q, want empty", got)
	}
	if got := h.Down(); got != "" {
		t.Fatalf("Down() = %q, want empty", got)
	}
}

func TestHistoryAddEntry(t *testing.T) {
	h := NewHistory(10)
	h.AddEntry("hello")
	h.AddEntry("world")
	if got := h.Current(); got != "" {
		t.Fatalf("Current() = %q, want empty draft", got)
	}
}

func TestHistoryUpDown(t *testing.T) {
	h := NewHistory(10)
	h.AddEntry("first")
	h.AddEntry("second")
	h.AddEntry("third")

	if got := h.Up(); got != "third" {
		t.Fatalf("Up() = %q, want %q", got, "third")
	}
	if got := h.Up(); got != "second" {
		t.Fatalf("Up() = %q, want %q", got, "second")
	}
	if got := h.Up(); got != "first" {
		t.Fatalf("Up() = %q, want %q", got, "first")
	}
	if got := h.Up(); got != "first" {
		t.Fatalf("Up() at top = %q, want %q", got, "first")
	}
}

func TestHistoryDown(t *testing.T) {
	h := NewHistory(10)
	h.AddEntry("first")
	h.AddEntry("second")

	h.Up()
	h.Up()
	if got := h.Down(); got != "second" {
		t.Fatalf("Down() = %q, want %q", got, "second")
	}
	if got := h.Down(); got != "" {
		t.Fatalf("Down() = %q, want empty draft", got)
	}
	if got := h.Down(); got != "" {
		t.Fatalf("Down() past end = %q, want empty draft", got)
	}
}

func TestHistorySaveDraft(t *testing.T) {
	h := NewHistory(10)
	h.SaveDraft("draft text")
	if got := h.Current(); got != "draft text" {
		t.Fatalf("Current() = %q, want %q", got, "draft text")
	}
}

func TestHistoryDraftPreservedThroughNavigation(t *testing.T) {
	h := NewHistory(10)
	h.AddEntry("entry1")
	h.AddEntry("entry2")
	h.SaveDraft("my draft")

	h.Up()
	if got := h.Current(); got != "entry2" {
		t.Fatalf("Current() = %q, want %q", got, "entry2")
	}
	h.Down()
	if got := h.Current(); got != "my draft" {
		t.Fatalf("Current() = %q, want %q", got, "my draft")
	}
}

func TestHistoryMaxSize(t *testing.T) {
	h := NewHistory(3)
	h.AddEntry("a")
	h.AddEntry("b")
	h.AddEntry("c")
	h.AddEntry("d")
	h.AddEntry("e")

	h.Up()
	if got := h.Current(); got != "e" {
		t.Fatalf("Current() = %q, want %q", got, "e")
	}
	h.Up()
	if got := h.Current(); got != "d" {
		t.Fatalf("Current() = %q, want %q", got, "d")
	}
	h.Up()
	if got := h.Current(); got != "c" {
		t.Fatalf("Current() = %q, want %q", got, "c")
	}
	h.Up()
	if got := h.Current(); got != "c" {
		t.Fatalf("Current() at top = %q, want %q", got, "c")
	}
}

func TestHistoryAddEntryEmpty(t *testing.T) {
	h := NewHistory(10)
	h.AddEntry("")
	if got := h.Current(); got != "" {
		t.Fatalf("Current() = %q, want empty", got)
	}
}

func TestHistoryAddEntryDuplicate(t *testing.T) {
	h := NewHistory(10)
	h.AddEntry("text")
	h.AddEntry("text")
	h.Up()
	if got := h.Current(); got != "text" {
		t.Fatalf("Current() = %q, want %q", got, "text")
	}
	h.Up()
	if got := h.Up(); got != "text" {
		t.Fatalf("Up() = %q, want %q", got, "text")
	}
}

func TestHistoryMaxSizeMinimum(t *testing.T) {
	h := NewHistory(0)
	if h.maxSize != 1 {
		t.Fatalf("maxSize = %d, want 1", h.maxSize)
	}
}
