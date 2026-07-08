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
	Provider        string   `yaml:"provider"`
	Model           string   `yaml:"model"`
	MaxContext      int      `yaml:"max_context"`
	Temperature     float64  `yaml:"temperature"`
	MaxTokens       int      `yaml:"max_tokens"`
	TopP            float64  `yaml:"top_p"`
	ReasoningEffort string   `yaml:"reasoning_effort,omitempty"`
	ThinkingEnabled bool     `yaml:"thinking_enabled"`
	Stream          bool     `yaml:"stream"`
	MaxSteps        int      `yaml:"max_steps"`
	TimeoutSec      int      `yaml:"timeout_sec"`
	SystemPrompt    string   `yaml:"system_prompt,omitempty"`
	WorkDir         string   `yaml:"work_dir,omitempty"`
	AutoApprove     string   `yaml:"auto_approve"`
}

type Config struct {
	DefaultProfile string              `yaml:"default_profile"`
	Providers      map[string]Provider `yaml:"providers"`
	Profiles       map[string]Profile  `yaml:"profiles"`
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
