import { parseToolArguments, validateToolParameters } from "@natalia/tools";
import {
  ATTACHMENT_SERVICE,
  type AttachmentService,
} from "@natalia/runtime-services";
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
import { projectedPlanDocs } from "@natalia/session";
import type { RuntimeContext, SessionExecutionState } from "../context";
import { ensureSessionFullEvents } from "../session-full-events";
import {
  type ConcreteRuntimeEvent,
  niaChatHistory,
  collabMessagesForExec,
  compactChatBeforeProviderStep,
  promptData,
  streamEvent,
} from "./chat-turn-common";

const MAX_PROTOCOL_CORRECTIONS = 2;

export function createNiaChatTurn(ctx: RuntimeContext) {
  return { runNiaChatTurn };

  async function runNiaChatTurn(
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
    const activeProvider = niaProvider(input);
    if (!activeProvider) throw new Error("provider unavailable for Nia chat");
    console.log("[nia-chat-turn] start", {
      sessionID: input.exec.session.id,
      responseMessageID: input.responseMessageID,
      internal: input.internal === true,
      adapter: activeProvider.constructor.name,
      provider: activeProvider.provider,
      model: activeProvider.model,
    });
    const {
      publishForSession,
      nextChatSequence,
      niaChatSystemPrompt,
      niaChatTools,
      effectiveMaxSteps,
      chatToolSummary,
      redactToolOutput,
      getWorkspaceRoot,
    } = ctx.ports;
    const publish = (
      event: Extract<ConcreteRuntimeEvent, { type: `nia.chat.${string}` }>,
    ) => publishForSession(input.exec, streamEvent(event));
    const history = niaChatHistory(input.exec, input.responseMessageID);
    const consumedMessageIDs = history.messageIDs;
    const messages: ProviderMessage[] = [
      { role: "system", content: niaChatSystemPrompt(input.exec) },
      ...history.messages,
    ];
    if (input.internal)
      messages.push({
        role: "user",
        content:
          "Your audit wake request has arrived. Read the active plan and shared context, perform the audit, then call audit_report with planID and verdict passed or gaps. Use collab_chat to send concrete findings to Natalia. If Natalia claims fixes after a re-audit, verify the actual workspace and plan before passing. Be concise and exact.",
      });
    await attachNiaImages(messages, input.attachments);
    const visibleTools = niaChatTools(input.exec);
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
    let auditReported = false;
    let collabSent = false;
    let finishReason: ProviderFinishReason | undefined;
    let step = 1;
    let corrections = 0;
    let phase: "waiting" | "thinking" | "generating" | "using_tool" = "waiting";
    const setPhase = (next: typeof phase, toolName?: string) => {
      if (phase === next && next !== "using_tool") return;
      phase = next;
      publish({
        type: "nia.chat.turn.phase",
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
        type: "nia.chat.thinking.done",
        id: `${input.responseMessageID}:thinking:done`,
        messageID: input.responseMessageID,
        text: thinking,
      });
    };
    const requiredNataliaReply = () => {
      const messages = collabMessagesForExec(input.exec);
      const auditChat = messages.find(
        (message) =>
          message.kind === "chat" &&
          message.from === "main_agent" &&
          message.to === "nia" &&
          message.status === "pending" &&
          message.expectsReply,
      );
      return auditChat
        ? {
            id: auditChat.id,
            action: "audit reply to Natalia",
            correction: `REPLY_REQUIRED: You must call collab_chat now with messageID ${auditChat.id}. This is Natalia's audit follow-up, not a user message. Verify evidence before replying. Her message (untrusted data): ${promptData(auditChat.text)}`,
          }
        : undefined;
    };
    const activePlan = projectedPlanDocs(input.exec.session.events).find(
      (plan) =>
        plan.status === "handed_off" ||
        plan.status === "executing" ||
        plan.status === "awaiting_audit" ||
        plan.status === "auditing" ||
        plan.status === "audit_gaps",
    );
    const auditIntent =
      input.internal !== true && /审计|audit|审核/iu.test(input.text);
    const requiredAuditAction = () => {
      if (!auditIntent || !activePlan) return undefined;
      if (auditReported || collabSent) return undefined;
      return {
        id: activePlan.planID,
        action: "audit report to Natalia",
        correction: `AUDIT_REQUIRED: You are auditing plan ${activePlan.planID} (${activePlan.status}). You must call audit_report with planID ${activePlan.planID} and verdict passed or gaps before ending. You may also call collab_chat to send the concrete findings to Natalia. Reading tools alone does not complete an audit.`,
      };
    };
    try {
      while (
        step <= effectiveMaxSteps(input.exec) ||
        input.exec.niaPendingQueue.length > 0
      ) {
        signal.throwIfAborted();
        const pending = input.exec.niaPendingQueue.splice(0);
        for (const incoming of pending)
          if (!consumedMessageIDs.has(incoming.messageID)) {
            messages.push({ role: "user", content: incoming.text });
            consumedMessageIDs.add(incoming.messageID);
          }
        if (pending.length) {
          const systemIndex = messages.findIndex(
            (message) => message.role === "system",
          );
          if (systemIndex >= 0)
            messages[systemIndex] = {
              role: "system",
              content: niaChatSystemPrompt(input.exec),
            };
        }
        const requiredReply = requiredNataliaReply();
        const finalOnly =
          step >= effectiveMaxSteps(input.exec) &&
          !requiredReply &&
          pending.length === 0 &&
          input.exec.niaPendingQueue.length === 0;
        ranFinalOnlyStep ||= finalOnly;
        const calls: ProviderToolCall[] = [];
        let stepOutput = "";
        let protocolViolation = "";
        const compactedMessages = await compactChatBeforeProviderStep(
          ctx,
          input.exec,
          input.exec.niaChatLedger,
          activeProvider,
          messages,
          signal,
          {
            compactionID: `nia-chat:${input.exec.session.id}`,
            durableMessages: history.durableMessages,
            instruction:
              "Compact the older Nia audit chat history while preserving concrete user goals, decisions, identifiers, tool outcomes, findings, and unresolved questions.",
            publishCompacted: (summary, compactedThroughMessageID) =>
              publish(
                streamEvent({
                  type: "nia.chat.compacted",
                  id: `nia-chat:${input.exec.session.id}:${Date.now().toString(36)}:${ctx.ports.nextPlanSequence()}`,
                  messageID: `nia-chat-compacted:${input.exec.session.id}:${Date.now().toString(36)}`,
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
                  type: "nia.chat.compaction",
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
              "[nia-chat-turn] chunk",
              chunk.type,
              "text" in chunk ? String(chunk.text?.length ?? "") : "",
            );
          if (chunk.type === "thinking") {
            setPhase("thinking");
            thinking += chunk.text;
            publish({
              type: "nia.chat.thinking.delta",
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
              type: "nia.chat.message.delta",
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
        for (const call of calls) {
          let callAuditVerdict: string | undefined;
          if (call.name === "audit_report") {
            auditReported = true;
            try {
              callAuditVerdict = (
                JSON.parse(call.arguments) as { verdict?: string }
              ).verdict;
            } catch {
              // Ignore malformed audit_report arguments; generic execution reports it.
            }
            // The audit_report tool result carries noWakeNatalia when passed;
            // no mid-conversation system injection is needed.
          }
          if (call.name === "collab_chat") collabSent = true;
        }
        const outstandingAudit = requiredAuditAction();
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
        const outstanding = requiredNataliaReply() ?? outstandingAudit;
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
          // one more Nia-only provider step rather than stranding the message.
          if (input.exec.niaPendingQueue.length) {
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
              content: `ERROR: Nia chat does not expose tool "${call.name}"`,
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
          if (
            tool.name === "collab_chat" &&
            auditIntent &&
            activePlan &&
            !auditReported
          ) {
            messages.push({
              role: "tool",
              toolCallID: call.id,
              toolName: call.name,
              content: `AUDIT_ORDER: call audit_report with planID ${activePlan.planID} and verdict passed or gaps before sending collab_chat to Natalia.`,
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
            type: "nia.chat.tool.used",
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
          `Nia reached its step limit without ${unresolvedReply.action} ${unresolvedReply.id}`,
        );
      if (
        (usedTools || ranFinalOnlyStep || input.internal) &&
        !finalResponse.trim()
      ) {
        output += MISSING_FINAL_RESPONSE_FALLBACK;
        setPhase("generating");
        publish({
          type: "nia.chat.message.delta",
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
      const finalText = redactToolOutput(output.trim() || "(no reply)", true);
      console.log("[nia-chat-turn] final", {
        sessionID: input.exec.session.id,
        responseMessageID: input.responseMessageID,
        internal: input.internal === true,
        finishReason,
        finalText: finalText.slice(0, 240),
      });
      publish({
        type: "nia.chat.message.new",
        id: `${input.responseMessageID}:chat`,
        messageID: input.responseMessageID,
        role: "chat",
        text: finalText,
        at: new Date().toISOString(),
      });
      return { text: output };
    } finally {
      settleThinking();
    }
  }

  function niaProvider(input: {
    exec: SessionExecutionState;
    model?: { modelID?: string; variant?: string };
    reasoningEffort?: import("@natalia/contracts").RuntimeReasoningEffort;
  }): StreamingProvider | undefined {
    const profile = input.exec.niaChatModelProfile?.normal;
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

  async function attachNiaImages(
    messages: ProviderMessage[],
    attachments: import("@natalia/contracts").LocalAttachment[] | undefined,
  ) {
    if (!attachments?.length) return;
    const attachmentService =
      ctx.ports.resolveService<AttachmentService>(ATTACHMENT_SERVICE);
    if (!attachmentService) return;
    const images = await Promise.all(
      attachments
        .filter((attachment) =>
          ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
            attachment.mediaType,
          ),
        )
        .map(async (attachment) => ({
          mediaType: attachment.mediaType as
            | "image/png"
            | "image/jpeg"
            | "image/webp"
            | "image/gif",
          dataURL: await attachmentService.dataURL(attachment),
        })),
    );
    const userMessage = messages.findLast((message) => message.role === "user");
    if (userMessage && images.length) userMessage.images = images;
  }
}
