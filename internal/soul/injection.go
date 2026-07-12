package soul

import (
	"fmt"
	"strings"

	"github.com/Misaka477/Natalia-Cli/internal/chat"
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

type SafetyInjectionProvider struct{}

func (SafetyInjectionProvider) GetInjections(history []chat.Message, engine *Engine) ([]Injection, error) {
	return []Injection{{Type: "safety", Content: "Safety reminder: do not expose secrets, do not run destructive commands without explicit approval, and keep tool actions within the user's workspace and permission policy."}}, nil
}

func (SafetyInjectionProvider) OnContextCompacted() error { return nil }
func (SafetyInjectionProvider) OnAfkChanged(bool) error   { return nil }

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
	for _, provider := range e.InjectionProviders {
		if provider == nil {
			continue
		}
		items, err := provider.GetInjections(e.Context.Messages, e)
		if err != nil {
			e.log("[INJECTION] provider failed: %v", err)
			continue
		}
		for _, item := range items {
			if strings.TrimSpace(item.Content) != "" {
				injections = append(injections, item)
			}
		}
	}
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
