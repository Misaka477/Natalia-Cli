package terminalui

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/wire"
)

func TestLiveViewRendersKimiStyleContentToolAndStatus(t *testing.T) {
	view := NewLiveViewWithOptions(LiveViewOptions{ReasoningDisplay: ReasoningStream})
	frames := dispatchEvent(t, view, wire.EventTurnBegin, wire.TurnBegin{})
	if len(frames) != 0 {
		t.Fatalf("turn begin should not render, got %+v", frames)
	}

	got := joinFrames(dispatchEvent(t, view, wire.EventStepBegin, wire.StepBegin{N: 1}))
	if !strings.Contains(got, "step 1") {
		t.Fatalf("expected step rule, got %q", got)
	}

	got = joinFrames(dispatchEvent(t, view, wire.EventContentPart, wire.ContentPart{Type: wire.ContentThink, Text: "visible reasoning"}))
	if !strings.Contains(got, "Thinking") || !strings.Contains(got, "visible reasoning") {
		t.Fatalf("expected thinking indicator with reasoning preview, got %q", got)
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

func TestLiveViewRedactsAndTruncatesToolFeedback(t *testing.T) {
	view := NewLiveView()
	got := joinFrames(dispatchEvent(t, view, wire.EventToolCall, wire.ToolCall{ID: "tc_secret", Name: "web_fetch", Arguments: json.RawMessage(`{"api_key":"secret-value","url":"https://example.com"}`)}))
	if strings.Contains(got, "secret-value") {
		t.Fatalf("tool call summary leaked secret argument: %q", got)
	}
	if !strings.Contains(got, "Using web_fetch") {
		t.Fatalf("expected tool call headline, got %q", got)
	}

	view = NewLiveView()
	got = joinFrames(dispatchEvent(t, view, wire.EventToolCall, wire.ToolCall{ID: "tc_token", Name: "custom_tool", Arguments: json.RawMessage(`{"token":"secret-token"}`)}))
	if strings.Contains(got, "secret-token") || !strings.Contains(got, "[redacted]") {
		t.Fatalf("tool call fallback summary should redact sensitive values, got %q", got)
	}

	longResult := "Bearer secret-token " + strings.Repeat("x", 2400)
	got = joinFrames(dispatchEvent(t, view, wire.EventToolResult, wire.ToolResult{ToolCallID: "tc_token", Name: "custom_tool", Content: longResult}))
	if strings.Contains(got, "secret-token") {
		t.Fatalf("tool result leaked secret content: %q", got)
	}
	if !strings.Contains(got, "Bearer [redacted]") {
		t.Fatalf("tool result should include redacted bearer token, got %q", got)
	}
	if len([]rune(got)) > 2300 {
		t.Fatalf("tool result should be truncated, got %d runes", len([]rune(got)))
	}
	if !strings.Contains(got, "...") {
		t.Fatalf("truncated tool result should indicate truncation, got %q", got)
	}
}

func TestLiveViewReasoningDisplayModes(t *testing.T) {
	summary := NewLiveViewWithOptions(LiveViewOptions{ReasoningDisplay: ReasoningSummary})
	got := joinFrames(dispatchEvent(t, summary, wire.EventContentPart, wire.ContentPart{Type: wire.ContentThink, Text: "hidden reasoning"}))
	if !strings.Contains(got, "Thinking") || strings.Contains(got, "hidden reasoning") {
		t.Fatalf("summary mode should hide raw reasoning, got %q", got)
	}

	preview := NewLiveViewWithOptions(LiveViewOptions{ReasoningDisplay: ReasoningPreview, ReasoningPreviewChars: 4})
	got = joinFrames(dispatchEvent(t, preview, wire.EventContentPart, wire.ContentPart{Type: wire.ContentThink, Text: "abcdef"}))
	if !strings.Contains(got, "abcd") || strings.Contains(got, "abcdef") {
		t.Fatalf("preview mode should truncate reasoning preview, got %q", got)
	}

	stream := NewLiveViewWithOptions(LiveViewOptions{ReasoningDisplay: ReasoningStream})
	got = joinFrames(dispatchEvent(t, stream, wire.EventContentPart, wire.ContentPart{Type: wire.ContentThink, Text: "full reasoning"}))
	if !strings.Contains(got, "full reasoning") {
		t.Fatalf("stream mode should render full reasoning delta, got %q", got)
	}
}

func TestLiveViewStreamsReasoningWithoutChunkNewlinesOrCJKSpaces(t *testing.T) {
	view := NewLiveViewWithOptions(LiveViewOptions{ReasoningDisplay: ReasoningStream})
	got := joinFrames(dispatchEvent(t, view, wire.EventContentPart, wire.ContentPart{Type: wire.ContentThink, Text: "用户"}))
	got += joinFrames(dispatchEvent(t, view, wire.EventContentPart, wire.ContentPart{Type: wire.ContentThink, Text: "\n"}))
	got += joinFrames(dispatchEvent(t, view, wire.EventContentPart, wire.ContentPart{Type: wire.ContentThink, Text: "要求"}))
	got += joinFrames(dispatchEvent(t, view, wire.EventContentPart, wire.ContentPart{Type: wire.ContentThink, Text: "："}))
	got += joinFrames(dispatchEvent(t, view, wire.EventContentPart, wire.ContentPart{Type: wire.ContentThink, Text: " start"}))
	got += joinFrames(dispatchEvent(t, view, wire.EventContentPart, wire.ContentPart{Type: wire.ContentThink, Text: " python"}))
	if !strings.Contains(got, "用户要求：start python") {
		t.Fatalf("expected normalized streamed reasoning, got %q", got)
	}
	if strings.Contains(got, "用户\n要求") || strings.Contains(got, "用户 要求") {
		t.Fatalf("reasoning chunks should not force newlines or spaces between CJK tokens, got %q", got)
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
