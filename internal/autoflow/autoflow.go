package autoflow

import "github.com/aquama/natalia-cli/internal/soul"

const DefaultFailureThreshold = 2

type Action string

type FailureKind string

const (
	ActionNone          Action = ""
	ActionDebug         Action = "debug"
	ActionRecoveredMode Action = "recovered_mode"

	FailureNone     FailureKind = ""
	FailureError    FailureKind = "error"
	FailureMaxSteps FailureKind = "max_steps"
)

type Decision struct {
	Action      Action
	TargetMode  string
	FailureKind FailureKind
}

type Escalator struct {
	Threshold    int
	Consecutive  int
	AutoDebug    bool
	PreviousMode string
}

func (e *Escalator) Reset() {
	if e == nil {
		return
	}
	e.Consecutive = 0
	e.AutoDebug = false
	e.PreviousMode = ""
}

func (e *Escalator) Record(outcome *soul.Outcome, currentMode string) Decision {
	if e == nil || outcome == nil {
		return Decision{}
	}
	failure := ClassifyFailure(outcome)
	if failure == FailureNone {
		e.Consecutive = 0
		if e.AutoDebug && currentMode == "debug" && isSuccessfulOutcome(outcome) {
			target := e.PreviousMode
			e.AutoDebug = false
			e.PreviousMode = ""
			return Decision{Action: ActionRecoveredMode, TargetMode: target}
		}
		return Decision{}
	}

	e.Consecutive++
	threshold := e.Threshold
	if threshold <= 0 {
		threshold = DefaultFailureThreshold
	}
	if e.Consecutive < threshold || currentMode == "debug" {
		return Decision{}
	}
	if currentMode == "" {
		currentMode = "code"
	}
	e.PreviousMode = currentMode
	e.AutoDebug = true
	e.Consecutive = 0
	return Decision{Action: ActionDebug, TargetMode: "debug", FailureKind: failure}
}

func isSuccessfulOutcome(outcome *soul.Outcome) bool {
	return outcome.StopReason == "no_tool_calls" && outcome.FinalMessage != ""
}

func ClassifyFailure(outcome *soul.Outcome) FailureKind {
	if outcome == nil {
		return FailureNone
	}
	switch outcome.StopReason {
	case "error":
		return FailureError
	case "max_steps":
		return FailureMaxSteps
	default:
		return FailureNone
	}
}
