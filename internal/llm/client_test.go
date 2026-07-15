package llm

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
)

func TestChatRequestIncludesReasoningConfig(t *testing.T) {
	requestBody := make(chan ChatRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read body failed: %v", err)
		}
		var req ChatRequest
		if err := json.Unmarshal(body, &req); err != nil {
			t.Errorf("unmarshal request failed: %v", err)
		}
		requestBody <- req
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"ok"}}],"usage":{"total_tokens":1}}`))
	}))
	defer server.Close()

	client := NewClient(Config{
		BaseURL:         server.URL,
		Model:           "test-model",
		ReasoningEffort: "high",
		ThinkingEnabled: true,
		Timeout:         time.Second,
	})
	_, _, err := client.Chat(context.Background(), chat.NewContext(100, 10), nil, false)
	if err != nil {
		t.Fatalf("Chat failed: %v", err)
	}

	req := <-requestBody
	if req.ReasoningEffort != "high" {
		t.Fatalf("expected reasoning_effort high, got %q", req.ReasoningEffort)
	}
	if !req.ThinkingEnabled {
		t.Fatal("expected thinking_enabled true")
	}
}

func TestChatRequestOmitsNullRequired(t *testing.T) {
	body, err := json.Marshal(ChatRequest{Messages: []chat.Message{
		{Role: chat.RoleSystem, Content: "system"},
		{Role: chat.RoleUser, Content: "hello"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), `"required":null`) {
		t.Fatalf("required should not be null: %s", string(body))
	}
}

func TestChatStreamStopsOnCancellation(t *testing.T) {
	requestStarted := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		close(requestStarted)
		<-r.Context().Done()
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Timeout: time.Second})
	ctx, cancel := context.WithCancel(context.Background())
	events := client.ChatStream(ctx, chat.NewContext(100, 10), nil)
	<-requestStarted
	cancel()

	select {
	case event, ok := <-events:
		if !ok {
			t.Fatal("expected cancellation event")
		}
		if !errors.Is(event.Error, context.Canceled) {
			t.Fatalf("expected context cancellation, got %v", event.Error)
		}
	case <-time.After(time.Second):
		t.Fatal("stream did not stop after cancellation")
	}
}

func TestChatReturnsAPIErrorForNon200Responses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"error":"upstream down"}`))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	_, _, err := client.Chat(context.Background(), chat.NewContext(100, 10), nil, false)
	if err == nil || !strings.Contains(err.Error(), "API error 502") || !strings.Contains(err.Error(), "upstream down") {
		t.Fatalf("expected API error with response body, got %v", err)
	}
}

func TestChatStreamReturnsAPIErrorForNon200Responses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`rate limited`))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	events := client.ChatStream(context.Background(), chat.NewContext(100, 10), nil)
	event, ok := <-events
	if !ok || event.Error == nil || !strings.Contains(event.Error.Error(), "API error 429") || !strings.Contains(event.Error.Error(), "rate limited") {
		t.Fatalf("expected streaming API error event, ok=%v event=%+v", ok, event)
	}
}

func TestChatStreamParsesCompactDataLinesAndLongChunks(t *testing.T) {
	long := strings.Repeat("x", 70*1024)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte(`data:{"choices":[{"delta":{"reasoning_content":"thinking"}}]}` + "\n"))
		_, _ = w.Write([]byte(`data: {"choices":[{"delta":{"content":"` + long + `"}}]}` + "\n"))
		_, _ = w.Write([]byte("data:[DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	events := client.ChatStream(context.Background(), chat.NewContext(100, 10), nil)
	var content strings.Builder
	var reasoning strings.Builder
	done := false
	for event := range events {
		if event.Error != nil {
			t.Fatalf("unexpected stream error: %v", event.Error)
		}
		content.WriteString(event.Content)
		reasoning.WriteString(event.Reasoning)
		done = done || event.Done
	}
	if !done || reasoning.String() != "thinking" || content.String() != long {
		t.Fatalf("unexpected stream parse: done=%t reasoning_len=%d content_len=%d", done, reasoning.Len(), content.Len())
	}
}

func TestChatStreamMethodErrorsOnEmptyAssistantResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	msg, _, err := client.Chat(context.Background(), chat.NewContext(100, 10), nil, true)
	if err == nil || !strings.Contains(err.Error(), "empty assistant response") || msg != nil {
		t.Fatalf("expected empty assistant response error, msg=%+v err=%v", msg, err)
	}
}

func TestChatStreamContentDeltasNoDuplicate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"hel\"}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"finish_reason\":\"stop\"}]}\n"))
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	msg, _, err := client.Chat(context.Background(), chat.NewContext(100, 10), nil, true)
	if err != nil {
		t.Fatalf("Chat stream failed: %v", err)
	}
	if msg.Content != "hello world" {
		t.Fatalf("expected concatenated content, got %q", msg.Content)
	}
}

func TestChatStreamReasoningContentInterleaved(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"thinking\"}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"hi\"}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"reasoning_content\":\" more\"}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\" there\"}}]}\n"))
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	events := client.ChatStream(context.Background(), chat.NewContext(100, 10), nil)
	var content, reasoning []string
	for ev := range events {
		if ev.Error != nil {
			t.Fatalf("stream error: %v", ev.Error)
		}
		if ev.Content != "" {
			content = append(content, ev.Content)
		}
		if ev.Reasoning != "" {
			reasoning = append(reasoning, ev.Reasoning)
		}
	}
	if strings.Join(content, "") != "hi there" {
		t.Fatalf("expected interleaved content, got %v", content)
	}
	if strings.Join(reasoning, "") != "thinking more" {
		t.Fatalf("expected interleaved reasoning, got %v", reasoning)
	}
}

func TestChatStreamSingleToolCallFragmented(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"read\"}}]}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"{\\\"path\\\":\"}}]}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"x\"}}]}}]}\n"))
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	events := client.ChatStream(context.Background(), chat.NewContext(100, 10), nil)
	var toolCalls []ToolCall
	for ev := range events {
		if ev.Error != nil {
			t.Fatalf("stream error: %v", ev)
		}
		toolCalls = append(toolCalls, ev.ToolCalls...)
	}
	if len(toolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(toolCalls))
	}
	if toolCalls[0].Function.Name != "read" {
		t.Fatalf("expected tool name read, got %s", toolCalls[0].Function.Name)
	}
	if toolCalls[0].Function.Arguments != `{"path":x` {
		t.Fatalf("expected concatenated arguments, got %s", toolCalls[0].Function.Arguments)
	}
}

func TestChatStreamMultipleToolCalls(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"a\"}}]}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":1,\"function\":{\"name\":\"b\"}}]}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"1\"}}]}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":1,\"function\":{\"arguments\":\"2\"}}]}}]}\n"))
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	events := client.ChatStream(context.Background(), chat.NewContext(100, 10), nil)
	var toolCalls []ToolCall
	for ev := range events {
		if ev.Error != nil {
			t.Fatalf("stream error: %v", ev.Error)
		}
		toolCalls = append(toolCalls, ev.ToolCalls...)
	}
	if len(toolCalls) != 2 {
		t.Fatalf("expected 2 tool calls, got %d: %+v", len(toolCalls), toolCalls)
	}
	if toolCalls[0].Function.Name != "a" || toolCalls[1].Function.Name != "b" {
		t.Fatalf("expected tool names a,b, got %s,%s", toolCalls[0].Function.Name, toolCalls[1].Function.Name)
	}
}

func TestChatStreamOutOfOrderIndexStable(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":1,\"function\":{\"name\":\"b\"}}]}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"a\"}}]}}]}\n"))
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	events := client.ChatStream(context.Background(), chat.NewContext(100, 10), nil)
	var toolCalls []ToolCall
	for ev := range events {
		if ev.Error != nil {
			t.Fatalf("stream error: %v", ev.Error)
		}
		toolCalls = append(toolCalls, ev.ToolCalls...)
	}
	if len(toolCalls) != 2 {
		t.Fatalf("expected 2 tool calls, got %d", len(toolCalls))
	}
	if toolCalls[0].Function.Name != "a" || toolCalls[1].Function.Name != "b" {
		t.Fatalf("expected sorted tool names a,b, got %s,%s", toolCalls[0].Function.Name, toolCalls[1].Function.Name)
	}
}

func TestChatStreamFinishReasonVariants(t *testing.T) {
	for _, reason := range []string{"stop", "length", "tool_calls"} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("data: {\"choices\":[{\"finish_reason\":\"" + reason + "\"}]}\n"))
			_, _ = w.Write([]byte("data: [DONE]\n"))
		}))
		client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
		msg, usage, err := client.Chat(context.Background(), chat.NewContext(100, 10), nil, true)
		server.Close()
		if err != nil {
			t.Fatalf("finish_reason=%s stream failed: %v", reason, err)
		}
		if msg == nil || usage == nil {
			t.Fatalf("finish_reason=%s expected non-nil msg/usage", reason)
		}
	}
}

func TestChatStreamLastUsageChunkNonZero(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"hi\"}}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":1,\"total_tokens\":6}}\n"))
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	_, usage, err := client.Chat(context.Background(), chat.NewContext(100, 10), nil, true)
	if err != nil {
		t.Fatalf("stream failed: %v", err)
	}
	if usage.TotalTokens == 0 {
		t.Fatalf("expected non-zero usage from stream, got %+v", usage)
	}
}

func TestChatStreamEmptyDeltaAndUnknownFields(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"\",\"unknown\":123}}]}\n"))
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	_, _, err := client.Chat(context.Background(), chat.NewContext(100, 10), nil, true)
	if err == nil || !strings.Contains(err.Error(), "empty assistant response") {
		t.Fatalf("expected empty assistant response error, got %v", err)
	}
}

func TestChatStreamMalformedJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {invalid json}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n"))
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	msg, _, err := client.Chat(context.Background(), chat.NewContext(100, 10), nil, true)
	if err != nil {
		t.Fatalf("stream should not fail on malformed JSON, got %v", err)
	}
	if msg == nil || msg.Content != "ok" {
		t.Fatalf("expected ok content after malformed chunk, got %+v", msg)
	}
}

func TestChatStreamCompactAndSpacedDataPrefix(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data:{\"choices\":[{\"delta\":{\"content\":\"a\"}}]}\n"))
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"b\"}}]}\n"))
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	msg, _, err := client.Chat(context.Background(), chat.NewContext(100, 10), nil, true)
	if err != nil {
		t.Fatalf("stream failed: %v", err)
	}
	if msg.Content != "ab" {
		t.Fatalf("expected ab, got %s", msg.Content)
	}
}

func TestChatStreamDoneWithoutContent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	_, _, err := client.Chat(context.Background(), chat.NewContext(100, 10), nil, true)
	if err == nil || !strings.Contains(err.Error(), "empty assistant response") {
		t.Fatalf("expected empty assistant response error, got %v", err)
	}
}

func TestChatStreamOversizedEvent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		payload := strings.Repeat("x", 2*1024*1024)
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"" + payload + "\"}}]}\n"))
		_, _ = w.Write([]byte("data: [DONE]\n"))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	_, _, err := client.Chat(context.Background(), chat.NewContext(100, 10), nil, true)
	if err == nil || !strings.Contains(err.Error(), "read stream") {
		t.Fatalf("expected scanner error for oversized event, got %v", err)
	}
}

func TestChatStreamCancellationClosesBody(t *testing.T) {
	requestStarted := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		close(requestStarted)
		<-r.Context().Done()
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Model: "test", Timeout: time.Second})
	ctx, cancel := context.WithCancel(context.Background())
	events := client.ChatStream(ctx, chat.NewContext(100, 10), nil)
	<-requestStarted
	cancel()

	select {
	case event, ok := <-events:
		if !ok {
			t.Fatal("expected cancellation event")
		}
		if !errors.Is(event.Error, context.Canceled) {
			t.Fatalf("expected context canceled, got %v", event.Error)
		}
	case <-time.After(time.Second):
		t.Fatal("stream did not stop after cancellation")
	}
}
