package tui

import (
	"strings"

	"github.com/Misaka477/Natalia-Cli/internal/presentation"
	"github.com/Misaka477/Natalia-Cli/internal/terminalui"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type submitFunc func(string) string

type askUserRequest struct {
	Question    string
	Options     []string
	Multiple    bool
	AllowCustom bool
	Fallback    string
	Send        chan<- string
}

type tuiDispatch struct {
	program *tea.Program
}

func (d *tuiDispatch) Send(event presentation.Event) {
	d.program.Send(event)
}

func (d *tuiDispatch) ShowApproval(req presentation.ApprovalRequestPayload) presentation.ApprovalResultPayload {
	ch := make(chan bool, 1)
	d.program.Send(ApprovalPromptMsg{
		ToolName: req.ToolName,
		Respond:  ch,
	})
	approved := <-ch
	return presentation.ApprovalResultPayload{ID: req.ID, Approved: approved}
}

func (d *tuiDispatch) ShowQuestion(req presentation.QuestionRequestPayload) string {
	ch := make(chan string, 1)
	d.program.Send(AskUserPromptMsg{
		Question: req.Prompt,
		Options:  req.Options,
		Multiple: req.Multi,
		Respond:  ch,
	})
	return <-ch
}

type Model struct {
	viewport        viewport.Model
	input           textinput.Model
	submitFn        submitFunc
	statusFn        func() string
	history         []string
	historyIdx      int
	ready           bool
	width           int
	height          int
	pending         bool
	content         string
	pendingAsk      *askUserRequest
	pendingApproval chan<- bool
}

type outputMsg string

type WireOutputMsg string

type AskUserPromptMsg struct {
	Question    string
	Options     []string
	Multiple    bool
	AllowCustom bool
	Fallback    string
	Respond     chan<- string
}

type ApprovalPromptMsg struct {
	ToolName    string
	Description string
	Respond     chan<- bool
}

func NewModel(submitFn submitFunc, statusFn func() string) Model {
	ti := textinput.New()
	ti.Placeholder = "输入消息..."
	ti.Focus()
	ti.CharLimit = 4096
	ti.Width = 80

	welcome := `欢迎使用 Natalia CLI TUI。
输入 /help 查看可用命令，或直接输入消息开始对话。
按 Ctrl+C 退出。`
	vp := viewport.New(80, 24)
	vp.SetContent(welcome)

	return Model{
		viewport: vp,
		input:    ti,
		submitFn: submitFn,
		statusFn: statusFn,
		content:  welcome,
	}
}

func (m Model) Init() tea.Cmd {
	return textinput.Blink
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC:
			return m, tea.Quit
		case tea.KeyEnter:
			if m.pendingApproval != nil {
				ans := strings.ToLower(strings.TrimSpace(m.input.Value()))
				m.input.SetValue("")
				approved := ans == "y" || ans == "yes"
				label := "no"
				if approved {
					label = "yes"
				}
				m.content += "\n(approved: " + label + ")\n"
				m.viewport.SetContent(m.content)
				m.viewport.GotoBottom()
				m.pendingApproval <- approved
				close(m.pendingApproval)
				m.pendingApproval = nil
				return m, nil
			}
			if m.pendingAsk != nil {
				ans := normalizeAskUserAnswer(*m.pendingAsk, m.input.Value())
				m.input.SetValue("")
				m.content += "\n> " + ans + "\n"
				m.viewport.SetContent(m.content)
				m.viewport.GotoBottom()
				m.pendingAsk.Send <- ans
				close(m.pendingAsk.Send)
				m.pendingAsk = nil
				return m, nil
			}
			if m.pending {
				return m, nil
			}
			val := m.input.Value()
			if strings.TrimSpace(val) == "" {
				return m, nil
			}
			m.input.SetValue("")
			m.history = append(m.history, val)
			m.historyIdx = len(m.history)
			m.content += "\n> " + val + "\n(thinking...)"
			m.viewport.SetContent(m.content)
			m.viewport.GotoBottom()
			m.pending = true
			return m, m.submitCmd(val)
		case tea.KeyUp:
			if m.historyIdx > 0 {
				m.historyIdx--
				m.input.SetValue(m.history[m.historyIdx])
			}
			return m, nil
		case tea.KeyDown:
			if m.historyIdx < len(m.history)-1 {
				m.historyIdx++
				m.input.SetValue(m.history[m.historyIdx])
			} else {
				m.historyIdx = len(m.history)
				m.input.SetValue("")
			}
			return m, nil
		}
	case outputMsg:
		m.content = appendContent(m.content, string(msg)+"\n")
		m.viewport.SetContent(m.content)
		m.viewport.GotoBottom()
		m.pending = false
		return m, nil
	case WireOutputMsg:
		m.content = appendContent(m.content, string(msg))
		m.viewport.SetContent(m.content)
		m.viewport.GotoBottom()
		return m, nil
	case AskUserPromptMsg:
		m.content = appendContent(m.content, renderAskUserPrompt(msg))
		m.viewport.SetContent(m.content)
		m.viewport.GotoBottom()
		m.pendingAsk = &askUserRequest{Question: msg.Question, Options: msg.Options, Multiple: msg.Multiple, AllowCustom: msg.AllowCustom, Fallback: msg.Fallback, Send: msg.Respond}
		m.input.SetValue("")
		return m, nil
	case ApprovalPromptMsg:
		m.content += "\n[审批] " + msg.ToolName + ": " + msg.Description + "\n(y/N): "
		m.viewport.SetContent(m.content)
		m.viewport.GotoBottom()
		m.pendingApproval = msg.Respond
		m.input.SetValue("")
		return m, nil
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		if !m.ready {
			m.viewport = viewport.New(msg.Width, msg.Height-2)
			m.input.Width = msg.Width
			m.ready = true
		} else {
			m.viewport.Width = msg.Width
			m.viewport.Height = msg.Height - 2
			m.input.Width = msg.Width
		}
		m.viewport.SetContent(m.content)
		return m, nil
	}

	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	m.viewport, _ = m.viewport.Update(msg)
	return m, cmd
}

func appendContent(content, text string) string {
	if strings.TrimSpace(text) == "" {
		return content
	}
	if content != "" && !strings.HasSuffix(content, "\n") {
		content += "\n"
	}
	return content + text
}

func renderAskUserPrompt(msg AskUserPromptMsg) string {
	var b strings.Builder
	b.WriteString(msg.Question)
	b.WriteByte('\n')
	for i, option := range msg.Options {
		b.WriteString("  ")
		b.WriteString(intString(i + 1))
		b.WriteString(". ")
		b.WriteString(option)
		b.WriteByte('\n')
	}
	hints := make([]string, 0, 3)
	if msg.Multiple {
		hints = append(hints, "multi-select with commas")
	}
	if len(msg.Options) > 0 || msg.AllowCustom {
		hints = append(hints, "custom text allowed")
	}
	if msg.Fallback != "" {
		hints = append(hints, "fallback: "+msg.Fallback)
	}
	if len(hints) > 0 {
		b.WriteString("  ")
		b.WriteString(strings.Join(hints, " · "))
		b.WriteByte('\n')
	}
	return b.String()
}

func normalizeAskUserAnswer(req askUserRequest, raw string) string {
	answer := strings.TrimSpace(raw)
	if len(req.Options) == 0 {
		if answer == "" {
			return req.Fallback
		}
		return answer
	}
	if req.Multiple {
		parts := strings.Split(answer, ",")
		selected := make([]string, 0, len(parts))
		for _, part := range parts {
			if option, ok := askUserOptionByInput(req.Options, part); ok {
				selected = append(selected, option)
			} else if text := strings.TrimSpace(part); text != "" {
				selected = append(selected, text)
			}
		}
		if len(selected) == 0 {
			return req.Fallback
		}
		return strings.Join(selected, ", ")
	}
	if option, ok := askUserOptionByInput(req.Options, answer); ok {
		return option
	}
	if answer != "" {
		return answer
	}
	return req.Fallback
}

func askUserOptionByInput(options []string, raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", false
	}
	for i, option := range options {
		if raw == intString(i+1) || strings.EqualFold(raw, strings.TrimSpace(option)) {
			return option, true
		}
	}
	return "", false
}

func intString(n int) string {
	if n == 0 {
		return "0"
	}
	digits := make([]byte, 0, 3)
	for n > 0 {
		digits = append(digits, byte('0'+n%10))
		n /= 10
	}
	for i, j := 0, len(digits)-1; i < j; i, j = i+1, j-1 {
		digits[i], digits[j] = digits[j], digits[i]
	}
	return string(digits)
}

func (m Model) View() string {
	if !m.ready {
		return "initializing..."
	}
	theme := terminalui.DefaultTheme
	inputLine := m.input.View()
	if inputLine == "" {
		inputLine = m.input.Prompt + m.input.Placeholder
	}
	inputLine = theme.Detail(inputLine)

	status := ""
	if m.statusFn != nil {
		status = m.statusFn()
	}
	statusBar := theme.Status(status)

	return lipgloss.JoinVertical(lipgloss.Top,
		m.viewport.View(),
		statusBar,
		inputLine,
	)
}

func (m Model) submitCmd(input string) tea.Cmd {
	return func() tea.Msg {
		if m.submitFn != nil {
			return outputMsg(m.submitFn(input))
		}
		return outputMsg("(no handler)")
	}
}

func Run(submitFn submitFunc, statusFn func() string) error {
	m := NewModel(submitFn, statusFn)
	p := tea.NewProgram(m, tea.WithAltScreen())
	dispatch := &tuiDispatch{program: p}
	presentation.DefaultDispatch = dispatch
	defer func() { presentation.DefaultDispatch = nil }()
	_, err := p.Run()
	return err
}
