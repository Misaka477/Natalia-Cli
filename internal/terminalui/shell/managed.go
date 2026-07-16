package shell

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/Misaka477/Natalia-Cli/internal/presentation"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type ManagedRenderer struct {
	in      io.Reader
	out     io.Writer
	program *tea.Program
}

func NewManagedRenderer(in io.Reader, out io.Writer, theme Theme) *ManagedRenderer {
	return &ManagedRenderer{in: in, out: out}
}

func (r *ManagedRenderer) AcceptPresentationEvent(ev presentation.Event) {
	if r.program != nil {
		r.program.Send(ev)
	}
}

func (r *ManagedRenderer) RunWithOrchestrator(ctx context.Context, steerCh chan<- SteerCommand) error {
	model := newManagedModel(steerCh)
	r.program = tea.NewProgram(model, tea.WithInput(r.in), tea.WithOutput(r.out), tea.WithAltScreen(), tea.WithContext(ctx))
	_, err := r.program.Run()
	return err
}

type managedModel struct {
	viewport viewport.Model
	input    textarea.Model
	history  *History
	steerCh  chan<- SteerCommand

	width      int
	height     int
	content    string
	status     string
	processing bool
	queued     []string
	streaming  bool
	streamKind string
}

func newManagedModel(steerCh chan<- SteerCommand) managedModel {
	input := textarea.New()
	input.Placeholder = "输入消息..."
	input.Prompt = ""
	input.ShowLineNumbers = false
	input.CharLimit = MaxEditorBytes
	input.MaxHeight = 8
	input.SetHeight(1)
	input.SetWidth(80)
	input.Focus()

	vp := viewport.New(80, 20)
	content := strings.Join([]string{
		"Natalia shell UI",
		"managed by Bubble Tea + textarea + viewport",
		"Enter submit · Ctrl+J/Alt+Enter newline · Ctrl+C cancel/clear · Ctrl+D exit",
	}, "\n")
	vp.SetContent(content)
	vp.GotoBottom()

	return managedModel{
		viewport: vp,
		input:    input,
		history:  NewWorkspaceHistory(200),
		steerCh:  steerCh,
		content:  content,
		status:   "ready",
	}
}

func (m managedModel) Init() tea.Cmd {
	return textarea.Blink
}

func (m managedModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.layout()
		return m, nil
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC:
			if m.processing {
				m.sendSteer(SteerCommand{Type: "cancel"})
				m.status = "cancelled"
				return m, nil
			}
			if strings.TrimSpace(m.input.Value()) != "" {
				m.input.Reset()
				return m, nil
			}
			return m, tea.Quit
		case tea.KeyCtrlD:
			if strings.TrimSpace(m.input.Value()) == "" {
				return m, tea.Quit
			}
		case tea.KeyEnter:
			if msg.Alt {
				m.input.InsertString("\n")
				m.layout()
				return m, nil
			}
			return m.submit(), nil
		case tea.KeyCtrlJ:
			m.input.InsertString("\n")
			m.layout()
			return m, nil
		}
	case presentation.Event:
		m = m.applyPresentation(msg)
		return m, nil
	}

	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	m.layout()
	return m, cmd
}

func (m managedModel) submit() managedModel {
	text := m.input.Value()
	if strings.TrimSpace(text) == "" {
		return m
	}
	m.history.AddEntry(text)
	m.input.Reset()
	m.appendContent("\n" + lipgloss.NewStyle().Bold(true).Render("> ") + text + "\n")
	cmd := SteerCommand{Type: "submit", Text: text}
	if m.processing {
		m.queued = append(m.queued, text)
		m.status = fmt.Sprintf("queued %d", len(m.queued))
		return m
	}
	m.processing = true
	m.streaming = false
	m.status = "submitted"
	m.sendSteer(cmd)
	return m
}

func (m managedModel) applyPresentation(ev presentation.Event) managedModel {
	switch ev.Type {
	case presentation.EvtTurnBegin:
		m.processing = true
		m.streaming = false
		m.streamKind = ""
		m.status = "processing"
	case presentation.EvtContentPart:
		if p, ok := ev.Data.(presentation.ContentPartPayload); ok {
			kind := "assistant"
			if p.IsThinking {
				kind = "thinking"
			}
			m.ensureStreamBlock(kind)
			m.appendContent(p.Content)
		}
		m.status = "streaming"
	case presentation.EvtContentEnd:
		m.streaming = false
		m.streamKind = ""
		m.processing = false
		m.status = "done"
		if !strings.HasSuffix(m.content, "\n") {
			m.appendContent("\n")
		}
	case presentation.EvtTurnEnd:
		m.processing = false
		m.streaming = false
		m.streamKind = ""
		if len(m.queued) > 0 {
			next := m.queued[0]
			m.queued = m.queued[1:]
			m.processing = true
			m.status = fmt.Sprintf("submitted · queued %d", len(m.queued))
			m.sendSteer(SteerCommand{Type: "submit", Text: next})
		} else if m.status == "done" {
			m.status = "ready"
		}
	case presentation.EvtStatusUpdate:
		if p, ok := ev.Data.(presentation.StatusUpdatePayload); ok {
			m.status = strings.TrimSpace(p.Key + " " + p.Value)
		}
	case presentation.EvtNotification:
		if p, ok := ev.Data.(presentation.NotificationPayload); ok {
			m.appendContent("\n[" + p.Severity + "] " + p.Message + "\n")
			m.status = p.Severity
		}
	case presentation.EvtToolBegin:
		if p, ok := ev.Data.(presentation.ToolBeginPayload); ok {
			m.appendContent("\n[tool] " + p.Name + "\n")
			m.status = "tool"
		}
	case presentation.EvtToolEnd:
		m.status = "tool done"
	case presentation.EvtApprovalRequest:
		m.appendContent("\n[approval] request received\n")
		m.status = "approval"
	case presentation.EvtQuestionRequest:
		m.appendContent("\n[question] request received\n")
		m.status = "question"
	}
	m.layout()
	return m
}

func (m *managedModel) ensureStreamBlock(kind string) {
	if m.streaming && m.streamKind == kind {
		return
	}
	if !strings.HasSuffix(m.content, "\n") {
		m.appendContent("\n")
	}
	switch kind {
	case "thinking":
		label := lipgloss.NewStyle().Foreground(lipgloss.Color("245")).Italic(true).Render("Thinking")
		m.appendContent("\n" + label + "\n")
	default:
		label := lipgloss.NewStyle().Foreground(lipgloss.Color("81")).Bold(true).Render("Assistant")
		m.appendContent("\n" + label + "\n")
	}
	m.streaming = true
	m.streamKind = kind
}

func (m *managedModel) appendContent(text string) {
	m.content += text
	m.viewport.SetContent(m.content)
	m.viewport.GotoBottom()
}

func (m *managedModel) layout() {
	if m.width <= 0 {
		m.width = 80
	}
	if m.height <= 0 {
		m.height = 24
	}
	inputHeight := strings.Count(m.input.Value(), "\n") + 1
	if inputHeight < 1 {
		inputHeight = 1
	}
	if inputHeight > 8 {
		inputHeight = 8
	}
	inputWidth := m.width - 6
	if inputWidth < 20 {
		inputWidth = 20
	}
	m.input.SetWidth(inputWidth)
	m.input.SetHeight(inputHeight)
	viewportHeight := m.height - inputHeight - 5
	if viewportHeight < 1 {
		viewportHeight = 1
	}
	m.viewport.Width = m.width
	m.viewport.Height = viewportHeight
	m.viewport.SetContent(m.content)
	m.viewport.GotoBottom()
}

func (m managedModel) View() string {
	status := lipgloss.NewStyle().Foreground(lipgloss.Color("245")).Render(m.status)
	return lipgloss.JoinVertical(lipgloss.Left, m.viewport.View(), status, m.inputBlock())
}

func (m managedModel) inputBlock() string {
	width := m.width - 2
	if width < 20 {
		width = 20
	}
	labelStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("81"))
	helpStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("63")).
		Padding(0, 1).
		Width(width)
	return boxStyle.Render(strings.Join([]string{
		labelStyle.Render("Message"),
		m.input.View(),
		helpStyle.Render("Enter send  Ctrl+J/Alt+Enter newline  Ctrl+C cancel/clear  Ctrl+D exit"),
	}, "\n"))
}

func (m managedModel) sendSteer(cmd SteerCommand) {
	select {
	case m.steerCh <- cmd:
	default:
	}
}
