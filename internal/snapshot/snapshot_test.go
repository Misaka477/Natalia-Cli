package snapshot

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestObjects(t *testing.T) {
	dir := t.TempDir()
	obs, err := NewObjects(dir)
	if err != nil {
		t.Fatal(err)
	}

	data := []byte("hello world")
	hash := obs.Store(data)
	if hash == "" {
		t.Fatal("expected non-empty hash")
	}

	loaded, err := obs.Load(hash)
	if err != nil {
		t.Fatal(err)
	}
	if string(loaded) != string(data) {
		t.Errorf("expected %q, got %q", data, loaded)
	}
}

func TestObjectsDedup(t *testing.T) {
	dir := t.TempDir()
	obs, err := NewObjects(dir)
	if err != nil {
		t.Fatal(err)
	}

	data := []byte("same content")
	h1 := obs.Store(data)
	h2 := obs.Store(data)
	if h1 != h2 {
		t.Error("same content should produce same hash")
	}
}

func TestIgnoreDefault(t *testing.T) {
	m := DefaultIgnore()
	tests := []struct {
		path    string
		ignored bool
	}{
		{".git/config", true},
		{"node_modules/package/index.js", true},
		{"__pycache__/main.pyc", true},
		{"main.go", false},
		{"internal/approval/approval.go", false},
		{".config/config.yaml", true},
		{".natalia-sandbox/test/overlay", true},
	}
	for _, tt := range tests {
		got := m.Ignored(tt.path)
		if got != tt.ignored {
			t.Errorf("Ignore(%q) = %v, want %v", tt.path, got, tt.ignored)
		}
	}
}

func TestIgnoreFile(t *testing.T) {
	dir := t.TempDir()
	content := "*.log\nbuild/\n"
	os.WriteFile(filepath.Join(dir, ".nataliaignore"), []byte(content), 0644)

	m, err := LoadIgnore(dir)
	if err != nil {
		t.Fatal(err)
	}

	if !m.Ignored("server.log") {
		t.Error("should ignore *.log")
	}
	if !m.Ignored("build/output.o") {
		t.Error("should ignore build/")
	}
	if m.Ignored("main.go") {
		t.Error("should not ignore main.go")
	}
}

func TestCheckpointPersistsLoadableTreeAndObjects(t *testing.T) {
	workDir := t.TempDir()
	sessionDir := t.TempDir()
	file := filepath.Join(workDir, "nested", "test.txt")
	if err := os.MkdirAll(filepath.Dir(file), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file, []byte("snapshot content"), 0600); err != nil {
		t.Fatal(err)
	}

	eng, err := NewEngine(workDir, sessionDir)
	if err != nil {
		t.Fatal(err)
	}
	treeHash, err := eng.Checkpoint(7, []string{file})
	if err != nil {
		t.Fatal(err)
	}
	refHash, err := eng.GetTreeHash(7)
	if err != nil {
		t.Fatal(err)
	}
	if refHash != treeHash {
		t.Fatalf("expected refs tree hash %q, got %q", treeHash, refHash)
	}
	tree, err := eng.LoadTree(treeHash)
	if err != nil {
		t.Fatal(err)
	}
	if len(tree.Files) != 1 || tree.Files[0].Path != filepath.Join("nested", "test.txt") || tree.Files[0].Mode.Perm() != 0600 {
		t.Fatalf("unexpected checkpoint tree: %+v", tree.Files)
	}
	stored, err := eng.Objects.Load(tree.Files[0].Hash)
	if err != nil {
		t.Fatal(err)
	}
	if string(stored) != "snapshot content" {
		t.Fatalf("expected stored file content, got %q", stored)
	}
}

func TestCheckpoint(t *testing.T) {
	workDir := t.TempDir()
	sessionDir := t.TempDir()

	testFile := filepath.Join(workDir, "test.txt")
	os.WriteFile(testFile, []byte("original"), 0644)

	eng, err := NewEngine(workDir, sessionDir)
	if err != nil {
		t.Fatal(err)
	}

	_, err = eng.Checkpoint(1, []string{testFile})
	if err != nil {
		t.Fatal(err)
	}

	refsFile := filepath.Join(sessionDir, "refs.jsonl")
	data, err := os.ReadFile(refsFile)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"step":1`) {
		t.Error("refs.jsonl should contain step 1")
	}
}

func TestRollback(t *testing.T) {
	workDir := t.TempDir()
	sessionDir := t.TempDir()

	testFile := filepath.Join(workDir, "test.txt")
	os.WriteFile(testFile, []byte("original"), 0644)

	eng, err := NewEngine(workDir, sessionDir)
	if err != nil {
		t.Fatal(err)
	}

	eng.Checkpoint(1, []string{testFile})

	os.WriteFile(testFile, []byte("modified"), 0644)

	err = eng.Rollback(1)
	if err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(testFile)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "original" {
		t.Errorf("expected 'original', got '%s'", data)
	}
}

func TestShouldTrack(t *testing.T) {
	workDir := t.TempDir()
	sessionDir := t.TempDir()

	eng, err := NewEngine(workDir, sessionDir)
	if err != nil {
		t.Fatal(err)
	}

	testFile := filepath.Join(workDir, "test.go")
	os.WriteFile(testFile, []byte("package main"), 0644)

	if !eng.ShouldTrack(testFile) {
		t.Error("should track .go files")
	}

	ignoreFile := filepath.Join(workDir, ".git", "config")
	if eng.ShouldTrack(ignoreFile) {
		t.Error("should NOT track .git/ files")
	}
}

func TestSnapshotThenModifyThenRollback(t *testing.T) {
	workDir := t.TempDir()
	sessionDir := t.TempDir()

	files := []string{
		filepath.Join(workDir, "a.txt"),
		filepath.Join(workDir, "b.txt"),
	}
	os.WriteFile(files[0], []byte("aaa"), 0644)
	os.WriteFile(files[1], []byte("bbb"), 0644)

	eng, err := NewEngine(workDir, sessionDir)
	if err != nil {
		t.Fatal(err)
	}

	eng.Checkpoint(1, files)

	os.WriteFile(files[0], []byte("modified a"), 0644)
	os.WriteFile(files[1], []byte("modified b"), 0644)

	os.WriteFile(filepath.Join(workDir, "c.txt"), []byte("new file"), 0644)

	eng.Rollback(1)

	for _, f := range files {
		data, _ := os.ReadFile(f)
		if string(data) != map[string]string{
			files[0]: "aaa",
			files[1]: "bbb",
		}[f] {
			t.Errorf("file %s was not restored", f)
		}
	}

	if _, err := os.Stat(filepath.Join(workDir, "c.txt")); os.IsNotExist(err) {
		t.Error("new file should still exist after rollback (only tracked files are reverted)")
	}
}
