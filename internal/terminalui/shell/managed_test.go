package shell

import (
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/presentation"
	tea "github.com/charmbracelet/bubbletea"
)

func TestManagedModelSeparatesThinkingAndAssistant(t *testing.T) {
	m := newManagedModel(make(chan SteerCommand, 1))
	m = m.applyPresentation(presentation.Event{Type: presentation.EvtContentPart, Data: presentation.ContentPartPayload{Content: "plan", IsThinking: true}})
	m = m.applyPresentation(presentation.Event{Type: presentation.EvtContentPart, Data: presentation.ContentPartPayload{Content: "answer", IsThinking: false}})
	view := m.View()
	for _, want := range []string{"Thinking", "plan", "Assistant", "answer"} {
		if !strings.Contains(view, want) {
			t.Fatalf("expected %q in managed view, got %q", want, view)
		}
	}
}

func TestManagedModelTextareaHasNoPromptForIME(t *testing.T) {
	m := newManagedModel(make(chan SteerCommand, 1))
	if m.input.Prompt != "" {
		t.Fatalf("textarea prompt should be empty to avoid IME preedit offset, got %q", m.input.Prompt)
	}
	if !strings.Contains(m.View(), "Message") {
		t.Fatalf("expected external message label in view, got %q", m.View())
	}
}

func TestManagedModelEnterSubmitsAndCtrlJInsertsNewline(t *testing.T) {
	steerCh := make(chan SteerCommand, 1)
	m := newManagedModel(steerCh)
	m.input.SetValue("你好")
	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyCtrlJ})
	m = updated.(managedModel)
	if !strings.Contains(m.input.Value(), "\n") {
		t.Fatalf("expected Ctrl+J to insert newline, got %q", m.input.Value())
	}
	m.input.SetValue("你好")
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = updated.(managedModel)
	select {
	case cmd := <-steerCh:
		if cmd.Type != "submit" || cmd.Text != "你好" {
			t.Fatalf("unexpected steer command: %+v", cmd)
		}
	default:
		t.Fatal("expected submit command")
	}
}
