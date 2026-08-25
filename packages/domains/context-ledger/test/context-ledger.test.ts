import { expect, test } from "bun:test";
import type { LocalAttachment, RuntimeEvent } from "@natalia/contracts";
import { CONTEXT_LEDGER_FACTORY_SERVICE } from "@natalia/runtime-services";
import { createContextLedgerFactory } from "../src";

test("context ledger restores completed turns and tool pairs once", () => {
  const attachment: LocalAttachment = {
    id: "att-1",
    path: ".natalia/attachments/att-1.png",
    filename: "diagram.png",
    mediaType: "image/png",
    byteLength: 3,
    sha256: "fixture",
  };
  const events: RuntimeEvent[] = [
    {
      type: "turn.submitted",
      id: "turn-1",
      text: "inspect",
      byteLength: 7,
      lineCount: 1,
      sha256: "input",
      attachments: [attachment],
    },
    { type: "content.delta", id: "turn-1", text: "partial" },
    { type: "content.done", id: "turn-1", text: "final answer" },
    {
      type: "tool.update",
      id: "turn-1:tool",
      callID: "call-1",
      name: "read_file",
      status: "receiving_arguments",
      summary: "receiving",
      argumentsDelta: '{"path":"a.txt"}',
    },
    {
      type: "tool.update",
      id: "turn-1:tool",
      callID: "call-1",
      name: "read_file",
      status: "queued",
      summary: "queued",
    },
    {
      type: "tool.update",
      id: "turn-1:tool",
      callID: "call-1",
      name: "read_file",
      status: "succeeded",
      summary: "read",
      result: "contents",
    },
    {
      type: "tool.update",
      id: "turn-1:tool",
      callID: "call-1",
      name: "read_file",
      status: "succeeded",
      summary: "duplicate",
      result: "duplicate",
    },
    { type: "turn.finished", id: "turn-1", stopReason: "done" },
    { type: "content.delta", id: "turn-incomplete", text: "discard me" },
  ];

  const factory = createContextLedgerFactory();
  const context = factory.create();
  factory.restore(context, events);
  expect(context.snapshot().entries).toEqual([
    expect.objectContaining({
      id: "turn-1:user",
      role: "user",
      content: "inspect",
      attachments: [attachment],
    }),
    expect.objectContaining({
      role: "tool_call",
      pairID: "call-1",
      content: 'read_file {"path":"a.txt"}',
    }),
    expect.objectContaining({
      role: "tool_result",
      pairID: "call-1",
      content: "contents",
    }),
    expect.objectContaining({
      id: "turn-1:assistant",
      role: "assistant",
      content: "final answer",
    }),
  ]);
});

test("context ledger factory is provided under the shared service key", () => {
  const factory = createContextLedgerFactory();
  expect(CONTEXT_LEDGER_FACTORY_SERVICE).toBe("context-ledger.factory");
  expect(factory.create).toBeTypeOf("function");
  expect(factory.restore).toBeTypeOf("function");
});
