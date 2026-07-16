package presentation

// Dispatch is the UI-neutral output interface.
// Implementations can drive a TUI, wire client, or plain renderer.
type Dispatch interface {
	Send(event Event)

	// ShowApproval displays an approval prompt and waits for the response.
	// Returns true if approved, false if rejected.
	ShowApproval(req ApprovalRequestPayload) ApprovalResultPayload

	// ShowQuestion displays a question and returns the answer.
	ShowQuestion(req QuestionRequestPayload) string
}

// DefaultDispatch is set by the UI implementation at startup.
// Code that previously used tui.DefaultProgram should use this instead.
var DefaultDispatch Dispatch

// NopDispatch is a no-op implementation for tests and non-interactive mode.
type NopDispatch struct{}

func (d *NopDispatch) Send(event Event) {}
func (d *NopDispatch) ShowApproval(req ApprovalRequestPayload) ApprovalResultPayload {
	return ApprovalResultPayload{ID: req.ID, Approved: true}
}
func (d *NopDispatch) ShowQuestion(req QuestionRequestPayload) string { return "" }
