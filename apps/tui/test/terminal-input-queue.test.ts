import { expect, test } from "bun:test";
import { createTerminalInputQueue } from "../src/terminal-input-queue";

test("terminal input queue batches same-tick input and preserves write order", async () => {
  const writes: string[] = [];
  const queue = createTerminalInputQueue({
    async write(data) {
      writes.push(data);
    },
    onError(cause) {
      throw cause;
    },
  });
  queue.queue("a");
  queue.queue("b");
  await Promise.resolve();
  await queue.idle();
  queue.queue("c");
  await Promise.resolve();
  await queue.idle();
  expect(writes).toEqual(["ab", "c"]);
});
