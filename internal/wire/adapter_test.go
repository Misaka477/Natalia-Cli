package wire

import (
	"encoding/json"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/presentation"
)

func TestToPresentationEvent_TurnBegin(t *testing.T) {
	cid := presentation.CorrelationID{Session: "s1", Turn: "t1"}
	evt := ToPresentationEvent(TurnBegin{UserInput: json.RawMessage(`"hello"`)}, cid)
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	if evt.Type != presentation.EvtTurnBegin {
		t.Fatalf("expected EvtTurnBegin, got %s", evt.Type)
	}
	if evt.CorrelationID != cid {
		t.Fatalf("expected correlation ID %+v, got %+v", cid, evt.CorrelationID)
	}
	data, ok := evt.Data.(presentation.TurnBeginPayload)
	if !ok {
		t.Fatal("expected TurnBeginPayload")
	}
	if data.Input != `"hello"` {
		t.Fatalf("expected input '\"hello\"', got %q", data.Input)
	}
}

func TestToPresentationEvent_TurnEnd(t *testing.T) {
	evt := ToPresentationEvent(TurnEnd{}, presentation.CorrelationID{Turn: "t1"})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	if evt.Type != presentation.EvtTurnEnd {
		t.Fatalf("expected EvtTurnEnd, got %s", evt.Type)
	}
}

func TestToPresentationEvent_StepBegin(t *testing.T) {
	evt := ToPresentationEvent(StepBegin{N: 3}, presentation.CorrelationID{})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	if evt.Type != presentation.EvtStepBegin {
		t.Fatalf("expected EvtStepBegin, got %s", evt.Type)
	}
}

func TestToPresentationEvent_ContentPart(t *testing.T) {
	evt := ToPresentationEvent(ContentPart{Type: ContentText, Text: "hello world"}, presentation.CorrelationID{})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	if evt.Type != presentation.EvtContentPart {
		t.Fatalf("expected EvtContentPart, got %s", evt.Type)
	}
	data, ok := evt.Data.(presentation.ContentPartPayload)
	if !ok {
		t.Fatal("expected ContentPartPayload")
	}
	if data.Content != "hello world" {
		t.Fatalf("unexpected content: %q", data.Content)
	}
	if data.IsThinking {
		t.Fatal("expected IsThinking=false for text content")
	}
}

func TestToPresentationEvent_ContentPartThink(t *testing.T) {
	evt := ToPresentationEvent(ContentPart{Type: ContentThink, Text: "reasoning"}, presentation.CorrelationID{})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	data, ok := evt.Data.(presentation.ContentPartPayload)
	if !ok {
		t.Fatal("expected ContentPartPayload")
	}
	if data.Content != "reasoning" {
		t.Fatalf("unexpected content: %q", data.Content)
	}
	if !data.IsThinking {
		t.Fatal("expected IsThinking=true for think content")
	}
}

func TestToPresentationEvent_ToolCall(t *testing.T) {
	args := json.RawMessage(`{"path":"main.go"}`)
	evt := ToPresentationEvent(ToolCall{ID: "tc1", Name: "read_file", Arguments: args}, presentation.CorrelationID{})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	if evt.Type != presentation.EvtToolBegin {
		t.Fatalf("expected EvtToolBegin, got %s", evt.Type)
	}
	data, ok := evt.Data.(presentation.ToolBeginPayload)
	if !ok {
		t.Fatal("expected ToolBeginPayload")
	}
	if data.Name != "read_file" {
		t.Fatalf("unexpected tool name: %q", data.Name)
	}
	if data.Arguments == nil || data.Arguments["path"] != "main.go" {
		t.Fatalf("unexpected arguments: %+v", data.Arguments)
	}
}

func TestToPresentationEvent_ToolResult(t *testing.T) {
	evt := ToPresentationEvent(ToolResult{ToolCallID: "tc1", Name: "read_file", Content: "file content"}, presentation.CorrelationID{})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	if evt.Type != presentation.EvtToolEnd {
		t.Fatalf("expected EvtToolEnd, got %s", evt.Type)
	}
	data, ok := evt.Data.(presentation.ToolEndPayload)
	if !ok {
		t.Fatal("expected ToolEndPayload")
	}
	if data.Result != "file content" || data.Error != "" {
		t.Fatalf("unexpected tool end payload: %+v", data)
	}
}

func TestToPresentationEvent_ToolResultWithError(t *testing.T) {
	evt := ToPresentationEvent(ToolResult{ToolCallID: "tc1", Name: "read_file", Error: "not found"}, presentation.CorrelationID{})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	data, ok := evt.Data.(presentation.ToolEndPayload)
	if !ok {
		t.Fatal("expected ToolEndPayload")
	}
	if data.Error != "not found" {
		t.Fatalf("expected error 'not found', got %q", data.Error)
	}
}

func TestToPresentationEvent_ApprovalRequest(t *testing.T) {
	evt := ToPresentationEvent(ApprovalRequest{ID: "ar1", Action: "write_file", Description: "Write to main.go"}, presentation.CorrelationID{})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	if evt.Type != presentation.EvtApprovalRequest {
		t.Fatalf("expected EvtApprovalRequest, got %s", evt.Type)
	}
	data, ok := evt.Data.(presentation.ApprovalRequestPayload)
	if !ok {
		t.Fatal("expected ApprovalRequestPayload")
	}
	if data.ID != "ar1" || data.ToolName != "write_file" {
		t.Fatalf("unexpected approval payload: %+v", data)
	}
}

func TestToPresentationEvent_ApprovalResult(t *testing.T) {
	evt := ToPresentationEvent(ApprovalResponse{RequestID: "ar1", Response: "approved"}, presentation.CorrelationID{})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	if evt.Type != presentation.EvtApprovalResult {
		t.Fatalf("expected EvtApprovalResult, got %s", evt.Type)
	}
	data, ok := evt.Data.(presentation.ApprovalResultPayload)
	if !ok {
		t.Fatal("expected ApprovalResultPayload")
	}
	if data.ID != "ar1" || !data.Approved {
		t.Fatalf("unexpected approval result payload: %+v", data)
	}
}

func TestToPresentationEvent_CompactionBegin(t *testing.T) {
	evt := ToPresentationEvent(CompactionBegin{}, presentation.CorrelationID{})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	if evt.Type != presentation.EvtCompactBegin {
		t.Fatalf("expected EvtCompactBegin, got %s", evt.Type)
	}
}

func TestToPresentationEvent_StatusUpdate(t *testing.T) {
	evt := ToPresentationEvent(StatusUpdate{Mode: "code"}, presentation.CorrelationID{})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	if evt.Type != presentation.EvtStatusUpdate {
		t.Fatalf("expected EvtStatusUpdate, got %s", evt.Type)
	}
	data, ok := evt.Data.(presentation.StatusUpdatePayload)
	if !ok {
		t.Fatal("expected StatusUpdatePayload")
	}
	if data.Key != "mode" || data.Value != "code" {
		t.Fatalf("unexpected status payload: %+v", data)
	}
}

func TestToPresentationEvent_Notification(t *testing.T) {
	evt := ToPresentationEvent(Notification{Title: "done", Message: "task complete"}, presentation.CorrelationID{})
	if evt == nil {
		t.Fatal("expected non-nil event")
	}
	if evt.Type != presentation.EvtNotification {
		t.Fatalf("expected EvtNotification, got %s", evt.Type)
	}
	data, ok := evt.Data.(presentation.NotificationPayload)
	if !ok {
		t.Fatal("expected NotificationPayload")
	}
	if data.Severity != "info" || data.Message != "task complete" {
		t.Fatalf("unexpected notification payload: %+v", data)
	}
}

func TestToPresentationEvent_UnknownTypeReturnsNil(t *testing.T) {
	evt := ToPresentationEvent("unknown string type", presentation.CorrelationID{})
	if evt != nil {
		t.Fatal("expected nil for unknown type")
	}
}

func TestToPresentationEvent_CompactionEndReturnsNil(t *testing.T) {
	evt := ToPresentationEvent(CompactionEnd{}, presentation.CorrelationID{})
	if evt != nil {
		t.Fatal("expected nil for compaction end (not mapped)")
	}
}

func TestToPresentationEvent_SubagentEventReturnsNil(t *testing.T) {
	evt := ToPresentationEvent(SubagentEvent{ID: "w1", Event: "log"}, presentation.CorrelationID{})
	if evt != nil {
		t.Fatal("expected nil for subagent event (not mapped)")
	}
}

func TestToPresentationEvent_ProcessEventReturnsNil(t *testing.T) {
	evt := ToPresentationEvent(ProcessEvent{ID: "p1", Event: "begin"}, presentation.CorrelationID{})
	if evt != nil {
		t.Fatal("expected nil for process event (not mapped)")
	}
}

func TestToPresentationEvent_InteractiveEventReturnsNil(t *testing.T) {
	evt := ToPresentationEvent(InteractiveEvent{ID: "i1", Event: "pty.begin"}, presentation.CorrelationID{})
	if evt != nil {
		t.Fatal("expected nil for interactive event (not mapped)")
	}
}
