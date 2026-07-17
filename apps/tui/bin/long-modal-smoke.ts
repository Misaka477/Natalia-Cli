import { writeFile } from "node:fs/promises";
import {
  EventBatcher,
  ProjectionCache,
  shouldLazyRenderDetail,
} from "@natalia/ui-model";
import { createFakeBackend } from "@natalia/client";

const started = performance.now();
const backend = createFakeBackend();
const cache = new ProjectionCache();
const batcher = new EventBatcher<string>();
let modalActive = false;
let contentChars = 0;
let toolBlocks = 0;

backend.start((event) => {
  batcher.push(event.type);
  if (event.type === "approval.request" || event.type === "question.request")
    modalActive = true;
  if (event.type === "approval.request" && event.detail)
    shouldLazyRenderDetail(event.detail);
  if (event.type === "content.delta") {
    contentChars += event.text.length;
    cache.markdownSegment(event.id, contentChars, event.text);
  }
  if (event.type === "tool.update") {
    toolBlocks += 1;
    if (event.result)
      cache.toolResult(event.callID ?? event.name, toolBlocks, event.result);
  }
  if (batcher.shouldFlush({ modalActive })) batcher.flush();
});

await backend.submit("/long + /modal M8 performance smoke CJK 🙂 e\u0301");
const elapsedMs = performance.now() - started;
const summary = {
  elapsedMs: Math.round(elapsedMs),
  contentChars,
  toolBlocks,
  modalActive,
  cache: cache.stats,
  note: "Synthetic local fixture baseline for long markdown + tool blocks + modal projection batching.",
};
await writeFile(
  "/tmp/kilo/natalia-tui-long-modal-latest.json",
  `${JSON.stringify(summary, null, 2)}\n`,
);
if (!modalActive)
  throw new Error("long + modal smoke did not activate modal projection");
if (contentChars < 10000)
  throw new Error("long + modal smoke did not receive long content");
console.log(JSON.stringify(summary, null, 2));
