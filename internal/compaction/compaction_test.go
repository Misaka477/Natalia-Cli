package compaction

import (
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
)

func TestSimpleCompactionPrepareBuildsPromptAndPreservesRecentConversation(t *testing.T) {
	messages := []chat.Message{
		{Role: chat.RoleSystem, Content: "system rules"},
		{Role: chat.RoleUser, Content: "old user task"},
		{Role: chat.RoleAssistant, Content: "old assistant answer"},
		{Role: chat.RoleTool, Name: "read_file", ToolCallID: "tc_1", Content: "1: old file"},
		{Role: chat.RoleUser, Content: "current user task"},
		{Role: chat.RoleAssistant, Content: "current assistant answer"},
	}

	prep := NewSimpleCompaction().Prepare(messages)
	if prep.CompactMsg == nil {
		t.Fatal("expected compact message")
	}
	if len(prep.ToCompact) != 4 || len(prep.ToPreserve) != 2 {
		t.Fatalf("unexpected split: compact=%d preserve=%d", len(prep.ToCompact), len(prep.ToPreserve))
	}
	if prep.ToPreserve[0].Content != "current user task" || prep.ToPreserve[1].Content != "current assistant answer" {
		t.Fatalf("expected latest user/assistant messages preserved, got %+v", prep.ToPreserve)
	}
	if !strings.Contains(prep.CompactMsg.Content, "old user task") || !strings.Contains(prep.CompactMsg.Content, "1: old file") || !strings.Contains(prep.CompactMsg.Content, "<current_focus>") {
		t.Fatalf("compact prompt missing conversation or instructions: %q", prep.CompactMsg.Content)
	}
}

func TestSimpleCompactionCompactReturnsOriginalWhenNothingToCompact(t *testing.T) {
	messages := []chat.Message{{Role: chat.RoleUser, Content: "only one turn"}}

	result, err := NewSimpleCompaction().Compact(messages, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Messages) != 1 || result.Messages[0].Content != "only one turn" {
		t.Fatalf("expected original messages without LLM call, got %+v", result.Messages)
	}
}

func TestShouldCompactAndEstimateTokensUseRealMessages(t *testing.T) {
	messages := []chat.Message{
		{Role: chat.RoleUser, Content: strings.Repeat("a", 40)},
		{Role: chat.RoleAssistant, Content: strings.Repeat("b", 20)},
	}
	if got := EstimateTokens(messages); got != 25 {
		t.Fatalf("EstimateTokens=%d want 25", got)
	}
	if !ShouldCompact(80, 100, 0.8, 0) {
		t.Fatal("expected token ratio to trigger compaction")
	}
	if !ShouldCompact(70, 100, 0.9, 30) {
		t.Fatal("expected reserved tokens to trigger compaction")
	}
}
