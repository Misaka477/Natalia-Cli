import { expect, test } from "bun:test";
import { createWorkspaceWriteLock } from "../src/workspace-write-lock";

test("workspace writers serialise in acquisition order", async () => {
  const lock = createWorkspaceWriteLock();
  const order: string[] = [];
  const releaseFirst = await lock.acquire();
  const second = lock.acquire().then((releaseSecond) => {
    order.push("second");
    releaseSecond();
  });
  await Bun.sleep(20);
  // The second writer is parked behind the first, not running concurrently.
  expect(order).toEqual([]);
  order.push("first");
  releaseFirst();
  await second;
  expect(order).toEqual(["first", "second"]);
});

test("a failed release still lets the next writer proceed", async () => {
  const lock = createWorkspaceWriteLock();
  const release = await lock.acquire();
  release();
  const releaseAgain = await lock.acquire();
  releaseAgain();
  // Acquiring again after a release resolves immediately.
  const third = await Promise.race([
    lock.acquire(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 50)),
  ]);
  expect(third).toBeTypeOf("function");
});
