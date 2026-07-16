package wire

import (
	"encoding/json"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/presentation"
)

func ToPresentationEvent(msg any, cid presentation.CorrelationID) *presentation.Event {
	switch m := msg.(type) {
	case TurnBegin:
		return &presentation.Event{
			Type:          presentation.EvtTurnBegin,
			CorrelationID: cid,
			Timestamp:     time.Now(),
			Data:          presentation.TurnBeginPayload{Input: string(m.UserInput)},
		}
	case TurnEnd:
		return &presentation.Event{
			Type:          presentation.EvtTurnEnd,
			CorrelationID: cid,
			Timestamp:     time.Now(),
		}
	case StepBegin:
		return &presentation.Event{
			Type:          presentation.EvtStepBegin,
			CorrelationID: cid,
			Timestamp:     time.Now(),
		}
	case ContentPart:
		return &presentation.Event{
			Type:          presentation.EvtContentPart,
			CorrelationID: cid,
			Timestamp:     time.Now(),
			Data: presentation.ContentPartPayload{
				Content:    m.Text,
				IsThinking: m.Type == ContentThink,
			},
		}
	case ToolCall:
		return &presentation.Event{
			Type:          presentation.EvtToolBegin,
			CorrelationID: cid,
			Timestamp:     time.Now(),
			Data: presentation.ToolBeginPayload{
				Name:      m.Name,
				Arguments: rawMessageToMap(m.Arguments),
			},
		}
	case ToolResult:
		return &presentation.Event{
			Type:          presentation.EvtToolEnd,
			CorrelationID: cid,
			Timestamp:     time.Now(),
			Data: presentation.ToolEndPayload{
				Result: m.Content,
				Error:  m.Error,
			},
		}
	case ApprovalRequest:
		return &presentation.Event{
			Type:          presentation.EvtApprovalRequest,
			CorrelationID: cid,
			Timestamp:     time.Now(),
			Data: presentation.ApprovalRequestPayload{
				ID:          m.ID,
				ToolName:    m.Action,
				Arguments:   nil,
				RequireOnce: false,
			},
		}
	case ApprovalResponse:
		return &presentation.Event{
			Type:          presentation.EvtApprovalResult,
			CorrelationID: cid,
			Timestamp:     time.Now(),
			Data: presentation.ApprovalResultPayload{
				ID:       m.RequestID,
				Approved: m.Response == "approved" || m.Response == "yes",
				Feedback: m.Response,
			},
		}
	case QuestionRequest:
		return &presentation.Event{
			Type:          presentation.EvtQuestionRequest,
			CorrelationID: cid,
			Timestamp:     time.Now(),
			Data: presentation.QuestionRequestPayload{
				ID:      m.ID,
				Options: nil,
				Multi:   false,
			},
		}
	case CompactionBegin:
		return &presentation.Event{
			Type:          presentation.EvtCompactBegin,
			CorrelationID: cid,
			Timestamp:     time.Now(),
		}
	case StatusUpdate:
		return &presentation.Event{
			Type:          presentation.EvtStatusUpdate,
			CorrelationID: cid,
			Timestamp:     time.Now(),
			Data: presentation.StatusUpdatePayload{
				Key:   "mode",
				Value: m.Mode,
			},
		}
	case Notification:
		return &presentation.Event{
			Type:          presentation.EvtNotification,
			CorrelationID: cid,
			Timestamp:     time.Now(),
			Data: presentation.NotificationPayload{
				Severity: "info",
				Message:  m.Message,
			},
		}
	default:
		return nil
	}
}

func rawMessageToMap(raw []byte) map[string]any {
	if len(raw) == 0 {
		return nil
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil
	}
	return m
}
