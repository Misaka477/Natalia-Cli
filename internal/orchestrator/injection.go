package orchestrator

import (
	"fmt"
	"strings"
	"sync"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
	"github.com/Misaka477/Natalia-Cli/internal/notifications"
	"github.com/Misaka477/Natalia-Cli/internal/plan"
)

type Injection struct {
	Type    string
	Content string
}

type InjectionProvider interface {
	GetInjections(history []chat.Message, engine *Engine) ([]Injection, error)
	OnContextCompacted() error
	OnAfkChanged(enabled bool) error
}

type InjectionDiagnostic struct {
	Provider string
	Index    int
	Count    int
	Error    string
}

type SafetyInjectionProvider struct{}

func (SafetyInjectionProvider) GetInjections(history []chat.Message, engine *Engine) ([]Injection, error) {
	return []Injection{{Type: "safety", Content: "Safety reminder: do not expose secrets, do not run destructive commands without explicit approval, and keep tool actions within the user's workspace and permission policy."}}, nil
}

func (SafetyInjectionProvider) OnContextCompacted() error { return nil }
func (SafetyInjectionProvider) OnAfkChanged(bool) error   { return nil }

type NotificationInjectionProvider struct {
	Store *notifications.Store
}

func (p NotificationInjectionProvider) GetInjections(history []chat.Message, engine *Engine) ([]Injection, error) {
	store := p.Store
	if store == nil {
		store = notifications.DefaultStore()
	}
	items := store.Drain()
	if len(items) == 0 {
		return nil, nil
	}
	var b strings.Builder
	b.WriteString("Recent runtime notifications:\n")
	for _, item := range items {
		label := item.Title
		if label == "" {
			label = item.Source
		}
		fmt.Fprintf(&b, "- %s: %s\n", label, strings.TrimSpace(item.Message))
	}
	return []Injection{{Type: "notifications", Content: strings.TrimSpace(b.String())}}, nil
}

func (NotificationInjectionProvider) OnContextCompacted() error { return nil }
func (NotificationInjectionProvider) OnAfkChanged(bool) error   { return nil }

type PlanModeManager interface {
	Status() plan.State
}

type PlanModeInjectionProvider struct {
	Manager PlanModeManager
}

func (p PlanModeInjectionProvider) GetInjections(history []chat.Message, engine *Engine) ([]Injection, error) {
	manager := p.Manager
	if manager == nil {
		manager = plan.Default()
	}
	state := manager.Status()
	if !state.Enabled {
		return nil, nil
	}
	content := "Plan mode is active. Do not modify project files unless the plan write guard explicitly allows the path. Keep responses focused on planning, verification strategy, and user-confirmed next steps."
	return []Injection{{Type: "plan_mode", Content: content}}, nil
}

func (PlanModeInjectionProvider) OnContextCompacted() error { return nil }
func (PlanModeInjectionProvider) OnAfkChanged(bool) error   { return nil }

type AFKInjectionProvider struct {
	mu      sync.Mutex
	enabled bool
}

func (p *AFKInjectionProvider) GetInjections(history []chat.Message, engine *Engine) ([]Injection, error) {
	if p == nil || !p.Enabled() {
		return nil, nil
	}
	return []Injection{{Type: "afk", Content: "The user may be away. Continue only with safe, reversible, already-authorized work; avoid prompts that require immediate attention unless blocked."}}, nil
}

func (p *AFKInjectionProvider) OnContextCompacted() error { return nil }

func (p *AFKInjectionProvider) OnAfkChanged(enabled bool) error {
	if p == nil {
		return nil
	}
	p.mu.Lock()
	p.enabled = enabled
	p.mu.Unlock()
	return nil
}

func (p *AFKInjectionProvider) Enabled() bool {
	if p == nil {
		return false
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.enabled
}

func formatInjections(injections []Injection) string {
	var b strings.Builder
	b.WriteString("Dynamic runtime injections for this step only:\n")
	for _, injection := range injections {
		if strings.TrimSpace(injection.Content) == "" {
			continue
		}
		label := injection.Type
		if label == "" {
			label = "general"
		}
		fmt.Fprintf(&b, "\n[%s]\n%s\n", label, injection.Content)
	}
	return strings.TrimSpace(b.String())
}

func (e *Engine) injectDynamicStepMessages() func() {
	if e == nil || len(e.InjectionProviders) == 0 || e.Context == nil {
		return func() {}
	}
	injections := make([]Injection, 0)
	diagnostics := make([]InjectionDiagnostic, 0, len(e.InjectionProviders))
	for _, provider := range e.InjectionProviders {
		index := len(diagnostics)
		name := fmt.Sprintf("%T", provider)
		if provider == nil {
			diagnostics = append(diagnostics, InjectionDiagnostic{Provider: "<nil>", Index: index})
			continue
		}
		items, err := provider.GetInjections(e.Context.Messages, e)
		if err != nil {
			e.log("[INJECTION] provider failed: %v", err)
			diagnostics = append(diagnostics, InjectionDiagnostic{Provider: name, Index: index, Error: err.Error()})
			continue
		}
		kept := 0
		for _, item := range items {
			if strings.TrimSpace(item.Content) != "" {
				injections = append(injections, item)
				kept++
			}
		}
		diagnostics = append(diagnostics, InjectionDiagnostic{Provider: name, Index: index, Count: kept})
	}
	e.setInjectionDiagnostics(diagnostics)
	if len(injections) == 0 {
		return func() {}
	}
	msg := chat.Message{Role: chat.RoleSystem, Content: formatInjections(injections)}
	insertAt := 0
	if len(e.Context.Messages) > 0 && e.Context.Messages[0].Role == chat.RoleSystem {
		insertAt = 1
	}
	e.Context.Messages = append(e.Context.Messages, chat.Message{})
	copy(e.Context.Messages[insertAt+1:], e.Context.Messages[insertAt:])
	e.Context.Messages[insertAt] = msg
	return func() {
		if insertAt >= 0 && insertAt < len(e.Context.Messages) && e.Context.Messages[insertAt].Content == msg.Content && e.Context.Messages[insertAt].Role == msg.Role {
			e.Context.Messages = append(e.Context.Messages[:insertAt], e.Context.Messages[insertAt+1:]...)
		}
	}
}

func (e *Engine) setInjectionDiagnostics(items []InjectionDiagnostic) {
	if e == nil {
		return
	}
	e.injectionDiagnosticsMu.Lock()
	e.injectionDiagnostics = append([]InjectionDiagnostic(nil), items...)
	e.injectionDiagnosticsMu.Unlock()
}

func (e *Engine) LastInjectionDiagnostics() []InjectionDiagnostic {
	if e == nil {
		return nil
	}
	e.injectionDiagnosticsMu.Lock()
	defer e.injectionDiagnosticsMu.Unlock()
	return append([]InjectionDiagnostic(nil), e.injectionDiagnostics...)
}

func (e *Engine) SetAFK(enabled bool) {
	if e == nil {
		return
	}
	for _, provider := range e.InjectionProviders {
		if provider == nil {
			continue
		}
		if err := provider.OnAfkChanged(enabled); err != nil {
			e.log("[INJECTION] afk callback failed: %v", err)
		}
	}
}
