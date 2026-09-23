"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var collab_1 = require("@natalia/collab");
/**
 * Discovery D3's trigger pieces: the boundary folds D2's paired invariant
 * edges into drift signals, and reads the session's instruction epoch.
 */
var violation = function (code, at, detail) {
    return ({
        type: "invariant.violation",
        at: at,
        owner: "session",
        invariant: "inv",
        code: code,
        detail: detail,
        sessionID: "ses_x",
    });
};
var resolved = function (code, at, detail) {
    return ({
        type: "invariant.resolved",
        at: at,
        owner: "session",
        invariant: "inv",
        code: code,
        detail: detail,
        sessionID: "ses_x",
    });
};
(0, bun_test_1.test)("open invariant hits fold the violation/resolved edges", function () {
    (0, bun_test_1.expect)((0, collab_1.openInvariantHits)([])).toEqual([]);
    var events = [
        violation("a", "t1", "d1"),
        violation("b", "t2", "d2"),
        resolved("a", "t3", "d1"),
        violation("a", "t4", "d1"), // re-open counts again
    ];
    (0, bun_test_1.expect)((0, collab_1.openInvariantHits)(events)).toEqual([
        { code: "b", at: "t2", detail: "d2" },
        { code: "a", at: "t4", detail: "d1" },
    ]);
});
(0, bun_test_1.test)("instruction revision is the max — the epoch never runs backwards", function () {
    var instructions = function (revision) {
        return ({
            type: "context.instructions",
            id: "ci_".concat(revision),
            kind: "config_reload",
            at: "2026-01-01T00:00:00.000Z",
            revision: revision,
            summary: "reload",
        });
    };
    (0, bun_test_1.expect)((0, collab_1.instructionRevision)([])).toBe(0);
    (0, bun_test_1.expect)((0, collab_1.instructionRevision)([instructions(3), instructions(1), instructions(2)])).toBe(3);
});
