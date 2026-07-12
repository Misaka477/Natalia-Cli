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

func TestContentPartTypes(t *testing.T) {
	text := ContentPart{Type: ContentText, Text: "hello"}
	think := ContentPart{Type: ContentThink, Text: "reasoning"}
	if text.Type != "text" || think.Type != "think" {
		t.Fatalf("unexpected content types: %+v %+v", text, think)
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
