"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var subagent_steer_1 = require("../src/runtime/initialize/subagent-steer");
(0, bun_test_1.test)("a parent message names its sender and carries the words verbatim", function () {
    var content = (0, subagent_steer_1.parentMessageContent)("a1", "a2", "stop editing, use the API");
    // The child must be able to tell who is speaking: collapsing the runtime's
    // framing into the parent's words would let a child mistake a correction for
    // its own earlier reasoning.
    (0, bun_test_1.expect)(content).toContain('source="parent_message"');
    (0, bun_test_1.expect)(content).toContain('trust="parent"');
    (0, bun_test_1.expect)(content).toContain('agent_id="a2"');
    (0, bun_test_1.expect)(content).toContain("Agent a1 sent a message:");
    (0, bun_test_1.expect)(content).toContain("stop editing, use the API");
});
(0, bun_test_1.test)("a parent message is framed as a correction, not a new task", function () {
    var content = (0, subagent_steer_1.parentMessageContent)("a1", "a2", "look again");
    (0, bun_test_1.expect)(content).toContain("not as a new task");
});
(0, bun_test_1.test)("a running child receives the message at its nearest step", function () {
    (0, bun_test_1.expect)((0, subagent_steer_1.steerRoute)({ status: "running", hasLiveLedger: true })).toBe("delivered");
});
(0, bun_test_1.test)("a paused child is woken and steered", function () {
    (0, bun_test_1.expect)((0, subagent_steer_1.steerRoute)({ status: "paused", hasLiveLedger: true })).toBe("resumed");
});
(0, bun_test_1.test)("a child with no live ledger queues the message", function () {
    // A status alone cannot say whether a runner is holding the ledger right now:
    // a terminal child and one between continuations both read "not running".
    (0, bun_test_1.expect)((0, subagent_steer_1.steerRoute)({ status: "stopped", hasLiveLedger: false })).toBe("queued");
    (0, bun_test_1.expect)((0, subagent_steer_1.steerRoute)({ status: "completed", hasLiveLedger: false })).toBe("queued");
    (0, bun_test_1.expect)((0, subagent_steer_1.steerRoute)({ status: "failed", hasLiveLedger: false })).toBe("queued");
});
(0, bun_test_1.test)("a live ledger outranks the recorded status", function () {
    // The one case that would silently drop a message: the record says paused but
    // a runner is mid-step, or the reverse. The ledger is the truth.
    (0, bun_test_1.expect)((0, subagent_steer_1.steerRoute)({ status: "paused", hasLiveLedger: true })).toBe("resumed");
    (0, bun_test_1.expect)((0, subagent_steer_1.steerRoute)({ status: "running", hasLiveLedger: true })).toBe("delivered");
});
