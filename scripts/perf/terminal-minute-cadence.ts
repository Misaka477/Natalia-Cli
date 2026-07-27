import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { InteractivePTYRegistry } from "../../packages/pty/src";

const root = await mkdtemp("/tmp/natalia-terminal-minute-");
const registry = new InteractivePTYRegistry(join(root, "pty"));
const session = await registry.start({ command: "cat", cwd: root });
const viewerID = "minute_fixture_viewer";
registry.registerViewer(session.id, { viewerID, kind: "embedded" });
registry.takeoverViewer(session.id, viewerID);
try {
  const foreground = await runCadence("foreground");
  await registry.releaseInputViewer(session.id, viewerID);
  const hidden = await runCadence("hidden");
  console.log(
    JSON.stringify({
      foreground,
      hidden,
      runningCount: registry.runningCount(),
    }),
  );
} finally {
  await registry.stop(session.id);
  registry.dispose();
  await rm(root, { recursive: true, force: true });
}

async function runCadence(mode: "foreground" | "hidden") {
  const before = process.memoryUsage();
  const startedAt = performance.now();
  let updates = 0;
  let lastHeartbeat = startedAt;
  while (performance.now() - startedAt < 60_000) {
    if (performance.now() - lastHeartbeat >= 1_000) {
      registry.heartbeatViewer(session.id, viewerID);
      lastHeartbeat = performance.now();
    }
    const revision = registry.get(session.id).revision;
    const observed = registry.observe(session.id, {
      afterRevision: revision,
      differential: mode === "foreground",
      timeoutMs: 2_000,
    });
    if (mode === "foreground")
      await registry.viewerWrite(session.id, viewerID, `cadence-${updates}\r`);
    else await registry.write(session.id, `cadence-${updates}`);
    await observed;
    updates++;
    await Bun.sleep(250);
  }
  const after = process.memoryUsage();
  return {
    durationMs: performance.now() - startedAt,
    updates,
    updatesPerSecond: updates / ((performance.now() - startedAt) / 1_000),
    rssDeltaBytes: after.rss - before.rss,
    heapUsedDeltaBytes: after.heapUsed - before.heapUsed,
  };
}
