import { createFakeBackend } from "@natalia/client";
import { runTuiShell } from "../src/app/runtime";

const handle = await runTuiShell({
  backend: createFakeBackend(),
  initialPrompt: "Exercise responsive layout",
  closeAfterInitialTurn: false,
  rendererSize: { width: 160, height: 42 },
});

for (const [width, height] of [
  [100, 24],
  [72, 18],
  [50, 12],
  [160, 42],
] as const) {
  handle.renderer.resize(width, height);
  await Bun.sleep(250);
  if (handle.renderer.width !== width || handle.renderer.height !== height)
    throw new Error(`renderer resize mismatch: ${width}x${height}`);
}

handle.stop();
console.log("resize smoke passed");
