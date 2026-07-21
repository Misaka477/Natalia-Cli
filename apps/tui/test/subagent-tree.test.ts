import { expect, test } from "bun:test";
import { initialState, reduceState } from "../src/context/state";

test("subagent state preserves parent-agent tree provenance", () => {
  const state = reduceState(initialState, {
    type: "subagent.update",
    id: "child",
    status: "running",
    attached: true,
    event: "created",
    task: "child task",
    parentSessionID: "ses_parent",
    parentAgentID: "root",
    continuation: 0,
  });
  expect(state.subagents.child?.parentAgentID).toBe("root");
  expect(state.subagents.child?.parentSessionID).toBe("ses_parent");
});
