package presentation

import (
	"testing"
)

func TestBuildBlocks_NilState(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(nil)
	if len(blocks) != 0 {
		t.Fatalf("expected 0 blocks for nil state, got %d", len(blocks))
	}
}

func TestBuildBlocks_NoActiveTurn(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{ActiveTurn: false})
	if len(blocks) != 0 {
		t.Fatalf("expected 0 blocks for inactive turn, got %d", len(blocks))
	}
}

func TestBuildBlocks_Compaction(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{ActiveTurn: true, IsCompacting: true})
	if len(blocks) != 1 {
		t.Fatalf("expected 1 block for compaction, got %d", len(blocks))
	}
	if blocks[0].Type != BlockSpinner {
		t.Fatalf("expected BlockSpinner, got %s", blocks[0].Type)
	}
	if !blocks[0].Active {
		t.Fatal("expected compaction block to be active")
	}
}

func TestBuildBlocks_CompactionIsExclusive(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{
		ActiveTurn:   true,
		IsCompacting: true,
		IsRetrying:   true,
		ActiveTool:   "read",
		CurrentStep:  "step1",
	})
	if len(blocks) != 1 {
		t.Fatalf("expected only compaction block, got %d", len(blocks))
	}
	if blocks[0].Type != BlockSpinner {
		t.Fatalf("expected BlockSpinner, got %s", blocks[0].Type)
	}
}

func TestBuildBlocks_Retry(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{ActiveTurn: true, IsRetrying: true, RetryCount: 1})
	if len(blocks) != 1 {
		t.Fatalf("expected 1 block for retry, got %d", len(blocks))
	}
	if blocks[0].Type != BlockRetry {
		t.Fatalf("expected BlockRetry, got %s", blocks[0].Type)
	}
	if !blocks[0].Active {
		t.Fatal("expected retry block to be active")
	}
	data, ok := blocks[0].Data.(RetryBeginPayload)
	if !ok {
		t.Fatal("expected RetryBeginPayload data")
	}
	if data.Attempt != 2 {
		t.Fatalf("expected attempt 2 (RetryCount+1), got %d", data.Attempt)
	}
}

func TestBuildBlocks_Approval(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{
		ActiveTurn: true,
		PendingApprovals: []ApprovalRequestPayload{
			{ID: "a1", ToolName: "write_file"},
			{ID: "a2", ToolName: "run_shell"},
		},
	})
	if len(blocks) != 2 {
		t.Fatalf("expected 2 approval blocks, got %d", len(blocks))
	}
	if blocks[0].Type != BlockApproval || blocks[1].Type != BlockApproval {
		t.Fatalf("expected both blocks to be BlockApproval, got %s, %s", blocks[0].Type, blocks[1].Type)
	}
	if !blocks[0].Active {
		t.Fatal("expected first approval block to be active")
	}
	if blocks[1].Active {
		t.Fatal("expected second approval block to not be active")
	}
}

func TestBuildBlocks_Question(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{
		ActiveTurn: true,
		PendingQuestions: []QuestionRequestPayload{
			{ID: "q1"},
		},
	})
	if len(blocks) != 1 {
		t.Fatalf("expected 1 question block, got %d", len(blocks))
	}
	if blocks[0].Type != BlockQuestion {
		t.Fatalf("expected BlockQuestion, got %s", blocks[0].Type)
	}
	if !blocks[0].Active {
		t.Fatal("expected question block to be active")
	}
}

func TestBuildBlocks_Workflow(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{
		ActiveTurn:     true,
		ActiveWorkflow: "wf1",
	})
	if len(blocks) != 1 {
		t.Fatalf("expected 1 workflow block, got %d", len(blocks))
	}
	if blocks[0].Type != BlockWorkflow {
		t.Fatalf("expected BlockWorkflow, got %s", blocks[0].Type)
	}
}

func TestBuildBlocks_PTY(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{
		ActiveTurn: true,
		ActivePTY:  "pty1",
		PTYOutput:  []string{"line1", "line2"},
	})
	if len(blocks) != 1 {
		t.Fatalf("expected 1 PTY block, got %d", len(blocks))
	}
	if blocks[0].Type != BlockPTY {
		t.Fatalf("expected BlockPTY, got %s", blocks[0].Type)
	}
	data, ok := blocks[0].Data.(PTYOutputPayload)
	if !ok {
		t.Fatal("expected PTYOutputPayload data")
	}
	if data.Output != "line2" {
		t.Fatalf("expected last output line 'line2', got %q", data.Output)
	}
}

func TestBuildBlocks_Sandbox(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{
		ActiveTurn:    true,
		ActiveSandbox: "sb1",
	})
	if len(blocks) != 1 {
		t.Fatalf("expected 1 sandbox block, got %d", len(blocks))
	}
	if blocks[0].Type != BlockSandbox {
		t.Fatalf("expected BlockSandbox, got %s", blocks[0].Type)
	}
}

func TestBuildBlocks_ToolCall(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{
		ActiveTurn: true,
		ActiveTool: "read_file",
	})
	if len(blocks) != 1 {
		t.Fatalf("expected 1 tool call block, got %d", len(blocks))
	}
	if blocks[0].Type != BlockToolCall {
		t.Fatalf("expected BlockToolCall, got %s", blocks[0].Type)
	}
	if !blocks[0].Active {
		t.Fatal("expected tool call block to be active")
	}
	data, ok := blocks[0].Data.(string)
	if !ok || data != "read_file" {
		t.Fatalf("expected data 'read_file', got %v", blocks[0].Data)
	}
}

func TestBuildBlocks_CurrentStep(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{
		ActiveTurn:  true,
		CurrentStep: "step3",
	})
	if len(blocks) != 1 {
		t.Fatalf("expected 1 step block, got %d", len(blocks))
	}
	if blocks[0].Type != BlockStatus {
		t.Fatalf("expected BlockStatus, got %s", blocks[0].Type)
	}
	data, ok := blocks[0].Data.(string)
	if !ok || data != "step3" {
		t.Fatalf("expected data 'step3', got %v", blocks[0].Data)
	}
}

func TestBuildBlocks_AgentDepth(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{
		ActiveTurn:       true,
		ActiveAgentDepth: 2,
	})
	if len(blocks) != 1 {
		t.Fatalf("expected 1 agent block, got %d", len(blocks))
	}
	if blocks[0].Type != BlockAgent {
		t.Fatalf("expected BlockAgent, got %s", blocks[0].Type)
	}
	data, ok := blocks[0].Data.(int)
	if !ok || data != 2 {
		t.Fatalf("expected data 2, got %v", blocks[0].Data)
	}
}

func TestBuildBlocks_ReturnsEmptyForNilState(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(nil)
	if blocks != nil {
		t.Fatal("expected nil for nil state")
	}
}

func TestBuildBlocks_PriorityOrdering(t *testing.T) {
	b := NewBlockBuilder()
	blocks := b.BuildBlocks(&State{
		ActiveTurn: true,
		PendingApprovals: []ApprovalRequestPayload{
			{ID: "a1", ToolName: "write"},
		},
		PendingQuestions: []QuestionRequestPayload{
			{ID: "q1"},
		},
		ActiveWorkflow:   "wf1",
		ActivePTY:        "pty1",
		ActiveSandbox:    "sb1",
		ActiveTool:       "read",
		CurrentStep:      "step2",
		ActiveAgentDepth: 1,
	})

	expectedTypes := []BlockType{BlockApproval, BlockQuestion, BlockWorkflow, BlockPTY, BlockSandbox, BlockToolCall, BlockStatus, BlockAgent}
	if len(blocks) != len(expectedTypes) {
		t.Fatalf("expected %d blocks, got %d", len(expectedTypes), len(blocks))
	}
	for i, typ := range expectedTypes {
		if blocks[i].Type != typ {
			t.Fatalf("block[%d]: expected %s, got %s", i, typ, blocks[i].Type)
		}
	}
	if !blocks[0].Active {
		t.Fatal("expected first block (approval) to be active")
	}
}

func TestBuildActiveBlock_ReturnsActiveBlock(t *testing.T) {
	b := NewBlockBuilder()
	block := b.BuildActiveBlock(&State{
		ActiveTurn: true,
		ActiveTool: "read",
	})
	if block == nil {
		t.Fatal("expected non-nil active block")
	}
	if block.Type != BlockToolCall {
		t.Fatalf("expected BlockToolCall, got %s", block.Type)
	}
	if !block.Active {
		t.Fatal("expected active block to be marked active")
	}
}

func TestBuildActiveBlock_ReturnsNilForInactiveTurn(t *testing.T) {
	b := NewBlockBuilder()
	block := b.BuildActiveBlock(&State{ActiveTurn: false})
	if block != nil {
		t.Fatal("expected nil for inactive turn")
	}
}

func TestBuildActiveBlock_ReturnsNilForNilState(t *testing.T) {
	b := NewBlockBuilder()
	block := b.BuildActiveBlock(nil)
	if block != nil {
		t.Fatal("expected nil for nil state")
	}
}
