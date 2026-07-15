package tui

import (
	"strings"
	"testing"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
)

func TestModelViewShowsWelcomeAndInput(t *testing.T) {
	m := NewModel(func(input string) string { return "echo: " + input }, nil)
	m.ready = true
	m.viewport = viewport.New(80, 24)
	m.viewport.SetContent("welcome")
	m.input.Width = 80
	vpView := m.viewport.View()
	t.Logf("viewport.View() = %q", vpView)
	t.Logf("viewport.View() len = %d", len(vpView))
	view := m.View()
	if view == "" {
		t.Fatal("expected non-empty view")
	}
	if !strings.Contains(view, "welcome") {
		t.Fatalf("expected welcome message in view, got %q", view)
	}
}

func TestModelEnterSubmitsInput(t *testing.T) {
	m := NewModel(func(input string) string { return "echo: " + input }, nil)
	m.input.SetValue("hello")
	m.input.Width = 80
	m.viewport = viewport.New(80, 24)
	m.ready = true

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(Model)
	if !m.pending {
		t.Fatal("expected pending to be true after submit")
	}
	if !strings.Contains(m.viewport.View(), "> hello") {
		t.Fatalf("expected viewport to contain submitted input, got %q", m.viewport.View())
	}
	if !strings.Contains(m.viewport.View(), "(thinking...)") {
		t.Fatalf("expected viewport to contain thinking indicator, got %q", m.viewport.View())
	}

	m = m.updateWithOutput("echo: hello")
	if m.pending {
		t.Fatal("expected pending to be false after response")
	}
	if !strings.Contains(m.viewport.View(), "echo: hello") {
		t.Fatalf("expected viewport to contain response, got %q", m.viewport.View())
	}
}

func TestModelHistoryNavigation(t *testing.T) {
	m := NewModel(func(input string) string { return "" }, nil)
	m.history = []string{"first", "second", "third"}
	m.historyIdx = 3

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyUp})
	m = updated.(Model)
	if m.input.Value() != "third" {
		t.Fatalf("expected history up to show third, got %q", m.input.Value())
	}
	if m.historyIdx != 2 {
		t.Fatalf("expected historyIdx 2, got %d", m.historyIdx)
	}

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyUp})
	m = updated.(Model)
	if m.input.Value() != "second" {
		t.Fatalf("expected history up to show second, got %q", m.input.Value())
	}

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m = updated.(Model)
	if m.input.Value() != "third" {
		t.Fatalf("expected history down to show third, got %q", m.input.Value())
	}

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m = updated.(Model)
	if m.input.Value() != "" {
		t.Fatalf("expected history down at end to clear, got %q", m.input.Value())
	}
	if m.historyIdx != 3 {
		t.Fatalf("expected historyIdx 3 at end, got %d", m.historyIdx)
	}
}

func TestModelStatusBar(t *testing.T) {
	m := NewModel(func(input string) string { return "" }, func() string { return "mode: code | model: gpt-4" })
	m.ready = true
	m.viewport = viewport.New(80, 24)
	m.input.Width = 80
	view := m.View()
	if !strings.Contains(view, "mode: code | model: gpt-4") {
		t.Fatalf("expected status bar in view, got %q", view)
	}
}

func (m Model) updateWithOutput(text string) Model {
	updated, _ := m.Update(outputMsg(text))
	return updated.(Model)
}
