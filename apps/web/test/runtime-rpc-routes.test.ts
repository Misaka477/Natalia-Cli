import { expect, test } from "bun:test";
import { RPC_METHOD_ROUTES, buildParams } from "../src/runtime-rpc";

test("web runtime routes expose the paged transcript surfaces", () => {
  expect(RPC_METHOD_ROUTES.subagentHistoryPage).toBe(
    "subagent.history.page",
  );
});

test("object-style RPC params stay flat", () => {
  expect(buildParams("driftFindings", [{ sessionID: "ses_1" }])).toEqual({
    sessionID: "ses_1",
  });
  expect(buildParams("evidenceRecords", [{ sessionID: "ses_1" }])).toEqual({
    sessionID: "ses_1",
  });
  expect(buildParams("recordDecision", [{ decision: "keep this flat" }])).toEqual({
    decision: "keep this flat",
  });
});
