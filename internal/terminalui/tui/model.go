package tui

import (
	"strings"

	"github.com/Misaka477/Natalia-Cli/internal/terminalui"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type submitFunc func(string) string

type Model struct {
	viewport    viewport.Model
	input       textinput.Model
	submitFn    submitFunc
	statusFn    func() string
	history     []string
	historyIdx  int
	ready       bool
	width       int
	height      int
	pending     bool
	content     string
}

type outputMsg string

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
		m.content += string(msg) + "\n"
		m.viewport.SetContent(m.content)
		m.viewport.GotoBottom()
		m.pending = false
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
	p := tea.NewProgram(NewModel(submitFn, statusFn), tea.WithAltScreen())
	_, err := p.Run()
	return err
}
