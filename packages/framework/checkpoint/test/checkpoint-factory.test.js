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
var src_1 = require("../src");
function fakeAccessors(overrides) {
    var events = [];
    var context = {
        journalStatus: function () { return ({ tokenEstimate: 0, messageCount: 0 }); },
        durableCheckpoint: function (step) { return ({
            entries: [],
            journalOffset: step,
            step: step,
            tokenEstimate: 0,
            compactionGeneration: 0,
        }); },
    };
    return {
        accessors: {
            sessionID: function () { return overrides.sessionID; },
            workspaceRoot: overrides.workspaceRoot,
            checkpoint: function () { return undefined; },
            workspace: function () { return undefined; },
            publish: function (event) { return events.push(event); },
            context: function () { return context; },
            subagents: function () { return undefined; },
            activeAbort: function () { return undefined; },
            workLedger: function () { return ({
                checkpointNode: function (input) { return (__assign({ type: "workgraph.node_added" }, input)); },
                rollbackCheckpointEdge: function (input) { return (__assign({ type: "workgraph.edge_added" }, input)); },
            }); },
        },
        events: events,
    };
}
(0, bun_test_1.test)("checkpoint factory returns one controller per session", function () {
    var factory = (0, src_1.createCheckpointFactory)({ workspaceRoot: "/tmp/ws" });
    var first = fakeAccessors({
        workspaceRoot: "/tmp/ws",
        sessionID: "ses_a",
    }).accessors;
    var second = fakeAccessors({
        workspaceRoot: "/tmp/ws",
        sessionID: "ses_a",
    }).accessors;
    var other = fakeAccessors({
        workspaceRoot: "/tmp/ws",
        sessionID: "ses_b",
    }).accessors;
    (0, bun_test_1.expect)(factory(first)).toBe(factory(second));
    (0, bun_test_1.expect)(factory(first)).not.toBe(factory(other));
});
(0, bun_test_1.test)("checkpoint factory close clears per-session controllers", function () {
    var factory = (0, src_1.createCheckpointFactory)({ workspaceRoot: "/tmp/ws" });
    var accessors = fakeAccessors({
        workspaceRoot: "/tmp/ws",
        sessionID: "ses_c",
    }).accessors;
    var controller = factory(accessors);
    (0, bun_test_1.expect)(controller.isEnabled()).toBe(false);
    (0, bun_test_1.expect)(function () { return controller.get(); }).toThrow("checkpoint store is not initialized");
    (0, bun_test_1.expect)(controller.resources()).toEqual([]);
    factory.close();
    var next = factory(fakeAccessors({ workspaceRoot: "/tmp/ws", sessionID: "ses_c" }).accessors);
    (0, bun_test_1.expect)(next).not.toBe(controller);
});
