package toolset

import (
	"fmt"

	"github.com/aquama/natalia-cli/internal/agentspec"
	"github.com/aquama/natalia-cli/internal/tools/ask_user"
	"github.com/aquama/natalia-cli/internal/tools/browser"
	"github.com/aquama/natalia-cli/internal/tools/file"
	"github.com/aquama/natalia-cli/internal/tools/process"
	"github.com/aquama/natalia-cli/internal/tools/shell"
	"github.com/aquama/natalia-cli/internal/tools/todo"
	"github.com/aquama/natalia-cli/internal/tools/web"
)

var builtInToolFactories = map[string]func() Tool{
	"natalia/tools/file:Read":          func() Tool { return &file.Read{} },
	"natalia/tools/file:Write":         func() Tool { return &file.Write{} },
	"natalia/tools/file:Edit":          func() Tool { return &file.Edit{} },
	"natalia/tools/file:Glob":          func() Tool { return &file.Glob{} },
	"natalia/tools/file:Grep":          func() Tool { return &file.Grep{} },
	"natalia/tools/shell:Run":          func() Tool { return &shell.Run{} },
	"natalia/tools/web:Fetch":          func() Tool { return &web.Fetch{} },
	"natalia/tools/web:Search":         func() Tool { return &web.Search{} },
	"natalia/tools/web:MediaFile":      func() Tool { return &web.MediaFile{} },
	"natalia/tools/todo:Set":           func() Tool { return &todo.Set{} },
	"natalia/tools/todo:Add":           func() Tool { return &todo.Add{} },
	"natalia/tools/todo:Done":          func() Tool { return &todo.Done{} },
	"natalia/tools/todo:List":          func() Tool { return &todo.List{} },
	"natalia/tools/ask_user:AskUser":   func() Tool { return &ask_user.AskUser{} },
	"natalia/tools/browser:Visit":      func() Tool { return &browser.Visit{} },
	"natalia/tools/browser:Screenshot": func() Tool { return &browser.Screenshot{} },
	"natalia/tools/process:Start":      func() Tool { return &process.Start{} },
	"natalia/tools/process:List":       func() Tool { return &process.List{} },
	"natalia/tools/process:Status":     func() Tool { return &process.Status{} },
	"natalia/tools/process:Output":     func() Tool { return &process.Output{} },
	"natalia/tools/process:Stop":       func() Tool { return &process.Stop{} },
}

func LoadFromAgentSpec(spec *agentspec.ResolvedAgentSpec) (*Registry, error) {
	r := NewRegistry()
	if err := RegisterFromAgentSpec(r, spec); err != nil {
		return nil, err
	}
	return r, nil
}

func RegisterFromAgentSpec(r *Registry, spec *agentspec.ResolvedAgentSpec) error {
	allowed := stringSet(spec.AllowedTools)
	excluded := stringSet(spec.ExcludeTools)
	for _, id := range spec.Tools {
		factory, ok := builtInToolFactories[id]
		if !ok {
			return fmt.Errorf("unknown tool %q", id)
		}
		tool := factory()
		name := tool.Name()
		if len(allowed) > 0 && !allowed[id] && !allowed[name] {
			continue
		}
		if excluded[id] || excluded[name] {
			continue
		}
		r.Register(tool)
	}
	return nil
}

func RegisterDefaultTools(r *Registry) error {
	spec, err := agentspec.LoadDefaultAgentSpec()
	if err != nil {
		return err
	}
	return RegisterFromAgentSpec(r, spec)
}

func stringSet(values []string) map[string]bool {
	set := make(map[string]bool, len(values))
	for _, value := range values {
		set[value] = true
	}
	return set
}
