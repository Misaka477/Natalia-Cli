package compaction

import (
	"fmt"
	"strings"

	"github.com/aquama/natalia-cli/internal/chat"
	"github.com/aquama/natalia-cli/internal/llm"
)

const COMPACT_PROMPT = `The above is a list of messages in an agent conversation. You are now given a task to compact this conversation context according to specific priorities and rules.

**Compression Priorities (in order):**
1. **Current Task State**: What is being worked on RIGHT NOW
2. **Errors & Solutions**: All encountered errors and their resolutions
3. **Code Evolution**: Final working versions only (remove intermediate attempts)
4. **System Context**: Project structure, dependencies, environment setup
5. **Design Decisions**: Architectural choices and their rationale
6. **TODO Items**: Unfinished tasks and known issues

**Compression Rules:**
- MUST KEEP: Error messages, stack traces, working solutions, current task
- MERGE: Similar discussions into single summary points
- REMOVE: Redundant explanations, failed attempts (keep lessons learned), verbose comments
- CONDENSE: Long code blocks -> keep signatures + key logic only

**Special Handling:**
- For code: Keep full version if < 20 lines, otherwise keep signature + key logic
- For errors: Keep full error message + final solution
- For discussions: Extract decisions and action items only

**Required Output Structure:**

<current_focus>
[What we're working on now]
</current_focus>

<environment>
- [Key setup/config points]
</environment>

<completed_tasks>
- [Task]: [Brief outcome]
</completed_tasks>

<active_issues>
- [Issue]: [Status/Next steps]
</active_issues>

<code_state>
<file>
[filename]
**Summary:**
[What this code file does]
**Key elements:**
- [Important functions/classes]
**Latest version:**
[Critical code snippets]
</file>
</code_state>

<important_context>
- [Any crucial information not covered above]
</important_context>`

func ShouldCompact(tokenCount, maxContext int, triggerRatio float64, reservedTokens int) bool {
	return tokenCount >= int(float64(maxContext)*triggerRatio) ||
		tokenCount+reservedTokens >= maxContext
}

func EstimateTokens(messages []chat.Message) int {
	total := 0
	for _, msg := range messages {
		total += len(msg.Content) / 4
	}
	return total
}

type PrepareResult struct {
	CompactMsg *chat.Message
	ToPreserve []chat.Message
	ToCompact  []chat.Message
}

type CompactionResult struct {
	Messages           []chat.Message
	EstimatedTokens    int
}

type SimpleCompaction struct {
	MaxPreservedMessages int
}

func NewSimpleCompaction() *SimpleCompaction {
	return &SimpleCompaction{MaxPreservedMessages: 2}
}

func (sc *SimpleCompaction) Prepare(messages []chat.Message) PrepareResult {
	if len(messages) == 0 || sc.MaxPreservedMessages <= 0 {
		return PrepareResult{ToPreserve: messages}
	}

	preserveStart := len(messages)
	nPreserved := 0
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == chat.RoleUser || messages[i].Role == chat.RoleAssistant {
			nPreserved++
			if nPreserved == sc.MaxPreservedMessages {
				preserveStart = i
				break
			}
		}
	}

	if nPreserved < sc.MaxPreservedMessages {
		return PrepareResult{ToPreserve: messages}
	}

	toCompact := messages[:preserveStart]
	toPreserve := messages[preserveStart:]

	if len(toCompact) == 0 {
		return PrepareResult{ToPreserve: toPreserve}
	}

	var b strings.Builder
	for i, msg := range toCompact {
		b.WriteString(fmt.Sprintf("## Message %d\nRole: %s\nContent:\n%s\n", i+1, msg.Role, msg.Content))
	}
	b.WriteString("\n" + COMPACT_PROMPT)

	compactMsg := &chat.Message{
		Role:    chat.RoleUser,
		Content: b.String(),
	}

	return PrepareResult{
		CompactMsg: compactMsg,
		ToPreserve: toPreserve,
		ToCompact:  toCompact,
	}
}

func (sc *SimpleCompaction) Compact(messages []chat.Message, llmClient *llm.Client) (*CompactionResult, error) {
	prep := sc.Prepare(messages)
	if prep.CompactMsg == nil {
		return &CompactionResult{Messages: prep.ToPreserve}, nil
	}

	ctx := chat.NewContext(32000, 1)
	ctx.Messages = append(ctx.Messages, *prep.CompactMsg)

	systemMsg := chat.Message{
		Role:    chat.RoleSystem,
		Content: "You are a helpful assistant that compacts conversation context.",
	}
	ctx.Messages = append([]chat.Message{systemMsg}, ctx.Messages...)

	msg, usage, err := llmClient.Chat(ctx, nil, false)
	if err != nil {
		return nil, fmt.Errorf("compaction LLM call failed: %w", err)
	}

	summaryMsg := chat.Message{
		Role:    chat.RoleUser,
		Content: "Previous context has been compacted. Here is the compaction summary:\n" + msg.Content,
	}

	result := []chat.Message{summaryMsg}
	result = append(result, prep.ToPreserve...)

	estimatedTokens := 0
	if usage != nil {
		estimatedTokens = usage.CompletionTokens + EstimateTokens(prep.ToPreserve)
	} else {
		estimatedTokens = EstimateTokens(result)
	}

	return &CompactionResult{
		Messages:        result,
		EstimatedTokens: estimatedTokens,
	}, nil
}
