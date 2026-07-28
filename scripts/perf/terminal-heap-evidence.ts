import { mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { writeHeapSnapshot } from "node:v8";
import { TerminalRegistry } from "../../packages/terminal/src";

const durationMs = Number(process.argv[2] ?? 60_000);
const root = await mkdtemp("/tmp/natalia-terminal-heap-");
const registry = new TerminalRegistry(join(root, "terminal"));
const session = await registry.start({ command: "cat", cwd: root });
const viewerID = "heap_evidence_viewer";
registry.registerViewer(session.id, { viewerID, kind: "embedded" });
registry.takeoverViewer(session.id, viewerID);
const before = process.memoryUsage();
const beforeSnapshot = writeHeapSnapshot(join(root, "before.heapsnapshot"));
let updates = 0;
let lastHeartbeat = performance.now();
try {
  const startedAt = performance.now();
  while (performance.now() - startedAt < durationMs) {
    if (performance.now() - lastHeartbeat >= 1_000) {
      registry.heartbeatViewer(session.id, viewerID);
      lastHeartbeat = performance.now();
    }
    const revision = registry.get(session.id).revision;
    const observation = registry.observe(session.id, {
      afterRevision: revision,
      differential: true,
      timeoutMs: 2_000,
    });
    await registry.viewerWrite(session.id, viewerID, `heap-${updates}\r`);
    await observation;
    updates++;
    await Bun.sleep(250);
  }
  const after = process.memoryUsage();
  const afterSnapshot = writeHeapSnapshot(join(root, "after.heapsnapshot"));
  console.log(
    JSON.stringify({
      durationMs,
      updates,
      before: { rss: before.rss, heapUsed: before.heapUsed },
      after: { rss: after.rss, heapUsed: after.heapUsed },
      rssDeltaBytes: after.rss - before.rss,
      heapUsedDeltaBytes: after.heapUsed - before.heapUsed,
      snapshots: [
        { path: beforeSnapshot, bytes: (await stat(beforeSnapshot)).size },
        { path: afterSnapshot, bytes: (await stat(afterSnapshot)).size },
      ],
    }),
  );
  // Keep snapshots available for dominator analysis; only registry state dir is removed.
} finally {
  await registry.stop(session.id);
  registry.dispose();
  await rm(join(root, "terminal"), { recursive: true, force: true });
}
