import { expect, test } from "bun:test";
import { workspaceSearchOptions } from "../src/component/DialogWorkspaceSearch";

test("workspace search dialog preserves line-aware match metadata", () => {
  expect(
    workspaceSearchOptions([
      { path: "src/model.ts", line: 12, text: "const model = selected" },
    ]),
  ).toEqual([
    {
      title: "src/model.ts:12",
      value: {
        path: "src/model.ts",
        line: 12,
        text: "const model = selected",
      },
      description: "const model = selected",
    },
  ]);
});
