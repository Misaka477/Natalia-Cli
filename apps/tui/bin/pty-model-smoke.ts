import { writeFile } from "node:fs/promises";
import { runTuiShell } from "../src/app/runtime";
import { initialState, reduceState } from "../src/context/state";

const handle = await runTuiShell({ initialPrompt: "/pty-model" });
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
if (!approval) throw new Error("model PTY smoke missed approval request");
handle.renderer.destroy();

const summary = {
  pty: firstState.pty.pty_model_1,
  timeline: firstState.ptyTimeline.pty_model_1,
  approval,
  observerMode: "user writes disabled",
};
await writeFile(
  "/tmp/kilo/natalia-tui-pty-model-latest.json",
  `${JSON.stringify(summary, null, 2)}\n`,
);
if (summary.pty?.ownership !== "model")
  throw new Error("PTY is not model-owned");
if (summary.pty?.status !== "awaiting_approval")
  throw new Error("PTY did not pause for approval");
if (!summary.timeline?.some((event) => event.status === "requested"))
  throw new Error("PTY action timeline missing request");
console.log(JSON.stringify(summary, null, 2));
