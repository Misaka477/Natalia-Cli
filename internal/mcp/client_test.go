package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/networkpolicy"
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

func TestMCPStdioStripsInheritedSensitiveEnv(t *testing.T) {
	t.Setenv("NATALIA_TEST_API_KEY", "host-secret")
	client := startStubServer(t)
	defer client.Close()
	if err := client.Initialize(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got := client.ServerInfo()["env"]; got == "host-secret" {
		t.Fatalf("expected MCP subprocess env to strip sensitive inherited value, got %+v", client.ServerInfo())
	}
}

func TestMCPHTTPClientUsesJSONRPCAndBearerToken(t *testing.T) {
	var sawAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawAuth = r.Header.Get("Authorization")
		var req rpcRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		resp := rpcResponse{JSONRPC: "2.0", ID: req.ID}
		switch req.Method {
		case "initialize":
			resp.Result = mustJSON(map[string]any{"serverInfo": map[string]any{"name": "remote"}})
		case "tools/list":
			resp.Result = mustJSON(map[string]any{"tools": []Tool{{Name: "read", Description: "Read", InputSchema: map[string]any{"type": "object"}, Annotations: map[string]any{"readOnlyHint": true}}}})
		case "tools/call":
			resp.Result = mustJSON(CallResult{Content: []map[string]any{{"type": "text", "text": "remote-ok"}}})
		default:
			resp.Error = &rpcError{Code: -32601, Message: "unknown method"}
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()
	policy, err := networkpolicy.New(networkpolicy.Config{AllowLocalhost: true})
	if err != nil {
		t.Fatal(err)
	}
	client, err := Start(context.Background(), ServerConfig{URL: server.URL, Headers: map[string]string{"Authorization": "Bearer token"}, TimeoutSec: 2, Policy: policy})
	if err != nil {
		t.Fatal(err)
	}
	if err := client.Initialize(context.Background()); err != nil {
		t.Fatal(err)
	}
	tools, err := client.ListTools(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(tools) != 1 || tools[0].Annotations["readOnlyHint"] != true {
		t.Fatalf("unexpected remote tools: %+v", tools)
	}
	result, err := client.CallTool(context.Background(), "read", nil)
	if err != nil || result.Content[0]["text"] != "remote-ok" {
		t.Fatalf("unexpected remote call: result=%+v err=%v", result, err)
	}
	if sawAuth != "Bearer token" {
		t.Fatalf("expected bearer auth header, got %q", sawAuth)
	}
	stats := client.Stats()
	if stats.Transport != "http" || stats.Requests < 3 || stats.Errors != 0 {
		t.Fatalf("unexpected stats: %+v", stats)
	}
}

func TestMCPHTTPDefaultPolicyRejectsLocalhost(t *testing.T) {
	_, err := Start(context.Background(), ServerConfig{URL: "http://127.0.0.1:1234/mcp", TimeoutSec: 1})
	if err == nil || !strings.Contains(err.Error(), "network policy denied") || !strings.Contains(err.Error(), "loopback") {
		t.Fatalf("expected localhost rejection, got %v", err)
	}
}

func TestMCPHTTPRejectsRedirectToBlockedAddress(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://169.254.169.254/latest/meta-data/", http.StatusTemporaryRedirect)
	}))
	defer server.Close()
	policy, err := networkpolicy.New(networkpolicy.Config{AllowLocalhost: true})
	if err != nil {
		t.Fatal(err)
	}
	client, err := Start(context.Background(), ServerConfig{URL: server.URL, TimeoutSec: 2, Policy: policy})
	if err != nil {
		t.Fatal(err)
	}
	err = client.Initialize(context.Background())
	if err == nil || !strings.Contains(err.Error(), "169.254.169.254") || !strings.Contains(err.Error(), "link-local") {
		t.Fatalf("expected redirect rejection, got %v", err)
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
			resp.Result = mustJSON(map[string]any{"protocolVersion": "2024-11-05", "env": os.Getenv("NATALIA_TEST_API_KEY")})
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
