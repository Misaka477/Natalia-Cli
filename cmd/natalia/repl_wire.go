package main

import (
	"encoding/json"
	"fmt"
	"io"
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
	w := wire.NewWire()
	ch, cancel := w.UISide().SubscribeRaw()
	done := make(chan struct{})
	var once sync.Once
	go func() {
		defer close(done)
		state := &wireTerminalRenderState{}
		for msg := range ch {
			renderInteractiveWireMessage(state, msg, out, errOut)
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
			fmt.Fprintf(errOut, "\n[subagent] %s %s %s\n", event.ID, event.Event, trimWireLine(string(event.Payload), 300))
		}
	}
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
