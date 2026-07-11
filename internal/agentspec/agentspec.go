package agentspec

import (
	"bytes"
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"text/template"
	"time"

	"gopkg.in/yaml.v3"
)

//go:embed agents/default/agent.yaml agents/default/system.md
var defaultAgentFS embed.FS

const (
	SupportedVersion = 1
	defaultSpecPath  = "agents/default/agent.yaml"
	embedPrefix      = "embed://"
)

type File struct {
	Version int      `yaml:"version"`
	Agent   rawAgent `yaml:"agent"`
}

type rawAgent struct {
	Extend           string                   `yaml:"extend,omitempty"`
	Name             *string                  `yaml:"name,omitempty"`
	SystemPromptPath *string                  `yaml:"system_prompt_path,omitempty"`
	SystemPromptArgs map[string]string        `yaml:"system_prompt_args,omitempty"`
	Model            *string                  `yaml:"model,omitempty"`
	ModelProfile     *string                  `yaml:"model_profile,omitempty"`
	WhenToUse        *string                  `yaml:"when_to_use,omitempty"`
	Tools            *[]string                `yaml:"tools,omitempty"`
	AllowedTools     *[]string                `yaml:"allowed_tools,omitempty"`
	ExcludeTools     *[]string                `yaml:"exclude_tools,omitempty"`
	Subagents        *map[string]SubagentSpec `yaml:"subagents,omitempty"`
	Modes            *map[string]ModeSpec     `yaml:"modes,omitempty"`
}

type SubagentSpec struct {
	Path        string `yaml:"path"`
	Description string `yaml:"description"`
}

type ModeSpec struct {
	Extends           string     `yaml:"extends,omitempty"`
	Description       string     `yaml:"description,omitempty"`
	ModelProfile      string     `yaml:"model_profile,omitempty"`
	PermissionProfile string     `yaml:"permission_profile,omitempty"`
	SystemPrompt      string     `yaml:"system_prompt,omitempty"`
	SystemPromptPath  string     `yaml:"system_prompt_path,omitempty"`
	ReasoningEffort   string     `yaml:"reasoning_effort,omitempty"`
	ThinkingEnabled   *bool      `yaml:"thinking_enabled,omitempty"`
	PlanMode          *bool      `yaml:"plan_mode,omitempty"`
	Tools             ToolPolicy `yaml:"tools,omitempty"`
}

type ToolPolicy struct {
	Allowed []string `yaml:"allowed,omitempty"`
	Exclude []string `yaml:"exclude,omitempty"`
}

type ResolvedAgentSpec struct {
	Name             string
	SystemPromptPath string
	SystemPromptArgs map[string]string
	Model            string
	ModelProfile     string
	WhenToUse        string
	Tools            []string
	AllowedTools     []string
	ExcludeTools     []string
	Subagents        map[string]SubagentSpec
	Modes            map[string]ModeSpec
}

type TemplateArgs struct {
	WorkDir string
	Now     string
	Shell   string
}

func DefaultTemplateArgs() TemplateArgs {
	wd, _ := os.Getwd()
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}
	return TemplateArgs{
		WorkDir: wd,
		Now:     time.Now().Format(time.RFC3339),
		Shell:   shell,
	}
}

func LoadDefaultAgentSpec() (*ResolvedAgentSpec, error) {
	return loadAgentSpec("default", map[string]bool{})
}

func LoadAgentSpec(path string) (*ResolvedAgentSpec, error) {
	return loadAgentSpec(path, map[string]bool{})
}

func (s *ResolvedAgentSpec) RenderSystemPrompt(args TemplateArgs) (string, error) {
	raw, err := readPrompt(s.SystemPromptPath)
	if err != nil {
		return "", err
	}
	data := map[string]string{
		"WorkDir": args.WorkDir,
		"Now":     args.Now,
		"Shell":   args.Shell,
	}
	for k, v := range s.SystemPromptArgs {
		data[k] = v
	}
	tmpl, err := template.New(filepath.Base(s.SystemPromptPath)).Parse(string(raw))
	if err != nil {
		return "", fmt.Errorf("parse system prompt template: %w", err)
	}
	var out bytes.Buffer
	if err := tmpl.Execute(&out, data); err != nil {
		return "", fmt.Errorf("render system prompt: %w", err)
	}
	return out.String(), nil
}

func loadAgentSpec(path string, seen map[string]bool) (*ResolvedAgentSpec, error) {
	raw, baseDir, key, err := readSpec(path)
	if err != nil {
		return nil, err
	}
	if seen[key] {
		return nil, fmt.Errorf("agent spec extend cycle at %s", path)
	}
	seen[key] = true
	defer delete(seen, key)

	if raw.Extend != "" {
		basePath := raw.Extend
		if basePath != "default" && !filepath.IsAbs(basePath) && !strings.HasPrefix(baseDir, embedPrefix) {
			basePath = filepath.Join(baseDir, basePath)
		}
		base, err := loadAgentSpec(basePath, seen)
		if err != nil {
			return nil, err
		}
		return overlay(base, raw)
	}
	return resolve(raw)
}

func readSpec(path string) (rawAgent, string, string, error) {
	var data []byte
	var baseDir string
	var key string
	var err error
	if path == "default" {
		data, err = defaultAgentFS.ReadFile(defaultSpecPath)
		baseDir = embedPrefix + filepath.Dir(defaultSpecPath)
		key = "default"
	} else {
		abs, absErr := filepath.Abs(path)
		if absErr != nil {
			return rawAgent{}, "", "", absErr
		}
		data, err = os.ReadFile(abs)
		baseDir = filepath.Dir(abs)
		key = abs
	}
	if err != nil {
		return rawAgent{}, "", "", fmt.Errorf("read agent spec %s: %w", path, err)
	}
	var f File
	if err := yaml.Unmarshal(data, &f); err != nil {
		return rawAgent{}, "", "", fmt.Errorf("parse agent spec %s: %w", path, err)
	}
	if f.Version != SupportedVersion {
		return rawAgent{}, "", "", fmt.Errorf("unsupported agent spec version %d", f.Version)
	}
	return resolvePaths(f.Agent, baseDir), baseDir, key, nil
}

func resolvePaths(agent rawAgent, baseDir string) rawAgent {
	if agent.SystemPromptPath != nil {
		p := *agent.SystemPromptPath
		if !filepath.IsAbs(p) {
			p = joinSpecPath(baseDir, p)
		}
		agent.SystemPromptPath = &p
	}
	if agent.Subagents != nil {
		resolved := make(map[string]SubagentSpec, len(*agent.Subagents))
		for name, sub := range *agent.Subagents {
			if sub.Path != "" && !filepath.IsAbs(sub.Path) {
				sub.Path = joinSpecPath(baseDir, sub.Path)
			}
			resolved[name] = sub
		}
		agent.Subagents = &resolved
	}
	if agent.Modes != nil {
		resolved := make(map[string]ModeSpec, len(*agent.Modes))
		for name, mode := range *agent.Modes {
			if mode.SystemPromptPath != "" && !filepath.IsAbs(mode.SystemPromptPath) {
				mode.SystemPromptPath = joinSpecPath(baseDir, mode.SystemPromptPath)
			}
			resolved[name] = mode
		}
		agent.Modes = &resolved
	}
	return agent
}

func joinSpecPath(baseDir, p string) string {
	if strings.HasPrefix(baseDir, embedPrefix) {
		return embedPrefix + filepath.ToSlash(filepath.Join(strings.TrimPrefix(baseDir, embedPrefix), p))
	}
	return filepath.Join(baseDir, p)
}

func overlay(base *ResolvedAgentSpec, child rawAgent) (*ResolvedAgentSpec, error) {
	merged := cloneResolved(base)
	if child.Name != nil {
		merged.Name = *child.Name
	}
	if child.SystemPromptPath != nil {
		merged.SystemPromptPath = *child.SystemPromptPath
	}
	if child.SystemPromptArgs != nil {
		if merged.SystemPromptArgs == nil {
			merged.SystemPromptArgs = make(map[string]string)
		}
		for k, v := range child.SystemPromptArgs {
			merged.SystemPromptArgs[k] = v
		}
	}
	if child.Model != nil {
		merged.Model = *child.Model
	}
	if child.ModelProfile != nil {
		merged.ModelProfile = *child.ModelProfile
	}
	if child.WhenToUse != nil {
		merged.WhenToUse = *child.WhenToUse
	}
	if child.Tools != nil {
		merged.Tools = append([]string(nil), (*child.Tools)...)
	}
	if child.AllowedTools != nil {
		merged.AllowedTools = append([]string(nil), (*child.AllowedTools)...)
	}
	if child.ExcludeTools != nil {
		merged.ExcludeTools = append([]string(nil), (*child.ExcludeTools)...)
	}
	if child.Subagents != nil {
		merged.Subagents = copySubagents(*child.Subagents)
	}
	if child.Modes != nil {
		merged.Modes = mergeModes(merged.Modes, *child.Modes)
	}
	if err := validateResolved(merged); err != nil {
		return nil, err
	}
	return merged, nil
}

func resolve(agent rawAgent) (*ResolvedAgentSpec, error) {
	if agent.Name == nil {
		return nil, fmt.Errorf("agent.name is required")
	}
	if agent.SystemPromptPath == nil {
		return nil, fmt.Errorf("agent.system_prompt_path is required")
	}
	if agent.Tools == nil {
		return nil, fmt.Errorf("agent.tools is required")
	}
	resolved := &ResolvedAgentSpec{
		Name:             *agent.Name,
		SystemPromptPath: *agent.SystemPromptPath,
		SystemPromptArgs: map[string]string{},
		Tools:            append([]string(nil), (*agent.Tools)...),
		Subagents:        map[string]SubagentSpec{},
	}
	for k, v := range agent.SystemPromptArgs {
		resolved.SystemPromptArgs[k] = v
	}
	if agent.Model != nil {
		resolved.Model = *agent.Model
	}
	if agent.ModelProfile != nil {
		resolved.ModelProfile = *agent.ModelProfile
	}
	if agent.WhenToUse != nil {
		resolved.WhenToUse = *agent.WhenToUse
	}
	if agent.AllowedTools != nil {
		resolved.AllowedTools = append([]string(nil), (*agent.AllowedTools)...)
	}
	if agent.ExcludeTools != nil {
		resolved.ExcludeTools = append([]string(nil), (*agent.ExcludeTools)...)
	}
	if agent.Subagents != nil {
		resolved.Subagents = copySubagents(*agent.Subagents)
	}
	if agent.Modes != nil {
		resolved.Modes = copyModes(*agent.Modes)
	}
	if err := validateResolved(resolved); err != nil {
		return nil, err
	}
	return resolved, nil
}

func validateResolved(spec *ResolvedAgentSpec) error {
	if spec.Name == "" {
		return fmt.Errorf("agent.name is required")
	}
	if spec.SystemPromptPath == "" {
		return fmt.Errorf("agent.system_prompt_path is required")
	}
	if len(spec.Tools) == 0 {
		return fmt.Errorf("agent.tools is required")
	}
	if spec.SystemPromptArgs == nil {
		spec.SystemPromptArgs = map[string]string{}
	}
	if spec.ExcludeTools == nil {
		spec.ExcludeTools = []string{}
	}
	if spec.Subagents == nil {
		spec.Subagents = map[string]SubagentSpec{}
	}
	if spec.Modes == nil {
		spec.Modes = map[string]ModeSpec{}
	}
	return nil
}

func cloneResolved(spec *ResolvedAgentSpec) *ResolvedAgentSpec {
	return &ResolvedAgentSpec{
		Name:             spec.Name,
		SystemPromptPath: spec.SystemPromptPath,
		SystemPromptArgs: copyStringMap(spec.SystemPromptArgs),
		Model:            spec.Model,
		ModelProfile:     spec.ModelProfile,
		WhenToUse:        spec.WhenToUse,
		Tools:            append([]string(nil), spec.Tools...),
		AllowedTools:     append([]string(nil), spec.AllowedTools...),
		ExcludeTools:     append([]string(nil), spec.ExcludeTools...),
		Subagents:        copySubagents(spec.Subagents),
		Modes:            copyModes(spec.Modes),
	}
}

func copyStringMap(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func copySubagents(in map[string]SubagentSpec) map[string]SubagentSpec {
	out := make(map[string]SubagentSpec, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func copyModes(in map[string]ModeSpec) map[string]ModeSpec {
	out := make(map[string]ModeSpec, len(in))
	for k, v := range in {
		v.Tools.Allowed = append([]string(nil), v.Tools.Allowed...)
		v.Tools.Exclude = append([]string(nil), v.Tools.Exclude...)
		out[k] = v
	}
	return out
}

func mergeModes(base, override map[string]ModeSpec) map[string]ModeSpec {
	out := copyModes(base)
	for k, v := range override {
		v.Tools.Allowed = append([]string(nil), v.Tools.Allowed...)
		v.Tools.Exclude = append([]string(nil), v.Tools.Exclude...)
		out[k] = v
	}
	return out
}

func readPrompt(path string) ([]byte, error) {
	if strings.HasPrefix(path, embedPrefix) {
		return defaultAgentFS.ReadFile(strings.TrimPrefix(path, embedPrefix))
	}
	return os.ReadFile(path)
}
