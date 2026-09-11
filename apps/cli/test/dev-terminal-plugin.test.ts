import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRealRuntimeClient } from "@natalia/client";
import { CapabilityRegistry } from "@natalia/capability";
import { TERMINAL_CONTROLLER_SERVICE } from "@natalia/runtime-services";
import { initializeOfficialPluginsForHostCommand } from "../src/official-plugins";

test("dev official terminal plugin shim loads and starts a PTY", async () => {
  await initializeOfficialPluginsForHostCommand(["serve"]);
  const storeRoot = resolve(
    import.meta.dir,
    "../../..",
    "dist/ts/plugin-store",
  );
  const packageRoot = join(
    storeRoot,
    "node_modules/@natalia/plugin-native-terminal",
  );
  const manifest = (await Bun.file(
    join(packageRoot, "natalia.plugin.json"),
  ).json()) as { entry: string };
  const shim = join(packageRoot, manifest.entry);
  const loaded = (await import(pathToFileURL(shim).href)) as {
    default?: unknown;
  };
  expect(typeof loaded.default).toBe("function");

  const root = await mkdtemp(join(tmpdir(), "natalia-dev-pty-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 3,
      runtime: { terminal: { windowMode: "windowless" } },
    }),
  );
  const kernel = new CapabilityRegistry();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_dev_pty",
    pluginStoreRoot: storeRoot,
    capabilityRegistry: kernel,
    sessionDir: join(root, ".natalia", "sessions"),
    checkpointDir: join(root, ".natalia", "checkpoints"),
  });
  try {
    client.start(() => undefined);
    await client.runtimeStatus?.();
    expect(kernel.has("natalia-tool-terminal")).toBe(true);
    expect(kernel.service(TERMINAL_CONTROLLER_SERVICE)).toBeDefined();
    const started = await client.nativeTerminalStart?.({
      command: "bash",
      id: "ses_dev_pty",
      sessionID: "ses_dev_pty",
    });
    expect(started?.host).toBe("pty");
    expect(started?.status).toBe("running");
    const promptDeadline = Date.now() + 10_000;
    let prompt = await client.nativeTerminalRead?.(started!.id);
    while (!prompt?.text.includes(">") && Date.now() < promptDeadline) {
      await Bun.sleep(50);
      prompt = await client.nativeTerminalRead?.(started!.id);
    }
    expect(prompt?.text).toContain(">");
    await client.nativeTerminalWrite?.({
      id: started!.id,
      input: "printf '__PTY_READY__\\n'\n",
    });
    const deadline = Date.now() + 5_000;
    let snapshot = await client.nativeTerminalRead?.(started!.id);
    while (!snapshot?.text.includes("__PTY_READY__") && Date.now() < deadline) {
      await Bun.sleep(50);
      snapshot = await client.nativeTerminalRead?.(started!.id);
    }
    expect(snapshot?.text).toContain("__PTY_READY__");
  } finally {
    await client.dispose?.();
  }
}, 30_000);
