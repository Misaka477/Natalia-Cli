package ui

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/Misaka477/Natalia-Cli/internal/config"
)

func TestShowConfigPrintsActiveProfileWithoutLeakingFullAPIKey(t *testing.T) {
	cfg := &config.Config{
		DefaultProfile: "default",
		Providers: map[string]config.Provider{
			"step": {BaseURL: "https://api.step.example/v1", APIKey: "sk-1234567890abcdef"},
		},
		Profiles: map[string]config.Profile{
			"default": {Provider: "step", Model: "step-3.7-flash", MaxContext: 131072, Temperature: 0.2, MaxTokens: 4096, TopP: 1, Stream: true, MaxSteps: 10, TimeoutSec: 30, WorkDir: "/work"},
		},
	}

	output := captureStdout(t, func() { ShowConfig(cfg) })
	if !strings.Contains(output, "step-3.7-flash") || !strings.Contains(output, "sk-1...cdef") || !strings.Contains(output, "工作目录") {
		t.Fatalf("unexpected ShowConfig output: %q", output)
	}
	if strings.Contains(output, "1234567890ab") {
		t.Fatalf("ShowConfig leaked API key: %q", output)
	}
}

func TestUIDetectContextShortenAndMaskHelpers(t *testing.T) {
	if got := DetectContext("step-3.7-flash"); got != 131072 {
		t.Fatalf("DetectContext(step-3.7-flash)=%d", got)
	}
	if got := DetectContext("gemini-custom"); got != 1048576 {
		t.Fatalf("DetectContext(gemini-custom)=%d", got)
	}
	if got := DetectContext("unknown-model"); got != 128000 {
		t.Fatalf("DetectContext(default)=%d", got)
	}
	if got := shorten("abcdef", 4); got != "abc…" {
		t.Fatalf("shorten returned %q", got)
	}
	if got := maskKey("short"); got != "***" {
		t.Fatalf("maskKey short returned %q", got)
	}
	if got := maskKey("abcdefghijkl"); got != "abcd...ijkl" {
		t.Fatalf("maskKey returned %q", got)
	}
}

func captureStdout(t *testing.T, fn func()) string {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdout = w
	fn()
	_ = w.Close()
	os.Stdout = old
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, r); err != nil {
		t.Fatal(err)
	}
	return buf.String()
}
