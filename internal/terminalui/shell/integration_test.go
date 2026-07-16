package shell

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/presentation"
	"github.com/creack/pty"
)

func TestMain(m *testing.M) {
	if os.Getenv("NATALIA_SHELL_CHILD") == "renderer" {
		r := NewRenderer(os.Stdin, os.Stdout, DarkTheme())
		_ = r.Run()
		os.Exit(0)
	}
	if os.Getenv("NATALIA_SHELL_CHILD") == "orchestrator" {
		r := NewRenderer(os.Stdin, os.Stdout, DarkTheme())
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		steerCh := make(chan SteerCommand, 4)
		go func() {
			for cmd := range steerCh {
				if cmd.Type != "submit" {
					continue
				}
				r.AcceptPresentationEvent(presentation.Event{Type: presentation.EvtTurnBegin, Data: presentation.TurnBeginPayload{Input: cmd.Text}})
				content := "ack:" + cmd.Text + "\nsecond line with 中文"
				r.AcceptPresentationEvent(presentation.Event{Type: presentation.EvtContentPart, Data: presentation.ContentPartPayload{Content: content}})
				r.AcceptPresentationEvent(presentation.Event{Type: presentation.EvtContentEnd, Data: presentation.ContentEndPayload{FullContent: content}})
				r.AcceptPresentationEvent(presentation.Event{Type: presentation.EvtTurnEnd})
			}
		}()
		_ = r.RunWithOrchestrator(ctx, steerCh)
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func TestShellEditorPTYBasic(t *testing.T) {
	input := "Hello, 世界!"
	result := runShellPTYScenario(t, 80, input)
	t.Logf("shell PTY basic metrics=%v", result.Metrics)
	assertResultIntegrity(t, result, input)
	if !strings.Contains(result.Transcript, "RESULT") {
		t.Fatal("missing RESULT in transcript")
	}
}

func TestShellOrchestratorPTYSubmitStreamsWithoutWire(t *testing.T) {
	input := "异步 shell submit ✅"
	result := runShellOrchestratorPTYScenario(t, 80, input)
	if !strings.Contains(result.Transcript, "ack:") {
		t.Fatalf("expected fake streamed ack in transcript tail: %q", tail(result.Transcript, 1000))
	}
	if strings.Contains(result.Transcript, "spinner: - submitted") && !strings.Contains(result.Transcript, "ack:") {
		t.Fatalf("submit appeared stuck without final content: %q", tail(result.Transcript, 1000))
	}
	if strings.Contains(result.Transcript, "stream: ack:") {
		t.Fatalf("stream preview should not render raw model content: %q", tail(result.Transcript, 1000))
	}
}

func TestShellEditorPTYMatrix(t *testing.T) {
	input := "The quick brown 狐 🦊 jumps over the lazy 犬."
	for _, width := range []uint16{120, 80, 60, 40} {
		t.Run(fmt.Sprintf("width_%d", width), func(t *testing.T) {
			result := runShellPTYScenario(t, width, input)
			t.Logf("shell PTY width=%d metrics=%v", width, result.Metrics)
			assertResultIntegrity(t, result, input)
		})
	}
}

func TestShellEditorPTYChinese(t *testing.T) {
	input := "汉语テスト边界"
	result := runShellPTYScenario(t, 80, input)
	t.Logf("shell PTY Chinese metrics=%v", result.Metrics)
	assertResultIntegrity(t, result, input)
}

func TestShellEditorPTYChinese300Regression(t *testing.T) {
	input := strings.Repeat("中", 300)
	result := runShellPTYScenario(t, 80, input)
	assertResultIntegrity(t, result, input)
}

func TestShellEditorPTYLargePaste100KiB(t *testing.T) {
	input := strings.Repeat("日志行: 中文 emoji ✅ abc\n", 4096)
	if len([]byte(input)) < 100*1024 {
		t.Fatalf("test input too small: %d", len([]byte(input)))
	}
	result := runShellPTYScenario(t, 120, input)
	assertResultIntegrity(t, result, input)
}

func TestShellEditorPTYLargePaste1MiBFoldedPreview(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping 1 MiB PTY paste in short mode")
	}
	unit := "混合 grapheme e\u0301 🙂 全角，ASCII 1234567890\n"
	input := strings.Repeat(unit, (1024*1024/len([]byte(unit)))+1)
	result := runShellPTYScenario(t, 120, input)
	assertResultIntegrity(t, result, input)
}

type ptyShellResult struct {
	Transcript string
	Bytes      int
	Lines      int
	SHA256     string
	Metrics    map[string]float64
}

func runShellPTYScenario(t *testing.T, width uint16, input string) ptyShellResult {
	t.Helper()
	cmd := exec.Command(os.Args[0], "-test.run=TestMain")
	cmd.Env = append(os.Environ(), "NATALIA_SHELL_CHILD=renderer", "TERM=xterm-256color")
	f, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: 30, Cols: width})
	if err != nil {
		t.Fatalf("start pty: %v", err)
	}
	defer f.Close()

	var transcript safeBuffer
	done := make(chan error, 1)
	go func() {
		_, err := io.Copy(&transcript, f)
		done <- err
	}()
	time.Sleep(500 * time.Millisecond)

	write := func(s string) {
		data := []byte(s)
		for len(data) > 0 {
			n, err := f.Write(data)
			if err != nil {
				t.Fatalf("write pty: %v", err)
			}
			if n == 0 {
				t.Fatal("write pty made no progress")
			}
			data = data[n:]
		}
	}

	write("\x1b[200~" + input + "\x1b[201~")
	write("\x1b[C\x1b[D\x1b[H\x1b[F")
	write("\x04")

	select {
	case <-done:
	case <-time.After(60 * time.Second):
		_ = cmd.Process.Kill()
		t.Fatalf("pty scenario timed out for width %d", width)
	}
	return parseShellPTYResult(t, transcript.String())
}

func runShellOrchestratorPTYScenario(t *testing.T, width uint16, input string) ptyShellResult {
	t.Helper()
	cmd := exec.Command(os.Args[0], "-test.run=TestMain")
	cmd.Env = append(os.Environ(), "NATALIA_SHELL_CHILD=orchestrator", "TERM=xterm-256color")
	f, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: 30, Cols: width})
	if err != nil {
		t.Fatalf("start pty: %v", err)
	}
	defer f.Close()

	var transcript safeBuffer
	done := make(chan error, 1)
	go func() {
		_, err := io.Copy(&transcript, f)
		done <- err
	}()
	time.Sleep(500 * time.Millisecond)
	writePTY(t, f, "\x1b[200~"+input+"\x1b[201~")
	writePTY(t, f, "\r")
	time.Sleep(300 * time.Millisecond)
	writePTY(t, f, "\x04")

	select {
	case <-done:
	case <-time.After(60 * time.Second):
		_ = cmd.Process.Kill()
		t.Fatalf("orchestrator pty scenario timed out for width %d", width)
	}
	return ptyShellResult{Transcript: transcript.String(), Metrics: map[string]float64{}}
}

func writePTY(t *testing.T, f *os.File, s string) {
	t.Helper()
	data := []byte(s)
	for len(data) > 0 {
		n, err := f.Write(data)
		if err != nil {
			t.Fatalf("write pty: %v", err)
		}
		if n == 0 {
			t.Fatal("write pty made no progress")
		}
		data = data[n:]
	}
}

func assertResultIntegrity(t *testing.T, result ptyShellResult, input string) {
	t.Helper()
	if result.Bytes != len([]byte(input)) {
		t.Fatalf("bytes=%d want %d", result.Bytes, len([]byte(input)))
	}
	wantLines := strings.Count(input, "\n") + 1
	if result.Lines != wantLines {
		t.Fatalf("lines=%d want %d", result.Lines, wantLines)
	}
	sum := sha256.Sum256([]byte(input))
	if result.SHA256 != fmt.Sprintf("%x", sum) {
		t.Fatalf("sha256=%s want %x", result.SHA256, sum)
	}
}

type safeBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (b *safeBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.b.Write(p)
}

func (b *safeBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.b.String()
}

func parseShellPTYResult(t *testing.T, transcript string) ptyShellResult {
	t.Helper()
	result := ptyShellResult{Transcript: transcript, Metrics: map[string]float64{}}
	re := regexp.MustCompile(`RESULT bytes=(\d+) lines=(\d+) sha256=([a-f0-9]+)`)
	match := re.FindStringSubmatch(transcript)
	if match == nil {
		t.Fatalf("missing RESULT in transcript tail: %q", tail(transcript, 1000))
	}
	fmt.Sscanf(match[1], "%d", &result.Bytes)
	fmt.Sscanf(match[2], "%d", &result.Lines)
	result.SHA256 = match[3]
	metricRe := regexp.MustCompile(`METRIC name=([^ ]+) p95_ms=([0-9.]+)`)
	for _, match := range metricRe.FindAllStringSubmatch(transcript, -1) {
		var value float64
		fmt.Sscanf(match[2], "%f", &value)
		result.Metrics[match[1]] = value
	}
	return result
}

func tail(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[len(s)-max:]
}
