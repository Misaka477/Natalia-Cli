package terminalui

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/wire"
)

type Stream string

const (
	StreamOutput    Stream = "output"
	StreamMeta      Stream = "meta"
	StreamReasoning Stream = "reasoning"
)

type Frame struct {
	Stream Stream
	Text   string
}

type LiveView struct {
	theme                 Theme
	reasoningDisplay      ReasoningDisplay
	reasoningPreviewChars int
	content               *contentBlock
	tools                 map[string]*toolBlock
	toolOrder             []string
	lastStatus            wire.StatusUpdate
	activeStep            int
	compacting            bool
	turnHasText           bool
	turnHadMeta           bool
	lastMetaKind          Kind
}

type contentBlock struct {
	isThink        bool
	started        time.Time
	tokens         float64
	textStarted    bool
	receivedText   bool
	previewStarted bool
	previewRunes   int
	pendingSpace   bool
	lastRune       rune
}

type toolBlock struct {
	id        string
	name      string
	argument  string
	arguments string
	finished  bool
	errorText string
}

type ReasoningDisplay string

const (
	ReasoningSummary ReasoningDisplay = "summary"
	ReasoningPreview ReasoningDisplay = "preview"
	ReasoningStream  ReasoningDisplay = "stream"
)

const defaultReasoningPreviewChars = 600

type LiveViewOptions struct {
	ReasoningDisplay      ReasoningDisplay
	ReasoningPreviewChars int
}

func NewLiveView() *LiveView {
	return NewLiveViewWithOptions(liveViewOptionsFromEnv())
}

func NewLiveViewWithOptions(options LiveViewOptions) *LiveView {
	if options.ReasoningDisplay == "" {
		options.ReasoningDisplay = ReasoningStream
	}
	if options.ReasoningDisplay != ReasoningSummary && options.ReasoningDisplay != ReasoningPreview && options.ReasoningDisplay != ReasoningStream {
		options.ReasoningDisplay = ReasoningStream
	}
	if options.ReasoningPreviewChars <= 0 {
		options.ReasoningPreviewChars = defaultReasoningPreviewChars
	}
	return &LiveView{
		theme:                 NewTheme(),
		reasoningDisplay:      options.ReasoningDisplay,
		reasoningPreviewChars: options.ReasoningPreviewChars,
		tools:                 make(map[string]*toolBlock),
	}
}

func liveViewOptionsFromEnv() LiveViewOptions {
	options := LiveViewOptions{ReasoningDisplay: ReasoningStream, ReasoningPreviewChars: defaultReasoningPreviewChars}
	if raw := strings.TrimSpace(strings.ToLower(os.Getenv("NATALIA_REASONING_DISPLAY"))); raw != "" {
		options.ReasoningDisplay = ReasoningDisplay(raw)
	}
	if raw := strings.TrimSpace(os.Getenv("NATALIA_REASONING_PREVIEW_CHARS")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			options.ReasoningPreviewChars = parsed
		}
	}
	return options
}

func (v *LiveView) Dispatch(msg wire.WireMessage) []Frame {
	if v == nil {
		v = NewLiveView()
	}
	if msg.Kind == wire.MessageRequest && msg.Request != nil {
		return []Frame{{Stream: StreamMeta, Text: v.RenderRequest(*msg.Request)}}
	}
	if msg.Kind != wire.MessageEvent || msg.Event == nil {
		return nil
	}
	switch msg.Event.Type {
	case wire.EventTurnBegin:
		v.resetTurn()
		return nil
	case wire.EventStepBegin:
		var step wire.StepBegin
		if json.Unmarshal(msg.Event.Payload, &step) != nil {
			return nil
		}
		v.activeStep = step.N
		return []Frame{{Stream: StreamMeta, Text: v.theme.StepRule(step.N)}}
	case wire.EventStepInterrupted:
		frames := v.flushContent(false)
		return append(frames, Frame{Stream: StreamMeta, Text: v.theme.Banner(KindError, "Step interrupted")})
	case wire.EventCompactionBegin:
		v.compacting = true
		return []Frame{{Stream: StreamMeta, Text: v.theme.Banner(KindCompaction, "Compacting context...")}}
	case wire.EventCompactionEnd:
		v.compacting = false
		return []Frame{{Stream: StreamMeta, Text: v.theme.Banner(KindCompaction, "Compaction finished")}}
	case wire.EventContentPart:
		var part wire.ContentPart
		if json.Unmarshal(msg.Event.Payload, &part) != nil {
			return nil
		}
		return v.appendContent(part)
	case wire.EventTurnEnd:
		return v.flushContent(true)
	case wire.EventStatusUpdate:
		var status wire.StatusUpdate
		if json.Unmarshal(msg.Event.Payload, &status) != nil {
			return nil
		}
		v.lastStatus = mergeStatus(v.lastStatus, status)
		return v.renderStatus(status)
	case wire.EventNotification:
		var notification wire.Notification
		if json.Unmarshal(msg.Event.Payload, &notification) != nil {
			return nil
		}
		return []Frame{{Stream: StreamMeta, Text: v.theme.Notification(notification.Title, notification.Message)}}
	case wire.EventToolCall:
		var call wire.ToolCall
		if json.Unmarshal(msg.Event.Payload, &call) != nil {
			return nil
		}
		frames := v.flushContent(false)
		block := &toolBlock{id: call.ID, name: call.Name, arguments: string(call.Arguments), argument: keyArgument(call.Name, string(call.Arguments))}
		v.tools[call.ID] = block
		v.toolOrder = append(v.toolOrder, call.ID)
		return append(frames, Frame{Stream: StreamMeta, Text: v.theme.ToolHeadline(false, block.name, block.argument, false)})
	case wire.EventToolResult:
		var result wire.ToolResult
		if json.Unmarshal(msg.Event.Payload, &result) != nil {
			return nil
		}
		frames := v.flushContent(false)
		return append(frames, Frame{Stream: StreamMeta, Text: v.renderToolResult(result)})
	case wire.EventSubagentEvent:
		var event wire.SubagentEvent
		if json.Unmarshal(msg.Event.Payload, &event) != nil {
			return nil
		}
		return []Frame{{Stream: StreamMeta, Text: v.theme.SubagentLine(event.ID, event.Event, summarizeJSON(event.Payload))}}
	case wire.EventProcessEvent:
		var event wire.ProcessEvent
		if json.Unmarshal(msg.Event.Payload, &event) != nil {
			return nil
		}
		return []Frame{{Stream: StreamMeta, Text: v.theme.RuntimeLine(KindProcess, "process", event.ID, event.Event, event.Status, processDetail(event))}}
	case wire.EventInteractiveEvent:
		var event wire.InteractiveEvent
		if json.Unmarshal(msg.Event.Payload, &event) != nil {
			return nil
		}
		if event.Event == "output" {
			return nil
		}
		return []Frame{{Stream: StreamMeta, Text: v.theme.RuntimeLine(KindInteractive, "interactive", event.ID, event.Event, event.Status, interactiveDetail(event))}}
	default:
		return nil
	}
}

func (v *LiveView) RenderRequest(req wire.WireRequest) string {
	switch req.Type {
	case wire.RequestApproval:
		var approval wire.ApprovalRequest
		if json.Unmarshal(req.Payload, &approval) != nil {
			return ""
		}
		body := trimLine(approval.Description, 900)
		if len(approval.Display) > 0 {
			body += "\n" + v.renderDisplayBlocks(approval.Display)
		}
		return v.theme.Panel(KindApproval, "Approval required", approval.Action, body, "1 approve once  2 reject")
	case wire.RequestQuestion:
		var question wire.QuestionRequest
		if json.Unmarshal(req.Payload, &question) != nil {
			return ""
		}
		lines := make([]string, 0, len(question.Questions)*3)
		for _, item := range question.Questions {
			lines = append(lines, fmt.Sprintf("%s: %s", item.Name, trimLine(item.Question, 320)))
			if len(item.Options) > 0 {
				lines = append(lines, "  "+numberedOptions(item.Options))
			}
			if item.Multiple || item.AllowCustom || item.Fallback != "" {
				lines = append(lines, questionHints(item))
			}
		}
		return v.theme.Panel(KindQuestion, "Question", req.ID, strings.Join(lines, "\n"), "enter answer  esc fallback")
	case wire.RequestToolCall:
		var toolReq wire.ToolCallRequest
		if json.Unmarshal(req.Payload, &toolReq) != nil {
			return ""
		}
		return v.theme.Panel(KindTool, "Tool request", toolReq.Name, trimLine(string(toolReq.Arguments), 500), "external tool")
	case wire.RequestHook:
		var hookReq wire.HookRequest
		if json.Unmarshal(req.Payload, &hookReq) != nil {
			return ""
		}
		return v.theme.Panel(KindHook, "Hook request", hookReq.Event, hookReq.Target, "waiting for hook response")
	default:
		return v.theme.Banner(KindInfo, fmt.Sprintf("Wire request %s %s", req.Type, req.ID))
	}
}

func (v *LiveView) appendContent(part wire.ContentPart) []Frame {
	if part.Type == wire.ContentThink {
		if v.content == nil || !v.content.isThink {
			frames := v.flushContent(false)
			v.content = &contentBlock{isThink: true, started: time.Now(), tokens: estimateTokens(part.Text), receivedText: part.Text != ""}
			frames = append(frames, Frame{Stream: StreamMeta, Text: v.theme.ThinkingLine("Thinking", 0, 0)})
			frames = append(frames, v.renderReasoningDelta(v.content, part.Text)...)
			return frames
		}
		v.content.tokens += estimateTokens(part.Text)
		v.content.receivedText = v.content.receivedText || part.Text != ""
		return v.renderReasoningDelta(v.content, part.Text)
	}

	frames := []Frame{}
	if v.content == nil || v.content.isThink {
		frames = append(frames, v.flushContent(false)...)
		v.content = &contentBlock{isThink: false, started: time.Now()}
	}
	v.content.tokens += estimateTokens(part.Text)
	v.content.receivedText = v.content.receivedText || part.Text != ""
	text := part.Text
	if !v.content.textStarted {
		text = "\n" + v.theme.ContentPrefix() + text
		v.content.textStarted = true
	}
	v.turnHasText = true
	return append(frames, Frame{Stream: StreamOutput, Text: text})
}

func (v *LiveView) renderReasoningDelta(block *contentBlock, text string) []Frame {
	if block == nil || text == "" || v.reasoningDisplay == ReasoningSummary {
		return nil
	}
	delta := text
	if v.reasoningDisplay == ReasoningPreview {
		remaining := v.reasoningPreviewChars - block.previewRunes
		if remaining <= 0 {
			return nil
		}
		delta = firstRunes(text, remaining)
		if delta == "" {
			return nil
		}
		block.previewRunes += utf8.RuneCountInString(delta)
	}
	delta = normalizeReasoningDelta(block, delta)
	if delta == "" {
		return nil
	}
	if !block.previewStarted {
		block.previewStarted = true
		delta = "  " + strings.TrimLeft(delta, " \t")
	}
	return []Frame{{Stream: StreamReasoning, Text: v.theme.Reasoning(delta)}}
}

func normalizeReasoningDelta(block *contentBlock, text string) string {
	var b strings.Builder
	for _, r := range text {
		if unicode.IsSpace(r) {
			block.pendingSpace = true
			continue
		}
		if block.pendingSpace && shouldInsertReasoningSpace(block.lastRune, r) {
			b.WriteByte(' ')
		}
		block.pendingSpace = false
		b.WriteRune(r)
		block.lastRune = r
	}
	return b.String()
}

func shouldInsertReasoningSpace(prev, next rune) bool {
	if prev == 0 || isCJK(prev) || isCJK(next) || unicode.IsPunct(next) {
		return false
	}
	return unicode.IsLetter(prev) || unicode.IsDigit(prev) || unicode.IsLetter(next) || unicode.IsDigit(next)
}

func isCJK(r rune) bool {
	return (r >= 0x4E00 && r <= 0x9FFF) || (r >= 0x3400 && r <= 0x4DBF) || (r >= 0x3000 && r <= 0x303F) || (r >= 0xFF00 && r <= 0xFFEF)
}

func (v *LiveView) flushContent(final bool) []Frame {
	if v.content == nil {
		if final && v.turnHasText {
			v.turnHasText = false
			return []Frame{{Stream: StreamOutput, Text: "\n"}}
		}
		return nil
	}
	block := v.content
	v.content = nil
	if block.isThink {
		if !block.receivedText && block.tokens == 0 {
			return nil
		}
		return []Frame{{Stream: StreamMeta, Text: v.theme.ThoughtLine(time.Since(block.started), int(block.tokens))}}
	}
	if final || block.textStarted {
		v.turnHasText = false
		return []Frame{{Stream: StreamOutput, Text: "\n"}}
	}
	return nil
}

func (v *LiveView) renderToolResult(result wire.ToolResult) string {
	block := v.tools[result.ToolCallID]
	name := result.Name
	argument := ""
	if block != nil {
		block.finished = true
		block.errorText = result.Error
		name = block.name
		argument = block.argument
	}
	var parts []string
	parts = append(parts, v.theme.ToolHeadline(true, name, argument, result.Error != ""))
	content := strings.TrimSpace(result.Content)
	if result.Error != "" {
		content = result.Error
	}
	if content != "" {
		parts = append(parts, v.theme.Detail(indent(content, "  ")))
	}
	if len(result.Display) > 0 {
		parts = append(parts, v.renderDisplayBlocks(result.Display))
	}
	return strings.Join(parts, "\n")
}

func (v *LiveView) renderDisplayBlocks(blocks []display.Block) string {
	lines := make([]string, 0, len(blocks))
	for _, block := range blocks {
		switch block.Type {
		case display.BlockText:
			lines = append(lines, v.theme.DisplayBlock("text", block.Title, trimLine(string(block.Data), 2000)))
		case display.BlockDiff:
			var diff display.DiffBlock
			if json.Unmarshal(block.Data, &diff) == nil {
				lines = append(lines, v.theme.DiffBlock(diff.Path, trimLine(diff.Diff, 4000)))
			}
		case display.BlockShell:
			var shell display.ShellBlock
			if json.Unmarshal(block.Data, &shell) == nil {
				lines = append(lines, v.theme.DisplayBlock("shell", shell.Command, trimLine(shell.Output, 2000)))
			}
		case display.BlockTodo:
			var todo display.TodoBlock
			if json.Unmarshal(block.Data, &todo) == nil {
				items := make([]string, 0, len(todo.Items)+1)
				items = append(items, v.theme.DisplayLabel("todo")+" "+block.Title)
				for _, item := range todo.Items {
					items = append(items, v.theme.Checklist(item.Done, trimLine(item.Text, 300)))
				}
				lines = append(lines, strings.Join(items, "\n"))
			}
		case display.BlockBackgroundTask, display.BlockMedia:
			lines = append(lines, v.renderJSONDisplayBlock(string(block.Type), block))
		default:
			lines = append(lines, v.renderJSONDisplayBlock(string(block.Type), block))
		}
	}
	return strings.Join(lines, "\n")
}

func (v *LiveView) renderJSONDisplayBlock(label string, block display.Block) string {
	var data any
	text := string(block.Data)
	if json.Unmarshal(block.Data, &data) == nil {
		if pretty, err := json.MarshalIndent(data, "", "  "); err == nil {
			text = string(pretty)
		}
	}
	title := strings.TrimSpace(block.Title)
	if title == "" {
		title = label
	}
	return v.theme.DisplayBlock(label, title, trimLine(text, 3000))
}

func (v *LiveView) renderStatus(status wire.StatusUpdate) []Frame {
	if status.TurnElapsedMS == nil || (status.TurnRunning != nil && *status.TurnRunning) {
		return nil
	}
	elapsed := time.Duration(*status.TurnElapsedMS) * time.Millisecond
	return []Frame{{Stream: StreamMeta, Text: v.theme.StatusLine(formatDuration(elapsed), v.lastStatus)}}
}

func (v *LiveView) resetTurn() {
	v.content = nil
	v.tools = make(map[string]*toolBlock)
	v.toolOrder = nil
	v.turnHasText = false
	v.turnHadMeta = false
	v.activeStep = 0
	v.compacting = false
}

func mergeStatus(prev, next wire.StatusUpdate) wire.StatusUpdate {
	if next.ContextUsage != nil {
		prev.ContextUsage = next.ContextUsage
	}
	if next.ContextTokens != nil {
		prev.ContextTokens = next.ContextTokens
	}
	if next.MaxContextTokens != nil {
		prev.MaxContextTokens = next.MaxContextTokens
	}
	if next.PlanMode != nil {
		prev.PlanMode = next.PlanMode
	}
	if next.TurnRunning != nil {
		prev.TurnRunning = next.TurnRunning
	}
	if next.TurnElapsedMS != nil {
		prev.TurnElapsedMS = next.TurnElapsedMS
	}
	if next.Mode != "" {
		prev.Mode = next.Mode
	}
	if next.ModelProfile != "" {
		prev.ModelProfile = next.ModelProfile
	}
	if next.PermissionProfile != "" {
		prev.PermissionProfile = next.PermissionProfile
	}
	if next.Provider != "" {
		prev.Provider = next.Provider
	}
	if next.Model != "" {
		prev.Model = next.Model
	}
	if len(next.Diagnostics) > 0 {
		prev.Diagnostics = next.Diagnostics
	}
	return prev
}

func processDetail(event wire.ProcessEvent) string {
	detail := event.Message
	if detail == "" && event.Output != "" {
		detail = event.Stream + ": " + event.Output
	}
	if detail == "" && event.Error != "" {
		detail = event.Error
	}
	if event.Command != "" {
		cmd := strings.TrimSpace(event.Command + " " + strings.Join(event.Args, " "))
		if detail != "" {
			return cmd + " -- " + detail
		}
		return cmd
	}
	return detail
}

func interactiveDetail(event wire.InteractiveEvent) string {
	detail := event.Message
	if detail == "" && event.Output != "" {
		detail = event.Output
	}
	if detail == "" && event.Error != "" {
		detail = event.Error
	}
	if event.Command != "" {
		cmd := strings.TrimSpace(event.Command + " " + strings.Join(event.Args, " "))
		if detail != "" {
			return cmd + " -- " + detail
		}
		return cmd
	}
	return detail
}

func summarizeJSON(raw json.RawMessage) string {
	var payload map[string]any
	if json.Unmarshal(raw, &payload) != nil {
		return trimLine(string(raw), 500)
	}
	parts := make([]string, 0, 5)
	for _, key := range []string{"status", "mode", "model_profile", "task"} {
		if value, ok := payload[key]; ok && fmt.Sprint(value) != "" {
			parts = append(parts, key+"="+fmt.Sprint(value))
		}
	}
	if logValue, ok := payload["log"].(map[string]any); ok {
		for _, key := range []string{"tool", "result", "error"} {
			if value, ok := logValue[key]; ok && fmt.Sprint(value) != "" {
				parts = append(parts, "log."+key+"="+fmt.Sprint(value))
			}
		}
	}
	if len(parts) == 0 {
		return trimLine(string(raw), 500)
	}
	return strings.Join(parts, " ")
}

func keyArgument(toolName, raw string) string {
	var args map[string]any
	if json.Unmarshal([]byte(raw), &args) != nil {
		return trimLine(raw, 120)
	}
	preferred := []string{"path", "file_path", "command", "cmd", "query", "pattern", "url", "task", "prompt", "id"}
	for _, key := range preferred {
		if value, ok := args[key]; ok && fmt.Sprint(value) != "" {
			return trimLine(fmt.Sprint(value), 140)
		}
	}
	for key, value := range args {
		if fmt.Sprint(value) != "" {
			return trimLine(key+"="+fmt.Sprint(value), 140)
		}
	}
	return ""
}

func numberedOptions(options []string) string {
	parts := make([]string, 0, len(options))
	for i, option := range options {
		parts = append(parts, fmt.Sprintf("%d. %s", i+1, option))
	}
	return strings.Join(parts, "  ")
}

func questionHints(item wire.QuestionItem) string {
	hints := make([]string, 0, 3)
	if item.Multiple {
		hints = append(hints, "multi-select")
	}
	if item.AllowCustom {
		hints = append(hints, "custom text allowed")
	}
	if item.Fallback != "" {
		hints = append(hints, "fallback: "+item.Fallback)
	}
	return "  " + strings.Join(hints, " · ")
}

func estimateTokens(text string) float64 {
	if text == "" {
		return 0
	}
	cjk := 0
	other := 0
	for _, ch := range text {
		if (ch >= 0x4E00 && ch <= 0x9FFF) || (ch >= 0x3000 && ch <= 0x303F) || (ch >= 0xFF00 && ch <= 0xFFEF) {
			cjk++
		} else {
			other++
		}
	}
	return float64(cjk)*1.5 + float64(other)/4
}

func trimLine(s string, limit int) string {
	s = strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
	if limit <= 0 || utf8.RuneCountInString(s) <= limit {
		return s
	}
	runes := []rune(s)
	return string(runes[:limit]) + "..."
}

func firstRunes(s string, limit int) string {
	if limit <= 0 || s == "" {
		return ""
	}
	if utf8.RuneCountInString(s) <= limit {
		return s
	}
	runes := []rune(s)
	return string(runes[:limit])
}

func formatDuration(d time.Duration) string {
	if d < 0 {
		d = 0
	}
	if d < time.Second {
		return fmt.Sprintf("%dms", d.Milliseconds())
	}
	return d.Truncate(time.Second).String()
}
