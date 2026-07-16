package skill

import (
	"regexp"
	"strings"
)

type ValidationResult struct {
	Valid    bool
	Warnings []string
	Errors   []string
}

var versionRangePattern = regexp.MustCompile(`^(>=|<=|>|<|!=|\^|~)?\s*\d+(\.(\d+|[xX*]))*$`)

func Validate(fm *SkillFrontmatter) *ValidationResult {
	result := &ValidationResult{Valid: true}

	if fm.Name == "" {
		result.Errors = append(result.Errors, "name is required")
	}
	if fm.Description == "" {
		result.Errors = append(result.Errors, "description is required")
	}
	if fm.License != "" {
		if !KnownLicenses[fm.License] {
			result.Warnings = append(result.Warnings, "unusual license: "+fm.License)
		}
	}

	for k, v := range fm.Compatibility {
		if k == "" {
			result.Warnings = append(result.Warnings, "compatibility key is empty")
			continue
		}
		if v != "" && !isValidVersionRange(v) {
			result.Warnings = append(result.Warnings, "invalid version range for "+k+": "+v)
		}
	}

	if len(result.Errors) > 0 {
		result.Valid = false
	}
	return result
}

func isValidVersionRange(v string) bool {
	v = strings.TrimSpace(v)
	if v == "" {
		return false
	}
	if v == "*" {
		return true
	}

	parts := splitVersionParts(v)
	for _, p := range parts {
		if !versionRangePattern.MatchString(p) {
			return false
		}
	}
	return len(parts) > 0
}

func splitVersionParts(v string) []string {
	var parts []string
	for _, part := range strings.Fields(v) {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		parts = append(parts, trimmed)
	}
	return parts
}
