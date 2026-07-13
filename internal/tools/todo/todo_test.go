package todo

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/display"
)

func TestTodoToolLifecycleAndDisplayBlocks(t *testing.T) {
	items = nil
	nextID = 0

	ret, err := (&Set{}).ExecuteReturn(map[string]any{"items": []any{"task 1", "task 2"}})
	if err != nil {
		t.Fatal(err)
	}
	assertTodoDisplay(t, ret.Display, []display.TodoItem{{Text: "task 1", Status: "pending"}, {Text: "task 2", Status: "pending"}})

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
	assertTodoDisplay(t, ret.Display, []display.TodoItem{{Text: "task 1", Status: "pending"}, {Text: "task 2", Done: true, Status: "done"}, {Text: "task 3", Status: "pending"}})
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

func TestTodoUpdateByIndexAndID(t *testing.T) {
	items = nil
	nextID = 0

	(&Set{}).ExecuteReturn(map[string]any{"items": []any{"task 1", "task 2", "task 3"}})
	mu.Lock()
	id2 := items[1].ID
	mu.Unlock()

	ret, err := (&Update{}).ExecuteReturn(map[string]any{"index": float64(1), "done": true})
	if err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	if items[0].Status != "done" || !items[0].Done || items[0].ID == "" {
		t.Fatalf("expected item 1 done, got %+v", items[0])
	}
	mu.Unlock()

	ret, err = (&Update{}).ExecuteReturn(map[string]any{"id": id2, "status": "in_progress", "notes": "in progress", "priority": float64(3)})
	if err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	if items[1].Status != "in_progress" || items[1].Notes != "in progress" || items[1].Priority != 3 || items[1].Done {
		t.Fatalf("expected item 2 updated, got %+v", items[1])
	}
	mu.Unlock()
	if !strings.Contains(ret.ModelText, "已更新") {
		t.Fatalf("expected update confirmation, got %q", ret.ModelText)
	}

	_, err = (&Update{}).ExecuteReturn(map[string]any{"index": float64(10)})
	if err == nil || !strings.Contains(err.Error(), "未找到") {
		t.Fatalf("expected not-found error for invalid index, got %v", err)
	}
}

func TestTodoIDsAreStable(t *testing.T) {
	items = nil
	nextID = 0

	(&Set{}).ExecuteReturn(map[string]any{"items": []any{"a", "b"}})
	mu.Lock()
	ida := items[0].ID
	idb := items[1].ID
	mu.Unlock()

	if ida == "" || idb == "" || ida == idb {
		t.Fatalf("expected unique stable IDs, got %q and %q", ida, idb)
	}

	(&Set{}).ExecuteReturn(map[string]any{"items": []any{"c", "d"}})
	mu.Lock()
	ide := items[0].ID
	mu.Unlock()
	if ide == "" {
		t.Fatalf("expected new items to get IDs, got %q", ide)
	}
}

func TestTodoNotesAndPriorityOnlyWhenConcise(t *testing.T) {
	items = nil
	nextID = 0

	(&Set{}).ExecuteReturn(map[string]any{"items": []any{"task 1", "task 2"}})
	(&Update{}).ExecuteReturn(map[string]any{"index": float64(1), "priority": float64(5), "notes": "urgent"})

	listed, _ := (&List{}).Execute(map[string]any{})
	if !strings.Contains(listed, "[p5]") || !strings.Contains(listed, "note: urgent") {
		t.Fatalf("expected priority and notes in list output, got %q", listed)
	}
}

func TestTodoEmptyListAndInvalidItems(t *testing.T) {
	items = nil
	nextID = 0
	listed, err := (&List{}).Execute(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(listed, "空") {
		t.Fatalf("expected empty list message, got %q", listed)
	}
	if parsed := parseItems(map[string]any{"items": []any{"valid", 1, "also valid"}}); len(parsed) != 2 || parsed[0].Content != "valid" || parsed[1].Content != "also valid" || parsed[0].ID == "" || parsed[1].ID == "" {
		t.Fatalf("expected parseItems to keep only string tasks with IDs, got %+v", parsed)
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
