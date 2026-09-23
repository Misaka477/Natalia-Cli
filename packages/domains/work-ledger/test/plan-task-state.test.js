"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var plan_task_state_1 = require("../src/plan-task-state");
(0, bun_test_1.test)("parsePlanTasks reads open, done and skipped checkboxes with depth", function () {
    var tasks = (0, plan_task_state_1.parsePlanTasks)([
        "# Plan",
        "",
        "- [ ] top-level open task",
        "- [x] top-level done task",
        "- [~] a skipped task",
        "  - [ ] a nested open task",
        "1. [x] a numbered done task",
        "",
        "Some prose that is not a task.",
    ].join("\n"));
    (0, bun_test_1.expect)(tasks).toHaveLength(5);
    (0, bun_test_1.expect)(tasks[0]).toMatchObject({
        declaration: "open",
        depth: 0,
        text: "top-level open task",
    });
    (0, bun_test_1.expect)(tasks[1]).toMatchObject({
        declaration: "done",
        text: "top-level done task",
    });
    (0, bun_test_1.expect)(tasks[2]).toMatchObject({
        declaration: "skipped",
        text: "a skipped task",
    });
    (0, bun_test_1.expect)(tasks[3]).toMatchObject({
        declaration: "open",
        depth: 1,
        text: "a nested open task",
    });
    (0, bun_test_1.expect)(tasks[4]).toMatchObject({
        declaration: "done",
        text: "a numbered done task",
    });
    // Ids are stable document-order ordinals.
    (0, bun_test_1.expect)(tasks.map(function (task) { return task.id; })).toEqual([
        "task:1",
        "task:2",
        "task:3",
        "task:4",
        "task:5",
    ]);
});
(0, bun_test_1.test)("evaluatePlanTaskState is evidence-first: checked without evidence is a gap", function () {
    (0, bun_test_1.expect)((0, plan_task_state_1.evaluatePlanTaskState)({ declaration: "done", hasEvidence: true })).toBe("verified");
    (0, bun_test_1.expect)((0, plan_task_state_1.evaluatePlanTaskState)({ declaration: "done", hasEvidence: false })).toBe("gap");
    (0, bun_test_1.expect)((0, plan_task_state_1.evaluatePlanTaskState)({ declaration: "open", hasEvidence: true })).toBe("in_progress");
    (0, bun_test_1.expect)((0, plan_task_state_1.evaluatePlanTaskState)({ declaration: "open", hasEvidence: false })).toBe("pending");
    (0, bun_test_1.expect)((0, plan_task_state_1.evaluatePlanTaskState)({ declaration: "skipped", hasEvidence: false })).toBe("skipped");
    // A skipped task stays skipped even if some evidence mentions it.
    (0, bun_test_1.expect)((0, plan_task_state_1.evaluatePlanTaskState)({ declaration: "skipped", hasEvidence: true })).toBe("skipped");
});
(0, bun_test_1.test)("projectPlanTaskStates matches evidence by taskID or by text reference", function () {
    var tasks = (0, plan_task_state_1.parsePlanTasks)([
        "- [ ] wire the runtime client",
        "- [x] add the parser",
        "- [x] ship docs",
    ].join("\n"));
    var states = (0, plan_task_state_1.projectPlanTaskStates)(tasks, [
        // Evidence references the "add the parser" task by its text.
        { objective: "add the parser tests", changePaths: [] },
        // Evidence references the runtime client task by taskID.
        { taskID: "task:1", changePaths: ["packages/framework/client"] },
    ]);
    (0, bun_test_1.expect)(states.map(function (task) { return [task.text, task.state]; })).toEqual([
        ["wire the runtime client", "in_progress"],
        ["add the parser", "verified"],
        // Checked but no evidence -> gap, not verified.
        ["ship docs", "gap"],
    ]);
});
(0, bun_test_1.test)("applyPlanDocTick ticks and unticks an existing checkbox, leaving text intact", function () {
    var doc = [
        "# Plan",
        "",
        "- [ ] wire the runtime client",
        "- [x] add the parser",
    ].join("\n");
    var ticked = (0, plan_task_state_1.applyPlanDocTick)(doc, {
        task: "wire the runtime client",
        done: true,
    });
    (0, bun_test_1.expect)(ticked.ok).toBe(true);
    if (!ticked.ok)
        return;
    (0, bun_test_1.expect)(ticked.action).toBe("ticked");
    (0, bun_test_1.expect)(ticked.content).toContain("- [x] wire the runtime client");
    (0, bun_test_1.expect)(ticked.content).toContain("- [x] add the parser");
    // The heading and label text are untouched.
    (0, bun_test_1.expect)(ticked.content).toContain("# Plan");
    (0, bun_test_1.expect)(ticked.content).toContain("wire the runtime client");
    var unticked = (0, plan_task_state_1.applyPlanDocTick)(doc, {
        task: "add the parser",
        done: false,
    });
    (0, bun_test_1.expect)(unticked.ok).toBe(true);
    if (!unticked.ok)
        return;
    (0, bun_test_1.expect)(unticked.action).toBe("unticked");
    (0, bun_test_1.expect)(unticked.content).toContain("- [ ] add the parser");
});
(0, bun_test_1.test)("applyPlanDocTick matches a unique label substring", function () {
    var doc = ["- [ ] rewrite the tokenizer", "- [ ] add the parser"].join("\n");
    var hit = (0, plan_task_state_1.applyPlanDocTick)(doc, { task: "tokenizer", done: true });
    (0, bun_test_1.expect)(hit.ok).toBe(true);
    if (!hit.ok)
        return;
    (0, bun_test_1.expect)(hit.content).toContain("- [x] rewrite the tokenizer");
    // The other task is not touched.
    (0, bun_test_1.expect)(hit.content).toContain("- [ ] add the parser");
});
(0, bun_test_1.test)("applyPlanDocTick refuses a non-matching or ambiguous task on a checklist plan", function () {
    var doc = ["- [ ] add the parser", "- [ ] add the tests"].join("\n");
    var missing = (0, plan_task_state_1.applyPlanDocTick)(doc, { task: "ship the docs", done: true });
    (0, bun_test_1.expect)(missing.ok).toBe(false);
    // "add the ..." matches two tasks — ambiguous, refused rather than guessed.
    var ambiguous = (0, plan_task_state_1.applyPlanDocTick)(doc, { task: "add the", done: true });
    (0, bun_test_1.expect)(ambiguous.ok).toBe(false);
});
(0, bun_test_1.test)("applyPlanDocTick appends a 落地日志 section when the plan has no checkboxes", function () {
    var doc = [
        "# Design notes",
        "",
        "Some prose, no checkboxes here.",
        "",
    ].join("\n");
    var first = (0, plan_task_state_1.applyPlanDocTick)(doc, { task: "wired the parser", done: true });
    (0, bun_test_1.expect)(first.ok).toBe(true);
    if (!first.ok)
        return;
    (0, bun_test_1.expect)(first.action).toBe("logged");
    (0, bun_test_1.expect)(first.content).toContain("## 落地日志");
    (0, bun_test_1.expect)(first.content).toContain("- [x] wired the parser");
    // The original prose is preserved.
    (0, bun_test_1.expect)(first.content).toContain("Some prose, no checkboxes here.");
    // A second tick extends the same section instead of adding another heading.
    var second = (0, plan_task_state_1.applyPlanDocTick)(first.content, {
        task: "shipped the docs",
        done: true,
    });
    (0, bun_test_1.expect)(second.ok).toBe(true);
    if (!second.ok)
        return;
    (0, bun_test_1.expect)(second.content.match(/## 落地日志/g)).toHaveLength(1);
    (0, bun_test_1.expect)(second.content).toContain("- [x] shipped the docs");
    (0, bun_test_1.expect)(second.content).toContain("- [x] wired the parser");
});
(0, bun_test_1.test)("applyPlanDocTick is idempotent and refuses an empty task", function () {
    var doc = ["- [x] done thing"].join("\n");
    var again = (0, plan_task_state_1.applyPlanDocTick)(doc, { task: "done thing", done: true });
    (0, bun_test_1.expect)(again.ok).toBe(true);
    if (!again.ok)
        return;
    (0, bun_test_1.expect)(again.content).toBe(doc);
    (0, bun_test_1.expect)(again.action).toBe("ticked");
    var empty = (0, plan_task_state_1.applyPlanDocTick)(doc, { task: "   ", done: true });
    (0, bun_test_1.expect)(empty.ok).toBe(false);
});
