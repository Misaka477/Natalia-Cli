import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRealRuntimeClient } from "@natalia/client";
import { runTuiShell } from "../src/app/runtime";

const root = await mkdtemp(join(tmpdir(), "natalia-tui-real-"));
const events: string[] = [];
const backend = createRealRuntimeClient({
  workspaceRoot: root,
  sessionID: "ses_tui_real_smoke",
  provider: scriptedProvider(),
  permissionMode: "auto",
});

await runTuiShell({
  backend,
  initialPrompt: "Use read_file on missing.txt and answer briefly",
  onEvent: (event) => events.push(event.type),
});

await waitFor(() => events.includes("turn.finished"));

if (!events.includes("tool.update"))
  throw new Error("real TUI smoke missed tool.update");
if (!events.includes("content.delta"))
  throw new Error("real TUI smoke missed content.delta");
console.log("real runtime TUI smoke passed");

type ScriptedProvider = {
  provider: string;
  model: string;
  stream(request: { messages: Array<{ role: string }> }): AsyncIterable<
    | {
        type: "tool_call";
        calls: Array<{ id: string; name: string; arguments: string }>;
      }
    | { type: "content"; text: string }
    | { type: "done" }
  >;
};

function scriptedProvider(): ScriptedProvider {
  return {
    provider: "scripted-tui",
    model: "scripted-tui-model",
    async *stream(request: { messages: Array<{ role: string }> }) {
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_read_missing",
              name: "read_file",
              arguments: JSON.stringify({ path: "missing.txt" }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "I saw the real tool result." };
      yield { type: "done" };
    },
  };
}

async function waitFor(predicate: () => boolean) {
  for (let index = 0; index < 200; index++) {
    if (predicate()) return;
    await Bun.sleep(25);
  }
  throw new Error("timed out waiting for TUI smoke");
}
