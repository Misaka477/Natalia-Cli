import { expect, test } from "bun:test";
import { agentToolFamily, agentTools } from "../src";

test("the subagent family describes the tools it ships", () => {
  const family = agentToolFamily();
  expect(family.id).toBe("agent");
  expect(family.scope).toBe("session");
  expect(family.tools.map((tool) => tool.name)).toEqual(
    agentTools().map((tool) => tool.name),
  );
});

test("agent tools refuse without the subagent registry", async () => {
  const tool = agentToolFamily().tools.find(
    (candidate) => candidate.name === "agent_spawn",
  )!;
  await expect(
    tool.execute({ prompt: "hi" }, { workspaceRoot: "/tmp" } as never),
  ).rejects.toThrow(/subagent runtime unavailable/u);
});
