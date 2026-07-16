package shell

import "errors"

var (
	ErrInvalidUTF8      = errors.New("invalid utf-8")
	ErrUnsupportedEscape = errors.New("unsupported escape sequence")
)

type InputAction int

const (
	InputActionSend InputAction = iota
	InputActionQueue
	InputActionBtw
	InputActionIgnore
)

type InputRouter struct{}

func NewInputRouter() *InputRouter {
	return &InputRouter{}
}

func (r *InputRouter) Classify(text string, streaming bool) InputAction {
	if streaming {
		return InputActionQueue
	}
	return InputActionSend
}
