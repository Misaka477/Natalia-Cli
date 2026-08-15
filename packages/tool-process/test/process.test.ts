import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ManagedProcessRegistry,
  managedProcessTools,
  processToolFamily,
} from "../src";

test("the process family describes the tools it ships", () => {
  const family = processToolFamily();
  expect(family.id).toBe("process");
  expect(family.scope).toBe("session");
  expect(family.tools.map((tool) => tool.name)).toEqual(
    managedProcessTools(new ManagedProcessRegistry()).map((tool) => tool.name),
  );
});

test("a managed process starts, is visible, and stops", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-process-"));
  const registry = new ManagedProcessRegistry();
  const tools = new Map(
    managedProcessTools(registry).map((tool) => [tool.name, tool]),
  );
  const started = await tools
    .get("process_start")!
    .execute({ id: "probe", command: "sleep 30" }, {
      workspaceRoot: root,
    } as never);
  expect(started).toContain("probe");
  expect(await registry.runningCount({ workspaceRoot: root })).toBe(1);
  await tools
    .get("process_stop")!
    .execute({ id: "probe" }, { workspaceRoot: root } as never);
  expect(await registry.runningCount({ workspaceRoot: root })).toBe(0);
});
