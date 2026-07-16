package shell

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/creack/pty"
)

func TestMain(m *testing.M) {
	if os.Getenv("NATALIA_SHELL_CHILD") == "renderer" {
		r := NewRenderer(os.Stdin, os.Stdout, DarkTheme())
		_ = r.Run()
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func TestShellEditorPTYBasic(t *testing.T) {
	result := runShellPTYScenario(t, 80, "Hello, 世界!")
	t.Logf("shell PTY basic metrics=%v", result.Metrics)
	if result.Bytes == 0 {
		t.Fatal("expected non-zero bytes in result")
	}
	if !strings.Contains(result.Transcript, "RESULT") {
		t.Fatal("missing RESULT in transcript")
	}
}

func TestShellEditorPTYMatrix(t *testing.T) {
	input := "The quick brown 狐 🦊 jumps over the lazy 犬."
	for _, width := range []uint16{120, 80, 60, 40} {
		t.Run(fmt.Sprintf("width_%d", width), func(t *testing.T) {
			result := runShellPTYScenario(t, width, input)
			t.Logf("shell PTY width=%d metrics=%v", width, result.Metrics)
			if result.Bytes == 0 {
				t.Fatal("expected non-zero bytes")
			}
		})
	}
}

func TestShellEditorPTYChinese(t *testing.T) {
	input := "汉语テスト边界"
	result := runShellPTYScenario(t, 80, input)
	t.Logf("shell PTY Chinese metrics=%v", result.Metrics)
	if result.Bytes == 0 {
		t.Fatal("expected non-zero bytes in result")
	}
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
	case <-time.After(15 * time.Second):
		_ = cmd.Process.Kill()
		t.Fatalf("pty scenario timed out for width %d", width)
	}
	return parseShellPTYResult(t, transcript.String())
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
