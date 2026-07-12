package term

import (
	"testing"

	"github.com/peterh/liner"
)

func TestCloseClosesInitializedLineEditorLifecycle(t *testing.T) {
	termState = liner.NewLiner()
	history = []string{"/status", "/help"}

	Close()
	Close()

	termState = nil
	history = nil
}
