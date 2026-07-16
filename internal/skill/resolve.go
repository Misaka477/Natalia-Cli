package skill

import (
	"fmt"
	"path/filepath"
	"strings"
)

func ResolveSkillPath(root, relPath string) (string, error) {
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("resolving root path: %w", err)
	}
	joined := filepath.Join(rootAbs, relPath)
	resolved, err := filepath.EvalSymlinks(joined)
	if err != nil {
		return "", fmt.Errorf("evaluating symlinks: %w", err)
	}
	if !IsWithinRoot(rootAbs, resolved) {
		return "", fmt.Errorf("path %q escapes skill root %q", resolved, rootAbs)
	}
	return resolved, nil
}

func IsWithinRoot(root, resolvedPath string) bool {
	root = filepath.Clean(root)
	resolvedPath = filepath.Clean(resolvedPath)
	rel, err := filepath.Rel(root, resolvedPath)
	if err != nil {
		return false
	}
	return !strings.HasPrefix(rel, "..")
}
