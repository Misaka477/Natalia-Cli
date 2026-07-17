import { expect, test } from "bun:test";
import { createFakeBackend } from "../src/fake/backend";
import { makeDigest, paste1MiB } from "../src/testing/data";

test("fake backend receives byte length line count and sha256 unchanged", async () => {
  const backend = createFakeBackend();
  const events: string[] = [];
  backend.start((event) => events.push(event.type));
  const input = paste1MiB();
  const submitted = await backend.submit(input);
  expect(submitted.byteLength).toBe(new TextEncoder().encode(input).byteLength);
  expect(submitted.lineCount).toBe(input.split("\n").length);
  expect(submitted.sha256).toBe(makeDigest(input));
  expect(submitted.text).toBe(input);
  expect(events).toContain("status.snapshot");
  expect(events).toContain("approval.request");
  expect(events).toContain("question.request");
});
