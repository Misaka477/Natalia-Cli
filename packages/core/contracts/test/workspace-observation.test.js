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
var workspace_observation_1 = require("../src/workspace-observation");
var observation = {
    id: "obs_1",
    workspaceRoot: "/srv/project",
    path: "src/app.ts",
    operation: "modified",
    health: "healthy",
    at: "2026-08-13T00:00:00.000Z",
};
(0, bun_test_1.test)("a secret-safe observation parses", function () {
    (0, bun_test_1.expect)(workspace_observation_1.workspaceObservationSchema.parse(observation)).toMatchObject({
        id: "obs_1",
        path: "src/app.ts",
        operation: "modified",
        health: "healthy",
        indeterminate: false,
    });
});
(0, bun_test_1.test)("an observation carries correlation and health reason when present", function () {
    (0, bun_test_1.expect)(workspace_observation_1.workspaceObservationSchema.parse(__assign(__assign({}, observation), { health: "degraded", healthReason: "inotify_limit", indeterminate: true, correlation: {
            sessionID: "ses_1",
            episodeID: "epi_1",
            operationID: "op_1",
        } }))).toMatchObject({
        health: "degraded",
        healthReason: "inotify_limit",
        indeterminate: true,
        correlation: { operationID: "op_1" },
    });
});
(0, bun_test_1.test)("the health vocabulary is closed", function () {
    for (var _i = 0, _a = ["healthy", "degraded", "unavailable"]; _i < _a.length; _i++) {
        var value = _a[_i];
        (0, bun_test_1.expect)(workspace_observation_1.workspaceObservationSchema.safeParse(__assign(__assign({}, observation), { health: value }))
            .success).toBe(true);
    }
    (0, bun_test_1.expect)(workspace_observation_1.workspaceObservationSchema.safeParse(__assign(__assign({}, observation), { health: "bogus" }))
        .success).toBe(false);
});
(0, bun_test_1.test)("a confirmed change parses with every origin and attribution", function () {
    var base = {
        id: "chg_1",
        workspaceRoot: "/srv/project",
        path: "src/app.ts",
        operation: "modified",
        correlation: {},
        health: "healthy",
        at: "2026-08-13T00:00:00.000Z",
    };
    for (var _i = 0, _a = [
        "tool",
        "sandbox_merge",
        "checkpoint_rollback",
        "external",
        "unknown",
    ]; _i < _a.length; _i++) {
        var origin_1 = _a[_i];
        for (var _b = 0, _c = [
            "attributed",
            "unattributed",
            "indeterminate",
        ]; _b < _c.length; _b++) {
            var attribution = _c[_b];
            var parsed = workspace_observation_1.confirmedWorkspaceChangeSchema.parse(__assign(__assign({}, base), { origin: origin_1, attribution: attribution }));
            (0, bun_test_1.expect)(parsed.origin).toBe(origin_1);
            (0, bun_test_1.expect)(parsed.attribution).toBe(attribution);
        }
    }
});
(0, bun_test_1.test)("a turn identity requires callID", function () {
    (0, bun_test_1.expect)(workspace_observation_1.workspaceCorrelationSchema.safeParse({ turnID: "t_1" }).success).toBe(false);
    (0, bun_test_1.expect)(workspace_observation_1.workspaceCorrelationSchema.safeParse({
        turnID: "t_1",
        callID: "c_1",
    }).success).toBe(true);
});
(0, bun_test_1.test)("turn and operation identities are mutually exclusive", function () {
    (0, bun_test_1.expect)(workspace_observation_1.workspaceCorrelationSchema.safeParse({
        turnID: "t_1",
        callID: "c_1",
        operationID: "op_1",
    }).success).toBe(false);
});
(0, bun_test_1.test)("an empty correlation is a valid external change", function () {
    (0, bun_test_1.expect)(workspace_observation_1.workspaceCorrelationSchema.parse({})).toEqual({});
});
(0, bun_test_1.test)("the confirmed change schema rejects free-text origin", function () {
    (0, bun_test_1.expect)(workspace_observation_1.confirmedWorkspaceChangeSchema.safeParse({
        id: "chg_2",
        workspaceRoot: "/srv/project",
        path: "a.txt",
        operation: "added",
        origin: "my custom tool",
        attribution: "attributed",
        correlation: {},
        health: "healthy",
        at: "2026-08-13T00:00:00.000Z",
    }).success).toBe(false);
});
