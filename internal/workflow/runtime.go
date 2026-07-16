package workflow

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Run struct {
	ID              string
	Document        *Document
	Plan            *ExecutionPlan
	History         EventStore
	CompletedSteps  map[string]bool
	FailedSteps     map[string]bool
	ActivityResults map[string]ActivityResult
	Status          string
}

type ActivityResult struct {
	StepID string
	Status string
	Output any
	Error  string
}

type ActivityFunc func(ctx context.Context, step *PlanStep, input map[string]any) (any, error)

type Runtime struct {
	mu       sync.Mutex
	store    EventStore
	activity ActivityFunc
	nextID   int64
}

func NewRuntime(store EventStore, activity ActivityFunc) *Runtime {
	return &Runtime{
		store:    store,
		activity: activity,
		nextID:   1,
	}
}

func (r *Runtime) generateID() string {
	r.nextID++
	return fmt.Sprintf("evt-%d", r.nextID-1)
}

func (r *Runtime) generateRunID() string {
	r.nextID++
	return fmt.Sprintf("run-%d", r.nextID-1)
}

func (r *Runtime) StartRun(ctx context.Context, doc *Document, plan *ExecutionPlan) (*Run, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	runID := r.generateRunID()

	if err := r.store.Append(Event{
		ID: r.generateID(), RunID: runID, Type: EventRunStarted,
		Timestamp: time.Now(),
		Data: map[string]any{
			"document_name": doc.Name,
			"plan":          plan,
		},
	}); err != nil {
		return nil, err
	}

	run := &Run{
		ID:              runID,
		Document:        doc,
		Plan:            plan,
		History:         r.store,
		CompletedSteps:  make(map[string]bool),
		FailedSteps:     make(map[string]bool),
		ActivityResults: make(map[string]ActivityResult),
		Status:          "running",
	}

	for _, step := range plan.Steps {
		select {
		case <-ctx.Done():
			r.store.Append(Event{
				ID: r.generateID(), RunID: runID, Type: EventRunCancelled,
				Timestamp: time.Now(),
				Data:      map[string]any{"reason": ctx.Err().Error()},
			})
			run.Status = "cancelled"
			return run, ctx.Err()
		default:
		}

		r.store.Append(Event{
			ID: r.generateID(), RunID: runID, Type: EventStepStarted,
			Timestamp: time.Now(),
			Data:      map[string]any{"step_id": step.ID},
		})

		input := make(map[string]any)
		for k, v := range run.ActivityResults {
			input[k] = v.Output
		}

		r.store.Append(Event{
			ID: r.generateID(), RunID: runID, Type: EventActivityScheduled,
			Timestamp: time.Now(),
			Data:      map[string]any{"step_id": step.ID, "kind": step.Kind},
		})

		output, actErr := r.activity(ctx, step, input)

		if actErr != nil {
			r.store.Append(Event{
				ID: r.generateID(), RunID: runID, Type: EventActivityFailed,
				Timestamp: time.Now(),
				Data:      map[string]any{"step_id": step.ID, "error": actErr.Error()},
			})
			r.store.Append(Event{
				ID: r.generateID(), RunID: runID, Type: EventStepFailed,
				Timestamp: time.Now(),
				Data:      map[string]any{"step_id": step.ID, "error": actErr.Error()},
			})
			run.FailedSteps[step.ID] = true
			run.ActivityResults[step.ID] = ActivityResult{
				StepID: step.ID,
				Status: "failed",
				Error:  actErr.Error(),
			}

			r.store.Append(Event{
				ID: r.generateID(), RunID: runID, Type: EventRunFailed,
				Timestamp: time.Now(),
				Data:      map[string]any{"error": actErr.Error()},
			})
			run.Status = "failed"
			return run, nil
		}

		r.store.Append(Event{
			ID: r.generateID(), RunID: runID, Type: EventActivityCompleted,
			Timestamp: time.Now(),
			Data:      map[string]any{"step_id": step.ID, "output": output},
		})
		r.store.Append(Event{
			ID: r.generateID(), RunID: runID, Type: EventStepCompleted,
			Timestamp: time.Now(),
			Data:      map[string]any{"step_id": step.ID, "output": output},
		})
		run.CompletedSteps[step.ID] = true
		run.ActivityResults[step.ID] = ActivityResult{
			StepID: step.ID,
			Status: "completed",
			Output: output,
		}
	}

	r.store.Append(Event{
		ID: r.generateID(), RunID: runID, Type: EventRunCompleted,
		Timestamp: time.Now(),
	})
	run.Status = "completed"
	return run, nil
}

func (r *Runtime) ResumeRun(ctx context.Context, runID string) (*Run, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	events, err := r.store.GetEvents(runID)
	if err != nil {
		return nil, err
	}
	if len(events) == 0 {
		return nil, fmt.Errorf("run %s not found", runID)
	}

	run, err := r.rebuildState(events)
	if err != nil {
		return nil, err
	}

	if run.Status == "completed" || run.Status == "failed" || run.Status == "cancelled" {
		return run, nil
	}

	if run.Plan == nil {
		run.Status = "completed"
		return run, nil
	}

	for _, step := range run.Plan.Steps {
		if run.CompletedSteps[step.ID] || run.FailedSteps[step.ID] {
			continue
		}

		select {
		case <-ctx.Done():
			r.store.Append(Event{
				ID: r.generateID(), RunID: runID, Type: EventRunCancelled,
				Timestamp: time.Now(),
			})
			run.Status = "cancelled"
			return run, ctx.Err()
		default:
		}

		r.store.Append(Event{
			ID: r.generateID(), RunID: runID, Type: EventStepStarted,
			Timestamp: time.Now(),
			Data:      map[string]any{"step_id": step.ID},
		})

		input := make(map[string]any)
		for k, v := range run.ActivityResults {
			input[k] = v.Output
		}

		r.store.Append(Event{
			ID: r.generateID(), RunID: runID, Type: EventActivityScheduled,
			Timestamp: time.Now(),
			Data:      map[string]any{"step_id": step.ID, "kind": step.Kind},
		})

		output, actErr := r.activity(ctx, step, input)

		if actErr != nil {
			r.store.Append(Event{
				ID: r.generateID(), RunID: runID, Type: EventActivityFailed,
				Timestamp: time.Now(),
				Data:      map[string]any{"step_id": step.ID, "error": actErr.Error()},
			})
			r.store.Append(Event{
				ID: r.generateID(), RunID: runID, Type: EventStepFailed,
				Timestamp: time.Now(),
				Data:      map[string]any{"step_id": step.ID, "error": actErr.Error()},
			})
			run.FailedSteps[step.ID] = true
			run.ActivityResults[step.ID] = ActivityResult{
				StepID: step.ID,
				Status: "failed",
				Error:  actErr.Error(),
			}

			r.store.Append(Event{
				ID: r.generateID(), RunID: runID, Type: EventRunFailed,
				Timestamp: time.Now(),
				Data:      map[string]any{"error": actErr.Error()},
			})
			run.Status = "failed"
			return run, nil
		}

		r.store.Append(Event{
			ID: r.generateID(), RunID: runID, Type: EventActivityCompleted,
			Timestamp: time.Now(),
			Data:      map[string]any{"step_id": step.ID, "output": output},
		})
		r.store.Append(Event{
			ID: r.generateID(), RunID: runID, Type: EventStepCompleted,
			Timestamp: time.Now(),
			Data:      map[string]any{"step_id": step.ID, "output": output},
		})
		run.CompletedSteps[step.ID] = true
		run.ActivityResults[step.ID] = ActivityResult{
			StepID: step.ID,
			Status: "completed",
			Output: output,
		}
	}

	r.store.Append(Event{
		ID: r.generateID(), RunID: runID, Type: EventRunCompleted,
		Timestamp: time.Now(),
	})
	run.Status = "completed"
	return run, nil
}

func (r *Runtime) rebuildState(events []Event) (*Run, error) {
	run := &Run{
		ID:              events[0].RunID,
		History:         r.store,
		CompletedSteps:  make(map[string]bool),
		FailedSteps:     make(map[string]bool),
		ActivityResults: make(map[string]ActivityResult),
	}

	for _, event := range events {
		switch event.Type {
		case EventRunStarted:
			data, _ := event.Data.(map[string]any)
			if data != nil {
				if docName, ok := data["document_name"].(string); ok {
					run.Document = &Document{Name: docName}
				}
				if plan, ok := data["plan"].(*ExecutionPlan); ok {
					run.Plan = plan
				}
			}
			run.Status = "running"

		case EventStepCompleted:
			if data, ok := event.Data.(map[string]any); ok {
				if stepID, ok := data["step_id"].(string); ok {
					run.CompletedSteps[stepID] = true
					output := data["output"]
					run.ActivityResults[stepID] = ActivityResult{
						StepID: stepID,
						Status: "completed",
						Output: output,
					}
				}
			}

		case EventStepFailed:
			if data, ok := event.Data.(map[string]any); ok {
				if stepID, ok := data["step_id"].(string); ok {
					run.FailedSteps[stepID] = true
					errStr, _ := data["error"].(string)
					run.ActivityResults[stepID] = ActivityResult{
						StepID: stepID,
						Status: "failed",
						Error:  errStr,
					}
				}
			}

		case EventRunCompleted:
			run.Status = "completed"

		case EventRunFailed:
			run.Status = "failed"

		case EventRunCancelled:
			run.Status = "cancelled"
		}
	}

	return run, nil
}

func (r *Runtime) CancelRun(runID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	events, err := r.store.GetEvents(runID)
	if err != nil {
		return err
	}
	if len(events) == 0 {
		return fmt.Errorf("run %s not found", runID)
	}

	run, err := r.rebuildState(events)
	if err != nil {
		return err
	}
	if run.Status != "running" {
		return fmt.Errorf("run %s is not running (status: %s)", runID, run.Status)
	}

	return r.store.Append(Event{
		ID: r.generateID(), RunID: runID, Type: EventRunCancelled,
		Timestamp: time.Now(),
		Data:      map[string]any{"reason": "cancelled by user"},
	})
}

func (r *Runtime) PauseRun(runID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	events, err := r.store.GetEvents(runID)
	if err != nil {
		return err
	}
	if len(events) == 0 {
		return fmt.Errorf("run %s not found", runID)
	}

	run, err := r.rebuildState(events)
	if err != nil {
		return err
	}
	if run.Status != "running" {
		return fmt.Errorf("run %s is not running (status: %s)", runID, run.Status)
	}

	run.Status = "paused"
	return nil
}
