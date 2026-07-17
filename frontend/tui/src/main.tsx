import { paste100KiB } from "./testing/data";
import { runTuiShell } from "./app/runtime";

const smoke =
  process.env.NATALIA_TUI_SMOKE === "1" || process.argv.includes("--smoke");
const handle = await runTuiShell({
  initialPrompt: smoke ? paste100KiB() : undefined,
});

process.once("SIGINT", () => handle.stop());
process.once("SIGTERM", () => handle.stop());
await new Promise<void>((resolve) => handle.renderer.once("destroy", resolve));
