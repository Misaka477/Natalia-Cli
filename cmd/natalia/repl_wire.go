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
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/wire"
)

type wireTerminalRenderState struct {
	inReasoning bool
}

func startInteractiveWireRenderer(out, errOut io.Writer) (*wire.Wire, func()) {
	return startInteractiveWireRendererWithResponder(out, errOut, newTerminalQuestionResponder(os.Stdin, errOut))
}

type questionResponder func(context.Context, wire.QuestionRequest) (wire.QuestionResponse, error)

func startInteractiveWireRendererWithResponder(out, errOut io.Writer, responder questionResponder) (*wire.Wire, func()) {
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
	if msg.Kind == wire.MessageRequest && msg.Request != nil {
		renderInteractiveWireRequest(msg.Request, errOut)
		return
	}
	if msg.Kind != wire.MessageEvent || msg.Event == nil {
		return
	}
	switch msg.Event.Type {
	case wire.EventStepBegin:
		var step wire.StepBegin
		if json.Unmarshal(msg.Event.Payload, &step) == nil {
			fmt.Fprintf(errOut, "\n[step %d]\n", step.N)
		}
	case wire.EventStepInterrupted:
		fmt.Fprintln(errOut, "\n[step interrupted]")
	case wire.EventCompactionBegin:
		fmt.Fprintln(errOut, "\n[compaction begin]")
	case wire.EventCompactionEnd:
		fmt.Fprintln(errOut, "\n[compaction end]")
	case wire.EventContentPart:
		var part wire.ContentPart
		if json.Unmarshal(msg.Event.Payload, &part) != nil {
			return
		}
		renderInteractiveContentPart(state, part, out)
	case wire.EventTurnEnd:
		if state.inReasoning {
			fmt.Fprint(out, "\033[0m")
			state.inReasoning = false
		}
		fmt.Fprintln(out)
	case wire.EventStatusUpdate:
		var status wire.StatusUpdate
		if json.Unmarshal(msg.Event.Payload, &status) != nil {
			return
		}
		renderInteractiveStatus(status, errOut)
	case wire.EventNotification:
		var notification wire.Notification
		if json.Unmarshal(msg.Event.Payload, &notification) != nil {
			return
		}
		if notification.Title != "" || notification.Message != "" {
			fmt.Fprintf(errOut, "\n[notification] %s: %s\n", notification.Title, notification.Message)
		}
	case wire.EventToolCall:
		var call wire.ToolCall
		if json.Unmarshal(msg.Event.Payload, &call) == nil {
			fmt.Fprintf(errOut, "\n[tool call] %s %s\n", call.Name, trimWireLine(string(call.Arguments), 300))
		}
	case wire.EventToolResult:
		var result wire.ToolResult
		if json.Unmarshal(msg.Event.Payload, &result) == nil {
			label := "tool result"
			if result.Error != "" {
				label = "tool error"
			}
			content := strings.TrimSpace(result.Content)
			if result.Error != "" {
				content = result.Error
			}
			fmt.Fprintf(errOut, "\n[%s] %s: %s\n", label, result.Name, trimWireLine(content, 800))
		}
	case wire.EventSubagentEvent:
		var event wire.SubagentEvent
		if json.Unmarshal(msg.Event.Payload, &event) == nil {
			fmt.Fprintf(errOut, "\n[subagent] %s %s %s\n", event.ID, event.Event, trimWireLine(formatSubagentPayload(event.Payload), 500))
		}
	case wire.EventProcessEvent:
		var event wire.ProcessEvent
		if json.Unmarshal(msg.Event.Payload, &event) == nil {
			detail := event.Message
			if detail == "" && event.Output != "" {
				detail = event.Stream + ": " + event.Output
			}
			if detail == "" && event.Error != "" {
				detail = event.Error
			}
			fmt.Fprintf(errOut, "\n[process] %s %s status=%s %s\n", event.ID, event.Event, event.Status, trimWireLine(detail, 500))
		}
	case wire.EventInteractiveEvent:
		var event wire.InteractiveEvent
		if json.Unmarshal(msg.Event.Payload, &event) == nil {
			detail := event.Message
			if detail == "" && event.Output != "" {
				detail = event.Output
			}
			if detail == "" && event.Error != "" {
				detail = event.Error
			}
			fmt.Fprintf(errOut, "\n[interactive] %s %s status=%s %s\n", event.ID, event.Event, event.Status, trimWireLine(detail, 500))
		}
	}
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
	switch req.Type {
	case wire.RequestApproval:
		var approval wire.ApprovalRequest
		if json.Unmarshal(req.Payload, &approval) == nil {
			fmt.Fprintf(errOut, "\n[approval request] %s: %s\n", approval.Action, trimWireLine(approval.Description, 800))
			renderWireDisplayBlocks(approval.Display, errOut)
		}
	case wire.RequestQuestion:
		var question wire.QuestionRequest
		if json.Unmarshal(req.Payload, &question) == nil {
			fmt.Fprintf(errOut, "\n[question request] %s (%d questions)\n", req.ID, len(question.Questions))
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
			fmt.Fprintf(errOut, "\n[tool request] %s %s\n", toolReq.Name, trimWireLine(string(toolReq.Arguments), 300))
		}
	case wire.RequestHook:
		var hookReq wire.HookRequest
		if json.Unmarshal(req.Payload, &hookReq) == nil {
			fmt.Fprintf(errOut, "\n[hook request] %s %s\n", hookReq.Event, hookReq.Target)
		}
	default:
		fmt.Fprintf(errOut, "\n[wire request] %s %s\n", req.Type, req.ID)
	}
}

func newTerminalQuestionResponder(in io.Reader, out io.Writer) questionResponder {
	reader := bufio.NewReader(in)
	return func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
		answers := make(map[string]string, len(req.Questions))
		for _, item := range req.Questions {
			fmt.Fprintf(out, "[answer] %s > ", item.Name)
			answer, ok, err := readQuestionLine(ctx, reader)
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

func readQuestionLine(ctx context.Context, reader *bufio.Reader) (string, bool, error) {
	answerCh := make(chan string, 1)
	errCh := make(chan error, 1)
	go func() {
		answer, err := reader.ReadString('\n')
		if err != nil && err != io.EOF {
			errCh <- err
			return
		}
		answerCh <- strings.TrimSpace(answer)
	}()
	select {
	case <-ctx.Done():
		return "", false, nil
	case err := <-errCh:
		return "", false, err
	case answer := <-answerCh:
		return answer, true, nil
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
			} else if item.AllowCustom && strings.TrimSpace(part) != "" {
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
	if item.AllowCustom && answer != "" {
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
		case display.BlockDiff:
			var diff display.DiffBlock
			if json.Unmarshal(block.Data, &diff) == nil {
				fmt.Fprintf(out, "[diff] %s\n%s\n", diff.Path, trimWireLine(diff.Diff, 4000))
			}
		case display.BlockShell:
			var shell display.ShellBlock
			if json.Unmarshal(block.Data, &shell) == nil {
				fmt.Fprintf(out, "[shell] %s\n%s\n", shell.Command, trimWireLine(shell.Output, 2000))
			}
		}
	}
}

func renderInteractiveContentPart(state *wireTerminalRenderState, part wire.ContentPart, out io.Writer) {
	switch part.Type {
	case wire.ContentThink:
		if !state.inReasoning {
			fmt.Fprint(out, "\n\033[38;5;245m")
			state.inReasoning = true
		}
		fmt.Fprint(out, part.Text)
	default:
		if state.inReasoning {
			fmt.Fprint(out, "\033[0m\n\n")
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
		fmt.Fprintf(errOut, "\r[elapsed %s]", formatElapsed(elapsed))
		return
	}
	fmt.Fprintf(errOut, "\r[elapsed %s]\n", formatElapsed(elapsed))
}

func trimWireLine(s string, limit int) string {
	s = strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
	if limit <= 0 || len(s) <= limit {
		return s
	}
	return s[:limit] + "..."
}
