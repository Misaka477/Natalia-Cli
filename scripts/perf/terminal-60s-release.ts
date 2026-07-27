import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { InteractivePTYRegistry } from "../../packages/pty/src";

const root = await mkdtemp("/tmp/natalia-terminal-release-");
const before = process.memoryUsage();
const registry = new InteractivePTYRegistry(join(root, "pty"), {
  exitedSessionRetentionMs: 60_000,
});
const session = await registry.start({ command: "cat", cwd: root });
const viewerID = "release_fixture_viewer";
registry.registerViewer(session.id, { viewerID, kind: "embedded" });
registry.takeoverViewer(session.id, viewerID);
await registry.viewerWrite(session.id, viewerID, "release fixture\r");
await registry.stop(session.id);
const stoppedAt = performance.now();
await Bun.sleep(60_250);
let released = false;
try {
  registry.get(session.id);
} catch {
  released = true;
}
const after = process.memoryUsage();
registry.dispose();
await rm(root, { recursive: true, force: true });

if (!released)
  throw new Error("exited PTY session was retained after 60 seconds");
console.log(
  JSON.stringify({
    retentionMs: 60_000,
    elapsedAfterStopMs: performance.now() - stoppedAt,
    released,
    runningCount: registry.runningCount(),
    rssDeltaBytes: after.rss - before.rss,
    heapUsedDeltaBytes: after.heapUsed - before.heapUsed,
  }),
);
