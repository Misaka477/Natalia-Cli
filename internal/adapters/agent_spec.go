package adapters

import (
	"fmt"

	"github.com/Misaka477/Natalia-Cli/internal/agentspec"
	"gopkg.in/yaml.v3"
)

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
