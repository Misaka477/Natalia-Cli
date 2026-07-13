package terminalui

import (
	"fmt"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/wire"
	"github.com/charmbracelet/lipgloss"
)

type Kind string

const (
	KindApproval    Kind = "approval"
	KindCompaction  Kind = "compaction"
	KindDisplay     Kind = "display"
	KindError       Kind = "error"
	KindHook        Kind = "hook"
	KindInfo        Kind = "info"
	KindInteractive Kind = "interactive"
	KindMuted       Kind = "muted"
	KindProcess     Kind = "process"
	KindQuestion    Kind = "question"
	KindStatus      Kind = "status"
	KindStep        Kind = "step"
	KindSubagent    Kind = "subagent"
	KindSuccess     Kind = "success"
	KindTool        Kind = "tool"
)

type Theme struct {
	styles    map[Kind]lipgloss.Style
	fallback  lipgloss.Style
	reasoning lipgloss.Style
}

func NewTheme() Theme {
	base := lipgloss.NewStyle()
	return Theme{
		styles: map[Kind]lipgloss.Style{
			KindApproval:    base.Foreground(lipgloss.Color("205")).Bold(true),
			KindCompaction:  base.Foreground(lipgloss.Color("105")).Bold(true),
			KindDisplay:     base.Foreground(lipgloss.Color("110")).Bold(true),
			KindError:       base.Foreground(lipgloss.Color("203")).Bold(true),
			KindHook:        base.Foreground(lipgloss.Color("141")).Bold(true),
			KindInfo:        base.Foreground(lipgloss.Color("75")).Bold(true),
			KindInteractive: base.Foreground(lipgloss.Color("114")).Bold(true),
			KindMuted:       base.Foreground(lipgloss.Color("245")),
			KindProcess:     base.Foreground(lipgloss.Color("214")).Bold(true),
			KindQuestion:    base.Foreground(lipgloss.Color("81")).Bold(true),
			KindStatus:      base.Foreground(lipgloss.Color("108")).Bold(true),
			KindStep:        base.Foreground(lipgloss.Color("63")).Bold(true),
			KindSubagent:    base.Foreground(lipgloss.Color("177")).Bold(true),
			KindSuccess:     base.Foreground(lipgloss.Color("120")),
			KindTool:        base.Foreground(lipgloss.Color("39")).Bold(true),
		},
		fallback:  base.Foreground(lipgloss.Color("252")).Bold(true),
		reasoning: base.Foreground(lipgloss.Color("245")).Italic(true),
	}
}

func (t Theme) Label(kind Kind, text string) string {
	return t.style(kind).Render("[" + text + "]")
}

func (t Theme) Header(kind Kind, text string) string {
	return "\n" + t.Label(kind, text) + "\n"
}

func (t Theme) Inline(kind Kind, text string) string {
	return "\n" + t.Label(kind, text) + " "
}

func (t Theme) Status(text string) string {
	return t.Label(KindStatus, text)
}

func (t Theme) DisplayLabel(text string) string {
	return t.Label(KindDisplay, text)
}

func (t Theme) Detail(line string) string {
	return t.style(KindMuted).Render(line)
}

func (t Theme) Checklist(done bool, text string) string {
	mark := " "
	kind := KindMuted
	if done {
		mark = "x"
		kind = KindSuccess
	}
	return t.style(kind).Render(fmt.Sprintf("- [%s] %s", mark, text))
}

func (t Theme) Reasoning(text string) string {
	return t.reasoning.Render(text)
}

func (t Theme) ContentPrefix() string {
	return t.style(KindInfo).Render("* ")
}

func (t Theme) StepRule(step int) string {
	label := fmt.Sprintf(" step %d ", step)
	return "\n" + t.style(KindStep).Render(strings.Repeat("-", 2)+label+strings.Repeat("-", 18)) + "\n"
}

func (t Theme) Banner(kind Kind, text string) string {
	return "\n" + t.Label(kind, text) + "\n"
}

func (t Theme) ThinkingLine(label string, elapsed time.Duration, tokens int) string {
	meta := label
	if elapsed > 0 || tokens > 0 {
		meta = fmt.Sprintf("%s · %s · %d tokens", label, formatDuration(elapsed), tokens)
	}
	return "\n" + t.style(KindMuted).Italic(true).Render(meta) + "\n"
}

func (t Theme) ThoughtLine(elapsed time.Duration, tokens int) string {
	return "\n" + t.style(KindMuted).Italic(true).Render(fmt.Sprintf("Thought for %s · %d tokens", formatDuration(elapsed), tokens)) + "\n"
}

func (t Theme) ToolHeadline(finished bool, name, argument string, isError bool) string {
	verb := "Using"
	bullet := t.style(KindMuted).Render("o")
	kind := KindTool
	if finished {
		verb = "Used"
		bullet = t.style(KindSuccess).Render("*")
	}
	if isError {
		kind = KindError
		bullet = t.style(KindError).Render("!")
	}
	line := fmt.Sprintf("%s %s %s", bullet, verb, t.style(kind).Render(name))
	if argument != "" {
		line += t.style(KindMuted).Render(" (" + argument + ")")
	}
	return line
}

func (t Theme) Notification(title, body string) string {
	line := t.style(KindInfo).Render("* ") + t.style(KindInfo).Bold(true).Render(strings.TrimSpace(title))
	if strings.TrimSpace(body) != "" {
		line += "\n" + t.Detail("  "+strings.TrimSpace(body))
	}
	return line
}

func (t Theme) RuntimeLine(kind Kind, label, id, event, status, detail string) string {
	parts := []string{t.style(kind).Render("* " + label), id, event}
	if status != "" {
		parts = append(parts, "["+status+"]")
	}
	line := strings.Join(parts, " ")
	if strings.TrimSpace(detail) != "" {
		line += t.style(KindMuted).Render(" -- " + strings.TrimSpace(detail))
	}
	return line
}

func (t Theme) SubagentLine(id, event, detail string) string {
	line := t.style(KindSubagent).Render("* subagent") + " " + id + " " + event
	if strings.TrimSpace(detail) != "" {
		line += t.style(KindMuted).Render(" -- " + strings.TrimSpace(detail))
	}
	return line
}

func (t Theme) StatusLine(elapsed string, status wire.StatusUpdate) string {
	parts := []string{"elapsed " + elapsed}
	if status.Mode != "" {
		parts = append(parts, "mode "+status.Mode)
	}
	if status.Model != "" {
		parts = append(parts, "model "+status.Model)
	}
	if status.ContextTokens != nil && status.MaxContextTokens != nil && *status.MaxContextTokens > 0 {
		parts = append(parts, fmt.Sprintf("ctx %d/%d", *status.ContextTokens, *status.MaxContextTokens))
	}
	return t.style(KindStatus).Render(strings.Join(parts, " · "))
}

func (t Theme) DisplayBlock(label, title, body string) string {
	lines := []string{t.DisplayLabel(label) + " " + strings.TrimSpace(title)}
	if strings.TrimSpace(body) != "" {
		lines = append(lines, t.Detail(indent(body, "  ")))
	}
	return strings.Join(lines, "\n")
}

func (t Theme) DiffBlock(path, diff string) string {
	return t.Panel(KindDisplay, "Diff", path, diff, "")
}

func (t Theme) Panel(kind Kind, title, subtitle, body, footer string) string {
	header := strings.TrimSpace(title)
	if subtitle != "" {
		header += " · " + subtitle
	}
	lines := []string{t.style(kind).Bold(true).Render("+-- " + header)}
	for _, line := range strings.Split(strings.TrimRight(body, "\n"), "\n") {
		if line == "" {
			lines = append(lines, t.style(KindMuted).Render("|"))
			continue
		}
		lines = append(lines, t.style(KindMuted).Render("| ")+line)
	}
	if footer != "" {
		lines = append(lines, t.style(KindMuted).Render("+-- "+footer))
	}
	return "\n" + strings.Join(lines, "\n") + "\n"
}

func indent(s, prefix string) string {
	lines := strings.Split(strings.TrimRight(s, "\n"), "\n")
	for i, line := range lines {
		lines[i] = prefix + line
	}
	return strings.Join(lines, "\n")
}

func (t Theme) style(kind Kind) lipgloss.Style {
	if style, ok := t.styles[kind]; ok {
		return style
	}
	return t.fallback
}

var DefaultTheme = NewTheme()
