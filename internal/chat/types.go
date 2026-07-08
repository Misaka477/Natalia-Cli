package chat

import "time"

type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

type ToolCall struct {
	ID       string        `json:"id"`
	Type     string        `json:"type"`
	Function ToolCallFunc  `json:"function"`
}

type ToolCallFunc struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type Message struct {
	Role       Role       `json:"role"`
	Content    string     `json:"content,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	Name       string     `json:"name,omitempty"`
}

type Checkpoint struct {
	Messages  []Message
	StepCount int
	Timestamp time.Time
}

func (c *Checkpoint) Restore(ctx *Context) {
	ctx.Messages = c.Messages
	ctx.StepCount = c.StepCount
}

type Context struct {
	Messages  []Message `json:"messages"`
	StepCount int       `json:"step_count"`
	MaxTokens int       `json:"max_tokens"`
	MaxSteps  int       `json:"max_steps"`
}

func NewContext(maxTokens, maxSteps int) *Context {
	return &Context{
		Messages:  make([]Message, 0),
		MaxTokens: maxTokens,
		MaxSteps:  maxSteps,
	}
}

func (ctx *Context) SaveCheckpoint() *Checkpoint {
	msgs := make([]Message, len(ctx.Messages))
	copy(msgs, ctx.Messages)
	return &Checkpoint{
		Messages:  msgs,
		StepCount: ctx.StepCount,
		Timestamp: time.Now(),
	}
}

type ToolResult struct {
	Name   string
	Args   map[string]any
	Result string
	Error  string
}
