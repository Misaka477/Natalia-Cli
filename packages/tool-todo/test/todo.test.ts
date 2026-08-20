import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  createTodoPlugin,
  TODO_PLUGIN_ID,
  todoTools,
  todoToolFamily,
} from "../src";

test("the todo family describes the tools it ships", () => {
  const family = todoToolFamily();
  expect(family.id).toBe("todo");
  expect(family.scope).toBe("session");
  expect(family.tools).toEqual(todoTools);
  expect(todoTools.find((tool) => tool.name === "plan")?.requiresApproval).toBe(
    true,
  );
});

test("the todo plugin owns its stable tools and unloads cleanly", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools });
  await registry.loadBuiltin(createTodoPlugin());
  expect(registry.list()[0]).toMatchObject({
    id: TODO_PLUGIN_ID,
    scope: "session",
  });
  for (const tool of todoTools) expect(tools.has(tool.name)).toBe(true);
  await registry.unload(TODO_PLUGIN_ID);
  for (const tool of todoTools) expect(tools.has(tool.name)).toBe(false);
});

test("todo tools isolate durable items by session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-todo-"));
  const tools = createToolRegistry(todoTools);
  await tools
    .get("todo_write")!
    .execute(
      { items: [{ content: "finish migration", status: "in_progress" }] },
      { workspaceRoot: root, sessionID: "ses_a" },
    );
  expect(
    await tools
      .get("todo_read")!
      .execute({}, { workspaceRoot: root, sessionID: "ses_a" }),
  ).toContain("finish migration");
  expect(
    await tools
      .get("todo_read")!
      .execute({}, { workspaceRoot: root, sessionID: "ses_b" }),
  ).toBe("[]");
  await tools
    .get("plan")!
    .execute(
      { items: [{ content: "cutover evidence", status: "pending" }] },
      { workspaceRoot: root, sessionID: "ses_a" },
    );
  expect(
    await tools
      .get("todo_read")!
      .execute({}, { workspaceRoot: root, sessionID: "ses_a" }),
  ).toContain("cutover evidence");
});

test("todo tools require a session id", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-todo-session-"));
  const tools = createToolRegistry(todoTools);
  await expect(
    tools.get("todo_read")!.execute({}, { workspaceRoot: root }),
  ).rejects.toThrow("todo tools require a session ID");
});
