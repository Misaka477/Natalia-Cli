import { expect, test } from "bun:test";
import { initializeTuiOfficialPlugins } from "../src/official-plugins";

test("official plugins initialize in the resolved distribution sibling store", async () => {
  const calls: string[] = [];
  const distributionRoot = await initializeTuiOfficialPlugins({
    resolveDistribution: async () => {
      calls.push("resolve");
      return "/opt/natalia/plugins";
    },
    initialize: async (input) => {
      calls.push("initialize");
      expect(input).toEqual({
        pluginStoreRoot: "/opt/natalia/plugin-store",
        distributionRoot: "/opt/natalia/plugins",
      });
      expect(input.pluginStoreRoot).not.toContain("workspace");
      return { initialized: true, installed: [] };
    },
  });

  expect(distributionRoot).toBe("/opt/natalia/plugins");
  expect(calls).toEqual(["resolve", "initialize"]);
});

test("missing prebuilt plugins stop host initialization", async () => {
  let initialized = false;
  await expect(
    initializeTuiOfficialPlugins({
      resolveDistribution: async () => {
        throw new Error("prebuilt distribution missing");
      },
      initialize: async () => {
        initialized = true;
        return { initialized: true, installed: [] };
      },
    }),
  ).rejects.toThrow("prebuilt distribution missing");
  expect(initialized).toBe(false);
});
