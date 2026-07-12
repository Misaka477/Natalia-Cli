package adapters

import (
	"fmt"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/mcp"
	mcptools "github.com/Misaka477/Natalia-Cli/internal/tools/mcptools"
)

func ImportMCPToolSchema(serverName string, tool mcp.Tool) (llm.ToolDef, error) {
	if serverName == "" {
		return llm.ToolDef{}, fmt.Errorf("MCP server name is required")
	}
	if tool.Name == "" {
		return llm.ToolDef{}, fmt.Errorf("MCP tool name is required")
	}
	props, _ := tool.InputSchema["properties"].(map[string]any)
	converted := make(map[string]llm.Property, len(props))
	for name, value := range props {
		schema, _ := value.(map[string]any)
		converted[name] = llm.Property{Type: stringField(schema, "type", "string"), Description: stringField(schema, "description", ""), Enum: stringSlice(schema["enum"])}
	}
	name, err := mcptools.ToolName(serverName, tool.Name)
	if err != nil {
		return llm.ToolDef{}, err
	}
	return llm.ToolDef{Type: "function", Function: llm.Function{Name: name, Description: tool.Description, Parameters: llm.Parameters{Type: "object", Properties: converted, Required: stringSlice(tool.InputSchema["required"])}}}, nil
}
