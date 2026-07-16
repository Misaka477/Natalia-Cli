package presentation

func cloneState(s *State) *State {
	if s == nil {
		return &State{
			Status:        make(map[string]string),
			Notifications: make([]NotificationPayload, 0, 5),
		}
	}
	ns := *s
	if s.Status != nil {
		ns.Status = make(map[string]string, len(s.Status))
		for k, v := range s.Status {
			ns.Status[k] = v
		}
	}
	if s.PendingApprovals != nil {
		ns.PendingApprovals = make([]ApprovalRequestPayload, len(s.PendingApprovals))
		copy(ns.PendingApprovals, s.PendingApprovals)
	}
	if s.PendingQuestions != nil {
		ns.PendingQuestions = make([]QuestionRequestPayload, len(s.PendingQuestions))
		copy(ns.PendingQuestions, s.PendingQuestions)
	}
	if s.WorkflowSteps != nil {
		ns.WorkflowSteps = make([]WorkflowStepPayload, len(s.WorkflowSteps))
		copy(ns.WorkflowSteps, s.WorkflowSteps)
	}
	if s.PTYOutput != nil {
		ns.PTYOutput = make([]string, len(s.PTYOutput))
		copy(ns.PTYOutput, s.PTYOutput)
	}
	if s.Notifications != nil {
		ns.Notifications = make([]NotificationPayload, len(s.Notifications))
		copy(ns.Notifications, s.Notifications)
	}
	return &ns
}

func Reduce(state *State, event Event) *State {
	s := cloneState(state)

	switch event.Type {
	case EvtTurnBegin:
		s.ActiveTurn = true
		s.TurnInput = typedData[TurnBeginPayload](event.Data).Input
	case EvtTurnEnd:
		s.ActiveTurn = false

	case EvtStepBegin:
		s.CurrentStep = event.ID
		s.StepStatus = "running"
	case EvtStepEnd:
		s.StepStatus = "completed"
	case EvtStepRetry:
		s.StepStatus = "retrying"

	case EvtToolBegin:
		p := typedData[ToolBeginPayload](event.Data)
		s.ActiveTool = p.Name
		s.ToolStatus = "running"
	case EvtToolEnd:
		p := typedData[ToolEndPayload](event.Data)
		if p.Error != "" {
			s.ToolStatus = "failed"
		} else {
			s.ToolStatus = "completed"
		}

	case EvtApprovalRequest:
		p := typedData[ApprovalRequestPayload](event.Data)
		s.PendingApprovals = append(s.PendingApprovals, p)
	case EvtApprovalResult:
		p := typedData[ApprovalResultPayload](event.Data)
		for i, a := range s.PendingApprovals {
			if a.ID == p.ID {
				s.PendingApprovals = append(s.PendingApprovals[:i], s.PendingApprovals[i+1:]...)
				break
			}
		}

	case EvtQuestionRequest:
		p := typedData[QuestionRequestPayload](event.Data)
		s.PendingQuestions = append(s.PendingQuestions, p)
	case EvtQuestionResult:
		p := typedData[QuestionResultPayload](event.Data)
		for i, q := range s.PendingQuestions {
			if q.ID == p.ID {
				s.PendingQuestions = append(s.PendingQuestions[:i], s.PendingQuestions[i+1:]...)
				break
			}
		}

	case EvtCompactBegin:
		s.IsCompacting = true
		s.CompactTrigger = typedData[CompactionBeginPayload](event.Data).Trigger
	case EvtCompactEnd:
		s.IsCompacting = false
		s.CompactTrigger = ""

	case EvtWorkflowBegin:
		id := event.CorrelationID.Run
		if id == "" {
			id = event.ID
		}
		s.ActiveWorkflow = id
	case EvtWorkflowStep:
		p := typedData[WorkflowStepPayload](event.Data)
		s.WorkflowSteps = append(s.WorkflowSteps, p)
	case EvtWorkflowEnd:
		s.ActiveWorkflow = ""

	case EvtPTYBegin:
		s.ActivePTY = event.CorrelationID.Resource
	case EvtPTYOutput:
		p := typedData[PTYOutputPayload](event.Data)
		n := len(s.PTYOutput)
		if n >= 100 {
			s.PTYOutput = s.PTYOutput[n-99:]
		}
		s.PTYOutput = append(s.PTYOutput, p.Output)
	case EvtPTYEnd:
		s.ActivePTY = ""

	case EvtSandboxBegin:
		s.ActiveSandbox = event.CorrelationID.Resource
	case EvtSandboxEnd:
		s.ActiveSandbox = ""

	case EvtCheckpointCreate:
	case EvtRollbackBegin:
		s.IsRollingBack = true
	case EvtRollbackEnd:
		s.IsRollingBack = false

	case EvtRetryBegin:
		s.IsRetrying = true
		s.RetryCount++
	case EvtRetryEnd:
		s.IsRetrying = false

	case EvtAgentBegin:
		s.ActiveAgentDepth++
	case EvtAgentEnd:
		if s.ActiveAgentDepth > 0 {
			s.ActiveAgentDepth--
		}

	case EvtStatusUpdate:
		p := typedData[StatusUpdatePayload](event.Data)
		if s.Status == nil {
			s.Status = make(map[string]string)
		}
		s.Status[p.Key] = p.Value

	case EvtNotification:
		p := typedData[NotificationPayload](event.Data)
		s.Notifications = append([]NotificationPayload{p}, s.Notifications...)
		if len(s.Notifications) > 5 {
			s.Notifications = s.Notifications[:5]
		}

	case EvtExternalMessage:
	}

	return s
}

func Rebuild(events []Event) *State {
	s := &State{
		Status:        make(map[string]string),
		Notifications: make([]NotificationPayload, 0, 5),
	}
	for _, e := range events {
		s = Reduce(s, e)
	}
	return s
}

func typedData[T any](data any) T {
	if data == nil {
		var zero T
		return zero
	}
	v, ok := data.(T)
	if !ok {
		var zero T
		return zero
	}
	return v
}
