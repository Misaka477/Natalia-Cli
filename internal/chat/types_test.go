package chat

import "testing"

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
