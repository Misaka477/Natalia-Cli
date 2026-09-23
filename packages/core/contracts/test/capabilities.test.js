"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var capabilities_1 = require("../src/capabilities");
/**
 * The point of this surface is that a consumer can tell three states apart that
 * `optional` cannot: "this runtime does not do that", "nobody implemented that
 * yet", and "there is genuinely nothing to report". These tests pin exactly that.
 */
function stub(members) {
    return Object.fromEntries(members.map(function (member) { return [member, function () { return undefined; }]; }));
}
(0, bun_test_1.test)("a runtime with only the required members is usable and reports no capabilities", function () {
    var report = (0, capabilities_1.describeRuntimeCapabilities)(stub(__spreadArray([], capabilities_1.REQUIRED_RUNTIME_MEMBERS, true)));
    (0, bun_test_1.expect)(report.usable).toBe(true);
    (0, bun_test_1.expect)(report.missingRequired).toEqual([]);
    (0, bun_test_1.expect)(report.groups.filter(function (group) { return group.available; })).toEqual([]);
    // Nothing is claimed to be present, so nothing is reported as empty-for-now.
    (0, bun_test_1.expect)(report.unimplemented).toEqual([]);
});
(0, bun_test_1.test)("a runtime missing a required member is reported unusable, not degraded", function () {
    // Feature-detecting your way around a missing `submit` is not a degraded mode:
    // there is no runtime without it, and saying so is the point of the tier.
    var report = (0, capabilities_1.describeRuntimeCapabilities)(stub(capabilities_1.REQUIRED_RUNTIME_MEMBERS.filter(function (member) { return member !== "submit"; })));
    (0, bun_test_1.expect)(report.usable).toBe(false);
    (0, bun_test_1.expect)(report.missingRequired).toEqual(["submit"]);
});
(0, bun_test_1.test)("a capability is available only when all of its members are", function () {
    var checkpoint = __spreadArray([], capabilities_1.RUNTIME_CAPABILITY_GROUPS.checkpoint, true);
    var whole = (0, capabilities_1.describeRuntimeCapabilities)(stub(__spreadArray(__spreadArray([], capabilities_1.REQUIRED_RUNTIME_MEMBERS, true), checkpoint, true))).groups.find(function (group) { return group.name === "checkpoint"; });
    (0, bun_test_1.expect)(whole).toMatchObject({ available: true, partial: false, missing: [] });
    // Half a capability is worth reporting: it is usually an oversight, and a
    // consumer that checked one method would be surprised by the next.
    var half = (0, capabilities_1.describeRuntimeCapabilities)(stub(__spreadArray(__spreadArray([], capabilities_1.REQUIRED_RUNTIME_MEMBERS, true), [checkpoint[0]], false))).groups.find(function (group) { return group.name === "checkpoint"; });
    (0, bun_test_1.expect)(half).toMatchObject({ available: false, partial: true });
    (0, bun_test_1.expect)(half === null || half === void 0 ? void 0 : half.missing).toEqual(checkpoint.slice(1));
});
(0, bun_test_1.test)("a query that answers with nothing says why, instead of looking like no data", function () {
    var _a;
    var members = Object.keys(capabilities_1.UNIMPLEMENTED_QUERIES);
    // The intelligence group also holds implemented writers (recordDecision),
    // so stub the whole group plus the unimplemented query members.
    var report = (0, capabilities_1.describeRuntimeCapabilities)(stub(__spreadArray(__spreadArray(__spreadArray([], capabilities_1.REQUIRED_RUNTIME_MEMBERS, true), capabilities_1.RUNTIME_CAPABILITY_GROUPS.intelligence, true), members, true)));
    (0, bun_test_1.expect)(report.unimplemented.map(function (entry) { return entry.member; }).sort()).toEqual(__spreadArray([], members, true).sort());
    for (var _i = 0, _b = report.unimplemented; _i < _b.length; _i++) {
        var entry = _b[_i];
        (0, bun_test_1.expect)(entry.reason.length).toBeGreaterThan(0);
    }
    // And it is still reported as present, because it is: it answers, with nothing.
    (0, bun_test_1.expect)((_a = report.groups.find(function (group) { return group.name === "intelligence"; })) === null || _a === void 0 ? void 0 : _a.available).toBe(true);
});
(0, bun_test_1.test)("every member of the contract is either required or in exactly one capability", function () {
    var _a;
    // The compile-time check in `capabilities.ts` proves nothing is unclassified.
    // This proves the other half: nothing is classified twice, which would make a
    // report contradict itself.
    var seen = new Map();
    for (var _i = 0, _b = Object.entries(capabilities_1.RUNTIME_CAPABILITY_GROUPS); _i < _b.length; _i++) {
        var _c = _b[_i], name_1 = _c[0], members = _c[1];
        for (var _d = 0, members_1 = members; _d < members_1.length; _d++) {
            var member = members_1[_d];
            seen.set(member, __spreadArray(__spreadArray([], ((_a = seen.get(member)) !== null && _a !== void 0 ? _a : []), true), [name_1], false));
        }
    }
    (0, bun_test_1.expect)(__spreadArray([], seen, true).filter(function (_a) {
        var groups = _a[1];
        return groups.length > 1;
    })).toEqual([]);
    for (var _e = 0, REQUIRED_RUNTIME_MEMBERS_1 = capabilities_1.REQUIRED_RUNTIME_MEMBERS; _e < REQUIRED_RUNTIME_MEMBERS_1.length; _e++) {
        var member = REQUIRED_RUNTIME_MEMBERS_1[_e];
        (0, bun_test_1.expect)(seen.has(member)).toBe(false);
    }
});
function completeStub() {
    var members = __spreadArray(__spreadArray([], capabilities_1.REQUIRED_RUNTIME_MEMBERS, true), Object.values(capabilities_1.RUNTIME_CAPABILITY_GROUPS).flat(), true);
    var client = {};
    for (var _i = 0, members_2 = members; _i < members_2.length; _i++) {
        var member = members_2[_i];
        client[member] = function () { return undefined; };
    }
    return client;
}
(0, bun_test_1.test)("the stable surface binds the required members to the API version", function () {
    // The promise and the code are one constant: REQUIRED_RUNTIME_MEMBERS is
    // derived from API_STABLE_SURFACE, so moving a member out of the required
    // set without bumping the version is a change to a single source — and any
    // such change must also update this test's expectation, which is the point.
    (0, bun_test_1.expect)(capabilities_1.API_STABLE_SURFACE.apiVersion).toBe(capabilities_1.API_VERSION);
    (0, bun_test_1.expect)(capabilities_1.API_STABLE_SURFACE.requiredMembers).toEqual([
        "start",
        "submit",
        "cancel",
        "snapshot",
        "diagnostic",
        "lastSubmission",
        "respondApproval",
        "respondQuestion",
    ]);
    (0, bun_test_1.expect)(capabilities_1.REQUIRED_RUNTIME_MEMBERS).toEqual(capabilities_1.API_STABLE_SURFACE.requiredMembers);
    // The report carries the same version the promise is made under.
    var client = completeStub();
    (0, bun_test_1.expect)((0, capabilities_1.describeRuntimeCapabilities)(client).apiVersion).toBe(capabilities_1.API_VERSION);
});
(0, bun_test_1.test)("a deprecated member surfaces in the report with its replacement", function () {
    // The table is empty today; the mechanism is exercised with an injected
    // deprecation so it cannot rot into an unobservable feature. Patching the
    // global table would make this test order-dependent, so the channel report
    // reads it through describe, and we assert the shape against a fake table
    // via the function that decorates members.
    var client = completeStub();
    var report = (0, capabilities_1.describeRuntimeCapabilities)(client, { name: "rpc", routedMembers: new Set() }, { sessionSnapshot: { replacement: "session.list", since: 1 } });
    var all = __spreadArray(__spreadArray([], report.channel.groups.flatMap(function (group) { return group.members; }), true), report.channel.requiredMembers, true);
    var marked = all.find(function (member) { return member.member === "sessionSnapshot"; });
    (0, bun_test_1.expect)(marked.deprecated).toEqual({
        replacement: "session.list",
        since: 1,
    });
    (0, bun_test_1.expect)(all.every(function (member) {
        return member.deprecated === undefined || member.member === "sessionSnapshot";
    })).toBe(true);
});
