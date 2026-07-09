package file

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGrep(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "test.go"), []byte("package main\nfunc main() {}\n"), 0644)

	g := &Grep{}
	result, err := g.Execute(map[string]any{
		"pattern": "func",
		"path":    dir,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "func main") {
		t.Errorf("expected 'func main', got %s", result)
	}
}

func TestGrepNoMatch(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "test.txt"), []byte("hello"), 0644)

	g := &Grep{}
	result, err := g.Execute(map[string]any{
		"pattern": "zzzzz",
		"path":    dir,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "未找到") {
		t.Errorf("expected '未找到', got %s", result)
	}
}

func TestGrepWithInclude(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.go"), []byte("go file"), 0644)
	os.WriteFile(filepath.Join(dir, "b.txt"), []byte("text file"), 0644)

	g := &Grep{}
	result, _ := g.Execute(map[string]any{
		"pattern": "file",
		"path":    dir,
		"include": "*.go",
	})
	if strings.Contains(result, "text") {
		t.Error("should not match .txt files")
	}
	if !strings.Contains(result, "go") {
		t.Error("should match .go files")
	}
}

func TestGlobBasic(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.go"), []byte("a"), 0644)
	os.WriteFile(filepath.Join(dir, "b.go"), []byte("b"), 0644)

	g := &Glob{}
	result, err := g.Execute(map[string]any{
		"pattern": "*.go",
		"path":    dir,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "a.go") || !strings.Contains(result, "b.go") {
		t.Errorf("expected both .go files, got %s", result)
	}
}

func TestGlobRecursive(t *testing.T) {
	dir := t.TempDir()
	sub := filepath.Join(dir, "sub")
	os.MkdirAll(sub, 0755)
	os.WriteFile(filepath.Join(sub, "deep.go"), []byte("deep"), 0644)

	g := &Glob{}
	result, err := g.Execute(map[string]any{
		"pattern": "**/*.go",
		"path":    dir,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "deep.go") {
		t.Errorf("expected deep.go in results, got %s", result)
	}
}
