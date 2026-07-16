package skill

import (
	"fmt"
	"io"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

const frontmatterDelim = "---"

var KnownLicenses = map[string]bool{
	"MIT":          true,
	"Apache-2.0":   true,
	"GPL-2.0":      true,
	"GPL-3.0":      true,
	"LGPL-2.1":     true,
	"LGPL-3.0":     true,
	"BSD-2-Clause": true,
	"BSD-3-Clause": true,
	"MPL-2.0":      true,
	"AGPL-3.0":     true,
	"Unlicense":    true,
	"CC0-1.0":      true,
	"MIT-0":        true,
	"BSL-1.0":      true,
	"ISC":          true,
	"Zlib":         true,
}

func ParseSKILL(path string) (*SkillFrontmatter, string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, "", fmt.Errorf("reading SKILL.md: %w", err)
	}
	return ParseSKILLReader(strings.NewReader(string(data)))
}

func ParseSKILLReader(r io.Reader) (*SkillFrontmatter, string, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, "", fmt.Errorf("reading skill content: %w", err)
	}

	content := string(data)
	fm, body, err := splitFrontmatter(content)
	if err != nil {
		return nil, "", err
	}

	var skill SkillFrontmatter
	if err := yaml.Unmarshal([]byte(fm), &skill); err != nil {
		return nil, "", fmt.Errorf("parsing frontmatter YAML: %w", err)
	}

	if skill.Name == "" {
		return nil, "", fmt.Errorf("skill name is required")
	}
	if skill.Description == "" {
		return nil, "", fmt.Errorf("skill description is required")
	}

	return &skill, body, nil
}

func splitFrontmatter(content string) (frontmatter, body string, err error) {
	content = strings.TrimSpace(content)
	if !strings.HasPrefix(content, frontmatterDelim) {
		return "", content, nil
	}

	rest := content[len(frontmatterDelim):]

	idx := strings.Index(rest, "\n"+frontmatterDelim)
	if idx < 0 {
		return "", "", fmt.Errorf("incomplete frontmatter: no closing ---")
	}

	frontmatter = strings.TrimSpace(rest[:idx])
	body = strings.TrimSpace(rest[idx+len("\n"+frontmatterDelim):])
	return frontmatter, body, nil
}
