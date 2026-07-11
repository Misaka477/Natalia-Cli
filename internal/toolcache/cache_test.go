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

	time.Sleep(time.Millisecond)
	if err := os.WriteFile(path, []byte("two"), 0644); err != nil {
		t.Fatal(err)
	}
	if got, ok := c.Get("read_file", args); ok {
		t.Fatalf("expected cache miss after file change, got %q", got)
	}
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
