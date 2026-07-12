package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func boolPtr(v bool) *bool { return &v }

func TestEffectiveProfileUsesModeModelAndPermission(t *testing.T) {
	cfg := &Config{
		DefaultProfile: "default",
		Providers: map[string]Provider{
			"deepseek": {BaseURL: "https://deepseek.example", APIKey: "dk"},
			"strong":   {BaseURL: "https://strong.example", APIKey: "sk"},
		},
		ModelProfiles: map[string]ModelProfile{
			"cheap":  {Provider: "deepseek", Model: "cheap-model", MaxTokens: 1000},
			"strong": {Provider: "strong", Model: "strong-model", ReasoningEffort: "high", ThinkingEnabled: boolPtr(true)},
		},
		PermissionProfiles: DefaultPermissionProfiles(),
		Profiles: map[string]Profile{
			"default": {
				Provider:          "deepseek",
				Model:             "base-model",
				ModelProfile:      "cheap",
				PermissionProfile: "ask",
				Mode:              "code",
				Modes: map[string]ModeProfile{
					"debug": {ModelProfile: "strong", PermissionProfile: "read_only"},
				},
			},
		},
	}
	eff, err := cfg.EffectiveProfile("debug", "", "")
	if err != nil {
		t.Fatalf("EffectiveProfile failed: %v", err)
	}
	if eff.Mode != "debug" || eff.ModelProfile != "strong" || eff.PermissionProfile != "read_only" {
		t.Fatalf("unexpected effective routing: %+v", eff)
	}
	if eff.Profile.Provider != "strong" || eff.Profile.Model != "strong-model" || eff.Profile.ReasoningEffort != "high" || !eff.Profile.ThinkingEnabled {
		t.Fatalf("model profile was not applied: %+v", eff.Profile)
	}
}

func TestEffectiveProfileManualOverrides(t *testing.T) {
	cfg := &Config{
		DefaultProfile: "default",
		Providers: map[string]Provider{
			"p": {BaseURL: "https://example", APIKey: "key"},
		},
		ModelProfiles: map[string]ModelProfile{
			"cheap":  {Provider: "p", Model: "cheap"},
			"strong": {Provider: "p", Model: "strong"},
		},
		PermissionProfiles: DefaultPermissionProfiles(),
		Profiles: map[string]Profile{
			"default": {
				Provider: "p",
				Model:    "base",
				Modes: map[string]ModeProfile{
					"debug": {ModelProfile: "strong", PermissionProfile: "ask"},
				},
			},
		},
	}
	eff, err := cfg.EffectiveProfile("debug", "cheap", "read_only")
	if err != nil {
		t.Fatalf("EffectiveProfile failed: %v", err)
	}
	if eff.ModelProfile != "cheap" || eff.Profile.Model != "cheap" {
		t.Fatalf("manual model override not applied: %+v", eff)
	}
	if eff.PermissionProfile != "read_only" || eff.Approval != "read_only" {
		t.Fatalf("manual permission override not applied: %+v", eff)
	}
}

func TestEffectiveProfileExtendsMode(t *testing.T) {
	cfg := &Config{
		DefaultProfile: "default",
		Providers: map[string]Provider{
			"p": {BaseURL: "https://example", APIKey: "key"},
		},
		ModelProfiles:      map[string]ModelProfile{"strong": {Provider: "p", Model: "strong"}},
		PermissionProfiles: DefaultPermissionProfiles(),
		Profiles: map[string]Profile{
			"default": {
				Provider: "p",
				Model:    "base",
				Modes: map[string]ModeProfile{
					"code":   {ModelProfile: "strong", PermissionProfile: "ask"},
					"review": {Extends: "code", PermissionProfile: "read_only"},
				},
			},
		},
	}
	eff, err := cfg.EffectiveProfile("review", "", "")
	if err != nil {
		t.Fatalf("EffectiveProfile failed: %v", err)
	}
	if eff.ModelProfile != "strong" || eff.PermissionProfile != "read_only" {
		t.Fatalf("expected inherited model and overridden permission, got %+v", eff)
	}
	if eff.ModeConfig.ModelProfile != "strong" || eff.ModeConfig.PermissionProfile != "read_only" {
		t.Fatalf("expected effective mode config to be retained, got %+v", eff.ModeConfig)
	}
}

func TestEffectiveProfileReturnsCustomModeConfig(t *testing.T) {
	cfg := &Config{
		DefaultProfile: "default",
		Providers: map[string]Provider{
			"p": {BaseURL: "https://example", APIKey: "key"},
		},
		PermissionProfiles: DefaultPermissionProfiles(),
		Profiles: map[string]Profile{
			"default": {
				Provider: "p",
				Model:    "base",
				Modes: map[string]ModeProfile{
					"review": {Extends: "code", Description: "Review Mode", SystemPrompt: "review prompt", Tools: ToolPolicy{Exclude: []string{"write_file"}}, MCPServers: []string{"fixture"}},
				},
			},
		},
		MCPServers: map[string]MCPServerConfig{"fixture": {Command: "fixture-mcp", Args: []string{"--stdio"}, TimeoutSec: 3, AllowedTools: []string{"echo"}, ReadOnly: true}},
	}
	eff, err := cfg.EffectiveProfile("review", "", "")
	if err != nil {
		t.Fatalf("EffectiveProfile failed: %v", err)
	}
	if eff.Mode != "review" || eff.ModeConfig.SystemPrompt != "review prompt" || eff.ModeConfig.Description != "Review Mode" {
		t.Fatalf("unexpected custom mode config: %+v", eff)
	}
	if len(eff.ModeConfig.Tools.Exclude) != 1 || eff.ModeConfig.Tools.Exclude[0] != "write_file" {
		t.Fatalf("unexpected custom mode tool policy: %+v", eff.ModeConfig.Tools)
	}
	if len(eff.ModeConfig.MCPServers) != 1 || eff.ModeConfig.MCPServers[0] != "fixture" {
		t.Fatalf("unexpected custom mode MCP servers: %+v", eff.ModeConfig.MCPServers)
	}
}

func TestEffectiveProfileUsesBuiltinModeRouting(t *testing.T) {
	cfg := &Config{
		DefaultProfile: "default",
		Providers: map[string]Provider{
			"p": {BaseURL: "https://example", APIKey: "key"},
		},
		ModelProfiles: map[string]ModelProfile{
			"cheap":     {Provider: "p", Model: "cheap"},
			"strongest": {Provider: "p", Model: "strongest"},
		},
		PermissionProfiles: DefaultPermissionProfiles(),
		Profiles: map[string]Profile{
			"default": {Provider: "p", Model: "base"},
		},
	}

	plan, err := cfg.EffectiveProfile("plan", "", "")
	if err != nil {
		t.Fatalf("EffectiveProfile plan failed: %v", err)
	}
	if plan.ModelProfile != "strongest" || plan.Profile.Model != "strongest" || plan.PermissionProfile != "read_only" || plan.Profile.ReasoningEffort != "high" {
		t.Fatalf("unexpected plan routing: %+v", plan)
	}

	ask, err := cfg.EffectiveProfile("ask", "", "")
	if err != nil {
		t.Fatalf("EffectiveProfile ask failed: %v", err)
	}
	if ask.ModelProfile != "cheap" || ask.Profile.Model != "cheap" || ask.PermissionProfile != "read_only" {
		t.Fatalf("unexpected ask routing: %+v", ask)
	}
}

func TestEffectiveProfileBuiltinModeRoutingFallsBackToProfileModel(t *testing.T) {
	cfg := &Config{
		DefaultProfile:     "default",
		Providers:          map[string]Provider{"p": {BaseURL: "https://example", APIKey: "key"}},
		ModelProfiles:      map[string]ModelProfile{},
		PermissionProfiles: DefaultPermissionProfiles(),
		Profiles:           map[string]Profile{"default": {Provider: "p", Model: "base"}},
	}
	eff, err := cfg.EffectiveProfile("debug", "", "")
	if err != nil {
		t.Fatalf("EffectiveProfile failed: %v", err)
	}
	if eff.ModelProfile != "" || eff.Profile.Model != "base" || eff.PermissionProfile != "ask" || eff.Profile.ReasoningEffort != "high" {
		t.Fatalf("unexpected fallback routing: %+v", eff)
	}
}

func TestEffectiveProfileReturnsActionableErrorsForBrokenReferences(t *testing.T) {
	cases := []struct {
		name string
		cfg  *Config
		want string
	}{
		{name: "missing default profile", cfg: &Config{DefaultProfile: "missing", Profiles: map[string]Profile{}, Providers: map[string]Provider{}, ModelProfiles: map[string]ModelProfile{}, PermissionProfiles: DefaultPermissionProfiles()}, want: "配置 \"missing\" 不存在"},
		{name: "missing model profile", cfg: &Config{DefaultProfile: "default", Profiles: map[string]Profile{"default": {Provider: "p", ModelProfile: "missing-model"}}, Providers: map[string]Provider{"p": {}}, ModelProfiles: map[string]ModelProfile{}, PermissionProfiles: DefaultPermissionProfiles()}, want: "模型配置 \"missing-model\" 不存在"},
		{name: "missing provider", cfg: &Config{DefaultProfile: "default", Profiles: map[string]Profile{"default": {Provider: "missing-provider"}}, Providers: map[string]Provider{}, ModelProfiles: map[string]ModelProfile{}, PermissionProfiles: DefaultPermissionProfiles()}, want: "服务商 \"missing-provider\" 不存在"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := tc.cfg.EffectiveProfile("", "", "")
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("expected error containing %q, got %v", tc.want, err)
			}
		})
	}
}

func TestConfigSaveLoadAndEffectiveProfileEndToEnd(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	thinking := true
	cfg := &Config{
		DefaultProfile: "default",
		Providers: map[string]Provider{
			"local": {BaseURL: "http://127.0.0.1:1234/v1/chat/completions", APIKey: "test-key", AuthHeader: "X-Test-Auth", CustomHeaders: map[string]string{"X-Model-Gateway": "local"}},
		},
		ModelProfiles: map[string]ModelProfile{
			"cheap": {Provider: "local", Model: "step-3.7-flash", MaxTokens: 2048, ReasoningEffort: "low", ThinkingEnabled: &thinking},
		},
		PermissionProfiles: DefaultPermissionProfiles(),
		Profiles: map[string]Profile{
			"default": {Provider: "local", Model: "base", ModelProfile: "cheap", PermissionProfile: "ask", Mode: "ask", AdditionalDirs: []string{"/tmp/fixture-a", "/tmp/fixture-b"}},
		},
		Hooks: []HookDef{{ID: "pre-read", Event: "PreToolUse", Target: "read_file", Command: "printf hook", TimeoutSec: 2}},
		MCPServers: map[string]MCPServerConfig{
			"fixture": {Command: "fixture-mcp", Args: []string{"--stdio"}, TimeoutSec: 4, AllowedTools: []string{"echo"}, ExcludeTools: []string{"mutate"}, ReadOnly: true},
		},
		WebSearch: WebSearchConfig{ProviderPriority: []string{"bing", "google", "duckduckgo"}},
		Browser:   BrowserConfig{Backend: "rod", PersistentProfile: true, ProfileDir: "/tmp/natalia-browser", UserAgent: "NataliaTest/1.0", Locale: "en-US", Timezone: "UTC", Headers: map[string]string{"X-Test": "browser"}, Stealth: true, Trace: true},
	}
	if err := cfg.Save(); err != nil {
		t.Fatal(err)
	}
	configPath := filepath.Join(home, ".config", "natalia-cli", "config.yaml")
	if _, err := os.Stat(configPath); err != nil {
		t.Fatalf("expected config saved at %s: %v", configPath, err)
	}
	loaded, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	eff, err := loaded.EffectiveProfile("", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if eff.Mode != "ask" || eff.Profile.Model != "step-3.7-flash" || eff.Profile.Provider != "local" || eff.Approval != "read_only" || eff.Provider.AuthHeader != "X-Test-Auth" || eff.Provider.CustomHeaders["X-Model-Gateway"] != "local" {
		t.Fatalf("loaded config did not produce expected runtime profile: %+v", eff)
	}
	if len(eff.Profile.AdditionalDirs) != 2 || eff.Profile.AdditionalDirs[1] != "/tmp/fixture-b" {
		t.Fatalf("loaded config did not preserve additional_dirs: %+v", eff.Profile.AdditionalDirs)
	}
	if len(loaded.Hooks) != 1 || loaded.Hooks[0].ID != "pre-read" || loaded.Hooks[0].Target != "read_file" || loaded.Hooks[0].TimeoutSec != 2 {
		t.Fatalf("loaded config did not preserve hooks: %+v", loaded.Hooks)
	}
	server := loaded.MCPServers["fixture"]
	if server.Command != "fixture-mcp" || len(server.Args) != 1 || server.TimeoutSec != 4 || len(server.AllowedTools) != 1 || len(server.ExcludeTools) != 1 || !server.ReadOnly {
		t.Fatalf("loaded config did not preserve MCP servers: %+v", loaded.MCPServers)
	}
	if strings.Join(loaded.WebSearch.ProviderPriority, ",") != "bing,google,duckduckgo" {
		t.Fatalf("loaded config did not preserve web search priority: %+v", loaded.WebSearch)
	}
	if loaded.Browser.Backend != "rod" || !loaded.Browser.PersistentProfile || loaded.Browser.ProfileDir != "/tmp/natalia-browser" || loaded.Browser.Headers["X-Test"] != "browser" || !loaded.Browser.Stealth || !loaded.Browser.Trace {
		t.Fatalf("loaded config did not preserve browser config: %+v", loaded.Browser)
	}
}

func TestActiveProfileReturnsExpectedProfileAndProvider(t *testing.T) {
	cfg := &Config{
		DefaultProfile: "default",
		Providers:      map[string]Provider{"step": {BaseURL: "https://step.example/v1", APIKey: "secret"}},
		Profiles:       map[string]Profile{"default": {Provider: "step", Model: "step-3.7-flash", MaxContext: 131072}},
	}
	profile, provider, err := cfg.ActiveProfile()
	if err != nil {
		t.Fatal(err)
	}
	if profile.Model != "step-3.7-flash" || provider.BaseURL != "https://step.example/v1" {
		t.Fatalf("unexpected active profile/provider: profile=%+v provider=%+v", profile, provider)
	}
}

func TestLoadMalformedYAMLReturnsError(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	configPath := filepath.Join(home, ".config", "natalia-cli", "config.yaml")
	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(configPath, []byte("default_profile: ["), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(); err == nil {
		t.Fatal("expected malformed YAML to return an error")
	}
}

func TestLoadInitializesMissingMaps(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	configPath := filepath.Join(home, ".config", "natalia-cli", "config.yaml")
	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(configPath, []byte("default_profile: default\n"), 0644); err != nil {
		t.Fatal(err)
	}
	loaded, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Providers == nil || loaded.Profiles == nil || loaded.ModelProfiles == nil || loaded.PermissionProfiles == nil {
		t.Fatalf("expected Load to initialize nil maps, got %+v", loaded)
	}
}

func TestLoadReturnsNilWhenConfigFileDoesNotExist(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	cfg, err := Load()
	if err != nil || cfg != nil {
		t.Fatalf("expected missing config to return nil,nil, cfg=%+v err=%v", cfg, err)
	}
}
