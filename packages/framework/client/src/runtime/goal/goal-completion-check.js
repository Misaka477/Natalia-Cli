"use strict";
/**
 * The configured completion check, run before a model claims a goal complete.
 *
 * A goal used to be complete because whoever reported it said so, which left the
 * authority entirely in the model's own claim. A configured command makes that
 * claim checkable: the model says "done", and the workspace gets to answer.
 *
 * The command runs in the workspace root with a bounded output capture, because
 * the result is shown to the model rather than to a log reader — an unbounded
 * dump would spend the context it is trying to protect. A timeout is reported as
 * a failure rather than swallowed, so a hanging check cannot look like a pass.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCompletionCheck = runCompletionCheck;
var node_child_process_1 = require("node:child_process");
/** How long the check may run before it is treated as failed. */
var COMPLETION_CHECK_TIMEOUT_MS = 120000;
/** How much of the check's output is shown to the model. */
var COMPLETION_CHECK_OUTPUT_CHARS = 4000;
/**
 * Runs the configured command and reports whether it succeeded.
 *
 * `undefined` means no command is configured, which is the case that must behave
 * exactly as before: a completion check nobody asked for is not a safety net, it
 * is a way to fail workspaces that have no test suite.
 */
function runCompletionCheck(input) {
    var _a, _b;
    if (!input.command)
        return undefined;
    var result = (0, node_child_process_1.spawnSync)(input.command, {
        cwd: input.workspaceRoot,
        shell: true,
        timeout: COMPLETION_CHECK_TIMEOUT_MS,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
    });
    var status = result.status;
    var ok = result.error === undefined && status === 0;
    var combined = "".concat((_a = result.stdout) !== null && _a !== void 0 ? _a : "").concat((_b = result.stderr) !== null && _b !== void 0 ? _b : "").trim();
    var bounded = combined.length > COMPLETION_CHECK_OUTPUT_CHARS
        ? "".concat(combined.slice(0, COMPLETION_CHECK_OUTPUT_CHARS), "\\n\u2026 (").concat(combined.length - COMPLETION_CHECK_OUTPUT_CHARS, " more characters)")
        : combined;
    var detail = result.error
        ? "The check could not run: ".concat(result.error.message)
        : ok
            ? undefined
            : "Exit code ".concat(status !== null && status !== void 0 ? status : "unknown").concat(bounded ? "\\n".concat(bounded) : "");
    return __assign({ ok: ok, command: input.command }, (detail ? { detail: detail } : {}));
}
