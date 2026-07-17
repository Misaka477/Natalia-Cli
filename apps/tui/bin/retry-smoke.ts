import { writeFile } from "node:fs/promises";
import { runTuiShell } from "../src/app/runtime";
import { initialState, reduceState } from "../src/context/state";

const handle = await runTuiShell({ initialPrompt: "/retry M9 smoke" });
let finished = false;
for (let index = 0; index < 100; index++) {
  if (handle.events.some((event) => event.type === "turn.finished")) {
    finished = true;
    break;
  }
  await Bun.sleep(50);
}
if (finished) {
  await Bun.sleep(150);
} else {
  handle.stop();
}

const stepRetry = handle.events.find((event) => event.type === "step.retry");
const cleared = handle.events.find(
  (event) => event.type === "step.retry.cleared",
);
const content = handle.events
  .filter((event) => event.type === "content.delta")
  .map((event) => event.text)
  .join("");
const finalState = handle.events.reduce(
  reduceState,
  structuredClone(initialState),
);
const finalAssistant = finalState.messages
  .filter((message) => message.role === "assistant")
  .at(-1)?.text;
const summary = {
  stepRetry,
  cleared,
  rawTransientContent: content,
  finalAssistant,
  eventCount: handle.events.length,
};
await writeFile(
  "/tmp/kilo/natalia-tui-retry-latest.json",
  `${JSON.stringify(summary, null, 2)}\n`,
);
if (!stepRetry) throw new Error("retry smoke did not emit step.retry");
if (!cleared) throw new Error("retry smoke did not emit step.retry.cleared");
if (!finalAssistant?.includes("partial duplicate content committed once."))
  throw new Error("retry smoke final history missed committed content");
if (finalAssistant.includes("# Retry demo\n\n# Retry demo"))
  throw new Error("failed retry transient prefix leaked into final history");
console.log(JSON.stringify(summary, null, 2));
