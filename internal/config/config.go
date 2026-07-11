package config

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"gopkg.in/yaml.v3"
)

type Provider struct {
	BaseURL       string            `yaml:"base_url"`
	APIKey        string            `yaml:"api_key"`
	AuthHeader    string            `yaml:"auth_header,omitempty"`
	CustomHeaders map[string]string `yaml:"custom_headers,omitempty"`
}

type Profile struct {
	Provider          string                 `yaml:"provider"`
	Model             string                 `yaml:"model"`
	ModelProfile      string                 `yaml:"model_profile,omitempty"`
	PermissionProfile string                 `yaml:"permission_profile,omitempty"`
	MaxContext        int                    `yaml:"max_context"`
	Temperature       float64                `yaml:"temperature"`
	MaxTokens         int                    `yaml:"max_tokens"`
	TopP              float64                `yaml:"top_p"`
	ReasoningEffort   string                 `yaml:"reasoning_effort,omitempty"`
	ThinkingEnabled   bool                   `yaml:"thinking_enabled"`
	Stream            bool                   `yaml:"stream"`
	MaxSteps          int                    `yaml:"max_steps"`
	TimeoutSec        int                    `yaml:"timeout_sec"`
	SystemPrompt      string                 `yaml:"system_prompt,omitempty"`
	WorkDir           string                 `yaml:"work_dir,omitempty"`
	AutoApprove       string                 `yaml:"auto_approve"`
	Mode              string                 `yaml:"mode,omitempty"`
	Modes             map[string]ModeProfile `yaml:"modes,omitempty"`
}

type ModelProfile struct {
	Provider        string            `yaml:"provider,omitempty"`
	Model           string            `yaml:"model,omitempty"`
	MaxContext      int               `yaml:"max_context,omitempty"`
	Temperature     float64           `yaml:"temperature,omitempty"`
	MaxTokens       int               `yaml:"max_tokens,omitempty"`
	TopP            float64           `yaml:"top_p,omitempty"`
	ReasoningEffort string            `yaml:"reasoning_effort,omitempty"`
	ThinkingEnabled *bool             `yaml:"thinking_enabled,omitempty"`
	Stream          *bool             `yaml:"stream,omitempty"`
	MaxSteps        int               `yaml:"max_steps,omitempty"`
	TimeoutSec      int               `yaml:"timeout_sec,omitempty"`
	AuthHeader      string            `yaml:"auth_header,omitempty"`
	CustomHeaders   map[string]string `yaml:"custom_headers,omitempty"`
}

type PermissionProfile struct {
	Approval    string `yaml:"approval"`
	Description string `yaml:"description,omitempty"`
}

type ModeProfile struct {
	Extends           string     `yaml:"extends,omitempty"`
	Description       string     `yaml:"description,omitempty"`
	ModelProfile      string     `yaml:"model_profile,omitempty"`
	PermissionProfile string     `yaml:"permission_profile,omitempty"`
	SystemPrompt      string     `yaml:"system_prompt,omitempty"`
	SystemPromptPath  string     `yaml:"system_prompt_path,omitempty"`
	ReasoningEffort   string     `yaml:"reasoning_effort,omitempty"`
	ThinkingEnabled   *bool      `yaml:"thinking_enabled,omitempty"`
	Tools             ToolPolicy `yaml:"tools,omitempty"`
}

type ToolPolicy struct {
	Allowed []string `yaml:"allowed,omitempty"`
	Exclude []string `yaml:"exclude,omitempty"`
}

type EffectiveProfile struct {
	Profile           Profile
	Provider          Provider
	ModeConfig        ModeProfile
	ProfileName       string
	Mode              string
	ModelProfile      string
	PermissionProfile string
	Approval          string
}

type Config struct {
	DefaultProfile     string                       `yaml:"default_profile"`
	Providers          map[string]Provider          `yaml:"providers"`
	Profiles           map[string]Profile           `yaml:"profiles"`
	ModelProfiles      map[string]ModelProfile      `yaml:"model_profiles,omitempty"`
	PermissionProfiles map[string]PermissionProfile `yaml:"permission_profiles,omitempty"`
}

func Path() (string, error) {
	dir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, ".config", "natalia-cli", "config.yaml"), nil
}

func Load() (*Config, error) {
	p, err := Path()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	if cfg.Providers == nil {
		cfg.Providers = make(map[string]Provider)
	}
	if cfg.Profiles == nil {
		cfg.Profiles = make(map[string]Profile)
	}
	if cfg.ModelProfiles == nil {
		cfg.ModelProfiles = make(map[string]ModelProfile)
	}
	if cfg.PermissionProfiles == nil {
		cfg.PermissionProfiles = DefaultPermissionProfiles()
	}
	return &cfg, nil
}

func (c *Config) Save() error {
	p, err := Path()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		return err
	}
	data, err := yaml.Marshal(c)
	if err != nil {
		return err
	}
	return os.WriteFile(p, data, 0644)
}

func (c *Config) ActiveProfile() (*Profile, *Provider, error) {
	if c.DefaultProfile == "" {
		return nil, nil, fmt.Errorf("未配置，输入 /setup 开始配置")
	}
	pr, ok := c.Profiles[c.DefaultProfile]
	if !ok {
		return nil, nil, fmt.Errorf("配置 %q 不存在", c.DefaultProfile)
	}
	p, ok := c.Providers[pr.Provider]
	if !ok {
		return nil, nil, fmt.Errorf("配置 %q 的服务商 %q 不存在", c.DefaultProfile, pr.Provider)
	}
	return &pr, &p, nil
}

func DefaultPermissionProfiles() map[string]PermissionProfile {
	return map[string]PermissionProfile{
		"just_do_it": {Approval: "just_do_it", Description: "写操作和 shell 可直接执行"},
		"ask":        {Approval: "ask", Description: "写操作和 shell 执行前询问用户"},
		"read_only":  {Approval: "read_only", Description: "拒绝写操作和 shell"},
	}
}

func (c *Config) EffectiveProfile(modeOverride, modelOverride, permissionOverride string) (*EffectiveProfile, error) {
	if c.DefaultProfile == "" {
		return nil, fmt.Errorf("未配置，输入 /setup 开始配置")
	}
	pr, ok := c.Profiles[c.DefaultProfile]
	if !ok {
		return nil, fmt.Errorf("配置 %q 不存在", c.DefaultProfile)
	}
	modeName := pr.Mode
	if modeName == "" {
		modeName = "code"
	}
	if modeOverride != "" {
		modeName = modeOverride
	}
	modeProfile := c.resolveModeProfile(pr, modeName, map[string]bool{})

	modelProfileName := pr.ModelProfile
	if modeProfile.ModelProfile != "" {
		modelProfileName = modeProfile.ModelProfile
	}
	if modelOverride != "" {
		modelProfileName = modelOverride
	}
	if modelProfileName != "" {
		mp, ok := c.ModelProfiles[modelProfileName]
		if !ok {
			return nil, fmt.Errorf("模型配置 %q 不存在", modelProfileName)
		}
		applyModelProfile(&pr, &mp)
	}
	if modeProfile.ReasoningEffort != "" {
		pr.ReasoningEffort = modeProfile.ReasoningEffort
	}
	if modeProfile.ThinkingEnabled != nil {
		pr.ThinkingEnabled = *modeProfile.ThinkingEnabled
	}
	if modeProfile.SystemPrompt != "" {
		pr.SystemPrompt = modeProfile.SystemPrompt
	}

	permissionProfileName := pr.PermissionProfile
	if permissionProfileName == "" {
		permissionProfileName = pr.AutoApprove
	}
	if modeProfile.PermissionProfile != "" {
		permissionProfileName = modeProfile.PermissionProfile
	}
	if permissionOverride != "" {
		permissionProfileName = permissionOverride
	}
	if permissionProfileName == "" {
		permissionProfileName = "ask"
	}
	approval := permissionProfileName
	if pp, ok := c.PermissionProfiles[permissionProfileName]; ok && pp.Approval != "" {
		approval = pp.Approval
	}

	p, ok := c.Providers[pr.Provider]
	if !ok {
		return nil, fmt.Errorf("配置 %q 的服务商 %q 不存在", c.DefaultProfile, pr.Provider)
	}
	return &EffectiveProfile{
		Profile:           pr,
		Provider:          p,
		ModeConfig:        modeProfile,
		ProfileName:       c.DefaultProfile,
		Mode:              modeName,
		ModelProfile:      modelProfileName,
		PermissionProfile: permissionProfileName,
		Approval:          approval,
	}, nil
}

func (c *Config) resolveModeProfile(pr Profile, name string, seen map[string]bool) ModeProfile {
	if name == "" || seen[name] {
		return ModeProfile{}
	}
	seen[name] = true
	current := c.defaultModeProfile(name)
	if pr.Modes != nil {
		current = mergeModeProfile(current, pr.Modes[name])
	}
	if current.Extends == "" {
		return current
	}
	base := c.resolveModeProfile(pr, current.Extends, seen)
	return mergeModeProfile(base, current)
}

func (c *Config) defaultModeProfile(name string) ModeProfile {
	switch name {
	case "plan":
		return ModeProfile{ModelProfile: c.firstExistingModelProfile("strongest", "strong"), PermissionProfile: "read_only", ReasoningEffort: "high"}
	case "debug":
		return ModeProfile{ModelProfile: c.firstExistingModelProfile("strongest", "strong"), PermissionProfile: "ask", ReasoningEffort: "high"}
	case "ask", "chat":
		return ModeProfile{ModelProfile: c.firstExistingModelProfile("cheap"), PermissionProfile: "read_only"}
	case "code":
		return ModeProfile{PermissionProfile: "ask"}
	default:
		return ModeProfile{}
	}
}

func (c *Config) firstExistingModelProfile(names ...string) string {
	for _, name := range names {
		if _, ok := c.ModelProfiles[name]; ok {
			return name
		}
	}
	return ""
}

func mergeModeProfile(base, override ModeProfile) ModeProfile {
	out := base
	if override.Extends != "" {
		out.Extends = override.Extends
	}
	if override.Description != "" {
		out.Description = override.Description
	}
	if override.ModelProfile != "" {
		out.ModelProfile = override.ModelProfile
	}
	if override.PermissionProfile != "" {
		out.PermissionProfile = override.PermissionProfile
	}
	if override.SystemPrompt != "" {
		out.SystemPrompt = override.SystemPrompt
	}
	if override.SystemPromptPath != "" {
		out.SystemPromptPath = override.SystemPromptPath
	}
	if override.ReasoningEffort != "" {
		out.ReasoningEffort = override.ReasoningEffort
	}
	if override.ThinkingEnabled != nil {
		out.ThinkingEnabled = override.ThinkingEnabled
	}
	if len(override.Tools.Allowed) > 0 {
		out.Tools.Allowed = append([]string(nil), override.Tools.Allowed...)
	}
	if len(override.Tools.Exclude) > 0 {
		out.Tools.Exclude = append([]string(nil), override.Tools.Exclude...)
	}
	return out
}

func applyModelProfile(pr *Profile, mp *ModelProfile) {
	if mp.Provider != "" {
		pr.Provider = mp.Provider
	}
	if mp.Model != "" {
		pr.Model = mp.Model
	}
	if mp.MaxContext != 0 {
		pr.MaxContext = mp.MaxContext
	}
	if mp.Temperature != 0 {
		pr.Temperature = mp.Temperature
	}
	if mp.MaxTokens != 0 {
		pr.MaxTokens = mp.MaxTokens
	}
	if mp.TopP != 0 {
		pr.TopP = mp.TopP
	}
	if mp.ReasoningEffort != "" {
		pr.ReasoningEffort = mp.ReasoningEffort
	}
	if mp.ThinkingEnabled != nil {
		pr.ThinkingEnabled = *mp.ThinkingEnabled
	}
	if mp.Stream != nil {
		pr.Stream = *mp.Stream
	}
	if mp.MaxSteps != 0 {
		pr.MaxSteps = mp.MaxSteps
	}
	if mp.TimeoutSec != 0 {
		pr.TimeoutSec = mp.TimeoutSec
	}
}

func (c *Config) ProfileList() []string {
	names := make([]string, 0, len(c.Profiles))
	for name := range c.Profiles {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func (c *Config) ProviderList() []string {
	names := make([]string, 0, len(c.Providers))
	for name := range c.Providers {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
