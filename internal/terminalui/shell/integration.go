package shell

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/presentation"
	"golang.org/x/term"
)

const MaxEditorBytes = 8 * 1024 * 1024

type SteerCommand struct {
	Text string `json:"text"`
	Type string `json:"type"`
}

type ShellDispatch struct {
	Renderer *Renderer
	Managed  *ManagedRenderer
}

func (d *ShellDispatch) Send(ev presentation.Event) {
	if d.Managed != nil {
		d.Managed.AcceptPresentationEvent(ev)
	} else if d.Renderer != nil {
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
	r.eventCh <- ev
}

func (r *Renderer) orchestratorLoop(ctx context.Context, steerCh chan<- SteerCommand) error {
	inputCh := make(chan inputEvent, 256)
	resizeCh := make(chan os.Signal, 1)
	signal.Notify(resizeCh, syscall.SIGWINCH)
	defer signal.Stop(resizeCh)
	go readInput(ctx, r.in, inputCh)

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-resizeCh:
			r.checkResize()
			r.dirty = true
			r.renderLive(r.lastStatus, r.lastLive)
		case ev, ok := <-r.eventCh:
			if ok {
				r.handlePresentationEvent(ev)
				if ev.Type == presentation.EvtTurnEnd && len(r.queued) > 0 {
					next := r.queued[0]
					r.queued = r.queued[1:]
					r.processing = true
					r.dirty = true
					r.renderLive("submitted", fmt.Sprintf("queued turns remaining: %d", len(r.queued)))
					select {
					case steerCh <- SteerCommand{Text: next, Type: "submit"}:
					default:
						r.queued = append([]string{next}, r.queued...)
					}
				}
			}
		case ev, ok := <-inputCh:
			if !ok {
				return nil
			}
			r.checkResize()
			changed, exit := r.handleInputEvent(ev, steerCh)
			if exit {
				return nil
			}
			if changed {
				r.dirty = true
				r.renderLive("editing", r.lastLive)
			}
		}
	}
}

type inputKind int

const (
	inputRune inputKind = iota
	inputSubmit
	inputNewline
	inputExit
	inputCancel
	inputLeft
	inputRight
	inputUp
	inputDown
	inputHome
	inputEnd
	inputDelete
	inputWordLeft
	inputWordRight
	inputDeleteWordBack
	inputDeleteWordForward
	inputClear
	inputPaste
)

type inputEvent struct {
	kind inputKind
	rn   rune
	text string
}

func readInput(ctx context.Context, in io.Reader, ch chan<- inputEvent) {
	reader := bufio.NewReader(in)
	for {
		ev, err := readInputEvent(reader)
		if err != nil {
			close(ch)
			return
		}
		select {
		case ch <- ev:
		case <-ctx.Done():
			return
		}
	}
}

func readInputEvent(reader *bufio.Reader) (inputEvent, error) {
	rn, _, err := reader.ReadRune()
	if err != nil {
		return inputEvent{}, err
	}
	switch rn {
	case 0x03:
		return inputEvent{kind: inputCancel}, nil
	case 0x04:
		return inputEvent{kind: inputExit}, nil
	case 0x01:
		return inputEvent{kind: inputHome}, nil
	case 0x05:
		return inputEvent{kind: inputEnd}, nil
	case 0x0a:
		return inputEvent{kind: inputNewline}, nil
	case 0x0b:
		return inputEvent{kind: inputDeleteWordForward}, nil
	case 0x15:
		return inputEvent{kind: inputClear}, nil
	case 0x17:
		return inputEvent{kind: inputDeleteWordBack}, nil
	case 0x7f, 0x08:
		return inputEvent{kind: inputRune, rn: rn}, nil
	case '\r':
		return inputEvent{kind: inputSubmit}, nil
	case 0x1b:
		return readEscapeEvent(reader)
	default:
		return inputEvent{kind: inputRune, rn: rn}, nil
	}
}

func readEscapeEvent(reader *bufio.Reader) (inputEvent, error) {
	next, err := reader.ReadByte()
	if err != nil {
		return inputEvent{}, err
	}
	if next == '\r' || next == '\n' {
		return inputEvent{kind: inputNewline}, nil
	}
	if next != '[' && next != 'b' && next != 'f' && next != 0x7f && next != 0x08 {
		return inputEvent{}, nil
	}
	if next == 'b' {
		return inputEvent{kind: inputWordLeft}, nil
	}
	if next == 'f' {
		return inputEvent{kind: inputWordRight}, nil
	}
	if next == 0x7f || next == 0x08 {
		return inputEvent{kind: inputDeleteWordBack}, nil
	}
	seq, err := readCSI(reader)
	if err != nil {
		return inputEvent{}, err
	}
	switch seq {
	case "A":
		return inputEvent{kind: inputUp}, nil
	case "B":
		return inputEvent{kind: inputDown}, nil
	case "C":
		return inputEvent{kind: inputRight}, nil
	case "D":
		return inputEvent{kind: inputLeft}, nil
	case "H", "1~":
		return inputEvent{kind: inputHome}, nil
	case "F", "4~", "8~":
		return inputEvent{kind: inputEnd}, nil
	case "3~":
		return inputEvent{kind: inputDelete}, nil
	case "1;5D", "5D":
		return inputEvent{kind: inputWordLeft}, nil
	case "1;5C", "5C":
		return inputEvent{kind: inputWordRight}, nil
	case "3;5~":
		return inputEvent{kind: inputDeleteWordForward}, nil
	case "200~":
		paste, err := readBracketedPaste(reader)
		if err != nil {
			return inputEvent{}, err
		}
		return inputEvent{kind: inputPaste, text: paste}, nil
	default:
		return inputEvent{}, nil
	}
}

func (r *Renderer) handleInputEvent(ev inputEvent, steerCh chan<- SteerCommand) (bool, bool) {
	switch ev.kind {
	case inputCancel:
		if r.processing {
			r.cancelled = true
			r.dirty = true
			r.renderLive("cancelled", r.lastLive)
			select {
			case steerCh <- SteerCommand{Type: "cancel"}:
			default:
			}
			return false, false
		}
		if r.editor.Len() > 0 {
			r.editor.Clear()
			return true, false
		}
		return false, true
	case inputExit:
		if r.editor.Len() == 0 {
			return false, true
		}
		r.editor.Delete()
	case inputHome:
		r.editor.BufferStart()
	case inputEnd:
		r.editor.BufferEnd()
	case inputRune:
		if ev.rn == 0x7f || ev.rn == 0x08 {
			r.editor.Backspace()
		} else if ev.rn >= 0x20 {
			if !r.insertWithLimit(string(ev.rn), false) {
				return false, false
			}
		}
	case inputLeft:
		r.editor.Left()
	case inputRight:
		r.editor.Right()
	case inputUp:
		if r.editor.CursorPos() == 0 {
			r.Up()
		} else {
			r.editor.Up()
		}
	case inputDown:
		if r.editor.CursorPos() >= r.editor.Len() {
			r.Down()
		} else {
			r.editor.Down()
		}
	case inputDelete:
		r.editor.Delete()
	case inputWordLeft:
		r.editor.WordLeft()
	case inputWordRight:
		r.editor.WordRight()
	case inputDeleteWordBack:
		r.editor.DeleteWordBackward()
	case inputDeleteWordForward:
		r.editor.DeleteWordForward()
	case inputClear:
		r.editor.Clear()
	case inputNewline:
		if !r.insertWithLimit("\n", false) {
			return false, false
		}
	case inputPaste:
		start := time.Now()
		if !r.insertWithLimit(ev.text, true) {
			return false, false
		}
		r.metrics = append(r.metrics, Sample{Name: "paste", Duration: time.Since(start)})
	case inputSubmit:
		text := r.editor.Text()
		if strings.TrimSpace(text) == "" {
			return false, false
		}
		r.history.AddEntry(text)
		r.editor.Clear()
		cmd := SteerCommand{Text: text, Type: "submit"}
		if r.processing {
			r.queued = append(r.queued, text)
			r.dirty = true
			r.renderLive("queued", fmt.Sprintf("queued turns: %d", len(r.queued)))
			return false, false
		}
		r.processing = true
		r.cancelled = false
		r.dirty = true
		r.renderLive("submitted", r.lastLive)
		select {
		case steerCh <- cmd:
		default:
			r.queued = append(r.queued, text)
		}
		return false, false
	}
	return true, false
}

func (r *Renderer) insertWithLimit(text string, paste bool) bool {
	if r.editor.ByteLen()+len(text) > MaxEditorBytes {
		r.dirty = true
		r.renderLive("input_limit", fmt.Sprintf("paste/input rejected: bytes=%d add=%d limit=%d", r.editor.ByteLen(), len(text), MaxEditorBytes))
		return false
	}
	r.editor.Insert(text)
	if paste && len(text) >= 1024*1024 {
		r.lastLive = fmt.Sprintf("paste folded preview: bytes=%d lines=%d sha256=%s", len(text), strings.Count(text, "\n")+1, sha256hex(text))
	}
	return true
}

func (r *Renderer) handleRune(rn rune, steerCh chan<- SteerCommand) bool {
	var changed bool
	if rn == 0x03 {
		changed, _ = r.handleInputEvent(inputEvent{kind: inputCancel}, steerCh)
	} else if rn == 0x04 {
		changed, _ = r.handleInputEvent(inputEvent{kind: inputExit}, steerCh)
	} else if rn == 0x01 {
		changed, _ = r.handleInputEvent(inputEvent{kind: inputHome}, steerCh)
	} else if rn == 0x05 {
		changed, _ = r.handleInputEvent(inputEvent{kind: inputEnd}, steerCh)
	} else if rn == 0x15 {
		changed, _ = r.handleInputEvent(inputEvent{kind: inputClear}, steerCh)
	} else if rn == '\n' {
		changed, _ = r.handleInputEvent(inputEvent{kind: inputNewline}, steerCh)
	} else if rn == '\r' {
		changed, _ = r.handleInputEvent(inputEvent{kind: inputSubmit}, steerCh)
	} else {
		changed, _ = r.handleInputEvent(inputEvent{kind: inputRune, rn: rn}, steerCh)
	}
	return changed
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
		if r.lastStatus == "streaming" {
			return
		}
		status = "streaming"
		live = "receiving response"

	case presentation.EvtContentEnd:
		if p, ok := ev.Data.(presentation.ContentEndPayload); ok {
			if p.FullContent != "" {
				r.streamBuf = p.FullContent
			}
		}
		r.commitMessage(r.streamBuf)
		r.streamBuf = ""
		r.processing = false
		status = "done"
		live = ""

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
		if len(r.queued) > 0 {
			status = "queued"
		}

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
	if len([]rune(s)) <= max {
		return s
	}
	runes := []rune(s)
	if max > 3 && len(runes) > max-3 {
		return "..." + string(runes[len(runes)-max+3:])
	}
	return string(runes[len(runes)-max:])
}
