import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TerminalRegistry } from "../src";

test("model observe continues after viewer unregister with revision advancing", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-unregister-"));
  const registry = new TerminalRegistry(join(root, ".natalia", "terminal"));
  const started = await registry.start({ command: "cat", cwd: root });

  registry.registerViewer(started.id, {
    viewerID: "human",
    kind: "external",
  });
  registry.takeoverViewer(started.id, "human");
  expect(registry.get(started.id).inputOwner).toEqual({
    type: "viewer",
    viewerID: "human",
  });

  const revisionBeforeWrite = registry.get(started.id).revision;
  const firstObserved = registry.observe(started.id, {
    afterRevision: revisionBeforeWrite,
    timeoutMs: 2000,
  });

  await registry.viewerWrite(started.id, "human", "viewer-text\r");
  const firstResult = await firstObserved;
  expect(firstResult.changed).toBe(true);
  expect(firstResult.session.screen?.text).toContain("viewer-text");
  expect(registry.get(started.id).inputOwner).toEqual({
    type: "viewer",
    viewerID: "human",
  });

  await registry.unregisterViewer(started.id, "human");
  expect(registry.get(started.id).inputOwner).toEqual({ type: "model" });

  const revisionAfterUnregister = registry.get(started.id).revision;
  const secondObserved = registry.observe(started.id, {
    afterRevision: revisionAfterUnregister,
    timeoutMs: 2000,
  });

  await registry.write(started.id, "model-after-unregister\r");
  const secondResult = await secondObserved;
  expect(secondResult.changed).toBe(true);
  expect(secondResult.session.screen?.text).toContain("model-after-unregister");
  expect(registry.get(started.id).inputOwner).toEqual({ type: "model" });

  await registry.stop(started.id);
});
