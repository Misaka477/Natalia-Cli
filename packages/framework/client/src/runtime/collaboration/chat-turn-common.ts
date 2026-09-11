import {
  projectedCollabMessages,
  projectedNaviChatMessages,
  projectedNiaChatMessages,
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

const ledgerHistories = new WeakMap<ContextLedger, ProviderMessage[]>();

export function promptData(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function naviChatHistory(
  exec: SessionExecutionState,
  responseMessageID: string,
): {
  messages: ProviderMessage[];
  messageIDs: Set<string>;
  durableMessages: Array<{
    messageID: string;
    role: "user" | "chat" | "system";
    text: string;
  }>;
} {
  const history = projectedNaviChatMessages(exec.session.events).filter(
    (message) =>
      message.messageID !== responseMessageID && message.kind !== "thinking",
  );
  return {
    messages: history.map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text,
    })),
    messageIDs: new Set(history.map((message) => message.messageID)),
    durableMessages: history,
  };
}

export function niaChatHistory(
  exec: SessionExecutionState,
  responseMessageID: string,
): {
  messages: ProviderMessage[];
  messageIDs: Set<string>;
  durableMessages: Array<{
    messageID: string;
    role: "user" | "chat" | "system";
    text: string;
  }>;
} {
  const history = projectedNiaChatMessages(exec.session.events).filter(
    (message) =>
      message.messageID !== responseMessageID && message.kind !== "thinking",
  );
  return {
    messages: history.map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text,
    })),
    messageIDs: new Set(history.map((message) => message.messageID)),
    durableMessages: history,
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
  exec: SessionExecutionState,
  ledger: ContextLedger,
  provider: StreamingProvider,
  messages: ProviderMessage[],
  signal: AbortSignal,
  stream: {
    compactionID: string;
    instruction: string;
    durableMessages: Array<{
      messageID: string;
      role: "user" | "chat" | "system";
      text: string;
    }>;
    publishCompacted(summary: string, compactedThroughMessageID: string): void;
    publishCompactionEvent(
      event: import("@natalia/contracts").RuntimeEvent,
    ): void;
  },
) {
  const compaction =
    ctx.ports.resolveService<CompactionService>(COMPACTION_SERVICE);
  const budget = exec.runtimeContextConfig;
  if (!compaction || !budget) return messages;

  // This ledger is owned by the stream execution state. Incremental updates
  // preserve a stream's compacted summary without observing a sibling stream.
  const previousMessages = ledgerHistories.get(ledger) ?? [];
  const hasSharedPrefix =
    previousMessages.length <= messages.length &&
    previousMessages.every(
      (message, index) =>
        index >= previousMessages.length ||
        providerMessageKey(previousMessages[index]!) ===
          providerMessageKey(message),
    );
  const firstNewMessage = hasSharedPrefix ? previousMessages.length : 0;
  if (!hasSharedPrefix) ledger.restore({ entries: [], resources: [] });
  for (const [index, message] of messages.entries()) {
    if (index < firstNewMessage) continue;
    if (message.role === "system") continue;
    if (message.role === "assistant" && message.toolCalls?.length) {
      ledger.add({
        id: `${stream.compactionID}:${index}:assistant`,
        role: "assistant",
        content: message.content,
      });
      for (const call of message.toolCalls)
        ledger.add({
          id: `${stream.compactionID}:${index}:${call.id}:call`,
          role: "tool_call",
          content: `${call.name} ${call.arguments}`,
          pairID: call.id,
        });
      continue;
    }
    if (message.role === "tool" && message.toolCallID) {
      ledger.add({
        id: `${stream.compactionID}:${index}:${message.toolCallID}:result`,
        role: "tool_result",
        content: message.content,
        pairID: message.toolCallID,
      });
      continue;
    }
    ledger.add({
      id: `${stream.compactionID}:${index}:${message.role}`,
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
    compactionID: stream.compactionID,
    ledger,
    provider,
    usedTokens,
    budget,
    enabled: ctx.ports.getTsRuntimeConfig()?.context.compactionEnabled ?? true,
    preservedRecentMessages:
      ctx.ports.getTsRuntimeConfig()?.context.preservedRecentMessages ?? 10,
    preservedRecentTokens:
      ctx.ports.getTsRuntimeConfig()?.context.preservedRecentTokens ?? 0,
    instruction: stream.instruction,
    signal,
    onEvent: stream.publishCompactionEvent,
  });
  if (!outcome.compacted) {
    ledgerHistories.set(ledger, [...messages]);
    return messages;
  }

  const snapshot = ledger.snapshot().entries;
  const rebuilt = contextEntriesToProviderMessages(snapshot);
  if (runtimeInstruction && rebuilt[0]?.content !== runtimeInstruction.content)
    rebuilt.unshift(runtimeInstruction);

  const rebuiltKeys = new Set(
    rebuilt
      .filter((message) => message.role !== "system")
      .map(
        (message) =>
          `${message.role === "user" ? "user" : "chat"}\u0000${message.content}`,
      ),
  );
  let compactedThroughMessageID = "";
  for (const message of stream.durableMessages) {
    const key = `${message.role}\u0000${message.text}`;
    if (rebuiltKeys.has(key)) break;
    compactedThroughMessageID = message.messageID;
  }
  const summaryEntry = snapshot.find((entry) => entry.role === "summary");
  const summary = summaryEntry?.content ?? "";
  console.log("[stream-chat-compact] compacted", {
    sessionID: exec.session.id,
    usedTokens,
    compactedThroughMessageID,
    summaryLength: summary.length,
  });
  if (compactedThroughMessageID)
    stream.publishCompacted(summary, compactedThroughMessageID);
  ledgerHistories.set(ledger, [...rebuilt]);
  return rebuilt;
}

function providerMessageKey(message: ProviderMessage): string {
  return JSON.stringify({
    role: message.role,
    content: message.content,
    toolCallID: message.toolCallID,
    toolName: message.toolName,
    toolCalls: message.toolCalls,
  });
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
