package toolschema

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"

	"github.com/aquama/natalia-cli/internal/llm"
)

func FromStruct(v any) (map[string]llm.Property, []string) {
	t := reflect.TypeOf(v)
	if t == nil {
		return map[string]llm.Property{}, nil
	}
	if t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return map[string]llm.Property{}, nil
	}

	props := make(map[string]llm.Property)
	required := make([]string, 0)
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		if field.PkgPath != "" {
			continue
		}
		name, optional := jsonFieldName(field)
		if name == "" || name == "-" {
			continue
		}
		prop := llm.Property{Type: jsonType(field.Type), Description: field.Tag.Get("description")}
		if enum := field.Tag.Get("enum"); enum != "" {
			prop.Enum = splitCSV(enum)
		}
		props[name] = prop
		if field.Tag.Get("required") == "true" || (!optional && field.Tag.Get("required") != "false") {
			required = append(required, name)
		}
	}
	return props, required
}

func Decode[T any](args map[string]any) (T, error) {
	var out T
	data, err := json.Marshal(args)
	if err != nil {
		return out, fmt.Errorf("marshal tool args: %w", err)
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return out, fmt.Errorf("decode tool args: %w", err)
	}
	if err := validateRequired(out); err != nil {
		return out, err
	}
	return out, nil
}

func validateRequired(v any) error {
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Pointer {
		if rv.IsNil() {
			return fmt.Errorf("tool params cannot be nil")
		}
		rv = rv.Elem()
	}
	if rv.Kind() != reflect.Struct {
		return nil
	}
	t := rv.Type()
	for i := 0; i < rv.NumField(); i++ {
		field := t.Field(i)
		if field.PkgPath != "" {
			continue
		}
		name, optional := jsonFieldName(field)
		if name == "" || name == "-" {
			continue
		}
		required := field.Tag.Get("required") == "true" || (!optional && field.Tag.Get("required") != "false")
		if !required {
			continue
		}
		if rv.Field(i).IsZero() {
			return fmt.Errorf("missing required parameter %q", name)
		}
	}
	return nil
}

func jsonFieldName(field reflect.StructField) (string, bool) {
	tag := field.Tag.Get("json")
	if tag == "" {
		return lowerCamel(field.Name), false
	}
	parts := strings.Split(tag, ",")
	name := parts[0]
	optional := false
	for _, part := range parts[1:] {
		if part == "omitempty" {
			optional = true
		}
	}
	return name, optional
}

func jsonType(t reflect.Type) string {
	if t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	switch t.Kind() {
	case reflect.Bool:
		return "boolean"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "integer"
	case reflect.Float32, reflect.Float64:
		return "number"
	case reflect.Slice, reflect.Array:
		return "array"
	case reflect.Map, reflect.Struct:
		return "object"
	default:
		return "string"
	}
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func lowerCamel(name string) string {
	if name == "" {
		return ""
	}
	return strings.ToLower(name[:1]) + name[1:]
}
