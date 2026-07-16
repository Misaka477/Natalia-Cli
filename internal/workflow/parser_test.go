package workflow

import (
	"testing"
)

func TestCapabilityProfileCore(t *testing.T) {
	doc, err := Parse([]byte(`
ows: 0.1.0
name: core-workflow
do:
  steps:
    - id: s1
      set:
        target: x
        value: 1
    - id: s2
      call: do-something
    - id: s3
      export:
        target: result
        value: "{{x}}"
`))
	if err != nil {
		t.Fatal(err)
	}

	plan, profile, err := Compile(doc)
	if err != nil {
		t.Fatal(err)
	}

	if profile.Profile != "core" {
		t.Fatalf("expected core profile, got %q", profile.Profile)
	}
	if len(profile.Unsupported) > 0 {
		t.Fatalf("expected no unsupported features for core, got %v", profile.Unsupported)
	}
	if len(plan.Steps) != 3 {
		t.Fatalf("expected 3 plan steps, got %d", len(plan.Steps))
	}
	if plan.Steps[0].Kind != "set" || plan.Steps[1].Kind != "call" || plan.Steps[2].Kind != "export" {
		t.Fatalf("unexpected step kinds: %s, %s, %s", plan.Steps[0].Kind, plan.Steps[1].Kind, plan.Steps[2].Kind)
	}
}

func TestCapabilityProfileProtocol(t *testing.T) {
	doc, err := Parse([]byte(`
ows: 0.1.0
name: proto-workflow
do:
  steps:
    - id: br
      switch:
        expression: status
        cases:
          - match: ok
            do:
              steps:
                - call: handle-ok
`))
	if err != nil {
		t.Fatal(err)
	}

	_, profile, err := Compile(doc)
	if err != nil {
		t.Fatal(err)
	}

	if profile.Profile != "protocol" {
		t.Fatalf("expected protocol profile, got %q", profile.Profile)
	}

	if len(profile.Unsupported) > 0 {
		t.Fatalf("expected no unsupported features for protocol (switch is a protocol-level kind), got %v", profile.Unsupported)
	}
}

func TestCapabilityProfileDeferred(t *testing.T) {
	doc, err := Parse([]byte(`
ows: 0.1.0
name: deferred-workflow
do:
  steps:
    - id: custom
      timeout: 30s
      retry:
        max-attempts: 3
      call: heavy-task
`))
	if err != nil {
		t.Fatal(err)
	}

	_, profile, err := Compile(doc)
	if err != nil {
		t.Fatal(err)
	}

	if profile.Profile != "core" {
		t.Fatalf("expected core profile (timeout/retry are step-level, not separate kinds), got %q", profile.Profile)
	}
}

func TestCompilationExecutionPlan(t *testing.T) {
	doc, err := Parse([]byte(`
ows: 0.1.0
name: plan-test
do:
  steps:
    - id: root
      if:
        expression: "true"
        then:
          steps:
            - id: child1
              call: a
            - id: child2
              call: b
        else:
          steps:
            - call: c
`))
	if err != nil {
		t.Fatal(err)
	}

	plan, _, err := Compile(doc)
	if err != nil {
		t.Fatal(err)
	}

	if len(plan.Steps) != 1 {
		t.Fatalf("expected 1 root plan step, got %d", len(plan.Steps))
	}
	if plan.Steps[0].Kind != "if" {
		t.Fatalf("expected root kind 'if', got %q", plan.Steps[0].Kind)
	}
	if len(plan.Steps[0].Children) != 3 {
		t.Fatalf("expected 3 children (then 2 + else 1), got %d", len(plan.Steps[0].Children))
	}
	if plan.Steps[0].Children[0].ID != "child1" || plan.Steps[0].Children[0].Kind != "call" {
		t.Fatalf("unexpected first child: %+v", plan.Steps[0].Children[0])
	}
	if plan.Steps[0].Children[1].ID != "child2" || plan.Steps[0].Children[1].Kind != "call" {
		t.Fatalf("unexpected second child: %+v", plan.Steps[0].Children[1])
	}
}

func TestCompilationNestedFor(t *testing.T) {
	doc, err := Parse([]byte(`
ows: 0.1.0
name: nested-for
do:
  steps:
    - id: outer
      for:
        each: item
        in: items
        do:
          steps:
            - id: inner
              if:
                expression: "true"
                then:
                  steps:
                    - call: process
`))
	if err != nil {
		t.Fatal(err)
	}

	plan, _, err := Compile(doc)
	if err != nil {
		t.Fatal(err)
	}

	if len(plan.Steps) != 1 || plan.Steps[0].Kind != "for" {
		t.Fatalf("expected 1 for step, got %+v", plan.Steps)
	}
	if len(plan.Steps[0].Children) != 1 || plan.Steps[0].Children[0].Kind != "if" {
		t.Fatalf("expected nested if step, got %+v", plan.Steps[0].Children)
	}
	if len(plan.Steps[0].Children[0].Children) != 1 || plan.Steps[0].Children[0].Children[0].Kind != "call" {
		t.Fatalf("expected nested call step, got %+v", plan.Steps[0].Children[0].Children)
	}
}

func TestCompilationForkPlan(t *testing.T) {
	doc, err := Parse([]byte(`
ows: 0.1.0
name: fork-plan
do:
  steps:
    - id: parallel
      fork:
        - steps:
            - call: worker-a
        - steps:
            - call: worker-b
            - call: worker-c
`))
	if err != nil {
		t.Fatal(err)
	}

	plan, profile, err := Compile(doc)
	if err != nil {
		t.Fatal(err)
	}

	if profile.Profile != "protocol" {
		t.Fatalf("expected protocol profile for fork, got %q", profile.Profile)
	}
	if len(plan.Steps) != 1 || plan.Steps[0].Kind != "fork" {
		t.Fatalf("expected 1 fork step, got %+v", plan.Steps)
	}
	if len(plan.Steps[0].Children) != 3 {
		t.Fatalf("expected 3 children across fork branches, got %d", len(plan.Steps[0].Children))
	}
}

func TestCompilationTryCatchPlan(t *testing.T) {
	doc, err := Parse([]byte(`
ows: 0.1.0
name: try-catch
do:
  steps:
    - id: guarded
      try:
        try:
          steps:
            - call: risky
        catch:
          - errors: ["Error"]
            do:
              steps:
                - call: fallback
`))
	if err != nil {
		t.Fatal(err)
	}

	plan, _, err := Compile(doc)
	if err != nil {
		t.Fatal(err)
	}

	if len(plan.Steps) != 1 || plan.Steps[0].Kind != "try" {
		t.Fatalf("expected 1 try step, got %+v", plan.Steps)
	}
	if len(plan.Steps[0].Children) != 2 {
		t.Fatalf("expected 2 children (try body + catch), got %d", len(plan.Steps[0].Children))
	}
	if plan.Steps[0].Children[0].Kind != "call" || plan.Steps[0].Children[1].Kind != "call" {
		t.Fatalf("expected call children, got %+v", plan.Steps[0].Children)
	}
}

func TestCompilationInvalidNilDocument(t *testing.T) {
	_, _, err := Compile(nil)
	if err == nil {
		t.Fatal("expected error for nil document")
	}
}

func TestCompilationInvalidEmptyName(t *testing.T) {
	doc := &Document{Do: &Block{}}
	_, _, err := Compile(doc)
	if err == nil {
		t.Fatal("expected error for empty name")
	}
}

func TestCompilationInvalidMissingDo(t *testing.T) {
	doc := &Document{Name: "test"}
	_, _, err := Compile(doc)
	if err == nil {
		t.Fatal("expected error for missing do")
	}
}
