package wire

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/Misaka477/Natalia-Cli/internal/display"
)

type EventType string

const (
	EventTurnBegin       EventType = "TurnBegin"
	EventTurnEnd         EventType = "TurnEnd"
	EventStepBegin       EventType = "StepBegin"
	EventStepInterrupted EventType = "StepInterrupted"
	EventCompactionBegin EventType = "CompactionBegin"
	EventCompactionEnd   EventType = "CompactionEnd"
	EventStatusUpdate    EventType = "StatusUpdate"
	EventContentPart     EventType = "ContentPart"
	EventToolCall        EventType = "ToolCall"
	EventToolResult      EventType = "ToolResult"
	EventSubagentEvent   EventType = "SubagentEvent"
	EventNotification    EventType = "Notification"
)

type RequestType string

const (
	RequestApproval RequestType = "ApprovalRequest"
	RequestQuestion RequestType = "QuestionRequest"
	RequestToolCall RequestType = "ToolCallRequest"
	RequestHook     RequestType = "HookRequest"
)

type MessageKind string

const (
	MessageEvent   MessageKind = "event"
	MessageRequest MessageKind = "request"
)

type ContentType string

const (
	ContentText  ContentType = "text"
	ContentThink ContentType = "think"
)

type WireEvent struct {
	Type    EventType       `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type WireRequest struct {
	ID      string          `json:"id"`
	Type    RequestType     `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type WireMessage struct {
	Kind    MessageKind  `json:"kind"`
	Event   *WireEvent   `json:"event,omitempty"`
	Request *WireRequest `json:"request,omitempty"`
}

type Wire struct {
	SoulSide *WireSoulSide
	uiSide   *WireUISide
	raw      *broadcastQueue
	merged   *broadcastQueue
	pending  *pendingResponses
	sinks    *syncSinks
}

type WireSoulSide struct {
	wire *Wire
}

type WireUISide struct {
	wire *Wire
}

type TurnBegin struct {
	UserInput json.RawMessage `json:"user_input,omitempty"`
}

type TurnEnd struct{}

type StepBegin struct {
	N int `json:"n"`
}

type StepInterrupted struct{}

type CompactionBegin struct{}

type CompactionEnd struct{}

type StatusUpdate struct {
	ContextUsage      *float64 `json:"context_usage,omitempty"`
	ContextTokens     *int     `json:"context_tokens,omitempty"`
	MaxContextTokens  *int     `json:"max_context_tokens,omitempty"`
	PlanMode          *bool    `json:"plan_mode,omitempty"`
	TurnRunning       *bool    `json:"turn_running,omitempty"`
	TurnElapsedMS     *int64   `json:"turn_elapsed_ms,omitempty"`
	Mode              string   `json:"mode,omitempty"`
	ModelProfile      string   `json:"model_profile,omitempty"`
	PermissionProfile string   `json:"permission_profile,omitempty"`
	Provider          string   `json:"provider,omitempty"`
	Model             string   `json:"model,omitempty"`
}

type ContentPart struct {
	Type ContentType `json:"type"`
	Text string      `json:"text"`
}

type TextPart struct {
	Text string `json:"text"`
}

type ThinkPart struct {
	Text string `json:"text"`
}

type ToolCall struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments,omitempty"`
}

type ToolResult struct {
	ToolCallID string          `json:"tool_call_id"`
	Name       string          `json:"name"`
	Content    string          `json:"content"`
	Display    []display.Block `json:"display,omitempty"`
	Error      string          `json:"error,omitempty"`
}

type SubagentEvent struct {
	ID      string          `json:"id"`
	Event   string          `json:"event"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type Notification struct {
	Title   string `json:"title"`
	Message string `json:"message"`
}

type ApprovalRequest struct {
	ID          string `json:"id"`
	ToolCallID  string `json:"tool_call_id,omitempty"`
	Action      string `json:"action"`
	Description string `json:"description"`
}

type ApprovalResponse struct {
	RequestID string `json:"request_id"`
	Response  string `json:"response"`
}

type QuestionItem struct {
	Name     string   `json:"name"`
	Question string   `json:"question"`
	Options  []string `json:"options,omitempty"`
	Multiple bool     `json:"multiple,omitempty"`
}

type QuestionRequest struct {
	ID        string         `json:"id"`
	Questions []QuestionItem `json:"questions"`
}

type QuestionResponse struct {
	RequestID string            `json:"request_id"`
	Answers   map[string]string `json:"answers"`
}

type ToolCallRequest struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments,omitempty"`
}

type HookRequest struct {
	ID             string         `json:"id"`
	SubscriptionID string         `json:"subscription_id"`
	Event          string         `json:"event"`
	Target         string         `json:"target"`
	InputData      map[string]any `json:"input_data,omitempty"`
}

func NewEvent(eventType EventType, payload any) (WireEvent, error) {
	raw, err := marshalPayload(payload)
	if err != nil {
		return WireEvent{}, err
	}
	return WireEvent{Type: eventType, Payload: raw}, nil
}

func NewRequest(id string, requestType RequestType, payload any) (WireRequest, error) {
	raw, err := marshalPayload(payload)
	if err != nil {
		return WireRequest{}, err
	}
	return WireRequest{ID: id, Type: requestType, Payload: raw}, nil
}

func NewWire() *Wire {
	w := &Wire{
		raw:     newBroadcastQueue(),
		merged:  newBroadcastQueue(),
		pending: newPendingResponses(),
		sinks:   newSyncSinks(),
	}
	w.SoulSide = &WireSoulSide{wire: w}
	w.uiSide = &WireUISide{wire: w}
	return w
}

func (w *Wire) UISide() *WireUISide {
	return w.uiSide
}

func (s *WireSoulSide) PublishEvent(event WireEvent) {
	s.publish(WireMessage{Kind: MessageEvent, Event: &event})
}

func (s *WireSoulSide) PublishRequest(request WireRequest) {
	s.publish(WireMessage{Kind: MessageRequest, Request: &request})
}

func (s *WireSoulSide) Request(ctx context.Context, request WireRequest) (json.RawMessage, error) {
	if request.ID == "" {
		return nil, fmt.Errorf("wire request id is required")
	}
	wait := s.wire.pending.register(request.ID)
	s.PublishRequest(request)
	select {
	case result := <-wait:
		return result, nil
	case <-ctx.Done():
		s.wire.pending.cancel(request.ID)
		return nil, ctx.Err()
	}
}

func (w *Wire) ResolveResponse(id string, result json.RawMessage) bool {
	return w.pending.resolve(id, result)
}

func (w *Wire) AddSink(fn func(WireMessage)) func() {
	return w.sinks.add(fn)
}

func (s *WireSoulSide) publish(message WireMessage) {
	s.wire.raw.publish(message)
	s.wire.merged.publish(message)
	s.wire.sinks.publish(message)
}

func (u *WireUISide) SubscribeRaw() (<-chan WireMessage, func()) {
	return u.wire.raw.subscribe()
}

func (u *WireUISide) SubscribeMerged() (<-chan WireMessage, func()) {
	return u.wire.merged.subscribe()
}

func marshalPayload(payload any) (json.RawMessage, error) {
	if payload == nil {
		return nil, nil
	}
	if raw, ok := payload.(json.RawMessage); ok {
		return raw, nil
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return data, nil
}

type broadcastQueue struct {
	mu          sync.Mutex
	subscribers map[chan WireMessage]struct{}
}

type pendingResponses struct {
	mu      sync.Mutex
	pending map[string]chan json.RawMessage
}

type syncSinks struct {
	mu     sync.Mutex
	nextID int
	sinks  map[int]func(WireMessage)
}

func newSyncSinks() *syncSinks {
	return &syncSinks{sinks: make(map[int]func(WireMessage))}
}

func (s *syncSinks) add(fn func(WireMessage)) func() {
	s.mu.Lock()
	id := s.nextID
	s.nextID++
	s.sinks[id] = fn
	s.mu.Unlock()
	return func() {
		s.mu.Lock()
		delete(s.sinks, id)
		s.mu.Unlock()
	}
}

func (s *syncSinks) publish(message WireMessage) {
	s.mu.Lock()
	sinks := make([]func(WireMessage), 0, len(s.sinks))
	for _, sink := range s.sinks {
		sinks = append(sinks, sink)
	}
	s.mu.Unlock()
	for _, sink := range sinks {
		sink(message)
	}
}

func newPendingResponses() *pendingResponses {
	return &pendingResponses{pending: make(map[string]chan json.RawMessage)}
}

func (p *pendingResponses) register(id string) <-chan json.RawMessage {
	p.mu.Lock()
	defer p.mu.Unlock()
	ch := make(chan json.RawMessage, 1)
	p.pending[id] = ch
	return ch
}

func (p *pendingResponses) resolve(id string, result json.RawMessage) bool {
	p.mu.Lock()
	ch, ok := p.pending[id]
	if ok {
		delete(p.pending, id)
	}
	p.mu.Unlock()
	if !ok {
		return false
	}
	ch <- result
	close(ch)
	return true
}

func (p *pendingResponses) cancel(id string) {
	p.mu.Lock()
	if ch, ok := p.pending[id]; ok {
		delete(p.pending, id)
		close(ch)
	}
	p.mu.Unlock()
}

func newBroadcastQueue() *broadcastQueue {
	return &broadcastQueue{subscribers: make(map[chan WireMessage]struct{})}
}

func (q *broadcastQueue) subscribe() (<-chan WireMessage, func()) {
	ch := make(chan WireMessage, 16)
	q.mu.Lock()
	q.subscribers[ch] = struct{}{}
	q.mu.Unlock()
	cancel := func() {
		q.mu.Lock()
		if _, ok := q.subscribers[ch]; ok {
			delete(q.subscribers, ch)
			close(ch)
		}
		q.mu.Unlock()
	}
	return ch, cancel
}

func (q *broadcastQueue) publish(message WireMessage) {
	q.mu.Lock()
	defer q.mu.Unlock()
	for ch := range q.subscribers {
		select {
		case ch <- message:
		default:
		}
	}
}
