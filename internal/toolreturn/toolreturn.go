package toolreturn

import "github.com/aquama/natalia-cli/internal/display"

type Return struct {
	ModelText string
	Display   []display.Block
	IsError   bool
}
