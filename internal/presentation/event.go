package presentation

import "time"

type CorrelationID struct {
	Session  string `json:"session,omitempty"`
	Turn     string `json:"turn,omitempty"`
	Step     string `json:"step,omitempty"`
	Tool     string `json:"tool,omitempty"`
	Run      string `json:"run,omitempty"`
	Task     string `json:"task,omitempty"`
	Resource string `json:"resource,omitempty"`
}

type EventType string

const (
	EvtTurnBegin  EventType = "turn.begin"
	EvtTurnEnd    EventType = "turn.end"
	EvtSteerInput EventType = "steer.input"

	EvtStepBegin EventType = "step.begin"
	EvtStepRetry EventType = "step.retry"
	EvtStepEnd   EventType = "step.end"

	EvtContentPart   EventType = "content.part"
	EvtContentEnd    EventType = "content.end"
	EvtThinkingBegin EventType = "thinking.begin"
	EvtThinkingEnd   EventType = "thinking.end"

	EvtToolBegin EventType = "tool.begin"
	EvtToolPart  EventType = "tool.part"
	EvtToolEnd   EventType = "tool.end"

	EvtApprovalRequest EventType = "approval.request"
	EvtApprovalResult  EventType = "approval.result"
	EvtQuestionRequest EventType = "question.request"
	EvtQuestionResult  EventType = "question.result"

	EvtRetryBegin EventType = "retry.begin"
	EvtRetryEnd   EventType = "retry.end"

	EvtCompactBegin EventType = "compact.begin"
	EvtCompactEnd   EventType = "compact.end"

	EvtWorkflowBegin EventType = "workflow.begin"
	EvtWorkflowStep  EventType = "workflow.step"
	EvtWorkflowEnd   EventType = "workflow.end"

	EvtSkillActivate   EventType = "skill.activate"
	EvtSkillDeactivate EventType = "skill.deactivate"

	EvtAgentBegin EventType = "agent.begin"
	EvtAgentEnd   EventType = "agent.end"

	EvtProcessBegin  EventType = "process.begin"
	EvtProcessOutput EventType = "process.output"
	EvtProcessEnd    EventType = "process.end"

	EvtPTYBegin  EventType = "pty.begin"
	EvtPTYOutput EventType = "pty.output"
	EvtPTYEnd    EventType = "pty.end"

	EvtSandboxBegin EventType = "sandbox.begin"
	EvtSandboxEnd   EventType = "sandbox.end"

	EvtCheckpointCreate EventType = "checkpoint.create"
	EvtRollbackBegin    EventType = "rollback.begin"
	EvtRollbackEnd      EventType = "rollback.end"

	EvtStatusUpdate EventType = "status.update"
	EvtNotification EventType = "notification"

	EvtExternalMessage EventType = "external.message"
)

type Event struct {
	Type          EventType     `json:"type"`
	ID            string        `json:"id"`
	CorrelationID CorrelationID `json:"cid"`
	Timestamp     time.Time     `json:"timestamp"`
	Data          any           `json:"data,omitempty"`
}
