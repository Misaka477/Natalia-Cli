package presentation

import (
	"testing"
	"time"
)

func mkEvent(typ EventType, id string, data any) Event {
	return Event{
		Type:      typ,
		ID:        id,
		Timestamp: time.Now(),
		Data:      data,
	}
}

func mkEventWithCID(typ EventType, id string, cid CorrelationID, data any) Event {
	e := mkEvent(typ, id, data)
	e.CorrelationID = cid
	return e
}

// --- Turn lifecycle ---

func TestReduce_TurnBeginEnd(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtTurnBegin, "t1", TurnBeginPayload{Input: "hello"}))
	if !s.ActiveTurn {
		t.Fatal("expected active turn")
	}
	if s.TurnInput != "hello" {
		t.Fatalf("expected turn input 'hello', got %q", s.TurnInput)
	}
	s = Reduce(s, mkEvent(EvtTurnEnd, "t1", TurnEndPayload{StopReason: "stop"}))
	if s.ActiveTurn {
		t.Fatal("expected inactive turn")
	}
}

// --- Step lifecycle ---

func TestReduce_StepLifecycle(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtStepBegin, "s1", nil))
	if s.CurrentStep != "s1" || s.StepStatus != "running" {
		t.Fatalf("step=%s status=%s", s.CurrentStep, s.StepStatus)
	}
	s = Reduce(s, mkEvent(EvtStepRetry, "s1", nil))
	if s.StepStatus != "retrying" {
		t.Fatalf("expected retrying, got %s", s.StepStatus)
	}
	s = Reduce(s, mkEvent(EvtStepEnd, "s1", nil))
	if s.StepStatus != "completed" {
		t.Fatalf("expected completed, got %s", s.StepStatus)
	}
}

// --- Tool lifecycle ---

func TestReduce_ToolBeginEnd(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtToolBegin, "tool1", ToolBeginPayload{Name: "bash", Arguments: map[string]any{"cmd": "ls"}}))
	if s.ActiveTool != "bash" || s.ToolStatus != "running" {
		t.Fatalf("tool=%s status=%s", s.ActiveTool, s.ToolStatus)
	}
	s = Reduce(s, mkEvent(EvtToolEnd, "tool1", ToolEndPayload{Result: "ok"}))
	if s.ToolStatus != "completed" {
		t.Fatalf("expected completed, got %s", s.ToolStatus)
	}
}

func TestReduce_ToolFailed(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtToolBegin, "t1", ToolBeginPayload{Name: "bash"}))
	s = Reduce(s, mkEvent(EvtToolEnd, "t1", ToolEndPayload{Error: "exit 1"}))
	if s.ToolStatus != "failed" {
		t.Fatalf("expected failed, got %s", s.ToolStatus)
	}
}

// --- Approval lifecycle ---

func TestReduce_ApprovalRequestResult(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtApprovalRequest, "a1", ApprovalRequestPayload{ID: "a1", ToolName: "write"}))
	if len(s.PendingApprovals) != 1 || s.PendingApprovals[0].ToolName != "write" {
		t.Fatal("expected 1 pending approval")
	}
	s = Reduce(s, mkEvent(EvtApprovalResult, "a1", ApprovalResultPayload{ID: "a1", Approved: true}))
	if len(s.PendingApprovals) != 0 {
		t.Fatal("expected approval removed")
	}
}

// --- Question lifecycle ---

func TestReduce_QuestionRequestResult(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtQuestionRequest, "q1", QuestionRequestPayload{ID: "q1", Prompt: "ok?"}))
	if len(s.PendingQuestions) != 1 {
		t.Fatal("expected 1 pending question")
	}
	s = Reduce(s, mkEvent(EvtQuestionResult, "q1", QuestionResultPayload{ID: "q1"}))
	if len(s.PendingQuestions) != 0 {
		t.Fatal("expected question removed")
	}
}

// --- Compaction ---

func TestReduce_Compaction(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtCompactBegin, "c1", CompactionBeginPayload{Trigger: "ratio"}))
	if !s.IsCompacting || s.CompactTrigger != "ratio" {
		t.Fatal("expected compacting")
	}
	s = Reduce(s, mkEvent(EvtCompactEnd, "c1", nil))
	if s.IsCompacting || s.CompactTrigger != "" {
		t.Fatal("expected not compacting")
	}
}

// --- Workflow ---

func TestReduce_WorkflowBeginEnd(t *testing.T) {
	s := Reduce(nil, mkEventWithCID(EvtWorkflowBegin, "w1", CorrelationID{Run: "run1"}, nil))
	if s.ActiveWorkflow != "run1" {
		t.Fatalf("expected 'run1', got %q", s.ActiveWorkflow)
	}
	s = Reduce(s, mkEvent(EvtWorkflowEnd, "w1", nil))
	if s.ActiveWorkflow != "" {
		t.Fatal("expected empty workflow")
	}
}

func TestReduce_WorkflowFallbackID(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtWorkflowBegin, "w1", nil))
	if s.ActiveWorkflow != "w1" {
		t.Fatalf("expected 'w1', got %q", s.ActiveWorkflow)
	}
}

// --- PTY ---

func TestReduce_PTYTransitions(t *testing.T) {
	s := Reduce(nil, mkEventWithCID(EvtPTYBegin, "pty1", CorrelationID{Resource: "pty-abc"}, nil))
	if s.ActivePTY != "pty-abc" {
		t.Fatalf("expected 'pty-abc', got %q", s.ActivePTY)
	}
	s = Reduce(s, mkEvent(EvtPTYOutput, "pty1", PTYOutputPayload{Output: "line1"}))
	if len(s.PTYOutput) != 1 || s.PTYOutput[0] != "line1" {
		t.Fatal("expected 1 pty output line")
	}
	s = Reduce(s, mkEvent(EvtPTYEnd, "pty1", nil))
	if s.ActivePTY != "" {
		t.Fatal("expected empty active pty")
	}
}

func TestReduce_PTYOutputRingBuffer(t *testing.T) {
	lines := make([]Event, 0, 150)
	for i := 0; i < 150; i++ {
		lines = append(lines, mkEvent(EvtPTYOutput, "", PTYOutputPayload{Output: "line"}))
	}
	s := Rebuild(lines)
	if len(s.PTYOutput) != 100 {
		t.Fatalf("expected 100 lines, got %d", len(s.PTYOutput))
	}
}

// --- Sandbox ---

func TestReduce_SandboxTransitions(t *testing.T) {
	s := Reduce(nil, mkEventWithCID(EvtSandboxBegin, "sb1", CorrelationID{Resource: "sb-xyz"}, nil))
	if s.ActiveSandbox != "sb-xyz" {
		t.Fatalf("expected 'sb-xyz', got %q", s.ActiveSandbox)
	}
	s = Reduce(s, mkEvent(EvtSandboxEnd, "sb1", nil))
	if s.ActiveSandbox != "" {
		t.Fatal("expected empty sandbox")
	}
}

// --- Rollback ---

func TestReduce_Rollback(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtCheckpointCreate, "cp1", CheckpointPayload{ID: "cp1"}))
	if s.IsRollingBack {
		t.Fatal("should not be rolling back on checkpoint")
	}
	s = Reduce(s, mkEvent(EvtRollbackBegin, "cp1", nil))
	if !s.IsRollingBack {
		t.Fatal("expected rolling back")
	}
	s = Reduce(s, mkEvent(EvtRollbackEnd, "cp1", nil))
	if s.IsRollingBack {
		t.Fatal("expected not rolling back")
	}
}

// --- Retry lifecycle ---

func TestReduce_RetryLifecycle(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtRetryBegin, "r1", RetryBeginPayload{Attempt: 1, MaxAttempts: 3}))
	if !s.IsRetrying || s.RetryCount != 1 {
		t.Fatalf("retrying=%v count=%d", s.IsRetrying, s.RetryCount)
	}
	s = Reduce(s, mkEvent(EvtRetryEnd, "r1", nil))
	if s.IsRetrying {
		t.Fatal("expected not retrying")
	}
}

func TestReduce_RetryIncrements(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtRetryBegin, "r1", RetryBeginPayload{Attempt: 1, MaxAttempts: 3}))
	s = Reduce(s, mkEvent(EvtRetryEnd, "r1", nil))
	s = Reduce(s, mkEvent(EvtRetryBegin, "r2", RetryBeginPayload{Attempt: 2, MaxAttempts: 3}))
	if s.RetryCount != 2 {
		t.Fatalf("expected count 2, got %d", s.RetryCount)
	}
}

// --- Agent depth ---

func TestReduce_AgentDepth(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtAgentBegin, "a1", nil))
	if s.ActiveAgentDepth != 1 {
		t.Fatalf("expected depth 1, got %d", s.ActiveAgentDepth)
	}
	s = Reduce(s, mkEvent(EvtAgentBegin, "a1", nil))
	if s.ActiveAgentDepth != 2 {
		t.Fatalf("expected depth 2, got %d", s.ActiveAgentDepth)
	}
	s = Reduce(s, mkEvent(EvtAgentEnd, "a1", nil))
	if s.ActiveAgentDepth != 1 {
		t.Fatalf("expected depth 1, got %d", s.ActiveAgentDepth)
	}
	s = Reduce(s, mkEvent(EvtAgentEnd, "a1", nil))
	if s.ActiveAgentDepth != 0 {
		t.Fatalf("expected depth 0, got %d", s.ActiveAgentDepth)
	}
}

// --- Status ---

func TestReduce_StatusUpdate(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtStatusUpdate, "", StatusUpdatePayload{Key: "mode", Value: "code"}))
	if s.Status["mode"] != "code" {
		t.Fatalf("expected mode=code, got %q", s.Status["mode"])
	}
	s = Reduce(s, mkEvent(EvtStatusUpdate, "", StatusUpdatePayload{Key: "mode", Value: "agent"}))
	if s.Status["mode"] != "agent" {
		t.Fatalf("expected mode=agent, got %q", s.Status["mode"])
	}
}

// --- Notification ring buffer ---

func TestReduce_NotificationRingBuffer(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtNotification, "", NotificationPayload{Severity: "info", Message: "m1"}))
	if len(s.Notifications) != 1 || s.Notifications[0].Message != "m1" {
		t.Fatal("expected 1 notification")
	}
	for i := 2; i <= 7; i++ {
		msg := "m" + string(rune('0'+i))
		s = Reduce(s, mkEvent(EvtNotification, "", NotificationPayload{Severity: "info", Message: msg}))
	}
	if len(s.Notifications) != 5 {
		t.Fatalf("expected 5 notifications, got %d", len(s.Notifications))
	}
	if s.Notifications[0].Message != "m7" {
		t.Fatalf("expected newest 'm7' first, got %q", s.Notifications[0].Message)
	}
}

// --- External message passes through ---

func TestReduce_ExternalMessagePassthrough(t *testing.T) {
	s := &State{ActiveTurn: true}
	s2 := Reduce(s, mkEvent(EvtExternalMessage, "", nil))
	if !s2.ActiveTurn {
		t.Fatal("external message should not change state")
	}
}

// --- Rebuild ---

func TestRebuild(t *testing.T) {
	events := []Event{
		mkEvent(EvtTurnBegin, "t1", TurnBeginPayload{Input: "hello"}),
		mkEvent(EvtStepBegin, "s1", nil),
		mkEvent(EvtToolBegin, "tool1", ToolBeginPayload{Name: "bash", Arguments: map[string]any{"cmd": "ls"}}),
		mkEvent(EvtToolEnd, "tool1", ToolEndPayload{Result: "ok"}),
		mkEvent(EvtStepEnd, "s1", nil),
		mkEvent(EvtTurnEnd, "t1", TurnEndPayload{StopReason: "stop"}),
	}
	s := Rebuild(events)
	if s.ActiveTurn {
		t.Fatal("should not be active")
	}
	if s.StepStatus != "completed" {
		t.Fatalf("expected completed, got %s", s.StepStatus)
	}
	if s.ToolStatus != "completed" {
		t.Fatalf("expected completed, got %s", s.ToolStatus)
	}
}

// --- Nil state safety ---

func TestReduce_NilState(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtStatusUpdate, "", StatusUpdatePayload{Key: "a", Value: "b"}))
	if s.Status["a"] != "b" {
		t.Fatal("nil state should be initialized")
	}
}

// --- Modular priority: pending approvals and questions coexist ---

func TestReduce_ModalPriority(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtApprovalRequest, "a1", ApprovalRequestPayload{ID: "a1", ToolName: "write"}))
	s = Reduce(s, mkEvent(EvtQuestionRequest, "q1", QuestionRequestPayload{ID: "q1", Prompt: "continue?"}))
	if len(s.PendingApprovals) != 1 {
		t.Fatal("expected 1 approval")
	}
	if len(s.PendingQuestions) != 1 {
		t.Fatal("expected 1 question")
	}
}

// --- Workflow step tracking ---

func TestReduce_WorkflowSteps(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtWorkflowBegin, "w1", nil))
	s = Reduce(s, mkEvent(EvtWorkflowStep, "w1", WorkflowStepPayload{WorkflowName: "wf", StepName: "build", Status: "running"}))
	if len(s.WorkflowSteps) != 1 || s.WorkflowSteps[0].StepName != "build" {
		t.Fatal("expected workflow step recorded")
	}
}

// --- Retry payload fields ---

func TestReduce_RetryBeginPayload(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtRetryBegin, "r1", RetryBeginPayload{
		StepID:      "s1",
		Attempt:     2,
		MaxAttempts: 3,
		LastError:   "timeout",
	}))
	if !s.IsRetrying || s.RetryCount != 1 {
		t.Fatal("expecting retry state")
	}
}

// --- Tool ordering with approval ---

func TestReduce_ToolWithApprovalOrdering(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtToolBegin, "t1", ToolBeginPayload{Name: "write"}))
	if s.ToolStatus != "running" {
		t.Fatal("expected running")
	}
	s = Reduce(s, mkEvent(EvtApprovalRequest, "a1", ApprovalRequestPayload{ID: "a1", ToolName: "write"}))
	if len(s.PendingApprovals) != 1 {
		t.Fatal("expected pending approval")
	}
	s = Reduce(s, mkEvent(EvtApprovalResult, "a1", ApprovalResultPayload{ID: "a1", Approved: true}))
	if len(s.PendingApprovals) != 0 {
		t.Fatal("expected approval cleared")
	}
	s = Reduce(s, mkEvent(EvtToolEnd, "t1", ToolEndPayload{Result: "done"}))
	if s.ToolStatus != "completed" {
		t.Fatal("expected completed")
	}
}

// --- Compaction begin end ---

func TestReduce_CompactionLifecycle(t *testing.T) {
	s := Reduce(nil, mkEvent(EvtCompactBegin, "c1", CompactionBeginPayload{Trigger: "manual"}))
	if !s.IsCompacting || s.CompactTrigger != "manual" {
		t.Fatal("expected compacting with manual trigger")
	}
	s = Reduce(s, mkEvent(EvtCompactEnd, "c1", nil))
	if s.IsCompacting || s.CompactTrigger != "" {
		t.Fatal("expected not compacting")
	}
}

// --- Multiple events rebuild ---

func TestRebuild_WithAllEventTypes(t *testing.T) {
	events := []Event{
		mkEvent(EvtTurnBegin, "t1", TurnBeginPayload{Input: "input"}),
		mkEvent(EvtStepBegin, "s1", nil),
		mkEvent(EvtToolBegin, "tool1", ToolBeginPayload{Name: "bash"}),
		mkEvent(EvtToolEnd, "tool1", ToolEndPayload{Result: "ok"}),
		mkEvent(EvtStepEnd, "s1", nil),
		mkEventWithCID(EvtPTYBegin, "pty1", CorrelationID{Resource: "r1"}, nil),
		mkEvent(EvtPTYOutput, "pty1", PTYOutputPayload{Output: "out"}),
		mkEvent(EvtPTYEnd, "pty1", nil),
		mkEventWithCID(EvtSandboxBegin, "sb1", CorrelationID{Resource: "r2"}, nil),
		mkEvent(EvtSandboxEnd, "sb1", nil),
		mkEvent(EvtRetryBegin, "r1", RetryBeginPayload{Attempt: 1, MaxAttempts: 3}),
		mkEvent(EvtRetryEnd, "r1", nil),
		mkEvent(EvtAgentBegin, "a1", nil),
		mkEvent(EvtAgentEnd, "a1", nil),
		mkEvent(EvtCompactBegin, "c1", CompactionBeginPayload{Trigger: "ratio"}),
		mkEvent(EvtCompactEnd, "c1", nil),
		mkEvent(EvtStatusUpdate, "", StatusUpdatePayload{Key: "k", Value: "v"}),
		mkEvent(EvtNotification, "", NotificationPayload{Severity: "info", Message: "hi"}),
		mkEvent(EvtExternalMessage, "", nil),
		mkEvent(EvtTurnEnd, "t1", TurnEndPayload{StopReason: "done"}),
	}
	s := Rebuild(events)
	if s.ActiveTurn {
		t.Fatal("expected inactive turn")
	}
	if s.StepStatus != "completed" {
		t.Fatal("expected step completed")
	}
	if s.ToolStatus != "completed" {
		t.Fatal("expected tool completed")
	}
	if s.ActivePTY != "" {
		t.Fatal("expected no active pty")
	}
	if s.ActiveSandbox != "" {
		t.Fatal("expected no active sandbox")
	}
	if s.IsRetrying {
		t.Fatal("expected not retrying")
	}
	if s.RetryCount != 1 {
		t.Fatalf("expected retry count 1, got %d", s.RetryCount)
	}
	if s.ActiveAgentDepth != 0 {
		t.Fatalf("expected agent depth 0, got %d", s.ActiveAgentDepth)
	}
	if s.IsCompacting {
		t.Fatal("expected not compacting")
	}
	if s.Status["k"] != "v" {
		t.Fatal("expected status k=v")
	}
	if len(s.Notifications) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(s.Notifications))
	}
}

// --- State immutability ---

func TestReduce_Immutability(t *testing.T) {
	orig := &State{
		ActiveTurn: true,
		TurnInput:  "orig",
		Status:     map[string]string{"k": "v"},
	}
	s := Reduce(orig, mkEvent(EvtStatusUpdate, "", StatusUpdatePayload{Key: "k2", Value: "v2"}))
	if orig.Status["k2"] != "" {
		t.Fatal("original state should not be mutated")
	}
	if s.Status["k2"] != "v2" {
		t.Fatal("new state should have the update")
	}
}
