import { createTuiAdapterHost } from "./tui-adapter";
import { resolveTuiWorkspaceRoot } from "./workspace";

const smoke =
  process.env.NATALIA_TUI_SMOKE === "1" || process.argv.includes("--smoke");
const doctor = process.argv.includes("--doctor");
const diagnostics = process.argv.includes("--diagnostics");
const workspaceRoot = await resolveTuiWorkspaceRoot({
  override: process.env.NATALIA_WORKSPACE ?? argumentValue("--workspace"),
});
const host = await createTuiAdapterHost({
  workspaceRoot,
  sessionID: argumentValue("--session"),
  smoke,
  doctor,
  diagnostics,
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
