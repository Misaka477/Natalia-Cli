package main

import (
	"github.com/Misaka477/Natalia-Cli/internal/terminalui/terminalspike"
	"os"
)

func main() {
	_ = terminalspike.RunCustomShell(os.Stdin, os.Stdout)
}
