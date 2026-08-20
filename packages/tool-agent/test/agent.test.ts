import { expect, test } from "bun:test";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  AGENT_PLUGIN_ID,
  agentToolFamily,
  agentTools,
  createAgentPlugin,
} from "../src";

const EXPECTED_TOOL_NAMES = [
  "agent_spawn",
  "agent_list",
  "agent_status",
  "agent_output",
  "agent_wait",
  "agent_stop",
  "agent_resume",
  "agent_retry",
  "agent_attach",
  "agent_detach",
  "agent_cleanup",
  "agent_audit",
];

test("the subagent family describes the tools it ships", () => {
  const family = agentToolFamily();
  expect(family.id).toBe("agent");
  expect(family.scope).toBe("session");
  expect(family.tools.map((tool) => tool.name)).toEqual(
    agentTools().map((tool) => tool.name),
  );
});

test("the agent plugin owns its tools and unloads cleanly", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools });
  await registry.loadBuiltin(createAgentPlugin());
  expect(registry.list()[0]).toMatchObject({
    id: AGENT_PLUGIN_ID,
    scope: "session",
  });
  for (const tool of agentTools()) expect(tools.has(tool.name)).toBe(true);
  await registry.unload(AGENT_PLUGIN_ID);
  for (const tool of agentTools()) expect(tools.has(tool.name)).toBe(false);
});

test("every agent_* tool declares presentCall and presentResult", () => {
  const tools = agentTools();
  expect(tools.map((t) => t.name)).toEqual(EXPECTED_TOOL_NAMES);
  for (const tool of tools) {
    expect(tool.output?.presentCall).toBeDefined();
    expect(tool.output?.presentResult).toBeDefined();
  }
});

test("agent_spawn projects task title and spawns taskID in result meta", () => {
  const spawn = agentTools().find((t) => t.name === "agent_spawn")!;
  const call = spawn.output!.presentCall!({ task: "Inspect renderer" });
  expect(call).toEqual({
    kind: "generic",
    title: "Inspect renderer",
    summary: "spawn",
  });
  const result = spawn.output!.presentResult!(
    {},
    '{"id":"a1","task":"Inspect renderer"}',
  );
  expect(result).toEqual({
    kind: "generic",
    title: "subagent",
    summary: "spawned a1",
    meta: [["taskID", "a1"]],
  });
});

test("agent_status projects checking action and status result", () => {
  const tool = agentTools().find((t) => t.name === "agent_status")!;
  const call = tool.output!.presentCall!({ id: "a1" });
  expect(call).toEqual({
    kind: "generic",
    title: "a1",
    summary: "check",
    meta: [["collapsible", "true"]],
  });
  const result = tool.output!.presentResult!(
    { id: "a1" },
    "a1 [running] attached=true Inspect renderer",
  )!;
  expect(result.title).toBe("a1");
  expect(result.summary).toBe("status running");
});

test("agent_stop projects stopping and stopped/not-running result", () => {
  const tool = agentTools().find((t) => t.name === "agent_stop")!;
  expect(tool.parameters.required).toEqual(["id", "reason"]);
  const call = tool.output!.presentCall!({ id: "a1", reason: "stalled" });
  expect(call).toEqual({ kind: "generic", title: "a1", summary: "stop" });
  const stopped = tool.output!.presentResult!(
    { id: "a1", reason: "stalled" },
    "Stopped a1",
  )!;
  expect(stopped.summary).toBe("stopped");
  const protectedResult = tool.output!.presentResult!(
    { id: "a1", reason: "still active" },
    "Protected a1",
  )!;
  expect(protectedResult.summary).toBe("protected · agent still active");
  const forced = tool.output!.presentResult!(
    { id: "a1", reason: "override", force: true },
    "Stopped a1 (force interrupted an active agent)",
  )!;
  expect(forced.summary).toBe("force stopped · interrupted active agent");
  const notRunning = tool.output!.presentResult!(
    { id: "a1", reason: "stalled" },
    "Agent is not running",
  )!;
  expect(notRunning.summary).toBe("not running");
});

test("agent_output projects reading action and output result", () => {
  const tool = agentTools().find((t) => t.name === "agent_output")!;
  const call = tool.output!.presentCall!({ id: "a1" })!;
  expect(call.summary).toBe("read output");
  expect(call.meta).toEqual([["collapsible", "true"]]);
  const result = tool.output!.presentResult!({ id: "a1" }, "some output")!;
  expect(result.summary).toBe("output read");
});

test("agent_retry projects retry action and continuation result", () => {
  const tool = agentTools().find((t) => t.name === "agent_retry")!;
  const call = tool.output!.presentCall!({ id: "a1" })!;
  expect(call.summary).toBe("retry");
  const result = tool.output!.presentResult!(
    { id: "a1" },
    "started continuation 2",
  )!;
  expect(result.summary).toBe("continuation 2");
});

test("agent_cleanup projects cleanup count", () => {
  const tool = agentTools().find((t) => t.name === "agent_cleanup")!;
  const call = tool.output!.presentCall!({})!;
  expect(call.summary).toBe("cleanup");
  const result = tool.output!.presentResult!({}, '{"removed":["a1","a2"]}')!;
  expect(result.summary).toBe("removed 2");
});

test("agent_list and agent_audit project list/audit labels", () => {
  const list = agentTools().find((t) => t.name === "agent_list")!;
  expect(list.output!.presentCall!({})!.summary).toBe("list");
  const listResult = list.output!.presentResult!({}, "no subagents")!;
  expect(listResult.summary).toBe("listed 0");

  const audit = agentTools().find((t) => t.name === "agent_audit")!;
  expect(audit.output!.presentCall!({})!.summary).toBe("audit");
});

test("agent tools refuse without the subagent registry", async () => {
  const tool = agentToolFamily().tools.find(
    (candidate) => candidate.name === "agent_spawn",
  )!;
  await expect(
    tool.execute({ prompt: "hi" }, { workspaceRoot: "/tmp" } as never),
  ).rejects.toThrow(/subagent runtime unavailable/u);
});

test("agent_retry is exposed as an explicit continuation tool", () => {
  const tool = agentTools().find(
    (candidate) => candidate.name === "agent_retry",
  )!;
  expect(tool.requiresApproval).toBe(true);
  expect(tool.description).toContain("continuation");
});
