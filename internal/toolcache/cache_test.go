package toolcache

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCacheReadFileUsesFileMetadata(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "file.txt")
	if err := os.WriteFile(path, []byte("one"), 0644); err != nil {
		t.Fatal(err)
	}
	c := New()
	args := map[string]any{"path": path, "limit": "1-10"}
	c.Set("read_file", args, "cached one")
	if got, ok := c.Get("read_file", args); !ok || got != "cached one" {
		t.Fatalf("expected cache hit, got %q ok=%v", got, ok)
	}

	time.Sleep(20 * time.Millisecond)
	if err := os.WriteFile(path, []byte("two"), 0644); err != nil {
		t.Fatal(err)
	}
	if got, ok := c.Get("read_file", args); ok {
		t.Fatalf("expected cache miss after file change, got %q", got)
	}
}

func TestCacheMissAndNoOpPaths(t *testing.T) {
	c := New()
	if got, ok := c.Get("read_file", map[string]any{"path": ""}); ok || got != "" {
		t.Fatalf("expected empty read_file path to miss, got %q ok=%v", got, ok)
	}
	if got, ok := c.Get("read_file", map[string]any{"path": filepath.Join(t.TempDir(), "missing.txt")}); ok || got != "" {
		t.Fatalf("expected missing file path to miss, got %q ok=%v", got, ok)
	}
	c.Set("read_file", map[string]any{"path": ""}, "ignored")
	if got, ok := c.Get("read_file", map[string]any{"path": ""}); ok || got != "" {
		t.Fatalf("expected Set with empty path to be ignored, got %q ok=%v", got, ok)
	}
	c.InvalidatePath("")
}

func TestCacheInvalidatePath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "file.txt")
	if err := os.WriteFile(path, []byte("one"), 0644); err != nil {
		t.Fatal(err)
	}
	c := New()
	args := map[string]any{"path": path}
	c.Set("read_file", args, "cached")
	c.InvalidatePath(path)
	if got, ok := c.Get("read_file", args); ok {
		t.Fatalf("expected cache miss after invalidate, got %q", got)
	}
}

func TestCacheReadFileNormalizesRelativeAndAbsolutePaths(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "file.txt")
	if err := os.WriteFile(path, []byte("one"), 0644); err != nil {
		t.Fatal(err)
	}
	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(oldWd) })

	c := New()
	c.Set("read_file", map[string]any{"path": "file.txt"}, "cached")
	if got, ok := c.Get("read_file", map[string]any{"path": path}); !ok || got != "cached" {
		t.Fatalf("expected absolute path to hit relative-path cache, got %q ok=%v", got, ok)
	}
	c.InvalidatePath(path)
	if got, ok := c.Get("read_file", map[string]any{"path": "file.txt"}); ok {
		t.Fatalf("expected normalized invalidate to clear cache, got %q", got)
	}
}

func TestCacheInvalidateAll(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "file.txt")
	if err := os.WriteFile(path, []byte("one"), 0644); err != nil {
		t.Fatal(err)
	}
	c := New()
	c.Set("read_file", map[string]any{"path": path}, "cached")
	c.Set("glob", map[string]any{"pattern": "**/*.go"}, "matches")
	c.InvalidateAll()
	if got, ok := c.Get("read_file", map[string]any{"path": path}); ok {
		t.Fatalf("expected read cache invalidated, got %q", got)
	}
	if got, ok := c.Get("glob", map[string]any{"pattern": "**/*.go"}); ok {
		t.Fatalf("expected glob cache invalidated, got %q", got)
	}
}

func TestCacheGlobAndGrepUseStableArgs(t *testing.T) {
	c := New()
	argsA := map[string]any{"path": ".", "pattern": "**/*.go"}
	argsB := map[string]any{"pattern": "**/*.go", "path": "."}
	c.Set("glob", argsA, "matches")
	if got, ok := c.Get("glob", argsB); !ok || got != "matches" {
		t.Fatalf("expected stable glob cache hit, got %q ok=%v", got, ok)
	}
	c.Set("grep", map[string]any{"pattern": "Needle", "path": ".", "include": "*.go"}, "hits")
	if got, ok := c.Get("grep", map[string]any{"include": "*.go", "path": ".", "pattern": "Needle"}); !ok || got != "hits" {
		t.Fatalf("expected stable grep cache hit, got %q ok=%v", got, ok)
	}
}

func TestCacheRejectsUnmarshalableSearchArgs(t *testing.T) {
	c := New()
	args := map[string]any{"pattern": "x", "bad": make(chan int)}
	c.Set("glob", args, "ignored")
	if got, ok := c.Get("glob", args); ok || got != "" {
		t.Fatalf("expected unmarshalable glob args to be uncacheable, got %q ok=%v", got, ok)
	}
}

func TestCacheInvalidatePathClearsSearchCaches(t *testing.T) {
	c := New()
	c.Set("glob", map[string]any{"pattern": "**/*.go"}, "matches")
	c.Set("grep", map[string]any{"pattern": "Needle", "path": "."}, "hits")
	c.InvalidatePath("changed.go")
	if got, ok := c.Get("glob", map[string]any{"pattern": "**/*.go"}); ok {
		t.Fatalf("expected glob cache invalidated, got %q", got)
	}
	if got, ok := c.Get("grep", map[string]any{"pattern": "Needle", "path": "."}); ok {
		t.Fatalf("expected grep cache invalidated, got %q", got)
	}
}

func TestMutatedPathOnlyForSuccessfulWrites(t *testing.T) {
	args := map[string]any{"path": "a.txt"}
	if got := MutatedPath("write_file", args, ""); got != "a.txt" {
		t.Fatalf("expected mutated path, got %q", got)
	}
	if got := MutatedPath("write_file", args, "failed"); got != "" {
		t.Fatalf("expected failed write not to invalidate, got %q", got)
	}
	if got := MutatedPath("read_file", args, ""); got != "" {
		t.Fatalf("expected read_file not to mutate, got %q", got)
	}
}

func TestMutatesUnknownFilesForSuccessfulShell(t *testing.T) {
	if !MutatesUnknownFiles("run_shell", "") {
		t.Fatal("expected successful shell to conservatively invalidate all caches")
	}
	if MutatesUnknownFiles("run_shell", "failed") {
		t.Fatal("expected failed shell not to invalidate all caches")
	}
	if MutatesUnknownFiles("read_file", "") {
		t.Fatal("expected read_file not to invalidate all caches")
	}
}
