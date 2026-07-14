package audit

import "time"

type Level string

const (
	LevelAllow            Level = "allow"
	LevelExplicitApproval Level = "explicit_approval"
	LevelHardDeny         Level = "hard_deny"
)

type PolicyDecision struct {
	ID           string
	ToolName     string
	Level        Level
	Rule         string
	Decision     string
	ApprovalMode string
	Time         time.Time
}
