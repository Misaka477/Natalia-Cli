import { expect, test } from "bun:test";
import { moduleToolPolicy } from "../src";

test("module tool policies expose stable capability bundles", () => {
  expect(moduleToolPolicy("read_search").allow).toEqual([
    "flow_module_complete",
    "read_file",
    "glob",
    "grep",
    "read_media_file",
  ]);
  expect(moduleToolPolicy("terminal").allow).toContain(
    "interactive_terminal_*",
  );
  expect(moduleToolPolicy("report_output").allow).toEqual([
    "flow_module_complete",
  ]);
});
