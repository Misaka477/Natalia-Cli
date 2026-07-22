import { paste100KiB } from "@natalia/testing";
import { createRealRuntimeClient } from "@natalia/client";
import { runTuiShell } from "./app/runtime";
import { resolveTuiWorkspaceRoot } from "./workspace";

const smoke =
  process.env.NATALIA_TUI_SMOKE === "1" || process.argv.includes("--smoke");
const doctor = process.argv.includes("--doctor");
const diagnostics = process.argv.includes("--diagnostics");
const workspaceRoot = await resolveTuiWorkspaceRoot({
  override: process.env.NATALIA_WORKSPACE ?? argumentValue("--workspace"),
});
const sessionID = argumentValue("--session");
const createBackend = (nextSessionID?: string) =>
  createRealRuntimeClient({
    workspaceRoot,
    sessionID: (nextSessionID ?? sessionID) as never,
  });
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

process.once("SIGINT", () => handle.stop());
process.once("SIGTERM", () => handle.stop());
await new Promise<void>((resolve) => handle.renderer.once("destroy", resolve));

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (index >= 0 && (!value || value.startsWith("--")))
    throw new Error(`${name} requires an absolute or relative path`);
  return value;
}
