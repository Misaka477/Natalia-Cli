import type { RuntimeEvent } from "@natalia/contracts";
import { ContextLedger } from "@natalia/runtime";

export type RuntimeContextLedger = ContextLedger;

export type ContextLedgerFactory = {
  create(): RuntimeContextLedger;
  restore(context: RuntimeContextLedger, events: RuntimeEvent[]): void;
};

export function createContextLedgerFactory(): ContextLedgerFactory {
  return {
    create: () => new ContextLedger(),
    restore(context, events) {
      const assistantByID = new Map<string, string>();
      const recordedCalls = new Set<string>();
      const recordedResults = new Set<string>();
      for (const event of events) {
        if (event.type === "turn.submitted") {
          context.add({
            id: `${event.id}:user`,
            role: "user",
            content: event.text,
            attachments: event.attachments,
          });
          continue;
        }
        if (event.type === "content.delta") {
          assistantByID.set(
            event.id,
            `${assistantByID.get(event.id) ?? ""}${event.text}`,
          );
          continue;
        }
        if (event.type === "content.done" && event.text !== undefined) {
          assistantByID.set(event.id, event.text);
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
          context.add({
            id: `restore:${event.id}:call`,
            role: "tool_call",
            content: `${event.name} ${event.argumentsDelta ?? "{}"}`,
            pairID: event.callID,
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
          recordedResults.add(event.callID);
          context.add({
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
          if (content?.trim()) {
            context.add({
              id: `${event.id}:assistant`,
              role: "assistant",
              content,
            });
            assistantByID.delete(event.id);
          }
        }
      }
    },
  };
}
