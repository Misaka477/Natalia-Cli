"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var runtime_services_1 = require("@natalia/runtime-services");
(0, bun_test_1.test)("buildMailboxQueued carries the durable intent fact", function () {
    var event = (0, runtime_services_1.buildMailboxQueued)({
        id: "mailbox:1:queued",
        messageID: "mailbox:1",
        source: "user_via_live_chat",
        priority: "high",
        intent: "reprioritize",
        text: "please focus on the docs task first",
        safeSummary: "user asked to reprioritize to docs",
        relatedPlanID: "plan_1",
        deliveryPolicy: "next_safe_boundary",
        createdAt: "now",
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        type: "mailbox.queued",
        messageID: "mailbox:1",
        source: "user_via_live_chat",
        priority: "high",
        intent: "reprioritize",
        text: "please focus on the docs task first",
        safeSummary: "user asked to reprioritize to docs",
        relatedPlanID: "plan_1",
        deliveryPolicy: "next_safe_boundary",
    });
});
(0, bun_test_1.test)("mailbox status transitions build the right event types", function () {
    var delivered = (0, runtime_services_1.buildMailboxStatus)({
        id: "mailbox:1:delivered",
        messageID: "mailbox:1",
        status: "delivered",
        at: "t1",
    });
    (0, bun_test_1.expect)(delivered.type).toBe("mailbox.delivered");
    if (delivered.type === "mailbox.delivered")
        (0, bun_test_1.expect)(delivered.deliveredAt).toBe("t1");
    var acknowledged = (0, runtime_services_1.buildMailboxStatus)({
        id: "mailbox:1:ack",
        messageID: "mailbox:1",
        status: "acknowledged",
        at: "t2",
    });
    (0, bun_test_1.expect)(acknowledged.type).toBe("mailbox.acknowledged");
    if (acknowledged.type === "mailbox.acknowledged")
        (0, bun_test_1.expect)(acknowledged.acknowledgedAt).toBe("t2");
    var deferred = (0, runtime_services_1.buildMailboxStatus)({
        id: "mailbox:1:deferred",
        messageID: "mailbox:1",
        status: "deferred",
        at: "t3",
        reason: "unsafe boundary",
    });
    (0, bun_test_1.expect)(deferred.type).toBe("mailbox.deferred");
    if (deferred.type === "mailbox.deferred")
        (0, bun_test_1.expect)(deferred.reason).toBe("unsafe boundary");
    var superseded = (0, runtime_services_1.buildMailboxStatus)({
        id: "mailbox:1:superseded",
        messageID: "mailbox:1",
        status: "superseded",
        at: "t4",
    });
    (0, bun_test_1.expect)(superseded.type).toBe("mailbox.superseded");
    if (superseded.type === "mailbox.superseded")
        (0, bun_test_1.expect)(superseded.reason).toContain("superseded");
});
(0, bun_test_1.test)("mailbox facts carry only safe prose, never raw state", function () {
    var queued = (0, runtime_services_1.buildMailboxQueued)({
        id: "mailbox:2:queued",
        messageID: "mailbox:2",
        source: "system",
        priority: "normal",
        intent: "constraint",
        text: "never commit secrets",
        safeSummary: "a constraint",
        deliveryPolicy: "before_next_tool",
        createdAt: "now",
    });
    (0, bun_test_1.expect)(JSON.stringify(queued)).not.toContain("supersecret");
    (0, bun_test_1.expect)(JSON.stringify(queued)).not.toContain("stdout");
});
