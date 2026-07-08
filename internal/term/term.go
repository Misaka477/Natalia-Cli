package term

import (
	"github.com/peterh/liner"
)

var (
	termState *liner.State
	history   []string
)

func Readline(prompt string) (string, error) {
	if termState == nil {
		termState = liner.NewLiner()
		termState.SetCtrlCAborts(true)
		for _, h := range history {
			termState.AppendHistory(h)
		}
	}
	return termState.Prompt(prompt)
}

func ReadlineWithHistory(prompt string, h []string) (string, error) {
	if termState == nil {
		termState = liner.NewLiner()
		termState.SetCtrlCAborts(true)
	}
	termState.ClearHistory()
	for _, entry := range h {
		termState.AppendHistory(entry)
	}
	return termState.Prompt(prompt)
}

func Close() {
	if termState != nil {
		termState.Close()
	}
}
