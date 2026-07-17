import { writeFile } from "node:fs/promises";
import { runTuiShell } from "../src/app/runtime";
import { initialState, reduceState } from "../src/context/state";

const pty = await runPrompt("/pty");
const sandbox = await runPrompt("/sandbox");
const events = [...pty.events, ...sandbox.events];
const state = events.reduce(reduceState, structuredClone(initialState));
const summary = {
  ptyUpdate: events.find((event) => event.type === "pty.update"),
  ptyAction: events.find((event) => event.type === "pty.action"),
  sandboxUpdate: events.find((event) => event.type === "sandbox.update"),
  sandboxDiff: events.find((event) => event.type === "sandbox.diff"),
  sandboxAudit: events.find((event) => event.type === "sandbox.audit"),
  ptyBlock: state.messages.find((message) => message.id.startsWith("pty:"))
    ?.text,
  sandboxBlock: state.messages.find(
    (message) => message.id === "sandbox:box_m11",
  )?.text,
  eventCount: events.length,
};

await writeFile(
  "/tmp/kilo/natalia-tui-pty-sandbox-latest.json",
  `${JSON.stringify(summary, null, 2)}\n`,
);
if (!summary.ptyUpdate) throw new Error("PTY smoke missed pty.update");
if (!summary.sandboxUpdate)
  throw new Error("Sandbox smoke missed sandbox.update");
if (!summary.sandboxDiff) throw new Error("Sandbox smoke missed sandbox.diff");
if (!summary.sandboxAudit)
  throw new Error("Sandbox smoke missed sandbox.audit");
if (summary.ptyBlock?.includes("secret"))
  throw new Error("PTY sensitive input leaked");
console.log(JSON.stringify(summary, null, 2));

async function runPrompt(initialPrompt: string) {
  const handle = await runTuiShell({ initialPrompt });
  for (let index = 0; index < 100; index++) {
    if (handle.events.some((event) => event.type === "turn.finished")) break;
    await Bun.sleep(50);
  }
  await Bun.sleep(300);
  return handle;
}
