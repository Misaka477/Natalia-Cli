import { expect, test } from "bun:test";
import type { RuntimeEvent, RuntimeSessionSummary } from "@natalia/contracts";
import { createWebRuntimeClient } from "./runtime-rpc";

test("browser startup respects the runtime selection and retains background events during attach", async () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const keys = [
    "electron",
    "localStorage",
    "__nataliaReplayingHistory",
    "__nataliaSessionLoadToken",
  ];
  const previous = new Map(keys.map((key) => [key, globals[key]]));
  const listeners = new Map<string, (event: unknown) => void>();
  const attached: string[] = [];
  const events: RuntimeEvent[] = [];
  const session = (
    id: string,
    lastAccessedAt: string,
  ): RuntimeSessionSummary => ({
    id,
    title: id,
    createdAt: lastAccessedAt,
    lastAccessedAt,
    pinned: false,
    events: 1,
    pendingInputs: 0,
    cancelled: false,
    resumable: true,
  });
  globals.localStorage = { getItem: () => "ses_stale_browser" };
  globals.electron = {
    on(name: string, listener: (event: unknown) => void) {
      listeners.set(name, listener);
      return () => listeners.delete(name);
    },
    async invoke(
      _command: string,
      args: { method: string; params: Record<string, unknown> },
    ) {
      if (args.method === "session.list")
        return [
          session("ses_selected", "2026-01-01T00:00:00Z"),
          session("ses_stale_browser", "2026-09-01T00:00:00Z"),
        ];
      if (args.method === "runtime.status")
        return { type: "status.snapshot", sessionID: "ses_selected" };
      if (args.method === "session.attach") {
        attached.push(String(args.params.id));
        listeners.get("natalia-runtime-event")?.({
          type: "navi.chat.message.delta",
          id: "background_delta",
          sessionID: "ses_background",
          messageID: "background_message",
          text: "continues in background",
        });
        return { sessionID: args.params.id };
      }
      return undefined;
    },
  };
  try {
    const client = createWebRuntimeClient({ url: "" });
    await client.start((event) => events.push(event));
    expect(attached).toEqual(["ses_selected"]);
    expect(events).toContainEqual({
      type: "navi.chat.message.delta",
      id: "background_delta",
      sessionID: "ses_background",
      messageID: "background_message",
      text: "continues in background",
    });
    expect(await client.sessionAttach?.("ses_next")).toEqual({
      sessionID: "ses_next",
    });
  } finally {
    for (const key of keys) {
      if (previous.get(key) === undefined) delete globals[key];
      else globals[key] = previous.get(key);
    }
  }
});
