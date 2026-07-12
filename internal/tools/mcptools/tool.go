package mcptools

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
	coremcp "github.com/Misaka477/Natalia-Cli/internal/mcp"
)

type Caller interface {
	CallTool(context.Context, string, map[string]any) (*coremcp.CallResult, error)
}

type Tool struct {
	serverName string
	origName   string
	name       string
	desc       string
	schema     map[string]any
	caller     Caller
}

func NewTool(serverName string, tool coremcp.Tool, caller Caller) (*Tool, error) {
	name, err := ToolName(serverName, tool.Name)
	if err != nil {
		return nil, err
	}
	desc := tool.Description
	if desc == "" {
		desc = fmt.Sprintf("MCP tool %s from server %s", tool.Name, serverName)
	}
	return &Tool{serverName: serverName, origName: tool.Name, name: name, desc: desc, schema: tool.InputSchema, caller: caller}, nil
}

func (t *Tool) Name() string { return t.name }

func (t *Tool) Description() string {
	return fmt.Sprintf("%s\n\nMCP server: %s. MCP tool: %s.", t.desc, t.serverName, t.origName)
}

func (t *Tool) Parameters() map[string]llm.Property {
	properties, _ := t.schema["properties"].(map[string]any)
	out := make(map[string]llm.Property, len(properties))
	for name, raw := range properties {
		propMap, ok := raw.(map[string]any)
		if !ok {
			out[name] = llm.Property{Type: "string"}
			continue
		}
		out[name] = propertyFromSchema(propMap)
	}
	return out
}

func (t *Tool) Required() []string {
	return requiredFromSchema(t.schema)
}

func (t *Tool) Execute(args map[string]any) (string, error) {
	if t.caller == nil {
		return "", fmt.Errorf("mcp client is not configured")
	}
	result, err := t.caller.CallTool(context.Background(), t.origName, args)
	if err != nil {
		return "", err
	}
	text := formatCallResult(result)
	if result != nil && result.IsError {
		return text, fmt.Errorf("mcp tool returned error")
	}
	return text, nil
}

func propertyFromSchema(schema map[string]any) llm.Property {
	typ, _ := schema["type"].(string)
	if typ == "" {
		typ = "string"
	}
	desc, _ := schema["description"].(string)
	prop := llm.Property{Type: typ, Description: desc}
	if values, ok := schema["enum"].([]any); ok {
		for _, value := range values {
			if s, ok := value.(string); ok {
				prop.Enum = append(prop.Enum, s)
			}
		}
	}
	return prop
}

func requiredFromSchema(schema map[string]any) []string {
	if schema == nil {
		return nil
	}
	values, ok := schema["required"].([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(values))
	for _, value := range values {
		if s, ok := value.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

func formatCallResult(result *coremcp.CallResult) string {
	if result == nil || len(result.Content) == 0 {
		return "MCP tool completed with no content."
	}
	parts := make([]string, 0, len(result.Content))
	for _, item := range result.Content {
		if item["type"] == "text" {
			if text, ok := item["text"].(string); ok {
				parts = append(parts, text)
				continue
			}
		}
		raw, err := json.Marshal(item)
		if err != nil {
			parts = append(parts, fmt.Sprint(item))
			continue
		}
		parts = append(parts, string(raw))
	}
	return strings.Join(parts, "\n")
}

var invalidToolNameChar = regexp.MustCompile(`[^A-Za-z0-9_-]+`)

func ToolName(serverName, toolName string) (string, error) {
	server := sanitizeNamePart(serverName)
	tool := sanitizeNamePart(toolName)
	if server == "" || tool == "" {
		return "", fmt.Errorf("invalid mcp tool name: server=%q tool=%q", serverName, toolName)
	}
	return "mcp_" + server + "_" + tool, nil
}

func IsToolFromServer(toolName, serverName string) bool {
	server := sanitizeNamePart(serverName)
	return server != "" && strings.HasPrefix(toolName, "mcp_"+server+"_")
}

func ServerWildcard(serverName string) string {
	server := sanitizeNamePart(serverName)
	if server == "" {
		return ""
	}
	return "mcp_" + server + "_*"
}

func sanitizeNamePart(value string) string {
	value = strings.TrimSpace(value)
	value = invalidToolNameChar.ReplaceAllString(value, "_")
	value = strings.Trim(value, "_-")
	if value == "" {
		return ""
	}
	if r := rune(value[0]); unicode.IsDigit(r) {
		value = "x_" + value
	}
	return value
}
