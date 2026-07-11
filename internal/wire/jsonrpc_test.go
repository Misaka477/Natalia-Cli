package wire

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestMarshalEvent(t *testing.T) {
	event, err := NewEvent(EventContentPart, ContentPart{Type: ContentText, Text: "hello"})
	if err != nil {
		t.Fatal(err)
	}
	data, err := MarshalEvent(event)
	if err != nil {
		t.Fatalf("MarshalEvent failed: %v", err)
	}
	var msg RPCMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("unmarshal rpc failed: %v", err)
	}
	if msg.JSONRPC != JSONRPCVersion || msg.Method != MethodEvent || len(msg.ID) != 0 {
		t.Fatalf("unexpected rpc event: %+v", msg)
	}
	var params TypedPayload
	if err := json.Unmarshal(msg.Params, &params); err != nil {
		t.Fatalf("unmarshal params failed: %v", err)
	}
	if params.Type != string(EventContentPart) {
		t.Fatalf("expected ContentPart, got %q", params.Type)
	}
	var part ContentPart
	if err := json.Unmarshal(params.Payload, &part); err != nil {
		t.Fatalf("unmarshal payload failed: %v", err)
	}
	if part.Text != "hello" {
		t.Fatalf("expected hello, got %q", part.Text)
	}
}

func TestMarshalRequest(t *testing.T) {
	req, err := NewRequest("req_123", RequestQuestion, QuestionRequest{ID: "req_123", Questions: []QuestionItem{{Name: "choice", Question: "Pick"}}})
	if err != nil {
		t.Fatal(err)
	}
	data, err := MarshalRequest(req)
	if err != nil {
		t.Fatalf("MarshalRequest failed: %v", err)
	}
	var msg RPCMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("unmarshal rpc failed: %v", err)
	}
	if msg.Method != MethodRequest || string(msg.ID) != `"req_123"` {
		t.Fatalf("unexpected request wrapper: %+v", msg)
	}
	var params TypedPayload
	if err := json.Unmarshal(msg.Params, &params); err != nil {
		t.Fatalf("unmarshal params failed: %v", err)
	}
	if params.Type != string(RequestQuestion) {
		t.Fatalf("expected QuestionRequest, got %q", params.Type)
	}
}

func TestUnmarshalIncoming(t *testing.T) {
	incoming, err := UnmarshalIncoming([]byte(`{"jsonrpc":"2.0","method":"prompt","id":"prompt_1","params":{"user_input":"hi"}}`))
	if err != nil {
		t.Fatalf("UnmarshalIncoming failed: %v", err)
	}
	if incoming.Method != MethodPrompt || string(incoming.ID) != `"prompt_1"` {
		t.Fatalf("unexpected incoming message: %+v", incoming)
	}
	params, err := DecodeParams[PromptParams](incoming.Params)
	if err != nil {
		t.Fatalf("DecodeParams failed: %v", err)
	}
	if params.UserInput != "hi" {
		t.Fatalf("expected user input hi, got %q", params.UserInput)
	}
}

func TestUnmarshalIncomingRejectsInvalidVersion(t *testing.T) {
	_, err := UnmarshalIncoming([]byte(`{"jsonrpc":"1.0","method":"prompt"}`))
	if err == nil || !strings.Contains(err.Error(), "invalid jsonrpc") {
		t.Fatalf("expected invalid version error, got %v", err)
	}
}

func TestMarshalResultAndError(t *testing.T) {
	result, err := MarshalResult(json.RawMessage(`"1"`), map[string]string{"status": "ok"})
	if err != nil {
		t.Fatalf("MarshalResult failed: %v", err)
	}
	if !strings.Contains(string(result), `"status":"ok"`) {
		t.Fatalf("unexpected result: %s", result)
	}
	errMsg, err := MarshalError(json.RawMessage(`"1"`), ErrorInvalidParams, "bad params", nil)
	if err != nil {
		t.Fatalf("MarshalError failed: %v", err)
	}
	if !strings.Contains(string(errMsg), `"code":-32602`) {
		t.Fatalf("unexpected error: %s", errMsg)
	}
}
