package adapters

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/Misaka477/Natalia-Cli/internal/agentspec"
	"gopkg.in/yaml.v3"
)

type AgentSpecDiagnostic struct {
	Source string
	Format string
	Name   string
	Notes  []string
}

type AgentSpecImport struct {
	Spec       *agentspec.ResolvedAgentSpec
	Diagnostic AgentSpecDiagnostic
}

type genericAgentSpec struct {
	Name             string                            `yaml:"name"`
	SystemPromptPath string                            `yaml:"system_prompt_path"`
	ModelProfile     string                            `yaml:"model_profile"`
	WhenToUse        string                            `yaml:"when_to_use"`
	Tools            []string                          `yaml:"tools"`
	AllowedTools     []string                          `yaml:"allowed_tools"`
	ExcludeTools     []string                          `yaml:"exclude_tools"`
	Modes            map[string]agentspec.ModeSpec     `yaml:"modes"`
	Subagents        map[string]agentspec.SubagentSpec `yaml:"subagents"`
}

func ImportGenericAgentSpecYAML(data []byte) (*agentspec.ResolvedAgentSpec, error) {
	var raw genericAgentSpec
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse external agent spec: %w", err)
	}
	if raw.Name == "" {
		return nil, fmt.Errorf("external agent spec name is required")
	}
	return &agentspec.ResolvedAgentSpec{Name: raw.Name, SystemPromptPath: raw.SystemPromptPath, SystemPromptArgs: map[string]string{}, ModelProfile: raw.ModelProfile, WhenToUse: raw.WhenToUse, Tools: append([]string(nil), raw.Tools...), AllowedTools: append([]string(nil), raw.AllowedTools...), ExcludeTools: append([]string(nil), raw.ExcludeTools...), Subagents: copySubagents(raw.Subagents), Modes: copyModes(raw.Modes)}, nil
}

func ImportKimiAgentSpecYAML(source string, data []byte) (*AgentSpecImport, error) {
	var raw struct {
		Version int `yaml:"version"`
		Agent   struct {
			Name             string                            `yaml:"name"`
			SystemPromptPath string                            `yaml:"system_prompt_path"`
			ModelProfile     string                            `yaml:"model_profile"`
			WhenToUse        string                            `yaml:"when_to_use"`
			Tools            []string                          `yaml:"tools"`
			AllowedTools     []string                          `yaml:"allowed_tools"`
			ExcludeTools     []string                          `yaml:"exclude_tools"`
			Modes            map[string]agentspec.ModeSpec     `yaml:"modes"`
			Subagents        map[string]agentspec.SubagentSpec `yaml:"subagents"`
		} `yaml:"agent"`
	}
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse Kimi agent spec: %w", err)
	}
	name := strings.TrimSpace(raw.Agent.Name)
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(source), filepath.Ext(source))
	}
	if name == "" {
		return nil, fmt.Errorf("Kimi agent spec name is required")
	}
	notes := []string{"best-effort Kimi YAML import; runtime-specific behavior is not imported"}
	if raw.Version != 0 && raw.Version != 1 {
		notes = append(notes, fmt.Sprintf("unsupported version %d imported best-effort", raw.Version))
	}
	spec := &agentspec.ResolvedAgentSpec{Name: name, SystemPromptPath: raw.Agent.SystemPromptPath, SystemPromptArgs: map[string]string{}, ModelProfile: raw.Agent.ModelProfile, WhenToUse: raw.Agent.WhenToUse, Tools: append([]string(nil), raw.Agent.Tools...), AllowedTools: append([]string(nil), raw.Agent.AllowedTools...), ExcludeTools: append([]string(nil), raw.Agent.ExcludeTools...), Subagents: copySubagents(raw.Agent.Subagents), Modes: copyModes(raw.Agent.Modes)}
	return &AgentSpecImport{Spec: spec, Diagnostic: AgentSpecDiagnostic{Source: source, Format: "kimi", Name: name, Notes: notes}}, nil
}

func ImportKiloAgentMarkdown(source string, data []byte) (*AgentSpecImport, error) {
	body, meta := splitMarkdownFrontmatter(string(data))
	name := strings.TrimSpace(meta["name"])
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(source), filepath.Ext(source))
	}
	if name == "" {
		return nil, fmt.Errorf("Kilo agent name is required")
	}
	description := strings.TrimSpace(meta["description"])
	tools := splitCSV(meta["tools"])
	if len(tools) == 0 {
		tools = splitCSV(meta["allowed_tools"])
	}
	spec := &agentspec.ResolvedAgentSpec{Name: name, SystemPromptArgs: map[string]string{"INLINE_PROMPT": strings.TrimSpace(body)}, WhenToUse: description, Tools: tools, AllowedTools: tools, Subagents: map[string]agentspec.SubagentSpec{}, Modes: map[string]agentspec.ModeSpec{}}
	notes := []string{"best-effort Kilo markdown import; command/action runtime semantics are not imported"}
	return &AgentSpecImport{Spec: spec, Diagnostic: AgentSpecDiagnostic{Source: source, Format: "kilo", Name: name, Notes: notes}}, nil
}

func splitMarkdownFrontmatter(content string) (string, map[string]string) {
	meta := map[string]string{}
	content = strings.TrimPrefix(content, "\ufeff")
	if !strings.HasPrefix(content, "---") {
		return content, meta
	}
	parts := strings.SplitN(content, "---", 3)
	if len(parts) < 3 {
		return content, meta
	}
	for _, line := range strings.Split(parts[1], "\n") {
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		meta[strings.TrimSpace(strings.ToLower(key))] = strings.Trim(strings.TrimSpace(value), `"'`)
	}
	return strings.TrimSpace(parts[2]), meta
}

func splitCSV(value string) []string {
	fields := strings.FieldsFunc(value, func(r rune) bool { return r == ',' || r == ' ' || r == '\t' || r == '\n' })
	out := make([]string, 0, len(fields))
	for _, field := range fields {
		field = strings.TrimSpace(strings.Trim(field, `[]"'`))
		if field != "" {
			out = append(out, field)
		}
	}
	return out
}

func copySubagents(in map[string]agentspec.SubagentSpec) map[string]agentspec.SubagentSpec {
	out := make(map[string]agentspec.SubagentSpec, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func copyModes(in map[string]agentspec.ModeSpec) map[string]agentspec.ModeSpec {
	out := make(map[string]agentspec.ModeSpec, len(in))
	for k, v := range in {
		v.Tools.Allowed = append([]string(nil), v.Tools.Allowed...)
		v.Tools.Exclude = append([]string(nil), v.Tools.Exclude...)
		out[k] = v
	}
	return out
}
