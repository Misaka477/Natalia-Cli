package ask_user

import (
	"os"
	"strings"
	"testing"
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
	answer, err := (&AskUser{}).Execute(map[string]any{"question": "Continue?"})
	_ = stderrW.Close()
	if err != nil {
		t.Fatal(err)
	}
	if answer != "human answer" {
		t.Fatalf("expected trimmed answer, got %q", answer)
	}
	buf := make([]byte, 256)
	n, _ := stderrR.Read(buf)
	if !strings.Contains(string(buf[:n]), "Continue?") {
		t.Fatalf("expected prompt on stderr, got %q", string(buf[:n]))
	}
}

func TestAskUserRejectsMissingQuestion(t *testing.T) {
	_, err := (&AskUser{}).Execute(map[string]any{})
	if err == nil || !strings.Contains(err.Error(), "question") {
		t.Fatalf("expected missing question error, got %v", err)
	}
}
