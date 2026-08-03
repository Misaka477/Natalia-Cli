import { paste100KiB } from "@natalia/testing";
import { createWorkerRuntimeClient } from "@natalia/client";
import { MessageChannel, Worker } from "node:worker_threads";
import { runTuiShell } from "./app/runtime";
import { resolveTuiWorkspaceRoot } from "./workspace";

const smoke =
  process.env.NATALIA_TUI_SMOKE === "1" || process.argv.includes("--smoke");
const doctor = process.argv.includes("--doctor");
const diagnostics = process.argv.includes("--diagnostics");
const workspaceRoot = await resolveTuiWorkspaceRoot({
  override: process.env.NATALIA_WORKSPACE ?? argumentValue("--workspace"),
});
const requestedSessionID = argumentValue("--session");
const launchSessionID = requestedSessionID ?? newSessionID();
const createBackend = (nextSessionID?: string) => {
  const channel = new MessageChannel();
  const worker = new Worker(new URL("./runtime-worker.ts", import.meta.url), {
    workerData: {
      port: channel.port1,
      workspaceRoot,
      // An interactive launch starts a new session. A prior session is only
      // reopened via --session or an explicit selection in the session dialog.
      sessionID: nextSessionID ?? launchSessionID,
    },
    transferList: [channel.port1],
  });
  const client = createWorkerRuntimeClient(channel.port2);
  const dispose = client.dispose;
  client.dispose = async () => {
    await dispose?.();
    await worker.terminate();
  };
  return client;
};
const handle = await runTuiShell({
  initialPrompt: smoke
    ? process.env.NATALIA_TUI_SMOKE_PROMPT || paste100KiB()
    : doctor
      ? "/doctor"
      : diagnostics
        ? "/diagnostics"
        : undefined,
  fixture: smoke,
  backend: smoke ? undefined : createBackend(),
  createBackend: smoke ? undefined : createBackend,
  workspaceRoot,
  closeAfterInitialTurn: doctor || diagnostics ? false : undefined,
});

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  // A signal handler has no caller, so a failing shutdown must not become an
  // unhandled rejection: that would kill the process mid-teardown and leave the
  // terminal in the alternate screen.
  void handle.stop().catch((error: unknown) => {
    process.stderr.write(
      `natalia: shutdown failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
};

// Last resort. Anything that still escapes is reported without a raw stack
// trace over a half-restored screen, and the exit code stays non-zero so the
// failure is not silently swallowed.
process.on("unhandledRejection", (reason) => {
  process.stderr.write(
    `natalia: unhandled rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}\n`,
  );
  process.exitCode = 1;
  stop();
});

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
await new Promise<void>((resolve) => handle.renderer.once("destroy", resolve));

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (index >= 0 && (!value || value.startsWith("--")))
    throw new Error(`${name} requires an absolute or relative path`);
  return value;
}

function newSessionID() {
  return `ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}`;
}
