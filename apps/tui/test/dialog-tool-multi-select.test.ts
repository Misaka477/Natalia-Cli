import { describe, expect, test } from "bun:test";
import {
  invertToolSelection,
  selectAllTools,
} from "../src/component/DialogToolMultiSelect";

describe("tool permission selection", () => {
  const tools = ["read_file", "glob", "grep"];

  test("selects every available tool", () => {
    expect([...selectAllTools(tools)]).toEqual(tools);
  });

  test("inverts selected and unselected tools", () => {
    expect([
      ...invertToolSelection(tools, new Set(["read_file", "grep"])),
    ]).toEqual(["glob"]);
  });
});
