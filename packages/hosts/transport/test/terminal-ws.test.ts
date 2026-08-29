import { expect, test } from "bun:test";
import type {
  RuntimeClient,
  RuntimeNativeTerminalSession,
} from "@natalia/contracts";
import { createRuntimeHttpServer } from "../src/host";
import {
  matchTerminalPath,
  authorizeTerminalSession,
} from "../src/terminal-ws";

test("matchTerminalPath extracts session and terminal ids", () => {
  expect(matchTerminalPath("/terminal/ses_abc/term_1")).toEqual({
    sessionID: "ses_abc",
    terminalID: "term_1",
  });
  expect(matchTerminalPath("/rpc")).toBeUndefined();
});

test("authorizeTerminalSession respects credential session grants", () => {
  expect(authorizeTerminalSession("ses_a", undefined)).toBe(true);
  expect(
    authorizeTerminalSession("ses_a", {
      write: true,
      sessions: new Set(["ses_a"]),
    }),
  ).toBe(true);
  expect(
    authorizeTerminalSession("ses_b", {
      write: true,
      sessions: new Set(["ses_a"]),
    }),
  ).toBe(false);
});

test("HTTP terminal websocket is gated behind terminalWrite", async () => {
  const client: RuntimeClient = {
    start() {},
    async submit() {
      return {
        type: "turn.submitted",
        id: "t",
        text: "",
        byteLength: 0,
        lineCount: 1,
        sha256: "0",
      };
    },
    async cancel() {},
    snapshot() {
      return { type: "diagnostic", level: "info", message: "stub" };
    },
    diagnostic() {},
    lastSubmission() {
      return undefined;
    },
    async respondApproval() {
      return { accepted: true };
    },
    async respondQuestion() {
      return { accepted: true };
    },
  };
  const closed = createRuntimeHttpServer({ client });
  const denied = await fetch(`${closed.url}/terminal/ses_a/term_1`);
  expect(denied.status).toBe(403);
  closed.stop(true);

  const sessions: RuntimeNativeTerminalSession[] = [];
  const writes: string[] = [];
  const open = createRuntimeHttpServer({
    client: {
      ...client,
      async nativeTerminalList() {
        return sessions;
      },
      async nativeTerminalStart(input) {
        const session: RuntimeNativeTerminalSession = {
          id: input.id ?? "term_1",
          host: "pty",
          paneID: 1,
          windowID: 0,
          muxWindowID: 0,
          tabID: 0,
          command: input.command,
          cwd: input.cwd ?? "",
          status: "running",
          inputOwner: "model",
          geometryOwner: "human",
          secureInput: false,
          rows: 24,
          cols: 80,
          startedAt: new Date().toISOString(),
          attached: true,
        };
        sessions.push(session);
        return session;
      },
      async nativeTerminalRead(id) {
        return { id, text: "prompt$ " };
      },
      async nativeTerminalWrite(input) {
        writes.push(input.input);
        return {
          id: input.id,
          writtenBytes: input.input.length,
          delivery: "accepted",
        };
      },
      subscribeTerminalOutput(_id, listener) {
        listener("live\n");
        return () => undefined;
      },
    },
    terminalWrite: true,
  });
  const ws = new WebSocket(
    `${open.url.replace("http", "ws")}/terminal/ses_a/term_web`,
  );
  const messages: unknown[] = [];
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("ws failed"));
  });
  await new Promise<void>((resolve) => {
    ws.onmessage = (event) => {
      messages.push(JSON.parse(String(event.data)));
      if (messages.length >= 3) resolve();
    };
  });
  expect(messages).toEqual([
    expect.objectContaining({ type: "ready", id: "term_web" }),
    { type: "output", data: "prompt$ " },
    { type: "output", data: "live\n" },
  ]);
  ws.send(JSON.stringify({ type: "input", data: "ls\n" }));
  await Bun.sleep(50);
  expect(writes).toEqual(["ls\n"]);
  ws.close();
  open.stop(true);
});
