package autoflow

import (
	"testing"

	"github.com/aquama/natalia-cli/internal/soul"
)

func TestEscalatorSwitchesToDebugAfterThreshold(t *testing.T) {
	escalator := &Escalator{Threshold: 2}
	decision := escalator.Record(&soul.Outcome{StopReason: "error", FinalMessage: "first"}, "code")
	if decision.Action != ActionNone {
		t.Fatalf("expected no action on first error, got %+v", decision)
	}
	decision = escalator.Record(&soul.Outcome{StopReason: "error", FinalMessage: "second"}, "code")
	if decision.Action != ActionDebug || decision.TargetMode != "debug" {
		t.Fatalf("expected debug escalation, got %+v", decision)
	}
	if !escalator.AutoDebug || escalator.PreviousMode != "code" || escalator.Consecutive != 0 {
		t.Fatalf("unexpected escalator state: %+v", escalator)
	}
}

func TestEscalatorRecoversPreviousModeAfterDebugSuccess(t *testing.T) {
	escalator := &Escalator{Threshold: 1}
	decision := escalator.Record(&soul.Outcome{StopReason: "error", FinalMessage: "fail"}, "code")
	if decision.Action != ActionDebug {
		t.Fatalf("expected debug escalation, got %+v", decision)
	}
	decision = escalator.Record(&soul.Outcome{StopReason: "no_tool_calls", FinalMessage: "fixed"}, "debug")
	if decision.Action != ActionRecoveredMode || decision.TargetMode != "code" {
		t.Fatalf("expected recovery to previous mode, got %+v", decision)
	}
	if escalator.AutoDebug || escalator.PreviousMode != "" || escalator.Consecutive != 0 {
		t.Fatalf("expected reset escalator state, got %+v", escalator)
	}
}

func TestEscalatorResetsAfterSuccess(t *testing.T) {
	escalator := &Escalator{Threshold: 2}
	escalator.Record(&soul.Outcome{StopReason: "error"}, "code")
	escalator.Record(&soul.Outcome{StopReason: "no_tool_calls", FinalMessage: "ok"}, "code")
	if escalator.Consecutive != 0 {
		t.Fatalf("expected success to reset failure counter, got %d", escalator.Consecutive)
	}
}

func TestEscalatorDoesNotEscalateAlreadyDebug(t *testing.T) {
	escalator := &Escalator{Threshold: 1}
	decision := escalator.Record(&soul.Outcome{StopReason: "error"}, "debug")
	if decision.Action != ActionNone {
		t.Fatalf("expected no action when already in debug, got %+v", decision)
	}
}
