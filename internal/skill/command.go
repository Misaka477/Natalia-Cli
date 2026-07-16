package skill

import (
	"fmt"
	"sort"
	"strings"
)

func ListSkills(registry *SkillRegistry) string {
	if registry == nil {
		return "no skills registered"
	}
	entries := registry.List()
	if len(entries) == 0 {
		return "no skills registered"
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].QualifiedName < entries[j].QualifiedName
	})
	var b strings.Builder
	b.WriteString("Registered Skills:\n")
	for _, e := range entries {
		status := ""
		if registry.IsDisabled(e.QualifiedName) {
			status = " [disabled]"
		}
		desc := e.Metadata.Description
		if desc == "" {
			desc = "(no description)"
		}
		b.WriteString(fmt.Sprintf("  %s%s - %s\n", e.QualifiedName, status, desc))
	}
	return b.String()
}

func ShowSkill(entry *Entry) string {
	if entry == nil {
		return "skill not found"
	}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("Qualified Name: %s\n", entry.QualifiedName))
	b.WriteString(fmt.Sprintf("Name:           %s\n", entry.Metadata.Name))
	b.WriteString(fmt.Sprintf("Description:    %s\n", entry.Metadata.Description))
	if entry.Metadata.License != "" {
		b.WriteString(fmt.Sprintf("License:        %s\n", entry.Metadata.License))
	}
	if len(entry.Metadata.AllowedTools) > 0 {
		b.WriteString(fmt.Sprintf("Allowed Tools:  %s\n", strings.Join(entry.Metadata.AllowedTools, ", ")))
	}
	if entry.Metadata.Invocation != nil {
		inv := entry.Metadata.Invocation
		b.WriteString(fmt.Sprintf("Invocation:     type=%s", inv.Type))
		if inv.Macro != "" {
			b.WriteString(fmt.Sprintf(", macro=%s", inv.Macro))
		}
		if inv.Prompt != "" {
			b.WriteString(fmt.Sprintf(", prompt=%s", preview(inv.Prompt, 60)))
		}
		b.WriteString("\n")
	}
	b.WriteString(fmt.Sprintf("Body Preview:   %s\n", preview(entry.Body, 120)))

	if len(entry.Resources) > 0 {
		b.WriteString(fmt.Sprintf("Resources:      %s\n", strings.Join(entry.Resources, ", ")))
	}

	var compatKeys []string
	for k, v := range entry.Metadata.Compatibility {
		compatKeys = append(compatKeys, fmt.Sprintf("%s: %s", k, v))
	}
	if len(compatKeys) > 0 {
		sort.Strings(compatKeys)
		b.WriteString(fmt.Sprintf("Compatibility:  %s\n", strings.Join(compatKeys, "; ")))
	}

	return b.String()
}

func ValidateSkills(registry *SkillRegistry) []string {
	if registry == nil {
		return []string{"no skills registered"}
	}
	entries := registry.List()
	if len(entries) == 0 {
		return []string{"no skills registered"}
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].QualifiedName < entries[j].QualifiedName
	})
	var results []string
	for _, entry := range entries {
		vr := Validate(entry.Metadata)
		if vr.Valid && len(vr.Warnings) == 0 {
			results = append(results, fmt.Sprintf("%s: OK", entry.QualifiedName))
			continue
		}
		if !vr.Valid {
			for _, e := range vr.Errors {
				results = append(results, fmt.Sprintf("%s: ERROR: %s", entry.QualifiedName, e))
			}
		}
		for _, w := range vr.Warnings {
			results = append(results, fmt.Sprintf("%s: WARNING: %s", entry.QualifiedName, w))
		}
	}
	return results
}

func EnableSkill(registry *SkillRegistry, qn string) (*Activation, error) {
	if registry == nil {
		return nil, fmt.Errorf("registry is nil")
	}
	if registry.IsDisabled(qn) {
		registry.SetDisabled(qn, false)
	}
	return registry.Activate(qn)
}

func DisableSkill(registry *SkillRegistry, qn string) error {
	if registry == nil {
		return fmt.Errorf("registry is nil")
	}
	_, err := registry.Resolve(qn)
	if err != nil {
		return err
	}
	registry.SetDisabled(qn, true)
	return nil
}

func ReloadSkills(searchRoots []string, budget int) (*SkillRegistry, error) {
	results, err := DiscoverRoots(searchRoots, budget)
	if err != nil {
		return nil, fmt.Errorf("discovering skills: %w", err)
	}

	reg := NewSkillRegistry()
	for _, dr := range results {
		fm := &SkillFrontmatter{
			Name:          dr.Name,
			Description:   dr.Description,
			License:       dr.License,
			Compatibility: dr.Compatibility,
			AllowedTools:  dr.AllowedTools,
		}
		scope := scopeFromQN(dr.QualifiedName)
		reg.Register(dr.RelativePath, fm, "", dr.RelativePath, dr.FS, scope)
	}

	return reg, nil
}

func InvokeSkill(act *Activation, args []string) (string, error) {
	if act == nil {
		return "", fmt.Errorf("activation is nil")
	}
	if !act.IsActive() {
		return "", fmt.Errorf("skill is not active")
	}
	if act.entry == nil || act.entry.Metadata == nil {
		return "", fmt.Errorf("activation has no associated skill entry")
	}
	inv := act.entry.Metadata.Invocation
	if inv == nil {
		return "", fmt.Errorf("skill has no invocation defined")
	}
	switch inv.Type {
	case "macro":
		cmd := inv.Macro
		if len(args) > 0 {
			cmd = cmd + " " + strings.Join(args, " ")
		}
		return cmd, nil
	case "prompt":
		p := inv.Prompt
		if len(args) > 0 {
			p = p + "\n\n" + strings.Join(args, " ")
		}
		return p, nil
	default:
		return "", fmt.Errorf("unknown invocation type: %s", inv.Type)
	}
}

func scopeFromQN(qn string) string {
	idx := strings.Index(qn, ":")
	if idx < 0 {
		return "project"
	}
	return qn[:idx]
}

func preview(s string, maxLen int) string {
	trimmed := strings.TrimSpace(s)
	if len(trimmed) <= maxLen {
		return trimmed
	}
	return trimmed[:maxLen] + "..."
}
