package skill

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type Skill struct {
	Name        string
	Description string
	Dir         string
	Content     string
	Scope       string // "project", "user", "builtin"
}

type Registry struct {
	skills []Skill
}

func (r *Registry) List() []Skill {
	return r.skills
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
	scopes := []string{"project", "user"}
	for _, scope := range scopes {
		has := false
		for _, s := range r.skills {
			if s.Scope == scope {
				if !has {
					if scope == "project" {
						b.WriteString("### 项目技能\n")
					} else {
						b.WriteString("### 用户技能\n")
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

	sort.Slice(r.skills, func(i, j int) bool {
		return r.skills[i].Name < r.skills[j].Name
	})
	return r, nil
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
