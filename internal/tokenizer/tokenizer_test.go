package tokenizer

import (
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
)

func TestTokenizerCountsModelSpecificText(t *testing.T) {
	text := "abcdefghijkl"
	if got := CountText("gpt-4o", text); got != 3 {
		t.Fatalf("openai heuristic tokens=%d want 3", got)
	}
	if got := CountText("step-3.7-flash", text); got != 4 {
		t.Fatalf("step heuristic tokens=%d want 4", got)
	}
	if got := CountText("claude-opus-4", text); got != 4 {
		t.Fatalf("claude heuristic tokens=%d want 4", got)
	}
}

func TestTokenizerCountsCJKAsIndividualTokens(t *testing.T) {
	if got := CountText("step-3.7-flash", "你好abc"); got != 3 {
		t.Fatalf("expected two CJK tokens plus one latin token, got %d", got)
	}
}

func TestTokenizerCountsMessageOverheadAndToolCalls(t *testing.T) {
	messages := []chat.Message{{Role: chat.RoleUser, Content: "hello world"}, {Role: chat.RoleAssistant, ToolCalls: []chat.ToolCall{{Function: chat.ToolCallFunc{Name: "read_file", Arguments: `{"path":"README.md"}`}}}}}
	openAI := CountMessages("gpt-4o", messages)
	claude := CountMessages("claude-opus", messages)
	if openAI <= 0 || claude <= openAI {
		t.Fatalf("expected model-specific message overhead, openai=%d claude=%d", openAI, claude)
	}
}
