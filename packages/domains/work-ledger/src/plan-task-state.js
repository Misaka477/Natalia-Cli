"use strict";
/**
 * Plan task state machine — work-ledger/plan-task-state.ts (EI §4 Phase 4).
 *
 * The plan document's markdown checkboxes are the **declaration source** (the
 * human ticks a step as done); the runtime's recorded evidence is the **fact
 * source** (what was actually verified). The state machine projects the two
 * into one judge-able state per task, evidence-first:
 *
 *   checked + evidence  -> verified   (declared and backed)
 *   checked + no evidence -> gap      (declared done but nothing backs it)
 *   open + evidence     -> in_progress (work has started, not declared done)
 *   open + no evidence  -> pending
 *   skipped             -> skipped    (explicitly not-done, still visible)
 *
 * A checked box is never `verified` without evidence (EI §2 principle 1:
 * evidence-backed, never text similarity). `gap` and `skipped` stay visible so
 * a plan cannot quietly claim completion it has not earned.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LANDING_LOG_HEADING = void 0;
exports.parsePlanTasks = parsePlanTasks;
exports.evaluatePlanTaskState = evaluatePlanTaskState;
exports.projectPlanTaskStates = projectPlanTaskStates;
exports.applyPlanDocTick = applyPlanDocTick;
// A markdown task list item: optional indent, a bullet or number, a checkbox
// marker, and the label. `x`/`X` = done, `-`/`~` = skipped, space = open.
var TASK_LINE = /^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX~\-])\]\s+(.+?)\s*$/u;
/**
 * Parses a plan document's markdown checkboxes into tasks (EI §4 Phase 4).
 * Non-task lines are ignored; nested tasks keep their depth so a consumer can
 * render the hierarchy. The ordinal is document order, giving each task a
 * stable id for the document's lifetime.
 */
function parsePlanTasks(content) {
    var _a, _b, _c;
    var tasks = [];
    var lines = content.replace(/\r\n?/gu, "\n").split("\n");
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        var match = line.match(TASK_LINE);
        if (!match)
            continue;
        var indent = (_a = match[1]) !== null && _a !== void 0 ? _a : "";
        var marker = (_b = match[2]) !== null && _b !== void 0 ? _b : " ";
        var text = ((_c = match[3]) !== null && _c !== void 0 ? _c : "").trim();
        if (!text)
            continue;
        var depth = Math.floor(indent.replace(/\t/gu, "  ").length / 2);
        var declaration = marker === "x" || marker === "X"
            ? "done"
            : marker === "-" || marker === "~"
                ? "skipped"
                : "open";
        tasks.push({
            id: "task:".concat(tasks.length + 1),
            text: text,
            declaration: declaration,
            depth: depth,
        });
    }
    return tasks;
}
/**
 * Projects one task's state from its declaration and whether the runtime has
 * recorded evidence for it (EI §4 Phase 4, evidence-first). `hasEvidence` is
 * true when a completion/evidence fact references the task.
 */
function evaluatePlanTaskState(input) {
    if (input.declaration === "skipped")
        return "skipped";
    if (input.declaration === "done")
        return input.hasEvidence ? "verified" : "gap";
    return input.hasEvidence ? "in_progress" : "pending";
}
/**
 * Projects a plan's tasks into states, matching each task against the runtime
 * evidence. A task has evidence when a recorded fact's `taskID` equals the
 * task id, or its objective / change paths reference the task text (the model
 * records evidence with a free-form taskID, so the text reference is the
 * fallback the plan's own wording provides). Returns the tasks with their
 * projected state, preserving document order.
 */
function projectPlanTaskStates(tasks, evidence) {
    var normalized = function (value) { return value.toLowerCase(); };
    return tasks.map(function (task) {
        var hasEvidence = evidence.some(function (fact) {
            var _a;
            if (fact.taskID && fact.taskID === task.id)
                return true;
            var needle = normalized(task.text);
            if (!needle)
                return false;
            if (fact.objective && normalized(fact.objective).includes(needle))
                return true;
            return ((_a = fact.changePaths) !== null && _a !== void 0 ? _a : []).some(function (path) {
                return normalized(path).includes(needle);
            });
        });
        return __assign(__assign({}, task), { state: evaluatePlanTaskState({
                declaration: task.declaration,
                hasEvidence: hasEvidence,
            }) });
    });
}
/** The landing-log section the model appends to a checkbox-less plan. */
exports.LANDING_LOG_HEADING = "落地日志";
// A markdown ATX heading (its own local copy — this module must not reach into
// the constitution-doc parser for a regex).
var HEADING_LINE = /^(#{1,6})\s+(.*\S)\s*$/u;
function normalizeLabel(text) {
    return text.trim().replace(/\s+/gu, " ").toLowerCase();
}
/**
 * Ticks / unticks one checkbox task, or — when the plan carries no checkboxes
 * at all — appends (or extends) a `## 落地日志` landing-log section holding the
 * task. This is the model's "declare this step done / retract it" action.
 *
 * Only a marker flips or a log item is appended; **no existing line's text is
 * ever rewritten**, so the model can declare progress without editing the plan.
 * A plan that already has checkboxes will not gain fabricated tasks: a
 * non-matching `task` is refused rather than silently injected.
 */
function applyPlanDocTick(content, input) {
    var _a, _b;
    var task = input.task.trim();
    if (!task)
        return { ok: false, reason: "task must not be empty" };
    var lines = content.replace(/\r\n?/gu, "\n").split("\n");
    var target = normalizeLabel(task);
    var boxes = [];
    for (var index = 0; index < lines.length; index += 1) {
        var match = lines[index].match(TASK_LINE);
        if (!match)
            continue;
        boxes.push({
            index: index,
            raw: lines[index],
            label: normalizeLabel((_a = match[3]) !== null && _a !== void 0 ? _a : ""),
            marker: (_b = match[2]) !== null && _b !== void 0 ? _b : " ",
        });
    }
    // Prefer an exact label match; otherwise a unique substring match either way.
    var exact = boxes.filter(function (box) { return box.label === target; });
    var chosen = exact.length === 1 ? exact[0] : undefined;
    if (!chosen && exact.length === 0) {
        var substrings = boxes.filter(function (box) {
            return (box.label.includes(target) && target.length >= 2) ||
                (target.includes(box.label) && box.label.length >= 4);
        });
        if (substrings.length === 1)
            chosen = substrings[0];
    }
    if (chosen) {
        var wasDone = chosen.marker === "x" || chosen.marker === "X";
        if (input.done === wasDone) {
            // Already in the requested state — a no-op write, still reported.
            return {
                ok: true,
                content: content,
                action: input.done ? "ticked" : "unticked",
            };
        }
        var marker = input.done ? "x" : " ";
        var next = __spreadArray([], lines, true);
        next[chosen.index] = chosen.raw.replace(/\[([ xX~\-])\]/, "[".concat(marker, "]"));
        return {
            ok: true,
            content: next.join("\n"),
            action: input.done ? "ticked" : "unticked",
        };
    }
    // No checkbox matched. Append to the landing log when the plan has none at
    // all (a prose plan) or already carries a landing-log section (the model is
    // using it); otherwise refuse — a checklist plan's tasks are matched, not
    // fabricated.
    var hasLandingLog = lines.some(function (line) {
        var match = line.match(HEADING_LINE);
        return Boolean(match && match[2].trim().includes(exports.LANDING_LOG_HEADING));
    });
    if (boxes.length > 0 && !hasLandingLog) {
        return {
            ok: false,
            reason: "no checkbox task matches \"".concat(task, "\" in this plan (or it is ambiguous); read the plan and pass the exact step label"),
        };
    }
    var item = "".concat(input.done ? "- [x]" : "- [ ]", " ").concat(task);
    return {
        ok: true,
        content: appendToLandingLog(lines, item).join("\n"),
        action: "logged",
    };
}
/** Appends `item` to the `## 落地日志` section, creating it if absent. */
function appendToLandingLog(lines, item) {
    var headingIndex = -1;
    for (var index = 0; index < lines.length; index += 1) {
        var match = lines[index].match(HEADING_LINE);
        if (match && match[2].trim().includes(exports.LANDING_LOG_HEADING)) {
            headingIndex = index;
            break;
        }
    }
    if (headingIndex < 0) {
        var trimmed = __spreadArray([], lines, true);
        while (trimmed.length && trimmed[trimmed.length - 1].trim() === "")
            trimmed.pop();
        return __spreadArray(__spreadArray([], trimmed, true), ["", "## ".concat(exports.LANDING_LOG_HEADING), "", item], false);
    }
    // Find the section's end (the next heading or EOF) and its last content line.
    var end = headingIndex + 1;
    var lastContent = headingIndex;
    while (end < lines.length) {
        if (lines[end].match(HEADING_LINE))
            break;
        if (lines[end].trim() !== "")
            lastContent = end;
        end += 1;
    }
    var insertAt = Math.max(lastContent, headingIndex) + 1;
    var next = __spreadArray([], lines, true);
    next.splice(insertAt, 0, lastContent === headingIndex ? "\n".concat(item) : item);
    return next;
}
