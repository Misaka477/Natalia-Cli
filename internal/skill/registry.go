package skill

import (
	"fmt"
	"io/fs"
	"strings"
)

type SkillRegistry struct {
	skills   map[string]*Entry
	disabled map[string]bool
}

type Entry struct {
	QualifiedName string
	Metadata      *SkillFrontmatter
	Body          string
	Resources     []string
	Root          string
	FS            fs.FS
}

func NewSkillRegistry() *SkillRegistry {
	return &SkillRegistry{
		skills:   make(map[string]*Entry),
		disabled: make(map[string]bool),
	}
}

func (r *SkillRegistry) Register(path string, fm *SkillFrontmatter, body string, root string, ffs fs.FS, scope string) (*Entry, error) {
	qn := FullQN(scope, fm.Name)
	if _, exists := r.skills[qn]; exists {
		return nil, fmt.Errorf("skill %q already registered", qn)
	}
	entry := &Entry{
		QualifiedName: qn,
		Metadata:      fm,
		Body:          body,
		Root:          root,
		FS:            ffs,
	}
	r.skills[qn] = entry
	_ = path
	return entry, nil
}

func (r *SkillRegistry) Resolve(qn string) (*Entry, error) {
	entry, exists := r.skills[qn]
	if !exists {
		return nil, fmt.Errorf("skill %q not found", qn)
	}
	return entry, nil
}

func (r *SkillRegistry) List() []*Entry {
	entries := make([]*Entry, 0, len(r.skills))
	for _, e := range r.skills {
		entries = append(entries, e)
	}
	return entries
}

func (r *SkillRegistry) HasAllowedTool(toolName string) bool {
	for _, entry := range r.skills {
		if entry.Metadata != nil {
			for _, t := range entry.Metadata.AllowedTools {
				if strings.EqualFold(t, toolName) {
					return true
				}
			}
		}
	}
	return false
}

func (r *SkillRegistry) IsDisabled(qn string) bool {
	return r.disabled[qn]
}

func (r *SkillRegistry) SetDisabled(qn string, disabled bool) {
	if disabled {
		r.disabled[qn] = true
	} else {
		delete(r.disabled, qn)
	}
}

func FullQN(scope, name string) string {
	return scope + ":" + name
}
