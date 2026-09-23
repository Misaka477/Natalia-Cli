"use strict";
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
var bun_test_1 = require("bun:test");
var diagnostics_query_1 = require("../src/runtime/diagnostics-query");
/**
 * The unified diagnostics query (decisions §5: journal + operational log,
 * ONE face): one filter over two heterogeneous sources, honest about what
 * each side has.
 */
var event = function (over) {
    return (__assign({ id: "e1" }, over));
};
var record = function (over) { return (__assign({ at: "2026-01-01T00:00:00.000Z", level: "info", component: "collab", message: "m" }, over)); };
var events = [
    event({
        type: "context.instructions",
        id: "ci_1",
        kind: "config_reload",
        at: "2026-01-01T00:00:00.000Z",
        revision: 1,
        summary: "reload",
        sessionID: "ses_a",
    }),
    event({ type: "turn.finished", sessionID: "ses_b" }), // no at
    event({ type: "tool.update", sessionID: "ses_a", name: "run_shell" }),
];
var records = [
    record({
        at: "2026-01-01T00:00:00.000Z",
        level: "info",
        component: "collab",
    }),
    record({
        at: "2026-01-02T00:00:00.000Z",
        level: "error",
        component: "shutdown",
        message: "boom",
    }),
    record({
        at: "2026-01-02T00:00:00.000Z",
        level: "warn",
        component: "collab",
        corr: { sessionID: "ses_a" },
    }),
];
(0, bun_test_1.test)("one filter, two sources — with each side's honest semantics", function () {
    var _a;
    // sessionID scopes BOTH halves (the operational side via corr).
    var scoped = (0, diagnostics_query_1.queryDiagnostics)({
        events: events,
        records: records,
        filter: { sessionID: "ses_a" },
    });
    (0, bun_test_1.expect)(scoped.journal.map(function (e) { return e.type; })).toEqual([
        "context.instructions",
        "tool.update",
    ]);
    (0, bun_test_1.expect)(scoped.operational).toHaveLength(1);
    (0, bun_test_1.expect)((_a = scoped.operational[0].corr) === null || _a === void 0 ? void 0 : _a.sessionID).toBe("ses_a");
    // level/component exist only on the operational half.
    var severe = (0, diagnostics_query_1.queryDiagnostics)({
        events: events,
        records: records,
        filter: { level: "warn" },
    });
    (0, bun_test_1.expect)(severe.operational).toHaveLength(2); // warn + error
    (0, bun_test_1.expect)(severe.journal).toHaveLength(3); // journal has no levels: unchanged
    // since: both sides, and a journal event WITHOUT an at is excluded
    // rather than guessed about (the honesty rule).
    var recent = (0, diagnostics_query_1.queryDiagnostics)({
        events: events,
        records: records,
        filter: { since: "2026-01-02T00:00:00.000Z" },
    });
    // turn.started carries 01-01 (< since) and the other two carry no at:
    // all excluded — a timestamp filter never guesses.
    (0, bun_test_1.expect)(recent.journal).toHaveLength(0);
    (0, bun_test_1.expect)(recent.operational).toHaveLength(2);
    // contains reaches into payloads on both halves.
    var boom = (0, diagnostics_query_1.queryDiagnostics)({
        events: events,
        records: records,
        filter: { contains: "boom" },
    });
    (0, bun_test_1.expect)(boom.operational).toHaveLength(1);
    (0, bun_test_1.expect)(boom.journal).toHaveLength(0);
    // The per-side tail cap.
    var capped = (0, diagnostics_query_1.queryDiagnostics)({ events: events, records: records, filter: { limit: 1 } });
    (0, bun_test_1.expect)(capped.journal).toHaveLength(1);
    (0, bun_test_1.expect)(capped.operational).toHaveLength(1);
    (0, bun_test_1.expect)(capped.operational[0].message).toBe("m"); // newest per side? records[2] is warn 'm'
});
