package llm

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aquama/natalia-cli/internal/chat"
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
