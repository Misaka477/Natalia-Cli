"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var registration = function (id) { return ({
    id: id,
    name: id,
    version: "1",
    scope: "workspace",
    grants: ["workflows"],
}); };
(0, bun_test_1.test)("workspace hosts canonicalize roots", function () {
    (0, bun_test_1.expect)(new src_1.CapabilityHost({ workspaceRoot: "/srv/work/../project" }).workspaceRoot).toBe("/srv/project");
});
(0, bun_test_1.test)("host leases execution without running owner cleanup", function () {
    var host = new src_1.CapabilityHost();
    var owner = host.registerOwner(registration("review"));
    owner.contribute("workflows", "review", {});
    var lease = host.acquireExecutionLease("review");
    owner.release();
    (0, bun_test_1.expect)(host.has("review")).toBe(false);
    (0, bun_test_1.expect)(function () { return host.acquireExecutionLease("review"); }).toThrow("is not visible for execution");
    lease.release();
    lease.release();
});
(0, bun_test_1.test)("host disposal releases storage and refuses new owners", function () {
    var host = new src_1.CapabilityHost();
    host
        .registerOwner(registration("review"))
        .contribute("workflows", "review", {});
    host.dispose();
    host.dispose();
    (0, bun_test_1.expect)(host.list()).toEqual([]);
    (0, bun_test_1.expect)(function () { return host.registerOwner(registration("late")); }).toThrow("capability host is disposed");
});
