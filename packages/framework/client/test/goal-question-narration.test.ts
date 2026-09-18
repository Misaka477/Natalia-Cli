import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@natalia/contracts";
import { lastAssistantNarration } from "../src/runtime/collaboration/boundary";

function contentDone(id: string, text: string): RuntimeEvent {
  return {
    type: "content.done",
    id,
    text,
    ...({} as Record<string, never>),
  } as RuntimeEvent;
}

test("lastAssistantNarration returns the latest assistant content.done text", () => {
  const events: RuntimeEvent[] = [
    contentDone("a", "first narration"),
    { type: "turn.finished", id: "t1", stopReason: "done" } as RuntimeEvent,
    contentDone("b", "  latest narration  "),
  ];
  // The most recent content.done wins, trimmed.
  expect(lastAssistantNarration(events)).toBe("latest narration");
});

test("lastAssistantNarration ignores non-assistant/empty turns", () => {
  // No content.done at all (a silent / tool-only turn) -> undefined.
  expect(
    lastAssistantNarration([
      { type: "turn.finished", id: "t1", stopReason: "done" } as RuntimeEvent,
    ]),
  ).toBeUndefined();
  // Whitespace-only content is not narration.
  expect(lastAssistantNarration([contentDone("a", "   ")])).toBeUndefined();
});
