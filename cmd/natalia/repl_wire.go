package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/terminalui"
	tui "github.com/Misaka477/Natalia-Cli/internal/terminalui/tui"
	"github.com/Misaka477/Natalia-Cli/internal/wire"
)

type wireTerminalRenderState struct {
	inReasoning bool
	theme       *terminalui.Theme
	view        *terminalui.LiveView
}

func (s *wireTerminalRenderState) terminalTheme() terminalui.Theme {
	if s == nil || s.theme == nil {
		return terminalui.DefaultTheme
	}
	return *s.theme
}

func (s *wireTerminalRenderState) liveView() *terminalui.LiveView {
	if s.view == nil {
		s.view = terminalui.NewLiveView()
	}
	return s.view
}

func startInteractiveWireRenderer(out, errOut io.Writer) (*wire.Wire, func()) {
	lineReader := newTerminalLineReader(os.Stdin)
	return startInteractiveWireRendererWithResponders(out, errOut, newTerminalQuestionResponder(lineReader, errOut), newTerminalApprovalResponder(lineReader, errOut))
}

type questionResponder func(context.Context, wire.QuestionRequest) (wire.QuestionResponse, error)
type approvalResponder func(context.Context, wire.ApprovalRequest) (wire.ApprovalResponse, error)

func startInteractiveWireRendererWithResponder(out, errOut io.Writer, responder questionResponder) (*wire.Wire, func()) {
	return startInteractiveWireRendererWithResponders(out, errOut, responder, nil)
}

func startInteractiveWireRendererWithResponders(out, errOut io.Writer, responder questionResponder, approver approvalResponder) (*wire.Wire, func()) {
	w := wire.NewWire()
	ch, cancel := w.UISide().SubscribeRaw()
	done := make(chan struct{})
	var once sync.Once
	go func() {
		defer close(done)
		state := &wireTerminalRenderState{}
		for msg := range ch {
			renderInteractiveWireMessage(state, msg, out, errOut)
			if responder != nil && msg.Kind == wire.MessageRequest && msg.Request != nil && msg.Request.Type == wire.RequestQuestion {
				respondInteractiveQuestion(w, msg.Request, responder, errOut)
			}
			if approver != nil && msg.Kind == wire.MessageRequest && msg.Request != nil && msg.Request.Type == wire.RequestApproval {
				respondInteractiveApproval(w, msg.Request, approver, errOut)
			}
		}
	}()
	stop := func() {
		once.Do(func() {
			cancel()
			<-done
		})
	}
	return w, stop
}

func respondInteractiveApproval(w *wire.Wire, req *wire.WireRequest, responder approvalResponder, errOut io.Writer) {
	var approval wire.ApprovalRequest
	if err := json.Unmarshal(req.Payload, &approval); err != nil {
		fmt.Fprintf(errOut, "[approval response error] %v\n", err)
		return
	}
	resp, err := responder(context.Background(), approval)
	if err != nil {
		fmt.Fprintf(errOut, "[approval response error] %v\n", err)
		return
	}
	if resp.RequestID == "" {
		resp.RequestID = req.ID
	}
	data, err := json.Marshal(resp)
	if err != nil {
		fmt.Fprintf(errOut, "[approval response error] %v\n", err)
		return
	}
	w.ResolveResponse(req.ID, data)
}

func respondInteractiveQuestion(w *wire.Wire, req *wire.WireRequest, responder questionResponder, errOut io.Writer) {
	var question wire.QuestionRequest
	if err := json.Unmarshal(req.Payload, &question); err != nil {
		fmt.Fprintf(errOut, "[question response error] %v\n", err)
		return
	}
	ctx := context.Background()
	if question.TimeoutMS > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(question.TimeoutMS)*time.Millisecond)
		defer cancel()
	}
	resp, err := responder(ctx, question)
	if err != nil {
		fmt.Fprintf(errOut, "[question response error] %v\n", err)
		return
	}
	if resp.RequestID == "" {
		resp.RequestID = req.ID
	}
	data, err := json.Marshal(resp)
	if err != nil {
		fmt.Fprintf(errOut, "[question response error] %v\n", err)
		return
	}
	w.ResolveResponse(req.ID, data)
}

func renderInteractiveWireMessage(state *wireTerminalRenderState, msg wire.WireMessage, out, errOut io.Writer) {
	if state == nil {
		state = &wireTerminalRenderState{}
	}
	for _, frame := range state.liveView().Dispatch(msg) {
		if frame.Text == "" {
			continue
		}
		switch frame.Stream {
		case terminalui.StreamOutput:
			fmt.Fprint(out, frame.Text)
		case terminalui.StreamReasoning:
			fmt.Fprint(errOut, frame.Text)
		default:
			fmt.Fprint(errOut, frame.Text)
			if !strings.HasSuffix(frame.Text, "\n") {
				fmt.Fprintln(errOut)
			}
		}
	}
}

func startTUIWireRenderer(w *wire.Wire) func() {
	if w == nil {
		return func() {}
	}
	ch, cancel := w.UISide().SubscribeRaw()
	done := make(chan struct{})
	var once sync.Once
	go func() {
		defer close(done)
		state := &wireTerminalRenderState{}
		for msg := range ch {
			text := renderTUIWireMessage(state, msg)
			if strings.TrimSpace(text) == "" || tui.DefaultProgram == nil {
				continue
			}
			tui.DefaultProgram.Send(tui.WireOutputMsg(text))
		}
	}()
	return func() {
		once.Do(func() {
			cancel()
			<-done
		})
	}
}

func renderTUIWireMessage(state *wireTerminalRenderState, msg wire.WireMessage) string {
	if state == nil {
		state = &wireTerminalRenderState{}
	}
	var b strings.Builder
	for _, frame := range state.liveView().Dispatch(msg) {
		if strings.TrimSpace(frame.Text) == "" {
			continue
		}
		b.WriteString(frame.Text)
		if !strings.HasSuffix(frame.Text, "\n") {
			b.WriteByte('\n')
		}
	}
	return b.String()
}

func formatSubagentPayload(raw json.RawMessage) string {
	var payload map[string]any
	if json.Unmarshal(raw, &payload) != nil {
		return string(raw)
	}
	parts := make([]string, 0, 5)
	for _, key := range []string{"status", "mode", "model_profile", "task"} {
		if value, ok := payload[key]; ok && fmt.Sprint(value) != "" {
			parts = append(parts, key+"="+fmt.Sprint(value))
		}
	}
	if logValue, ok := payload["log"].(map[string]any); ok {
		if tool, ok := logValue["tool"]; ok && fmt.Sprint(tool) != "" {
			parts = append(parts, "tool="+fmt.Sprint(tool))
		}
		if result, ok := logValue["result"]; ok && fmt.Sprint(result) != "" {
			parts = append(parts, "result="+fmt.Sprint(result))
		}
		if errText, ok := logValue["error"]; ok && fmt.Sprint(errText) != "" {
			parts = append(parts, "error="+fmt.Sprint(errText))
		}
	}
	if len(parts) == 0 {
		return string(raw)
	}
	return strings.Join(parts, " ")
}

func renderInteractiveWireRequest(req *wire.WireRequest, errOut io.Writer) {
	theme := terminalui.DefaultTheme
	switch req.Type {
	case wire.RequestApproval:
		var approval wire.ApprovalRequest
		if json.Unmarshal(req.Payload, &approval) == nil {
			fmt.Fprintf(errOut, "%s%s: %s\n", theme.Inline(terminalui.KindApproval, "approval request"), approval.Action, trimWireLine(approval.Description, 800))
			renderWireDisplayBlocks(approval.Display, errOut)
		}
	case wire.RequestQuestion:
		var question wire.QuestionRequest
		if json.Unmarshal(req.Payload, &question) == nil {
			fmt.Fprintf(errOut, "%s%s (%d questions)\n", theme.Inline(terminalui.KindQuestion, "question request"), req.ID, len(question.Questions))
			for _, item := range question.Questions {
				fmt.Fprintf(errOut, "- %s: %s\n", item.Name, trimWireLine(item.Question, 300))
				for i, option := range item.Options {
					fmt.Fprintf(errOut, "  %d. %s\n", i+1, option)
				}
				if item.Multiple {
					fmt.Fprintln(errOut, "  multiple: true")
				}
				if item.AllowCustom {
					fmt.Fprintln(errOut, "  custom input allowed")
				}
				if item.Fallback != "" {
					fmt.Fprintf(errOut, "  fallback: %s\n", item.Fallback)
				}
			}
		}
	case wire.RequestToolCall:
		var toolReq wire.ToolCallRequest
		if json.Unmarshal(req.Payload, &toolReq) == nil {
			fmt.Fprintf(errOut, "%s%s %s\n", theme.Inline(terminalui.KindTool, "tool request"), toolReq.Name, trimWireLine(string(toolReq.Arguments), 300))
		}
	case wire.RequestHook:
		var hookReq wire.HookRequest
		if json.Unmarshal(req.Payload, &hookReq) == nil {
			fmt.Fprintf(errOut, "%s%s %s\n", theme.Inline(terminalui.KindHook, "hook request"), hookReq.Event, hookReq.Target)
		}
	default:
		fmt.Fprintf(errOut, "%s%s %s\n", theme.Inline(terminalui.KindInfo, "wire request"), req.Type, req.ID)
	}
}

type terminalLineReader struct {
	in     io.Reader
	reader *bufio.Reader
	mu     sync.Mutex
}

func newTerminalLineReader(in io.Reader) *terminalLineReader {
	return &terminalLineReader{in: in, reader: bufio.NewReader(in)}
}

func (r *terminalLineReader) read(ctx context.Context) (string, bool, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if file, ok := r.in.(*os.File); ok {
		return readLineFromFile(ctx, file)
	}
	answer, err := r.reader.ReadString('\n')
	if err != nil && err != io.EOF {
		return "", false, err
	}
	if answer == "" && err == io.EOF {
		return "", false, io.EOF
	}
	return strings.TrimSpace(answer), true, nil
}

func readLineFromFile(ctx context.Context, file *os.File) (string, bool, error) {
	fd := int(file.Fd())
	var b strings.Builder
	buf := make([]byte, 1)
	for {
		ready, err := waitReadable(ctx, fd)
		if err != nil || !ready {
			return "", false, err
		}
		n, err := file.Read(buf)
		if n > 0 {
			switch buf[0] {
			case '\n', '\r':
				return strings.TrimSpace(b.String()), true, nil
			default:
				b.WriteByte(buf[0])
			}
		}
		if err != nil {
			if err == io.EOF && b.Len() > 0 {
				return strings.TrimSpace(b.String()), true, nil
			}
			return "", false, err
		}
	}
}

func waitReadable(ctx context.Context, fd int) (bool, error) {
	for {
		select {
		case <-ctx.Done():
			return false, nil
		default:
		}
		var rfds syscall.FdSet
		fdSet(fd, &rfds)
		timeout := syscall.NsecToTimeval((50 * time.Millisecond).Nanoseconds())
		n, err := syscall.Select(fd+1, &rfds, nil, nil, &timeout)
		if err == syscall.EINTR {
			continue
		}
		if err != nil {
			return false, err
		}
		if n > 0 && fdIsSet(fd, &rfds) {
			return true, nil
		}
	}
}

func fdSet(fd int, set *syscall.FdSet) {
	set.Bits[fd/64] |= 1 << (uint(fd) % 64)
}

func fdIsSet(fd int, set *syscall.FdSet) bool {
	return set.Bits[fd/64]&(1<<(uint(fd)%64)) != 0
}

func newTerminalQuestionResponder(reader *terminalLineReader, out io.Writer) questionResponder {
	return func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
		answers := make(map[string]string, len(req.Questions))
		for _, item := range req.Questions {
			fmt.Fprintf(out, "[answer] %s > ", item.Name)
			answer, ok, err := reader.read(ctx)
			if err != nil {
				return wire.QuestionResponse{RequestID: req.ID, Answers: answers}, err
			}
			if !ok {
				answers[item.Name] = item.Fallback
				continue
			}
			answers[item.Name] = normalizeTerminalQuestionAnswer(item, answer)
		}
		return wire.QuestionResponse{RequestID: req.ID, Answers: answers}, nil
	}
}

func newTerminalApprovalResponder(reader *terminalLineReader, out io.Writer) approvalResponder {
	return func(ctx context.Context, req wire.ApprovalRequest) (wire.ApprovalResponse, error) {
		fmt.Fprintf(out, "[approve] %s (y/N) > ", req.Action)
		answer, ok, err := reader.read(ctx)
		if err != nil {
			return wire.ApprovalResponse{RequestID: req.ID, Response: "reject"}, err
		}
		response := "reject"
		if ok {
			switch strings.ToLower(strings.TrimSpace(answer)) {
			case "y", "yes", "approve", "approved":
				response = "approve"
			}
		}
		return wire.ApprovalResponse{RequestID: req.ID, Response: response}, nil
	}
}

func normalizeTerminalQuestionAnswer(item wire.QuestionItem, answer string) string {
	if len(item.Options) == 0 {
		if answer == "" {
			return item.Fallback
		}
		return answer
	}
	if item.Multiple {
		parts := strings.Split(answer, ",")
		selected := make([]string, 0, len(parts))
		for _, part := range parts {
			if option, ok := terminalOptionByInput(item.Options, part); ok {
				selected = append(selected, option)
			} else if strings.TrimSpace(part) != "" {
				selected = append(selected, strings.TrimSpace(part))
			}
		}
		if len(selected) == 0 {
			return item.Fallback
		}
		return strings.Join(selected, ", ")
	}
	if option, ok := terminalOptionByInput(item.Options, answer); ok {
		return option
	}
	if answer != "" {
		return answer
	}
	return item.Fallback
}

func terminalOptionByInput(options []string, raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", false
	}
	for i, option := range options {
		if raw == fmt.Sprintf("%d", i+1) || strings.EqualFold(raw, strings.TrimSpace(option)) {
			return option, true
		}
	}
	return "", false
}

func renderWireDisplayBlocks(blocks []display.Block, out io.Writer) {
	for _, block := range blocks {
		switch block.Type {
		case display.BlockText:
			fmt.Fprintf(out, "%s %s\n%s\n", terminalui.DefaultTheme.DisplayLabel("text"), block.Title, trimWireLine(string(block.Data), 2000))
		case display.BlockDiff:
			var diff display.DiffBlock
			if json.Unmarshal(block.Data, &diff) == nil {
				fmt.Fprintf(out, "%s %s\n%s\n", terminalui.DefaultTheme.DisplayLabel("diff"), diff.Path, trimWireLine(diff.Diff, 4000))
			}
		case display.BlockShell:
			var shell display.ShellBlock
			if json.Unmarshal(block.Data, &shell) == nil {
				fmt.Fprintf(out, "%s %s\n%s\n", terminalui.DefaultTheme.DisplayLabel("shell"), shell.Command, trimWireLine(shell.Output, 2000))
			}
		case display.BlockTodo:
			var todo display.TodoBlock
			if json.Unmarshal(block.Data, &todo) == nil {
				fmt.Fprintf(out, "%s %s\n", terminalui.DefaultTheme.DisplayLabel("todo"), block.Title)
				for _, item := range todo.Items {
					fmt.Fprintln(out, terminalui.DefaultTheme.Checklist(item.Done, trimWireLine(item.Text, 300)))
				}
			}
		case display.BlockBackgroundTask:
			renderJSONDisplayBlock(out, "background_task", block)
		case display.BlockMedia:
			renderJSONDisplayBlock(out, "media", block)
		default:
			renderJSONDisplayBlock(out, string(block.Type), block)
		}
	}
}

func renderJSONDisplayBlock(out io.Writer, label string, block display.Block) {
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
	fmt.Fprintf(out, "%s %s\n%s\n", terminalui.DefaultTheme.DisplayLabel(label), title, trimWireLine(text, 3000))
}

func renderSubagentPayloadDetails(raw json.RawMessage, out io.Writer) {
	var payload map[string]any
	if json.Unmarshal(raw, &payload) != nil || len(payload) == 0 {
		return
	}
	for _, key := range []string{"task", "mode", "model_profile", "status"} {
		if value, ok := payload[key]; ok && fmt.Sprint(value) != "" {
			fmt.Fprintln(out, terminalui.DefaultTheme.Detail(fmt.Sprintf("  %s: %s", key, trimWireLine(fmt.Sprint(value), 500))))
		}
	}
	if logValue, ok := payload["log"].(map[string]any); ok {
		for _, key := range []string{"tool", "result", "error"} {
			if value, ok := logValue[key]; ok && fmt.Sprint(value) != "" {
				fmt.Fprintln(out, terminalui.DefaultTheme.Detail(fmt.Sprintf("  log.%s: %s", key, trimWireLine(fmt.Sprint(value), 500))))
			}
		}
	}
}

func renderProcessEventDetails(event wire.ProcessEvent, out io.Writer) {
	if event.Command != "" {
		fmt.Fprintln(out, terminalui.DefaultTheme.Detail(fmt.Sprintf("  command: %s %s", event.Command, strings.Join(event.Args, " "))))
	}
	if event.PID != 0 {
		fmt.Fprintln(out, terminalui.DefaultTheme.Detail(fmt.Sprintf("  pid: %d", event.PID)))
	}
	fmt.Fprintln(out, terminalui.DefaultTheme.Detail(fmt.Sprintf("  attached: %t", event.Attached)))
	if len(event.EnvSummary) > 0 {
		fmt.Fprintln(out, terminalui.DefaultTheme.Detail(fmt.Sprintf("  env: %s", strings.Join(event.EnvSummary, ", "))))
	}
}

func renderInteractiveEventDetails(event wire.InteractiveEvent, out io.Writer) {
	if event.Command != "" {
		fmt.Fprintln(out, terminalui.DefaultTheme.Detail(fmt.Sprintf("  command: %s %s", event.Command, strings.Join(event.Args, " "))))
	}
	if event.PID != 0 {
		fmt.Fprintln(out, terminalui.DefaultTheme.Detail(fmt.Sprintf("  pid: %d", event.PID)))
	}
	if event.Rows > 0 || event.Cols > 0 {
		fmt.Fprintln(out, terminalui.DefaultTheme.Detail(fmt.Sprintf("  size: %dx%d", event.Rows, event.Cols)))
	}
	fmt.Fprintln(out, terminalui.DefaultTheme.Detail(fmt.Sprintf("  attached: %t", event.Attached)))
}

func renderInteractiveContentPart(state *wireTerminalRenderState, part wire.ContentPart, out io.Writer) {
	switch part.Type {
	case wire.ContentThink:
		if !state.inReasoning {
			fmt.Fprint(out, "\n")
			state.inReasoning = true
		}
		fmt.Fprint(out, state.terminalTheme().Reasoning(part.Text))
	default:
		if state.inReasoning {
			fmt.Fprint(out, "\n\n")
			state.inReasoning = false
		}
		fmt.Fprint(out, part.Text)
	}
}

func renderInteractiveStatus(status wire.StatusUpdate, errOut io.Writer) {
	if errOut == nil || status.TurnElapsedMS == nil {
		return
	}
	elapsed := time.Duration(*status.TurnElapsedMS) * time.Millisecond
	running := status.TurnRunning != nil && *status.TurnRunning
	if running {
		return
	}
	fmt.Fprintln(errOut, terminalui.DefaultTheme.Status("elapsed "+formatElapsed(elapsed)))
}

func trimWireLine(s string, limit int) string {
	s = strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
	if limit <= 0 || len(s) <= limit {
		return s
	}
	return s[:limit] + "..."
}
