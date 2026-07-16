package shell

import (
	"bufio"
	"context"
	"os"
	"strings"

	"github.com/Misaka477/Natalia-Cli/internal/presentation"
	"golang.org/x/term"
)

type SteerCommand struct {
	Text string `json:"text"`
	Type string `json:"type"`
}

type ShellDispatch struct {
	Renderer *Renderer
}

func (d *ShellDispatch) Send(ev presentation.Event) {
	if d.Renderer != nil {
		d.Renderer.AcceptPresentationEvent(ev)
	}
}

func (d *ShellDispatch) ShowApproval(req presentation.ApprovalRequestPayload) presentation.ApprovalResultPayload {
	return presentation.ApprovalResultPayload{ID: req.ID, Approved: true}
}

func (d *ShellDispatch) ShowQuestion(req presentation.QuestionRequestPayload) string {
	return ""
}

func (r *Renderer) RunWithOrchestrator(ctx context.Context, steerCh chan<- SteerCommand) error {
	if stdin, ok := r.in.(*os.File); ok && term.IsTerminal(int(stdin.Fd())) {
		oldState, err := term.MakeRaw(int(stdin.Fd()))
		if err == nil {
			defer term.Restore(int(stdin.Fd()), oldState)
		}
	}
	r.renderWelcome()
	r.processing = false
	return r.orchestratorLoop(ctx, steerCh)
}

func (r *Renderer) AcceptPresentationEvent(ev presentation.Event) {
	if r.eventCh == nil {
		return
	}
	select {
	case r.eventCh <- ev:
	default:
	}
}

func (r *Renderer) orchestratorLoop(ctx context.Context, steerCh chan<- SteerCommand) error {
	inputCh := make(chan rune, 256)
	go readInput(ctx, inputCh)

	for {
		select {
		case <-ctx.Done():
			return nil
		case ev, ok := <-r.eventCh:
			if ok {
				r.handlePresentationEvent(ev)
			}
		case rn, ok := <-inputCh:
			if !ok {
				return nil
			}
			if rn == 0x04 {
				return nil
			}
			r.checkResize()
			if r.handleRune(rn, steerCh) {
				r.dirty = true
				r.renderLive("editing", "")
			}
		}
	}
}

func readInput(ctx context.Context, ch chan<- rune) {
	reader := bufio.NewReader(os.Stdin)
	for {
		r, _, err := reader.ReadRune()
		if err != nil {
			close(ch)
			return
		}
		select {
		case ch <- r:
		case <-ctx.Done():
			return
		}
	}
}

func (r *Renderer) handleRune(rn rune, steerCh chan<- SteerCommand) bool {
	switch {
	case rn == 0x03:
		// Ctrl+C
		if r.processing {
			r.cancelled = true
			r.renderLive("cancelled", "")
			select {
			case steerCh <- SteerCommand{Type: "cancel"}:
			default:
			}
		}
		return false
	case rn == 0x01:
		r.editor.BufferStart()
	case rn == 0x05:
		r.editor.BufferEnd()
	case rn == 0x15:
		r.editor.Clear()
	case rn == 0x7f || rn == 0x08:
		r.editor.Backspace()
	case rn == 0x1b:
		r.handleRawEscape()
	case rn == '\r' || rn == '\n':
		text := r.editor.Text()
		if strings.TrimSpace(text) != "" {
			r.editor.Clear()
			r.processing = true
			r.cancelled = false
			r.dirty = true
			r.renderLive("submitted", "")
			select {
			case steerCh <- SteerCommand{Text: text, Type: "submit"}:
			default:
			}
		}
		return false
	default:
		if rn >= 0x20 {
			r.editor.Insert(string(rn))
		}
	}
	return true
}

func (r *Renderer) handleRawEscape() {
	buf := make([]byte, 8)
	n, _ := os.Stdin.Read(buf)
	if n < 2 || buf[0] != '[' {
		return
	}
	seq := string(buf[1:n])
	switch seq {
	case "A":
		r.editor.Up()
	case "B":
		r.editor.Down()
	case "C":
		r.editor.Right()
	case "D":
		r.editor.Left()
	case "H", "1~":
		r.editor.Home()
	case "F", "4~":
		r.editor.End()
	case "3~":
		r.editor.Delete()
	}
}

func (r *Renderer) handlePresentationEvent(ev presentation.Event) {
	var status, live string

	switch ev.Type {
	case presentation.EvtContentPart:
		if p, ok := ev.Data.(presentation.ContentPartPayload); ok {
			r.streamBuf += p.Content
		}
		status = "streaming"
		live = truncateContent(r.streamBuf, 120)

	case presentation.EvtContentEnd:
		if p, ok := ev.Data.(presentation.ContentEndPayload); ok {
			r.streamBuf = p.FullContent
		}
		r.processing = false
		status = "done"
		live = truncateContent(r.streamBuf, 120)

	case presentation.EvtThinkingBegin:
		status = "thinking"

	case presentation.EvtThinkingEnd:
		status = "ready"

	case presentation.EvtToolBegin:
		if p, ok := ev.Data.(presentation.ToolBeginPayload); ok {
			r.toolName = p.Name
		}
		status = "tool"
		live = r.toolName

	case presentation.EvtToolPart:
		status = "tool"
		live = r.toolName

	case presentation.EvtToolEnd:
		r.toolName = ""
		if p, ok := ev.Data.(presentation.ToolEndPayload); ok {
			if p.Error != "" {
				status = "tool_error"
				live = p.Error
			} else {
				status = "tool_complete"
			}
		} else {
			status = "tool_complete"
		}

	case presentation.EvtTurnBegin:
		r.streamBuf = ""
		r.cancelled = false
		status = "processing"

	case presentation.EvtTurnEnd:
		r.processing = false
		status = "ready"

	case presentation.EvtStatusUpdate:
		if p, ok := ev.Data.(presentation.StatusUpdatePayload); ok {
			r.statusText = p.Key + "=" + p.Value
		}
		status = "status"
		live = r.statusText

	case presentation.EvtNotification:
		if p, ok := ev.Data.(presentation.NotificationPayload); ok {
			status = p.Severity
			live = p.Message
		}

	case presentation.EvtStepBegin:
		status = "step"
		r.processing = true

	case presentation.EvtStepEnd:
		status = "ready"

	case presentation.EvtCompactBegin:
		status = "compacting"

	case presentation.EvtCompactEnd:
		status = "ready"

	case presentation.EvtApprovalRequest:
		status = "approval"
		if p, ok := ev.Data.(presentation.ApprovalRequestPayload); ok {
			live = p.ToolName
		}

	case presentation.EvtQuestionRequest:
		status = "question"

	default:
		return
	}

	r.dirty = true
	r.renderLive(status, live)
}

func truncateContent(s string, max int) string {
	if len(s) <= max {
		return s
	}
	if max > 3 {
		return "..." + s[len(s)-max+3:]
	}
	return s[len(s)-max:]
}
