package skill

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"

	"github.com/Misaka477/Natalia-Cli/internal/skill/builtin"
)

type DiscoveryResult struct {
	QualifiedName string
	Name          string
	Description   string
	License       string
	Compatibility map[string]string
	Root          string
	RelativePath  string
	FS            fs.FS
	AllowedTools  []string
}

func DefaultSearchRoots(homeDir, workingDir string) []string {
	var roots []string
	for _, dir := range []string{".agents", ".natalia", ".claude"} {
		roots = append(roots, filepath.Join(homeDir, dir, "skills"))
	}
	for _, dir := range []string{".agents", ".natalia", ".claude"} {
		roots = append(roots, filepath.Join(workingDir, dir, "skills"))
	}
	return roots
}

func DiscoverRoots(searchRoots []string, budget int) ([]*DiscoveryResult, error) {
	var results []*DiscoveryResult
	seen := make(map[string]bool)

	for i, root := range searchRoots {
		if len(results) >= budget {
			break
		}
		scope := scopeForSearchIndex(i)
		results = append(results, discoverFromOS(root, scope, seen, budget-len(results))...)
	}

	if len(results) < budget {
		results = append(results, discoverFromEmbedded(seen, budget-len(results))...)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].QualifiedName < results[j].QualifiedName
	})

	return results, nil
}

func scopeForSearchIndex(i int) string {
	if i < 3 {
		return "user"
	}
	return "project"
}

func discoverFromOS(root, scope string, seen map[string]bool, budget int) []*DiscoveryResult {
	var results []*DiscoveryResult
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	for _, entry := range entries {
		if len(results) >= budget {
			break
		}
		if !entry.IsDir() {
			continue
		}
		skillDir := entry.Name()
		skillMDPath := filepath.Join(root, skillDir, "SKILL.md")
		fm, _, err := ParseSKILL(skillMDPath)
		if err != nil {
			continue
		}
		if seen[fm.Name] {
			continue
		}
		seen[fm.Name] = true
		compat := fm.Compatibility
		if compat == nil {
			compat = make(map[string]string)
		}
		results = append(results, &DiscoveryResult{
			QualifiedName: FullQN(scope, fm.Name),
			Name:          fm.Name,
			Description:   fm.Description,
			License:       fm.License,
			Compatibility: compat,
			Root:          root,
			RelativePath:  skillDir,
			FS:            os.DirFS(root),
			AllowedTools:  fm.AllowedTools,
		})
	}
	return results
}

func discoverFromEmbedded(seen map[string]bool, budget int) []*DiscoveryResult {
	var results []*DiscoveryResult
	entries, err := fs.ReadDir(builtin.Skills, "skills")
	if err != nil {
		return nil
	}
	for _, entry := range entries {
		if len(results) >= budget {
			break
		}
		if !entry.IsDir() {
			continue
		}
		skillDir := entry.Name()
		f, err := builtin.Skills.Open(filepath.Join("skills", skillDir, "SKILL.md"))
		if err != nil {
			continue
		}
		fm, _, err := ParseSKILLReader(f)
		f.Close()
		if err != nil {
			continue
		}
		if seen[fm.Name] {
			continue
		}
		seen[fm.Name] = true
		compat := fm.Compatibility
		if compat == nil {
			compat = make(map[string]string)
		}
		results = append(results, &DiscoveryResult{
			QualifiedName: FullQN("bundled", fm.Name),
			Name:          fm.Name,
			Description:   fm.Description,
			License:       fm.License,
			Compatibility: compat,
			Root:          filepath.Join("skills", skillDir),
			RelativePath:  skillDir,
			FS:            builtin.Skills,
			AllowedTools:  fm.AllowedTools,
		})
	}
	return results
}
