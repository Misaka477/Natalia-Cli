package soul

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/aquama/natalia-cli/internal/approval"
	"github.com/aquama/natalia-cli/internal/chat"
	"github.com/aquama/natalia-cli/internal/compaction"
	"github.com/aquama/natalia-cli/internal/contextbudget"
	"github.com/aquama/natalia-cli/internal/display"
	"github.com/aquama/natalia-cli/internal/llm"
	"github.com/aquama/natalia-cli/internal/mode"
	"github.com/aquama/natalia-cli/internal/prefetch"
	"github.com/aquama/natalia-cli/internal/toolcache"
	filetool "github.com/aquama/natalia-cli/internal/tools/file"
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
	Context      *chat.Context
	LLM          *llm.Client
	Tools        *toolset.Registry
	Dedup        *toolset.Dedup
	Steer        *SteerQueue
	Stream       bool
	OnToken      func(string)
	OnReasoning  func(string)
	OnStreamEnd  func()
	OnStepBegin  func(int)
	OnToolCall   func(ToolCallEvent)
	OnToolResult func(ToolResultEvent)

	Debug bool
	Log   func(format string, args ...any)

	// Snapshot
	Snapshotter interface {
		Checkpoint(step int, files []string) (string, error)
		Rollback(step int) error
	}

	// Approval
	Approver *approval.Approver

	// Mode
	Mode *mode.Mode

	// Cancellation
	ctx    context.Context
	cancel context.CancelFunc

	// Compaction
	Compactor      *compaction.SimpleCompaction
	MaxContextSize int
	CompactRatio   float64
	ReservedTokens int
	AutoCompact    bool
	OnCompact      func(string)
	OnCompactBegin func()
	OnCompactEnd   func()

	// Context budget
	ToolResultMaxChars int
	ToolCache          *toolcache.Cache
	PrefetchEnabled    bool
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

type ToolCallEvent struct {
	ID        string
	Name      string
	Arguments map[string]any
}

type ToolResultEvent struct {
	ToolCallID string
	Name       string
	Content    string
	Display    []display.Block
	Error      string
}

func NewEngine(llmClient *llm.Client, tools *toolset.Registry) *Engine {
	ctx, cancel := context.WithCancel(context.Background())
	return &Engine{
		Context:            chat.NewContext(128000, 50),
		LLM:                llmClient,
		Tools:              tools,
		Dedup:              toolset.NewDedup(),
		Steer:              &SteerQueue{},
		ctx:                ctx,
		cancel:             cancel,
		ToolResultMaxChars: contextbudget.DefaultToolResultMaxChars,
		ToolCache:          toolcache.New(),
		PrefetchEnabled:    true,
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

	e.prefetchReadOnly(userInput)

	return e.turn()
}

func (e *Engine) prefetchReadOnly(input string) {
	if !e.PrefetchEnabled || e.ToolCache == nil || e.Tools == nil {
		return
	}
	go func() {
		result := prefetch.Warm(e.ctx, prefetch.Options{
			Tools: e.Tools,
			Cache: e.ToolCache,
			Mode:  e.Mode,
			Input: input,
		})
		if result.Planned > 0 {
			e.log("[ENGINE] prefetch: planned=%d cached=%d errors=%d", result.Planned, result.Cached, result.Errors)
		}
	}()
}

func (e *Engine) injectSteer() (string, error) {
	msg, ok := e.Steer.Pop()
	if !ok {
		return "", nil
	}
	return msg, nil
}

func (e *Engine) turn() (*Outcome, error) {
	e.Dedup.ResetTurn()
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
				e.emitCompactBegin()
				result, err := e.Compactor.Compact(e.Context.Messages, e.LLM)
				e.emitCompactEnd()
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

func (e *Engine) getToolDefs() []llm.ToolDef {
	defs := e.Tools.ToToolDefs()
	if e.Mode == nil {
		return defs
	}
	filtered := make([]llm.ToolDef, 0, len(defs))
	for _, d := range defs {
		if e.Mode.ToolFilter(d.Function.Name, nil) {
			filtered = append(filtered, d)
		}
	}
	return filtered
}

func (e *Engine) Step(ctx context.Context) *Outcome {
	e.ctx = ctx
	return e.step()
}

func (e *Engine) step() *Outcome {
	e.Context.StepCount++
	e.log("[ENGINE] step %d: %d messages in context", e.Context.StepCount, len(e.Context.Messages))
	if e.OnStepBegin != nil {
		e.OnStepBegin(e.Context.StepCount)
	}

	var msg *chat.Message
	var usage *llm.Usage
	var err error

	if e.Stream && e.OnToken != nil {
		msg, usage, err = e.streamStep()
	} else {
		msg, usage, err = e.LLM.Chat(e.ctx, e.Context, e.getToolDefs(), false)
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
	ch := e.LLM.ChatStream(e.ctx, e.Context, e.getToolDefs())

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
	if e.OnToolCall != nil {
		e.OnToolCall(ToolCallEvent{ID: tc.ID, Name: name, Arguments: args})
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
			Content:    e.budgetToolResult(name, result),
			Name:       name,
		})
		e.emitToolResult(tc.ID, name, result, nil, "")
		return nil
	}

	// Mode check: tool not allowed in current mode
	if e.Mode != nil && !e.Mode.ToolFilter(name, args) {
		result := fmt.Sprintf("当前模式 %q 不允许使用工具 %s", e.Mode.Name, name)
		e.Context.Messages = append(e.Context.Messages, chat.Message{
			Role:       chat.RoleTool,
			ToolCallID: tc.ID,
			Content:    e.budgetToolResult(name, result),
			Name:       name,
		})
		e.emitToolResult(tc.ID, name, result, nil, "")
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
				Content:    e.budgetToolResult(name, result),
				Name:       name,
			})
			e.emitToolResult(tc.ID, name, result, nil, "")
			e.log("[ENGINE] tool rejected: %s", name)
			return nil
		}
	}

	if e.ToolCache != nil && toolcache.IsCacheable(name) {
		if cached, ok := e.ToolCache.Get(name, args); ok {
			e.appendToolResult(tc.ID, name, cached)
			e.emitToolResult(tc.ID, name, cached, nil, "")
			return nil
		}
	}

	ret, err := toolset.Execute(tool, args)
	result := ret.ModelText
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}
	if e.ToolCache != nil && errMsg == "" && toolcache.IsCacheable(name) {
		e.ToolCache.Set(name, args, result)
	}
	if e.ToolCache != nil {
		if toolcache.MutatesUnknownFiles(name, errMsg) {
			e.ToolCache.InvalidateAll()
		} else {
			mutatedPath := toolcache.MutatedPath(name, args, errMsg)
			e.ToolCache.InvalidatePath(mutatedPath)
			e.refreshReadFileCache(mutatedPath)
		}
	}

	e.Dedup.Record(name, args, result, errMsg)

	finalResult := result
	if warn != "" {
		finalResult = warn + "\n\n" + result
	}
	if err != nil {
		finalResult = fmt.Sprintf("错误: %v\n%s", errMsg, result)
	}

	e.appendToolResult(tc.ID, name, finalResult)
	e.emitToolResult(tc.ID, name, finalResult, ret.Display, errMsg)

	return nil
}

func (e *Engine) refreshReadFileCache(path string) {
	if path == "" || e.ToolCache == nil {
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	rendered, err := filetool.RenderReadFile(path, string(data), "", "")
	if err != nil {
		return
	}
	e.ToolCache.Set("read_file", map[string]any{"path": path}, rendered)
}

func (e *Engine) appendToolResult(toolCallID, name, content string) {
	e.Context.Messages = append(e.Context.Messages, chat.Message{
		Role:       chat.RoleTool,
		ToolCallID: toolCallID,
		Content:    e.budgetToolResult(name, content),
		Name:       name,
	})
}

func (e *Engine) budgetToolResult(toolName, content string) string {
	return contextbudget.BudgetToolResult(toolName, content, e.ToolResultMaxChars)
}

func (e *Engine) emitToolResult(toolCallID, name, content string, displayBlocks []display.Block, errMsg string) {
	if e.OnToolResult != nil {
		e.OnToolResult(ToolResultEvent{ToolCallID: toolCallID, Name: name, Content: content, Display: displayBlocks, Error: errMsg})
	}
}

func (e *Engine) emitCompactBegin() {
	if e.OnCompactBegin != nil {
		e.OnCompactBegin()
	}
}

func (e *Engine) emitCompactEnd() {
	if e.OnCompactEnd != nil {
		e.OnCompactEnd()
	}
}

var debugWriter io.Writer = io.Discard

func (e *Engine) Cancel() {
	if e.cancel != nil {
		e.cancel()
	}
}

func (e *Engine) ResetCancel() {
	e.ctx, e.cancel = context.WithCancel(context.Background())
}

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
	e.emitCompactBegin()
	result, err := e.Compactor.Compact(e.Context.Messages, e.LLM)
	e.emitCompactEnd()
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
	if !e.Context.RestoreCheckpoint(step) {
		return "", fmt.Errorf("找不到第 %d 步的上下文检查点", step)
	}
	return fmt.Sprintf("已回退到第 %d 步", step), nil
}
