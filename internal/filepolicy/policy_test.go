package filepolicy

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPolicyAllowsWorkspaceAndAdditionalDirsOnly(t *testing.T) {
	work := t.TempDir()
	extra := t.TempDir()
	outside := t.TempDir()
	p := New(work, []string{extra})

	if err := p.GuardRead(filepath.Join(work, "main.go")); err != nil {
		t.Fatalf("workspace read should be allowed: %v", err)
	}
	if err := p.GuardWrite(filepath.Join(extra, "note.txt")); err != nil {
		t.Fatalf("additional dir write should be allowed: %v", err)
	}
	err := p.GuardWrite(filepath.Join(outside, "note.txt"))
	if err == nil || !strings.Contains(err.Error(), "outside allowed workspace roots") {
		t.Fatalf("expected outside-root rejection, got %v", err)
	}
}

func TestPolicyBlocksSensitivePathsAndSymlinkEscapes(t *testing.T) {
	work := t.TempDir()
	outside := t.TempDir()
	p := New(work, nil)
	if err := p.GuardRead(filepath.Join(work, ".env")); err == nil || !strings.Contains(err.Error(), "sensitive") {
		t.Fatalf("expected sensitive read rejection, got %v", err)
	}
	link := filepath.Join(work, "outside")
	if err := os.Symlink(outside, link); err != nil {
		t.Skipf("symlink unavailable: %v", err)
	}
	err := p.GuardWrite(filepath.Join(link, "file.txt"))
	if err == nil || !strings.Contains(err.Error(), "outside allowed workspace roots") {
		t.Fatalf("expected symlink escape rejection, got %v", err)
	}
}
