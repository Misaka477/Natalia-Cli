package main

import (
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"

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
	if msg.Kind != wire.MessageEvent || msg.Event == nil {
		return
	}
	switch msg.Event.Type {
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
