package sandbox

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUserSandboxLifecycleCreateListDuplicateDelete(t *testing.T) {
	workDir := t.TempDir()

	b2, err := Create("sb2", "user", workDir)
	if err != nil {
		t.Fatal(err)
	}
	b1, err := Create("sb1", "user", workDir)
	if err != nil {
		t.Fatal(err)
	}
	if b1.Type != "user" || b1.WorkDir != workDir || b1.Overlay == "" || b2.Overlay == "" {
		t.Fatalf("created sandbox metadata incomplete: b1=%+v b2=%+v", b1, b2)
	}
	metaPath := filepath.Join(BaseDir(workDir), "sb1", "meta.json")
	if _, err := os.Stat(metaPath); os.IsNotExist(err) {
		t.Error("meta.json should exist")
	}
	boxes, err := List(workDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(boxes) != 2 || boxes[0].Name != "sb1" || boxes[1].Name != "sb2" {
		t.Fatalf("expected sorted boxes sb1/sb2, got %+v", boxes)
	}
	if _, err := Create("sb1", "user", workDir); err == nil {
		t.Fatal("expected duplicate create error")
	}
	if err := b1.Delete(); err != nil {
		t.Fatal(err)
	}
	boxes, err = List(workDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(boxes) != 1 || boxes[0].Name != "sb2" {
		t.Fatalf("expected only sb2 after delete, got %+v", boxes)
	}
}

func TestOverlayReadWrite(t *testing.T) {
	workDir := t.TempDir()

	b, _ := Create("test", "user", workDir)

	// Write to overlay
	err := b.WriteFile("hello.txt", []byte("hello sandbox"), 0644)
	if err != nil {
		t.Fatal(err)
	}

	// Read from overlay
	data, err := b.ReadFile("hello.txt")
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "hello sandbox" {
		t.Errorf("expected 'hello sandbox', got '%s'", data)
	}

	// HasOverlay
	if !b.HasOverlay("hello.txt") {
		t.Error("should have overlay for hello.txt")
	}
}

func TestOverlayFallbackToReal(t *testing.T) {
	workDir := t.TempDir()

	// Create a real file
	os.WriteFile(filepath.Join(workDir, "real.txt"), []byte("real file"), 0644)

	b, _ := Create("test", "user", workDir)

	// Read from real dir (no overlay)
	data, err := b.ReadFile("real.txt")
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "real file" {
		t.Errorf("expected 'real file', got '%s'", data)
	}

	// Overlay shadows real
	b.WriteFile("real.txt", []byte("overlay version"), 0644)
	data, _ = b.ReadFile("real.txt")
	if string(data) != "overlay version" {
		t.Errorf("expected 'overlay version', got '%s'", data)
	}
}

func TestMerge(t *testing.T) {
	workDir := t.TempDir()

	// Original file
	os.WriteFile(filepath.Join(workDir, "test.txt"), []byte("original"), 0644)

	b, _ := Create("test", "user", workDir)

	// Modify via overlay
	b.WriteFile("test.txt", []byte("modified"), 0644)

	// Merge
	changed, err := b.Merge()
	if err != nil {
		t.Fatal(err)
	}
	if len(changed) != 1 || changed[0] != "test.txt" {
		t.Errorf("expected changed files to include test.txt, got %v", changed)
	}

	// Verify real file was updated
	data, _ := os.ReadFile(filepath.Join(workDir, "test.txt"))
	if string(data) != "modified" {
		t.Errorf("expected 'modified', got '%s'", data)
	}
}

func TestDiff(t *testing.T) {
	workDir := t.TempDir()

	os.WriteFile(filepath.Join(workDir, "a.txt"), []byte("aaa"), 0644)
	os.WriteFile(filepath.Join(workDir, "b.txt"), []byte("bbb"), 0644)

	b, _ := Create("test", "user", workDir)

	// Modify one file via overlay
	b.WriteFile("a.txt", []byte("modified a"), 0644)

	diff, err := b.Diff()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(diff, "M a.txt") {
		t.Errorf("diff should show modified file, got: %s", diff)
	}
}
