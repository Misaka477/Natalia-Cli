"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("interactive projection retains only requests without durable replies", function () {
    var projection = (0, src_1.projectInteractiveRequests)([
        {
            type: "approval.request",
            id: "approval_open",
            title: "Write",
            preview: "a",
        },
        {
            type: "approval.request",
            id: "approval_closed",
            title: "Shell",
            preview: "b",
        },
        { type: "approval.response", id: "approval_closed", decision: "once" },
        { type: "question.request", id: "question_open", title: "Choice" },
        { type: "question.request", id: "question_closed", title: "Done" },
        { type: "question.response", id: "question_closed", answers: [["yes"]] },
    ]);
    (0, bun_test_1.expect)(projection.approvals.map(function (request) { return request.id; })).toEqual([
        "approval_open",
    ]);
    (0, bun_test_1.expect)(projection.questions.map(function (request) { return request.id; })).toEqual([
        "question_open",
    ]);
});
