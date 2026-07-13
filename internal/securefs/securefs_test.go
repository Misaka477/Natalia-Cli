package securefs

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWriteFileAndOpenAppendUsePrivateModes(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "state")
	path := filepath.Join(dir, "context.jsonl")
	if err := WriteFile(path, []byte("one\n")); err != nil {
		t.Fatal(err)
	}
	assertMode(t, dir, DirMode)
	assertMode(t, path, FileMode)

	f, err := OpenAppend(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.Write([]byte("two\n")); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	assertMode(t, path, FileMode)
}

func TestChmodFileIfExistsMigratesExistingMode(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := ChmodFileIfExists(path); err != nil {
		t.Fatal(err)
	}
	assertMode(t, path, FileMode)
}

func assertMode(t *testing.T, path string, want os.FileMode) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != want {
		t.Fatalf("expected %s mode %o, got %o", path, want, info.Mode().Perm())
	}
}
