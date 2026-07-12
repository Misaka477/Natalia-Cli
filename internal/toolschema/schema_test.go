package toolschema

import (
	"reflect"
	"strings"
	"testing"
)

type schemaTestParams struct {
	Command string   `json:"command" description:"Command to run"`
	Timeout int      `json:"timeout,omitempty" description:"Timeout seconds"`
	Mode    string   `json:"mode,omitempty" description:"Mode" enum:"fast, safe"`
	Hidden  string   `json:"-"`
	Items   []string `json:"items,omitempty" description:"Items" required:"true"`
}

type noTagParams struct {
	LongFieldName string
}

func TestFromStruct(t *testing.T) {
	props, required := FromStruct(schemaTestParams{})
	if len(props) != 4 {
		t.Fatalf("expected 4 properties, got %+v", props)
	}
	if props["command"].Type != "string" || props["command"].Description != "Command to run" {
		t.Fatalf("unexpected command property: %+v", props["command"])
	}
	if props["timeout"].Type != "integer" {
		t.Fatalf("unexpected timeout type: %+v", props["timeout"])
	}
	if props["items"].Type != "array" {
		t.Fatalf("unexpected items type: %+v", props["items"])
	}
	if len(props["mode"].Enum) != 2 || props["mode"].Enum[0] != "fast" || props["mode"].Enum[1] != "safe" {
		t.Fatalf("unexpected enum: %+v", props["mode"].Enum)
	}
	if len(required) != 2 || required[0] != "command" || required[1] != "items" {
		t.Fatalf("unexpected required fields: %+v", required)
	}
}

func TestFromStructPointerNilAndNoTagPaths(t *testing.T) {
	props, required := FromStruct(&schemaTestParams{})
	if len(props) != 4 || len(required) != 2 {
		t.Fatalf("expected pointer struct schema, props=%+v required=%+v", props, required)
	}
	props, required = FromStruct(nil)
	if len(props) != 0 || len(required) != 0 {
		t.Fatalf("expected nil input to produce empty schema, props=%+v required=%+v", props, required)
	}
	field, ok := reflect.TypeOf(noTagParams{}).FieldByName("LongFieldName")
	if !ok {
		t.Fatal("missing test field")
	}
	name, optional := jsonFieldName(field)
	if name != "longFieldName" || optional {
		t.Fatalf("unexpected no-tag json field name: name=%q optional=%v", name, optional)
	}
}

func TestFromStructRejectsNonStruct(t *testing.T) {
	props, required := FromStruct("not a struct")
	if len(props) != 0 || len(required) != 0 {
		t.Fatalf("expected empty schema, got props=%+v required=%+v", props, required)
	}
}

func TestDecode(t *testing.T) {
	got, err := Decode[schemaTestParams](map[string]any{
		"command": "go test ./...",
		"timeout": 10,
		"items":   []any{"a", "b"},
	})
	if err != nil {
		t.Fatalf("Decode failed: %v", err)
	}
	if got.Command != "go test ./..." || got.Timeout != 10 || len(got.Items) != 2 {
		t.Fatalf("unexpected decoded params: %+v", got)
	}
}

func TestDecodeMissingRequired(t *testing.T) {
	_, err := Decode[schemaTestParams](map[string]any{"items": []any{"a"}})
	if err == nil || err.Error() != `missing required parameter "command"` {
		t.Fatalf("expected missing command error, got %v", err)
	}
}

func TestDecodeTypeError(t *testing.T) {
	_, err := Decode[schemaTestParams](map[string]any{"command": "x", "timeout": "bad", "items": []any{"a"}})
	if err == nil {
		t.Fatal("expected decode type error")
	}
}

func TestDecodeMarshalAndNilPointerRequiredErrors(t *testing.T) {
	_, err := Decode[schemaTestParams](map[string]any{"command": "x", "items": []any{"a"}, "bad": make(chan int)})
	if err == nil || !strings.Contains(err.Error(), "marshal tool args") {
		t.Fatalf("expected marshal error for unsupported arg value, got %v", err)
	}
	var params *schemaTestParams
	if err := validateRequired(params); err == nil || !strings.Contains(err.Error(), "cannot be nil") {
		t.Fatalf("expected nil pointer validation error, got %v", err)
	}
}
