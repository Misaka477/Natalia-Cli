package main

import (
	"github.com/Misaka477/Natalia-Cli/internal/terminalui/shell"
	"os"
)

func main() {
	renderer := shell.NewRenderer(os.Stdin, os.Stdout, shell.DarkTheme())
	if err := renderer.Run(); err != nil {
		panic(err)
	}
}
