"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var modal_1 = require("../src/modal");
(0, bun_test_1.test)("normalizePendingItems orders approvals before questions and links tool cards", function () {
    var _a, _b;
    var items = (0, modal_1.normalizePendingItems)({
        approvals: [
            {
                id: "turn_a:call_1",
                title: "Approve run_shell",
                preview: "rm -rf build",
            },
        ],
        questions: [
            {
                id: "turn_a:call_2:question",
                title: "Pick one",
                questions: [
                    {
                        id: "q0",
                        header: "Q",
                        question: "Which?",
                        options: [{ label: "a" }, { label: "b" }],
                    },
                ],
            },
        ],
    });
    (0, bun_test_1.expect)(items.map(function (item) { return item.kind; })).toEqual(["approval", "question"]);
    (0, bun_test_1.expect)((_a = items[0].tool) === null || _a === void 0 ? void 0 : _a.messageID).toBe("turn_a:tool:call_1");
    (0, bun_test_1.expect)((_b = items[1].tool) === null || _b === void 0 ? void 0 : _b.messageID).toBe("turn_a:tool:call_2");
    (0, bun_test_1.expect)(items[0].priority).toBeLessThan(items[1].priority);
});
(0, bun_test_1.test)("pendingToolLink ignores non-turn request ids", function () {
    var _a;
    (0, bun_test_1.expect)((0, modal_1.pendingToolLink)("plan_acceptance:123")).toBeUndefined();
    (0, bun_test_1.expect)((_a = (0, modal_1.pendingToolLink)("turn_a:call_1:question")) === null || _a === void 0 ? void 0 : _a.turnID).toBe("turn_a");
});
(0, bun_test_1.test)("approval presenter maps actions to decisions", function () {
    var item = (0, modal_1.normalizePendingItems)({
        approvals: [{ id: "turn_a:call_1", title: "t", preview: "p" }],
    })[0];
    (0, bun_test_1.expect)(modal_1.approvalPresenter.buildResponse(item, { action: "allow-once" })).toEqual({ requestID: "turn_a:call_1", decision: "once" });
    (0, bun_test_1.expect)(modal_1.approvalPresenter.buildResponse(item, { action: "allow-session" })).toEqual({ requestID: "turn_a:call_1", decision: "session" });
    (0, bun_test_1.expect)(modal_1.approvalPresenter.buildResponse(item, {
        action: "reject",
        feedback: "no",
    })).toEqual({ requestID: "turn_a:call_1", decision: "reject", feedback: "no" });
});
(0, bun_test_1.test)("question presenter keeps selections and custom text separate", function () {
    var item = (0, modal_1.normalizePendingItems)({
        questions: [
            {
                id: "turn_a:call_1:question",
                title: "Pick",
                questions: [
                    {
                        id: "q0",
                        header: "Q",
                        question: "Which?",
                        options: [{ label: "a" }, { label: "b" }],
                        multiple: true,
                        custom: true,
                    },
                ],
            },
        ],
    })[0];
    (0, bun_test_1.expect)(modal_1.questionPresenter.buildResponse(item, {
        selections: [["a", "b"]],
        custom: ["other"],
    })).toEqual({
        requestID: "turn_a:call_1:question",
        answers: [["a", "b", "other"]],
    });
    // Custom text alone still submits even when no option was selected.
    (0, bun_test_1.expect)(modal_1.questionPresenter.buildResponse(item, {
        selections: [[]],
        custom: ["typed"],
    })).toEqual({ requestID: "turn_a:call_1:question", answers: [["typed"]] });
    // Reject never leaks selections.
    (0, bun_test_1.expect)(modal_1.questionPresenter.buildResponse(item, {
        selections: [["a"]],
        custom: ["x"],
        rejected: true,
    })).toEqual({
        requestID: "turn_a:call_1:question",
        answers: [],
        rejected: true,
    });
});
(0, bun_test_1.test)("pending controller dismisses, focuses and prunes live ids", function () {
    var revisions = 0;
    var controller = (0, modal_1.createPendingController)(function () {
        revisions += 1;
    });
    controller.focus("a");
    controller.dismiss("a");
    (0, bun_test_1.expect)(controller.activeID()).toBeUndefined();
    (0, bun_test_1.expect)(controller.isDismissed("a")).toBe(true);
    // A dismissed request that leaves the live set is forgotten.
    controller.prune(new Set());
    (0, bun_test_1.expect)(controller.isDismissed("a")).toBe(false);
    // Focusing a live request clears a previous dismissal.
    controller.dismiss("b");
    controller.prune(new Set(["b"]));
    controller.focus("b");
    (0, bun_test_1.expect)(controller.isDismissed("b")).toBe(false);
    (0, bun_test_1.expect)(controller.activeID()).toBe("b");
    (0, bun_test_1.expect)(revisions).toBeGreaterThan(0);
});
(0, bun_test_1.test)("normalizePendingItems carries a generic interactive kind through", function () {
    var items = (0, modal_1.normalizePendingItems)({
        interactives: [
            {
                id: "ix1",
                kind: "custom.kind",
                title: "Pick one",
                payload: { options: ["a"] },
                priority: 5,
            },
        ],
    });
    (0, bun_test_1.expect)(items).toEqual([
        bun_test_1.expect.objectContaining({
            id: "ix1",
            kind: "custom.kind",
            title: "Pick one",
            priority: 5,
        }),
    ]);
});
