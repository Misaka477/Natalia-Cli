import { writeFile } from "node:fs/promises";
import { runTuiShell } from "../src/app/runtime";
import { initialState, reduceState } from "../src/context/state";

const terminal = await runPrompt("/terminal");
const sandbox = await runPrompt("/sandbox");
const events = [...terminal.events, ...sandbox.events];
const state = events.reduce(reduceState, structuredClone(initialState));
const summary = {
  terminalUpdate: events.find((event) => event.type === "terminal.update"),
  terminalAction: events.find((event) => event.type === "terminal.action"),
  sandboxUpdate: events.find((event) => event.type === "sandbox.update"),
  sandboxDiff: events.find((event) => event.type === "sandbox.diff"),
  sandboxAudit: events.find((event) => event.type === "sandbox.audit"),
  terminalBlock: state.messages.find((message) =>
    message.id.startsWith("terminal:"),
  )?.text,
  sandboxBlock: state.messages.find(
    (message) => message.id === "sandbox:box_m11",
  )?.text,
  eventCount: events.length,
};

await writeFile(
  "/tmp/kilo/natalia-tui-terminal-sandbox-latest.json",
  `${JSON.stringify(summary, null, 2)}\n`,
);
if (!summary.terminalUpdate)
  throw new Error("Terminal smoke missed terminal.update");
if (!summary.sandboxUpdate)
  throw new Error("Sandbox smoke missed sandbox.update");
if (!summary.sandboxDiff) throw new Error("Sandbox smoke missed sandbox.diff");
if (!summary.sandboxAudit)
  throw new Error("Sandbox smoke missed sandbox.audit");
if (summary.terminalBlock?.includes("secret"))
  throw new Error("Terminal sensitive input leaked");
console.log(JSON.stringify(summary, null, 2));

async function runPrompt(initialPrompt: string) {
  const handle = await runTuiShell({ initialPrompt, fixture: true });
  for (let index = 0; index < 100; index++) {
    if (handle.events.some((event) => event.type === "turn.finished")) break;
    await Bun.sleep(50);
  }
  await Bun.sleep(300);
  return handle;
}
