package presentation

type TurnBeginPayload struct {
	Input string `json:"input,omitempty"`
}

type TurnEndPayload struct {
	StopReason string `json:"stop_reason,omitempty"`
}

type ContentPartPayload struct {
	Content    string `json:"content"`
	IsThinking bool   `json:"is_thinking,omitempty"`
}

type ContentEndPayload struct {
	FullContent string `json:"full_content,omitempty"`
}

type ToolBeginPayload struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
}

type ToolPartPayload struct {
	JSONFragment string `json:"json_fragment"`
}

type ToolEndPayload struct {
	Result string `json:"result"`
	Error  string `json:"error,omitempty"`
}

type ApprovalRequestPayload struct {
	ID          string         `json:"id"`
	ToolName    string         `json:"tool_name"`
	Arguments   map[string]any `json:"arguments"`
	RequireOnce bool           `json:"require_once,omitempty"`
}

type ApprovalResultPayload struct {
	ID       string `json:"id"`
	Approved bool   `json:"approved"`
	Feedback string `json:"feedback,omitempty"`
}

type QuestionRequestPayload struct {
	ID      string   `json:"id"`
	Prompt  string   `json:"prompt"`
	Options []string `json:"options,omitempty"`
	Multi   bool     `json:"multi,omitempty"`
}

type QuestionResultPayload struct {
	ID     string   `json:"id"`
	Answer string   `json:"answer,omitempty"`
	Multi  []string `json:"multi,omitempty"`
}

type CompactionBeginPayload struct {
	Trigger string `json:"trigger"`
}

type WorkflowStepPayload struct {
	WorkflowName string `json:"workflow_name"`
	StepName     string `json:"step_name"`
	Status       string `json:"status"`
}

type PTYOutputPayload struct {
	Output string `json:"output"`
	More   bool   `json:"more,omitempty"`
}

type StatusUpdatePayload struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type NotificationPayload struct {
	Severity string `json:"severity"`
	Message  string `json:"message"`
}

type RetryBeginPayload struct {
	StepID      string `json:"step_id"`
	Attempt     int    `json:"attempt"`
	MaxAttempts int    `json:"max_attempts"`
	LastError   string `json:"last_error,omitempty"`
}

type CheckpointPayload struct {
	ID     string `json:"id"`
	Reason string `json:"reason,omitempty"`
}
