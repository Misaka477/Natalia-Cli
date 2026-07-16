package workflow

import (
	"os"
	"testing"
)

func TestParseMinimalWorkflow(t *testing.T) {
	doc, err := Parse([]byte(`
ows: 0.1.0
name: hello
do:
  steps:
    - id: greet
      call: say-hello
`))
	if err != nil {
		t.Fatal(err)
	}
	if doc.OWSVersion != "0.1.0" {
		t.Fatalf("expected ows 0.1.0, got %q", doc.OWSVersion)
	}
	if doc.Name != "hello" {
		t.Fatalf("expected name hello, got %q", doc.Name)
	}
	if doc.Do == nil || len(doc.Do.Steps) != 1 {
		t.Fatalf("expected 1 step, got %d steps", len(doc.Do.Steps))
	}
	if doc.Do.Steps[0].ID != "greet" || doc.Do.Steps[0].Call == nil || doc.Do.Steps[0].Call.Call != "say-hello" {
		t.Fatalf("unexpected step: %+v", doc.Do.Steps[0])
	}
}

func TestParseFullWorkflow(t *testing.T) {
	yaml := `
ows: 0.1.0
namespace: com.example
name: full-demo
version: "1.0"
metadata:
  author: test
  purpose: demo
input:
  type: object
  properties:
    name:
      type: string
  required:
    - name
output:
  type: object
  properties:
    result:
      type: string
constants:
  maxRetries: 3
  baseUrl: https://api.example.com
do:
  steps:
    - id: init
      description: Initialize context
      set:
        target: context.count
        value: 0

    - id: decide
      description: Branch on input
      if:
        expression: input.name != ""
        then:
          steps:
            - call: process-name
              with:
                name: "{{input.name}}"
        else:
          steps:
            - call: use-default

    - id: loop
      description: Retry loop
      for:
        each: attempt
        in: "[1,2,3]"
        do:
          steps:
            - id: try-step
              try:
                try:
                  steps:
                    - call: risky-operation
                catch:
                  - errors: ["Timeout"]
                    do:
                      steps:
                        - wait:
                            duration: 1s
    - id: parallel
      description: Fork into parallel tracks
      fork:
        - steps:
            - call: track-a
        - steps:
            - call: track-b

    - id: branching
      description: Switch on status
      switch:
        expression: context.status
        cases:
          - match: ok
            do:
              steps:
                - call: on-success
          - match: fail
            do:
              steps:
                - call: on-failure
        default:
          steps:
            - call: on-unknown

    - id: cleanup
      description: Export result
      export:
        target: result
        value: "{{context.output}}"
`
	doc, err := Parse([]byte(yaml))
	if err != nil {
		t.Fatal(err)
	}
	if doc.Namespace != "com.example" {
		t.Fatalf("namespace mismatch: %q", doc.Namespace)
	}
	if doc.Version != "1.0" {
		t.Fatalf("version mismatch: %q", doc.Version)
	}
	if doc.Metadata["author"] != "test" {
		t.Fatalf("metadata mismatch")
	}
	if len(doc.Do.Steps) != 6 {
		t.Fatalf("expected 6 steps, got %d", len(doc.Do.Steps))
	}

	if doc.Do.Steps[0].Set == nil {
		t.Fatal("step 0 expected set action")
	}
	if doc.Do.Steps[1].If == nil {
		t.Fatal("step 1 expected if action")
	}
	if doc.Do.Steps[2].For == nil {
		t.Fatal("step 2 expected for action")
	}
	if len(doc.Do.Steps[3].Fork) != 2 {
		t.Fatal("step 3 expected fork with 2 branches")
	}
	if doc.Do.Steps[4].Switch == nil {
		t.Fatal("step 4 expected switch action")
	}
	if doc.Do.Steps[5].Export == nil {
		t.Fatal("step 5 expected export action")
	}

	if doc.Do.Steps[2].For.Do == nil || len(doc.Do.Steps[2].For.Do.Steps) != 1 {
		t.Fatal("for action expected nested do block")
	}
	tryStep := doc.Do.Steps[2].For.Do.Steps[0]
	if tryStep.Try == nil || tryStep.Try.Try == nil {
		t.Fatal("for step expected try action")
	}
	if len(tryStep.Try.Catch) != 1 || tryStep.Try.Catch[0].Do == nil {
		t.Fatal("try expected catch block")
	}

	if doc.Do.Steps[4].Switch.Expression != "context.status" {
		t.Fatalf("switch expression mismatch: %q", doc.Do.Steps[4].Switch.Expression)
	}
	if len(doc.Do.Steps[4].Switch.Cases) != 2 {
		t.Fatalf("switch expected 2 cases, got %d", len(doc.Do.Steps[4].Switch.Cases))
	}
	if doc.Do.Steps[4].Switch.Default == nil {
		t.Fatal("switch expected default block")
	}
}

func TestParseTypedInputOutput(t *testing.T) {
	doc, err := Parse([]byte(`
ows: 0.1.0
name: typed
input:
  type: object
  properties:
    userId:
      type: string
    count:
      type: integer
  required:
    - userId
output:
  type: object
  properties:
    result:
      type: array
      items:
        type: string
do:
  steps:
    - call: process
`))
	if err != nil {
		t.Fatal(err)
	}
	if doc.Input == nil || doc.Input.Type != "object" {
		t.Fatal("expected input object type")
	}
	if doc.Input.Properties["userId"].Type != "string" {
		t.Fatal("expected userId type string")
	}
	if doc.Input.Properties["count"].Type != "integer" {
		t.Fatal("expected count type integer")
	}
	if len(doc.Input.Required) != 1 || doc.Input.Required[0] != "userId" {
		t.Fatal("expected required userId")
	}
	if doc.Output == nil || doc.Output.Type != "object" {
		t.Fatal("expected output object type")
	}
	if doc.Output.Properties["result"].Type != "array" {
		t.Fatal("expected result type array")
	}
	if doc.Output.Properties["result"].Items == nil || doc.Output.Properties["result"].Items.Type != "string" {
		t.Fatal("expected array items type string")
	}
}

func TestParseInvalidDocumentMissingOWS(t *testing.T) {
	_, err := Parse([]byte(`name: no-version
do:
  steps: []
`))
	if err == nil {
		t.Fatal("expected error for missing ows version")
	}
}

func TestParseInvalidDocumentMissingName(t *testing.T) {
	_, err := Parse([]byte(`ows: 0.1.0
do:
  steps: []
`))
	if err == nil {
		t.Fatal("expected error for missing name")
	}
}

func TestParseInvalidDocumentMissingDo(t *testing.T) {
	_, err := Parse([]byte(`ows: 0.1.0
name: nodo
`))
	if err == nil {
		t.Fatal("expected error for missing do block")
	}
}

func TestParseFile(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/test.yaml"
	if err := os.WriteFile(path, []byte("ows: 0.1.0\nname: file-test\ndo:\n  steps:\n    - call: test\n"), 0644); err != nil {
		t.Fatal(err)
	}
	doc, err := ParseFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if doc.Name != "file-test" {
		t.Fatalf("expected name file-test, got %q", doc.Name)
	}
}
