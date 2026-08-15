import { expect, test } from "bun:test";
import { askToolFamily, askTools } from "../src";

test("the ask family describes the tool it ships", () => {
  const family = askToolFamily();
  expect(family.id).toBe("ask");
  expect(family.scope).toBe("session");
  expect(family.tools).toEqual(askTools);
});

test("ask_user refuses when the host has no interactive channel", async () => {
  const tool = askToolFamily().tools[0]!;
  await expect(
    tool.execute({ question: "q", options: ["a"] }, {} as never),
  ).rejects.toThrow("interactive question channel unavailable");
});
