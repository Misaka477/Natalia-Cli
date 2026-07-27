import { createSignal } from "solid-js";
import { createTestRenderer } from "@opentui/core/testing";
import { render } from "@opentui/solid";
import type { TerminalScreenSnapshot } from "@natalia/contracts";
import { TerminalScreen } from "../src/component/TerminalScreen";

const setup = await createTestRenderer({
  width: 120,
  height: 36,
  gatherStats: true,
  maxStatSamples: 10,
});
const [screen, setScreen] = createSignal(frame());
await render(() => <TerminalScreen screen={screen()} />, setup.renderer);
await setup.renderOnce();
setup.renderer.resetStats();
const samples: Array<{
  elapsedMs: number;
  nativeFrameCount: number;
  nativeLastFrameTime: number;
  nativeAverageFrameTime: number;
  cellsUpdated: number;
}> = [];
for (let index = 0; index < 3; index++) {
  const next = frame();
  next.lines[index]![0] = ["Z", 1, 1];
  const start = performance.now();
  setScreen(next);
  await setup.renderOnce();
  const stats = setup.getNativeStats();
  samples.push({
    elapsedMs: performance.now() - start,
    nativeFrameCount: stats.nativeFrameCount,
    nativeLastFrameTime: stats.nativeLastFrameTime,
    nativeAverageFrameTime: stats.nativeAverageFrameTime,
    cellsUpdated: stats.cellsUpdated,
  });
}
setup.renderer.destroy();
console.log(JSON.stringify({ samples }));

function frame(): TerminalScreenSnapshot {
  const line = Array.from({ length: 120 }, (_, index) => [
    index % 2 ? "B" : "A",
    1,
    index % 2 ? 2 : 1,
  ]) as TerminalScreenSnapshot["lines"][number];
  return {
    rows: 36,
    cols: 120,
    buffer: "normal",
    cursor: { row: 0, col: 0, visible: true },
    lines: Array.from({ length: 36 }, () => [...line]),
    text: "",
  };
}
