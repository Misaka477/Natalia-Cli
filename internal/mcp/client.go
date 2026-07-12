package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"
)

type ServerConfig struct {
	Command    string
	Args       []string
	Cwd        string
	TimeoutSec int
}

type Client struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	scanner *bufio.Scanner
	mu      sync.Mutex
	nextID  uint64
	timeout time.Duration
}

type Tool struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	InputSchema map[string]any `json:"inputSchema,omitempty"`
}

type CallResult struct {
	Content []map[string]any `json:"content,omitempty"`
	IsError bool             `json:"isError,omitempty"`
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
	if cfg.Command == "" {
		return nil, fmt.Errorf("mcp command is required")
	}
	cmd := exec.CommandContext(ctx, cfg.Command, cfg.Args...)
	cmd.Dir = cfg.Cwd
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
	return &Client{cmd: cmd, stdin: stdin, scanner: bufio.NewScanner(stdout), timeout: timeout}, nil
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
	return c.call(ctx, "initialize", map[string]any{"protocolVersion": "2024-11-05", "clientInfo": map[string]any{"name": "natalia-cli", "version": "dev"}}, &result)
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
	c.mu.Lock()
	defer c.mu.Unlock()
	if ctx == nil {
		ctx = context.Background()
	}
	callCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()
	id := atomic.AddUint64(&c.nextID, 1)
	req := rpcRequest{JSONRPC: "2.0", ID: id, Method: method, Params: params}
	raw, err := json.Marshal(req)
	if err != nil {
		return err
	}
	if _, err := c.stdin.Write(append(raw, '\n')); err != nil {
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
		return callCtx.Err()
	case err := <-errCh:
		return err
	case resp := <-respCh:
		if resp.ID != id {
			return fmt.Errorf("mcp response id mismatch: got %d want %d", resp.ID, id)
		}
		if resp.Error != nil {
			return fmt.Errorf("mcp error %d: %s", resp.Error.Code, resp.Error.Message)
		}
		if out == nil {
			return nil
		}
		return json.Unmarshal(resp.Result, out)
	}
}
