import { resolveConfig } from "@natalia/config";
import { createTuiAdapterHost, TUI_PLUGIN_ID } from "./tui-adapter";
import { resolveTuiWorkspaceRoot } from "./workspace";

const smoke =
  process.env.NATALIA_TUI_SMOKE === "1" || process.argv.includes("--smoke");
const doctor = process.argv.includes("--doctor");
const diagnostics = process.argv.includes("--diagnostics");
const workspaceRoot = await resolveTuiWorkspaceRoot({
  override: process.env.NATALIA_WORKSPACE ?? argumentValue("--workspace"),
});
const config = await resolveConfig({
  workspaceRoot,
  ...(process.env.NATALIA_CONFIG
    ? { globalPath: process.env.NATALIA_CONFIG }
    : {}),
});
const host = await createTuiAdapterHost({
  workspaceRoot,
  sessionID: argumentValue("--session"),
  smoke,
  doctor,
  diagnostics,
  enabled: config.config.plugins.enabled[TUI_PLUGIN_ID] !== false,
});
try {
  await host.done;
} finally {
  await host.close();
}

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (index >= 0 && (!value || value.startsWith("--")))
    throw new Error(`${name} requires an absolute or relative path`);
  return value;
}
