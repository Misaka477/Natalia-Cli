import { writeFile } from "node:fs/promises";
import { runTuiShell } from "../src/app/runtime";
import { initialState, reduceState } from "../src/context/state";

const handle = await runTuiShell({
  initialPrompt: "/compact preserve current task",
  fixture: true,
});
let finished = false;
for (let index = 0; index < 100; index++) {
  if (handle.events.some((event) => event.type === "turn.finished")) {
    finished = true;
    break;
  }
  await Bun.sleep(50);
}
if (finished) await Bun.sleep(150);
else handle.stop();

const begin = handle.events.find((event) => event.type === "compaction.begin");
const retry = handle.events.find(
  (event) => event.type === "step.retry" && event.operation === "compaction",
);
const end = handle.events.find((event) => event.type === "compaction.end");
const statuses = handle.events.filter(
  (event) => event.type === "context.status",
);
const finalState = handle.events.reduce(
  reduceState,
  structuredClone(initialState),
);
const summary = {
  begin,
  retry,
  end,
  statuses,
  compactionBanner: finalState.compactionBanner,
  finalFooter: finalState.footer,
  eventCount: handle.events.length,
};

await writeFile(
  "/tmp/kilo/natalia-tui-compact-latest.json",
  `${JSON.stringify(summary, null, 2)}\n`,
);
if (!begin) throw new Error("compact smoke missed compaction.begin");
if (!retry) throw new Error("compact smoke missed compaction retry");
if (!end || !end.success)
  throw new Error("compact smoke missed successful compaction.end");
if (summary.compactionBanner)
  throw new Error("compaction banner was not cleared");
console.log(JSON.stringify(summary, null, 2));
