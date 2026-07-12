package tokenizer

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
)

type Tokenizer interface {
	CountText(text string) int
	CountMessages(messages []chat.Message) int
}

type Heuristic struct {
	Model string
}

func ForModel(model string) Heuristic {
	return Heuristic{Model: strings.ToLower(strings.TrimSpace(model))}
}

func CountText(model, text string) int {
	return ForModel(model).CountText(text)
}

func CountMessages(model string, messages []chat.Message) int {
	return ForModel(model).CountMessages(messages)
}

func (h Heuristic) CountMessages(messages []chat.Message) int {
	total := 0
	overhead := h.messageOverhead()
	for _, msg := range messages {
		total += overhead + h.CountText(string(msg.Role)) + h.CountText(msg.Name) + h.CountText(msg.Content)
		if msg.ToolCallID != "" {
			total += h.CountText(msg.ToolCallID)
		}
		for _, call := range msg.ToolCalls {
			total += overhead + h.CountText(call.Function.Name) + h.CountText(call.Function.Arguments)
		}
	}
	return total
}

func (h Heuristic) CountText(text string) int {
	if text == "" {
		return 0
	}
	model := h.Model
	latinDivisor := 4
	if strings.Contains(model, "claude") || strings.Contains(model, "anthropic") {
		latinDivisor = 3
	} else if strings.Contains(model, "step") || strings.Contains(model, "qwen") || strings.Contains(model, "deepseek") || strings.Contains(model, "glm") {
		latinDivisor = 3
	}
	latinRunes := 0
	nonLatinTokens := 0
	for _, r := range text {
		switch {
		case r == '\n' || r == '\t' || r == ' ':
			latinRunes++
		case isCJK(r):
			nonLatinTokens++
		case r > utf8.RuneSelf && !unicode.IsLetter(r) && !unicode.IsDigit(r):
			nonLatinTokens++
		default:
			latinRunes++
		}
	}
	tokens := divCeil(latinRunes, latinDivisor) + nonLatinTokens
	if tokens == 0 {
		return 1
	}
	return tokens
}

func (h Heuristic) messageOverhead() int {
	if strings.Contains(h.Model, "claude") || strings.Contains(h.Model, "anthropic") {
		return 4
	}
	return 3
}

func divCeil(n, d int) int {
	if n <= 0 {
		return 0
	}
	return (n + d - 1) / d
}

func isCJK(r rune) bool {
	return unicode.In(r, unicode.Han, unicode.Hiragana, unicode.Katakana, unicode.Hangul)
}
