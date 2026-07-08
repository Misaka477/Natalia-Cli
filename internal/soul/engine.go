package soul

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/aquama/natalia-cli/internal/chat"
	"github.com/aquama/natalia-cli/internal/compaction"
	"github.com/aquama/natalia-cli/internal/approval"
	"github.com/aquama/natalia-cli/internal/llm"
	"github.com/aquama/natalia-cli/internal/toolset"
)

type BackToTheFuture struct {
	Message string
}

func (e *BackToTheFuture) Error() string {
	return e.Message
}

type SteerQueue struct {
	items []string
}

func (q *SteerQueue) Push(s string) {
	q.items = append(q.items, s)
}

func (q *SteerQueue) Pop() (string, bool) {
	if len(q.items) == 0 {
		return "", false
	}
	s := q.items[0]
	q.items = q.items[1:]
	return s, true
}

type Engine struct {
	Context *chat.Context
	LLM     *llm.Client
	Tools   *toolset.Registry
	Dedup   *toolset.Dedup
	Steer   *SteerQueue
	Stream  bool
	OnToken func(string)
	OnReasoning func(string)
	OnStreamEnd func()

	Debug bool
	Log   func(format string, args ...any)

	// Snapshot
	Snapshotter interface {
		Checkpoint(step int, files []string) (string, error)
		Rollback(step int) error
	}

	// Approval
	Approver *approval.Approver

	// Compaction
	Compactor      *compaction.SimpleCompaction
	MaxContextSize int
	CompactRatio   float64
	ReservedTokens int
	AutoCompact    bool
	OnCompact      func(string)
}

func (e *Engine) log(format string, args ...any) {
	if e.Log != nil {
		e.Log(format, args...)
	}
}

type Outcome struct {
	FinalMessage string
	StopReason   string
	Steps        int
}

func NewEngine(llmClient *llm.Client, tools *toolset.Registry) *Engine {
	return &Engine{
		Context: chat.NewContext(128000, 50),
		LLM:     llmClient,
		Tools:   tools,
		Dedup:   toolset.NewDedup(),
		Steer:   &SteerQueue{},
	}
}

func (e *Engine) Run(userInput string) (*Outcome, error) {
	if e.LLM == nil {
		return nil, fmt.Errorf("LLM 未配置，请先运行 /setup")
	}
	e.log("[ENGINE] Run: %s", userInput)
	e.Context.Messages = append(e.Context.Messages, chat.Message{
		Role:    chat.RoleUser,
		Content: userInput,
	})

	msg, err := e.injectSteer()
	if err != nil {
		return nil, err
	}
	if msg != "" {
		e.Context.Messages = append(e.Context.Messages, chat.Message{
			Role:    chat.RoleUser,
			Content: msg,
		})
	}

	return e.turn()
}

func (e *Engine) injectSteer() (string, error) {
	msg, ok := e.Steer.Pop()
	if !ok {
		return "", nil
	}
	return msg, nil
}

func (e *Engine) turn() (*Outcome, error) {
	for {
		outcome := e.agentLoop()
		if outcome.StopReason == "no_tool_calls" || outcome.FinalMessage != "" || outcome.StopReason == "max_steps" {
			return outcome, nil
		}
		if outcome.StopReason == "requires_approval" {
			return outcome, nil
		}
	}
}

func (e *Engine) agentLoop() *Outcome {
	e.log("[ENGINE] agentLoop: starting (max %d steps)", e.Context.MaxSteps)
	for e.Context.StepCount < e.Context.MaxSteps {
		cp := e.Context.SaveCheckpoint()

		// Snapshot checkpoint before step
		if e.Snapshotter != nil {
			e.Snapshotter.Checkpoint(e.Context.StepCount, nil)
		}

		// Compact if needed
		if e.AutoCompact && e.Compactor != nil && e.LLM != nil && e.MaxContextSize > 0 {
			tokens := compaction.EstimateTokens(e.Context.Messages)
			if compaction.ShouldCompact(tokens, e.MaxContextSize, e.CompactRatio, e.ReservedTokens) {
				e.log("[ENGINE] auto-compacting (%d/%d tokens)", tokens, e.MaxContextSize)
				result, err := e.Compactor.Compact(e.Context.Messages, e.LLM)
				if err == nil {
					e.Context.Messages = result.Messages
					if e.OnCompact != nil {
						e.OnCompact(fmt.Sprintf("压缩完成，估计 %d tokens", result.EstimatedTokens))
					}
				}
			}
		}

		outcome := e.step()
		e.log("[ENGINE] step %d: reason=%q msg=%q", e.Context.StepCount, outcome.StopReason, truncate(outcome.FinalMessage, 80))
		if outcome.StopReason == "no_tool_calls" {
			return outcome
		}
		if outcome.StopReason == "back_to_future" {
			cp.Restore(e.Context)
			continue
		}
		if outcome.StopReason == "error" {
			return outcome
		}

		if outcome.StopReason == "back_to_future" {
			cp.Restore(e.Context)
			continue
		}

		steerMsg, err := e.injectSteer()
		if err != nil {
			return &Outcome{StopReason: "error", FinalMessage: err.Error()}
		}
		if steerMsg != "" {
			e.Context.Messages = append(e.Context.Messages, chat.Message{
				Role:    chat.RoleUser,
				Content: steerMsg,
			})
		}
	}
	return &Outcome{StopReason: "max_steps", FinalMessage: "达到最大步骤数"}
}

func (e *Engine) step() *Outcome {
	e.Context.StepCount++
	e.log("[ENGINE] step %d: %d messages in context", e.Context.StepCount, len(e.Context.Messages))

	var msg *chat.Message
	var usage *llm.Usage
	var err error

	if e.Stream && e.OnToken != nil {
		msg, usage, err = e.streamStep()
	} else {
		msg, usage, err = e.LLM.Chat(e.Context, e.Tools.ToToolDefs(), false)
	}

	if err != nil {
		return &Outcome{StopReason: "error", FinalMessage: err.Error()}
	}

	hasContent := msg.Content != "" || len(msg.ToolCalls) > 0
	if hasContent {
		e.Context.Messages = append(e.Context.Messages, *msg)
	}

	if usage != nil {
		fmt.Fprintf(debugWriter, "token usage: %d total\n", usage.TotalTokens)
	}

	if len(msg.ToolCalls) == 0 {
		return &Outcome{
			StopReason:   "no_tool_calls",
			FinalMessage: msg.Content,
			Steps:        e.Context.StepCount,
		}
	}

	for _, tc := range msg.ToolCalls {
		e.log("[ENGINE] executeToolCall: %s → %s", tc.Function.Name, tc.Function.Arguments)
		if err := e.executeToolCall(tc); err != nil {
			if _, ok := err.(*BackToTheFuture); ok {
				return &Outcome{StopReason: "back_to_future"}
			}
			return &Outcome{StopReason: "error", FinalMessage: err.Error()}
		}
	}

	return &Outcome{StopReason: "tool_called"}
}

func (e *Engine) streamStep() (*chat.Message, *llm.Usage, error) {
	ch := e.LLM.ChatStream(e.Context, e.Tools.ToToolDefs())

	var contentBuf strings.Builder
	var toolCalls []chat.ToolCall

	for evt := range ch {
		if evt.Error != nil {
			if e.OnStreamEnd != nil {
				e.OnStreamEnd()
			}
			return nil, nil, evt.Error
		}
		if evt.Done {
			break
		}
		contentBuf.WriteString(evt.Content)
		if len(evt.ToolCalls) > 0 {
			for _, tc := range evt.ToolCalls {
				toolCalls = append(toolCalls, chat.ToolCall{
					ID:   tc.ID,
					Type: tc.Type,
					Function: chat.ToolCallFunc{
						Name:      tc.Function.Name,
						Arguments: tc.Function.Arguments,
					},
				})
			}
		}
		if evt.Content != "" && e.OnToken != nil {
			e.OnToken(evt.Content)
		}
		if evt.Reasoning != "" && e.OnReasoning != nil {
			e.OnReasoning(evt.Reasoning)
		}
	}

	if e.OnStreamEnd != nil {
		e.OnStreamEnd()
	}

	msg := &chat.Message{
		Role:      chat.RoleAssistant,
		Content:   contentBuf.String(),
		ToolCalls: toolCalls,
	}

	return msg, &llm.Usage{}, nil
}

func (e *Engine) executeToolCall(tc chat.ToolCall) error {
	name := tc.Function.Name
	var args map[string]any
	if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
		args = map[string]any{}
	}

	warn, stop := e.Dedup.Check(name, args)
	if stop {
		return &BackToTheFuture{Message: warn}
	}

	tool, ok := e.Tools.Get(name)
	if !ok {
		result := fmt.Sprintf("错误：工具 %s 不存在", name)
		e.Context.Messages = append(e.Context.Messages, chat.Message{
			Role:       chat.RoleTool,
			ToolCallID: tc.ID,
			Content:    result,
			Name:       name,
		})
		return nil
	}

	// Approval check for write tools
	if e.Approver != nil && approval.WriteTools[name] {
		desc := fmt.Sprintf("%s %v", name, args)
		if !e.Approver.Request(name, desc) {
			result := fmt.Sprintf("操作被用户拒绝: %s %v", name, args)
			e.Context.Messages = append(e.Context.Messages, chat.Message{
				Role:       chat.RoleTool,
				ToolCallID: tc.ID,
				Content:    result,
				Name:       name,
			})
			e.log("[ENGINE] tool rejected: %s", name)
			return nil
		}
	}

	result, err := tool.Execute(args)
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}

	e.Dedup.Record(name, args, result, errMsg)

	finalResult := result
	if warn != "" {
		finalResult = warn + "\n\n" + result
	}
	if err != nil {
		finalResult = fmt.Sprintf("错误: %v\n%s", errMsg, result)
	}

	e.Context.Messages = append(e.Context.Messages, chat.Message{
		Role:       chat.RoleTool,
		ToolCallID: tc.ID,
		Content:    finalResult,
		Name:       name,
	})

	return nil
}

var debugWriter io.Writer = io.Discard

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "..."
}

func (e *Engine) CompactNow() (string, error) {
	if e.Compactor == nil || e.LLM == nil {
		return "", fmt.Errorf("compaction not available")
	}
	if len(e.Context.Messages) == 0 {
		return "", fmt.Errorf("context is empty")
	}
	result, err := e.Compactor.Compact(e.Context.Messages, e.LLM)
	if err != nil {
		return "", fmt.Errorf("compaction failed: %w", err)
	}
	e.Context.Messages = result.Messages
	return fmt.Sprintf("压缩完成，估计 %d tokens", result.EstimatedTokens), nil
}

func (e *Engine) RollbackTo(step int) (string, error) {
	if e.Snapshotter == nil {
		return "", fmt.Errorf("快照系统未启用")
	}
	if err := e.Snapshotter.Rollback(step); err != nil {
		return "", fmt.Errorf("文件恢复失败: %w", err)
	}
	// Truncate context to step
	for e.Context.StepCount > step {
		e.Context.StepCount--
		cp := e.Context.SaveCheckpoint()
		e.Context.Messages = cp.Messages
	}
	e.Context.StepCount = step
	return fmt.Sprintf("已回退到第 %d 步", step), nil
}
