package plan

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

type State struct {
	Enabled bool
	Slug    string
	Path    string
	Reason  string
}

type Manager struct {
	mu    sync.RWMutex
	state State
}

var defaultManager = &Manager{}

func Default() *Manager { return defaultManager }

func Enter(slug, path, reason string) State {
	return defaultManager.Enter(slug, path, reason)
}

func Exit() State { return defaultManager.Exit() }

func Status() State { return defaultManager.Status() }

func GuardWrite(path string) error { return defaultManager.GuardWrite(path) }

type DiscoveredPlan struct {
	Slug string
	Path string
}

func Discover(workDir string) ([]DiscoveredPlan, error) {
	if strings.TrimSpace(workDir) == "" {
		var err error
		workDir, err = os.Getwd()
		if err != nil {
			return nil, err
		}
	}
	patterns := []string{
		filepath.Join(workDir, "plans", "*.md"),
		filepath.Join(workDir, ".natalia", "plans", "*.md"),
		filepath.Join(workDir, ".kilo", "plans", "*.md"),
	}
	out := make([]DiscoveredPlan, 0)
	seen := map[string]bool{}
	for _, pattern := range patterns {
		matches, err := filepath.Glob(pattern)
		if err != nil {
			return nil, err
		}
		sort.Strings(matches)
		for _, match := range matches {
			clean := filepath.Clean(match)
			if seen[clean] {
				continue
			}
			seen[clean] = true
			out = append(out, DiscoveredPlan{Slug: slugFromPath(clean), Path: clean})
		}
	}
	return out, nil
}

func FindBySlug(workDir, slug string) (string, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return "", fmt.Errorf("plan slug is required")
	}
	plans, err := Discover(workDir)
	if err != nil {
		return "", err
	}
	var matches []DiscoveredPlan
	for _, item := range plans {
		if item.Slug == slug {
			matches = append(matches, item)
		}
	}
	if len(matches) == 0 {
		return "", fmt.Errorf("plan slug %q not found", slug)
	}
	if len(matches) > 1 {
		paths := make([]string, 0, len(matches))
		for _, item := range matches {
			paths = append(paths, item.Path)
		}
		return "", fmt.Errorf("plan slug %q is ambiguous: %s", slug, strings.Join(paths, ", "))
	}
	return matches[0].Path, nil
}

func (m *Manager) Enter(slug, path, reason string) State {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.state = State{Enabled: true, Slug: strings.TrimSpace(slug), Path: strings.TrimSpace(path), Reason: strings.TrimSpace(reason)}
	if m.state.Slug == "" {
		m.state.Slug = slugFromPath(m.state.Path)
	}
	if m.state.Slug == "" {
		m.state.Slug = "plan"
	}
	return m.state
}

func (m *Manager) Exit() State {
	m.mu.Lock()
	defer m.mu.Unlock()
	prev := m.state
	m.state = State{}
	return prev
}

func (m *Manager) Status() State {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state
}

func (m *Manager) GuardWrite(path string) error {
	state := m.Status()
	if !state.Enabled || IsPlanPath(path) {
		return nil
	}
	return WriteBlockedError{Path: path, State: state}
}

type WriteBlockedError struct {
	Path  string
	State State
}

func (e WriteBlockedError) Error() string {
	return fmt.Sprintf("plan mode blocks writing non-plan file %q", e.Path)
}

func (s State) Lines() []string {
	if !s.Enabled {
		return []string{"plan_mode: disabled"}
	}
	lines := []string{"plan_mode: enabled", fmt.Sprintf("plan_slug: %s", s.Slug)}
	if s.Path != "" {
		lines = append(lines, fmt.Sprintf("plan_path: %s", s.Path))
	}
	if s.Reason != "" {
		lines = append(lines, fmt.Sprintf("reason: %s", s.Reason))
	}
	return lines
}

func IsPlanPath(path string) bool {
	clean := filepath.ToSlash(filepath.Clean(strings.TrimSpace(path)))
	clean = strings.TrimPrefix(clean, "./")
	if clean == "" || clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
		return false
	}
	lower := strings.ToLower(clean)
	return strings.HasPrefix(lower, "plans/") || strings.HasPrefix(lower, ".natalia/plans/") || strings.HasPrefix(lower, ".kilo/plans/") || strings.Contains(lower, "/plans/")
}

func slugFromPath(path string) string {
	base := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	base = strings.ToLower(strings.TrimSpace(base))
	var b strings.Builder
	lastDash := false
	for _, r := range base {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash && b.Len() > 0 {
			b.WriteByte('-')
			lastDash = true
		}
	}
	return strings.Trim(b.String(), "-")
}
