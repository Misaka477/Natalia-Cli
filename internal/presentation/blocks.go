package presentation

type BlockType string

const (
	BlockContent      BlockType = "content"
	BlockToolCall     BlockType = "tool_call"
	BlockThinking     BlockType = "thinking"
	BlockNotification BlockType = "notification"
	BlockSpinner      BlockType = "spinner"
	BlockStatus       BlockType = "status"
	BlockApproval     BlockType = "approval"
	BlockQuestion     BlockType = "question"
	BlockRetry        BlockType = "retry"
	BlockWorkflow     BlockType = "workflow"
	BlockAgent        BlockType = "agent"
	BlockPTY          BlockType = "pty"
	BlockSandbox      BlockType = "sandbox"
)

type Block struct {
	Type          BlockType     `json:"type"`
	ID            string        `json:"id"`
	CorrelationID CorrelationID `json:"cid,omitempty"`
	Data          any           `json:"data,omitempty"`
	Active        bool          `json:"active,omitempty"`
	Finalized     bool          `json:"finalized,omitempty"`
}

type BlockBuilder struct{}

func NewBlockBuilder() *BlockBuilder {
	return &BlockBuilder{}
}

func (b *BlockBuilder) BuildBlocks(state *State) []Block {
	if state == nil || !state.ActiveTurn {
		return nil
	}

	var blocks []Block

	if state.IsCompacting {
		blocks = append(blocks, Block{
			Type:   BlockSpinner,
			ID:     "compaction",
			Data:   "Compacting context...",
			Active: true,
		})
		return blocks
	}

	if state.IsRetrying {
		blocks = append(blocks, Block{
			Type:   BlockRetry,
			ID:     "retry",
			Data:   RetryBeginPayload{Attempt: state.RetryCount + 1, LastError: state.Status["last_error"]},
			Active: true,
		})
	}

	for i, a := range state.PendingApprovals {
		blocks = append(blocks, Block{
			Type:   BlockApproval,
			ID:     "approval-" + a.ID,
			Data:   a,
			Active: i == 0 && !state.IsRetrying,
		})
	}

	for i, q := range state.PendingQuestions {
		blocks = append(blocks, Block{
			Type:   BlockQuestion,
			ID:     "question-" + q.ID,
			Data:   q,
			Active: i == 0 && !state.IsRetrying && len(state.PendingApprovals) == 0,
		})
	}

	if state.ActiveWorkflow != "" {
		blocks = append(blocks, Block{
			Type:   BlockWorkflow,
			ID:     "workflow-" + state.ActiveWorkflow,
			Data:   state.WorkflowSteps,
			Active: len(blocks) == 0,
		})
	}

	if state.ActivePTY != "" {
		blocks = append(blocks, Block{
			Type:   BlockPTY,
			ID:     "pty-" + state.ActivePTY,
			Data:   PTYOutputPayload{Output: lastOutput(state.PTYOutput), More: len(state.PTYOutput) > 0},
			Active: len(blocks) == 0,
		})
	}

	if state.ActiveSandbox != "" {
		blocks = append(blocks, Block{
			Type:   BlockSandbox,
			ID:     "sandbox-" + state.ActiveSandbox,
			Data:   state.ActiveSandbox,
			Active: len(blocks) == 0,
		})
	}

	if state.ActiveTool != "" {
		blocks = append(blocks, Block{
			Type:   BlockToolCall,
			ID:     "tool-" + state.ActiveTool,
			Data:   state.ActiveTool,
			Active: len(blocks) == 0,
		})
	}

	if state.CurrentStep != "" {
		blocks = append(blocks, Block{
			Type:   BlockStatus,
			ID:     "step-" + state.CurrentStep,
			Data:   state.CurrentStep,
			Active: len(blocks) == 0,
		})
	}

	if state.ActiveAgentDepth > 0 {
		blocks = append(blocks, Block{
			Type:   BlockAgent,
			ID:     "agent",
			Data:   state.ActiveAgentDepth,
			Active: len(blocks) == 0,
		})
	}

	return blocks
}

func (b *BlockBuilder) BuildActiveBlock(state *State) *Block {
	blocks := b.BuildBlocks(state)
	if len(blocks) == 0 {
		return nil
	}
	for i := range blocks {
		if blocks[i].Active {
			return &blocks[i]
		}
	}
	return &blocks[0]
}

func lastOutput(outputs []string) string {
	if len(outputs) == 0 {
		return ""
	}
	return outputs[len(outputs)-1]
}
