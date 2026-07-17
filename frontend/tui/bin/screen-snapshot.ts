import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runTuiShell } from "../src/app/runtime";
import { paste100KiB } from "../src/testing/data";

const output = path.join("/tmp/kilo", `natalia-tui-screen-${Date.now()}.log`);
const handle = await runTuiShell({ initialPrompt: paste100KiB() });

await new Promise<void>((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error("screen snapshot timeout")),
    10_000,
  );
  handle.renderer.once("destroy", () => {
    clearTimeout(timer);
    resolve();
  });
});

const transcript = handle.events
  .map((event) => JSON.stringify(event))
  .join("\n");
await writeFile(output, transcript);
await writeFile(
  path.join("/tmp/kilo", "natalia-tui-screen-latest.log"),
  transcript,
);

const latest = await readFile(output, "utf8");
for (const required of [
  "turn.submitted",
  "thinking.delta",
  "tool.update",
  "approval.request",
  "question.request",
  "status.snapshot",
]) {
  if (!latest.includes(required))
    throw new Error(`screen snapshot missed ${required}`);
}

console.log(`screen snapshot events: ${output}`);
