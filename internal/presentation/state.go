package presentation

type State struct {
	ActiveTurn       bool
	TurnInput        string
	CurrentStep      string
	StepStatus       string
	ActiveTool       string
	ToolStatus       string
	PendingApprovals []ApprovalRequestPayload
	PendingQuestions []QuestionRequestPayload
	IsCompacting     bool
	CompactTrigger   string
	ActiveWorkflow   string
	WorkflowSteps    []WorkflowStepPayload
	ActivePTY        string
	PTYOutput        []string
	ActiveSandbox    string
	IsRollingBack    bool
	IsRetrying       bool
	RetryCount       int
	ActiveAgentDepth int
	Status           map[string]string
	Notifications    []NotificationPayload
}
