import { expect, test } from "bun:test";
import {
  createTuiAdapterHost,
  createTuiAdapterPlugin,
  TUI_PLUGIN_ID,
} from "../src/tui-adapter";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";

function runtimeFixture() {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  let disposals = 0;
  const runtime = {
    start(next: (event: RuntimeEvent) => void) {
      sink = next;
    },
    submit: async () => ({ sessionID: "fixture", turnID: "fixture" }),
    cancel() {},
    async dispose() {
      disposals += 1;
    },
  } as unknown as RuntimeClient;
  return {
    runtime,
    emit(event: RuntimeEvent) {
      sink?.(event);
    },
    disposals: () => disposals,
  };
}

test("TUI plugin registration is inert", () => {
  let starts = 0;
  const plugin = createTuiAdapterPlugin(
    { workspaceRoot: process.cwd() },
    async () => {
      starts += 1;
      return { done: Promise.resolve(), dispose() {} };
    },
  );
  expect(starts).toBe(0);
  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    integrationPoints: ["adapters"],
  });
});

test("TUI adapter host owns one idempotent instance", async () => {
  let starts = 0;
  let disposals = 0;
  const fixture = runtimeFixture();
  const events: RuntimeEvent[] = [];
  const host = await createTuiAdapterHost(
    { workspaceRoot: process.cwd() },
    async (input) => {
      starts += 1;
      input.events.subscribe((event) => events.push(event));
      return {
        done: Promise.resolve(),
        dispose() {
          disposals += 1;
        },
      };
    },
    () => fixture.runtime,
  );
  fixture.emit({
    type: "session.created",
    sessionID: "ses_fixture",
    title: "Fixture",
  });
  expect(starts).toBe(1);
  expect(events).toEqual([
    {
      type: "session.created",
      sessionID: "ses_fixture",
      title: "Fixture",
    },
  ]);
  await host.done;
  await host.close();
  await host.close();
  expect(disposals).toBe(1);
  expect(fixture.disposals()).toBe(1);
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
  const fixture = runtimeFixture();
  await expect(
    createTuiAdapterHost(
      { workspaceRoot: process.cwd() },
      async () => {
        starts += 1;
        throw new Error("TUI startup failed");
      },
      () => fixture.runtime,
    ),
  ).rejects.toThrow("TUI startup failed");
  expect(starts).toBe(1);
  expect(fixture.disposals()).toBe(1);
});
