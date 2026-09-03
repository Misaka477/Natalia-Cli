import { expect, test } from "bun:test";
import { createOfficialRuntimeClient, officialPluginWorkspace } from "./plugin-test-helpers";

test("two sessions submit and finish concurrently without cross-cancel", async () => {
  const workspaceRoot = await officialPluginWorkspace("multi-session-parallel");
  const client = createOfficialRuntimeClient({
    workspaceRoot,
    provider: {
      provider: "scripted",
      model: "m1",
      async *stream() {
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const createdA = await client.sessionNew?.();
  const createdB = await client.sessionNew?.();
  const first = client.submitAndWait?.({
    text: "first session",
    sessionID: createdA?.sessionID,
  });
  const second = client.submitAndWait?.({
    text: "second session",
    sessionID: createdB?.sessionID,
  });
  const [a, b] = await Promise.all([first, second]);
  expect(a?.id).toBeTruthy();
  expect(b?.id).toBeTruthy();
  await client.dispose?.();
});
