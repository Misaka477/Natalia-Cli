"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var ui_model_1 = require("@natalia/ui-model");
(0, bun_test_1.test)("checkpoint progress and result events project for TUI and plain output", function () {
    var _a;
    var created = {
        type: "checkpoint.created",
        id: "checkpoint_1",
        reason: "manual",
        sequence: 1,
        complete: true,
        files: 3,
        changes: 2,
        contextJournalOffset: 4,
        step: 2,
        tokenEstimate: 120,
        diskUsageBytes: 2048,
    };
    var preview = {
        type: "rollback.previewed",
        preview: {
            checkpointID: "checkpoint_0",
            dryRun: true,
            changes: [{ kind: "delete", path: "test_example.py" }],
            context: {
                truncateMessages: 3,
                targetJournalOffset: 1,
                targetStep: 0,
                targetTokens: 10,
                compactionGeneration: 0,
            },
            resources: [
                {
                    kind: "terminal",
                    id: "pty_1",
                    action: "stop",
                    summary: "running shell",
                },
            ],
            ignoredFiles: 1,
            diskUsageBytes: 2048,
            complete: true,
            warnings: [],
        },
    };
    (0, bun_test_1.expect)((0, src_1.checkpointDisplayLine)(created)).toContain("checkpoint_1");
    (0, bun_test_1.expect)((0, ui_model_1.checkpointProgressView)(created)).toEqual({
        title: "Checkpoint checkpoint_1",
        detail: "3 tracked files, 2 changes, step 2, 120 tokens",
        severity: "info",
    });
    (0, bun_test_1.expect)((0, src_1.checkpointDisplayLine)(preview)).toContain("truncate 3 context messages");
    (0, bun_test_1.expect)((_a = (0, ui_model_1.checkpointProgressView)(preview)) === null || _a === void 0 ? void 0 : _a.detail).toContain("1 resources affected");
});
