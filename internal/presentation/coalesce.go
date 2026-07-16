package presentation

import (
	"bytes"
	"sync"
	"time"
)

type Coalescer struct {
	mu            sync.Mutex
	buf           bytes.Buffer
	timer         *time.Timer
	coalesceDelay time.Duration
	pending       []Event

	coalescing   bool
	coalesceCID  CorrelationID
	coalesceType EventType
}

func NewCoalescer(delay time.Duration) *Coalescer {
	return &Coalescer{
		coalesceDelay: delay,
	}
}

func (c *Coalescer) Push(event Event) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	switch event.Type {
	case EvtContentPart, EvtPTYOutput:
		if c.coalescing && c.coalesceType == event.Type && c.coalesceCID == event.CorrelationID {
			text := extractCoalesceText(event)
			if text != "" {
				c.buf.WriteString(text)
			}
			c.resetTimer()
			return true
		}

		c.finalizeCoalescing()

		c.coalescing = true
		c.coalesceType = event.Type
		c.coalesceCID = event.CorrelationID
		text := extractCoalesceText(event)
		if text != "" {
			c.buf.WriteString(text)
		}
		c.resetTimer()
		return true

	default:
		return false
	}
}

func (c *Coalescer) Flush() []Event {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.finalizeCoalescing()
	result := c.pending
	c.pending = nil
	return result
}

func (c *Coalescer) finalizeCoalescing() {
	if !c.coalescing || c.buf.Len() == 0 {
		return
	}
	text := c.buf.String()
	c.buf.Reset()

	var data any
	if c.coalesceType == EvtContentPart {
		data = ContentPartPayload{Content: text}
	} else {
		data = PTYOutputPayload{Output: text, More: true}
	}

	c.pending = append(c.pending, Event{
		Type:          c.coalesceType,
		CorrelationID: c.coalesceCID,
		Data:          data,
	})
	c.coalescing = false
}

func (c *Coalescer) resetTimer() {
	if c.timer != nil {
		c.timer.Stop()
	}
	c.timer = time.AfterFunc(c.coalesceDelay, func() {
		c.mu.Lock()
		c.finalizeCoalescing()
		c.mu.Unlock()
	})
}

func extractCoalesceText(event Event) string {
	switch event.Type {
	case EvtContentPart:
		if p, ok := event.Data.(ContentPartPayload); ok {
			return p.Content
		}
	case EvtPTYOutput:
		if p, ok := event.Data.(PTYOutputPayload); ok {
			return p.Output
		}
	}
	return ""
}
