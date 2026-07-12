package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
)

type ToolDef struct {
	Type     string   `json:"type"`
	Function Function `json:"function"`
}

type Function struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Parameters  Parameters `json:"parameters"`
}

type Parameters struct {
	Type       string              `json:"type"`
	Properties map[string]Property `json:"properties"`
	Required   []string            `json:"required"`
}

type Property struct {
	Type        string   `json:"type"`
	Description string   `json:"description"`
	Enum        []string `json:"enum,omitempty"`
}

type ChatRequest struct {
	Model           string         `json:"model"`
	Messages        []chat.Message `json:"messages"`
	Tools           []ToolDef      `json:"tools,omitempty"`
	MaxTokens       int            `json:"max_tokens,omitempty"`
	Temperature     float64        `json:"temperature,omitempty"`
	TopP            float64        `json:"top_p,omitempty"`
	Stream          bool           `json:"stream,omitempty"`
	ReasoningEffort string         `json:"reasoning_effort,omitempty"`
	ThinkingEnabled bool           `json:"thinking_enabled,omitempty"`
}

type ChatResponse struct {
	ID      string   `json:"id"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

type Choice struct {
	Index   int          `json:"index"`
	Message chat.Message `json:"message"`
}

type Delta struct {
	Content          string     `json:"content,omitempty"`
	Reasoning        string     `json:"reasoning,omitempty"`
	ReasoningContent string     `json:"reasoning_content,omitempty"`
	Role             string     `json:"role,omitempty"`
	ToolCalls        []ToolCall `json:"tool_calls,omitempty"`
}

type Chunk struct {
	ID      string        `json:"id"`
	Choices []ChunkChoice `json:"choices"`
	Usage   *Usage        `json:"usage,omitempty"`
}

type ChunkChoice struct {
	Index        int    `json:"index"`
	Delta        Delta  `json:"delta"`
	FinishReason string `json:"finish_reason,omitempty"`
}

type ToolCall struct {
	ID       string       `json:"id,omitempty"`
	Type     string       `json:"type,omitempty"`
	Function ToolCallFunc `json:"function,omitempty"`
	Index    int          `json:"index,omitempty"`
}

type ToolCallFunc struct {
	Name      string `json:"name,omitempty"`
	Arguments string `json:"arguments,omitempty"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type StreamEvent struct {
	Content   string
	Reasoning string // reasoning/thinking content
	ToolCalls []ToolCall
	Done      bool
	Error     error
}

type Client struct {
	apiKey          string
	baseURL         string
	model           string
	temperature     float64
	maxTokens       int
	topP            float64
	reasoningEffort string
	thinkingEnabled bool
	authHeader      string
	customHeaders   map[string]string
	http            *http.Client
}

type Config struct {
	APIKey          string
	BaseURL         string
	Model           string
	Temperature     float64
	MaxTokens       int
	TopP            float64
	ReasoningEffort string
	ThinkingEnabled bool
	AuthHeader      string
	CustomHeaders   map[string]string
	Timeout         time.Duration
	Stream          bool
}

func NewClient(cfg Config) *Client {
	if cfg.Timeout == 0 {
		cfg.Timeout = 5 * time.Minute
	}
	if cfg.Temperature == 0 {
		cfg.Temperature = 0.0
	}
	if cfg.MaxTokens == 0 {
		cfg.MaxTokens = 8192
	}
	if cfg.TopP == 0 {
		cfg.TopP = 1.0
	}
	if cfg.AuthHeader == "" {
		cfg.AuthHeader = "Authorization"
	}
	if cfg.CustomHeaders == nil {
		cfg.CustomHeaders = make(map[string]string)
	}
	return &Client{
		apiKey:          cfg.APIKey,
		baseURL:         cfg.BaseURL,
		model:           cfg.Model,
		temperature:     cfg.Temperature,
		maxTokens:       cfg.MaxTokens,
		topP:            cfg.TopP,
		reasoningEffort: cfg.ReasoningEffort,
		thinkingEnabled: cfg.ThinkingEnabled,
		authHeader:      cfg.AuthHeader,
		customHeaders:   cfg.CustomHeaders,
		http:            &http.Client{Timeout: cfg.Timeout},
	}
}

func (c *Client) Model() string {
	if c == nil {
		return ""
	}
	return c.model
}

func (c *Client) Chat(ctx context.Context, chatCtx *chat.Context, tools []ToolDef, stream bool) (*chat.Message, *Usage, error) {
	req := ChatRequest{
		Model:           c.model,
		Messages:        chatCtx.Messages,
		Tools:           tools,
		MaxTokens:       c.maxTokens,
		Temperature:     c.temperature,
		TopP:            c.topP,
		Stream:          stream,
		ReasoningEffort: c.reasoningEffort,
		ThinkingEnabled: c.thinkingEnabled,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL, bytes.NewReader(body))
	if err != nil {
		return nil, nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set(c.authHeader, "Bearer "+c.apiKey)
	for k, v := range c.customHeaders {
		httpReq.Header.Set(k, v)
	}

	if !stream {
		httpReq.Header.Set("Accept", "application/json")
		return c.chatSync(httpReq)
	}
	httpReq.Header.Set("Accept", "text/event-stream")
	return c.chatStream(httpReq)
}

func (c *Client) ChatStream(ctx context.Context, chatCtx *chat.Context, tools []ToolDef) <-chan StreamEvent {
	ch := make(chan StreamEvent)

	go func() {
		defer close(ch)

		req := ChatRequest{
			Model:           c.model,
			Messages:        chatCtx.Messages,
			Tools:           tools,
			MaxTokens:       c.maxTokens,
			Temperature:     c.temperature,
			TopP:            c.topP,
			Stream:          true,
			ReasoningEffort: c.reasoningEffort,
			ThinkingEnabled: c.thinkingEnabled,
		}

		body, err := json.Marshal(req)
		if err != nil {
			ch <- StreamEvent{Error: fmt.Errorf("marshal request: %w", err)}
			return
		}

		httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL, bytes.NewReader(body))
		if err != nil {
			ch <- StreamEvent{Error: fmt.Errorf("create request: %w", err)}
			return
		}
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Accept", "text/event-stream")
		httpReq.Header.Set(c.authHeader, "Bearer "+c.apiKey)
		for k, v := range c.customHeaders {
			httpReq.Header.Set(k, v)
		}

		resp, err := c.http.Do(httpReq)
		if err != nil {
			ch <- StreamEvent{Error: fmt.Errorf("request failed: %w", err)}
			return
		}
		defer resp.Body.Close()
		stopCancelWatch := make(chan struct{})
		defer close(stopCancelWatch)
		go func() {
			select {
			case <-ctx.Done():
				_ = resp.Body.Close()
			case <-stopCancelWatch:
			}
		}()

		if resp.StatusCode != 200 {
			body, _ := io.ReadAll(resp.Body)
			ch <- StreamEvent{Error: fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))}
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		var toolCallAccum map[int]*ToolCall
		var streamDone bool
		for scanner.Scan() {
			if err := ctx.Err(); err != nil {
				ch <- StreamEvent{Error: err}
				return
			}
			line := scanner.Text()

			if !strings.HasPrefix(line, "data: ") {
				continue
			}

			data := strings.TrimPrefix(line, "data: ")

			if data == "[DONE]" {
				streamDone = true
				break
			}

			var chunk Chunk
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				continue
			}

			for _, choice := range chunk.Choices {
				if choice.Delta.Content != "" {
					ch <- StreamEvent{Content: choice.Delta.Content}
				}
				r := choice.Delta.Reasoning
				if r == "" {
					r = choice.Delta.ReasoningContent
				}
				if r != "" {
					ch <- StreamEvent{Reasoning: r}
				}
				if len(choice.Delta.ToolCalls) > 0 {
					if toolCallAccum == nil {
						toolCallAccum = make(map[int]*ToolCall)
					}
					for _, tc := range choice.Delta.ToolCalls {
						idx := tc.Index
						if existing, ok := toolCallAccum[idx]; ok {
							if tc.Function.Name != "" {
								existing.Function.Name = tc.Function.Name
							}
							if tc.Function.Arguments != "" {
								existing.Function.Arguments += tc.Function.Arguments
							}
						} else {
							tcCopy := tc
							toolCallAccum[idx] = &tcCopy
						}
					}
				}
			}
		}

		if len(toolCallAccum) > 0 {
			tcs := make([]ToolCall, 0, len(toolCallAccum))
			for i := 0; i < len(toolCallAccum); i++ {
				if tc, ok := toolCallAccum[i]; ok {
					tcs = append(tcs, *tc)
				}
			}
			ch <- StreamEvent{ToolCalls: tcs}
		}

		if err := scanner.Err(); err != nil {
			if ctx.Err() != nil {
				ch <- StreamEvent{Error: ctx.Err()}
				return
			}
			ch <- StreamEvent{Error: fmt.Errorf("read stream: %w", err)}
			return
		}
		if err := ctx.Err(); err != nil {
			ch <- StreamEvent{Error: err}
			return
		}
		if streamDone {
			ch <- StreamEvent{Done: true}
			return
		}
		ch <- StreamEvent{Done: true}
	}()

	return ch
}

func (c *Client) chatSync(httpReq *http.Request) (*chat.Message, *Usage, error) {
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != 200 {
		return nil, nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBody))
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return nil, nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return nil, nil, fmt.Errorf("no choices in response")
	}

	return &chatResp.Choices[0].Message, &chatResp.Usage, nil
}

func (c *Client) chatStream(httpReq *http.Request) (*chat.Message, *Usage, error) {
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	ctx := httpReq.Context()
	stopCancelWatch := make(chan struct{})
	defer close(stopCancelWatch)
	go func() {
		select {
		case <-ctx.Done():
			_ = resp.Body.Close()
		case <-stopCancelWatch:
		}
	}()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	msg := chat.Message{Role: chat.RoleAssistant}
	var usage *Usage
	var contentBuf strings.Builder
	var currentToolCalls []chat.ToolCall
	toolCallMap := make(map[int]*chat.ToolCall)

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		if err := ctx.Err(); err != nil {
			return nil, nil, err
		}
		line := scanner.Text()

		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")

		if data == "[DONE]" {
			break
		}

		var chunk Chunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if chunk.Usage != nil {
			usage = chunk.Usage
		}

		for _, choice := range chunk.Choices {
			if choice.Delta.Content != "" {
				contentBuf.WriteString(choice.Delta.Content)
			}

			for _, tc := range choice.Delta.ToolCalls {
				idx := tc.Index
				if existing, ok := toolCallMap[idx]; ok {
					if tc.Function.Name != "" {
						existing.Function.Name = tc.Function.Name
					}
					if tc.Function.Arguments != "" {
						existing.Function.Arguments += tc.Function.Arguments
					}
				} else {
					newTC := chat.ToolCall{
						ID:   tc.ID,
						Type: tc.Type,
					}
					newTC.Function.Name = tc.Function.Name
					newTC.Function.Arguments = tc.Function.Arguments
					toolCallMap[idx] = &newTC
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		if ctx.Err() != nil {
			return nil, nil, ctx.Err()
		}
		return nil, nil, fmt.Errorf("read stream: %w", err)
	}

	msg.Content = contentBuf.String()
	for i := 0; i < len(toolCallMap); i++ {
		if tc, ok := toolCallMap[i]; ok {
			currentToolCalls = append(currentToolCalls, *tc)
		}
	}
	if len(currentToolCalls) > 0 {
		msg.ToolCalls = currentToolCalls
	}

	if usage == nil {
		usage = &Usage{}
	}

	return &msg, usage, nil
}
