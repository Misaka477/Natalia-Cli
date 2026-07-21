import { expect, test } from "bun:test";
import { SessionRunCoordinator } from "../src";

test("serializes work and preserves submission order", async () => {
  const coordinator = new SessionRunCoordinator();
  const events: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const first = coordinator.run(async () => {
    events.push("first:start");
    await new Promise<void>((resolve) => (releaseFirst = resolve));
    events.push("first:end");
  });
  const second = coordinator.run(async () => {
    events.push("second:start");
    events.push("second:end");
  });

  await Bun.sleep(1);
  expect(events).toEqual(["first:start"]);
  releaseFirst?.();
  await Promise.all([first, second]);
  expect(events).toEqual(["first:start", "first:end", "second:start", "second:end"]);
});

test("continues draining after a failed task", async () => {
  const coordinator = new SessionRunCoordinator();
  const failed = coordinator.run(async () => {
    throw new Error("expected failure");
  });
  const recovered = coordinator.run(async () => "recovered");

  await expect(failed).rejects.toThrow("expected failure");
  expect(await recovered).toBe("recovered");
  await coordinator.idle();
});

test("reports queued and active work until its final settlement", async () => {
  const coordinator = new SessionRunCoordinator();
  let release: (() => void) | undefined;
  const running = coordinator.run(
    () => new Promise<void>((resolve) => (release = resolve)),
  );
  expect(coordinator.active).toBe(true);
  while (!release) await Bun.sleep(1);
  release?.();
  await running;
  await Bun.sleep(0);
  expect(coordinator.active).toBe(false);
});
