package adapters

import (
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/mcp"
)

func TestImportMCPToolSchemaConvertsToNataliaToolDef(t *testing.T) {
	def, err := ImportMCPToolSchema("file server", mcp.Tool{Name: "read.file", Description: "Read file", InputSchema: map[string]any{"required": []any{"path"}, "properties": map[string]any{"path": map[string]any{"type": "string", "description": "File path"}}}})
	if err != nil {
		t.Fatal(err)
	}
	if def.Function.Name != "mcp_file_server_read_file" || def.Function.Description != "Read file" {
		t.Fatalf("unexpected MCP tool def: %+v", def)
	}
	if def.Function.Parameters.Properties["path"].Description != "File path" || len(def.Function.Parameters.Required) != 1 || def.Function.Parameters.Required[0] != "path" {
		t.Fatalf("unexpected MCP params: %+v", def.Function.Parameters)
	}
}

func TestImportMCPToolSchemaRejectsMissingNames(t *testing.T) {
	if _, err := ImportMCPToolSchema("", mcp.Tool{Name: "tool"}); err == nil || !strings.Contains(err.Error(), "server") {
		t.Fatalf("expected missing server error, got %v", err)
	}
	if _, err := ImportMCPToolSchema("server", mcp.Tool{}); err == nil || !strings.Contains(err.Error(), "tool name") {
		t.Fatalf("expected missing tool error, got %v", err)
	}
}
