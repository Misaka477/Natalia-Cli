package config

import "testing"

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
					"review": {Extends: "code", Description: "Review Mode", SystemPrompt: "review prompt", Tools: ToolPolicy{Exclude: []string{"write_file"}}},
				},
			},
		},
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
