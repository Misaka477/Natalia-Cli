import { createMockKeys } from "@opentui/core/testing";
import { resolveConfig } from "@natalia/config";
import type { RuntimeClient } from "@natalia/contracts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTuiShell } from "../src/app/runtime";

const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-anthropic-ui-"));
const handle = await runTuiShell({
  backend: backend(),
  workspaceRoot,
  closeAfterInitialTurn: false,
  rendererSize: { width: 100, height: 28 },
});
const keys = createMockKeys(handle.renderer, { kittyKeyboard: true });

try {
  await Bun.sleep(100);
  keys.pressKey("p", { ctrl: true });
  await Bun.sleep(50);
  await keys.typeText("settings");
  keys.pressEnter();
  await Bun.sleep(100);
  keys.pressEnter();
  await Bun.sleep(80);
  await keys.typeText("anthropic compatible");
  keys.pressEnter();
  await Bun.sleep(80);
  await keys.typeText("gateway-anthropic");
  keys.pressEnter();
  await Bun.sleep(80);
  await keys.typeText("test-key");
  keys.pressEnter();
  await Bun.sleep(80);
  await keys.typeText("https://gateway.example/v1");
  keys.pressEnter();
  await Bun.sleep(80);
  await keys.typeText("claude-compatible-model");
  keys.pressEnter();
  for (let attempts = 0; attempts < 20; attempts++) {
    const config = (await resolveConfig({ workspaceRoot })).config;
    if (config.providers["gateway-anthropic"]) break;
    await Bun.sleep(50);
  }
  const config = (await resolveConfig({ workspaceRoot })).config;
  if (
    config.providers["gateway-anthropic"]?.type !== "anthropic-compatible" ||
    config.models[config.defaultModel]?.model !== "claude-compatible-model"
  )
    throw new Error("Anthropic-compatible provider was not persisted");
  console.log("anthropic-compatible provider setup smoke passed");
} finally {
  handle.stop();
  await rm(workspaceRoot, { recursive: true, force: true });
}

function backend(): RuntimeClient {
  return {
    start(onEvent) {
      onEvent({
        type: "session.created",
        sessionID: "ses_anthropic_setup",
        title: "Anthropic setup",
      });
      onEvent({ type: "session.ready", sessionID: "ses_anthropic_setup" });
    },
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_anthropic_setup",
        text,
        byteLength: new TextEncoder().encode(text).byteLength,
        lineCount: text ? text.split(/\r?\n/u).length : 0,
        sha256: "anthropic-setup",
      };
    },
    cancel() {},
    snapshot: () => ({
      type: "snapshot.created",
      id: "anthropic-setup",
      files: [],
    }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {},
    respondQuestion() {},
  };
}
