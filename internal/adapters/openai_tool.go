package adapters

import (
	"encoding/json"
	"fmt"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
)

type openAITool struct {
	Type     string         `json:"type"`
	Function openAIFunction `json:"function"`
}

type openAIFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

func ImportOpenAIToolSchema(data []byte) (llm.ToolDef, error) {
	var raw openAITool
	if err := json.Unmarshal(data, &raw); err != nil {
		return llm.ToolDef{}, fmt.Errorf("parse OpenAI tool schema: %w", err)
	}
	if raw.Type != "function" {
		return llm.ToolDef{}, fmt.Errorf("unsupported OpenAI tool type %q", raw.Type)
	}
	if raw.Function.Name == "" {
		return llm.ToolDef{}, fmt.Errorf("OpenAI tool function.name is required")
	}
	props, _ := raw.Function.Parameters["properties"].(map[string]any)
	converted := make(map[string]llm.Property, len(props))
	for name, value := range props {
		schema, _ := value.(map[string]any)
		converted[name] = llm.Property{Type: stringField(schema, "type", "string"), Description: stringField(schema, "description", ""), Enum: stringSlice(schema["enum"])}
	}
	return llm.ToolDef{Type: "function", Function: llm.Function{Name: raw.Function.Name, Description: raw.Function.Description, Parameters: llm.Parameters{Type: "object", Properties: converted, Required: stringSlice(raw.Function.Parameters["required"])}}}, nil
}

func stringField(values map[string]any, key, fallback string) string {
	if values == nil {
		return fallback
	}
	if value, ok := values[key].(string); ok && value != "" {
		return value
	}
	return fallback
}

func stringSlice(value any) []string {
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if s, ok := item.(string); ok {
			out = append(out, s)
		}
	}
	return out
}
