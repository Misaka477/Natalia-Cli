import {
  projectedChatMessages,
  projectedCollabMessages,
} from "@natalia/session";
import type { ProviderMessage } from "@natalia/runtime";
import type { SessionExecutionState } from "../context";

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
