package toolset

import (
	"testing"

	"github.com/aquama/natalia-cli/internal/display"
	"github.com/aquama/natalia-cli/internal/llm"
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
