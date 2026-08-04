import { expect, test } from "bun:test";
import { previewCommandRuleImport } from "../src/app/permission-command-rules";

test("command-rule import trims, ignores comments, and de-duplicates commands", async () => {
  const result = await previewCommandRuleImport(
    "\n # team commands\n git diff \ngit diff\ngit status\n",
  );
  expect(result.rejected).toBe(false);
  expect(result.rules).toEqual([
    { command: "git diff" },
    { command: "git status" },
  ]);
  expect(result.previews.map((preview) => preview.status)).toEqual([
    "empty",
    "comment",
    "accepted",
    "duplicate",
    "accepted",
    "empty",
  ]);
});

test("command-rule import rejects complex Bash syntax without retaining it", async () => {
  const result = await previewCommandRuleImport("git diff\ngit status && pwd");
  expect(result.rejected).toBe(true);
  expect(result.rules).toEqual([{ command: "git diff" }]);
  expect(result.previews[1]).toMatchObject({
    status: "rejected",
    detail: "only one simple Bash command is allowed",
  });
});

test("command-rule import treats saved commands as duplicates", async () => {
  const result = await previewCommandRuleImport("git diff\ngit status", [
    { command: "git diff" },
  ]);
  expect(result.rules).toEqual([{ command: "git status" }]);
  expect(result.previews.map((preview) => preview.status)).toEqual([
    "duplicate",
    "accepted",
  ]);
});
