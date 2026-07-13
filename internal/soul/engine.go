package soul

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/approval"
	"github.com/Misaka477/Natalia-Cli/internal/chat"
	"github.com/Misaka477/Natalia-Cli/internal/compaction"
	"github.com/Misaka477/Natalia-Cli/internal/contextbudget"
	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/hook"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/mode"
	"github.com/Misaka477/Natalia-Cli/internal/prefetch"
	"github.com/Misaka477/Natalia-Cli/internal/toolcache"
	filetool "github.com/Misaka477/Natalia-Cli/internal/tools/file"
	shelltool "github.com/Misaka477/Natalia-Cli/internal/tools/shell"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
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

	// Hooks
	Hooks *hook.Engine

	// Dynamic injections
	InjectionProviders     []InjectionProvider
	injectionDiagnosticsMu sync.Mutex
	injectionDiagnostics   []InjectionDiagnostic
}

func (e *Engine) log(format string, args ...any) {
	if e.Log != nil {
		e.Log(format, args...)
	}
}

type Outcome struct {
	StopReason   string
	FinalMessage string
	Steps        int
	Transient    bool
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
	e.triggerHook(hook.EventUserPromptSubmit, "user_prompt", map[string]any{"user_input": userInput})
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

	outcome, err := e.turn()
	if err != nil {
		e.triggerHook(hook.EventStopFailure, "run", map[string]any{"user_input": userInput, "error": err.Error()})
		return nil, err
	}
	if outcome != nil && outcome.StopReason == "error" {
		e.triggerHook(hook.EventStopFailure, "run", map[string]any{"user_input": userInput, "stop_reason": outcome.StopReason, "final_message": outcome.FinalMessage})
		return outcome, nil
	}
	if outcome != nil {
		e.triggerHook(hook.EventStop, "run", map[string]any{"user_input": userInput, "stop_reason": outcome.StopReason, "final_message": outcome.FinalMessage, "steps": outcome.Steps})
	}
	return outcome, nil
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
			tokens := compaction.EstimateTokensForModel(e.llmModel(), e.Context.Messages)
			if compaction.ShouldCompact(tokens, e.MaxContextSize, e.CompactRatio, e.ReservedTokens) {
				e.log("[ENGINE] auto-compacting (%d/%d tokens)", tokens, e.MaxContextSize)
				e.emitCompactBegin()
				result, err := e.Compactor.Compact(e.Context.Messages, e.LLM)
				e.emitCompactEnd()
				if err == nil {
					e.Context.Messages = result.Messages
					e.notifyContextCompacted()
					e.notify("compaction", fmt.Sprintf("压缩完成，估计 %d tokens", result.EstimatedTokens))
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

func (e *Engine) llmModel() string {
	if e == nil || e.LLM == nil {
		return ""
	}
	return e.LLM.Model()
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
	removeInjections := e.injectDynamicStepMessages()
	defer removeInjections()

	var msg *chat.Message
	var usage *llm.Usage
	var err error

	const maxRetries = 2
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if e.Stream && e.OnToken != nil {
			msg, usage, err = e.streamStep()
		} else {
			msg, usage, err = e.LLM.Chat(e.ctx, e.Context, e.getToolDefs(), false)
		}

		if err == nil {
			break
		}
		if msg == nil && err == nil {
			err = fmt.Errorf("empty assistant response from model")
		}

		if !isRetryableLLMError(err) || attempt == maxRetries {
			return &Outcome{StopReason: "error", FinalMessage: err.Error(), Transient: attempt > 0}
		}
		e.log("[ENGINE] transient LLM error (attempt %d/%d): %v", attempt+1, maxRetries+1, err)
		select {
		case <-time.After(time.Duration(attempt+1) * time.Second):
		case <-e.ctx.Done():
			return &Outcome{StopReason: "error", FinalMessage: "context canceled"}
		}
	}

	if msg == nil || (msg.Content == "" && len(msg.ToolCalls) == 0) {
		return &Outcome{StopReason: "error", FinalMessage: "empty assistant response from model", Transient: true}
	}
	normalizeAssistantToolCalls(msg)

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
				id := strings.TrimSpace(tc.ID)
				if id == "" {
					id = fmt.Sprintf("call_%d", len(toolCalls))
				}
				typ := strings.TrimSpace(tc.Type)
				if typ == "" {
					typ = "function"
				}
				toolCalls = append(toolCalls, chat.ToolCall{
					ID:   id,
					Type: typ,
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

func normalizeAssistantToolCalls(msg *chat.Message) {
	if msg == nil || len(msg.ToolCalls) == 0 {
		return
	}
	for i := range msg.ToolCalls {
		if strings.TrimSpace(msg.ToolCalls[i].ID) == "" {
			msg.ToolCalls[i].ID = fmt.Sprintf("call_%d", i)
		}
		if strings.TrimSpace(msg.ToolCalls[i].Type) == "" {
			msg.ToolCalls[i].Type = "function"
		}
		if strings.TrimSpace(msg.ToolCalls[i].Function.Arguments) == "" {
			msg.ToolCalls[i].Function.Arguments = "{}"
		}
	}
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

	dangerApproved := false
	if name == "run_shell" {
		if command, _ := args["command"].(string); command != "" {
			if reason := shelltool.DangerousCommandReason(command); reason != "" {
				desc := fmt.Sprintf("危险命令需要二次确认 (%s): %s", reason, command)
				blocks := approvalDisplayBlocks(name, args)
				if e.Approver == nil || !e.Approver.RequestExplicitWithDisplay(name, desc, blocks) {
					result := fmt.Sprintf("危险命令未获用户二次确认，已拒绝执行: %s", reason)
					e.Context.Messages = append(e.Context.Messages, chat.Message{
						Role:       chat.RoleTool,
						ToolCallID: tc.ID,
						Content:    e.budgetToolResult(name, result),
						Name:       name,
					})
					e.emitToolResult(tc.ID, name, result, nil, "")
					e.log("[ENGINE] dangerous shell rejected: %s", reason)
					return nil
				}
				shelltool.MarkDangerConfirmed(args)
				dangerApproved = true
			}
		}
	}

	// Approval check for write tools
	if e.Approver != nil && approval.IsWriteTool(name) && !dangerApproved {
		desc, blocks := approvalPreview(name, args)
		if !e.Approver.RequestWithDisplay(name, desc, blocks) {
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
			e.triggerHook(hook.EventPostToolUse, name, map[string]any{"tool_call_id": tc.ID, "tool_name": name, "arguments": args, "result": cached, "cached": true})
			return nil
		}
	}

	preHookResults := e.triggerHook(hook.EventPreToolUse, name, map[string]any{"tool_call_id": tc.ID, "tool_name": name, "arguments": args})
	if blocked, reason := hookBlocked(preHookResults); blocked {
		result := "工具执行被 hook 拒绝"
		if reason != "" {
			result += ": " + reason
		}
		e.appendToolResult(tc.ID, name, result)
		e.emitToolResult(tc.ID, name, result, nil, result)
		return nil
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
	if err != nil {
		finalResult = fmt.Sprintf("错误: %v\n%s", errMsg, result)
	}

	e.appendToolResult(tc.ID, name, finalResult)
	e.emitToolResult(tc.ID, name, finalResult, ret.Display, errMsg)
	e.triggerHook(hook.EventPostToolUse, name, map[string]any{"tool_call_id": tc.ID, "tool_name": name, "arguments": args, "result": finalResult, "error": errMsg})

	return nil
}

func approvalPreview(name string, args map[string]any) (string, []display.Block) {
	switch name {
	case "write_file":
		if preview, err := filetool.PreviewWrite(args); err == nil {
			return preview.Summary, diffApprovalBlock(preview)
		}
	case "edit_file":
		if preview, err := filetool.PreviewEdit(args); err == nil {
			return preview.Summary, diffApprovalBlock(preview)
		}
	case "run_shell":
		command, _ := args["command"].(string)
		blocks := approvalDisplayBlocks(name, args)
		if command != "" {
			return "run_shell: " + command, blocks
		}
		return fmt.Sprintf("%s %v", name, args), blocks
	case "interactive_start":
		command, _ := args["command"].(string)
		if command != "" {
			return "start interactive session: " + command, nil
		}
	case "interactive_write":
		id, _ := args["id"].(string)
		input, _ := args["input"].(string)
		if id != "" || input != "" {
			return fmt.Sprintf("write to interactive session %s: %s", id, trimApprovalText(input, 80)), nil
		}
	}
	return fmt.Sprintf("%s %v", name, args), nil
}

func trimApprovalText(text string, limit int) string {
	text = strings.Join(strings.Fields(strings.TrimSpace(text)), " ")
	if limit <= 0 || len([]rune(text)) <= limit {
		return text
	}
	runes := []rune(text)
	return string(runes[:limit]) + "..."
}

func diffApprovalBlock(preview filetool.Preview) []display.Block {
	block, err := display.NewBlock(display.BlockDiff, preview.Path, display.DiffBlock{Path: preview.Path, Diff: preview.Diff})
	if err != nil {
		return nil
	}
	return []display.Block{block}
}

func approvalDisplayBlocks(name string, args map[string]any) []display.Block {
	if name != "run_shell" {
		return nil
	}
	command, _ := args["command"].(string)
	if command == "" {
		return nil
	}
	block, err := display.NewBlock(display.BlockShell, command, display.ShellBlock{Command: command})
	if err != nil {
		return nil
	}
	return []display.Block{block}
}

func (e *Engine) triggerHook(event hook.EventType, target string, inputData map[string]any) []hook.HookResult {
	if e.Hooks == nil {
		return nil
	}
	results := e.Hooks.Trigger(e.ctx, event, target, inputData)
	for _, result := range results {
		if result.Error != "" {
			e.log("[HOOK] %s %s failed: %s", event, target, result.Error)
			continue
		}
		e.log("[HOOK] %s %s completed in %s action=%s", event, target, result.Duration, result.Response.Action)
	}
	return results
}

func hookBlocked(results []hook.HookResult) (bool, string) {
	for _, result := range results {
		if result.Response.Action == "deny" {
			if result.Response.Reason != "" {
				return true, result.Response.Reason
			}
			if result.Response.Message != "" {
				return true, result.Response.Message
			}
			return true, result.ID
		}
		if result.Error != "" && strings.EqualFold(strings.TrimSpace(resultHookFailurePolicy(result)), "block") {
			return true, result.Error
		}
	}
	return false, ""
}

func resultHookFailurePolicy(result hook.HookResult) string {
	return result.OnFailure
}

func (e *Engine) notify(target, message string) {
	if e.OnCompact != nil {
		e.OnCompact(message)
	}
	e.triggerHook(hook.EventNotification, target, map[string]any{"message": message})
}

func (e *Engine) notifyContextCompacted() {
	for _, provider := range e.InjectionProviders {
		if provider == nil {
			continue
		}
		if err := provider.OnContextCompacted(); err != nil {
			e.log("[INJECTION] compaction callback failed: %v", err)
		}
	}
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

func isRetryableLLMError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	// Do NOT retry context-caused errors; retry only provider/network transient issues
	if strings.Contains(msg, "context canceled") || strings.Contains(msg, "context deadline exceeded") {
		return false
	}
	if strings.Contains(msg, "API error 5") || strings.Contains(msg, "API error 429") {
		return true
	}
	if strings.Contains(msg, "empty assistant response") {
		return true
	}
	if strings.Contains(msg, "request failed") || strings.Contains(msg, "read stream") {
		return true
	}
	return false
}
