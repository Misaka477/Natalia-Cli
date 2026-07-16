package terminalspike

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/creack/pty"
)

func TestMain(m *testing.M) {
	switch os.Getenv("NATALIA_TERMINAL_SPIKE_CHILD") {
	case "custom":
		_ = RunCustomShell(os.Stdin, os.Stdout)
		os.Exit(0)
	}
	if os.Getenv("NATALIA_TERMINAL_SPIKE_INTERACTIVE") == "custom" {
		_ = RunCustomShell(os.Stdin, os.Stdout)
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func TestCustomShellRendererPTYMatrix(t *testing.T) {
	input := mixedText(20000)
	for _, width := range []uint16{200, 160, 120, 80, 60, 40} {
		t.Run(fmt.Sprintf("width_%d", width), func(t *testing.T) {
			result := runPTYScenario(t, "custom", width, input)
			t.Logf("custom width=%d metrics=%v", width, result.Metrics)
			assertIntegrity(t, result, input)
			assertNoAltScreen(t, result.Transcript)
			assertHistoryNotReprintedExcessively(t, result.Transcript, 6)
		})
	}
}

func TestCustomShellRendererContinuousChinese(t *testing.T) {
	input := strings.Repeat("界", 10000)
	result := runPTYScenario(t, "custom", 80, input)
	t.Logf("custom continuous Chinese metrics=%v", result.Metrics)
	assertIntegrity(t, result, input)
	assertNoAltScreen(t, result.Transcript)
}

func TestCustomShellRendererLargePaste(t *testing.T) {
	for _, tc := range []struct {
		name string
		text string
	}{
		{name: "100KiB", text: repeatedLog(100 * 1024)},
		{name: "1MiB", text: repeatedLog(1024 * 1024)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result := runPTYScenario(t, "custom", 80, tc.text)
			t.Logf("custom %s metrics=%v", tc.name, result.Metrics)
			assertIntegrity(t, result, tc.text)
			assertMetricBudget(t, result, "paste", 1000)
		})
	}
}

type ptyResult struct {
	Transcript string
	Bytes      int
	Lines      int
	SHA256     string
	Metrics    map[string]float64
}

func runPTYScenario(t *testing.T, mode string, width uint16, input string) ptyResult {
	t.Helper()
	cmd := exec.Command(os.Args[0], "-test.run=TestMain")
	cmd.Env = append(os.Environ(), "NATALIA_TERMINAL_SPIKE_CHILD="+mode, "TERM=xterm-256color")
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
	time.Sleep(time.Second)

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
	write("\x1b[200~" + strings.Repeat("汉", 300) + "\x1b[201~")
	write("\x1b[C\x1b[D\x1b[A\x1b[B\x1b[H\x1b[F")
	write("X")
	write("\x7f")
	write("\x05")
	write("\x15")
	write("\x1b[200~" + input + "\x1b[201~")
	for _, cols := range []uint16{200, 160, 120, 80, 60, 40} {
		if err := pty.Setsize(f, &pty.Winsize{Rows: 30, Cols: cols}); err != nil {
			t.Fatalf("resize pty: %v", err)
		}
		write("\x1b[C\x1b[D")
	}
	write("\x04")

	select {
	case <-done:
	case <-time.After(20 * time.Second):
		_ = cmd.Process.Kill()
		t.Fatalf("pty scenario timed out for %s width %d", mode, width)
	}
	return parsePTYResult(t, transcript.String())
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

func parsePTYResult(t *testing.T, transcript string) ptyResult {
	t.Helper()
	result := ptyResult{Transcript: transcript, Metrics: map[string]float64{}}
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

func assertIntegrity(t *testing.T, result ptyResult, input string) {
	t.Helper()
	expected := integrity(input)
	if result.Bytes != expected.Bytes || result.Lines != expected.Lines || result.SHA256 != expected.SHA256 {
		t.Fatalf("integrity mismatch got bytes=%d lines=%d sha=%s want bytes=%d lines=%d sha=%s", result.Bytes, result.Lines, result.SHA256, expected.Bytes, expected.Lines, expected.SHA256)
	}
}

func assertNoAltScreen(t *testing.T, transcript string) {
	t.Helper()
	if strings.Contains(transcript, "\x1b[?1049h") || strings.Contains(transcript, "\x1b[?1049l") {
		t.Fatal("transcript contains alt-screen enter/leave sequence")
	}
}

func assertHistoryNotReprintedExcessively(t *testing.T, transcript string, max int) {
	t.Helper()
	count := strings.Count(transcript, "history: committed line 1")
	if count > max {
		t.Fatalf("committed history reprinted %d times, max %d", count, max)
	}
}

func assertMetricBudget(t *testing.T, result ptyResult, name string, maxP95MS float64) {
	t.Helper()
	value, ok := result.Metrics[name]
	if !ok {
		t.Fatalf("missing metric %s", name)
	}
	if value > maxP95MS {
		t.Fatalf("metric %s p95 %.3fms exceeds %.3fms", name, value, maxP95MS)
	}
}

func assertNoFullScreenRepaintAfterReady(t *testing.T, transcript string) {
	t.Helper()
	idx := strings.Index(transcript, "spinner: - ready")
	if idx < 0 {
		t.Fatalf("missing ready marker in transcript")
	}
	tail := transcript[idx:]
	if strings.Contains(tail, "\x1b[H") || strings.Contains(tail, "\x1b[1;1H") {
		t.Fatal("transcript contains cursor-home after initial render, indicating full-screen repaints")
	}
	if strings.Contains(tail, "\x1b[2J") || strings.Contains(tail, "\x1b[3J") {
		t.Fatal("transcript contains full-screen clear after initial render")
	}
}

func TestCustomShellRendererVisualStability(t *testing.T) {
	input := mixedText(20000)
	result := runPTYScenario(t, "custom", 80, input)
	assertNoFullScreenRepaintAfterReady(t, result.Transcript)
}

func mixedText(graphemes int) string {
	parts := []string{"中", "文", "A", "b", "🙂", "e\u0301", "，", "。", "界", "Z"}
	var b strings.Builder
	for i := 0; i < graphemes; i++ {
		b.WriteString(parts[i%len(parts)])
		if i > 0 && i%97 == 0 {
			b.WriteByte('\n')
		}
	}
	return b.String()
}

func repeatedLog(size int) string {
	line := "2026-07-16T11:53:26Z INFO 中文日志 🙂 cafe\u0301 path=/tmp/example status=ok\n"
	var b strings.Builder
	for b.Len() < size {
		b.WriteString(line)
	}
	return b.String()[:size]
}

func tail(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[len(s)-max:]
}

func TestSpikeEnvironment(t *testing.T) {
	t.Logf("go=%s os=%s arch=%s", runtime.Version(), runtime.GOOS, runtime.GOARCH)
}
