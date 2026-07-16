package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/workflow"
)

func main() {
	data := []byte(`
ows: 1.0
name: manual-test
namespace: natalia
version: "1.0.0"
do:
  steps:
    - id: step1
      set:
        target: result
        value: "hello from M3"
    - id: step2
      call: echo
      with:
        msg: ${output.result}
    - id: step3
      try:
        try:
          steps:
            - id: step3a
              call: shell.exec
              with:
                cmd: echo "in try block"
        catch:
          - errors: ["*"]
            do:
              steps:
                - id: step3b
                  call: shell.exec
                  with:
                    cmd: echo "caught error"
`)

	doc, err := workflow.Parse(data)
	if err != nil {
		fmt.Fprintf(os.Stderr, "PARSE ERROR: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Document: %s/%s v%s\n", doc.Namespace, doc.Name, doc.Version)

	plan, profile, err := workflow.Compile(doc)
	if err != nil {
		fmt.Fprintf(os.Stderr, "COMPILE ERROR: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Plan: %d root steps, profile=%s\n", len(plan.Steps), profile.Profile)
	if len(profile.Unsupported) > 0 {
		fmt.Printf("Unsupported: %v\n", profile.Unsupported)
	}
	for _, step := range plan.Steps {
		fmt.Printf("  Step %s: %s\n", step.ID, step.Kind)
		if step.Kind == "try" && len(step.Children) > 0 {
			for _, c := range step.Children {
				fmt.Printf("    Child %s: %s\n", c.ID, c.Kind)
			}
		}
	}

	safety, err := workflow.DryRun(doc)
	if err != nil {
		fmt.Fprintf(os.Stderr, "DRY RUN ERROR: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("\nDry-run (%d steps):\n", len(safety.Steps))
	for _, s := range safety.Steps {
		fmt.Printf("  %s\n", s)
	}
	for _, se := range safety.SideEffects {
		fmt.Printf("  [side-effect] %s\n", se)
	}
	fmt.Printf("  sandbox=%v approval=%v\n", safety.Sandbox, safety.HasApproval)

	if len(plan.Steps) > 0 {
		store := workflow.NewMemoryEventStore()
		activity := func(ctx context.Context, step *workflow.PlanStep, input map[string]any) (any, error) {
			fmt.Printf("\nactivity %s executing\n", step.ID)
			return map[string]any{"result": "ok"}, nil
		}
		rt := workflow.NewRuntime(store, activity)
		run, err := rt.StartRun(context.Background(), doc, plan)
		if err != nil {
			fmt.Fprintf(os.Stderr, "RUN ERROR: %v\n", err)
			os.Exit(1)
		}
		events, _ := store.GetEvents(run.ID)
		fmt.Printf("\nRun %s: %s (%d events)\n", run.ID, run.Status, len(events))
		for _, e := range events {
			fmt.Printf("  %s: %s\n", e.Timestamp.Format(time.StampMilli), e.Type)
		}

		ev, err := store.GetLatest(run.ID)
		if err == nil {
			fmt.Printf("\nLast event: %s\n", ev.Type)
		}
	}

	fmt.Println("\n=== M3 MANUAL TEST PASSED ===")
}
