"use strict";
/**
 * Delivering a managed process's exit to the session that started it.
 *
 * The process plugin owns the registry and the observer that watches it, but a
 * plugin cannot write into a session: the tool context has no publishing surface,
 * and that boundary is deliberate. So the plugin publishes the observer under a
 * service name and this module — which does own sessions — subscribes to it.
 *
 * The notice lands in the ledger as a `role:"dynamic"` entry, the same shape the
 * plan pointer and the subagent settled notice use: it renders as a user message
 * rather than a system one, so appending it after the conversation does not hoist
 * anything to the top and reset the stable prefix.
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
exports.wireProcessSettledNotices = wireProcessSettledNotices;
var tools_1 = require("@anthelia/tools");
/** Entry id for one process's terminal notice. */
function noticeEntryID(processID) {
    return "process_settled:".concat(processID);
}
/** The model-visible content of one notice. */
function noticeContent(input) {
    var ending = input.exitCode === undefined
        ? input.status
        : "".concat(input.status, " (exit code ").concat(input.exitCode, ")");
    return [
        "<runtime_context source=\"process_settled\" trust=\"runtime\" process_id=\"".concat(input.processID, "\">"),
        "The background process you started has finished: ".concat(ending, "."),
        "Command: ".concat(input.command),
        "This is the runtime reporting the outcome. Use process_output to read its " +
            "log, or process_start to run it again.",
        "</runtime_context>",
    ].join("\n");
}
/**
 * Subscribe to process exits and write each into its starting session.
 *
 * Subscribed through `onServiceUpdate` rather than a one-shot lookup because the
 * plugin providing the observer loads asynchronously: a direct `service()` call
 * during composition would find nothing and silently never receive a notice.
 */
function wireProcessSettledNotices(ctx, capabilityRegistry) {
    var seen = new Set();
    var unsubscribe;
    var attach = function (observer) {
        unsubscribe === null || unsubscribe === void 0 ? void 0 : unsubscribe();
        unsubscribe = undefined;
        if (!observer)
            return;
        unsubscribe = observer.subscribe(function (notice) {
            // One notice per process: a process settles once, and a second entry would
            // read as a second process having finished.
            if (seen.has(notice.id))
                return;
            seen.add(notice.id);
            if (!notice.sessionID)
                return;
            var exec = ctx.ports
                .getExecutionBySession()
                .get(notice.sessionID);
            if (!exec)
                return;
            exec.context.add({
                id: noticeEntryID(notice.id),
                role: "dynamic",
                content: noticeContent(__assign({ processID: notice.id, command: notice.command, status: notice.status }, (notice.exitCode === undefined
                    ? {}
                    : { exitCode: notice.exitCode }))),
            });
        });
    };
    // The update carries no value — only that something changed — so the observer
    // is re-read rather than taken from the notification. A re-read is also what
    // makes a provider swap correct: the new observer replaces the old subscription
    // instead of stacking a second one beside it.
    var offUpdate = capabilityRegistry.onServiceUpdate(function () {
        attach(capabilityRegistry.service(tools_1.PROCESS_OBSERVER_SERVICE));
    });
    // The plugin may already be loaded, in which case no update will arrive.
    attach(capabilityRegistry.service(tools_1.PROCESS_OBSERVER_SERVICE));
    return function () {
        offUpdate();
        unsubscribe === null || unsubscribe === void 0 ? void 0 : unsubscribe();
    };
}
