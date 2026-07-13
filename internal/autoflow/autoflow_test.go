package autoflow

import (
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/soul"
)

func TestEscalatorSwitchesToDebugAfterThreshold(t *testing.T) {
	escalator := &Escalator{Threshold: 2}
	decision := escalator.Record(&soul.Outcome{StopReason: "error", FinalMessage: "first"}, "code")
	if decision.Action != ActionNone {
		t.Fatalf("expected no action on first error, got %+v", decision)
	}
	decision = escalator.Record(&soul.Outcome{StopReason: "error", FinalMessage: "second"}, "code")
	if decision.Action != ActionDebug || decision.TargetMode != "debug" || decision.FailureKind != FailureError {
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

func TestEscalatorResetClearsState(t *testing.T) {
	escalator := &Escalator{Threshold: 1}
	escalator.Record(&soul.Outcome{StopReason: "error"}, "code")
	escalator.Reset()
	if escalator.Consecutive != 0 || escalator.AutoDebug || escalator.PreviousMode != "" {
		t.Fatalf("expected reset state, got %+v", escalator)
	}
}

func TestEscalatorDoesNotEscalateAlreadyDebug(t *testing.T) {
	escalator := &Escalator{Threshold: 1}
	decision := escalator.Record(&soul.Outcome{StopReason: "error"}, "debug")
	if decision.Action != ActionNone {
		t.Fatalf("expected no action when already in debug, got %+v", decision)
	}
}

func TestEscalatorEscalatesOnMaxSteps(t *testing.T) {
	escalator := &Escalator{Threshold: 1}
	decision := escalator.Record(&soul.Outcome{StopReason: "max_steps", FinalMessage: "达到最大步骤数"}, "code")
	if decision.Action != ActionDebug || decision.TargetMode != "debug" || decision.FailureKind != FailureMaxSteps {
		t.Fatalf("expected max_steps debug escalation, got %+v", decision)
	}
}

func TestClassifyFailure(t *testing.T) {
	cases := []struct {
		name string
		out  *soul.Outcome
		want FailureKind
	}{
		{name: "nil", out: nil, want: FailureNone},
		{name: "error", out: &soul.Outcome{StopReason: "error"}, want: FailureError},
		{name: "max steps", out: &soul.Outcome{StopReason: "max_steps"}, want: FailureMaxSteps},
		{name: "success", out: &soul.Outcome{StopReason: "no_tool_calls", FinalMessage: "ok"}, want: FailureNone},
		{name: "approval", out: &soul.Outcome{StopReason: "requires_approval"}, want: FailureNone},
		{name: "transient flag", out: &soul.Outcome{StopReason: "error", FinalMessage: "API error 400", Transient: true}, want: FailureTransient},
		{name: "transient msg", out: &soul.Outcome{StopReason: "error", FinalMessage: "API error 502: upstream down", Transient: false}, want: FailureTransient},
		{name: "transient empty", out: &soul.Outcome{StopReason: "error", FinalMessage: "empty assistant response from model"}, want: FailureTransient},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ClassifyFailure(tc.out); got != tc.want {
				t.Fatalf("expected %q, got %q", tc.want, got)
			}
		})
	}
}

func TestTransientFailuresDoNotIncrementConsecutive(t *testing.T) {
	escalator := &Escalator{Threshold: 2}
	// Two transient errors should not increment consecutive
	escalator.Record(&soul.Outcome{StopReason: "error", FinalMessage: "API error 502", Transient: true}, "code")
	if escalator.Consecutive != 0 {
		t.Fatalf("expected transient to not increment consecutive, got %d", escalator.Consecutive)
	}
	escalator.Record(&soul.Outcome{StopReason: "error", FinalMessage: "API error 502", Transient: true}, "code")
	if escalator.Consecutive != 0 {
		t.Fatalf("expected second transient to also not increment, got %d", escalator.Consecutive)
	}

	// First real error: Consecutive=1, no escalation
	decision := escalator.Record(&soul.Outcome{StopReason: "error", FinalMessage: "tool not found: foo"}, "code")
	if decision.Action != ActionNone || escalator.Consecutive != 1 {
		t.Fatalf("expected first real error to set Consecutive=1, decision=%+v state=%+v", decision, escalator)
	}

	// Second real error triggers escalation
	decision = escalator.Record(&soul.Outcome{StopReason: "error", FinalMessage: "tool not found: bar"}, "code")
	if decision.Action != ActionDebug {
		t.Fatalf("expected second real error to escalate, got %+v", decision)
	}
}

func TestEscalatorNilAndDefaultBoundaryBehavior(t *testing.T) {
	var nilEscalator *Escalator
	if decision := nilEscalator.Record(&soul.Outcome{StopReason: "error"}, "code"); decision.Action != ActionNone {
		t.Fatalf("nil escalator should do nothing, got %+v", decision)
	}
	nilEscalator.Reset()

	escalator := &Escalator{Threshold: 0}
	if decision := escalator.Record(nil, "code"); decision.Action != ActionNone || escalator.Consecutive != 0 {
		t.Fatalf("nil outcome should do nothing, decision=%+v state=%+v", decision, escalator)
	}
	if decision := escalator.Record(&soul.Outcome{StopReason: "error"}, ""); decision.Action != ActionNone {
		t.Fatalf("default threshold first failure should not escalate, got %+v", decision)
	}
	decision := escalator.Record(&soul.Outcome{StopReason: "error"}, "")
	if decision.Action != ActionDebug || decision.TargetMode != "debug" || escalator.PreviousMode != "code" {
		t.Fatalf("expected default threshold escalation from implicit code mode, decision=%+v state=%+v", decision, escalator)
	}
}

func TestSuccessfulOutcomeRequiresFinalMessage(t *testing.T) {
	if isSuccessfulOutcome(&soul.Outcome{StopReason: "no_tool_calls"}) {
		t.Fatal("expected no_tool_calls without final message to be unsuccessful")
	}
	if !isSuccessfulOutcome(&soul.Outcome{StopReason: "no_tool_calls", FinalMessage: "done"}) {
		t.Fatal("expected final no_tool_calls message to be successful")
	}
}
