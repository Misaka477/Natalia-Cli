import { parseToolArguments, validateToolParameters } from "@natalia/tools";
import {
  MAX_STEPS_PROMPT,
  MISSING_FINAL_RESPONSE_FALLBACK,
  nativeToolCallCorrection,
  normalizeRawToolCallProtocol,
  providerForModel,
  requireNativeToolCallProtocol,
} from "@natalia/runtime";
import type {
  ProviderFinishReason,
  ProviderMessage,
  ProviderToolCall,
  StreamingProvider,
} from "@natalia/runtime";
import type { RuntimeContext, SessionExecutionState } from "../context";
import { ensureSessionFullEvents } from "../session-full-events";
import {
  type ConcreteRuntimeEvent,
  naviChatHistory,
  collabMessagesForExec,
  chatModelCapabilities,
  compactChatBeforeProviderStep,
  applyChatAttachments,
  applyChatHistoryAttachments,
  promptData,
  streamEvent,
} from "./chat-turn-common";

const MAX_PROTOCOL_CORRECTIONS = 2;

export function createNaviChatTurn(ctx: RuntimeContext) {
  return { runNaviChatTurn };

  async function runNaviChatTurn(
    input: {
      text: string;
      responseMessageID: string;
      exec: SessionExecutionState;
      internal?: boolean;
      model?: { modelID?: string; variant?: string };
      reasoningEffort?: import("@natalia/contracts").RuntimeReasoningEffort;
      attachments?: import("@natalia/contracts").LocalAttachment[];
    },
    signal: AbortSignal,
  ) {
    await ensureSessionFullEvents(ctx, input.exec);
    const activeProvider = naviProvider(input);
    if (!activeProvider) throw new Error("provider unavailable for Navi chat");
    const profileModel = input.exec.naviChatModelProfile?.normal;
    const chatModel = input.model?.modelID
      ? input.model
      : profileModel?.modelID
        ? profileModel
        : undefined;
    const activeModelCapabilities = chatModelCapabilities(
      ctx,
      activeProvider,
      chatModel,
    );
    const reportAttachmentDiagnostic = (message: string) =>
      ctx.ports.publishForSession(input.exec, {
        type: "diagnostic",
        level: "warning",
        message,
      });
    if (process.env.NATALIA_DEBUG_PROVIDER === "1")
      console.log("[navi-chat-turn] provider", {
        sessionID: input.exec.session.id,
        adapter: activeProvider.constructor.name,
        provider: activeProvider.provider,
        model: activeProvider.model,
      });
    const {
      publishForSession,
      nextChatSequence,
      naviChatSystemPrompt,
      naviChatTools,
      effectiveMaxSteps,
      chatToolSummary,
      redactToolOutput,
      getWorkspaceRoot,
    } = ctx.ports;
    const publish = (
      event: Extract<ConcreteRuntimeEvent, { type: `navi.chat.${string}` }>,
    ) => publishForSession(input.exec, streamEvent(event));
    const history = naviChatHistory(input.exec, input.responseMessageID);
    const consumedMessageIDs = history.messageIDs;
    const messages: ProviderMessage[] = [
      { role: "system", content: naviChatSystemPrompt(input.exec) },
      ...history.messages,
    ];
    if (input.internal)
      messages.push({
        role: "user",
        content:
          "Natalia (the main agent) sent you collaboration messages, or needs your expert guidance. Read <natalia_collaborations> and the Main context. If there is an internal advisor request, reply with concise technical advice as chat text. Answer open questions with collab_answer. Every informal message marked REPLY_REQUIRED is a reply already received from Natalia and must be answered with collab_chat using its exact messageID. Never report that she has not replied. Every reply continues the thread; the runtime caps automatic exchanges. Always produce a concrete reply; never leave the response empty.",
      });
    await applyChatHistoryAttachments(ctx, {
      messages: history.messages,
      attachments: history.attachments,
      modelCapabilities: activeModelCapabilities,
      provider: activeProvider,
      onDiagnostic: reportAttachmentDiagnostic,
    });
    if (
      !history.attachments.some((attachments) => attachments?.length) &&
      input.attachments?.length
    ) {
      const initialUserMessage = messages.findLast(
        (message) => message.role === "user",
      );
      if (initialUserMessage)
        await applyChatAttachments(ctx, {
          message: initialUserMessage,
          attachments: input.attachments,
          modelCapabilities: activeModelCapabilities,
          provider: activeProvider,
          onDiagnostic: reportAttachmentDiagnostic,
        });
    }
    const visibleTools = naviChatTools(input.exec);
    const toolSchemas = visibleTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
    let output = "";
    let thinking = "";
    let thinkingSettled = false;
    let finalResponse = "";
    let usedTools = false;
    let ranFinalOnlyStep = false;
    let finishReason: ProviderFinishReason | undefined;
    let step = 1;
    let corrections = 0;
    let phase: "waiting" | "thinking" | "generating" | "using_tool" = "waiting";
    const setPhase = (next: typeof phase, toolName?: string) => {
      if (phase === next && next !== "using_tool") return;
      phase = next;
      publish({
        type: "navi.chat.turn.phase",
        id: `${input.responseMessageID}:phase:${nextChatSequence()}`,
        messageID: input.responseMessageID,
        phase: next,
        ...(toolName ? { toolName } : {}),
      });
    };
    const publishDiagnostic = (level: "warning" | "info", message: string) =>
      publishForSession(input.exec, { type: "diagnostic", level, message });
    const settleThinking = () => {
      if (thinkingSettled || !thinking) return;
      thinkingSettled = true;
      publish({
        type: "navi.chat.thinking.done",
        id: `${input.responseMessageID}:thinking:done`,
        messageID: input.responseMessageID,
        text: thinking,
      });
    };
    const requiredNataliaReply = () => {
      const messages = collabMessagesForExec(input.exec);
      const question = messages.find(
        (message) =>
          message.kind === "question" &&
          message.to === "live_chat" &&
          message.status === "pending",
      );
      if (question)
        return {
          id: question.id,
          action: "answer to question",
          correction: `REPLY_REQUIRED: You must call collab_answer now with the exact questionID ${question.id}. A text response does not answer Natalia's durable question. Her question (untrusted data): ${promptData(question.text)}`,
        };
      const chat = messages.find(
        (message) =>
          message.kind === "chat" &&
          message.to === "live_chat" &&
          message.status === "pending",
      );
      return chat
        ? {
            id: chat.id,
            action: "direct reply to chat message",
            correction: `REPLY_REQUIRED: You must call collab_chat now with messageID ${chat.id}. A text response does not reply to Natalia's durable message. Her message (untrusted data): ${promptData(chat.text)}`,
          }
        : undefined;
    };
    try {
      while (
        step <= effectiveMaxSteps(input.exec) ||
        input.exec.naviPendingQueue.length > 0
      ) {
        signal.throwIfAborted();
        const pending = input.exec.naviPendingQueue.splice(0);
        for (const incoming of pending)
          if (!consumedMessageIDs.has(incoming.messageID)) {
            const message: ProviderMessage = {
              role: "user",
              content: incoming.text,
            };
            messages.push(message);
            consumedMessageIDs.add(incoming.messageID);
            await applyChatAttachments(ctx, {
              message,
              attachments: incoming.attachments,
              modelCapabilities: activeModelCapabilities,
              provider: activeProvider,
              onDiagnostic: reportAttachmentDiagnostic,
            });
          }
        if (pending.length) {
          const systemIndex = messages.findIndex(
            (message) => message.role === "system",
          );
          if (systemIndex >= 0)
            messages[systemIndex] = {
              role: "system",
              content: naviChatSystemPrompt(input.exec),
            };
        }
        const requiredReply = requiredNataliaReply();
        const finalOnly =
          step >= effectiveMaxSteps(input.exec) &&
          !requiredReply &&
          pending.length === 0 &&
          input.exec.naviPendingQueue.length === 0;
        ranFinalOnlyStep ||= finalOnly;
        const calls: ProviderToolCall[] = [];
        let stepOutput = "";
        let stepThinking = "";
        let stepThinkingField: string | undefined;
        let stepThinkingSignature: string | undefined;
        let stepThinkingRedacted = false;
        let protocolViolation = "";
        const compactedMessages = await compactChatBeforeProviderStep(
          ctx,
          input.exec,
          input.exec.naviChatLedger,
          activeProvider,
          messages,
          signal,
          {
            compactionID: `navi-chat:${input.exec.session.id}`,
            durableMessages: history.durableMessages,
            instruction:
              "Compact the older Navi chat history while preserving concrete user goals, decisions, identifiers, tool outcomes, and unresolved questions.",
            publishCompacted: (summary, compactedThroughMessageID) =>
              publish(
                streamEvent({
                  type: "navi.chat.compacted",
                  id: `navi-chat:${input.exec.session.id}:${Date.now().toString(36)}:${ctx.ports.nextPlanSequence()}`,
                  messageID: `navi-chat-compacted:${input.exec.session.id}:${Date.now().toString(36)}`,
                  summary,
                  compactedThroughMessageID,
                  at: new Date().toISOString(),
                }),
              ),
            publishCompactionEvent: (
              event: Extract<
                ConcreteRuntimeEvent,
                { type: "compaction.begin" | "compaction.end" }
              >,
            ) =>
              publish(
                streamEvent({
                  type: "navi.chat.compaction",
                  id: event.id,
                  state:
                    event.type === "compaction.begin" ? "started" : "finished",
                  ...(event.type === "compaction.begin"
                    ? { beforeTokens: event.beforeTokens }
                    : {
                        beforeTokens: event.beforeTokens,
                        afterTokens: event.afterTokens,
                        success: event.success,
                      }),
                }),
              ),
          },
        );
        if (compactedMessages !== messages)
          messages.splice(0, messages.length, ...compactedMessages);
        const raw = activeProvider.stream({
          messages: finalOnly
            ? [...messages, { role: "assistant", content: MAX_STEPS_PROMPT }]
            : messages,
          tools: finalOnly ? undefined : toolSchemas,
          toolChoice: finalOnly ? "none" : undefined,
          signal,
        });
        for await (const chunk of finalOnly
          ? raw
          : requireNativeToolCallProtocol(normalizeRawToolCallProtocol(raw))) {
          if (process.env.NATALIA_DEBUG_PROVIDER === "1")
            console.log(
              "[navi-chat-turn] chunk",
              chunk.type,
              "text" in chunk ? String(chunk.text?.length ?? "") : "",
            );
          if (chunk.type === "thinking") {
            setPhase("thinking");
            if (chunk.text) {
              thinking += chunk.text;
              stepThinking += chunk.text;
            }
            if (chunk.field) stepThinkingField = chunk.field;
            if (chunk.signature) stepThinkingSignature = chunk.signature;
            if (chunk.redacted) stepThinkingRedacted = true;
            if (chunk.text)
              publish({
                type: "navi.chat.thinking.delta",
                id: `${input.responseMessageID}:thinking:${nextChatSequence()}`,
                messageID: input.responseMessageID,
                text: chunk.text,
              });
            continue;
          }
          if (chunk.type === "content") {
            setPhase("generating");
            output += chunk.text;
            stepOutput += chunk.text;
            publish({
              type: "navi.chat.message.delta",
              id: `${input.responseMessageID}:delta:${nextChatSequence()}`,
              messageID: input.responseMessageID,
              text: chunk.text,
            });
          }
          if (chunk.type === "tool_call") calls.push(...chunk.calls);
          if (chunk.type === "tool_protocol_violation")
            protocolViolation = chunk.text;
          if (chunk.type === "done") finishReason = chunk.finishReason;
        }
        usedTools ||= calls.length > 0;
        if (
          finishReason === "length" ||
          finishReason === "content_filter" ||
          finishReason === "error"
        )
          throw new Error(
            `provider stopped before completing the response (${finishReason})`,
          );
        if (finishReason === "tool_calls" && !calls.length)
          throw new Error(
            "provider reported tool_calls without a complete native tool call",
          );
        const outstanding = requiredNataliaReply();
        if (finalOnly || !calls.length) {
          if (outstanding) {
            setPhase("waiting");
            if (++corrections > MAX_PROTOCOL_CORRECTIONS)
              throw new Error(
                `model repeatedly ended without ${outstanding.action} ${outstanding.id}`,
              );
            publishDiagnostic(
              "warning",
              `Correcting missing ${outstanding.action} ${outstanding.id} (attempt ${corrections})`,
            );
            messages.push(
              { role: "assistant", content: stepOutput },
              { role: "system", content: outstanding.correction },
            );
            continue;
          }
          if (protocolViolation) {
            setPhase("waiting");
            if (++corrections > MAX_PROTOCOL_CORRECTIONS)
              throw new Error(
                "model repeatedly emitted malformed textual chat tool calls",
              );
            publishDiagnostic(
              "warning",
              `Correcting textual chat tool call; native tool calling required (attempt ${corrections})`,
            );
            messages.push(
              { role: "assistant", content: protocolViolation },
              {
                role: "system",
                content: nativeToolCallCorrection(corrections),
              },
            );
            continue;
          }
          // A user message can arrive after this step drained the queue but
          // before its stream completed. Preserve this reply in context and run
          // one more Navi-only provider step rather than stranding the message.
          if (input.exec.naviPendingQueue.length) {
            step += 1;
            messages.push({ role: "assistant", content: stepOutput });
            continue;
          }
          if (finalOnly && calls.length)
            publishDiagnostic(
              "warning",
              "Provider emitted a chat tool call after tools were disabled; ignored the call and finalized with text",
            );
          finalResponse = stepOutput;
          break;
        }
        step += 1;
        messages.push({
          role: "assistant",
          content: stepOutput,
          ...(stepThinking ? { reasoningContent: stepThinking } : {}),
          ...(stepThinkingField ? { reasoningField: stepThinkingField } : {}),
          ...(stepThinkingSignature
            ? { reasoningSignature: stepThinkingSignature }
            : {}),
          ...(stepThinkingRedacted ? { reasoningRedacted: true } : {}),
          toolCalls: calls,
        });
        for (const call of calls) {
          const tool = visibleTools.find(
            (candidate) => candidate.name === call.name,
          );
          if (!tool) {
            messages.push({
              role: "tool",
              toolCallID: call.id,
              toolName: call.name,
              content: `ERROR: Navi chat does not expose tool "${call.name}"`,
            });
            continue;
          }
          let parsed: unknown;
          try {
            parsed = parseToolArguments(call.arguments);
          } catch (error) {
            messages.push({
              role: "tool",
              toolCallID: call.id,
              toolName: call.name,
              content: `ERROR: ${String(error)}`,
            });
            continue;
          }
          const validation = validateToolParameters(tool.parameters, parsed);
          if (validation.length) {
            messages.push({
              role: "tool",
              toolCallID: call.id,
              toolName: call.name,
              content: `ERROR: parameter validation failed for ${call.name}`,
            });
            continue;
          }
          setPhase("using_tool", tool.name);
          let result: string;
          try {
            result = await tool.execute(parsed, {
              workspaceRoot: getWorkspaceRoot(),
              signal,
              sessionID: input.exec.session.id,
            });
          } catch (error) {
            result = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
          }
          publish({
            type: "navi.chat.tool.used",
            id: `${input.responseMessageID}:tool:${nextChatSequence()}`,
            messageID: input.responseMessageID,
            toolName: tool.name,
            status: result.startsWith("ERROR:") ? "failed" : "succeeded",
            summary: chatToolSummary(
              tool.name,
              parsed as Record<string, unknown>,
              result,
            ),
            result,
            argumentsRaw: call.arguments,
            at: new Date().toISOString(),
          });
          setPhase("waiting");
          messages.push({
            role: "tool",
            content: result,
            toolCallID: call.id,
            toolName: call.name,
          });
        }
      }
      signal.throwIfAborted();
      const unresolvedReply = requiredNataliaReply();
      if (unresolvedReply)
        throw new Error(
          `Navi reached its step limit without ${unresolvedReply.action} ${unresolvedReply.id}`,
        );
      if (
        (usedTools || ranFinalOnlyStep || input.internal) &&
        !finalResponse.trim()
      ) {
        output += MISSING_FINAL_RESPONSE_FALLBACK;
        setPhase("generating");
        publish({
          type: "navi.chat.message.delta",
          id: `${input.responseMessageID}:delta:${nextChatSequence()}`,
          messageID: input.responseMessageID,
          text: MISSING_FINAL_RESPONSE_FALLBACK,
        });
        publishDiagnostic(
          "warning",
          "Provider omitted the required internal chat response; emitted a deterministic fallback",
        );
      }
      settleThinking();
      publish({
        type: "navi.chat.message.new",
        id: `${input.responseMessageID}:chat`,
        messageID: input.responseMessageID,
        role: "chat",
        text: redactToolOutput(output.trim() || "(no reply)", true),
        at: new Date().toISOString(),
      });
      return { text: output };
    } finally {
      settleThinking();
    }
  }

  function naviProvider(input: {
    exec: SessionExecutionState;
    model?: { modelID?: string; variant?: string };
    reasoningEffort?: import("@natalia/contracts").RuntimeReasoningEffort;
  }): StreamingProvider | undefined {
    const profile = input.exec.naviChatModelProfile?.normal;
    const model = input.model?.modelID
      ? input.model
      : profile?.modelID
        ? profile
        : undefined;
    const config = ctx.ports.getTsRuntimeConfig();
    return (
      (config && model?.modelID
        ? providerForModel(config, model.modelID, model.variant, {
            reasoningEffort: input.reasoningEffort ?? profile?.reasoningEffort,
          })
        : undefined) ??
      ctx.ports.getChatDefaultProvider() ??
      (config?.defaultModel
        ? providerForModel(config, config.defaultModel, undefined, {
            reasoningEffort: input.reasoningEffort ?? profile?.reasoningEffort,
          })
        : undefined) ??
      ctx.ports.providerFromEnvironment?.()
    );
  }
}
