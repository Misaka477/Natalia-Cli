import { expect, test } from "bun:test";
import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WorkspaceSandboxManager, containPath, isSecretEnvKey } from "../src";

test("sandbox containment blocks absolute and parent escape", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sandbox-"));
  await expect(containPath(root, "/etc/passwd")).rejects.toThrow("absolute");
  await expect(containPath(root, "../escape")).rejects.toThrow("escape");
  await expect(containPath(root, "safe/file.txt")).resolves.toContain(root);
});

test("sandbox containment blocks symlink escape", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-sandbox-"));
  await symlink("/tmp", join(root, "out"));
  await expect(containPath(root, "out/file.txt")).rejects.toThrow(
    "symlink escape",
  );
});

test("sandbox diff covers delete rename mode and env allowlist redacts secrets", async () => {
  const base = await mkdtemp(join(tmpdir(), "natalia-sandbox-base-"));
  const manager = new WorkspaceSandboxManager(base);
  await manager.create("box");
  await manager.write("box", "new.ts", "new");
  await manager.write("box", "old.ts", "old");
  await manager.renamePath("box", "old.ts", "renamed.ts");
  await manager.modePath("box", "script.sh", "100755");
  await manager.deletePath("box", "gone.ts");
  const changes = await manager.previewMerge("box");
  expect(changes.map((change) => change.kind)).toEqual([
    "modify",
    "modify",
    "rename",
    "mode",
    "delete",
  ]);
  expect(
    manager.environment(["PATH", "API_KEY"], {
      PATH: "/bin",
      API_KEY: "secret",
    }),
  ).toEqual({ PATH: "/bin" });
  expect(isSecretEnvKey("GITHUB_TOKEN")).toBe(true);
});

test("sandbox merge is atomic on failure", async () => {
  const base = await mkdtemp(join(tmpdir(), "natalia-sandbox-base-"));
  const host = await mkdtemp(join(tmpdir(), "natalia-host-"));
  const manager = new WorkspaceSandboxManager(base);
  await manager.create("box");
  await writeFile(join(host, "keep.txt"), "original");
  await manager.write("box", "keep.txt", "changed");
  await manager.write("box", "bad/child.txt", "bad");
  await writeFile(join(host, "bad"), "not a dir");
  await expect(manager.merge("box", host)).rejects.toThrow();
  expect(await readFile(join(host, "keep.txt"), "utf8")).toBe("original");
});

test("sandbox target/audit/checkpoint contract exposes isolation level", async () => {
  const base = await mkdtemp(join(tmpdir(), "natalia-sandbox-base-"));
  const manager = new WorkspaceSandboxManager(base);
  await manager.create("box");
  expect(manager.target("box")).toMatchObject({
    kind: "sandbox",
    isolationLevel: "workspace",
  });
  expect(manager.updateEvent("box")).toMatchObject({
    type: "sandbox.update",
    isolationLevel: "workspace",
  });
  expect(manager.auditEvent("box", "workflow")).toMatchObject({
    type: "sandbox.audit",
    approvalRequired: true,
    checkpointPolicy: "sandbox_manifest",
  });
  expect(await manager.delete("box")).toMatchObject({
    pendingChanges: [],
    runningResources: [],
  });
});

test("sandbox executes a real command inside its workspace target", async () => {
  const base = await mkdtemp(join(tmpdir(), "natalia-sandbox-base-"));
  const manager = new WorkspaceSandboxManager(base);
  await manager.create("box");
  const result = await manager.execute("box", "pwd; printf sandbox-ok");
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain("sandbox-ok");
  expect(result.output).toContain(join(base, "box"));
  expect(result.target).toMatchObject({ kind: "sandbox", sandboxID: "box" });
});

test("sandbox tracks running resources with output and stop lifecycle", async () => {
  const base = await mkdtemp(join(tmpdir(), "natalia-sandbox-resource-"));
  const manager = new WorkspaceSandboxManager(base);
  await manager.create("box");
  const resource = await manager.startResource(
    "box",
    "printf resource-ok; sleep 30",
    "res_1",
  );
  expect(resource).toMatchObject({ id: "res_1", status: "running" });
  expect(manager.updateEvent("box")).toMatchObject({ runningResources: 1 });
  await waitFor(async () => await manager.resourceOutput("box", "res_1"));
  expect(await manager.resourceOutput("box", "res_1")).toContain("resource-ok");
  expect(await manager.stopResource("box", "res_1")).toMatchObject({
    status: "stopped",
  });
  expect(manager.updateEvent("box")).toMatchObject({ runningResources: 0 });
});

test("sandbox manifests restore changes but never falsely recover processes", async () => {
  const base = await mkdtemp(join(tmpdir(), "natalia-sandbox-restart-"));
  const first = new WorkspaceSandboxManager(base);
  await first.create("box");
  await first.write("box", "draft.txt", "persisted");
  await first.startResource("box", "sleep 0.1", "custom_resource");
  await Bun.sleep(150);
  const reopened = new WorkspaceSandboxManager(base);
  await reopened.initialize();
  expect(await reopened.previewMerge("box")).toMatchObject([
    { path: "draft.txt", content: "persisted" },
  ]);
  expect(reopened.resourcesFor("box")).toEqual([]);
  const result = await reopened.delete("box");
  expect(result.runningResources).toEqual([]);
});

async function waitFor(read: () => Promise<string>) {
  for (let index = 0; index < 100; index++) {
    if ((await read()).includes("resource-ok")) return;
    await Bun.sleep(20);
  }
  throw new Error("timed out waiting for sandbox resource output");
}
