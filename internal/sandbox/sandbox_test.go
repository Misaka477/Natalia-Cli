package sandbox

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCreateUserSandbox(t *testing.T) {
	workDir := t.TempDir()

	b, err := Create("test-sandbox", "user", workDir)
	if err != nil {
		t.Fatal(err)
	}

	if b.Name != "test-sandbox" {
		t.Errorf("expected name test-sandbox, got %s", b.Name)
	}
	if b.Type != "user" {
		t.Errorf("expected type user, got %s", b.Type)
	}

	metaPath := filepath.Join(BaseDir(workDir), "test-sandbox", "meta.json")
	if _, err := os.Stat(metaPath); os.IsNotExist(err) {
		t.Error("meta.json should exist")
	}
}

func TestListSandboxes(t *testing.T) {
	workDir := t.TempDir()

	Create("sb1", "user", workDir)

	// agent box requires git repo — skip in test
	boxes, err := List(workDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(boxes) != 1 {
		t.Fatalf("expected 1 box, got %d", len(boxes))
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

func TestDelete(t *testing.T) {
	workDir := t.TempDir()

	b, _ := Create("test", "user", workDir)
	b.Delete()

	boxes, _ := List(workDir)
	if len(boxes) != 0 {
		t.Error("should have no boxes after delete")
	}
}

func TestDuplicateCreate(t *testing.T) {
	workDir := t.TempDir()

	Create("dup", "user", workDir)
	_, err := Create("dup", "user", workDir)
	if err == nil {
		t.Error("expected error for duplicate sandbox")
	}
}
