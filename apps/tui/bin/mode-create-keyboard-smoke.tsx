import { createMockKeys } from "@opentui/core/testing";
import { resolveConfig } from "@natalia/config";
import type { RuntimeClient } from "@natalia/contracts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTuiShell } from "../src/app/runtime";

const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-mode-create-"));
const handle = await runTuiShell({
  backend: backend(),
  workspaceRoot,
  closeAfterInitialTurn: false,
  rendererSize: { width: 100, height: 28 },
});
const keys = createMockKeys(handle.renderer, { kittyKeyboard: true });

try {
  await Bun.sleep(200);
  keys.pressKey("p", { ctrl: true });
  await Bun.sleep(200);
  await keys.typeText("settings");
  keys.pressEnter();
  await Bun.sleep(300);
  await keys.typeText("agent mode");
  await Bun.sleep(150);
  keys.pressEnter();
  await Bun.sleep(400);
  keys.pressEnter();
  await Bun.sleep(500);
  await keys.typeText("review");
  keys.pressEnter();
  for (let attempts = 0; attempts < 40; attempts++) {
    const config = (await resolveConfig({ workspaceRoot })).config;
    if (config.defaultMode === "review" && config.modes.review) break;
    await Bun.sleep(50);
  }
  const config = (await resolveConfig({ workspaceRoot })).config;
  if (config.defaultMode !== "review" || !config.modes.review)
    throw new Error("Agent Mode name was not persisted through the TUI prompt");
  console.log("agent mode create keyboard smoke passed");
} finally {
  handle.stop();
  await rm(workspaceRoot, { recursive: true, force: true });
}

function backend(): RuntimeClient {
  return {
    start(onEvent) {
      onEvent({
        type: "session.created",
        sessionID: "ses_mode_create",
        title: "Mode create",
      });
      onEvent({ type: "session.ready", sessionID: "ses_mode_create" });
    },
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_mode_create",
        text,
        byteLength: new TextEncoder().encode(text).byteLength,
        lineCount: text ? text.split(/\r?\n/u).length : 0,
        sha256: "mode-create",
      };
    },
    cancel() {},
    snapshot: () => ({
      type: "snapshot.created",
      id: "mode-create",
      files: [],
    }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {},
    respondQuestion() {},
  };
}
