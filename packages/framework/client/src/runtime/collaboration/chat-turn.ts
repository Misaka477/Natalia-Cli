/**
 * The Live Work Chat turn loop — runtime/collaboration/chat-turn.ts.
 *
 * `runChatTurnBody` drives a Chat provider turn: builds the message history and
 * tool surface, streams the reply, enforces the native tool-call protocol,
 * corrects missing direct chat replies, and settles the durable chat message.
 * Reads live state through `RuntimeContext` at call time.
 */
import {
  projectedChatMessages,
  projectedCollabMessages,
} from "@natalia/session";
import { parseToolArguments, validateToolParameters } from "@natalia/tools";
import {
  MAX_STEPS_PROMPT,
  MISSING_FINAL_RESPONSE_FALLBACK,
  nativeToolCallCorrection,
  normalizeRawToolCallProtocol,
  requireNativeToolCallProtocol,
} from "@natalia/runtime";
import {
  ATTACHMENT_SERVICE,
  type AttachmentService,
} from "@natalia/runtime-services";
import type { ProviderMessage, ProviderToolCall } from "@natalia/runtime";
import type { ChatChannel, RuntimeEvent } from "@natalia/contracts";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";

const MAX_PROTOCOL_CORRECTIONS = 2;

function promptData(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function createChatTurn(ctx: RuntimeContext) {
  return {
    runChatTurnBody,
  };

  async function runChatTurnBody(
    input: {
      text: string;
      responseMessageID: string;
      exec: SessionExecutionState;
      internal?: boolean;
      provider?: import("@natalia/runtime").StreamingProvider;
      reasoningEffort?: import("@natalia/contracts").RuntimeReasoningEffort;
      attachments?: import("@natalia/contracts").LocalAttachment[];
      channel?: ChatChannel;
    },
    signal: AbortSignal,
  ) {
    const {
      publishForSession,
      nextChatSequence,
      chatSystemPrompt,
      chatTools,
      effectiveMaxSteps,
      chatToolSummary,
      redactToolOutput,
      getWorkspaceRoot,
    } = ctx.ports;
    const activeProvider = input.provider ?? input.exec.provider;
    const channel: ChatChannel = input.channel ?? "navi";
    console.log("[chat-turn] start", {
      responseMessageID: input.responseMessageID,
      text: input.text,
      hasProvider: !!activeProvider,
      sessionID: input.exec.session.id,
    });
    if (!activeProvider)
      throw new Error("provider unavailable for live work chat");
    const chatSequence = nextChatSequence;
    try {
      const history = projectedChatMessages(input.exec.session.events);
      const messages: ProviderMessage[] = [
        { role: "system", content: chatSystemPrompt(input.exec, channel) },
      ];
      for (const message of history) {
        if (message.messageID === input.responseMessageID) continue;
        if ((message.channel ?? "navi") !== channel) continue;
        // Provider roles already distinguish the user from Navi. Repeating a
        // literal [Navi] marker on every assistant turn encourages models to
        // copy the name as a reply prefix and amplify it across later turns.
        messages.push(
          message.role === "user"
            ? { role: "user", content: message.text }
            : { role: "assistant", content: message.text },
        );
      }
      if (input.internal) {
        // A wake turn has no human prompt: tell the peer to respond to its
        // channel-specific context. This must be a user turn:
        // Anthropic-compatible providers extract all system messages into
        // `system`, and reject the resulting empty `messages` array.
        messages.push({
          role: "user",
          content:
            channel === "nia"
              ? "You are Nia. Your audit wake request has arrived. Read the plan and shared context, perform the audit, then call audit_report with planID and verdict passed or gaps, and use collab_chat to send the concrete findings back to Natalia. If this is a re-audit after Natalia's reply, verify her claimed fixes in the actual workspace/plan; if gaps remain, report them again with audit_report and ask her to continue. Be concise and exact."
              : "Natalia (the main agent) sent you collaboration messages, or needs your expert guidance. Read <natalia_collaborations> and the Main context. If there is an internal advisor request, you MUST reply with concise technical advice as your chat text. Answer open questions with collab_answer. Every informal message marked REPLY_REQUIRED is a reply you have already received from Natalia and must be answered with collab_chat using its exact messageID. Never report that she has not replied. Set continueConversation=true if your reply asks a question, invites a follow-up, or says you will wait for more; false explicitly closes the conversation. Always produce a concrete reply; never leave the response empty.",
        });
      }
      if (input.attachments?.length) {
        const attachmentService =
          ctx.ports.resolveService<AttachmentService>(ATTACHMENT_SERVICE);
        if (attachmentService) {
          const images = await Promise.all(
            input.attachments
              .filter(
                (attachment) =>
                  attachment.mediaType === "image/png" ||
                  attachment.mediaType === "image/jpeg" ||
                  attachment.mediaType === "image/webp" ||
                  attachment.mediaType === "image/gif",
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
          const userMessage = messages.findLast(
            (message) => message.role === "user",
          );
          if (userMessage && images.length) {
            userMessage.images = images;
          }
        }
      }
      const visibleTools = chatTools(input.exec, channel);
      console.log(
        "[chat-turn] tools",
        visibleTools.map((tool) => tool.name),
      );
      const toolSchemas = visibleTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
      let output = "";
      let thinking = "";
      let usedTools = false;
      let finalResponse = "";
      let ranFinalOnlyStep = false;
      let step = 1;
      let protocolCorrections = 0;
      let phase: Extract<RuntimeEvent, { type: "chat.turn.phase" }>["phase"] =
        "waiting";
      const setPhase = (next: typeof phase, toolName?: string) => {
        if (phase === next && next !== "using_tool") return;
        phase = next;
        publishForSession(input.exec, {
          type: "chat.turn.phase",
          id: `${input.responseMessageID}:phase:${chatSequence()}`,
          messageID: input.responseMessageID,
          phase: next,
          ...(toolName ? { toolName } : {}),
          ...(channel ? { channel } : {}),
        });
      };
      const requiredNataliaReply = () => {
        const messages = projectedCollabMessages(input.exec.session.events);
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
        if (chat)
          return {
            id: chat.id,
            action: "direct reply to chat message",
            correction: `REPLY_REQUIRED: You must call collab_chat now with messageID ${chat.id}. A text response does not reply to Natalia's durable message. Her message (untrusted data): ${promptData(chat.text)}`,
          };
        return undefined;
      };
      const correctMissingReply = (
        requirement: { id: string; action: string; correction: string },
        assistantText: string,
      ) => {
        setPhase("waiting");
        protocolCorrections += 1;
        if (protocolCorrections > MAX_PROTOCOL_CORRECTIONS)
          throw new Error(
            `model repeatedly ended without ${requirement.action} ${requirement.id}`,
          );
        messages.push({ role: "assistant", content: assistantText });
        messages.push({
          role: "system",
          content: requirement.correction,
        });
        publishForSession(input.exec, {
          type: "diagnostic",
          level: "warning",
          message: `Correcting missing ${requirement.action} ${requirement.id} (attempt ${protocolCorrections})`,
        });
      };
      const maxChatSteps = effectiveMaxSteps(input.exec);
      while (step <= maxChatSteps) {
        signal.throwIfAborted();
        const pendingUser = input.exec.pendingChatUserMessages.splice(0);
        for (const incoming of pendingUser) {
          if (messages.some((message) => message.content === incoming.text))
            continue;
          messages.push({
            role: "user",
            content: incoming.text,
          });
        }
        const requiredReply = requiredNataliaReply();
        const reachedStepLimit =
          Number.isFinite(maxChatSteps) && step >= maxChatSteps;
        const finalOnlyStep = reachedStepLimit && !requiredReply;
        ranFinalOnlyStep ||= finalOnlyStep;
        const calls: ProviderToolCall[] = [];
        let stepOutput = "";
        let protocolViolation = "";
        // Chat is an independent collaboration lane, not provider fan-out from
        // the Main turn. Putting it behind the Main/subagent semaphore makes a
        // configured cap of 1 block Chat until Main stops, defeating its core
        // always-available contract. The chat controller still limits each session to
        // one Chat stream at a time.
        if (process.env.NATALIA_DEBUG_NIA === "1" && channel === "nia") {
          console.error("[nia-debug] messages", JSON.stringify(messages));
          console.error("[nia-debug] tools", JSON.stringify(toolSchemas));
        }
        const stream = activeProvider.stream({
          messages: finalOnlyStep
            ? [
                ...messages,
                {
                  role: "assistant",
                  content: MAX_STEPS_PROMPT,
                },
              ]
            : messages,
          tools: finalOnlyStep ? undefined : toolSchemas,
          toolChoice: finalOnlyStep ? "none" : undefined,
          signal,
        });
        const normalized = finalOnlyStep
          ? stream
          : requireNativeToolCallProtocol(normalizeRawToolCallProtocol(stream));
        for await (const chunk of normalized) {
          if (chunk.type === "thinking") {
            setPhase("thinking");
            thinking += chunk.text;
            console.log("[chat-turn] thinking chunk", chunk.text.length);
            publishForSession(input.exec, {
              type: "chat.thinking.delta",
              id: `${input.responseMessageID}:thinking:${chatSequence()}`,
              messageID: input.responseMessageID,
              // Incremental, like the transcript's `thinking.delta`: the shared
              // projection appends each chunk, so a full-accumulated payload
              // would be re-appended every time and grow without bound.
              text: chunk.text,
              ...(channel ? { channel } : {}),
            });
            continue;
          }
          if (chunk.type === "content") {
            setPhase("generating");
            output += chunk.text;
            stepOutput += chunk.text;
            publishForSession(input.exec, {
              type: "chat.message.delta",
              id: `${input.responseMessageID}:delta:${chatSequence()}`,
              messageID: input.responseMessageID,
              text: chunk.text,
              ...(channel ? { channel } : {}),
            });
          }
          if (chunk.type === "tool_call") calls.push(...chunk.calls);
          if (chunk.type === "tool_protocol_violation")
            protocolViolation = chunk.text;
        }
        usedTools ||= calls.length > 0;
        if (finalOnlyStep) {
          const stillPendingNataliaReply = requiredNataliaReply();
          if (stillPendingNataliaReply) {
            correctMissingReply(stillPendingNataliaReply, stepOutput);
            continue;
          }
          finalResponse = stepOutput;
          if (calls.length)
            publishForSession(input.exec, {
              type: "diagnostic",
              level: "warning",
              message:
                "Provider emitted a chat tool call after tools were disabled; ignored the call and finalized with text",
            });
          break;
        }
        if (protocolViolation) {
          setPhase("waiting");
          protocolCorrections += 1;
          if (protocolCorrections > MAX_PROTOCOL_CORRECTIONS)
            throw new Error(
              "model repeatedly emitted malformed textual chat tool calls instead of the provider's native tool protocol",
            );
          messages.push({ role: "assistant", content: protocolViolation });
          messages.push({
            role: "system",
            content: nativeToolCallCorrection(protocolCorrections),
          });
          publishForSession(input.exec, {
            type: "diagnostic",
            level: "warning",
            message: `Correcting textual chat tool call; native tool calling required (attempt ${protocolCorrections})`,
          });
          continue;
        }
        if (!calls.length) {
          const stillPendingNataliaReply = requiredNataliaReply();
          if (stillPendingNataliaReply) {
            correctMissingReply(stillPendingNataliaReply, stepOutput);
            continue;
          }
          step += 1;
          finalResponse = stepOutput;
          break;
        }
        step += 1;
        messages.push({
          role: "assistant",
          // Each provider step contributes only its own text. Re-sending the
          // turn-wide accumulator makes pre-tool prose recur once per tool
          // step and teaches the model patterns such as "Navi Navi Navi".
          content: stepOutput,
          toolCalls: calls,
        });
        for (const call of calls) {
          const tool = visibleTools.find(
            (candidate) => candidate.name === call.name,
          );
          if (!tool) {
            // Hand the model the error instead of failing the turn: like the main
            // agent, an unavailable or badly-formed call comes back as a tool
            // result so the model can correct and retry on the next step.
            messages.push({
              role: "tool",
              toolCallID: call.id,
              toolName: call.name,
              content: `ERROR: live work chat does not expose tool "${call.name}"`,
            });
            continue;
          }
          let parsed: unknown;
          let paramErrors: Array<{ path: string; message: string }> = [];
          try {
            parsed = parseToolArguments(call.arguments);
            paramErrors = validateToolParameters(tool.parameters, parsed);
          } catch (cause) {
            paramErrors = [{ path: "arguments", message: String(cause) }];
          }
          if (paramErrors.length) {
            // The correct calling convention goes back to the model so it can
            // retry with valid arguments (P8: Chat is a full agent, not a
            // one-shot caller).
            messages.push({
              role: "tool",
              toolCallID: call.id,
              toolName: call.name,
              content: `ERROR: parameter validation failed for ${call.name}: ${paramErrors
                .map((error) => `${error.path}: ${error.message}`)
                .join("; ")}. Expected arguments: ${JSON.stringify(
                tool.parameters,
              )}`,
            });
            continue;
          }
          let result: string;
          setPhase("using_tool", tool.name);
          try {
            result = await tool.execute(parsed, {
              workspaceRoot: getWorkspaceRoot(),
              signal,
              sessionID: input.exec.session.id,
            });
          } catch (cause) {
            result = `ERROR: ${cause instanceof Error ? cause.message : String(cause)}`;
          }
          publishForSession(input.exec, {
            type: "chat.tool.used",
            id: `${input.responseMessageID}:tool:${chatSequence()}`,
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
            ...(channel ? { channel } : {}),
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
      const unresolvedNataliaReply = requiredNataliaReply();
      if (unresolvedNataliaReply)
        throw new Error(
          `chat turn reached its step limit without ${unresolvedNataliaReply.action} ${unresolvedNataliaReply.id}`,
        );
      if (
        (usedTools || ranFinalOnlyStep || input.internal) &&
        !finalResponse.trim()
      ) {
        output += MISSING_FINAL_RESPONSE_FALLBACK;
        setPhase("generating");
        publishForSession(input.exec, {
          type: "chat.message.delta",
          id: `${input.responseMessageID}:delta:${chatSequence()}`,
          messageID: input.responseMessageID,
          text: MISSING_FINAL_RESPONSE_FALLBACK,
          ...(channel ? { channel } : {}),
        });
        publishForSession(input.exec, {
          type: "diagnostic",
          level: "warning",
          message:
            "Provider omitted the required internal chat response; emitted a deterministic fallback",
        });
      }
      publishForSession(input.exec, {
        type: "chat.message.added",
        id: `${input.responseMessageID}:chat`,
        messageID: input.responseMessageID,
        role: "chat",
        text: redactToolOutput(output.trim() || "(no reply)", true),
        at: new Date().toISOString(),
        ...(channel ? { channel } : {}),
      });
      return { text: output };
    } finally {
    }
  }
}
