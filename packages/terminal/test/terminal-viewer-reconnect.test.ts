import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import { TerminalRegistry } from "../src";

test("viewer watchdog reclaims ownership and a replacement viewer reconnects", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-terminal-reconnect-"));
  const registry = new TerminalRegistry(join(root, "terminal"), {
    viewerTimeoutMs: 300,
    watchdogIntervalMs: 25,
  });
  try {
    const session = await registry.start({ command: "cat", cwd: root });
    registry.registerViewer(session.id, {
      viewerID: "crashed",
      kind: "embedded",
    });
    registry.takeoverViewer(session.id, "crashed");
    await Bun.sleep(350);
    expect(registry.get(session.id).inputOwner).toEqual({ type: "model" });
    expect(registry.get(session.id).viewers).toEqual([]);

    registry.registerViewer(session.id, {
      viewerID: "replacement",
      kind: "embedded",
    });
    registry.takeoverViewer(session.id, "replacement");
    registry.heartbeatViewer(session.id, "replacement");
    const revision = registry.get(session.id).revision;
    const observed = registry.observe(session.id, {
      afterRevision: revision,
      differential: true,
      timeoutMs: 2_000,
    });
    await registry.viewerWrite(session.id, "replacement", "reconnected\r");
    const result = await observed;
    expect(result).toMatchObject({ changed: true, reason: "changed" });
    expect(registry.get(session.id).inputOwner).toEqual({
      type: "viewer",
      viewerID: "replacement",
    });
    expect(result.session.screen?.text).toContain("reconnected");
  } finally {
    for (const item of registry.list()) await registry.stop(item.id);
    registry.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
