package workflow

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestStartRunRecordsEventHistory(t *testing.T) {
	store := NewMemoryEventStore()
	runtime := NewRuntime(store, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		return "output-" + step.ID, nil
	})

	doc := &Document{Name: "test"}
	plan := &ExecutionPlan{
		Steps: []*PlanStep{
			{ID: "step-1", Kind: "task"},
			{ID: "step-2", Kind: "task"},
		},
	}

	run, err := runtime.StartRun(context.Background(), doc, plan)
	if err != nil {
		t.Fatal(err)
	}

	if run.Status != "completed" {
		t.Fatalf("expected completed, got %s", run.Status)
	}
	if len(run.CompletedSteps) != 2 {
		t.Fatalf("expected 2 completed steps, got %d", len(run.CompletedSteps))
	}

	events, err := store.GetEvents(run.ID)
	if err != nil {
		t.Fatal(err)
	}

	expectedTypes := []EventType{
		EventRunStarted,
		EventStepStarted, EventActivityScheduled, EventActivityCompleted, EventStepCompleted,
		EventStepStarted, EventActivityScheduled, EventActivityCompleted, EventStepCompleted,
		EventRunCompleted,
	}

	if len(events) != len(expectedTypes) {
		t.Fatalf("expected %d events, got %d", len(expectedTypes), len(events))
	}
	for i, e := range events {
		if e.Type != expectedTypes[i] {
			t.Errorf("event %d: expected %s, got %s", i, expectedTypes[i], e.Type)
		}
	}
}

func TestResumeRunReplaysFromHistory(t *testing.T) {
	store := NewMemoryEventStore()

	runtime := NewRuntime(store, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		return "result", nil
	})

	doc := &Document{Name: "test"}
	plan := &ExecutionPlan{
		Steps: []*PlanStep{
			{ID: "step-1", Kind: "task"},
		},
	}

	run, err := runtime.StartRun(context.Background(), doc, plan)
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != "completed" {
		t.Fatalf("expected completed, got %s", run.Status)
	}

	resumeCalled := false
	resumeRuntime := NewRuntime(store, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		resumeCalled = true
		return nil, nil
	})

	resumedRun, err := resumeRuntime.ResumeRun(context.Background(), run.ID)
	if err != nil {
		t.Fatal(err)
	}

	if resumedRun.Status != "completed" {
		t.Fatalf("expected completed, got %s", resumedRun.Status)
	}
	if !resumedRun.CompletedSteps["step-1"] {
		t.Fatal("expected step-1 to be completed")
	}
	if resumeCalled {
		t.Fatal("activity should not be called for already completed step")
	}
}

func TestCancelRun(t *testing.T) {
	store := NewMemoryEventStore()
	runtime := NewRuntime(store, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		return "result", nil
	})

	plan := &ExecutionPlan{
		Steps: []*PlanStep{
			{ID: "step-1", Kind: "task"},
		},
	}

	store.Append(Event{
		ID: "evt-1", RunID: "run-1", Type: EventRunStarted,
		Timestamp: time.Now(),
		Data:      map[string]any{"document_name": "test", "plan": plan},
	})

	err := runtime.CancelRun("run-1")
	if err != nil {
		t.Fatal(err)
	}

	events, _ := store.GetEvents("run-1")
	if len(events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(events))
	}
	if events[1].Type != EventRunCancelled {
		t.Fatalf("expected cancelled event, got %s", events[1].Type)
	}

	latest, err := store.GetLatest("run-1")
	if err != nil {
		t.Fatal(err)
	}
	if latest.Type != EventRunCancelled {
		t.Fatalf("expected cancelled as latest, got %s", latest.Type)
	}
}

func TestCancelRunErrorsOnNonExistent(t *testing.T) {
	store := NewMemoryEventStore()
	runtime := NewRuntime(store, nil)

	err := runtime.CancelRun("nonexistent")
	if err == nil {
		t.Fatal("expected error for non-existent run")
	}
}

func TestCancelRunErrorsOnCompleted(t *testing.T) {
	store := NewMemoryEventStore()

	runtime := NewRuntime(store, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		return "result", nil
	})

	doc := &Document{Name: "test"}
	plan := &ExecutionPlan{
		Steps: []*PlanStep{
			{ID: "step-1", Kind: "task"},
		},
	}

	run, err := runtime.StartRun(context.Background(), doc, plan)
	if err != nil {
		t.Fatal(err)
	}

	err = runtime.CancelRun(run.ID)
	if err == nil {
		t.Fatal("expected error cancelling a completed run")
	}
}

func TestActivityExecutionAndResultRecording(t *testing.T) {
	store := NewMemoryEventStore()

	runtime := NewRuntime(store, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		if step.ID == "step-1" {
			return "hello", nil
		}
		if step.ID == "step-2" {
			return nil, errors.New("step-2 failed")
		}
		return "done", nil
	})

	doc := &Document{Name: "test"}
	plan := &ExecutionPlan{
		Steps: []*PlanStep{
			{ID: "step-1", Kind: "task"},
			{ID: "step-2", Kind: "task"},
		},
	}

	run, err := runtime.StartRun(context.Background(), doc, plan)
	if err != nil {
		t.Fatal(err)
	}

	if run.Status != "failed" {
		t.Fatalf("expected failed, got %s", run.Status)
	}

	if run.ActivityResults["step-1"].Status != "completed" || run.ActivityResults["step-1"].Output != "hello" {
		t.Fatalf("unexpected step-1 result: %+v", run.ActivityResults["step-1"])
	}
	if run.ActivityResults["step-2"].Status != "failed" || run.ActivityResults["step-2"].Error != "step-2 failed" {
		t.Fatalf("unexpected step-2 result: %+v", run.ActivityResults["step-2"])
	}
}

func TestSequentialStepExecution(t *testing.T) {
	store := NewMemoryEventStore()

	var mu sync.Mutex
	var executionOrder []string
	runtime := NewRuntime(store, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		mu.Lock()
		executionOrder = append(executionOrder, step.ID)
		mu.Unlock()
		return step.ID + "-output", nil
	})

	doc := &Document{Name: "test"}
	plan := &ExecutionPlan{
		Steps: []*PlanStep{
			{ID: "step-1", Kind: "task"},
			{ID: "step-2", Kind: "task"},
			{ID: "step-3", Kind: "task"},
		},
	}

	run, err := runtime.StartRun(context.Background(), doc, plan)
	if err != nil {
		t.Fatal(err)
	}

	if run.Status != "completed" {
		t.Fatalf("expected completed, got %s", run.Status)
	}

	if len(executionOrder) != 3 {
		t.Fatalf("expected 3 steps executed, got %d", len(executionOrder))
	}
	if executionOrder[0] != "step-1" || executionOrder[1] != "step-2" || executionOrder[2] != "step-3" {
		t.Fatalf("steps executed out of order: %v", executionOrder)
	}

	if run.ActivityResults["step-1"].Output != "step-1-output" {
		t.Fatalf("unexpected step-1 output: %v", run.ActivityResults["step-1"].Output)
	}
	if run.ActivityResults["step-2"].Output != "step-2-output" {
		t.Fatalf("unexpected step-2 output: %v", run.ActivityResults["step-2"].Output)
	}
	if run.ActivityResults["step-3"].Output != "step-3-output" {
		t.Fatalf("unexpected step-3 output: %v", run.ActivityResults["step-3"].Output)
	}
}

func TestPauseAndResumeRun(t *testing.T) {
	store := NewMemoryEventStore()

	runtime := NewRuntime(store, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		return "result", nil
	})

	plan := &ExecutionPlan{
		Steps: []*PlanStep{
			{ID: "step-1", Kind: "task"},
		},
	}

	store.Append(Event{
		ID: "evt-1", RunID: "run-1", Type: EventRunStarted,
		Timestamp: time.Now(),
		Data:      map[string]any{"document_name": "test", "plan": plan},
	})

	if err := runtime.PauseRun("run-1"); err != nil {
		t.Fatal(err)
	}

	resumeRuntime := NewRuntime(store, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		return "resumed-output", nil
	})

	resumedRun, err := resumeRuntime.ResumeRun(context.Background(), "run-1")
	if err != nil {
		t.Fatal(err)
	}

	if resumedRun.Status != "completed" {
		t.Fatalf("expected completed after resume, got %s", resumedRun.Status)
	}
	if !resumedRun.CompletedSteps["step-1"] {
		t.Fatal("expected step-1 to be completed")
	}
	if resumedRun.ActivityResults["step-1"].Output != "resumed-output" {
		t.Fatalf("expected resumed-output, got %v", resumedRun.ActivityResults["step-1"].Output)
	}
}

func TestMemoryEventStoreConcurrentSafe(t *testing.T) {
	store := NewMemoryEventStore()

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			store.Append(Event{
				ID:        "evt",
				RunID:     "concurrent-run",
				Type:      EventStepStarted,
				Timestamp: time.Now(),
			})
		}(i)
	}
	wg.Wait()

	events, err := store.GetEvents("concurrent-run")
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 20 {
		t.Fatalf("expected 20 events, got %d", len(events))
	}
}

func TestGetLatestEmptyError(t *testing.T) {
	store := NewMemoryEventStore()
	_, err := store.GetLatest("nonexistent")
	if err == nil {
		t.Fatal("expected error for non-existent run")
	}
}

func TestResumeRunNotFound(t *testing.T) {
	store := NewMemoryEventStore()
	runtime := NewRuntime(store, nil)

	_, err := runtime.ResumeRun(context.Background(), "nonexistent")
	if err == nil {
		t.Fatal("expected error for non-existent run")
	}
}

func TestRunCancelledViaContext(t *testing.T) {
	store := NewMemoryEventStore()

	blocked := make(chan struct{})
	runtime := NewRuntime(store, func(ctx context.Context, step *PlanStep, input map[string]any) (any, error) {
		<-blocked
		return "result", nil
	})

	doc := &Document{Name: "test"}
	plan := &ExecutionPlan{
		Steps: []*PlanStep{
			{ID: "step-1", Kind: "task"},
		},
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	run, err := runtime.StartRun(ctx, doc, plan)
	if err == nil {
		t.Fatalf("expected context cancelled error, got run status %s", run.Status)
	}
	if run != nil && run.Status != "cancelled" {
		t.Fatalf("expected cancelled status, got %s", run.Status)
	}
}
