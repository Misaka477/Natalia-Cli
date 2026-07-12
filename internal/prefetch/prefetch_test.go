package prefetch

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/llm"
	"github.com/Misaka477/Natalia-Cli/internal/mode"
	"github.com/Misaka477/Natalia-Cli/internal/toolcache"
	"github.com/Misaka477/Natalia-Cli/internal/toolset"
)

type countTool struct {
	name  string
	count int
}

func (t *countTool) Name() string        { return t.name }
func (t *countTool) Description() string { return t.name }
func (t *countTool) Execute(args map[string]any) (string, error) {
	t.count++
	return fmt.Sprintf("%s result %d", t.name, t.count), nil
}
func (t *countTool) Parameters() map[string]llm.Property { return nil }
func (t *countTool) Required() []string                  { return nil }

func TestWarmPrefetchesMentionedReadFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "prefetch.go")
	if err := os.WriteFile(path, []byte("package main"), 0644); err != nil {
		t.Fatal(err)
	}
	read := &countTool{name: "read_file"}
	registry := toolset.NewRegistry()
	registry.Register(read)
	cache := toolcache.New()

	result := Warm(context.Background(), Options{
		Tools: registry,
		Cache: cache,
		Input: fmt.Sprintf("please inspect `%s`", path),
	})

	if result.Planned != 1 || result.Cached != 1 || result.Errors != 0 {
		t.Fatalf("unexpected prefetch result: %+v", result)
	}
	if read.count != 1 {
		t.Fatalf("expected one read_file execution, got %d", read.count)
	}
	if got, ok := cache.Get("read_file", map[string]any{"path": path}); !ok || got != "read_file result 1" {
		t.Fatalf("expected cached read_file result, got %q ok=%v", got, ok)
	}
}

func TestWarmRespectsModeFilter(t *testing.T) {
	glob := &countTool{name: "glob"}
	registry := toolset.NewRegistry()
	registry.Register(glob)
	cache := toolcache.New()

	result := Warm(context.Background(), Options{
		Tools: registry,
		Cache: cache,
		Mode: &mode.Mode{Name: "no_glob", ToolFilter: func(name string, args map[string]any) bool {
			return name != "glob"
		}},
		Input: "run go test",
	})

	if result.Planned != 0 || glob.count != 0 {
		t.Fatalf("expected mode filter to skip prefetch, result=%+v count=%d", result, glob.count)
	}
}

func TestWarmTimesOut(t *testing.T) {
	registry := toolset.NewRegistry()
	registry.Register(&slowTool{name: "glob"})
	result := Warm(context.Background(), Options{
		Tools:   registry,
		Cache:   toolcache.New(),
		Input:   "run go test",
		Timeout: time.Millisecond,
	})
	if result.Planned != 2 || result.Cached != 0 || result.Errors == 0 {
		t.Fatalf("expected timeout errors, got %+v", result)
	}
}

func TestWarmNilToolsCacheAndToolErrors(t *testing.T) {
	if result := Warm(context.Background(), Options{Cache: toolcache.New(), Input: "run go test"}); result != (Result{}) {
		t.Fatalf("expected nil tools to no-op, got %+v", result)
	}
	if result := Warm(context.Background(), Options{Tools: toolset.NewRegistry(), Input: "run go test"}); result != (Result{}) {
		t.Fatalf("expected nil cache to no-op, got %+v", result)
	}
	registry := toolset.NewRegistry()
	registry.Register(errorTool{name: "glob"})
	result := Warm(context.Background(), Options{Tools: registry, Cache: toolcache.New(), Input: "run go test"})
	if result.Planned != 2 || result.Cached != 0 || result.Errors != 2 {
		t.Fatalf("expected tool execution errors to be counted, got %+v", result)
	}
}

func TestPlanCapsTasksAndFiltersMentionedPaths(t *testing.T) {
	dir := t.TempDir()
	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(oldWd) })
	for _, path := range []string{"a.go", "b_test.go", "doc.md", filepath.Join("safe", "file.txt"), filepath.Join(".ssh", "id_rsa"), ".env"} {
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("x"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	tasks := plan(Options{Input: "inspect `a.go` `b_test.go` `doc.md` `safe/file.txt` `.ssh/id_rsa` `.env` then run go test and check `MySymbol` in roadmap plan"})
	if len(tasks) != 4 {
		t.Fatalf("expected plan to cap at 4 tasks, got %+v", tasks)
	}
	for _, task := range tasks {
		if path, _ := task.args["path"].(string); strings.Contains(path, ".ssh") || strings.HasPrefix(filepath.Base(path), ".env") || strings.HasPrefix(path, "..") {
			t.Fatalf("sensitive or unsafe path leaked into prefetch plan: %+v", tasks)
		}
	}
}

func TestLikelyCodeTokenAndStableArgsError(t *testing.T) {
	if got := likelyCodeToken("please inspect `MySymbol123`"); got != "MySymbol123" {
		t.Fatalf("unexpected code token: %q", got)
	}
	if got := likelyCodeToken("`ab`"); got != "" {
		t.Fatalf("expected short token ignored, got %q", got)
	}
	if got := stableArgs(map[string]any{"bad": make(chan int)}); got != "" {
		t.Fatalf("expected marshal error to return empty stable args, got %q", got)
	}
}

type slowTool struct{ name string }

func (t *slowTool) Name() string        { return t.name }
func (t *slowTool) Description() string { return t.name }
func (t *slowTool) Execute(args map[string]any) (string, error) {
	time.Sleep(200 * time.Millisecond)
	return "slow", nil
}
func (t *slowTool) Parameters() map[string]llm.Property { return nil }
func (t *slowTool) Required() []string                  { return nil }

type errorTool struct{ name string }

func (t errorTool) Name() string                                { return t.name }
func (t errorTool) Description() string                         { return t.name }
func (t errorTool) Execute(args map[string]any) (string, error) { return "", errors.New("tool failed") }
func (t errorTool) Parameters() map[string]llm.Property         { return nil }
func (t errorTool) Required() []string                          { return nil }
