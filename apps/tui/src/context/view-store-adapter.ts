/**
 * Adapter from `@natalia/view-store`'s projection to the TUI's display shape.
 *
 * This is the seam the P6 convergence needs. `view-store` deliberately carries
 * only runtime facts — a tool's name, status, raw arguments, metadata and
 * timings — and leaves presentation to `@natalia/ui-model`. The TUI renders a
 * richer `ToolBlockState` with a classified kind, a formatted elapsed label,
 * redacted key arguments and a collapsed result view.
 *
 * Everything the TUI needs is derivable from what `view-store` already projects,
 * which is what makes the convergence possible at all. This module proves that
 * by doing the derivation, and `view-store-adapter.test.tsx` pins it against the
 * TUI's own reducer output so the swap can be made mechanically rather than
 * hopefully.
 *
 * It is intentionally a pure function of projected state: no events, no I/O, no
 * runtime access.
 */
import {
  classifyTool,
  elapsedLabel,
  parseToolArguments,
  resultView,
  type ToolStatus,
} from "@natalia/ui-model";
import type { AppState as ViewState, ToolBlock } from "@natalia/view-store";
import { toolText, type MessageBlock, type ToolBlockState } from "./state";

/** Result view budget the TUI uses when collapsing tool output. */
const resultLines = 8;
const resultChars = 1200;

export function toolBlockFromProjection(
  id: string,
  tool: ToolBlock,
  now?: number,
): ToolBlockState {
  const kind = classifyTool(tool.name, tool.metadata);
  const args = parseToolArguments(tool.argumentsRaw);
  const result =
    tool.result === undefined
      ? undefined
      : resultView(tool.result, resultLines, resultChars, {
          kind,
          name: tool.name,
        });
  return {
    id,
    name: tool.name,
    kind,
    status: tool.status as ToolStatus,
    summary: tool.summary,
    argumentsRaw: tool.argumentsRaw,
    argumentsComplete: args.complete,
    keyArguments: args.keyArguments,
    redactedArguments: args.redactedJson,
    elapsed: elapsedLabel(tool.startedAt, tool.endedAt, now),
    result,
    metadata: tool.metadata ?? {},
    detailAvailable: Boolean(args.redactedJson || result?.detail),
  };
}

/**
 * Maps the projected transcript into the TUI's block shape.
 *
 * Roles line up one to one; the TUI's extra roles (`approval`, `question`,
 * `subagent`, `snapshot`) come from its own inline narration, which `view-store`
 * exposes structurally instead and a consumer renders where it likes.
 */
export function messageBlocksFromProjection(
  state: ViewState,
  now?: number,
): MessageBlock[] {
  return state.messages.map((block) => {
    if (!block.tool)
      return {
        id: block.id,
        role: block.role,
        text: block.text,
        pendingText: block.pendingText,
        status: block.status,
        reasoningVisible: block.reasoningVisible,
      };
    const tool = toolBlockFromProjection(block.id, block.tool, now);
    return {
      id: block.id,
      role: block.role,
      // A tool row's text is its rendered line, not the runtime's raw summary.
      // Reusing the TUI's own formatter is what makes this a faithful adapter.
      text: toolText(tool),
      pendingText: block.pendingText,
      status: block.status,
      reasoningVisible: block.reasoningVisible,
      tool,
    };
  });
}
