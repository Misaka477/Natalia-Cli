package autoflow

import (
	"strings"

	"github.com/Misaka477/Natalia-Cli/internal/orchestrator"
)

const DefaultFailureThreshold = 2

type Action string

type FailureKind string

const (
	ActionNone          Action = ""
	ActionDebug         Action = "debug"
	ActionRecoveredMode Action = "recovered_mode"

	FailureNone      FailureKind = ""
	FailureError     FailureKind = "error"
	FailureMaxSteps  FailureKind = "max_steps"
	FailureTransient FailureKind = "transient"
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

func (e *Escalator) Record(outcome *orchestrator.Outcome, currentMode string) Decision {
	if e == nil || outcome == nil {
		return Decision{}
	}
	failure := ClassifyFailure(outcome)

	// Transient failures (API error, empty response, network blip) do NOT count toward escalation
	if failure == FailureTransient {
		return Decision{FailureKind: FailureTransient}
	}

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

func isSuccessfulOutcome(outcome *orchestrator.Outcome) bool {
	return outcome.StopReason == "no_tool_calls" && outcome.FinalMessage != ""
}

func ClassifyFailure(outcome *orchestrator.Outcome) FailureKind {
	if outcome == nil {
		return FailureNone
	}
	// Transient provider/network errors should not count toward escalation
	if outcome.Transient {
		return FailureTransient
	}
	switch outcome.StopReason {
	case "error":
		if isTransientErrorMessage(outcome.FinalMessage) {
			return FailureTransient
		}
		return FailureError
	case "max_steps":
		return FailureMaxSteps
	default:
		return FailureNone
	}
}

func isTransientErrorMessage(msg string) bool {
	return strings.Contains(msg, "API error 5") ||
		strings.Contains(msg, "API error 429") ||
		strings.Contains(msg, "empty assistant response") ||
		strings.Contains(msg, "request failed") ||
		strings.Contains(msg, "read stream")
}
