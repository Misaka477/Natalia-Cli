package ask_user

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/wire"
)

func TestAskUserReadsAnswerFromStdin(t *testing.T) {
	oldStdin := os.Stdin
	oldStderr := os.Stderr
	stdinR, stdinW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	stderrR, stderrW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdin = stdinR
	os.Stderr = stderrW
	t.Cleanup(func() {
		os.Stdin = oldStdin
		os.Stderr = oldStderr
		_ = stdinR.Close()
		_ = stderrR.Close()
	})

	if _, err := stdinW.WriteString("human answer\n"); err != nil {
		t.Fatal(err)
	}
	_ = stdinW.Close()
	answer, err := (&AskUser{}).Execute(map[string]any{"question": "Continue?", "options": []any{"yes", "no"}})
	_ = stderrW.Close()
	if err != nil {
		t.Fatal(err)
	}
	if answer != "human answer" {
		t.Fatalf("expected options to allow custom input, got %q", answer)
	}
	if _, err := stdinW.WriteString("human answer\n"); err == nil {
		t.Fatal("expected closed stdin writer to reject extra write")
	}
	buf := make([]byte, 256)
	n, _ := stderrR.Read(buf)
	if !strings.Contains(string(buf[:n]), "Continue?") || !strings.Contains(string(buf[:n]), "1. yes") {
		t.Fatalf("expected prompt/options on stderr, got %q", string(buf[:n]))
	}
}

func TestAskUserReadsCustomAnswerFromStdin(t *testing.T) {
	oldStdin := os.Stdin
	oldStderr := os.Stderr
	stdinR, stdinW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	stderrR, stderrW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdin = stdinR
	os.Stderr = stderrW
	t.Cleanup(func() {
		os.Stdin = oldStdin
		os.Stderr = oldStderr
		_ = stdinR.Close()
		_ = stderrR.Close()
	})

	if _, err := stdinW.WriteString("human answer\n"); err != nil {
		t.Fatal(err)
	}
	_ = stdinW.Close()
	answer, err := (&AskUser{}).Execute(map[string]any{"question": "Continue?", "allow_custom": true})
	_ = stderrW.Close()
	if err != nil {
		t.Fatal(err)
	}
	if answer != "human answer" {
		t.Fatalf("expected trimmed answer, got %q", answer)
	}
	buf := make([]byte, 256)
	n, _ := stderrR.Read(buf)
	if !strings.Contains(string(buf[:n]), "Continue?") || !strings.Contains(string(buf[:n]), "自定义") {
		t.Fatalf("expected custom prompt on stderr, got %q", string(buf[:n]))
	}
}

func TestAskUserRejectsMissingQuestion(t *testing.T) {
	_, err := (&AskUser{}).Execute(map[string]any{})
	if err == nil || !strings.Contains(err.Error(), "question") {
		t.Fatalf("expected missing question error, got %v", err)
	}
}

func TestAskUserUsesStructuredHandler(t *testing.T) {
	setAskUserHandlerForTest(t, func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
		if len(req.Questions) != 2 || req.Questions[0].Name != "choice" || !req.Questions[0].Multiple || !req.Questions[1].AllowCustom {
			t.Fatalf("unexpected structured question request: %+v", req)
		}
		return wire.QuestionResponse{RequestID: req.ID, Answers: map[string]string{"choice": "red, blue", "note": "custom"}}, nil
	})

	result, err := (&AskUser{}).Execute(map[string]any{"questions": []any{
		map[string]any{"name": "choice", "question": "Pick colors", "options": []any{"red", "blue"}, "multiple": true},
		map[string]any{"name": "note", "question": "Why?", "allow_custom": true},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "choice: red, blue") || !strings.Contains(result, "note: custom") {
		t.Fatalf("expected structured answer output, got %q", result)
	}
}

func TestAskUserOptionsAllowCustomInputByDefault(t *testing.T) {
	setAskUserHandlerForTest(t, func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
		return wire.QuestionResponse{RequestID: req.ID, Answers: map[string]string{"answer": "not listed"}}, nil
	})

	result, err := (&AskUser{}).Execute(map[string]any{"question": "Pick", "options": []any{"yes", "no"}, "allow_custom": false})
	if err != nil {
		t.Fatal(err)
	}
	if result != "not listed" {
		t.Fatalf("expected custom answer to pass through even when allow_custom=false, got %q", result)
	}
}

func TestAskUserSupportsMoreThanFourOptions(t *testing.T) {
	setAskUserHandlerForTest(t, func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
		if len(req.Questions) != 1 || len(req.Questions[0].Options) != 5 {
			t.Fatalf("expected five options in request, got %+v", req)
		}
		return wire.QuestionResponse{RequestID: req.ID, Answers: map[string]string{"answer": "5"}}, nil
	})

	result, err := (&AskUser{}).Execute(map[string]any{"question": "Pick", "options": []any{"one", "two", "three", "four", "five"}})
	if err != nil {
		t.Fatal(err)
	}
	if result != "5" {
		t.Fatalf("expected handler answer, got %q", result)
	}
}

func TestAskUserRejectsExcessiveOptions(t *testing.T) {
	options := make([]any, maxOptionsPerQuestion+1)
	for i := range options {
		options[i] = "option"
	}
	_, err := (&AskUser{}).Execute(map[string]any{"question": "Pick", "options": options})
	if err == nil || !strings.Contains(err.Error(), "options") || !strings.Contains(err.Error(), "20") {
		t.Fatalf("expected clear options limit error, got %v", err)
	}
}

func TestAskUserDefaultHasNoTimeout(t *testing.T) {
	setAskUserHandlerForTest(t, func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
		if req.TimeoutMS != 0 {
			t.Fatalf("expected default timeout to be zero, got %d", req.TimeoutMS)
		}
		select {
		case <-ctx.Done():
			t.Fatalf("default ask_user context should not be canceled: %v", ctx.Err())
		default:
		}
		return wire.QuestionResponse{RequestID: req.ID, Answers: map[string]string{"answer": "manual"}}, nil
	})

	result, err := (&AskUser{}).Execute(map[string]any{"question": "Proceed?", "fallback": "fallback"})
	if err != nil {
		t.Fatal(err)
	}
	if result != "manual" {
		t.Fatalf("expected user answer without default fallback, got %q", result)
	}
}

func TestAskUserTimeoutUsesFallback(t *testing.T) {
	setAskUserHandlerForTest(t, func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
		<-ctx.Done()
		return wire.QuestionResponse{RequestID: req.ID}, ctx.Err()
	})

	started := time.Now()
	result, err := (&AskUser{}).Execute(map[string]any{"question": "Proceed?", "fallback": "default answer", "timeout": "1"})
	if err != nil {
		t.Fatal(err)
	}
	if time.Since(started) > 2*time.Second || !strings.HasPrefix(result, "default answer") || !strings.Contains(result, "timeout") {
		t.Fatalf("expected quick fallback answer with timeout source, result=%q elapsed=%s", result, time.Since(started))
	}
}

func TestAskUserPerQuestionSource(t *testing.T) {
	setAskUserHandlerForTest(t, func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
		return wire.QuestionResponse{RequestID: req.ID, Answers: map[string]string{"choice": "red, blue", "note": ""}}, nil
	})

	result, err := (&AskUser{}).Execute(map[string]any{"questions": []any{
		map[string]any{"name": "choice", "question": "Pick colors", "options": []any{"red", "blue"}, "multiple": true},
		map[string]any{"name": "note", "question": "Why?", "allow_custom": true, "fallback": "no reason"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "choice: red, blue") {
		t.Fatalf("expected choice answer, got %q", result)
	}
	if !strings.Contains(result, "note: no reason (fallback)") {
		t.Fatalf("expected fallback source for note, got %q", result)
	}
}

func TestAskUserMultiQuestionTimeoutSource(t *testing.T) {
	setAskUserHandlerForTest(t, func(ctx context.Context, req wire.QuestionRequest) (wire.QuestionResponse, error) {
		return wire.QuestionResponse{RequestID: req.ID, Answers: map[string]string{"answered": "yes"}}, nil
	})

	result, err := (&AskUser{}).Execute(map[string]any{"questions": []any{
		map[string]any{"name": "answered", "question": "Did you answer?"},
		map[string]any{"name": "unanswered", "question": "Did you skip?", "fallback": "skipped"},
	}, "timeout": "1"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "answered: yes") {
		t.Fatalf("expected answered question, got %q", result)
	}
	if !strings.Contains(result, "unanswered: skipped (fallback)") {
		t.Fatalf("expected fallback source for unanswered, got %q", result)
	}
}

func setAskUserHandlerForTest(t *testing.T, fn Handler) {
	t.Helper()
	restore := SetHandler(fn)
	t.Cleanup(restore)
}
