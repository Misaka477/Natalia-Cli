package adapters

import (
	"strings"
	"testing"
)

func TestImportOpenAIToolSchemaConvertsToNataliaToolDef(t *testing.T) {
	def, err := ImportOpenAIToolSchema([]byte(`{
  "type": "function",
  "function": {
    "name": "external_search",
    "description": "Search external index",
    "parameters": {
      "type": "object",
      "required": ["query"],
      "properties": {
        "query": {"type": "string", "description": "Search query"},
        "mode": {"type": "string", "enum": ["fast", "deep"]}
      }
    }
  }
}`))
	if err != nil {
		t.Fatal(err)
	}
	if def.Type != "function" || def.Function.Name != "external_search" || def.Function.Description != "Search external index" {
		t.Fatalf("unexpected converted def: %+v", def)
	}
	if def.Function.Parameters.Properties["query"].Description != "Search query" || len(def.Function.Parameters.Properties["mode"].Enum) != 2 {
		t.Fatalf("unexpected converted properties: %+v", def.Function.Parameters.Properties)
	}
	if len(def.Function.Parameters.Required) != 1 || def.Function.Parameters.Required[0] != "query" {
		t.Fatalf("unexpected required fields: %+v", def.Function.Parameters.Required)
	}
}

func TestImportOpenAIToolSchemaRejectsUnsupportedInput(t *testing.T) {
	if _, err := ImportOpenAIToolSchema([]byte(`{"type":"custom"}`)); err == nil || !strings.Contains(err.Error(), "unsupported") {
		t.Fatalf("expected unsupported type error, got %v", err)
	}
	if _, err := ImportOpenAIToolSchema([]byte(`{"type":"function","function":{}}`)); err == nil || !strings.Contains(err.Error(), "name") {
		t.Fatalf("expected missing name error, got %v", err)
	}
}
