import { expect, test } from "bun:test";
import {
  evaluatePlanTaskState,
  parsePlanTasks,
  projectPlanTaskStates,
} from "../src/plan-task-state";

test("parsePlanTasks reads open, done and skipped checkboxes with depth", () => {
  const tasks = parsePlanTasks(
    [
      "# Plan",
      "",
      "- [ ] top-level open task",
      "- [x] top-level done task",
      "- [~] a skipped task",
      "  - [ ] a nested open task",
      "1. [x] a numbered done task",
      "",
      "Some prose that is not a task.",
    ].join("\n"),
  );
  expect(tasks).toHaveLength(5);
  expect(tasks[0]).toMatchObject({
    declaration: "open",
    depth: 0,
    text: "top-level open task",
  });
  expect(tasks[1]).toMatchObject({ declaration: "done", text: "top-level done task" });
  expect(tasks[2]).toMatchObject({ declaration: "skipped", text: "a skipped task" });
  expect(tasks[3]).toMatchObject({ declaration: "open", depth: 1, text: "a nested open task" });
  expect(tasks[4]).toMatchObject({ declaration: "done", text: "a numbered done task" });
  // Ids are stable document-order ordinals.
  expect(tasks.map((task) => task.id)).toEqual([
    "task:1",
    "task:2",
    "task:3",
    "task:4",
    "task:5",
  ]);
});

test("evaluatePlanTaskState is evidence-first: checked without evidence is a gap", () => {
  expect(evaluatePlanTaskState({ declaration: "done", hasEvidence: true })).toBe("verified");
  expect(evaluatePlanTaskState({ declaration: "done", hasEvidence: false })).toBe("gap");
  expect(evaluatePlanTaskState({ declaration: "open", hasEvidence: true })).toBe("in_progress");
  expect(evaluatePlanTaskState({ declaration: "open", hasEvidence: false })).toBe("pending");
  expect(evaluatePlanTaskState({ declaration: "skipped", hasEvidence: false })).toBe("skipped");
  // A skipped task stays skipped even if some evidence mentions it.
  expect(evaluatePlanTaskState({ declaration: "skipped", hasEvidence: true })).toBe("skipped");
});

test("projectPlanTaskStates matches evidence by taskID or by text reference", () => {
  const tasks = parsePlanTasks(
    ["- [ ] wire the runtime client", "- [x] add the parser", "- [x] ship docs"].join("\n"),
  );
  const states = projectPlanTaskStates(tasks, [
    // Evidence references the "add the parser" task by its text.
    { objective: "add the parser tests", changePaths: [] },
    // Evidence references the runtime client task by taskID.
    { taskID: "task:1", changePaths: ["packages/framework/client"] },
  ]);
  expect(states.map((task) => [task.text, task.state])).toEqual([
    ["wire the runtime client", "in_progress"],
    ["add the parser", "verified"],
    // Checked but no evidence -> gap, not verified.
    ["ship docs", "gap"],
  ]);
});
