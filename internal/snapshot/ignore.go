package snapshot

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

type IgnoreMatcher struct {
	Patterns []string
}

func LoadIgnore(dir string) (*IgnoreMatcher, error) {
	m := &IgnoreMatcher{}
	path := filepath.Join(dir, ".nataliaignore")
	f, err := os.Open(path)
	if err != nil {
		return m, nil
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		m.Patterns = append(m.Patterns, line)
	}
	return m, scanner.Err()
}

func DefaultIgnore() *IgnoreMatcher {
	return &IgnoreMatcher{
		Patterns: []string{
			".git/",
			"PLAN.md",
			"node_modules/",
			"__pycache__/",
			"*.pyc",
			"*.pyo",
			".DS_Store",
			"Thumbs.db",
			"*.exe",
			"*.dll",
			"*.so",
			"*.dylib",
			"*.test",
			"*.out",
			".idea/",
			".vscode/",
			"go.work",
			".natalia-sandbox/",
			".config/",
		},
	}
}

func (m *IgnoreMatcher) Ignored(path string) bool {
	cleaned := filepath.ToSlash(path)
	for _, p := range m.Patterns {
		if match(cleaned, p) {
			return true
		}
	}
	return false
}

func match(path, pattern string) bool {
	if strings.HasSuffix(pattern, "/") {
		dirPattern := strings.TrimSuffix(pattern, "/")
		if strings.Contains(path, "/"+dirPattern+"/") || strings.HasPrefix(path, dirPattern+"/") {
			return true
		}
	}
	if strings.HasPrefix(pattern, "*") {
		suffix := strings.TrimPrefix(pattern, "*")
		return strings.HasSuffix(path, suffix)
	}
	if strings.HasSuffix(pattern, "*") {
		prefix := strings.TrimSuffix(pattern, "*")
		return strings.HasPrefix(path, prefix)
	}
	return path == pattern || strings.HasPrefix(path, pattern+"/")
}
