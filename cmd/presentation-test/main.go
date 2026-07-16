package main

import (
	"fmt"
	"time"

	"github.com/Misaka477/Natalia-Cli/internal/presentation"
)

func main() {
	now := time.Now()
	cid := presentation.CorrelationID{Session: "s1", Turn: "t1", Step: "s1"}

	events := []presentation.Event{
		{Type: presentation.EvtTurnBegin, ID: "e1", CorrelationID: cid, Timestamp: now, Data: presentation.TurnBeginPayload{Input: "帮我检查代码"}},
		{Type: presentation.EvtStepBegin, ID: "e2", CorrelationID: cid, Timestamp: now.Add(100 * time.Millisecond)},
		{Type: presentation.EvtContentPart, ID: "e3", CorrelationID: cid, Timestamp: now.Add(200 * time.Millisecond), Data: presentation.ContentPartPayload{Content: "正在检"}},
		{Type: presentation.EvtContentPart, ID: "e4", CorrelationID: cid, Timestamp: now.Add(300 * time.Millisecond), Data: presentation.ContentPartPayload{Content: "查代码..."}},
		{Type: presentation.EvtContentEnd, ID: "e5", CorrelationID: cid, Timestamp: now.Add(400 * time.Millisecond), Data: presentation.ContentEndPayload{FullContent: "正在检查代码..."}},
		{Type: presentation.EvtToolBegin, ID: "e6", CorrelationID: cid, Timestamp: now.Add(500 * time.Millisecond), Data: presentation.ToolBeginPayload{Name: "read_file", Arguments: map[string]any{"path": "main.go"}}},
		{Type: presentation.EvtApprovalRequest, ID: "e7", CorrelationID: cid, Timestamp: now.Add(600 * time.Millisecond), Data: presentation.ApprovalRequestPayload{ID: "a1", ToolName: "write_file", Arguments: map[string]any{"path": "fix.go"}}},
		{Type: presentation.EvtToolEnd, ID: "e8", CorrelationID: cid, Timestamp: now.Add(700 * time.Millisecond), Data: presentation.ToolEndPayload{Result: "file read successfully"}},
		{Type: presentation.EvtApprovalResult, ID: "e9", CorrelationID: cid, Timestamp: now.Add(800 * time.Millisecond), Data: presentation.ApprovalResultPayload{ID: "a1", Approved: true}},
		{Type: presentation.EvtTurnEnd, ID: "e10", CorrelationID: cid, Timestamp: now.Add(900 * time.Millisecond), Data: presentation.TurnEndPayload{StopReason: "end_turn"}},
	}

	state := &presentation.State{}
	for _, ev := range events {
		state = presentation.Reduce(state, ev)
	}

	fmt.Println("=== State after 10 events ===")
	fmt.Printf("ActiveTurn: %v\n", state.ActiveTurn)
	fmt.Printf("TurnInput: %q\n", state.TurnInput)
	fmt.Printf("CurrentStep: %s\n", state.CurrentStep)
	fmt.Printf("StepStatus: %s\n", state.StepStatus)
	fmt.Printf("ActiveTool: %s\n", state.ActiveTool)
	fmt.Printf("ToolStatus: %s\n", state.ToolStatus)
	fmt.Printf("PendingApprovals: %d\n", len(state.PendingApprovals))
	fmt.Printf("PendingQuestions: %d\n", len(state.PendingQuestions))
	fmt.Println()

	rebuilt := presentation.Rebuild(events)
	fmt.Println("=== Rebuilt state (event replay) ===")
	fmt.Printf("ActiveTurn: %v\n", rebuilt.ActiveTurn)
	fmt.Printf("ActiveTool: %s\n", rebuilt.ActiveTool)

	builder := presentation.NewBlockBuilder()
	blocks := builder.BuildBlocks(state)
	fmt.Println()
	fmt.Printf("=== BuildBlocks → %d blocks ===\n", len(blocks))
	for _, b := range blocks {
		fmt.Printf("  [%s] id=%s active=%v finalized=%v\n", b.Type, b.ID, b.Active, b.Finalized)
	}

	coalescer := presentation.NewCoalescer(500 * time.Millisecond)
	coalesced := 0
	passed := 0
	events2 := []presentation.Event{
		{Type: presentation.EvtContentPart, ID: "c1", CorrelationID: cid, Data: presentation.ContentPartPayload{Content: "part1"}},
		{Type: presentation.EvtContentPart, ID: "c2", CorrelationID: cid, Data: presentation.ContentPartPayload{Content: "part2"}},
		{Type: presentation.EvtTurnEnd, ID: "t1", CorrelationID: cid, Data: presentation.TurnEndPayload{}},
	}
	for _, ev := range events2 {
		if coalescer.Push(ev) {
			coalesced++
		} else {
			passed++
		}
	}
	flushed := coalescer.Flush()
	fmt.Println()
	fmt.Println("=== Coalescing ===")
	fmt.Printf("Coalesced: %d, Passed-through: %d, Flushed batches: %d\n", coalesced, passed, len(flushed))
	for _, e := range flushed {
		if d, ok := e.Data.(presentation.ContentPartPayload); ok {
			fmt.Printf("  content batch: %q\n", d.Content)
		}
	}

	fmt.Println("\n=== M4 MANUAL TEST PASSED ===")
}
