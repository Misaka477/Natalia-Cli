package todo

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/display"
)

func TestTodoToolLifecycleAndDisplayBlocks(t *testing.T) {
	items = nil

	ret, err := (&Set{}).ExecuteReturn(map[string]any{"items": []any{"task 1", "task 2"}})
	if err != nil {
		t.Fatal(err)
	}
	assertTodoDisplay(t, ret.Display, []display.TodoItem{{Text: "task 1"}, {Text: "task 2"}})

	if _, err := (&Add{}).Execute(map[string]any{"items": []any{"task 3"}}); err != nil {
		t.Fatal(err)
	}
	listed, err := (&List{}).Execute(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"1. [ ] task 1", "2. [ ] task 2", "3. [ ] task 3"} {
		if !strings.Contains(listed, want) {
			t.Fatalf("expected list to contain %q, got %q", want, listed)
		}
	}

	ret, err = (&Done{}).ExecuteReturn(map[string]any{"index": float64(2)})
	if err != nil {
		t.Fatal(err)
	}
	assertTodoDisplay(t, ret.Display, []display.TodoItem{{Text: "task 1"}, {Text: "task 2", Done: true}, {Text: "task 3"}})
	listed, err = (&List{}).Execute(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(listed, "2. [✓] task 2") || strings.Contains(listed, "1. [✓] task 1") {
		t.Fatalf("expected only task 2 done, got %q", listed)
	}

	if _, err := (&Done{}).Execute(map[string]any{"index": float64(5)}); err == nil {
		t.Fatal("expected out-of-range done error")
	}
}

func TestTodoEmptyListAndInvalidItems(t *testing.T) {
	items = nil
	listed, err := (&List{}).Execute(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(listed, "空") {
		t.Fatalf("expected empty list message, got %q", listed)
	}
	if parsed := parseItems(map[string]any{"items": []any{"valid", 1, "also valid"}}); len(parsed) != 2 || parsed[0].Content != "valid" || parsed[1].Content != "also valid" {
		t.Fatalf("expected parseItems to keep only string tasks, got %+v", parsed)
	}
}

func assertTodoDisplay(t *testing.T, blocks []display.Block, want []display.TodoItem) {
	t.Helper()
	if len(blocks) != 1 || blocks[0].Type != display.BlockTodo {
		t.Fatalf("expected one todo display block, got %+v", blocks)
	}
	var payload display.TodoBlock
	if err := json.Unmarshal(blocks[0].Data, &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Items) != len(want) {
		t.Fatalf("expected %d todo items, got %+v", len(want), payload.Items)
	}
	for i := range want {
		if payload.Items[i] != want[i] {
			t.Fatalf("todo item %d: got %+v want %+v", i, payload.Items[i], want[i])
		}
	}
}
