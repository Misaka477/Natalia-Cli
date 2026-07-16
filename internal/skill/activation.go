package skill

import (
	"io/fs"
	"path/filepath"
	"sort"
	"strings"
)

type Activation struct {
	entry     *Entry
	body      string
	resources []string
	active    bool
}

func (r *SkillRegistry) Activate(qn string) (*Activation, error) {
	entry, err := r.Resolve(qn)
	if err != nil {
		return nil, err
	}
	a := &Activation{
		entry:  entry,
		body:   entry.Body,
		active: true,
	}
	if a.body == "" && entry.FS != nil && entry.Root != "" {
		data, err := fs.ReadFile(entry.FS, filepath.Join(entry.Root, "SKILL.md"))
		if err == nil {
			_, body, _ := ParseSKILLReader(strings.NewReader(string(data)))
			if body != "" {
				a.body = body
			}
		}
	}
	return a, nil
}

func (a *Activation) Body() string {
	return a.body
}

func (a *Activation) Resources() []string {
	if a.resources != nil {
		return a.resources
	}
	if a.entry == nil || a.entry.FS == nil || a.entry.Root == "" {
		return nil
	}
	a.resources = a.discoverResources()
	return a.resources
}

func (a *Activation) IsActive() bool {
	return a.active
}

func (a *Activation) Deactivate() {
	a.active = false
}

func (a *Activation) discoverResources() []string {
	var resources []string
	entries, err := fs.ReadDir(a.entry.FS, a.entry.Root)
	if err != nil {
		return nil
	}
	for _, e := range entries {
		name := e.Name()
		if strings.EqualFold(name, "SKILL.md") {
			continue
		}
		if e.IsDir() {
			resources = append(resources, filepath.Join(a.entry.Root, name)+"/")
		} else {
			resources = append(resources, filepath.Join(a.entry.Root, name))
		}
	}
	sort.Strings(resources)
	return resources
}
