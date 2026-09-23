"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var event_sink_1 = require("../src/runtime/event-sink");
function execWith(events) {
    return {
        session: { id: "ses_infrastructure_error", events: events },
    };
}
function turnEvents(turnID, retryID) {
    return [
        {
            type: "turn.submitted",
            id: turnID,
            text: "work",
            byteLength: 4,
            lineCount: 1,
            sha256: "hash",
        },
        {
            type: "step.retry.exhausted",
            id: retryID,
            operation: "llm_step",
            step: 1,
            attempts: 1,
            maxAttempts: null,
            reason: "invalid_request",
            statusCode: 400,
            retryable: false,
            message: "invalid_request (400)",
        },
        {
            type: "turn.finished",
            id: turnID,
            stopReason: "error",
        },
    ];
}
(0, bun_test_1.test)("provider retry exhausted with the bare turn id is an infrastructure error", function () {
    var turnID = "turn_provider_400";
    (0, bun_test_1.expect)((0, event_sink_1.mainTurnHasInfrastructureError)(execWith(turnEvents(turnID, turnID)), turnID)).toBe(true);
});
(0, bun_test_1.test)("nested retry ids remain infrastructure errors", function () {
    var turnID = "turn_context_limit";
    (0, bun_test_1.expect)((0, event_sink_1.mainTurnHasInfrastructureError)(execWith(turnEvents(turnID, "".concat(turnID, ":context-limit"))), turnID)).toBe(true);
});
