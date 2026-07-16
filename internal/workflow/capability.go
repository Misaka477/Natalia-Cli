package workflow

import (
	"fmt"
)

type CapabilityProfile struct {
	Profile     string
	Unsupported []string
	Warnings    []string
}

type ExecutionPlan struct {
	Steps []*PlanStep
}

type PlanStep struct {
	ID       string
	Kind     string
	Children []*PlanStep
}

var coreKinds = map[string]bool{
	"do":     true,
	"set":    true,
	"for":    true,
	"try":    true,
	"wait":   true,
	"if":     true,
	"call":   true,
	"export": true,
}

var protocolKinds = map[string]bool{
	"fork":   true,
	"switch": true,
}

func stepKind(s Step) string {
	switch {
	case s.Do != nil:
		return "do"
	case s.Set != nil:
		return "set"
	case s.Switch != nil:
		return "switch"
	case s.For != nil:
		return "for"
	case len(s.Fork) > 0:
		return "fork"
	case s.Try != nil:
		return "try"
	case s.Wait != nil:
		return "wait"
	case s.If != nil:
		return "if"
	case s.Call != nil:
		return "call"
	case s.Export != nil:
		return "export"
	default:
		return "unknown"
	}
}

func collectKinds(b *Block) map[string]bool {
	kinds := map[string]bool{}
	if b == nil {
		return kinds
	}
	for _, s := range b.Steps {
		k := stepKind(s)
		if k != "unknown" {
			kinds[k] = true
		}
		if s.Do != nil {
			sub := collectKinds(s.Do)
			for k := range sub {
				kinds[k] = true
			}
		}
		if s.Switch != nil {
			for _, c := range s.Switch.Cases {
				sub := collectKinds(c.Do)
				for k := range sub {
					kinds[k] = true
				}
			}
			if s.Switch.Default != nil {
				sub := collectKinds(s.Switch.Default)
				for k := range sub {
					kinds[k] = true
				}
			}
		}
		if s.For != nil && s.For.Do != nil {
			sub := collectKinds(s.For.Do)
			for k := range sub {
				kinds[k] = true
			}
		}
		if s.Try != nil {
			if s.Try.Try != nil {
				sub := collectKinds(s.Try.Try)
				for k := range sub {
					kinds[k] = true
				}
			}
			for _, c := range s.Try.Catch {
				sub := collectKinds(c.Do)
				for k := range sub {
					kinds[k] = true
				}
			}
		}
		if s.If != nil {
			if s.If.Then != nil {
				sub := collectKinds(s.If.Then)
				for k := range sub {
					kinds[k] = true
				}
			}
			if s.If.Else != nil {
				sub := collectKinds(s.If.Else)
				for k := range sub {
					kinds[k] = true
				}
			}
		}
		for _, fb := range s.Fork {
			sub := collectKinds(&fb)
			for k := range sub {
				kinds[k] = true
			}
		}
	}
	return kinds
}

func determineProfile(kinds map[string]bool) string {
	for k := range kinds {
		if !coreKinds[k] && !protocolKinds[k] {
			return "deferred"
		}
	}
	for k := range kinds {
		if protocolKinds[k] {
			return "protocol"
		}
	}
	return "core"
}

func checkUnsupported(kinds map[string]bool, profile string) []string {
	var unsupported []string
	for k := range kinds {
		if coreKinds[k] {
			continue
		}
		if profile == "core" && protocolKinds[k] {
			unsupported = append(unsupported, k)
			continue
		}
		if !coreKinds[k] && !protocolKinds[k] {
			unsupported = append(unsupported, k)
		}
	}
	if len(unsupported) == 0 {
		return nil
	}
	return unsupported
}

func Compile(doc *Document) (*ExecutionPlan, *CapabilityProfile, error) {
	if doc == nil {
		return nil, nil, fmt.Errorf("document is nil")
	}
	if doc.Name == "" {
		return nil, nil, fmt.Errorf("document name is required")
	}
	if doc.Do == nil {
		return nil, nil, fmt.Errorf("document must contain a 'do' block")
	}

	kinds := collectKinds(doc.Do)

	profileName := determineProfile(kinds)
	unsupported := checkUnsupported(kinds, profileName)

	var warnings []string
	if len(unsupported) > 0 {
		warnings = append(warnings, fmt.Sprintf("unsupported step kinds: %v", unsupported))
	}

	plan := &ExecutionPlan{
		Steps: buildPlanSteps(doc.Do.Steps),
	}

	return plan, &CapabilityProfile{
		Profile:     profileName,
		Unsupported: unsupported,
		Warnings:    warnings,
	}, nil
}

func buildPlanSteps(steps []Step) []*PlanStep {
	if len(steps) == 0 {
		return nil
	}
	var out []*PlanStep
	for _, s := range steps {
		ps := &PlanStep{ID: s.ID, Kind: stepKind(s)}
		switch {
		case s.Do != nil:
			ps.Children = buildPlanSteps(s.Do.Steps)
		case s.Switch != nil:
			for _, c := range s.Switch.Cases {
				if c.Do != nil {
					ps.Children = append(ps.Children, buildPlanSteps(c.Do.Steps)...)
				}
			}
			if s.Switch.Default != nil {
				ps.Children = append(ps.Children, buildPlanSteps(s.Switch.Default.Steps)...)
			}
		case s.For != nil && s.For.Do != nil:
			ps.Children = buildPlanSteps(s.For.Do.Steps)
		case s.Try != nil:
			if s.Try.Try != nil {
				ps.Children = buildPlanSteps(s.Try.Try.Steps)
			}
			for _, c := range s.Try.Catch {
				if c.Do != nil {
					ps.Children = append(ps.Children, buildPlanSteps(c.Do.Steps)...)
				}
			}
		case s.If != nil:
			if s.If.Then != nil {
				ps.Children = append(ps.Children, buildPlanSteps(s.If.Then.Steps)...)
			}
			if s.If.Else != nil {
				ps.Children = append(ps.Children, buildPlanSteps(s.If.Else.Steps)...)
			}
		case len(s.Fork) > 0:
			for i := range s.Fork {
				ps.Children = append(ps.Children, buildPlanSteps(s.Fork[i].Steps)...)
			}
		}
		out = append(out, ps)
	}
	return out
}
