package chat

import (
	"encoding/json"
	"testing"
)

func TestContextMessagesAndToolCallsRoundTrip(t *testing.T) {
	ctx := NewContext(4096, 8)
	ctx.Messages = append(ctx.Messages,
		Message{Role: RoleSystem, Content: "system prompt"},
		Message{Role: RoleUser, Content: "read the file"},
		Message{Role: RoleAssistant, ToolCalls: []ToolCall{{ID: "call_1", Type: "function", Function: ToolCallFunc{Name: "read_file", Arguments: `{"path":"README.md"}`}}}},
		Message{Role: RoleTool, ToolCallID: "call_1", Name: "read_file", Content: "1: hello"},
	)
	ctx.StepCount = 3

	raw, err := json.Marshal(ctx)
	if err != nil {
		t.Fatalf("marshal context failed: %v", err)
	}
	var restored Context
	if err := json.Unmarshal(raw, &restored); err != nil {
		t.Fatalf("unmarshal context failed: %v", err)
	}

	if restored.MaxTokens != 4096 || restored.MaxSteps != 8 || restored.StepCount != 3 || len(restored.Messages) != 4 {
		t.Fatalf("unexpected restored context: %+v", restored)
	}
	toolCall := restored.Messages[2].ToolCalls[0]
	if restored.Messages[0].Role != RoleSystem || restored.Messages[1].Role != RoleUser || restored.Messages[3].Role != RoleTool {
		t.Fatalf("roles did not round-trip through JSON: %+v", restored.Messages)
	}
	if toolCall.ID != "call_1" || toolCall.Type != "function" || toolCall.Function.Name != "read_file" || toolCall.Function.Arguments != `{"path":"README.md"}` {
		t.Fatalf("tool call did not round-trip through JSON: %+v", toolCall)
	}
}

func TestRestoreCheckpoint(t *testing.T) {
	ctx := NewContext(100, 10)
	ctx.Messages = append(ctx.Messages, Message{Role: RoleUser, Content: "before"})
	ctx.StepCount = 1
	ctx.SaveCheckpoint()

	ctx.Messages = append(ctx.Messages, Message{Role: RoleAssistant, Content: "after"})
	ctx.StepCount = 2
	ctx.SaveCheckpoint()

	if !ctx.RestoreCheckpoint(1) {
		t.Fatal("expected checkpoint to be restored")
	}
	if ctx.StepCount != 1 || len(ctx.Messages) != 1 || ctx.Messages[0].Content != "before" {
		t.Fatalf("unexpected restored context: step=%d messages=%v", ctx.StepCount, ctx.Messages)
	}
	if ctx.RestoreCheckpoint(2) {
		t.Fatal("expected future checkpoints to be discarded")
	}
}
