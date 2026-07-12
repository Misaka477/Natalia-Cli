package display

import "encoding/json"

type BlockType string

const (
	BlockText           BlockType = "text"
	BlockDiff           BlockType = "diff"
	BlockShell          BlockType = "shell"
	BlockTodo           BlockType = "todo"
	BlockBackgroundTask BlockType = "background_task"
	BlockMedia          BlockType = "media"
)

type Block struct {
	Type  BlockType       `json:"type"`
	Title string          `json:"title,omitempty"`
	Data  json.RawMessage `json:"data,omitempty"`
}

func NewBlock(blockType BlockType, title string, data any) (Block, error) {
	raw, err := json.Marshal(data)
	if err != nil {
		return Block{}, err
	}
	return Block{Type: blockType, Title: title, Data: raw}, nil
}

type ShellBlock struct {
	Command  string `json:"command"`
	ExitCode int    `json:"exit_code,omitempty"`
	Output   string `json:"output,omitempty"`
	TimedOut bool   `json:"timed_out,omitempty"`
}

type DiffBlock struct {
	Path string `json:"path"`
	Diff string `json:"diff"`
}

type TodoBlock struct {
	Items []TodoItem `json:"items"`
}

type TodoItem struct {
	Text string `json:"text"`
	Done bool   `json:"done"`
}
