package todo

import (
	"fmt"
	"strings"
	"sync"

	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/toolreturn"
)

type Item struct {
	ID       string `json:"id"`
	Content  string `json:"content"`
	Status   string `json:"status"`
	Done     bool   `json:"done"`
	Notes    string `json:"notes,omitempty"`
	Priority int    `json:"priority,omitempty"`
}

var (
	mu     sync.Mutex
	items  []Item
	nextID int
)

type Set struct{}

func (t *Set) Name() string        { return "todo_set" }
func (t *Set) Description() string { return "replace the current task list with a new one" }
func (t *Set) Required() []string  { return []string{"items"} }
func (t *Set) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"items": {Type: "array", Description: "task list; each element is one task"},
	}
}
func (t *Set) Execute(args map[string]any) (string, error) {
	ret, err := t.ExecuteReturn(args)
	return ret.ModelText, err
}

func (t *Set) ExecuteReturn(args map[string]any) (toolreturn.Return, error) {
	list := parseItems(args)
	mu.Lock()
	items = normalizeItemsLocked(list)
	snapshot := snapshotItemsLocked()
	mu.Unlock()
	return todoReturn(fmt.Sprintf("已设置 %d 个任务", len(list)), snapshot), nil
}

func normalizeItemsLocked(list []Item) []Item {
	for i := range list {
		if list[i].ID == "" {
			assignID(&list[i])
		}
		if list[i].Status == "" {
			if list[i].Done {
				list[i].Status = "done"
			} else {
				list[i].Status = "pending"
			}
		}
	}
	return list
}

type Add struct{}

func (t *Add) Name() string        { return "todo_add" }
func (t *Add) Description() string { return "add new tasks to the list" }
func (t *Add) Required() []string  { return []string{"items"} }
func (t *Add) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"items": {Type: "array", Description: "tasks to add"},
	}
}
func (t *Add) Execute(args map[string]any) (string, error) {
	ret, err := t.ExecuteReturn(args)
	return ret.ModelText, err
}

func (t *Add) ExecuteReturn(args map[string]any) (toolreturn.Return, error) {
	list := parseItems(args)
	mu.Lock()
	items = append(items, normalizeItemsLocked(list)...)
	snapshot := snapshotItemsLocked()
	mu.Unlock()
	return todoReturn(fmt.Sprintf("已添加 %d 个任务", len(list)), snapshot), nil
}

type Done struct{}

func (t *Done) Name() string        { return "todo_done" }
func (t *Done) Description() string { return "mark a task as completed" }
func (t *Done) Required() []string  { return nil }
func (t *Done) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"index": {Type: "integer", Description: "task number (1-based)"},
		"id":    {Type: "string", Description: "optional, stable task ID"},
	}
}
func (t *Done) Execute(args map[string]any) (string, error) {
	ret, err := t.ExecuteReturn(args)
	return ret.ModelText, err
}

func (t *Done) ExecuteReturn(args map[string]any) (toolreturn.Return, error) {
	idx := 0
	if i, ok := args["index"].(float64); ok {
		idx = int(i)
	}
	mu.Lock()
	defer mu.Unlock()
	target := -1
	if idx >= 1 && idx <= len(items) {
		target = idx - 1
	}
	if id, ok := args["id"].(string); ok && id != "" {
		for i := range items {
			if items[i].ID == id {
				target = i
				break
			}
		}
	}
	if target < 0 {
		return toolreturn.Return{IsError: true}, fmt.Errorf("index %d 超出范围（共 %d 个任务）", idx, len(items))
	}
	items[target].Done = true
	items[target].Status = "done"
	return todoReturn(fmt.Sprintf("✓ task %s completed", items[target].ID), snapshotItemsLocked()), nil
}

type Update struct{}

func (t *Update) Name() string        { return "todo_update" }
func (t *Update) Description() string { return "update task status, notes, or priority" }
func (t *Update) Required() []string  { return []string{} }
func (t *Update) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"index":    {Type: "integer", Description: "optional, task number (1-based); kept for backward compatibility"},
		"id":       {Type: "string", Description: "optional, stable task ID"},
		"done":     {Type: "boolean", Description: "optional, true marks done, false marks undone"},
		"status":   {Type: "string", Description: "optional, new status: pending/in_progress/blocked/done/skipped"},
		"notes":    {Type: "string", Description: "optional, short notes (recommended under 60 chars)"},
		"priority": {Type: "integer", Description: "optional, priority 1-5; higher is more important"},
	}
}
func (t *Update) Execute(args map[string]any) (string, error) {
	ret, err := t.ExecuteReturn(args)
	return ret.ModelText, err
}

func (t *Update) ExecuteReturn(args map[string]any) (toolreturn.Return, error) {
	mu.Lock()
	defer mu.Unlock()

	var target *Item

	if idx, ok := args["index"].(float64); ok && int(idx) >= 1 && int(idx) <= len(items) {
		target = &items[int(idx)-1]
	}
	if id, ok := args["id"].(string); ok && id != "" {
		for i := range items {
			if items[i].ID == id {
				target = &items[i]
				break
			}
		}
	}

	if target == nil {
		return toolreturn.Return{IsError: true}, fmt.Errorf("未找到匹配的任务，请提供有效的 index（1-%d）或 id", len(items))
	}

	if done, ok := args["done"].(bool); ok {
		target.Done = done
		if done {
			target.Status = "done"
		} else if target.Status == "done" {
			target.Status = "pending"
		}
	}
	if status, ok := args["status"].(string); ok && status != "" {
		if !validStatus(status) {
			return toolreturn.Return{IsError: true}, fmt.Errorf("invalid status %q; valid statuses: pending, in_progress, blocked, done, skipped", status)
		}
		target.Status = status
		if status == "done" {
			target.Done = true
		} else if target.Done {
			target.Done = false
		}
	}
	if notes, ok := args["notes"].(string); ok {
		target.Notes = notes
	}
	if priority, ok := args["priority"].(float64); ok {
		target.Priority = int(priority)
	}

	msg := fmt.Sprintf("已更新任务 %s", target.ID)
	return todoReturn(msg, snapshotItemsLocked()), nil
}

type List struct{}

func (t *List) Name() string        { return "todo_list" }
func (t *List) Description() string { return "view the current task list" }
func (t *List) Required() []string  { return []string{} }
func (t *List) Parameters() map[string]llm.Property {
	return map[string]llm.Property{}
}
func (t *List) Execute(args map[string]any) (string, error) {
	ret, err := t.ExecuteReturn(args)
	return ret.ModelText, err
}

func (t *List) ExecuteReturn(args map[string]any) (toolreturn.Return, error) {
	mu.Lock()
	defer mu.Unlock()
	if len(items) == 0 {
		return todoReturn("任务清单为空", nil), nil
	}
	var b strings.Builder
	for i, item := range items {
		mark := " "
		if item.Done {
			mark = "✓"
		}
		extra := ""
		if item.Priority > 0 {
			extra = fmt.Sprintf(" [p%d]", item.Priority)
		}
		if item.Notes != "" && len(item.Notes) <= 60 {
			extra += " note: " + item.Notes
		}
		b.WriteString(fmt.Sprintf("%d. [%s] %s%s\n", i+1, mark, item.Content, extra))
	}
	return todoReturn(b.String(), snapshotItemsLocked()), nil
}

func snapshotItemsLocked() []Item {
	snapshot := make([]Item, len(items))
	copy(snapshot, items)
	return snapshot
}

func assignID(item *Item) {
	if item.ID == "" {
		nextID++
		item.ID = fmt.Sprintf("todo-%d", nextID)
	}
	if item.Status == "" {
		if item.Done {
			item.Status = "done"
		} else {
			item.Status = "pending"
		}
	}
}

func validStatus(status string) bool {
	switch status {
	case "pending", "in_progress", "blocked", "done", "skipped":
		return true
	default:
		return false
	}
}

func parseItems(args map[string]any) []Item {
	raw, ok := args["items"]
	if !ok {
		return nil
	}
	list, ok := raw.([]any)
	if !ok {
		return nil
	}
	result := make([]Item, 0, len(list))
	for _, item := range list {
		if s, ok := item.(string); ok {
			it := Item{Content: s}
			assignID(&it)
			result = append(result, it)
		}
	}
	return result
}

func todoReturn(modelText string, snapshot []Item) toolreturn.Return {
	blockItems := make([]display.TodoItem, 0, len(snapshot))
	for _, item := range snapshot {
		blockItems = append(blockItems, display.TodoItem{Text: item.Content, Done: item.Done, Status: item.Status, Notes: item.Notes, Priority: item.Priority})
	}
	block, err := display.NewBlock(display.BlockTodo, "todo", display.TodoBlock{Items: blockItems})
	if err != nil {
		return toolreturn.Return{ModelText: modelText}
	}
	return toolreturn.Return{ModelText: modelText, Display: []display.Block{block}}
}
