package mcptools

import (
	"context"
	"strings"
	"testing"

	coremcp "github.com/Misaka477/Natalia-Cli/internal/mcp"
)

type callerStub struct {
	name string
	args map[string]any
	res  *coremcp.CallResult
	err  error
}

func (c *callerStub) CallTool(ctx context.Context, name string, args map[string]any) (*coremcp.CallResult, error) {
	c.name = name
	c.args = args
	return c.res, c.err
}

func TestMCPToolConvertsSchemaAndExecutesThroughCaller(t *testing.T) {
	caller := &callerStub{res: &coremcp.CallResult{Content: []map[string]any{{"type": "text", "text": "hello from mcp"}}}}
	tool, err := NewTool("fixture-server", coremcp.Tool{
		Name:        "echo.text",
		Description: "Echo text",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []any{"text"},
			"properties": map[string]any{
				"text": map[string]any{"type": "string", "description": "Text to echo"},
				"mode": map[string]any{"type": "string", "enum": []any{"plain", "json"}},
			},
		},
	}, caller)
	if err != nil {
		t.Fatal(err)
	}
	if tool.Name() != "mcp_fixture-server_echo_text" {
		t.Fatalf("unexpected registered name: %s", tool.Name())
	}
	props := tool.Parameters()
	if props["text"].Type != "string" || props["text"].Description != "Text to echo" || len(props["mode"].Enum) != 2 {
		t.Fatalf("unexpected schema conversion: %+v", props)
	}
	if got := tool.Required(); len(got) != 1 || got[0] != "text" {
		t.Fatalf("unexpected required fields: %v", got)
	}
	out, err := tool.Execute(map[string]any{"text": "hello"})
	if err != nil {
		t.Fatal(err)
	}
	if out != "hello from mcp" || caller.name != "echo.text" || caller.args["text"] != "hello" {
		t.Fatalf("unexpected execution: out=%q caller=%+v", out, caller)
	}
}

func TestMCPToolFormatsNonTextContentAndErrorResult(t *testing.T) {
	caller := &callerStub{res: &coremcp.CallResult{IsError: true, Content: []map[string]any{{"type": "image", "mimeType": "image/png"}}}}
	tool, err := NewTool("s", coremcp.Tool{Name: "draw", InputSchema: map[string]any{"type": "object"}}, caller)
	if err != nil {
		t.Fatal(err)
	}
	out, err := tool.Execute(nil)
	if err == nil || !strings.Contains(out, "image/png") {
		t.Fatalf("expected error result with formatted content, out=%q err=%v", out, err)
	}
	ret, err := tool.ExecuteReturn(nil)
	if err == nil || len(ret.Display) != 1 || ret.Display[0].Type != "media" || !ret.IsError {
		t.Fatalf("expected rich media display for non-text error, ret=%+v err=%v", ret, err)
	}
}

func TestMCPToolInfersReadOnlyFromAnnotationsAndNames(t *testing.T) {
	if !IsReadOnly(coremcp.Tool{Name: "mutate", Annotations: map[string]any{"readOnlyHint": true}}) {
		t.Fatal("expected readOnlyHint annotation to mark tool read-only")
	}
	if !IsReadOnly(coremcp.Tool{Name: "list_repositories"}) {
		t.Fatal("expected list prefix to mark tool read-only")
	}
	if IsReadOnly(coremcp.Tool{Name: "delete_repository"}) {
		t.Fatal("expected mutating name not to be read-only")
	}
}

func TestMCPToolNameSanitizesServerAndToolNames(t *testing.T) {
	name, err := ToolName("123 server", "tool.name/with spaces")
	if err != nil {
		t.Fatal(err)
	}
	if name != "mcp_x_123_server_tool_name_with_spaces" {
		t.Fatalf("unexpected sanitized name: %s", name)
	}
	if !IsToolFromServer(name, "123 server") {
		t.Fatalf("expected %s to match sanitized server", name)
	}
	if _, err := ToolName("", "tool"); err == nil {
		t.Fatal("expected empty server name to be rejected")
	}
}
