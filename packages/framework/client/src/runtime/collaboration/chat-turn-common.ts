import {
  projectedChatMessages,
  projectedCollabMessages,
} from "@natalia/session";
import {
  ContextLedger,
  contextEntriesToProviderMessages,
  estimateTokens,
  type ProviderMessage,
  type StreamingProvider,
} from "@natalia/runtime";
import {
  COMPACTION_SERVICE,
  type CompactionService,
} from "@natalia/runtime-services";
import type { RuntimeContext, SessionExecutionState } from "../context";

export function promptData(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function naviChatHistory(
  exec: SessionExecutionState,
  responseMessageID: string,
): { messages: ProviderMessage[]; messageIDs: Set<string> } {
  const history = projectedChatMessages(exec.session.events).filter(
    (message) =>
      message.messageID !== responseMessageID &&
      message.channel === "navi" &&
      message.kind !== "thinking",
  );
  return {
    messages: history.map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text,
    })),
    messageIDs: new Set(history.map((message) => message.messageID)),
  };
}

export function niaChatHistory(
  exec: SessionExecutionState,
  responseMessageID: string,
): { messages: ProviderMessage[]; messageIDs: Set<string> } {
  const history = projectedChatMessages(exec.session.events).filter(
    (message) =>
      message.messageID !== responseMessageID &&
      message.channel === "nia" &&
      message.kind !== "thinking",
  );
  return {
    messages: history.map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text,
    })),
    messageIDs: new Set(history.map((message) => message.messageID)),
  };
}

export function collabMessagesForExec(exec: SessionExecutionState) {
  const snapshot = exec.collabSnapshot;
  return snapshot && snapshot.eventCount === exec.session.events.length
    ? snapshot.collabMessages
    : projectedCollabMessages(exec.session.events);
}

export async function compactChatBeforeProviderStep(
  ctx: RuntimeContext,
  channel: "navi" | "nia",
  exec: SessionExecutionState,
  provider: StreamingProvider,
  messages: ProviderMessage[],
  signal: AbortSignal,
) {
  const compaction = ctx.ports.resolveService<CompactionService>(
    COMPACTION_SERVICE,
  );
  const budget = ctx.ports.getRuntimeContextConfig?.() ?? exec.runtimeContextConfig;
  if (!compaction || !budget) return messages;

  const ledger = new ContextLedger();
  for (const [index, message] of messages.entries()) {
    if (message.role === "system") continue;
    if (message.role === "assistant" && message.toolCalls?.length) {
      ledger.add({
        id: `${channel}:${index}:assistant`,
        role: "assistant",
        content: message.content,
      });
      for (const call of message.toolCalls)
        ledger.add({
          id: `${channel}:${index}:${call.id}:call`,
          role: "tool_call",
          content: `${call.name} ${call.arguments}`,
          pairID: call.id,
        });
      continue;
    }
    if (message.role === "tool" && message.toolCallID) {
      ledger.add({
        id: `${channel}:${index}:${message.toolCallID}:result`,
        role: "tool_result",
        content: message.content,
        pairID: message.toolCallID,
      });
      continue;
    }
    ledger.add({
      id: `${channel}:${index}:${message.role}`,
      role: message.role === "user" ? "user" : "assistant",
      content: message.content,
    });
  }
  const runtimeInstruction =
    messages[0]?.role === "system" ? messages[0] : undefined;
  const usedTokens = messages.reduce(
    (sum, message) =>
      sum +
      estimateTokens(message.content) +
      (message.toolCalls?.reduce(
        (inner, call) =>
          inner + estimateTokens(call.name) + estimateTokens(call.arguments),
        0,
      ) ?? 0),
    0,
  );
  const outcome = await compaction.compactBeforeProviderStep({
    compactionID: `${channel}-chat:${exec.session.id}`,
    ledger,
    provider,
    usedTokens,
    budget,
    enabled: ctx.ports.getTsRuntimeConfig()?.context.compactionEnabled ?? true,
    preservedRecentMessages:
      ctx.ports.getTsRuntimeConfig()?.context.preservedRecentMessages ?? 10,
    instruction: `Compact the older ${channel} chat history while preserving concrete user goals, decisions, identifiers, tool outcomes, and unresolved questions.`,
    signal,
    onEvent: (event: import("@natalia/contracts").RuntimeEvent) =>
      ctx.ports.publishForSession(exec, event),
  });
  if (!outcome.compacted) return messages;

  const snapshot = ledger.snapshot().entries;
  const rebuilt = contextEntriesToProviderMessages(snapshot);
  if (
    runtimeInstruction &&
    rebuilt[0]?.content !== runtimeInstruction.content
  )
    rebuilt.unshift(runtimeInstruction);

  const durableMessages = projectedChatMessages(exec.session.events).filter(
    (message) => message.channel === channel && message.kind !== "thinking",
  );
  const rebuiltKeys = new Set(
    rebuilt
      .filter((message) => message.role !== "system")
      .map(
        (message) =>
          `${message.role === "user" ? "user" : "assistant"}\u0000${message.content}`,
      ),
  );
  let compactedThroughMessageID = durableMessages.at(-1)?.messageID ?? "";
  for (const message of durableMessages) {
    const key = `${message.role === "user" ? "user" : "assistant"}\u0000${message.text}`;
    if (rebuiltKeys.has(key)) break;
    compactedThroughMessageID = message.messageID;
  }
  const summaryEntry = snapshot.find((entry) => entry.role === "summary");
  const summary = summaryEntry?.content ?? "";
  console.log(`[${channel}-chat-compact] compacted`, {
    sessionID: exec.session.id,
    usedTokens,
    compactedThroughMessageID,
    summaryLength: summary.length,
  });
  if (compactedThroughMessageID) {
    ctx.ports.publishForSession(
      exec,
      streamEvent({
        type: `${channel}.chat.compacted`,
        id: `${channel}-chat:${exec.session.id}:${Date.now().toString(36)}:${ctx.ports.nextPlanSequence()}`,
        messageID: `${channel}-chat-compacted:${exec.session.id}:${Date.now().toString(36)}`,
        summary,
        compactedThroughMessageID,
        at: new Date().toISOString(),
      }),
    );
  }
  return rebuilt;
}

type ExpandEventTypes<Event> = Event extends {
  type: infer Type extends string;
}
  ? Type extends string
    ? Omit<Event, "type"> & { type: Type }
    : never
  : never;

export type ConcreteRuntimeEvent = ExpandEventTypes<
  import("@natalia/contracts").RuntimeEvent
>;

export function streamEvent<Event extends ConcreteRuntimeEvent>(
  event: Event,
): Event {
  return event;
}
