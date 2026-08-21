import { expect, test } from "bun:test";
import {
  createTuiAdapterHost,
  createTuiAdapterPlugin,
  TUI_PLUGIN_ID,
} from "../src/tui-adapter";

test("TUI plugin registration is inert", () => {
  let starts = 0;
  const plugin = createTuiAdapterPlugin(async () => {
    starts += 1;
    return { done: Promise.resolve(), dispose() {} };
  });
  expect(starts).toBe(0);
  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    integrationPoints: ["adapters"],
  });
});

test("TUI adapter host owns one idempotent instance", async () => {
  let starts = 0;
  let disposals = 0;
  const host = await createTuiAdapterHost(
    { workspaceRoot: process.cwd() },
    async () => {
      starts += 1;
      return {
        done: Promise.resolve(),
        dispose() {
          disposals += 1;
        },
      };
    },
  );
  expect(starts).toBe(1);
  await host.done;
  await host.close();
  await host.close();
  expect(disposals).toBe(1);
});

test("disabled TUI adapter creates no UI resources", async () => {
  let starts = 0;
  await expect(
    createTuiAdapterHost(
      { workspaceRoot: process.cwd(), enabled: false },
      async () => {
        starts += 1;
        return { done: Promise.resolve(), dispose() {} };
      },
    ),
  ).rejects.toThrow(`TUI plugin is disabled (${TUI_PLUGIN_ID})`);
  expect(starts).toBe(0);
});

test("TUI adapter startup failure is surfaced without disposal", async () => {
  let starts = 0;
  await expect(
    createTuiAdapterHost({ workspaceRoot: process.cwd() }, async () => {
      starts += 1;
      throw new Error("TUI startup failed");
    }),
  ).rejects.toThrow("TUI startup failed");
  expect(starts).toBe(1);
});
