package todo

import (
	"strings"
	"testing"
)

func TestTodoSetAndList(t *testing.T) {
	items = nil // reset

	s := &Set{}
	r, err := s.Execute(map[string]any{
		"items": []any{"task 1", "task 2", "task 3"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(r, "3") {
		t.Errorf("expected '3 tasks', got %q", r)
	}

	l := &List{}
	r, err = l.Execute(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(r, "task 1") || !strings.Contains(r, "task 3") {
		t.Errorf("expected all tasks in list, got %q", r)
	}
}

func TestTodoAdd(t *testing.T) {
	items = nil

	s := &Set{}
	s.Execute(map[string]any{"items": []any{"a"}})

	a := &Add{}
	a.Execute(map[string]any{"items": []any{"b", "c"}})

	l := &List{}
	r, _ := l.Execute(map[string]any{})
	if !strings.Contains(r, "a") || !strings.Contains(r, "b") || !strings.Contains(r, "c") {
		t.Errorf("expected all 3 tasks, got %q", r)
	}
}

func TestTodoDone(t *testing.T) {
	items = nil

	s := &Set{}
	s.Execute(map[string]any{"items": []any{"x", "y", "z"}})

	d := &Done{}
	d.Execute(map[string]any{"index": float64(2)})

	mu.Lock()
	if !items[1].Done {
		t.Error("task 2 should be done")
	}
	if items[0].Done || items[2].Done {
		t.Error("tasks 1 and 3 should not be done")
	}
	mu.Unlock()
}

func TestTodoDoneOutOfRange(t *testing.T) {
	items = nil

	s := &Set{}
	s.Execute(map[string]any{"items": []any{"only one"}})

	d := &Done{}
	_, err := d.Execute(map[string]any{"index": float64(5)})
	if err == nil {
		t.Error("expected error for out of range index")
	}
}

func TestTodoEmptyList(t *testing.T) {
	items = nil

	l := &List{}
	r, err := l.Execute(map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(r, "空") {
		t.Errorf("expected empty message, got %q", r)
	}
}

func TestParseItems(t *testing.T) {
	result := parseItems(map[string]any{
		"items": []any{"hello", "world"},
	})
	if len(result) != 2 {
		t.Fatalf("expected 2 items, got %d", len(result))
	}
	if result[0].Content != "hello" {
		t.Errorf("expected 'hello', got %q", result[0].Content)
	}
}
