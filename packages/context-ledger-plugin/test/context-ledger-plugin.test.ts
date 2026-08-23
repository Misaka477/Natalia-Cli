import { expect, test } from "bun:test";
import type { LocalAttachment, RuntimeEvent } from "@natalia/contracts";
import { createPluginRegistry } from "@natalia/plugin";
import { CONTEXT_LEDGER_FACTORY_SERVICE } from "@natalia/runtime-services";
import {
  CONTEXT_LEDGER_PLUGIN_ID,
  createContextLedgerFactory,
  createContextLedgerPlugin,
} from "../src";

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

test("context ledger service is absent after plugin unload", async () => {
  const services = new Map<string, unknown>();
  const registry = createPluginRegistry({
    tools: {
      set() {},
      get() {
        return undefined;
      },
      delete() {},
    } as never,
    allowed: ["services"],
    registerOwner: () => ({
      contribute: (kind, name, value) => {
        if (kind === "services") services.set(name, value);
        return () => services.delete(name);
      },
      release: () => undefined,
    }),
    service: <T>(name: string) => services.get(name) as T | undefined,
  });

  await registry.loadBuiltin(createContextLedgerPlugin());
  expect(services.get(CONTEXT_LEDGER_FACTORY_SERVICE)).toBeDefined();
  await registry.unload(CONTEXT_LEDGER_PLUGIN_ID);
  expect(services.has(CONTEXT_LEDGER_FACTORY_SERVICE)).toBe(false);
});
