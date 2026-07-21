import { createMockKeys } from "@opentui/core/testing";
import type { RuntimeClient } from "@natalia/contracts";
import { configV2Schema } from "@natalia/contracts";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTuiShell } from "../src/app/runtime";

const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-provider-ui-"));
const requests: Array<{ path: string; authorization: string | null }> = [];
const server = Bun.serve({
  port: 0,
  fetch(request) {
    requests.push({
      path: new URL(request.url).pathname,
      authorization: request.headers.get("authorization"),
    });
    return Response.json({ data: [{ id: "remote-model" }] });
  },
});

const handle = await runTuiShell({
  backend: backend(),
  workspaceRoot,
  closeAfterInitialTurn: false,
  rendererSize: { width: 100, height: 28 },
});
const keys = createMockKeys(handle.renderer, { kittyKeyboard: true });

try {
  await Bun.sleep(150);
  keys.pressKey("p", { ctrl: true });
  await Bun.sleep(80);
  await keys.typeText("settings");
  keys.pressEnter();
  await Bun.sleep(200);

  keys.pressEnter();
  await Bun.sleep(100);

  keys.pressEnter();
  await Bun.sleep(80);
  await keys.typeText("private-provider");
  keys.pressEnter();
  await Bun.sleep(80);
  await keys.typeText("secret-key");
  keys.pressEnter();
  await Bun.sleep(80);
  await keys.typeText(server.url.toString());
  keys.pressEnter();
  for (let attempts = 0; attempts < 40 && requests.length === 0; attempts++)
    await Bun.sleep(50);
  if (!requests.length) throw new Error("Provider model discovery request was not sent");
  await Bun.sleep(250);
  keys.pressEnter();

  const path = join(workspaceRoot, ".natalia", "config.json");
  let persisted: ReturnType<typeof configV2Schema.parse> | undefined;
  for (let attempts = 0; attempts < 20; attempts++) {
    try {
      persisted = configV2Schema.parse(JSON.parse(await readFile(path, "utf8")));
      break;
    } catch {
      await Bun.sleep(50);
    }
  }
  if (!persisted)
    throw new Error(
      `Provider setup did not create config.json; requests=${JSON.stringify(requests)}`,
    );
  if (persisted.providers["private-provider"]?.apiKey !== "secret-key")
    throw new Error("Provider API key was not persisted");
  if (persisted.models[persisted.defaultModel]?.model !== "remote-model")
    throw new Error("Discovered model was not selected and persisted");
  if (
    JSON.stringify(requests) !==
    JSON.stringify([
      { path: "/v1/models", authorization: "Bearer secret-key" },
    ])
  )
    throw new Error(`Unexpected provider discovery request: ${JSON.stringify(requests)}`);

  console.log("provider config keyboard smoke passed");
} finally {
  handle.stop();
  server.stop(true);
  await rm(workspaceRoot, { recursive: true, force: true });
}

function backend(): RuntimeClient {
  return {
    start(onEvent) {
      onEvent({ type: "session.created", sessionID: "ses_provider_ui", title: "Provider UI" });
      onEvent({ type: "session.ready", sessionID: "ses_provider_ui" });
    },
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_provider_ui",
        text,
        byteLength: new TextEncoder().encode(text).byteLength,
        lineCount: text ? text.split(/\r?\n/u).length : 0,
        sha256: "provider-ui",
      };
    },
    cancel() {},
    snapshot() {
      return { type: "snapshot.created", id: "provider-ui", files: [] };
    },
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {},
    respondQuestion() {},
  };
}
