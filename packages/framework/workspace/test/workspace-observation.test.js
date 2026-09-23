"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var contracts_1 = require("@natalia/contracts");
var workspace_observation_1 = require("../src/workspace-observation");
(0, bun_test_1.test)("the secret-safe guard rejects content and command fields", function () {
    var _loop_1 = function (forbidden) {
        (0, bun_test_1.expect)(function () {
            var _a;
            return (0, workspace_observation_1.assertSecretSafeObservation)((_a = { path: "a.txt" }, _a[forbidden] = "x", _a));
        }).toThrow("forbidden field: ".concat(forbidden));
    };
    for (var _i = 0, _a = [
        "content",
        "diff",
        "patch",
        "command",
        "args",
        "arguments",
        "result",
        "output",
        "thinking",
        "reasoning",
        "context",
        "error",
        "stderr",
        "stdout",
    ]; _i < _a.length; _i++) {
        var forbidden = _a[_i];
        _loop_1(forbidden);
    }
});
(0, bun_test_1.test)("the secret-safe guard accepts only contract fields", function () {
    (0, bun_test_1.expect)(function () {
        return (0, workspace_observation_1.assertSecretSafeObservation)({
            id: "obs_1",
            workspaceRoot: "/srv/project",
            path: "a.txt",
            operation: "modified",
            health: "healthy",
            at: "2026-08-13T00:00:00.000Z",
        });
    }).not.toThrow();
});
(0, bun_test_1.test)("health carries an optional reason", function () {
    (0, bun_test_1.expect)((0, workspace_observation_1.observationHealth)("healthy")).toEqual({ status: "healthy" });
    (0, bun_test_1.expect)((0, workspace_observation_1.observationHealth)("degraded", "inotify_limit")).toEqual({
        status: "degraded",
        reason: "inotify_limit",
    });
});
(0, bun_test_1.test)("turn correlation requires turnID and callID together", function () {
    var correlation = (0, workspace_observation_1.turnCorrelation)({
        sessionID: "ses_1",
        episodeID: "epi_1",
        turnID: "t_1",
        callID: "c_1",
    });
    (0, bun_test_1.expect)(contracts_1.workspaceCorrelationSchema.parse(correlation)).toMatchObject({
        turnID: "t_1",
        callID: "c_1",
    });
});
(0, bun_test_1.test)("operation correlation uses the non-turn identity", function () {
    var correlation = (0, workspace_observation_1.operationCorrelation)({
        sessionID: "ses_1",
        operationID: "op_1",
    });
    (0, bun_test_1.expect)(contracts_1.workspaceCorrelationSchema.parse(correlation)).toMatchObject({
        operationID: "op_1",
    });
});
(0, bun_test_1.test)("attribution is never forced without a reliable identity", function () {
    (0, bun_test_1.expect)((0, workspace_observation_1.attributionFor)("tool", { hasReliableIdentity: true, indeterminate: false })).toBe("attributed");
    (0, bun_test_1.expect)((0, workspace_observation_1.attributionFor)("tool", {
        hasReliableIdentity: false,
        indeterminate: false,
    })).toBe("unattributed");
    (0, bun_test_1.expect)((0, workspace_observation_1.attributionFor)("external", {
        hasReliableIdentity: true,
        indeterminate: false,
    })).toBe("unattributed");
    (0, bun_test_1.expect)((0, workspace_observation_1.attributionFor)("tool", { hasReliableIdentity: true, indeterminate: true })).toBe("indeterminate");
});
