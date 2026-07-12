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
	Content string `json:"content"`
	Done    bool   `json:"done"`
}

var (
	mu    sync.Mutex
	items []Item
)

type Set struct{}

func (t *Set) Name() string        { return "todo_set" }
func (t *Set) Description() string { return "设置任务清单，替换当前所有任务" }
func (t *Set) Required() []string  { return []string{"items"} }
func (t *Set) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"items": {Type: "array", Description: "任务列表，每个元素是一条任务"},
	}
}
func (t *Set) Execute(args map[string]any) (string, error) {
	ret, err := t.ExecuteReturn(args)
	return ret.ModelText, err
}

func (t *Set) ExecuteReturn(args map[string]any) (toolreturn.Return, error) {
	list := parseItems(args)
	mu.Lock()
	items = list
	snapshot := snapshotItemsLocked()
	mu.Unlock()
	return todoReturn(fmt.Sprintf("已设置 %d 个任务", len(list)), snapshot), nil
}

type Add struct{}

func (t *Add) Name() string        { return "todo_add" }
func (t *Add) Description() string { return "添加新任务到清单" }
func (t *Add) Required() []string  { return []string{"items"} }
func (t *Add) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"items": {Type: "array", Description: "要添加的任务列表"},
	}
}
func (t *Add) Execute(args map[string]any) (string, error) {
	ret, err := t.ExecuteReturn(args)
	return ret.ModelText, err
}

func (t *Add) ExecuteReturn(args map[string]any) (toolreturn.Return, error) {
	list := parseItems(args)
	mu.Lock()
	items = append(items, list...)
	snapshot := snapshotItemsLocked()
	mu.Unlock()
	return todoReturn(fmt.Sprintf("已添加 %d 个任务", len(list)), snapshot), nil
}

type Done struct{}

func (t *Done) Name() string        { return "todo_done" }
func (t *Done) Description() string { return "标记任务为已完成" }
func (t *Done) Required() []string  { return []string{"index"} }
func (t *Done) Parameters() map[string]llm.Property {
	return map[string]llm.Property{
		"index": {Type: "integer", Description: "任务编号（从 1 开始）"},
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
	if idx < 1 {
		return toolreturn.Return{IsError: true}, fmt.Errorf("index 从 1 开始")
	}
	mu.Lock()
	defer mu.Unlock()
	if idx > len(items) {
		return toolreturn.Return{IsError: true}, fmt.Errorf("index %d 超出范围（共 %d 个任务）", idx, len(items))
	}
	items[idx-1].Done = true
	return todoReturn(fmt.Sprintf("✓ 任务 %d 已完成", idx), snapshotItemsLocked()), nil
}

type List struct{}

func (t *List) Name() string        { return "todo_list" }
func (t *List) Description() string { return "查看当前任务清单" }
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
		b.WriteString(fmt.Sprintf("%d. [%s] %s\n", i+1, mark, item.Content))
	}
	return todoReturn(b.String(), snapshotItemsLocked()), nil
}

func snapshotItemsLocked() []Item {
	snapshot := make([]Item, len(items))
	copy(snapshot, items)
	return snapshot
}

func todoReturn(modelText string, snapshot []Item) toolreturn.Return {
	blockItems := make([]display.TodoItem, 0, len(snapshot))
	for _, item := range snapshot {
		blockItems = append(blockItems, display.TodoItem{Text: item.Content, Done: item.Done})
	}
	block, err := display.NewBlock(display.BlockTodo, "todo", display.TodoBlock{Items: blockItems})
	if err != nil {
		return toolreturn.Return{ModelText: modelText}
	}
	return toolreturn.Return{ModelText: modelText, Display: []display.Block{block}}
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
			result = append(result, Item{Content: s})
		}
	}
	return result
}
