package shell

import (
	"fmt"
	"strings"
	"time"
)

type Block interface {
	Append(text string)
	Finish()
	Compose() string
}

type ContentBlock struct {
	buffer     strings.Builder
	renderable string
}

func NewContentBlock() *ContentBlock {
	return &ContentBlock{}
}

func (b *ContentBlock) Append(text string) {
	b.buffer.WriteString(text)
	b.renderable = b.buffer.String()
}

func (b *ContentBlock) Finish() {
	b.renderable = b.buffer.String()
}

func (b *ContentBlock) Compose() string {
	return b.renderable
}

type ToolCallBlock struct {
	name      string
	arguments strings.Builder
	finished  bool
}

func NewToolCallBlock(name string) *ToolCallBlock {
	return &ToolCallBlock{name: name}
}

func (b *ToolCallBlock) AppendArgs(text string) {
	b.arguments.WriteString(text)
}

func (b *ToolCallBlock) Finish(result string) {
	b.finished = true
}

func (b *ToolCallBlock) Compose() string {
	if !b.finished {
		return fmt.Sprintf("tool: %s args=%s", b.name, b.arguments.String())
	}
	return fmt.Sprintf("tool: %s done", b.name)
}

type NotificationBlock struct {
	message  string
	severity string
}

func NewNotificationBlock(severity, message string) *NotificationBlock {
	return &NotificationBlock{severity: severity, message: message}
}

func (b *NotificationBlock) Compose() string {
	return fmt.Sprintf("[%s] %s", b.severity, b.message)
}

type LiveRegion struct {
	blocks []Block
}

func NewLiveRegion() *LiveRegion {
	return &LiveRegion{}
}

func (r *LiveRegion) AddBlock(b Block) {
	r.blocks = append(r.blocks, b)
}

func (r *LiveRegion) Compose() string {
	var out []string
	for _, b := range r.blocks {
		out = append(out, b.Compose())
	}
	return strings.Join(out, "\n")
}

func (r *LiveRegion) Update(spinnerText, streamText, statusText string) string {
	var b strings.Builder
	b.WriteString("spinner: ")
	b.WriteString(spinnerText)
	b.WriteString("\nstream: ")
	b.WriteString(streamText)
	b.WriteString("\nstatus: ")
	b.WriteString(statusText)
	b.WriteString("\n")
	b.WriteString(r.Compose())
	return b.String()
}

type Spinner struct {
	frames []string
	index  int
	ticker *time.Ticker
	done   chan bool
	text   string
}

func NewSpinner(text string) *Spinner {
	s := &Spinner{
		frames: []string{"-", "\\", "|", "/"},
		text:   text,
		done:   make(chan bool),
	}
	go s.tick()
	return s
}

func (s *Spinner) tick() {
	s.ticker = time.NewTicker(100 * time.Millisecond)
	defer s.ticker.Stop()
	for {
		select {
		case <-s.done:
			return
		case <-s.ticker.C:
			s.index = (s.index + 1) % len(s.frames)
		}
	}
}

func (s *Spinner) Frame() string {
	if s.ticker == nil {
		return s.frames[0]
	}
	select {
	case <-s.done:
		return s.frames[0]
	default:
		return s.frames[s.index]
	}
}

func (s *Spinner) Stop() {
	close(s.done)
}
