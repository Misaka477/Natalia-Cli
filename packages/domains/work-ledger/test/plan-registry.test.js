"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("buildPlanDocCreated carries the lightweight plan registry record", function () {
    var event = (0, src_1.buildPlanDocCreated)({
        id: "plan:create:1",
        planID: "plan_001",
        title: "First plan",
        documentPath: ".natalia/plans/plan_001.md",
        createdBy: "live_chat",
        status: "marked",
        createdAt: "2026-09-02T00:00:00.000Z",
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        type: "plan.doc.created",
        planID: "plan_001",
        documentPath: ".natalia/plans/plan_001.md",
        createdBy: "live_chat",
        status: "marked",
    });
});
(0, bun_test_1.test)("plan registry transitions build the corresponding events", function () {
    var marked = (0, src_1.buildPlanDocMarked)({
        id: "plan:mark:1",
        planID: "plan_001",
        markedAt: "2026-09-02T00:01:00.000Z",
    });
    (0, bun_test_1.expect)(marked.type).toBe("plan.doc.marked");
    (0, bun_test_1.expect)(marked.planID).toBe("plan_001");
    var updated = (0, src_1.buildPlanDocUpdated)({
        id: "plan:update:1",
        planID: "plan_001",
        revision: 2,
        updatedAt: "2026-09-02T00:02:00.000Z",
        reason: "refined objective",
    });
    (0, bun_test_1.expect)(updated.type).toBe("plan.doc.updated");
    (0, bun_test_1.expect)(updated.reason).toBe("refined objective");
    var status = (0, src_1.buildPlanDocStatus)({
        id: "plan:status:1",
        planID: "plan_001",
        status: "audit_passed",
        at: "2026-09-02T00:03:00.000Z",
    });
    (0, bun_test_1.expect)(status).toMatchObject({
        type: "plan.doc.status",
        planID: "plan_001",
        status: "audit_passed",
    });
});
(0, bun_test_1.test)("buildAuditRequested carries the durable trigger shadow", function () {
    var request = (0, src_1.buildAuditRequested)({
        id: "audit:plan_001:1",
        planID: "plan_001",
        planVersion: 2,
        triggerEventID: "plan:status:7",
        round: 3,
        scope: "completion_recorded",
        at: "2026-09-02T00:04:00.000Z",
    });
    (0, bun_test_1.expect)(request).toMatchObject({
        type: "audit.requested",
        planID: "plan_001",
        planVersion: 2,
        triggerEventID: "plan:status:7",
        round: 3,
        scope: "completion_recorded",
    });
});
