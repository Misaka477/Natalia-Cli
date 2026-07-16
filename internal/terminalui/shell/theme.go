package shell

import (
	"github.com/charmbracelet/lipgloss"
)

type Theme struct {
	Chrome       string
	ChromeBorder string
	TitleBar     string
	Bg           string
	Panel        string
	Fg           string
	Body         string
	Dim          string
	Faint        string
	Rule         string
	RuleSoft     string
	Accent       string
	AccentDeep   string
	AccentSoft   string
	AccentSofter string
	Success      string
	SuccessSoft  string
	Warning      string
	WarningSoft  string
	Danger       string
	DangerSoft   string
	Info         string
	InfoSoft     string
	Cursor       string
	Selection    string
	PromptArrow  string
	PromptPath   string
	Shadow       string
}

func DarkTheme() Theme {
	return Theme{
		Chrome:       "#0c1413",
		ChromeBorder: "#1c2624",
		Bg:           "#0a110f",
		Panel:        "#0f1816",
		Fg:           "#eef2ef",
		Body:         "#d8dedb",
		Dim:          "#9aa3a0",
		Faint:        "#6b7370",
		Rule:         "#1c2624",
		RuleSoft:     "#152019",
		Accent:       "#d97757",
		AccentDeep:   "#b85e3f",
		AccentSoft:   "rgba(217,119,87,0.16)",
		AccentSofter: "rgba(217,119,87,0.07)",
		Success:      "#5bbf9a",
		SuccessSoft:  "rgba(91,191,154,0.14)",
		Warning:      "#e3a14a",
		WarningSoft:  "rgba(227,161,74,0.14)",
		Danger:       "#ed7d6b",
		DangerSoft:   "rgba(237,125,107,0.15)",
		Info:         "#5cc7c9",
		InfoSoft:     "rgba(92,199,201,0.14)",
		Cursor:       "#d97757",
		Selection:    "rgba(217,119,87,0.25)",
		PromptArrow:  "#d97757",
		PromptPath:   "#5cc7c9",
	}
}

func LightTheme() Theme {
	return Theme{
		Chrome:       "#e8e6e0",
		ChromeBorder: "#bdbab2",
		Bg:           "#fbfaf6",
		Panel:        "#f3f3f3",
		Fg:           "#0e1513",
		Body:         "#1f2826",
		Dim:          "#5b625f",
		Faint:        "#8c918d",
		Rule:         "#dcd9d2",
		RuleSoft:     "#ebe8e1",
		Accent:       "#bf6547",
		AccentDeep:   "#a84f33",
		AccentSoft:   "rgba(191,101,71,0.10)",
		AccentSofter: "rgba(191,101,71,0.05)",
		Success:      "#3d8b6e",
		SuccessSoft:  "rgba(61,139,110,0.12)",
		Warning:      "#b9701a",
		WarningSoft:  "rgba(185,112,26,0.13)",
		Danger:       "#b1432f",
		DangerSoft:   "rgba(177,67,47,0.12)",
		Info:         "#1f7a7d",
		InfoSoft:     "rgba(31,122,125,0.12)",
		Cursor:       "#bf6547",
		Selection:    "rgba(191,101,71,0.18)",
		PromptArrow:  "#bf6547",
		PromptPath:   "#1f7a7d",
	}
}

func color(hex string) lipgloss.Color {
	return lipgloss.Color(hex)
}

func (t Theme) Style() map[string]string {
	return map[string]string{
		"chrome":        t.Chrome,
		"chrome-border": t.ChromeBorder,
		"bg":            t.Bg,
		"panel":         t.Panel,
		"fg":            t.Fg,
		"body":          t.Body,
		"dim":           t.Dim,
		"faint":         t.Faint,
		"rule":          t.Rule,
		"rule-soft":     t.RuleSoft,
		"accent":        t.Accent,
		"accent-deep":   t.AccentDeep,
		"accent-soft":   t.AccentSoft,
		"accent-softer": t.AccentSofter,
		"success":       t.Success,
		"success-soft":  t.SuccessSoft,
		"warning":       t.Warning,
		"warning-soft":  t.WarningSoft,
		"danger":        t.Danger,
		"danger-soft":   t.DangerSoft,
		"info":          t.Info,
		"info-soft":     t.InfoSoft,
		"cursor":        t.Cursor,
		"selection":     t.Selection,
		"prompt-arrow":  t.PromptArrow,
		"prompt-path":   t.PromptPath,
	}
}
