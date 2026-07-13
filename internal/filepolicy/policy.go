package filepolicy

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Policy struct {
	Roots []string
}

func New(workDir string, additionalDirs []string) Policy {
	if workDir == "" {
		workDir, _ = os.Getwd()
	}
	roots := make([]string, 0, 1+len(additionalDirs))
	roots = appendRoot(roots, workDir)
	for _, dir := range additionalDirs {
		roots = appendRoot(roots, dir)
	}
	return Policy{Roots: roots}
}

func (p Policy) GuardRead(path string) error {
	resolved, err := p.resolve(path, false)
	if err != nil {
		return err
	}
	if err := p.guardResolved(resolved); err != nil {
		return err
	}
	if IsSensitivePath(resolved) {
		return fmt.Errorf("refusing to read sensitive path: %s", path)
	}
	return nil
}

func (p Policy) GuardWrite(path string) error {
	resolved, err := p.resolve(path, true)
	if err != nil {
		return err
	}
	if err := p.guardResolved(resolved); err != nil {
		return err
	}
	if IsSensitivePath(resolved) {
		return fmt.Errorf("refusing to write sensitive path: %s", path)
	}
	return nil
}

func (p Policy) guardResolved(path string) error {
	if len(p.Roots) == 0 {
		return nil
	}
	for _, root := range p.Roots {
		if within(root, path) {
			return nil
		}
	}
	return fmt.Errorf("path is outside allowed workspace roots: %s", path)
}

func (p Policy) resolve(path string, allowMissing bool) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", fmt.Errorf("path required")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	abs = filepath.Clean(abs)
	if resolved, err := filepath.EvalSymlinks(abs); err == nil {
		return filepath.Clean(resolved), nil
	}
	if !allowMissing {
		return abs, nil
	}
	parent := filepath.Dir(abs)
	if resolvedParent, err := filepath.EvalSymlinks(parent); err == nil {
		return filepath.Join(resolvedParent, filepath.Base(abs)), nil
	}
	return abs, nil
}

func appendRoot(roots []string, root string) []string {
	root = strings.TrimSpace(root)
	if root == "" {
		return roots
	}
	abs, err := filepath.Abs(root)
	if err == nil {
		root = abs
	}
	if resolved, err := filepath.EvalSymlinks(root); err == nil {
		root = resolved
	}
	root = filepath.Clean(root)
	for _, existing := range roots {
		if existing == root {
			return roots
		}
	}
	return append(roots, root)
}

func within(root, path string) bool {
	root = filepath.Clean(root)
	path = filepath.Clean(path)
	if path == root {
		return true
	}
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func IsSensitivePath(path string) bool {
	path = filepath.ToSlash(filepath.Clean(path))
	base := strings.ToLower(filepath.Base(path))
	if base == ".env" || strings.HasPrefix(base, ".env.") || base == ".netrc" || base == ".npmrc" || base == ".pypirc" || base == ".git-credentials" || base == ".yarnrc" || base == ".pnpmrc" || base == "npmrc" || base == "yarnrc" || base == "pnpmrc" {
		return true
	}
	if strings.Contains(path, "/.ssh/") && strings.HasPrefix(base, "id_") {
		return true
	}
	sensitiveDirs := []string{"/.aws/", "/.kube/", "/.docker/", "/.config/gcloud/", "/.azure/", "/.npm/", "/.yarn/", "/.pnpm/"}
	for _, dir := range sensitiveDirs {
		if strings.Contains(path, dir) {
			return true
		}
	}
	if strings.Contains(path, "/.aws/") && base == "credentials" {
		return true
	}
	if strings.Contains(path, "/.kube/") && base == "config" {
		return true
	}
	if strings.Contains(path, "/.docker/") && base == "config.json" {
		return true
	}
	for _, marker := range []string{"secret", "token", "password", "private_key", "access_key", "api_key"} {
		if strings.Contains(base, marker) {
			return true
		}
	}
	return false
}
