package display

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestNewBlockSerializesShellPayloadForWireDisplay(t *testing.T) {
	block, err := NewBlock(BlockShell, "tests", ShellBlock{Command: "go test ./...", ExitCode: 0, Output: "ok"})
	if err != nil {
		t.Fatal(err)
	}
	if block.Type != BlockShell || block.Title != "tests" {
		t.Fatalf("unexpected block metadata: %+v", block)
	}
	var payload ShellBlock
	if err := json.Unmarshal(block.Data, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Command != "go test ./..." || payload.Output != "ok" {
		t.Fatalf("unexpected shell payload: %+v", payload)
	}
}

func TestNewBlockReturnsMarshalErrorForInvalidPayload(t *testing.T) {
	_, err := NewBlock(BlockText, "bad", map[string]any{"ch": make(chan int)})
	if err == nil || !strings.Contains(err.Error(), "unsupported type") {
		t.Fatalf("expected marshal error, got %v", err)
	}
}

func TestTodoBlockRoundTripsItems(t *testing.T) {
	block, err := NewBlock(BlockTodo, "todos", TodoBlock{Items: []TodoItem{{Text: "write tests", Done: true}, {Text: "run vet", Done: false}}})
	if err != nil {
		t.Fatal(err)
	}
	var payload TodoBlock
	if err := json.Unmarshal(block.Data, &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Items) != 2 || !payload.Items[0].Done || payload.Items[1].Text != "run vet" {
		t.Fatalf("unexpected todo payload: %+v", payload)
	}
}
