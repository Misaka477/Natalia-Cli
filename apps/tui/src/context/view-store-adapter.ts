/**
 * Adapter from `@natalia/view-store`'s projection to the TUI's display shape.
 *
 * `view-store` deliberately carries only runtime facts — a tool's name, status,
 * raw arguments, metadata and timings — and leaves presentation to
 * `@natalia/ui-model`. The TUI renders a richer `ToolBlockState` with a classified
 * kind, a formatted elapsed label, redacted key arguments and a collapsed result
 * view, and its transcript rows are derived from projected rows through here.
 *
 * This is the whole of the TUI's conversation display logic: everything it shows
 * about a turn is a function of what the shared layer projected, which is what
 * makes a second UI able to reproduce this one.
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
import type {
  AppState as ViewState,
  MessageBlock as ViewMessageBlock,
  ToolBlock,
} from "@natalia/view-store";
import type { MessageBlock, ToolBlockState } from "./state";

/** Result view budget the TUI uses when collapsing tool output. */
const resultLines = 8;
const resultChars = 1200;

/**
 * The tool row's rendered line.
 *
 * Presentation, which is why it lives here rather than in the projection: the
 * shared layer carries a tool's facts and each consumer renders the line it
 * wants. This one is the TUI's.
 */
export function toolText(tool: ToolBlockState) {
  const args = tool.argumentsComplete
    ? tool.keyArguments.join(" ") || "arguments ready"
    : "receiving arguments";
  const elapsed = tool.elapsed ? ` · ${tool.elapsed}` : "";
  const summary = tool.result ? tool.result.summary : tool.summary;
  return `${tool.kind}:${tool.name} ${args} · ${summary}${elapsed}`;
}

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
 * Derived tool views, keyed by the projected fact they were derived from.
 *
 * This is about render churn, not reducer cost: the transcript is re-derived on
 * every event, and a fresh `ToolBlockState` each time would replace the `tool` of
 * every tool row in the transcript on every keystroke of streamed text, so a
 * renderer that reconciles by identity would re-render every tool card in view
 * for output belonging to none of them. The projection replaces a tool's object
 * when it changes and leaves it alone otherwise, so object identity is an exact
 * change signal. Weak keys mean an evicted row's entry goes with it.
 *
 * (The reducer is comfortably inside its frame budget either way — `perf.test.ts`
 * still passes with this disabled — so the cost claim is deliberately not made.)
 *
 * Only the default budget is cached: a caller passing an explicit `now` is asking
 * for a specific elapsed label, not for whatever was computed earlier.
 */
const derivedTools = new WeakMap<ToolBlock, ToolBlockState>();

function derivedTool(
  id: string,
  tool: ToolBlock,
  now?: number,
): ToolBlockState {
  if (now !== undefined) return toolBlockFromProjection(id, tool, now);
  const cached = derivedTools.get(tool);
  if (cached && cached.id === id) return cached;
  const derived = toolBlockFromProjection(id, tool);
  derivedTools.set(tool, derived);
  return derived;
}

/**
 * Maps one projected row into the TUI's block shape.
 *
 * Roles line up one to one; the TUI's extra roles (`approval`, `question`,
 * `subagent`, `snapshot`) come from its own inline narration, which `view-store`
 * exposes structurally instead and a consumer renders where it likes.
 *
 * `providerPolicy` is the TUI's own name for what the projection reports as
 * `reasoningVisible`, and it is the field the reasoning row's "provider-safe"
 * marker is rendered from.
 */
export function messageBlockFromProjection(
  block: ViewMessageBlock,
  now?: number,
): MessageBlock {
  const shared = {
    id: block.id,
    role: block.role,
    owner: "projection" as const,
    pendingText: block.pendingText,
    status: block.status,
    reasoningVisible: block.reasoningVisible,
    ...(block.role === "thinking" || block.role === "assistant"
      ? {
          providerPolicy:
            block.reasoningVisible === false
              ? ("hidden" as const)
              : ("visible" as const),
        }
      : {}),
  };
  if (!block.tool) return { ...shared, text: block.text };
  const tool = derivedTool(block.id, block.tool, now);
  return {
    ...shared,
    // A tool row's text is its rendered line, not the runtime's raw summary.
    text: toolText(tool),
    tool,
  };
}

/** Maps the projected transcript into the TUI's block shape. */
export function messageBlocksFromProjection(
  state: ViewState,
  now?: number,
): MessageBlock[] {
  return state.messages.map((block) => messageBlockFromProjection(block, now));
}
