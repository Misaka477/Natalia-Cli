package mcptools

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
	coremcp "github.com/Misaka477/Natalia-Cli/internal/mcp"
	"github.com/Misaka477/Natalia-Cli/internal/toolreturn"
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
	ret, err := t.ExecuteReturn(args)
	return ret.ModelText, err
}

func (t *Tool) ExecuteReturn(args map[string]any) (toolreturn.Return, error) {
	if t.caller == nil {
		return toolreturn.Return{IsError: true}, fmt.Errorf("mcp client is not configured")
	}
	result, err := t.caller.CallTool(context.Background(), t.origName, args)
	if err != nil {
		return toolreturn.Return{IsError: true}, err
	}
	text, blocks := formatCallReturn(t.serverName, t.origName, result)
	if result != nil && result.IsError {
		return toolreturn.Return{ModelText: text, Display: blocks, IsError: true}, fmt.Errorf("mcp tool returned error")
	}
	return toolreturn.Return{ModelText: text, Display: blocks}, nil
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
	text, _ := formatCallReturn("", "", result)
	return text
}

func formatCallReturn(serverName, toolName string, result *coremcp.CallResult) (string, []display.Block) {
	if result == nil || len(result.Content) == 0 {
		return "MCP tool completed with no content.", nil
	}
	parts := make([]string, 0, len(result.Content))
	blocks := make([]display.Block, 0)
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
		title := strings.TrimSpace(fmt.Sprintf("MCP %s/%s %v", serverName, toolName, item["type"]))
		block, blockErr := display.NewBlock(display.BlockMedia, title, item)
		if blockErr == nil {
			blocks = append(blocks, block)
		}
		parts = append(parts, string(raw))
	}
	return strings.Join(parts, "\n"), blocks
}

func IsReadOnly(tool coremcp.Tool) bool {
	for _, key := range []string{"readOnlyHint", "read_only", "readonly"} {
		if raw, ok := tool.Annotations[key]; ok {
			if value, ok := raw.(bool); ok && value {
				return true
			}
		}
	}
	name := strings.ToLower(tool.Name)
	for _, prefix := range []string{"read", "get", "list", "search", "find", "fetch", "query"} {
		if strings.HasPrefix(name, prefix) || strings.HasPrefix(name, prefix+"_") || strings.HasPrefix(name, prefix+"-") {
			return true
		}
	}
	return false
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
