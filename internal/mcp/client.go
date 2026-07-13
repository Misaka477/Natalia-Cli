package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/networkpolicy"
	"github.com/Misaka477/Natalia-Cli/internal/secret"
)

type ServerConfig struct {
	Command    string
	Args       []string
	Cwd        string
	URL        string
	Headers    map[string]string
	TimeoutSec int
	Policy     *networkpolicy.Policy
}

type Client struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	scanner *bufio.Scanner
	mu      sync.Mutex
	nextID  uint64
	timeout time.Duration
	httpURL string
	headers map[string]string
	http    *http.Client
	policy  *networkpolicy.Policy
	info    map[string]any
	started time.Time
	stats   ClientStats
}

type Tool struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	InputSchema map[string]any `json:"inputSchema,omitempty"`
	Annotations map[string]any `json:"annotations,omitempty"`
}

type CallResult struct {
	Content []map[string]any `json:"content,omitempty"`
	IsError bool             `json:"isError,omitempty"`
}

type ClientStats struct {
	Transport string
	StartedAt time.Time
	Requests  uint64
	Errors    uint64
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      uint64 `json:"id"`
	Method  string `json:"method"`
	Params  any    `json:"params,omitempty"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      uint64          `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func Start(ctx context.Context, cfg ServerConfig) (*Client, error) {
	if cfg.URL != "" {
		return StartHTTP(ctx, cfg)
	}
	if cfg.Command == "" {
		return nil, fmt.Errorf("mcp command is required")
	}
	cmd := exec.CommandContext(ctx, cfg.Command, cfg.Args...)
	cmd.Dir = cfg.Cwd
	cmd.Env = secret.SanitizedEnv()
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	timeout := time.Duration(cfg.TimeoutSec) * time.Second
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &Client{cmd: cmd, stdin: stdin, scanner: bufio.NewScanner(stdout), timeout: timeout, started: time.Now(), stats: ClientStats{Transport: "stdio", StartedAt: time.Now()}}, nil
}

func StartHTTP(ctx context.Context, cfg ServerConfig) (*Client, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("mcp url is required")
	}
	timeout := time.Duration(cfg.TimeoutSec) * time.Second
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	now := time.Now()
	policy := cfg.Policy
	if policy == nil {
		policy = networkpolicy.Default()
	}
	if err := policy.ValidateURL(ctx, cfg.URL); err != nil {
		return nil, err
	}
	return &Client{timeout: timeout, httpURL: cfg.URL, headers: copyHeaders(cfg.Headers), http: policy.HTTPClient(timeout), policy: policy, started: now, stats: ClientStats{Transport: "http", StartedAt: now}}, nil
}

func (c *Client) Close() error {
	if c == nil || c.cmd == nil || c.cmd.Process == nil {
		return nil
	}
	_ = c.stdin.Close()
	_ = c.cmd.Process.Kill()
	_ = c.cmd.Wait()
	return nil
}

func (c *Client) Initialize(ctx context.Context) error {
	var result map[string]any
	if err := c.call(ctx, "initialize", map[string]any{"protocolVersion": "2024-11-05", "clientInfo": map[string]any{"name": "natalia-cli", "version": "dev"}}, &result); err != nil {
		return err
	}
	c.mu.Lock()
	c.info = cloneMap(result)
	c.mu.Unlock()
	return nil
}

func (c *Client) ServerInfo() map[string]any {
	if c == nil {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return cloneMap(c.info)
}

func (c *Client) Stats() ClientStats {
	if c == nil {
		return ClientStats{}
	}
	stats := c.stats
	stats.Requests = atomic.LoadUint64(&c.stats.Requests)
	stats.Errors = atomic.LoadUint64(&c.stats.Errors)
	return stats
}

func (c *Client) Ping(ctx context.Context) error {
	return c.call(ctx, "ping", nil, nil)
}

func (c *Client) ListTools(ctx context.Context) ([]Tool, error) {
	var result struct {
		Tools []Tool `json:"tools"`
	}
	if err := c.call(ctx, "tools/list", nil, &result); err != nil {
		return nil, err
	}
	return result.Tools, nil
}

func (c *Client) CallTool(ctx context.Context, name string, arguments map[string]any) (*CallResult, error) {
	var result CallResult
	err := c.call(ctx, "tools/call", map[string]any{"name": name, "arguments": arguments}, &result)
	return &result, err
}

func (c *Client) call(ctx context.Context, method string, params any, out any) error {
	if c == nil {
		return fmt.Errorf("mcp client is nil")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	callCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()
	id := atomic.AddUint64(&c.nextID, 1)
	atomic.AddUint64(&c.stats.Requests, 1)
	req := rpcRequest{JSONRPC: "2.0", ID: id, Method: method, Params: params}
	if c.httpURL != "" {
		return c.callHTTP(callCtx, req, out)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	raw, err := json.Marshal(req)
	if err != nil {
		atomic.AddUint64(&c.stats.Errors, 1)
		return err
	}
	if _, err := c.stdin.Write(append(raw, '\n')); err != nil {
		atomic.AddUint64(&c.stats.Errors, 1)
		return err
	}
	respCh := make(chan rpcResponse, 1)
	errCh := make(chan error, 1)
	go func() {
		if !c.scanner.Scan() {
			if err := c.scanner.Err(); err != nil {
				errCh <- err
				return
			}
			errCh <- io.EOF
			return
		}
		var resp rpcResponse
		if err := json.Unmarshal(c.scanner.Bytes(), &resp); err != nil {
			errCh <- err
			return
		}
		respCh <- resp
	}()
	select {
	case <-callCtx.Done():
		atomic.AddUint64(&c.stats.Errors, 1)
		return callCtx.Err()
	case err := <-errCh:
		atomic.AddUint64(&c.stats.Errors, 1)
		return err
	case resp := <-respCh:
		if resp.ID != id {
			atomic.AddUint64(&c.stats.Errors, 1)
			return fmt.Errorf("mcp response id mismatch: got %d want %d", resp.ID, id)
		}
		if resp.Error != nil {
			atomic.AddUint64(&c.stats.Errors, 1)
			return fmt.Errorf("mcp error %d: %s", resp.Error.Code, resp.Error.Message)
		}
		if out == nil {
			return nil
		}
		if err := json.Unmarshal(resp.Result, out); err != nil {
			atomic.AddUint64(&c.stats.Errors, 1)
			return err
		}
		return nil
	}
}

func (c *Client) callHTTP(ctx context.Context, req rpcRequest, out any) error {
	raw, err := json.Marshal(req)
	if err != nil {
		atomic.AddUint64(&c.stats.Errors, 1)
		return err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.httpURL, bytes.NewReader(raw))
	if err != nil {
		atomic.AddUint64(&c.stats.Errors, 1)
		return err
	}
	if c.policy != nil {
		if err := c.policy.ValidateURL(ctx, c.httpURL); err != nil {
			atomic.AddUint64(&c.stats.Errors, 1)
			return err
		}
	}
	httpReq.Header.Set("Content-Type", "application/json")
	for key, value := range c.headers {
		httpReq.Header.Set(key, value)
	}
	resp, err := c.http.Do(httpReq)
	if err != nil {
		atomic.AddUint64(&c.stats.Errors, 1)
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		atomic.AddUint64(&c.stats.Errors, 1)
		return fmt.Errorf("mcp http status %d", resp.StatusCode)
	}
	var rpcResp rpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		atomic.AddUint64(&c.stats.Errors, 1)
		return err
	}
	if rpcResp.ID != req.ID {
		atomic.AddUint64(&c.stats.Errors, 1)
		return fmt.Errorf("mcp response id mismatch: got %d want %d", rpcResp.ID, req.ID)
	}
	if rpcResp.Error != nil {
		atomic.AddUint64(&c.stats.Errors, 1)
		return fmt.Errorf("mcp error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(rpcResp.Result, out); err != nil {
		atomic.AddUint64(&c.stats.Errors, 1)
		return err
	}
	return nil
}

func copyHeaders(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for key, value := range in {
		out[key] = value
	}
	return out
}

func cloneMap(in map[string]any) map[string]any {
	out := make(map[string]any, len(in))
	for key, value := range in {
		out[key] = value
	}
	return out
}
