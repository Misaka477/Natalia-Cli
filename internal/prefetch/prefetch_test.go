package prefetch

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/aquama/natalia-cli/internal/llm"
	"github.com/aquama/natalia-cli/internal/mode"
	"github.com/aquama/natalia-cli/internal/toolcache"
	"github.com/aquama/natalia-cli/internal/toolset"
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

type slowTool struct{ name string }

func (t *slowTool) Name() string        { return t.name }
func (t *slowTool) Description() string { return t.name }
func (t *slowTool) Execute(args map[string]any) (string, error) {
	time.Sleep(50 * time.Millisecond)
	return "slow", nil
}
func (t *slowTool) Parameters() map[string]llm.Property { return nil }
func (t *slowTool) Required() []string                  { return nil }
