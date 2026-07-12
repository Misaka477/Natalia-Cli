package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

func TestMCPClientTalksToRealStdioServer(t *testing.T) {
	client := startStubServer(t)
	defer client.Close()
	if err := client.Initialize(context.Background()); err != nil {
		t.Fatal(err)
	}
	tools, err := client.ListTools(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(tools) != 1 || tools[0].Name != "echo" || tools[0].InputSchema["type"] != "object" {
		t.Fatalf("unexpected tools: %+v", tools)
	}
	result, err := client.CallTool(context.Background(), "echo", map[string]any{"text": "hello"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Content) != 1 || result.Content[0]["text"] != "hello" {
		t.Fatalf("unexpected call result: %+v", result)
	}
}

func TestMCPClientReturnsServerError(t *testing.T) {
	client := startStubServer(t)
	defer client.Close()
	_, err := client.CallTool(context.Background(), "missing", nil)
	if err == nil || err.Error() == "" {
		t.Fatalf("expected server error, got %v", err)
	}
}

func startStubServer(t *testing.T) *Client {
	t.Helper()
	cmd := os.Args[0]
	client, err := Start(context.Background(), ServerConfig{Command: cmd, Args: []string{"-test.run=TestMCPStubServer", "--", "mcp-stub"}, TimeoutSec: 2})
	if err != nil {
		t.Fatal(err)
	}
	return client
}

func TestMCPStubServer(t *testing.T) {
	if len(os.Args) == 0 || os.Args[len(os.Args)-1] != "mcp-stub" {
		return
	}
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		var req rpcRequest
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			continue
		}
		resp := rpcResponse{JSONRPC: "2.0", ID: req.ID}
		switch req.Method {
		case "initialize":
			resp.Result = mustJSON(map[string]any{"protocolVersion": "2024-11-05"})
		case "tools/list":
			resp.Result = mustJSON(map[string]any{"tools": []Tool{{Name: "echo", Description: "Echo input", InputSchema: map[string]any{"type": "object"}}}})
		case "tools/call":
			var params struct {
				Name      string         `json:"name"`
				Arguments map[string]any `json:"arguments"`
			}
			_ = json.Unmarshal(mustJSON(req.Params), &params)
			if params.Name != "echo" {
				resp.Error = &rpcError{Code: -32601, Message: "unknown tool"}
			} else {
				resp.Result = mustJSON(CallResult{Content: []map[string]any{{"type": "text", "text": params.Arguments["text"]}}})
			}
		default:
			resp.Error = &rpcError{Code: -32601, Message: "unknown method"}
		}
		raw, _ := json.Marshal(resp)
		fmt.Println(string(raw))
	}
	os.Exit(0)
}

func mustJSON(v any) json.RawMessage {
	raw, _ := json.Marshal(v)
	return raw
}
