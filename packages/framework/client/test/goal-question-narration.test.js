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
var collab_1 = require("@natalia/collab");
function contentDone(id, text) {
    return __assign({ type: "content.done", id: id, text: text }, {});
}
(0, bun_test_1.test)("lastAssistantNarration returns the latest assistant content.done text", function () {
    var events = [
        contentDone("a", "first narration"),
        { type: "turn.finished", id: "t1", stopReason: "done" },
        contentDone("b", "  latest narration  "),
    ];
    // The most recent content.done wins, trimmed.
    (0, bun_test_1.expect)((0, collab_1.lastAssistantNarration)(events)).toBe("latest narration");
});
(0, bun_test_1.test)("lastAssistantNarration ignores non-assistant/empty turns", function () {
    // No content.done at all (a silent / tool-only turn) -> undefined.
    (0, bun_test_1.expect)((0, collab_1.lastAssistantNarration)([
        { type: "turn.finished", id: "t1", stopReason: "done" },
    ])).toBeUndefined();
    // Whitespace-only content is not narration.
    (0, bun_test_1.expect)((0, collab_1.lastAssistantNarration)([contentDone("a", "   ")])).toBeUndefined();
});
(0, bun_test_1.test)("only delivered/acknowledged mailbox constraints are judged (EI §3.3)", function () {
    var base = {
        source: "user_via_live_chat",
        priority: "normal",
        text: "never push to main",
        deliveryPolicy: "next_safe_boundary",
        createdAt: "2026-01-01T00:00:00.000Z",
    };
    var message = function (intent, status, id) {
        return (__assign(__assign({}, base), { messageID: id, intent: intent, status: status, safeSummary: "".concat(intent, ":").concat(status) }));
    };
    var sentences = (0, collab_1.deliveredMailboxConstraints)([
        message("constraint", "delivered", "m1"),
        message("constraint", "acknowledged", "m2"),
        // Not yet binding (queued), replaced (superseded), or a different intent.
        message("constraint", "queued", "m3"),
        message("constraint", "superseded", "m4"),
        message("clarification", "delivered", "m5"),
    ]);
    (0, bun_test_1.expect)(sentences).toEqual([
        "constraint:delivered",
        "constraint:acknowledged",
    ]);
});
