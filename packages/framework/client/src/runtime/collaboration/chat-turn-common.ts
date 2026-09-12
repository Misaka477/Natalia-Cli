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
import { resolveEffectiveModel } from "@natalia/config";
import {
  modelRefKey,
  type LocalAttachment,
  type ModelCapabilities,
} from "@natalia/contracts";
import {
  ATTACHMENT_SERVICE,
  COMPACTION_SERVICE,
  type AttachmentService,
  type CompactionService,
} from "@natalia/runtime-services";
import type { RuntimeContext, SessionExecutionState } from "../context";

const ledgerHistories = new WeakMap<ContextLedger, ProviderMessage[]>();

const DEFAULT_CHAT_MODEL_CAPABILITIES: ModelCapabilities = {
  toolCall: true,
  reasoning: true,
  thinking: true,
  imageInput: false,
  videoInput: false,
};

/**
 * Resolves the active chat model's configured capabilities. Chat model
 * profiles may point at a model different from the main agent, so this must be
 * derived from the chat selection (falling back to the runtime default model)
 * rather than from the main execution state.
 */
export function chatModelCapabilities(
  ctx: RuntimeContext,
  provider: StreamingProvider,
  model?: { modelID?: string; variant?: string },
): ModelCapabilities {
  const config = ctx.ports.getTsRuntimeConfig();
  const candidate =
    model?.modelID ??
    (config?.defaultModel ? modelRefKey(config.defaultModel) : undefined);
  if (config && candidate) {
    try {
      const effective = resolveEffectiveModel(config, candidate);
      if (effective) return effective.capabilities;
    } catch {
      // Fall through to the adapter-level capability fallback below.
    }
  }
  return {
    ...DEFAULT_CHAT_MODEL_CAPABILITIES,
    imageInput: provider.imageInput === true,
    videoInput: provider.videoInput === true,
  };
}

type ChatImageAttachment = {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  dataURL: string;
};

type ChatVideoAttachment = {
  mediaType: "video/mp4" | "video/webm";
  dataURL: string;
};

function isChatImageAttachment(
  mediaType: string,
): mediaType is ChatImageAttachment["mediaType"] {
  return (
    mediaType === "image/png" ||
    mediaType === "image/jpeg" ||
    mediaType === "image/webp" ||
    mediaType === "image/gif"
  );
}

function isChatVideoAttachment(
  mediaType: string,
): mediaType is ChatVideoAttachment["mediaType"] {
  return mediaType === "video/mp4" || mediaType === "video/webm";
}

/**
 * Applies local attachments to one provider message using the same text,
 * image and video lowering rules for Navi and Nia. Text is always folded into
 * message content; image/video payloads are only attached when both the model
 * capability and provider adapter support that input modality. Unsupported
 * media is represented by a stable text marker (PDF is ignored with a
 * diagnostic because document support was removed).
 */
export async function applyChatAttachments(
  ctx: RuntimeContext,
  input: {
    message: ProviderMessage;
    attachments?: LocalAttachment[];
    modelCapabilities: ModelCapabilities;
    provider: StreamingProvider;
    onDiagnostic?: (message: string) => void;
  },
): Promise<void> {
  if (!input.attachments?.length) return;
  const attachmentService =
    ctx.ports.resolveService<AttachmentService>(ATTACHMENT_SERVICE);
  if (!attachmentService) return;

  const textBlocks: string[] = [];
  const imageAttachments: ChatImageAttachment[] = [];
  const videoAttachments: ChatVideoAttachment[] = [];
  const markers: string[] = [];
  for (const attachment of input.attachments) {
    if (attachmentService.isText(attachment)) {
      textBlocks.push(
        `[Attachment: ${attachment.filename}]\n${await attachmentService.text(attachment)}`,
      );
      continue;
    }
    const mediaType = String(attachment.mediaType);
    if (isChatImageAttachment(mediaType)) {
      if (input.modelCapabilities.imageInput && input.provider.imageInput) {
        imageAttachments.push({
          mediaType,
          dataURL: await attachmentService.dataURL(attachment),
        });
      } else {
        markers.push(`[Attached ${mediaType}: ${attachment.filename}]`);
      }
      continue;
    }
    if (isChatVideoAttachment(mediaType)) {
      if (input.modelCapabilities.videoInput && input.provider.videoInput) {
        videoAttachments.push({
          mediaType,
          dataURL: await attachmentService.dataURL(attachment),
        });
      } else {
        markers.push(`[Attached ${mediaType}: ${attachment.filename}]`);
      }
      continue;
    }
    input.onDiagnostic?.(
      `Unsupported attachment ${attachment.filename} (${mediaType}) was ignored`,
    );
  }

  if (textBlocks.length)
    input.message.content = `${input.message.content}\n\n${textBlocks.join("\n\n")}`;
  if (markers.length)
    input.message.content = `${input.message.content}\n\n${markers.join("\n\n")}`;
  if (imageAttachments.length)
    input.message.images = [
      ...(input.message.images ?? []),
      ...imageAttachments,
    ];
  if (videoAttachments.length)
    input.message.videos = [
      ...(input.message.videos ?? []),
      ...videoAttachments,
    ];
}

export async function applyChatHistoryAttachments(
  ctx: RuntimeContext,
  input: {
    messages: ProviderMessage[];
    attachments: Array<LocalAttachment[] | undefined>;
    modelCapabilities: ModelCapabilities;
    provider: StreamingProvider;
    onDiagnostic?: (message: string) => void;
  },
): Promise<void> {
  for (let index = 0; index < input.messages.length; index += 1) {
    const message = input.messages[index];
    const attachments = input.attachments[index];
    if (!message || message.role !== "user" || !attachments?.length) continue;
    await applyChatAttachments(ctx, {
      message,
      attachments,
      modelCapabilities: input.modelCapabilities,
      provider: input.provider,
      onDiagnostic: input.onDiagnostic,
    });
  }
}

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
  attachments: Array<LocalAttachment[] | undefined>;
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
    attachments: history.map((message) => message.attachments),
    messageIDs: new Set(history.map((message) => message.messageID)),
    durableMessages: history,
  };
}

export function niaChatHistory(
  exec: SessionExecutionState,
  responseMessageID: string,
): {
  messages: ProviderMessage[];
  attachments: Array<LocalAttachment[] | undefined>;
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
    attachments: history.map((message) => message.attachments),
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
        ...reasoningLedgerFields(message),
      });
      for (const call of message.toolCalls)
        ledger.add({
          id: `${stream.compactionID}:${index}:${call.id}:call`,
          role: "tool_call",
          content: `${call.name} ${call.arguments}`,
          pairID: call.id,
          ...(call.thoughtSignature
            ? { thoughtSignature: call.thoughtSignature }
            : {}),
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
      ...reasoningLedgerFields(message),
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
  const originalByKey = new Map(
    messages.map((message) => [providerMessageKey(message), message]),
  );
  for (const message of rebuilt) {
    const original = originalByKey.get(providerMessageKey(message));
    if (!original) continue;
    if (original.images?.length) message.images = original.images;
    if (original.videos?.length) message.videos = original.videos;
    if (original.reasoningContent !== undefined)
      message.reasoningContent = original.reasoningContent;
    if (original.reasoningField)
      message.reasoningField = original.reasoningField;
    if (original.reasoningSignature)
      message.reasoningSignature = original.reasoningSignature;
    if (original.reasoningRedacted) message.reasoningRedacted = true;
    if (original.reasoningBlocks?.length)
      message.reasoningBlocks = original.reasoningBlocks;
    if (original.textSignature) message.textSignature = original.textSignature;
  }
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

function reasoningLedgerFields(message: ProviderMessage): {
  reasoningContent?: string;
  reasoningField?: string;
  reasoningSignature?: string;
  reasoningRedacted?: boolean;
  reasoningBlocks?: import("@natalia/contracts").ProviderReasoningBlock[];
  textSignature?: string;
} {
  return {
    ...(message.reasoningContent !== undefined
      ? { reasoningContent: message.reasoningContent }
      : {}),
    ...(message.reasoningField
      ? { reasoningField: message.reasoningField }
      : {}),
    ...(message.reasoningSignature
      ? { reasoningSignature: message.reasoningSignature }
      : {}),
    ...(message.reasoningRedacted ? { reasoningRedacted: true } : {}),
    ...(message.reasoningBlocks?.length
      ? { reasoningBlocks: message.reasoningBlocks }
      : {}),
    ...(message.textSignature ? { textSignature: message.textSignature } : {}),
  };
}

function providerMessageKey(message: ProviderMessage): string {
  return JSON.stringify({
    role: message.role,
    content: message.content,
    toolCallID: message.toolCallID,
    toolName: message.toolName,
    toolCalls: message.toolCalls,
    reasoningBlocks: message.reasoningBlocks,
    textSignature: message.textSignature,
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
