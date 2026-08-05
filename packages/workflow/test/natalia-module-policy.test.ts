import { expect, test } from "bun:test";
import { moduleToolPolicy } from "../src";

test("module tool policies expose stable capability bundles", () => {
  expect(moduleToolPolicy("read_search").allow).toEqual([
    "flow_module_complete",
    "read_file",
    "glob",
    "grep",
    "read_media_file",
    "read_data_source",
  ]);
  expect(moduleToolPolicy("terminal").allow).toContain(
    "interactive_terminal_*",
  );
  expect(moduleToolPolicy("report_output").allow).toEqual([
    "flow_module_complete",
    "report_issue",
  ]);
  // The reporting capability belongs to the report module only.
  expect(moduleToolPolicy("read_search").allow).not.toContain("report_issue");
  expect(moduleToolPolicy("terminal").allow).not.toContain("report_issue");
  // Incremental log reading is a read capability, not a reporting one.
  expect(moduleToolPolicy("report_output").allow).not.toContain(
    "read_data_source",
  );
});
