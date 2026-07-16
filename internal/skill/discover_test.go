package skill

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

func TestDefaultSearchRoots(t *testing.T) {
	homeDir := "/home/testuser"
	workDir := "/home/testuser/project"
	roots := DefaultSearchRoots(homeDir, workDir)

	if len(roots) != 6 {
		t.Fatalf("expected 6 roots, got %d", len(roots))
	}

	expectedPrefixes := []string{homeDir, homeDir, homeDir, workDir, workDir, workDir}
	for i, root := range roots {
		if !strings.HasPrefix(root, expectedPrefixes[i]) {
			t.Errorf("roots[%d] = %q, expected prefix %q", i, root, expectedPrefixes[i])
		}
	}

	configDirs := []string{".agents", ".natalia", ".claude"}
	for i, cfgDir := range configDirs {
		if !strings.Contains(roots[i], cfgDir) {
			t.Errorf("roots[%d] should contain %q", i, cfgDir)
		}
		if !strings.Contains(roots[i+3], cfgDir) {
			t.Errorf("roots[%d] should contain %q", i+3, cfgDir)
		}
	}
}

func TestDiscoverRoots_FindsSkills(t *testing.T) {
	tmpDir := t.TempDir()

	skillDir := filepath.Join(tmpDir, "test-skill")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: test-skill\ndescription: A test skill\n---\nBody content"), 0644); err != nil {
		t.Fatal(err)
	}
	// Second skill
	skillDir2 := filepath.Join(tmpDir, "another-skill")
	if err := os.MkdirAll(skillDir2, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir2, "SKILL.md"), []byte("---\nname: another-skill\ndescription: Another skill\nlicense: MIT\n---\nMore content"), 0644); err != nil {
		t.Fatal(err)
	}

	roots := []string{tmpDir}
	results, err := DiscoverRoots(roots, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d: %+v", len(results), results)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Name < results[j].Name
	})

	if results[0].Name != "another-skill" {
		t.Errorf("Name = %q, want %q", results[0].Name, "another-skill")
	}
	if results[0].Description != "Another skill" {
		t.Errorf("Description = %q", results[0].Description)
	}
	if results[0].License != "MIT" {
		t.Errorf("License = %q", results[0].License)
	}
	if results[0].QualifiedName != "user:another-skill" {
		t.Errorf("QN = %q", results[0].QualifiedName)
	}

	if results[1].Name != "test-skill" {
		t.Errorf("Name = %q", results[1].Name)
	}
	if results[1].QualifiedName != "user:test-skill" {
		t.Errorf("QN = %q", results[1].QualifiedName)
	}
}

func TestDiscoverRoots_Budget(t *testing.T) {
	tmpDir := t.TempDir()

	for i := 0; i < 5; i++ {
		name := "skill-" + string(rune('a'+i))
		skillDir := filepath.Join(tmpDir, name)
		os.MkdirAll(skillDir, 0755)
		os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: "+name+"\ndescription: desc\n---\nbody"), 0644)
	}

	roots := []string{tmpDir}
	results, err := DiscoverRoots(roots, 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 results (budget=3), got %d", len(results))
	}
}

func TestDiscoverRoots_SkipsNonSkillDirs(t *testing.T) {
	tmpDir := t.TempDir()

	// Valid skill
	os.MkdirAll(filepath.Join(tmpDir, "valid-skill"), 0755)
	os.WriteFile(filepath.Join(tmpDir, "valid-skill", "SKILL.md"), []byte("---\nname: valid\ndescription: valid\n---\nbody"), 0644)

	// Directory with no SKILL.md
	os.MkdirAll(filepath.Join(tmpDir, "no-skill-dir"), 0755)
	os.WriteFile(filepath.Join(tmpDir, "no-skill-dir", "other.md"), []byte("content"), 0644)

	// File (not dir)
	os.WriteFile(filepath.Join(tmpDir, "not-a-dir"), []byte("content"), 0644)

	roots := []string{tmpDir}
	results, err := DiscoverRoots(roots, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 || results[0].Name != "valid" {
		t.Fatalf("expected 1 result (valid), got %d: %+v", len(results), results)
	}
}

func TestDiscoverRoots_DeDupByName(t *testing.T) {
	tmpDir := t.TempDir()
	tmpDir2 := t.TempDir()

	os.MkdirAll(filepath.Join(tmpDir, "shared"), 0755)
	os.WriteFile(filepath.Join(tmpDir, "shared", "SKILL.md"), []byte("---\nname: shared\ndescription: first\n---\nbody1"), 0644)

	os.MkdirAll(filepath.Join(tmpDir2, "shared"), 0755)
	os.WriteFile(filepath.Join(tmpDir2, "shared", "SKILL.md"), []byte("---\nname: shared\ndescription: second\n---\nbody2"), 0644)

	roots := []string{tmpDir, tmpDir2}
	results, err := DiscoverRoots(roots, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result (deduped), got %d", len(results))
	}
	// First root wins (higher priority)
	if results[0].Description != "first" {
		t.Errorf("expected first root's description, got %q", results[0].Description)
	}
}

func TestDiscoverRoots_ReturnsErrorOnReadFailure(t *testing.T) {
	results, err := DiscoverRoots([]string{"/nonexistent/path"}, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results for nonexistent path, got %d", len(results))
	}
}

func TestDiscoverResult_HasAllowedTools(t *testing.T) {
	tmpDir := t.TempDir()
	skillDir := filepath.Join(tmpDir, "tool-skill")
	os.MkdirAll(skillDir, 0755)
	os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: tool-skill\ndescription: has tools\nallowed-tools:\n  - bash\n  - read\n---\nbody"), 0644)

	roots := []string{tmpDir}
	results, err := DiscoverRoots(roots, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if len(results[0].AllowedTools) != 2 {
		t.Fatalf("expected 2 allowed tools, got %v", results[0].AllowedTools)
	}
	if results[0].AllowedTools[0] != "bash" {
		t.Errorf("AllowedTools[0] = %q", results[0].AllowedTools[0])
	}
}

func TestScopeForSearchIndex(t *testing.T) {
	if scopeForSearchIndex(0) != "user" {
		t.Error("index 0 should be user")
	}
	if scopeForSearchIndex(2) != "user" {
		t.Error("index 2 should be user")
	}
	if scopeForSearchIndex(3) != "project" {
		t.Error("index 3 should be project")
	}
	if scopeForSearchIndex(5) != "project" {
		t.Error("index 5 should be project")
	}
}
