package toolset

import (
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/display"
	"github.com/Misaka477/Natalia-Cli/internal/llm"
)

type stringOnlyTool struct{}

func (stringOnlyTool) Name() string                                { return "string_only" }
func (stringOnlyTool) Description() string                         { return "string only test tool" }
func (stringOnlyTool) Execute(args map[string]any) (string, error) { return "plain result", nil }
func (stringOnlyTool) Parameters() map[string]llm.Property         { return nil }
func (stringOnlyTool) Required() []string                          { return nil }

type richReturnTool struct{}

func (richReturnTool) Name() string                                { return "rich" }
func (richReturnTool) Description() string                         { return "rich test tool" }
func (richReturnTool) Execute(args map[string]any) (string, error) { return "legacy", nil }
func (richReturnTool) Parameters() map[string]llm.Property         { return nil }
func (richReturnTool) Required() []string                          { return nil }
func (richReturnTool) ExecuteReturn(args map[string]any) (ToolReturn, error) {
	block, err := display.NewBlock(display.BlockShell, "command", display.ShellBlock{Command: "go test ./...", Output: "ok"})
	if err != nil {
		return ToolReturn{}, err
	}
	return ToolReturn{ModelText: "summary", Display: []display.Block{block}}, nil
}

type emptyRichTool struct{}

func (emptyRichTool) Name() string                                { return "empty_rich" }
func (emptyRichTool) Description() string                         { return "empty rich test tool" }
func (emptyRichTool) Execute(args map[string]any) (string, error) { return "legacy", nil }
func (emptyRichTool) Parameters() map[string]llm.Property {
	return map[string]llm.Property{"path": {Type: "string", Description: "file path"}}
}
func (emptyRichTool) Required() []string { return []string{"path"} }
func (emptyRichTool) ExecuteReturn(args map[string]any) (ToolReturn, error) {
	return ToolReturn{}, nil
}

func TestExecuteAdaptsStringOnlyTool(t *testing.T) {
	ret, err := Execute(stringOnlyTool{}, map[string]any{})
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if ret.ModelText != "plain result" || len(ret.Display) != 0 || ret.IsError {
		t.Fatalf("unexpected adapted return: %+v", ret)
	}
}

func TestExecuteUsesRichToolReturn(t *testing.T) {
	ret, err := Execute(richReturnTool{}, map[string]any{})
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if ret.ModelText != "summary" || len(ret.Display) != 1 || ret.Display[0].Type != display.BlockShell {
		t.Fatalf("unexpected rich return: %+v", ret)
	}
}

func TestExecuteRichToolReturnsDefaultModelTextWhenEmpty(t *testing.T) {
	ret, err := Execute(emptyRichTool{}, map[string]any{"path": "x"})
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if ret.ModelText != "工具执行完成" || len(ret.Display) != 0 || ret.IsError {
		t.Fatalf("unexpected default rich return: %+v", ret)
	}
}

func TestRegistryListAndToolDefsUseRealMetadata(t *testing.T) {
	r := NewRegistry()
	r.Register(emptyRichTool{})
	r.Register(stringOnlyTool{})
	if len(r.List()) != 2 {
		t.Fatalf("expected 2 registered tools, got %d", len(r.List()))
	}
	defs := r.ToToolDefs()
	seen := map[string]llm.ToolDef{}
	for _, def := range defs {
		seen[def.Function.Name] = def
	}
	def, ok := seen["empty_rich"]
	if !ok {
		t.Fatalf("empty_rich missing from tool defs: %+v", defs)
	}
	if def.Type != "function" || def.Function.Description == "" || def.Function.Parameters.Type != "object" || def.Function.Parameters.Properties["path"].Type != "string" || len(def.Function.Parameters.Required) != 1 || def.Function.Parameters.Required[0] != "path" {
		t.Fatalf("unexpected tool def: %+v", def)
	}
}

func TestRegistryFiltered(t *testing.T) {
	r := NewRegistry()
	r.Register(stringOnlyTool{})
	r.Register(richReturnTool{})

	filtered := r.Filtered([]string{"string_only", "rich"}, []string{"rich"})
	if _, ok := filtered.Get("string_only"); !ok {
		t.Fatal("expected string_only to remain")
	}
	if _, ok := filtered.Get("rich"); ok {
		t.Fatal("expected rich to be excluded")
	}
}

func TestDedupResetTurn(t *testing.T) {
	d := NewDedup()
	args := map[string]any{"path": "test.txt"}
	if got := d.Count("read_file", args); got != 1 {
		t.Fatalf("expected first count to be 1, got %d", got)
	}
	if got := d.Count("read_file", args); got != 2 {
		t.Fatalf("expected second count to be 2, got %d", got)
	}
	d.ResetTurn()
	if got := d.Count("read_file", args); got != 1 {
		t.Fatalf("expected reset count to be 1, got %d", got)
	}
}

func TestDedupKeyIsDeterministicForMapArgs(t *testing.T) {
	d := NewDedup()
	argsA := map[string]any{"b": 2, "a": 1}
	argsB := map[string]any{"a": 1, "b": 2}
	if got := d.Count("read_file", argsA); got != 1 {
		t.Fatalf("expected first count to be 1, got %d", got)
	}
	if got := d.Count("read_file", argsB); got != 2 {
		t.Fatalf("expected deterministic key to count equivalent args, got %d", got)
	}
}

func TestDedupCheckWarnsAndStopsAtThresholds(t *testing.T) {
	d := NewDedup()
	args := map[string]any{"path": "same.txt"}
	thresholds := map[int]struct {
		wantWarn string
		wantStop bool
	}{
		3:  {wantWarn: "请检查"},
		5:  {wantWarn: "注意"},
		8:  {wantWarn: "立即停止"},
		12: {wantWarn: "强制终止", wantStop: true},
	}
	for i := 1; i <= 12; i++ {
		warn, stop := d.Check("read_file", args)
		if want, ok := thresholds[i]; ok {
			if !strings.Contains(warn, want.wantWarn) || stop != want.wantStop {
				t.Fatalf("call %d: warn=%q stop=%v want warn containing %q stop=%v", i, warn, stop, want.wantWarn, want.wantStop)
			}
			continue
		}
		if i < 3 && (warn != "" || stop) {
			t.Fatalf("call %d: expected no warning before threshold, got warn=%q stop=%v", i, warn, stop)
		}
		if i > 3 && warn == "" {
			t.Fatalf("call %d: expected repeated calls to keep warning", i)
		}
	}
}
