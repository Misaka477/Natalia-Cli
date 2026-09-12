/**
 * Shared request/surface token accounting used by compaction and context UI.
 *
 * The estimator is intentionally simple and deterministic: four characters per
 * token plus small structural overhead. Provider usage, when available, anchors
 * the current request; surface movement since that sample is repriced with the
 * same heuristic so compaction and context occupancy stay on one account.
 */

export const TOKEN_METER_CHARS_PER_TOKEN = 4;
export const TOKEN_METER_BLOCK_OVERHEAD = 4;
export const TOKEN_METER_ROLE_OVERHEAD = 4;

export interface ProviderUsageView {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface TokenMeterMessage {
  role?: string;
  content?: string | readonly unknown[];
  toolCalls?: readonly {
    id?: string;
    name?: string;
    arguments?: string;
    thoughtSignature?: string;
  }[];
  toolName?: string;
  toolCallID?: string;
}

export interface TokenMeasurement {
  /** Conservative request total: prompt envelope plus model-visible surface. */
  totalTokens: number;
  /** Heuristic tokens for system prompt plus tools. */
  headerTokens: number;
  /** Heuristic tokens for the model-visible message/tool surface. */
  surfaceTokens: number;
  /** Provider prompt-side sample: input plus cache reads/writes. */
  pressureTokens?: number;
  /**
   * Provider sample carried forward over surface movement since it was taken.
   * Present only after a provider usage sample and a surface observation.
   */
  projectedTokens?: number;
  /** Capacity of the route/model selected for this scope. */
  contextWindow?: number;
  source: "estimate" | "provider_usage";
}

interface ScopeState {
  surfaceTokens: number;
  sampledSurfaceTokens?: number;
  sampledHeaderKey?: string;
  pressureTokens?: number;
  usage?: ProviderUsageView;
  contextWindow?: number;
}

export function estimateTokenText(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(Array.from(text).length / TOKEN_METER_CHARS_PER_TOKEN);
}

function estimateUnknown(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "string") return estimateTokenText(value);
  try {
    return estimateTokenText(JSON.stringify(value) ?? "");
  } catch {
    return 0;
  }
}

function estimateToolCalls(calls: TokenMeterMessage["toolCalls"]): number {
  let tokens = 0;
  for (const call of calls ?? []) {
    tokens += estimateUnknown(call.id);
    tokens += estimateUnknown(call.name);
    tokens += estimateUnknown(call.arguments);
    tokens += TOKEN_METER_BLOCK_OVERHEAD;
  }
  return tokens;
}

function estimateContentBlocks(blocks: readonly unknown[]): number {
  let tokens = 0;
  for (const block of blocks) {
    if (block === null || block === undefined) continue;
    if (typeof block === "string") {
      tokens += estimateTokenText(block) + TOKEN_METER_BLOCK_OVERHEAD;
      continue;
    }
    const record = block as Record<string, unknown>;
    if (record.type === "text" && typeof record.text === "string") {
      tokens += estimateTokenText(record.text) + TOKEN_METER_BLOCK_OVERHEAD;
      continue;
    }
    if (record.type === "reasoning" && typeof record.text === "string") {
      tokens += estimateTokenText(record.text) + TOKEN_METER_BLOCK_OVERHEAD;
      continue;
    }
    if (record.type === "tool-call") {
      tokens +=
        estimateUnknown(record.name) + estimateUnknown(record.arguments);
      tokens += TOKEN_METER_BLOCK_OVERHEAD;
      continue;
    }
    if (record.type === "tool-result") {
      tokens += estimateContentBlocks(
        Array.isArray(record.content) ? record.content : [],
      );
      tokens += TOKEN_METER_BLOCK_OVERHEAD;
      continue;
    }
    tokens += TOKEN_METER_BLOCK_OVERHEAD + estimateUnknown(record);
  }
  return tokens;
}

export function estimateMeterMessage(message: TokenMeterMessage): number {
  let tokens = TOKEN_METER_ROLE_OVERHEAD;
  if (typeof message.content === "string") {
    tokens += estimateTokenText(message.content);
  } else if (Array.isArray(message.content)) {
    tokens += estimateContentBlocks(message.content);
  }
  tokens += estimateToolCalls(message.toolCalls);
  tokens += estimateUnknown(message.toolName);
  tokens += estimateUnknown(message.toolCallID);
  return tokens;
}

function usageTotal(usage: ProviderUsageView): number {
  return (
    usage.inputTokens +
    usage.outputTokens +
    (usage.cacheReadTokens ?? 0) +
    (usage.cacheWriteTokens ?? 0)
  );
}

function promptPressure(usage: ProviderUsageView): number {
  return (
    usage.inputTokens +
    (usage.cacheReadTokens ?? 0) +
    (usage.cacheWriteTokens ?? 0)
  );
}

function canonicalHeaderKey(
  system: string | undefined,
  tools: unknown,
): string {
  return JSON.stringify({ system: system ?? "", tools: tools ?? null });
}

/** Per-scope replay-aware request/surface token account. */
export class TokenMeter {
  private readonly states = new Map<string, ScopeState>();

  /** Estimate one provider message with the shared fixed heuristic. */
  estimateMessage(message: TokenMeterMessage): number {
    return estimateMeterMessage(message);
  }

  /** Estimate a complete request without mutating the scope's sampled anchor. */
  estimateRequest(input: {
    system?: string;
    tools?: unknown;
    messages: readonly TokenMeterMessage[];
  }): number {
    return (
      estimateTokenText(input.system ?? "") +
      estimateUnknown(input.tools) +
      this.estimateMessages(input.messages)
    );
  }

  /** Estimate only the model-visible message/tool surface. */
  estimateMessages(messages: readonly TokenMeterMessage[]): number {
    let tokens = 0;
    for (const message of messages) tokens += estimateMeterMessage(message);
    return tokens;
  }

  /** Record the latest observed surface without changing provider usage. */
  observeSurface(
    scope: string,
    messages: readonly TokenMeterMessage[],
  ): number {
    const state = this.state(scope);
    state.surfaceTokens = this.estimateMessages(messages);
    return state.surfaceTokens;
  }

  /** Record the current route/model capacity for one scope. */
  setContextWindow(scope: string, contextWindow: number | undefined): void {
    const state = this.state(scope);
    if (contextWindow === undefined || contextWindow <= 0) {
      state.contextWindow = undefined;
      return;
    }
    state.contextWindow = contextWindow;
  }

  /**
   * Record the exact provider usage sample of the request identified by
   * `headerKey` and `surfaceTokens`. Headers must match before usage is reused
   * by measureRequest; the projected view still carries the sample forward.
   */
  recordUsage(
    scope: string,
    usage: ProviderUsageView,
    options?: {
      headerKey?: string;
      surfaceTokens?: number;
    },
  ): void {
    const state = this.state(scope);
    state.usage = { ...usage };
    state.pressureTokens = promptPressure(usage);
    state.sampledSurfaceTokens = options?.surfaceTokens ?? state.surfaceTokens;
    state.sampledHeaderKey = options?.headerKey;
  }

  /**
   * Measure the request about to be sent for compaction.
   *
   * Exact provider usage is reused only when the sample's canonical header is
   * still current and its total is at least the current heuristic price. That
   * mirrors DSH's conservative anchor rule: stale or smaller samples never
   * make compaction believe the request is cheaper than the local estimate.
   */
  measureRequest(
    scope: string,
    input: {
      system?: string;
      tools?: unknown;
      messages: readonly TokenMeterMessage[];
      contextWindow?: number;
    },
  ): TokenMeasurement {
    const state = this.state(scope);
    state.surfaceTokens = this.estimateMessages(input.messages);
    if (input.contextWindow !== undefined)
      this.setContextWindow(scope, input.contextWindow);

    const headerTokens =
      estimateTokenText(input.system ?? "") + estimateUnknown(input.tools);
    const estimatedTotal = headerTokens + state.surfaceTokens;
    const headerKey = canonicalHeaderKey(input.system, input.tools);
    const exact =
      state.usage !== undefined &&
      state.sampledHeaderKey !== undefined &&
      state.sampledHeaderKey === headerKey
        ? usageTotal(state.usage)
        : undefined;
    const useProviderUsage = exact !== undefined && exact >= estimatedTotal;
    return {
      totalTokens: useProviderUsage ? exact : estimatedTotal,
      headerTokens,
      surfaceTokens: state.surfaceTokens,
      ...(state.pressureTokens === undefined
        ? {}
        : { pressureTokens: state.pressureTokens }),
      ...(this.projectedTokens(scope) === undefined
        ? {}
        : { projectedTokens: this.projectedTokens(scope) }),
      ...(state.contextWindow === undefined
        ? {}
        : { contextWindow: state.contextWindow }),
      source: useProviderUsage ? "provider_usage" : "estimate",
    };
  }

  /** Current UI-facing context projection for one scope. */
  project(scope: string): {
    pressureTokens?: number;
    projectedTokens?: number;
    contextWindow?: number;
    source: "estimate" | "provider_usage";
  } {
    const state = this.state(scope);
    return {
      ...(state.pressureTokens === undefined
        ? {}
        : { pressureTokens: state.pressureTokens }),
      ...(this.projectedTokens(scope) === undefined
        ? {}
        : { projectedTokens: this.projectedTokens(scope) }),
      ...(state.contextWindow === undefined
        ? {}
        : { contextWindow: state.contextWindow }),
      source: state.usage === undefined ? "estimate" : "provider_usage",
    };
  }

  /** Drop all per-scope accounting, e.g. after a session rollback. */
  clear(scope?: string): void {
    if (scope === undefined) this.states.clear();
    else this.states.delete(scope);
  }

  private projectedTokens(scope: string): number | undefined {
    const state = this.state(scope);
    if (
      state.pressureTokens === undefined ||
      state.sampledSurfaceTokens === undefined
    )
      return undefined;
    return Math.max(
      0,
      state.pressureTokens + state.surfaceTokens - state.sampledSurfaceTokens,
    );
  }

  private state(scope: string): ScopeState {
    let state = this.states.get(scope);
    if (state === undefined) {
      state = { surfaceTokens: 0 };
      this.states.set(scope, state);
    }
    return state;
  }
}
