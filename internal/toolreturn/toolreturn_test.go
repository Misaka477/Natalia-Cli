package toolreturn

import (
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/display"
)

func TestReturnCarriesModelTextDisplayAndErrorFlag(t *testing.T) {
	block, err := display.NewBlock(display.BlockDiff, "edit", display.DiffBlock{Path: "main.go", Diff: "-old\n+new"})
	if err != nil {
		t.Fatal(err)
	}
	ret := Return{ModelText: "edited main.go", Display: []display.Block{block}, IsError: false}
	if ret.ModelText != "edited main.go" || ret.IsError || len(ret.Display) != 1 || ret.Display[0].Type != display.BlockDiff {
		t.Fatalf("unexpected tool return: %+v", ret)
	}
}
