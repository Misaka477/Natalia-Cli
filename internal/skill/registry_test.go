package skill

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFullQN(t *testing.T) {
	tests := []struct {
		scope, name, expected string
	}{
		{"user", "my-skill", "user:my-skill"},
		{"project", "test", "project:test"},
		{"bundled", "builtin-1", "bundled:builtin-1"},
		{"user", "", "user:"},
	}
	for _, tt := range tests {
		qn := FullQN(tt.scope, tt.name)
		if qn != tt.expected {
			t.Errorf("FullQN(%q, %q) = %q, want %q", tt.scope, tt.name, qn, tt.expected)
		}
	}
}

func TestNewSkillRegistry(t *testing.T) {
	r := NewSkillRegistry()
	if r == nil {
		t.Fatal("expected non-nil registry")
	}
	if len(r.List()) != 0 {
		t.Errorf("expected empty registry, got %d entries", len(r.List()))
	}
}

func TestSkillRegistryRegisterAndResolve(t *testing.T) {
	r := NewSkillRegistry()
	fm := &SkillFrontmatter{Name: "test", Description: "test desc"}
	entry, err := r.Register("/path/to/SKILL.md", fm, "body content", "test-skill", nil, "user")
	if err != nil {
		t.Fatal(err)
	}
	if entry.QualifiedName != "user:test" {
		t.Errorf("QualifiedName = %q, want %q", entry.QualifiedName, "user:test")
	}
	if entry.Metadata.Name != "test" {
		t.Errorf("Name = %q", entry.Metadata.Name)
	}
	if entry.Body != "body content" {
		t.Errorf("Body = %q", entry.Body)
	}
	if entry.Root != "test-skill" {
		t.Errorf("Root = %q", entry.Root)
	}

	resolved, err := r.Resolve("user:test")
	if err != nil {
		t.Fatal(err)
	}
	if resolved != entry {
		t.Error("Resolve should return the same entry")
	}
}

func TestSkillRegistryResolveNotFound(t *testing.T) {
	r := NewSkillRegistry()
	_, err := r.Resolve("user:nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent skill")
	}
}

func TestSkillRegistryRegisterConflict(t *testing.T) {
	r := NewSkillRegistry()
	fm := &SkillFrontmatter{Name: "test", Description: "desc"}
	_, err := r.Register("/a", fm, "body", "root", nil, "user")
	if err != nil {
		t.Fatal(err)
	}
	_, err = r.Register("/b", fm, "body2", "root2", nil, "user")
	if err == nil {
		t.Fatal("expected conflict error")
	}
}

func TestSkillRegistryList(t *testing.T) {
	r := NewSkillRegistry()
	r.Register("/a", &SkillFrontmatter{Name: "alpha", Description: "first"}, "a", "d1", nil, "user")
	r.Register("/b", &SkillFrontmatter{Name: "beta", Description: "second"}, "b", "d2", nil, "project")

	entries := r.List()
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}

	names := make(map[string]bool)
	for _, e := range entries {
		names[e.QualifiedName] = true
	}
	if !names["user:alpha"] {
		t.Error("missing user:alpha")
	}
	if !names["project:beta"] {
		t.Error("missing project:beta")
	}
}

func TestSkillRegistryHasAllowedTool(t *testing.T) {
	r := NewSkillRegistry()
	fm := &SkillFrontmatter{
		Name:         "tool-test",
		Description:  "test",
		AllowedTools: []string{"bash", "read"},
	}
	r.Register("/p", fm, "", "root", nil, "user")

	if !r.HasAllowedTool("bash") {
		t.Error("expected bash to be allowed")
	}
	if !r.HasAllowedTool("read") {
		t.Error("expected read to be allowed")
	}
	if r.HasAllowedTool("edit") {
		t.Error("expected edit to NOT be allowed")
	}
	if !r.HasAllowedTool("BASH") {
		t.Error("expected case-insensitive match for BASH")
	}
}

func TestSkillRegistryHasAllowedToolNoSkills(t *testing.T) {
	r := NewSkillRegistry()
	if r.HasAllowedTool("bash") {
		t.Error("expected false for empty registry")
	}
}

func TestSkillRegistryHasAllowedToolNoAllowedTools(t *testing.T) {
	r := NewSkillRegistry()
	fm := &SkillFrontmatter{Name: "no-tools", Description: "test"}
	r.Register("/p", fm, "", "root", nil, "user")
	if r.HasAllowedTool("anything") {
		t.Error("expected false when no AllowedTools defined")
	}
}

func TestActivation(t *testing.T) {
	r := NewSkillRegistry()
	fm := &SkillFrontmatter{Name: "act-skill", Description: "activation test"}
	entry, err := r.Register("/path", fm, "body content", "act-skill", nil, "user")
	if err != nil {
		t.Fatal(err)
	}

	a, err := r.Activate("user:act-skill")
	if err != nil {
		t.Fatal(err)
	}
	if !a.IsActive() {
		t.Error("expected active")
	}
	if a.Body() != "body content" {
		t.Errorf("Body() = %q, want %q", a.Body(), "body content")
	}
	if a.Resources() != nil {
		t.Errorf("expected nil resources for nil FS, got %v", a.Resources())
	}

	a.Deactivate()
	if a.IsActive() {
		t.Error("expected inactive after Deactivate")
	}

	_ = entry
}

func TestActivationNotFound(t *testing.T) {
	r := NewSkillRegistry()
	_, err := r.Activate("user:nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent activation")
	}
}

func TestActivationReActivate(t *testing.T) {
	r := NewSkillRegistry()
	fm := &SkillFrontmatter{Name: "re-act", Description: "re-activation test"}
	r.Register("/p", fm, "body", "root", nil, "user")

	a1, err := r.Activate("user:re-act")
	if err != nil {
		t.Fatal(err)
	}
	if !a1.IsActive() {
		t.Error("expected a1 active")
	}
	a1.Deactivate()

	a2, err := r.Activate("user:re-act")
	if err != nil {
		t.Fatal(err)
	}
	if !a2.IsActive() {
		t.Error("expected a2 active after re-activation")
	}
}

func TestActivationBodyFromFS(t *testing.T) {
	tmpDir := t.TempDir()
	skillDir := filepath.Join(tmpDir, "fs-skill")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: fs-skill\ndescription: from fs\n---\nFS body content"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "helper.sh"), []byte("#!/bin/sh"), 0644); err != nil {
		t.Fatal(err)
	}

	r := NewSkillRegistry()
	fm := &SkillFrontmatter{Name: "fs-skill", Description: "from fs"}
	r.Register("/p", fm, "", "fs-skill", os.DirFS(tmpDir), "project")

	a, err := r.Activate("project:fs-skill")
	if err != nil {
		t.Fatal(err)
	}
	if a.Body() != "FS body content" {
		t.Errorf("Body() = %q, want %q", a.Body(), "FS body content")
	}

	resources := a.Resources()
	if len(resources) != 1 || resources[0] != "fs-skill/helper.sh" {
		t.Errorf("Resources() = %v, want [fs-skill/helper.sh]", resources)
	}
}

func TestResolveSkillPathValid(t *testing.T) {
	tmpDir := t.TempDir()
	skillDir := filepath.Join(tmpDir, "myskill")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "test.txt"), []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}

	resolved, err := ResolveSkillPath(tmpDir, "myskill/test.txt")
	if err != nil {
		t.Fatal(err)
	}
	if !IsWithinRoot(tmpDir, resolved) {
		t.Error("expected path within root")
	}
}

func TestResolveSkillPathSymlinkEscape(t *testing.T) {
	if _, err := os.Stat("/etc/passwd"); os.IsNotExist(err) {
		t.Skip("/etc/passwd not available")
	}

	tmpDir := t.TempDir()
	skillDir := filepath.Join(tmpDir, "myskill")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatal(err)
	}
	escapeLink := filepath.Join(skillDir, "escape")
	if err := os.Symlink("/etc/passwd", escapeLink); err != nil {
		t.Fatal(err)
	}

	_, err := ResolveSkillPath(tmpDir, "myskill/escape")
	if err == nil {
		t.Error("expected error for symlink escape")
	}
}

func TestResolveSkillPathSymlinkWithinRoot(t *testing.T) {
	tmpDir := t.TempDir()
	skillDir := filepath.Join(tmpDir, "myskill")
	targetDir := filepath.Join(tmpDir, "shared")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(targetDir, "data.txt"), []byte("data"), 0644); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(skillDir, "linked")
	if err := os.Symlink("../shared/data.txt", link); err != nil {
		t.Fatal(err)
	}

	resolved, err := ResolveSkillPath(tmpDir, "myskill/linked")
	if err != nil {
		t.Fatal(err)
	}
	if !IsWithinRoot(tmpDir, resolved) {
		t.Error("expected symlink within root to be allowed")
	}
}

func TestIsWithinRoot(t *testing.T) {
	tests := []struct {
		root, resolved string
		expected       bool
	}{
		{"/a/b", "/a/b/c/d", true},
		{"/a/b", "/a/b", true},
		{"/a/b", "/a/c", false},
		{"/a/b", "/a", false},
		{"/a/b", "/b/c", false},
	}
	for _, tt := range tests {
		got := IsWithinRoot(tt.root, tt.resolved)
		if got != tt.expected {
			t.Errorf("IsWithinRoot(%q, %q) = %v, want %v", tt.root, tt.resolved, got, tt.expected)
		}
	}
}

func TestActivationResourcesFromFS(t *testing.T) {
	tmpDir := t.TempDir()
	skillDir := filepath.Join(tmpDir, "res-skill")
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: res-skill\ndescription: resource test\n---\nbody"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "script.sh"), []byte("echo hi"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "config.json"), []byte("{}"), 0644); err != nil {
		t.Fatal(err)
	}
	subDir := filepath.Join(skillDir, "assets")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatal(err)
	}

	r := NewSkillRegistry()
	fm := &SkillFrontmatter{Name: "res-skill", Description: "resource test"}
	r.Register("/p", fm, "body", "res-skill", os.DirFS(tmpDir), "project")

	a, err := r.Activate("project:res-skill")
	if err != nil {
		t.Fatal(err)
	}

	resources := a.Resources()
	if len(resources) != 3 {
		t.Fatalf("expected 3 resources, got %v", resources)
	}

	if resources[0] != "res-skill/assets/" {
		t.Errorf("resources[0] = %q, want %q", resources[0], "res-skill/assets/")
	}
	if resources[1] != "res-skill/config.json" {
		t.Errorf("resources[1] = %q", resources[1])
	}
	if resources[2] != "res-skill/script.sh" {
		t.Errorf("resources[2] = %q", resources[2])
	}
}
