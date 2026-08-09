import { writeFile } from "node:fs/promises";
import { runTuiShell } from "../src/app/runtime";
import { initialState, reduceState } from "../src/context/state";

const handle = await runTuiShell({
  initialPrompt: "/terminal-model",
  fixture: true,
});
for (let index = 0; index < 100; index++) {
  if (handle.events.some((event) => event.type === "approval.request")) break;
  await Bun.sleep(50);
}
const firstState = handle.events.reduce(
  reduceState,
  structuredClone(initialState),
);
const approval = handle.events.find(
  (event) => event.type === "approval.request",
);
if (!approval) throw new Error("model terminal smoke missed approval request");
handle.renderer.destroy();

const summary = {
  terminal: firstState.facts.terminals.terminal_model_1,
  timeline: firstState.facts.terminalTimeline.terminal_model_1,
  approval,
  observerMode: "user writes disabled",
};
await writeFile(
  "/tmp/kilo/natalia-tui-terminal-model-latest.json",
  `${JSON.stringify(summary, null, 2)}\n`,
);
if (summary.terminal?.ownership !== "model")
  throw new Error("Terminal is not model-owned");
if (summary.terminal?.status !== "awaiting_approval")
  throw new Error("Terminal did not pause for approval");
if (!summary.timeline?.some((event) => event.status === "requested"))
  throw new Error("Terminal action timeline missing request");
console.log(JSON.stringify(summary, null, 2));
