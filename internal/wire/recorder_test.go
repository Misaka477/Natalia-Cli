package wire

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestRecorderRecordsAndReplaysMessages(t *testing.T) {
	var buf bytes.Buffer
	recorder := NewRecorder(&buf)
	event, err := NewEvent(EventContentPart, ContentPart{Type: ContentText, Text: "hello"})
	if err != nil {
		t.Fatal(err)
	}
	req, err := NewRequest("req_1", RequestApproval, ApprovalRequest{ID: "req_1", Action: "write_file"})
	if err != nil {
		t.Fatal(err)
	}

	if err := recorder.Record(WireMessage{Kind: MessageEvent, Event: &event}); err != nil {
		t.Fatalf("Record event failed: %v", err)
	}
	if err := recorder.Record(WireMessage{Kind: MessageRequest, Request: &req}); err != nil {
		t.Fatalf("Record request failed: %v", err)
	}

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected two jsonl records, got %d: %s", len(lines), buf.String())
	}
	for _, line := range lines {
		var recorded RecordedMessage
		if err := json.Unmarshal([]byte(line), &recorded); err != nil {
			t.Fatalf("record is not valid JSON: %v", err)
		}
		if recorded.At.IsZero() {
			t.Fatal("expected recorded timestamp")
		}
	}

	messages, err := Replay(strings.NewReader(buf.String()))
	if err != nil {
		t.Fatalf("Replay failed: %v", err)
	}
	if len(messages) != 2 {
		t.Fatalf("expected two replayed messages, got %d", len(messages))
	}
	if messages[0].Kind != MessageEvent || messages[0].Event == nil || messages[0].Event.Type != EventContentPart {
		t.Fatalf("unexpected replayed event: %+v", messages[0])
	}
	if messages[1].Kind != MessageRequest || messages[1].Request == nil || messages[1].Request.ID != "req_1" {
		t.Fatalf("unexpected replayed request: %+v", messages[1])
	}
}

func TestRecorderAttachRecordsPublishedWireMessages(t *testing.T) {
	var buf bytes.Buffer
	w := NewWire()
	detach := NewRecorder(&buf).Attach(w)
	defer detach()

	event, err := NewEvent(EventTurnEnd, TurnEnd{})
	if err != nil {
		t.Fatal(err)
	}
	w.RuntimeSide.PublishEvent(event)

	messages, err := Replay(strings.NewReader(buf.String()))
	if err != nil {
		t.Fatalf("Replay failed: %v", err)
	}
	if len(messages) != 1 || messages[0].Event == nil || messages[0].Event.Type != EventTurnEnd {
		t.Fatalf("expected recorded TurnEnd, got %+v", messages)
	}
}

func TestRecorderRedactsSecretsBeforePersisting(t *testing.T) {
	var buf bytes.Buffer
	recorder := NewRecorder(&buf)
	event, err := NewEvent(EventToolResult, ToolResult{Name: "run_shell", Content: "token=tool-secret safe=ok"})
	if err != nil {
		t.Fatal(err)
	}
	if err := recorder.Record(WireMessage{Kind: MessageEvent, Event: &event}); err != nil {
		t.Fatal(err)
	}
	text := buf.String()
	if strings.Contains(text, "tool-secret") || !strings.Contains(text, "[redacted]") || !strings.Contains(text, "safe=ok") {
		t.Fatalf("expected redacted wire record, got %s", text)
	}
	messages, err := Replay(strings.NewReader(text))
	if err != nil || len(messages) != 1 {
		t.Fatalf("expected redacted replayable message, messages=%+v err=%v", messages, err)
	}
}

func TestReplayRejectsInvalidJSONL(t *testing.T) {
	_, err := Replay(strings.NewReader("not-json\n"))
	if err == nil || !strings.Contains(err.Error(), "line 1") {
		t.Fatalf("expected line-specific replay error, got %v", err)
	}
}
