import { expect, test } from "bun:test";
import { sandboxToolFamily, sandboxTools } from "../src";

test("the sandbox family describes the tools it ships", () => {
  const family = sandboxToolFamily();
  expect(family.id).toBe("sandbox");
  expect(family.scope).toBe("workspace");
  expect(family.tools.map((tool) => tool.name)).toEqual(
    sandboxTools().map((tool) => tool.name),
  );
});

test("sandbox tools refuse without a sandbox manager", async () => {
  const tool = sandboxToolFamily().tools.find(
    (candidate) => candidate.name === "sandbox_create",
  )!;
  // sandbox_create validates its arguments before it reaches the manager, so
  // the refusal is "no sandbox manager" only once the input is well-formed.
  await expect(
    tool.execute({ id: "probe", path: "probe" }, {
      workspaceRoot: "/tmp",
    } as never),
  ).rejects.toThrow(
    /sandbox manager is unavailable|requires a sandbox manager|sandbox/u,
  );
});
