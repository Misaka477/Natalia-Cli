package skill

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/Misaka477/Natalia-Cli/internal/config"
)

type Skill struct {
	Name        string
	Description string
	Dir         string
	Content     string
	Scope       string // "project", "user", "builtin"
	Source      string
	Priority    int
}

type Registry struct {
	skills      []Skill
	diagnostics []InstructionDiagnostic
}

type InstructionDiagnostic struct {
	Source string
	Name   string
	Loaded bool
	Reason string
}

type InstructionOptions struct {
	Enabled       bool
	IncludeReadme bool
	IncludeDocs   bool
	ExtraFiles    []string
}

var (
	instructionOptionsMu sync.Mutex
	instructionOptions   = InstructionOptions{Enabled: true}
)

func ConfigureInstructions(cfg *config.Config) {
	instructionOptionsMu.Lock()
	defer instructionOptionsMu.Unlock()
	if cfg == nil {
		instructionOptions = InstructionOptions{Enabled: true}
		return
	}
	instructionOptions = InstructionOptions{Enabled: cfg.InstructionsEnabled(), IncludeReadme: cfg.Instructions.IncludeReadme, IncludeDocs: cfg.Instructions.IncludeDocs, ExtraFiles: append([]string(nil), cfg.Instructions.ExtraFiles...)}
}

func (r *Registry) List() []Skill {
	if r == nil {
		return nil
	}
	return append([]Skill(nil), r.skills...)
}

func (r *Registry) Diagnostics() []InstructionDiagnostic {
	if r == nil {
		return nil
	}
	return append([]InstructionDiagnostic(nil), r.diagnostics...)
}

func (r *Registry) Get(name string) *Skill {
	for _, s := range r.skills {
		if strings.EqualFold(s.Name, name) {
			return &s
		}
	}
	return nil
}

func (r *Registry) Add(s Skill) {
	r.skills = append(r.skills, s)
}

func (r *Registry) FormatForPrompt() string {
	if len(r.skills) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("\n## 可用技能\n\n")
	scopes := []string{"project", "user", "imported"}
	for _, scope := range scopes {
		has := false
		for _, s := range r.skills {
			if s.Scope == scope {
				if !has {
					if scope == "project" {
						b.WriteString("### 项目技能\n")
					} else if scope == "user" {
						b.WriteString("### 用户技能\n")
					} else {
						b.WriteString("### 导入说明\n")
					}
					has = true
				}
				b.WriteString(fmt.Sprintf("- %s: %s\n", s.Name, s.Description))
			}
		}
	}
	b.WriteString("\n使用 skill_read <name> 查看技能详情\n")
	return b.String()
}

func Discover(workDir string) (*Registry, error) {
	r := &Registry{}

	// Project-level skills: .natalia/skills/<name>/SKILL.md
	projectDir := filepath.Join(workDir, ".natalia", "skills")
	if entries, err := os.ReadDir(projectDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			skillDir := filepath.Join(projectDir, e.Name())
			skill, err := loadSkill(skillDir, "project")
			if err == nil {
				r.Add(*skill)
			}
		}
	}

	// User-level skills: ~/.config/natalia-cli/skills/<name>/SKILL.md
	home, _ := os.UserHomeDir()
	userDir := filepath.Join(home, ".config", "natalia-cli", "skills")
	if entries, err := os.ReadDir(userDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			skillDir := filepath.Join(userDir, e.Name())
			skill, err := loadSkill(skillDir, "user")
			if err == nil {
				// Project-level overrides user-level
				if r.Get(skill.Name) == nil {
					r.Add(*skill)
				}
			}
		}
	}

	imports, diagnostics := discoverExternalInstructions(workDir)
	r.diagnostics = append(r.diagnostics, diagnostics...)
	for _, imported := range imports {
		if r.Get(imported.Name) == nil {
			r.Add(imported)
		}
	}

	sort.Slice(r.skills, func(i, j int) bool {
		if r.skills[i].Priority != r.skills[j].Priority {
			return r.skills[i].Priority > r.skills[j].Priority
		}
		return r.skills[i].Name < r.skills[j].Name
	})
	return r, nil
}

func discoverExternalInstructions(workDir string) ([]Skill, []InstructionDiagnostic) {
	opts := currentInstructionOptions()
	if !opts.Enabled {
		return nil, []InstructionDiagnostic{{Source: "external instructions", Loaded: false, Reason: "disabled by config"}}
	}
	candidates := []struct {
		path     string
		name     string
		desc     string
		priority int
	}{
		{path: filepath.Join(workDir, "AGENTS.md"), name: "imported-agents-md", desc: "Imported project instructions from AGENTS.md", priority: 80},
		{path: filepath.Join(workDir, "CLAUDE.md"), name: "imported-claude-md", desc: "Imported project instructions from CLAUDE.md", priority: 70},
		{path: filepath.Join(workDir, ".github", "copilot-instructions.md"), name: "imported-github-copilot-instructions", desc: "Imported project instructions from .github/copilot-instructions.md", priority: 60},
	}
	if opts.IncludeReadme {
		candidates = append(candidates,
			struct {
				path     string
				name     string
				desc     string
				priority int
			}{path: filepath.Join(workDir, "README.md"), name: "imported-readme-md", desc: "Imported explicit project conventions from README.md", priority: 30},
			struct {
				path     string
				name     string
				desc     string
				priority int
			}{path: filepath.Join(workDir, "CONTRIBUTING.md"), name: "imported-contributing-md", desc: "Imported contribution conventions from CONTRIBUTING.md", priority: 40},
		)
	}
	for _, extra := range opts.ExtraFiles {
		pathValue := filepath.Join(workDir, filepath.Clean(extra))
		base := strings.TrimSuffix(filepath.Base(pathValue), filepath.Ext(pathValue))
		candidates = append(candidates, struct {
			path     string
			name     string
			desc     string
			priority int
		}{path: pathValue, name: "imported-extra-" + slugify(base), desc: "Imported configured instruction from " + filepath.ToSlash(extra), priority: 50})
	}
	out := make([]Skill, 0, len(candidates))
	diagnostics := make([]InstructionDiagnostic, 0, len(candidates))
	for _, candidate := range candidates {
		if skill, ok := loadInstructionFile(workDir, candidate.path, candidate.name, candidate.desc, candidate.priority); ok {
			out = append(out, skill)
			diagnostics = append(diagnostics, InstructionDiagnostic{Source: skill.Source, Name: skill.Name, Loaded: true})
		} else {
			diagnostics = append(diagnostics, InstructionDiagnostic{Source: relativeSource(workDir, candidate.path), Name: candidate.name, Loaded: false, Reason: "missing or empty"})
		}
	}
	cursorRules := filepath.Join(workDir, ".cursor", "rules")
	if matches, err := filepath.Glob(filepath.Join(cursorRules, "*.mdc")); err == nil {
		sort.Strings(matches)
		for _, match := range matches {
			base := strings.TrimSuffix(filepath.Base(match), filepath.Ext(match))
			name := "imported-cursor-" + slugify(base)
			desc := "Imported Cursor rule from .cursor/rules/" + filepath.Base(match)
			if skill, ok := loadInstructionFile(workDir, match, name, desc, 55); ok {
				out = append(out, skill)
				diagnostics = append(diagnostics, InstructionDiagnostic{Source: skill.Source, Name: skill.Name, Loaded: true})
			}
		}
	}
	if opts.IncludeDocs {
		if matches, err := filepath.Glob(filepath.Join(workDir, "docs", "*.md")); err == nil {
			sort.Strings(matches)
			for _, match := range matches {
				base := strings.TrimSuffix(filepath.Base(match), filepath.Ext(match))
				name := "imported-docs-" + slugify(base)
				desc := "Imported documentation conventions from docs/" + filepath.Base(match)
				if skill, ok := loadInstructionFile(workDir, match, name, desc, 25); ok {
					out = append(out, skill)
					diagnostics = append(diagnostics, InstructionDiagnostic{Source: skill.Source, Name: skill.Name, Loaded: true})
				}
			}
		}
	}
	return out, diagnostics
}

func loadInstructionFile(workDir, pathValue, name, description string, priority int) (Skill, bool) {
	data, err := os.ReadFile(pathValue)
	if err != nil || len(strings.TrimSpace(string(data))) == 0 {
		return Skill{}, false
	}
	source := relativeSource(workDir, pathValue)
	return Skill{Name: name, Description: description, Dir: filepath.Dir(pathValue), Content: fmt.Sprintf("Source: %s\n\n%s", source, strings.TrimSpace(string(data))), Scope: "imported", Source: source, Priority: priority}, true
}

func currentInstructionOptions() InstructionOptions {
	instructionOptionsMu.Lock()
	defer instructionOptionsMu.Unlock()
	return InstructionOptions{Enabled: instructionOptions.Enabled, IncludeReadme: instructionOptions.IncludeReadme, IncludeDocs: instructionOptions.IncludeDocs, ExtraFiles: append([]string(nil), instructionOptions.ExtraFiles...)}
}

func relativeSource(workDir, pathValue string) string {
	if rel, err := filepath.Rel(workDir, pathValue); err == nil && !strings.HasPrefix(rel, "..") {
		return filepath.ToSlash(rel)
	}
	return filepath.ToSlash(pathValue)
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var b strings.Builder
	lastDash := false
	for _, r := range value {
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
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "item"
	}
	return out
}

func loadSkill(dir string, scope string) (*Skill, error) {
	mdPath := filepath.Join(dir, "SKILL.md")
	data, err := os.ReadFile(mdPath)
	if err != nil {
		return nil, err
	}
	content := string(data)

	name := filepath.Base(dir)
	description := name

	// Parse YAML frontmatter: ---\nname: ...\ndescription: ...\n---
	lines := strings.SplitN(content, "---", 3)
	if len(lines) >= 3 {
		frontmatter := strings.TrimSpace(lines[1])
		for _, line := range strings.Split(frontmatter, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "name:") {
				name = strings.TrimSpace(strings.TrimPrefix(line, "name:"))
			}
			if strings.HasPrefix(line, "description:") {
				description = strings.TrimSpace(strings.TrimPrefix(line, "description:"))
			}
		}
		content = strings.TrimSpace(lines[2])
	}

	return &Skill{
		Name:        name,
		Description: description,
		Dir:         dir,
		Content:     content,
		Scope:       scope,
	}, nil
}
