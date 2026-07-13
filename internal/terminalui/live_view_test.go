package terminalui

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/wire"
)

func TestLiveViewRendersKimiStyleContentToolAndStatus(t *testing.T) {
	view := NewLiveView()
	frames := dispatchEvent(t, view, wire.EventTurnBegin, wire.TurnBegin{})
	if len(frames) != 0 {
		t.Fatalf("turn begin should not render, got %+v", frames)
	}

	got := joinFrames(dispatchEvent(t, view, wire.EventStepBegin, wire.StepBegin{N: 1}))
	if !strings.Contains(got, "step 1") {
		t.Fatalf("expected step rule, got %q", got)
	}

	got = joinFrames(dispatchEvent(t, view, wire.EventContentPart, wire.ContentPart{Type: wire.ContentThink, Text: "hidden reasoning"}))
	if !strings.Contains(got, "Thinking") {
		t.Fatalf("expected compact thinking indicator, got %q", got)
	}
	if strings.Contains(got, "hidden reasoning") {
		t.Fatalf("thinking indicator should not leak raw reasoning, got %q", got)
	}

	got = joinFrames(dispatchEvent(t, view, wire.EventContentPart, wire.ContentPart{Type: wire.ContentText, Text: "answer"}))
	if !strings.Contains(got, "Thought for") || !strings.Contains(got, "* answer") {
		t.Fatalf("expected thought summary and streamed answer, got %q", got)
	}

	got = joinFrames(dispatchEvent(t, view, wire.EventToolCall, wire.ToolCall{ID: "tc_1", Name: "read_file", Arguments: json.RawMessage(`{"path":"README.md"}`)}))
	if !strings.Contains(got, "Using read_file") || !strings.Contains(got, "README.md") {
		t.Fatalf("expected using tool headline, got %q", got)
	}

	diffBlock, err := display.NewBlock(display.BlockDiff, "file diff", display.DiffBlock{Path: "README.md", Diff: "@@\n-old\n+new"})
	if err != nil {
		t.Fatal(err)
	}
	got = joinFrames(dispatchEvent(t, view, wire.EventToolResult, wire.ToolResult{ToolCallID: "tc_1", Name: "read_file", Content: "ok", Display: []display.Block{diffBlock}}))
	if !strings.Contains(got, "Used read_file") || !strings.Contains(got, "ok") || !strings.Contains(got, "Diff") || !strings.Contains(got, "@@") {
		t.Fatalf("expected used tool block with diff, got %q", got)
	}

	running := false
	elapsed := int64(2200)
	tokens := 42
	maxTokens := 1000
	got = joinFrames(dispatchEvent(t, view, wire.EventStatusUpdate, wire.StatusUpdate{TurnRunning: &running, TurnElapsedMS: &elapsed, Mode: "code", Model: "step-3.7-flash", ContextTokens: &tokens, MaxContextTokens: &maxTokens}))
	for _, want := range []string{"elapsed 2s", "mode code", "model step-3.7-flash", "ctx 42/1000"} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected status to contain %q, got %q", want, got)
		}
	}
}

func TestLiveViewRendersApprovalAndQuestionPanels(t *testing.T) {
	view := NewLiveView()
	approval, err := wire.NewRequest("approval_1", wire.RequestApproval, wire.ApprovalRequest{ID: "approval_1", Action: "run_shell", Description: "go test ./..."})
	if err != nil {
		t.Fatal(err)
	}
	got := joinFrames(view.Dispatch(wire.WireMessage{Kind: wire.MessageRequest, Request: &approval}))
	for _, want := range []string{"Approval required", "run_shell", "go test ./...", "approve once"} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected approval panel to contain %q, got %q", want, got)
		}
	}

	question, err := wire.NewRequest("question_1", wire.RequestQuestion, wire.QuestionRequest{ID: "question_1", Questions: []wire.QuestionItem{{Name: "choice", Question: "Proceed?", Options: []string{"yes", "no"}, Fallback: "no"}}})
	if err != nil {
		t.Fatal(err)
	}
	got = joinFrames(view.Dispatch(wire.WireMessage{Kind: wire.MessageRequest, Request: &question}))
	for _, want := range []string{"Question", "choice: Proceed?", "1. yes", "2. no", "fallback: no"} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected question panel to contain %q, got %q", want, got)
		}
	}
}

func dispatchEvent(t *testing.T, view *LiveView, typ wire.EventType, payload any) []Frame {
	t.Helper()
	event, err := wire.NewEvent(typ, payload)
	if err != nil {
		t.Fatal(err)
	}
	return view.Dispatch(wire.WireMessage{Kind: wire.MessageEvent, Event: &event})
}

func joinFrames(frames []Frame) string {
	var b strings.Builder
	for _, frame := range frames {
		b.WriteString(frame.Text)
	}
	return b.String()
}
