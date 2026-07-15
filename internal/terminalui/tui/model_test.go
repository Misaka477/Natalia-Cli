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

func TestModelWireOutputDoesNotCompletePendingSubmit(t *testing.T) {
	m := NewModel(func(input string) string { return "" }, nil)
	m.ready = true
	m.viewport = viewport.New(80, 24)
	m.input.Width = 80
	m.content = "buffer"
	m.viewport.SetContent(m.content)
	m.pending = true

	updated, _ := m.Update(WireOutputMsg("Using read_file (README.md)\n"))
	m = updated.(Model)
	if !m.pending {
		t.Fatal("wire output should not clear the pending submit state")
	}
	if !strings.Contains(m.viewport.View(), "Using read_file") {
		t.Fatalf("expected viewport to contain wire output, got %q", m.viewport.View())
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

func TestModelAskUserModalAppendsQuestionAndAcceptsAnswer(t *testing.T) {
	m := NewModel(func(input string) string { return "" }, nil)
	m.ready = true
	m.viewport = viewport.New(80, 24)
	m.input.Width = 80
	m.content = "buffer start"
	m.viewport.SetContent(m.content)

	respondCh := make(chan string, 1)
	updated, _ := m.Update(AskUserPromptMsg{
		Question: "Continue?",
		Options:  []string{"yes", "no", "later", "never", "custom"},
		Fallback: "no",
		Respond:  respondCh,
	})
	m = updated.(Model)

	if m.pendingAsk == nil {
		t.Fatal("expected pendingAsk to be set")
	}
	if m.pendingAsk.Question != "Continue?" {
		t.Fatalf("expected question 'Continue?', got %q", m.pendingAsk.Question)
	}
	if !strings.Contains(m.viewport.View(), "Continue?") || !strings.Contains(m.viewport.View(), "5. custom") || !strings.Contains(m.viewport.View(), "custom text allowed") || !strings.Contains(m.viewport.View(), "fallback: no") {
		t.Fatalf("expected viewport to show question, got %q", m.viewport.View())
	}

	m.input.SetValue("my own answer")
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(Model)
	if m.pendingAsk != nil {
		t.Fatal("expected pendingAsk to be cleared after answer")
	}
	select {
	case ans := <-respondCh:
		if ans != "my own answer" {
			t.Fatalf("expected custom answer, got %q", ans)
		}
	default:
		t.Fatal("expected response channel to have answer")
	}
}

func TestModelAskUserInputIsVisible(t *testing.T) {
	m := NewModel(func(input string) string { return "" }, nil)
	m.ready = true
	m.viewport = viewport.New(80, 24)
	m.input.Width = 80
	m.content = "buffer"
	m.viewport.SetContent(m.content)

	respondCh := make(chan string, 1)
	updated, _ := m.Update(AskUserPromptMsg{Question: "Describe the issue", Respond: respondCh})
	m = updated.(Model)
	m.input.SetValue("visible draft answer")

	if !strings.Contains(m.View(), "visible draft answer") {
		t.Fatalf("expected ask_user input to be visible in TUI view, got %q", m.View())
	}
}

func TestModelAskUserBlocksSubmitWhilePending(t *testing.T) {
	m := NewModel(func(input string) string { return "" }, nil)
	m.ready = true
	m.viewport = viewport.New(80, 24)
	m.input.Width = 80
	m.content = "buffer"
	m.viewport.SetContent(m.content)

	respondCh := make(chan string, 1)
	updated, _ := m.Update(AskUserPromptMsg{
		Question: "Proceed?",
		Respond:  respondCh,
	})
	m = updated.(Model)

	if m.pendingAsk == nil {
		t.Fatal("expected pendingAsk to be set")
	}
	// Submit should be blocked: pressing Enter should answer question, not submit
	m.input.SetValue("new input")
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(Model)
	if m.pendingAsk != nil {
		t.Fatal("expected pendingAsk to be cleared after answering")
	}
}

func TestModelApprovalModalRespondsYesNo(t *testing.T) {
	m := NewModel(func(input string) string { return "" }, nil)
	m.ready = true
	m.viewport = viewport.New(80, 24)
	m.input.Width = 80
	m.content = "buffer"
	m.viewport.SetContent(m.content)

	respondCh := make(chan bool, 1)
	updated, _ := m.Update(ApprovalPromptMsg{
		ToolName:    "write_file",
		Description: "Write to /etc/passwd",
		Respond:     respondCh,
	})
	m = updated.(Model)
	if m.pendingApproval == nil {
		t.Fatal("expected pendingApproval to be set")
	}
	if !strings.Contains(m.viewport.View(), "write_file") {
		t.Fatalf("expected viewport to show tool name, got %q", m.viewport.View())
	}

	m.input.SetValue("y")
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(Model)
	if m.pendingApproval != nil {
		t.Fatal("expected pendingApproval to be cleared")
	}
	select {
	case approved := <-respondCh:
		if !approved {
			t.Fatal("expected approved to be true")
		}
	default:
		t.Fatal("expected response channel to have value")
	}

	// Test rejection
	respondCh2 := make(chan bool, 1)
	updated, _ = m.Update(ApprovalPromptMsg{
		ToolName:    "test",
		Description: "test",
		Respond:     respondCh2,
	})
	m = updated.(Model)
	m.input.SetValue("n")
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(Model)
	select {
	case approved := <-respondCh2:
		if approved {
			t.Fatal("expected approved to be false")
		}
	default:
		t.Fatal("expected response channel to have value")
	}
}

func (m Model) updateWithOutput(text string) Model {
	updated, _ := m.Update(outputMsg(text))
	return updated.(Model)
}
