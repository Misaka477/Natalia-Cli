package wire

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/display"
)

func TestNewEvent(t *testing.T) {
	event, err := NewEvent(EventStepBegin, StepBegin{N: 3})
	if err != nil {
		t.Fatalf("NewEvent failed: %v", err)
	}
	if event.Type != EventStepBegin {
		t.Fatalf("expected StepBegin, got %q", event.Type)
	}
	var payload StepBegin
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		t.Fatalf("unmarshal payload failed: %v", err)
	}
	if payload.N != 3 {
		t.Fatalf("expected step 3, got %d", payload.N)
	}
}

func TestNewRequest(t *testing.T) {
	req, err := NewRequest("req_1", RequestApproval, ApprovalRequest{ID: "req_1", Action: "run_shell", Description: "run tests"})
	if err != nil {
		t.Fatalf("NewRequest failed: %v", err)
	}
	if req.ID != "req_1" || req.Type != RequestApproval {
		t.Fatalf("unexpected request: %+v", req)
	}
	var payload ApprovalRequest
	if err := json.Unmarshal(req.Payload, &payload); err != nil {
		t.Fatalf("unmarshal payload failed: %v", err)
	}
	if payload.Action != "run_shell" || payload.Description != "run tests" {
		t.Fatalf("unexpected approval payload: %+v", payload)
	}
}

func TestContentPartEventRoundTrip(t *testing.T) {
	for _, part := range []ContentPart{
		{Type: ContentText, Text: "hello"},
		{Type: ContentThink, Text: "reasoning"},
	} {
		event, err := NewEvent(EventContentPart, part)
		if err != nil {
			t.Fatalf("NewEvent failed: %v", err)
		}
		var payload ContentPart
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			t.Fatalf("unmarshal content payload failed: %v", err)
		}
		if payload != part {
			t.Fatalf("content part did not round-trip: got %+v want %+v", payload, part)
		}
	}
}

func TestToolResultIncludesDisplayBlocks(t *testing.T) {
	block, err := display.NewBlock(display.BlockShell, "tests", display.ShellBlock{Command: "go test ./...", Output: "ok"})
	if err != nil {
		t.Fatal(err)
	}
	event, err := NewEvent(EventToolResult, ToolResult{ToolCallID: "tc_1", Name: "run_shell", Content: "tests passed", Display: []display.Block{block}})
	if err != nil {
		t.Fatalf("NewEvent failed: %v", err)
	}
	var payload ToolResult
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		t.Fatalf("unmarshal payload failed: %v", err)
	}
	if len(payload.Display) != 1 || payload.Display[0].Type != display.BlockShell || payload.Content != "tests passed" {
		t.Fatalf("unexpected tool result payload: %+v", payload)
	}
}

func TestSubagentAndNotificationEventsRoundTrip(t *testing.T) {
	sub, err := NewEvent(EventSubagentEvent, SubagentEvent{ID: "w1", Event: "log", Payload: json.RawMessage(`{"event":"log"}`)})
	if err != nil {
		t.Fatalf("NewEvent subagent failed: %v", err)
	}
	var subPayload SubagentEvent
	if err := json.Unmarshal(sub.Payload, &subPayload); err != nil {
		t.Fatalf("unmarshal subagent payload: %v", err)
	}
	if subPayload.ID != "w1" || subPayload.Event != "log" || string(subPayload.Payload) != `{"event":"log"}` {
		t.Fatalf("unexpected subagent payload: %+v", subPayload)
	}
	notif, err := NewEvent(EventNotification, Notification{Title: "done", Message: "background complete"})
	if err != nil {
		t.Fatalf("NewEvent notification failed: %v", err)
	}
	var notifPayload Notification
	if err := json.Unmarshal(notif.Payload, &notifPayload); err != nil {
		t.Fatalf("unmarshal notification payload: %v", err)
	}
	if notifPayload.Title != "done" || notifPayload.Message != "background complete" {
		t.Fatalf("unexpected notification payload: %+v", notifPayload)
	}
}

func TestAllWireEventTypesRoundTrip(t *testing.T) {
	cases := []struct {
		typ     EventType
		payload any
	}{
		{EventTurnBegin, TurnBegin{UserInput: json.RawMessage(`"hi"`)}},
		{EventTurnEnd, TurnEnd{}},
		{EventStepBegin, StepBegin{N: 1}},
		{EventStepInterrupted, StepInterrupted{}},
		{EventCompactionBegin, CompactionBegin{}},
		{EventCompactionEnd, CompactionEnd{}},
		{EventStatusUpdate, StatusUpdate{Mode: "code"}},
		{EventContentPart, ContentPart{Type: ContentText, Text: "hello"}},
		{EventToolCall, ToolCall{ID: "tc_1", Name: "read_file", Arguments: json.RawMessage(`{"path":"README.md"}`)}},
		{EventToolResult, ToolResult{ToolCallID: "tc_1", Name: "read_file", Content: "ok"}},
		{EventSubagentEvent, SubagentEvent{ID: "worker_1", Event: "log", Payload: json.RawMessage(`{"status":"running"}`)}},
		{EventNotification, Notification{Title: "done", Message: "complete"}},
	}
	for _, tc := range cases {
		t.Run(string(tc.typ), func(t *testing.T) {
			event, err := NewEvent(tc.typ, tc.payload)
			if err != nil {
				t.Fatal(err)
			}
			data, err := MarshalWireMessage(WireMessage{Kind: MessageEvent, Event: &event})
			if err != nil {
				t.Fatal(err)
			}
			var rpc RPCMessage
			if err := json.Unmarshal(data, &rpc); err != nil {
				t.Fatal(err)
			}
			var typed TypedPayload
			if err := json.Unmarshal(rpc.Params, &typed); err != nil {
				t.Fatal(err)
			}
			if rpc.Method != MethodEvent || typed.Type != string(tc.typ) || len(typed.Payload) == 0 && tc.payload != nil {
				t.Fatalf("unexpected event round-trip: rpc=%+v typed=%+v", rpc, typed)
			}
		})
	}
}

func TestAllWireRequestTypesRoundTrip(t *testing.T) {
	cases := []struct {
		typ     RequestType
		payload any
	}{
		{RequestApproval, ApprovalRequest{ID: "approval_1", Action: "run_shell", Description: "go test"}},
		{RequestQuestion, QuestionRequest{ID: "question_1", Questions: []QuestionItem{{Name: "choice", Question: "Proceed?"}}}},
		{RequestToolCall, ToolCallRequest{ID: "tool_1", Name: "external", Arguments: json.RawMessage(`{"ok":true}`)}},
		{RequestHook, HookRequest{ID: "hook_1", Event: "PreToolUse", Target: "read_file"}},
	}
	for _, tc := range cases {
		t.Run(string(tc.typ), func(t *testing.T) {
			req, err := NewRequest("req_1", tc.typ, tc.payload)
			if err != nil {
				t.Fatal(err)
			}
			data, err := MarshalWireMessage(WireMessage{Kind: MessageRequest, Request: &req})
			if err != nil {
				t.Fatal(err)
			}
			var rpc RPCMessage
			if err := json.Unmarshal(data, &rpc); err != nil {
				t.Fatal(err)
			}
			var typed TypedPayload
			if err := json.Unmarshal(rpc.Params, &typed); err != nil {
				t.Fatal(err)
			}
			if rpc.Method != MethodRequest || string(rpc.ID) != `"req_1"` || typed.Type != string(tc.typ) {
				t.Fatalf("unexpected request round-trip: rpc=%+v typed=%+v", rpc, typed)
			}
		})
	}
}

func TestWireBroadcastsSoulMessagesToSubscribers(t *testing.T) {
	w := NewWire()
	rawA, cancelRawA := w.UISide().SubscribeRaw()
	defer cancelRawA()
	rawB, cancelRawB := w.UISide().SubscribeRaw()
	defer cancelRawB()
	merged, cancelMerged := w.UISide().SubscribeMerged()
	defer cancelMerged()

	event, err := NewEvent(EventTurnBegin, TurnBegin{UserInput: json.RawMessage(`"hello"`)})
	if err != nil {
		t.Fatal(err)
	}
	w.SoulSide.PublishEvent(event)

	for name, ch := range map[string]<-chan WireMessage{"rawA": rawA, "rawB": rawB, "merged": merged} {
		msg := receiveWireMessage(t, name, ch)
		if msg.Kind != MessageEvent || msg.Event == nil || msg.Event.Type != EventTurnBegin {
			t.Fatalf("%s received unexpected message: %+v", name, msg)
		}
	}
}

func TestSubscribeMergedCoalescesConsecutiveContentParts(t *testing.T) {
	w := NewWire()
	ch, cancel := w.UISide().SubscribeMerged()
	defer cancel()

	publishContentForTest(t, w, ContentText, "hello")
	publishContentForTest(t, w, ContentText, " world")
	publishEventForTest(t, w, EventTurnEnd, TurnEnd{})

	part := receiveContentPart(t, "merged content", ch)
	if part.Type != ContentText || part.Text != "hello world" {
		t.Fatalf("expected merged text content, got %+v", part)
	}
	msg := receiveWireMessage(t, "turn end", ch)
	if msg.Event == nil || msg.Event.Type != EventTurnEnd {
		t.Fatalf("expected TurnEnd after content flush, got %+v", msg)
	}
}

func TestSubscribeMergedFlushesOnContentTypeSwitch(t *testing.T) {
	w := NewWire()
	ch, cancel := w.UISide().SubscribeMerged()
	defer cancel()

	publishContentForTest(t, w, ContentText, "answer")
	publishContentForTest(t, w, ContentThink, "reasoning")
	publishEventForTest(t, w, EventTurnEnd, TurnEnd{})

	text := receiveContentPart(t, "text", ch)
	if text.Type != ContentText || text.Text != "answer" {
		t.Fatalf("expected text part before reasoning, got %+v", text)
	}
	think := receiveContentPart(t, "think", ch)
	if think.Type != ContentThink || think.Text != "reasoning" {
		t.Fatalf("expected reasoning part after type switch, got %+v", think)
	}
	msg := receiveWireMessage(t, "turn end", ch)
	if msg.Event == nil || msg.Event.Type != EventTurnEnd {
		t.Fatalf("expected TurnEnd after reasoning flush, got %+v", msg)
	}
}

func TestSubscribeMergedPassesRequestsAfterFlushingContent(t *testing.T) {
	w := NewWire()
	ch, cancel := w.UISide().SubscribeMerged()
	defer cancel()

	publishContentForTest(t, w, ContentText, "before approval")
	req, err := NewRequest("req_1", RequestApproval, ApprovalRequest{ID: "req_1", Action: "write_file"})
	if err != nil {
		t.Fatal(err)
	}
	w.SoulSide.PublishRequest(req)

	part := receiveContentPart(t, "flushed content", ch)
	if part.Text != "before approval" {
		t.Fatalf("expected content before request, got %+v", part)
	}
	msg := receiveWireMessage(t, "request", ch)
	if msg.Request == nil || msg.Request.ID != "req_1" {
		t.Fatalf("expected request after flushed content, got %+v", msg)
	}
}

func TestWireBroadcastsRequests(t *testing.T) {
	w := NewWire()
	ch, cancel := w.UISide().SubscribeRaw()
	defer cancel()

	req, err := NewRequest("req_1", RequestApproval, ApprovalRequest{ID: "req_1", Action: "run_shell"})
	if err != nil {
		t.Fatal(err)
	}
	w.SoulSide.PublishRequest(req)

	msg := receiveWireMessage(t, "raw", ch)
	if msg.Kind != MessageRequest || msg.Request == nil || msg.Request.ID != "req_1" || msg.Request.Type != RequestApproval {
		t.Fatalf("received unexpected request message: %+v", msg)
	}
}

func TestWireSoulSideRequestWaitsForResponse(t *testing.T) {
	w := NewWire()
	requests, cancel := w.UISide().SubscribeRaw()
	defer cancel()
	req, err := NewRequest("req_1", RequestApproval, ApprovalRequest{ID: "req_1", Action: "write_file"})
	if err != nil {
		t.Fatal(err)
	}
	resultCh := make(chan json.RawMessage, 1)
	errCh := make(chan error, 1)
	go func() {
		result, err := w.SoulSide.Request(context.Background(), req)
		if err != nil {
			errCh <- err
			return
		}
		resultCh <- result
	}()
	msg := receiveWireMessage(t, "request", requests)
	if msg.Request == nil || msg.Request.ID != "req_1" {
		t.Fatalf("expected request publication, got %+v", msg)
	}
	if ok := w.ResolveResponse("req_1", json.RawMessage(`{"request_id":"req_1","response":"approve"}`)); !ok {
		t.Fatal("expected pending response to resolve")
	}
	select {
	case err := <-errCh:
		t.Fatalf("Request failed: %v", err)
	case result := <-resultCh:
		var resp ApprovalResponse
		if err := json.Unmarshal(result, &resp); err != nil {
			t.Fatal(err)
		}
		if resp.Response != "approve" {
			t.Fatalf("unexpected response: %+v", resp)
		}
	case <-time.After(time.Second):
		t.Fatal("request did not receive response")
	}
}

func receiveWireMessage(t *testing.T, name string, ch <-chan WireMessage) WireMessage {
	t.Helper()
	select {
	case msg := <-ch:
		return msg
	case <-time.After(time.Second):
		t.Fatalf("%s subscriber did not receive message", name)
		return WireMessage{}
	}
}

func receiveContentPart(t *testing.T, name string, ch <-chan WireMessage) ContentPart {
	t.Helper()
	msg := receiveWireMessage(t, name, ch)
	if msg.Event == nil || msg.Event.Type != EventContentPart {
		t.Fatalf("expected ContentPart event, got %+v", msg)
	}
	var part ContentPart
	if err := json.Unmarshal(msg.Event.Payload, &part); err != nil {
		t.Fatalf("unmarshal content part: %v", err)
	}
	return part
}

func publishContentForTest(t *testing.T, w *Wire, typ ContentType, text string) {
	t.Helper()
	publishEventForTest(t, w, EventContentPart, ContentPart{Type: typ, Text: text})
}

func publishEventForTest(t *testing.T, w *Wire, typ EventType, payload any) {
	t.Helper()
	event, err := NewEvent(typ, payload)
	if err != nil {
		t.Fatalf("NewEvent(%s) failed: %v", typ, err)
	}
	w.SoulSide.PublishEvent(event)
}
