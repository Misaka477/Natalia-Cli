import type { RuntimeEvent } from "@natalia/contracts";
import { ContextLedger } from "@natalia/runtime";
import type {
  ContextLedgerFactory,
  RuntimeContextLedger,
} from "@natalia/runtime-services";
import { perfLog } from "@natalia/runtime-services";

export function createContextLedgerFactory(): ContextLedgerFactory {
  return {
    create: () => new ContextLedger(),
    restore(context, events) {
      const restoreStart = performance.now();
      let addMs = 0;
      const add = (entry: Parameters<ContextLedger["add"]>[0]) => {
        const addStart = performance.now();
        context.add(entry);
        addMs += performance.now() - addStart;
      };
      const assistantByID = new Map<string, string>();
      const reasoningByTurnID = new Map<
        string,
        {
          reasoningContent?: string;
          reasoningField?: string;
          reasoningSignature?: string;
          reasoningRedacted?: boolean;
          reasoningBlocks?: import("@natalia/contracts").ProviderReasoningBlock[];
        }
      >();
      const textSignatureByTurnID = new Map<string, string>();
      const recordedCalls = new Set<string>();
      const recordedResults = new Set<string>();
      for (const event of events) {
        if (event.type === "turn.submitted") {
          add({
            id: `${event.id}:user`,
            role: "user",
            content: event.text,
            attachments: event.attachments,
          });
          continue;
        }
        if (event.type === "turn.input") {
          // A `next-step` injected into a running turn is a first-class user
          // message; replay must reconstruct it or the resumed context loses it.
          add({
            id: `${event.inputID}:user`,
            role: event.internal ? "system" : "user",
            content: event.text,
          });
          continue;
        }
        if (event.type === "thinking.done") {
          const reasoning = {
            ...(event.text !== undefined
              ? { reasoningContent: event.text }
              : {}),
            ...(event.reasoningField
              ? { reasoningField: event.reasoningField }
              : {}),
            ...(event.reasoningSignature
              ? { reasoningSignature: event.reasoningSignature }
              : {}),
            ...(event.reasoningRedacted ? { reasoningRedacted: true } : {}),
            ...(event.reasoningBlocks?.length
              ? { reasoningBlocks: event.reasoningBlocks }
              : {}),
          };
          if (Object.keys(reasoning).length > 0)
            reasoningByTurnID.set(event.id, reasoning);
          continue;
        }
        if (event.type === "content.delta") {
          assistantByID.set(
            event.id,
            `${assistantByID.get(event.id) ?? ""}${event.text}`,
          );
          continue;
        }
        if (event.type === "content.done") {
          if (event.text !== undefined) assistantByID.set(event.id, event.text);
          if (event.textSignature)
            textSignatureByTurnID.set(event.id, event.textSignature);
          continue;
        }
        if (
          event.type === "tool.update" &&
          event.callID &&
          !recordedCalls.has(event.callID) &&
          (event.status === "receiving_arguments" ||
            event.status === "queued" ||
            event.status === "awaiting_approval")
        ) {
          recordedCalls.add(event.callID);
          const turnID = event.id.slice(0, event.id.lastIndexOf(":"));
          const reasoning = reasoningByTurnID.get(turnID);
          const textSignature = textSignatureByTurnID.get(turnID);
          add({
            id: `restore:${event.id}:call`,
            role: "tool_call",
            content: `${event.name} ${event.argumentsDelta ?? "{}"}`,
            pairID: event.callID,
            ...(reasoning ?? {}),
            ...(textSignature ? { textSignature } : {}),
            ...(event.thoughtSignature
              ? { thoughtSignature: event.thoughtSignature }
              : {}),
          });
          continue;
        }
        if (
          event.type === "tool.update" &&
          event.callID &&
          !recordedResults.has(event.callID) &&
          ["succeeded", "failed", "rejected", "cancelled"].includes(
            event.status,
          )
        ) {
          // Terminal tool.update events are durable, while queued/running
          // markers are live. If the initial call marker is not in the replay
          // set, reconstruct a tool_call from the terminal event so the
          // provider still sees the call/result pair.
          if (!recordedCalls.has(event.callID)) {
            recordedCalls.add(event.callID);
            const turnID = event.id.slice(0, event.id.lastIndexOf(":"));
            const reasoning = reasoningByTurnID.get(turnID);
            const textSignature = textSignatureByTurnID.get(turnID);
            add({
              id: `restore:${event.id}:call`,
              role: "tool_call",
              content: `${event.name} ${event.argumentsDelta ?? "{}"}`,
              pairID: event.callID,
              ...(reasoning ?? {}),
              ...(textSignature ? { textSignature } : {}),
              ...(event.thoughtSignature
                ? { thoughtSignature: event.thoughtSignature }
                : {}),
            });
          }
          recordedResults.add(event.callID);
          add({
            id: `restore:${event.id}:result`,
            role: "tool_result",
            content:
              event.result ??
              (event.status === "succeeded"
                ? event.summary
                : `ERROR: ${event.summary}`),
            pairID: event.callID,
          });
          continue;
        }
        if (event.type === "turn.finished") {
          const content = assistantByID.get(event.id);
          const textSignature = textSignatureByTurnID.get(event.id);
          if (content?.trim() || textSignature) {
            add({
              id: `${event.id}:assistant`,
              role: "assistant",
              content: content ?? "",
              ...(textSignature ? { textSignature } : {}),
            });
            assistantByID.delete(event.id);
            textSignatureByTurnID.delete(event.id);
          }
        }
      }
      perfLog(
        `[perf] contextLedgerFactory.restore events=${events.length} entries=${context.snapshot().entries.length} add=${addMs.toFixed(1)}ms total=${(performance.now() - restoreStart).toFixed(1)}ms`,
      );
    },
  };
}
