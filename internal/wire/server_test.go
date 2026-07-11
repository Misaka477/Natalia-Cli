package wire

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestServerInitialize(t *testing.T) {
	in := strings.NewReader(`{"jsonrpc":"2.0","method":"initialize","id":"init_1","params":{"client_name":"test"}}` + "\n")
	out := &bytes.Buffer{}
	server := NewServer(NewWire(), in, out, ServerHandler{})

	if err := server.Run(context.Background()); err != nil {
		t.Fatalf("Run failed: %v", err)
	}

	msgs := decodeRPCOutput(t, out.String())
	if len(msgs) != 1 {
		t.Fatalf("expected one response, got %d: %s", len(msgs), out.String())
	}
	if string(msgs[0].ID) != `"init_1"` || msgs[0].Error != nil {
		t.Fatalf("unexpected initialize response: %+v", msgs[0])
	}
	var result map[string]string
	if err := json.Unmarshal(msgs[0].Result, &result); err != nil {
		t.Fatal(err)
	}
	if result["status"] != "ok" {
		t.Fatalf("expected ok result, got %v", result)
	}
}

func TestServerPromptHandlerPublishesEvents(t *testing.T) {
	w := NewWire()
	in := strings.NewReader(`{"jsonrpc":"2.0","method":"prompt","id":"prompt_1","params":{"user_input":"hi"}}` + "\n")
	out := &bytes.Buffer{}
	server := NewServer(w, in, out, ServerHandler{
		Prompt: func(ctx context.Context, params PromptParams) (any, error) {
			if params.UserInput != "hi" {
				t.Fatalf("expected prompt hi, got %q", params.UserInput)
			}
			event, err := NewEvent(EventTurnBegin, TurnBegin{UserInput: json.RawMessage(`"hi"`)})
			if err != nil {
				t.Fatal(err)
			}
			w.SoulSide.PublishEvent(event)
			return map[string]any{"status": "accepted"}, nil
		},
	})

	if err := server.Run(context.Background()); err != nil {
		t.Fatalf("Run failed: %v", err)
	}

	msgs := decodeRPCOutput(t, out.String())
	if len(msgs) != 2 {
		t.Fatalf("expected event and response, got %d: %s", len(msgs), out.String())
	}
	if !hasRPCMethod(msgs, MethodEvent) || !hasRPCID(msgs, `"prompt_1"`) {
		t.Fatalf("expected event and prompt response, got %+v", msgs)
	}
	if msgs[0].Method != MethodEvent || string(msgs[1].ID) != `"prompt_1"` {
		t.Fatalf("expected event before prompt response, got %+v", msgs)
	}
}

func TestServerUnknownMethodReturnsJSONRPCError(t *testing.T) {
	in := strings.NewReader(`{"jsonrpc":"2.0","method":"missing","id":"bad_1"}` + "\n")
	out := &bytes.Buffer{}
	server := NewServer(NewWire(), in, out, ServerHandler{})

	if err := server.Run(context.Background()); err != nil {
		t.Fatalf("Run failed: %v", err)
	}

	msgs := decodeRPCOutput(t, out.String())
	if len(msgs) != 1 || msgs[0].Error == nil {
		t.Fatalf("expected one error response, got %+v", msgs)
	}
	if msgs[0].Error.Code != ErrorMethodNotFound {
		t.Fatalf("expected method-not-found error, got %+v", msgs[0].Error)
	}
}

func decodeRPCOutput(t *testing.T, output string) []RPCMessage {
	t.Helper()
	lines := strings.Split(strings.TrimSpace(output), "\n")
	msgs := make([]RPCMessage, 0, len(lines))
	for _, line := range lines {
		if line == "" {
			continue
		}
		var msg RPCMessage
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			t.Fatalf("decode line %q: %v", line, err)
		}
		msgs = append(msgs, msg)
	}
	return msgs
}

func hasRPCMethod(msgs []RPCMessage, method string) bool {
	for _, msg := range msgs {
		if msg.Method == method {
			return true
		}
	}
	return false
}

func hasRPCID(msgs []RPCMessage, id string) bool {
	for _, msg := range msgs {
		if string(msg.ID) == id {
			return true
		}
	}
	return false
}
