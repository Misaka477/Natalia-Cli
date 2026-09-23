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
var refusals_1 = require("../src/refusals");
/**
 * The decision table says, per member, how a caller learns the call did not
 * happen. Completeness is enforced by the compiler; these tests pin the parts a
 * type cannot: that every member is actually covered at runtime too, and that the
 * set of members which must answer with a value is a deliberate list rather than
 * whatever the last edit left behind.
 */
(0, bun_test_1.test)("every member has a decision, and nothing else does", function () {
    var members = __spreadArray(__spreadArray([], capabilities_1.REQUIRED_RUNTIME_MEMBERS, true), Object.values(capabilities_1.RUNTIME_CAPABILITY_GROUPS).flat(), true).sort();
    (0, bun_test_1.expect)(Object.keys(refusals_1.RUNTIME_MEMBER_REFUSAL_SEMANTICS).sort()).toEqual(members);
});
(0, bun_test_1.test)("the members whose refusal must be a value are named, and each names its field", function () {
    // Adding one is a contract change with implementations to update, so it should
    // require touching this list on purpose. Removing one — regressing to a throw or
    // to a hard-coded success — is caught by the behavioural tests in
    // packages/framework/client and packages/tooling/sdk.
    (0, bun_test_1.expect)((0, refusals_1.membersRefusingByValue)()).toEqual([
        "acknowledgeDriftFinding",
        "agentCreate",
        "agentDelete",
        "approveOverride",
        "canReloadConfig",
        "createConstitutionRule",
        "evaluateDrift",
        "goalControl",
        "goalEdit",
        "mailboxAcknowledge",
        "mailboxDefer",
        "mailboxDeliver",
        "mailboxSend",
        "mailboxSupersede",
        "mcpServerAdd",
        "mcpServerRemove",
        "pause",
        "permissionDelete",
        "permissionSave",
        "planDocActivate",
        "planDocDeactivate",
        "planDocDelete",
        "planDocMark",
        "planDocUpdateStatus",
        "planDocWrite",
        "pluginInstall",
        "pluginSetEnabled",
        "pluginUninstall",
        "pluginUnload",
        "promoteConstitutionDocRule",
        "promoteInput",
        "providerAdd",
        "providerRemove",
        "recordCompletion",
        "recordDecision",
        "recordHumanValidation",
        "recordValidation",
        "reloadConfig",
        "removeConstitutionRule",
        "removeInput",
        "reopenDriftFinding",
        "replaceInput",
        "requestOverride",
        "respondApproval",
        "respondInteractive",
        "respondQuestion",
        "resume",
        "selectAgent",
        "sessionArchive",
        "sessionNew",
        "setDefaultModel",
        "updateConfig",
        "updateConstitutionDocRule",
        "updateConstitutionRule",
        "workspaceCreate",
        "workspaceDelete",
        "workspaceRename",
        "workspaceWrite",
    ]);
    for (var _i = 0, _a = Object.entries(refusals_1.RUNTIME_MEMBER_REFUSAL_SEMANTICS); _i < _a.length; _i++) {
        var _b = _a[_i], member = _b[0], semantics = _b[1];
        if (semantics.refusal !== "value")
            continue;
        (0, bun_test_1.expect)(semantics.expressedBy.length).toBeGreaterThan(0);
        (0, bun_test_1.expect)(member.length).toBeGreaterThan(0);
    }
});
(0, bun_test_1.test)("every decision carries a reason a reader can check", function () {
    var _a;
    // A table of bare verdicts would be unreviewable: the note is what lets someone
    // disagree with a row.
    for (var _i = 0, _b = Object.values(refusals_1.RUNTIME_MEMBER_REFUSAL_SEMANTICS); _i < _b.length; _i++) {
        var semantics = _b[_i];
        (0, bun_test_1.expect)(((_a = semantics.note) !== null && _a !== void 0 ? _a : "").length).toBeGreaterThan(0);
    }
});
(0, bun_test_1.test)("a member's capability comes from the capability table, not a second list", function () {
    // `-32000 not supported` carries the group so a consumer can switch off a whole
    // feature area; a hand-maintained copy of that mapping is the thing that rots.
    (0, bun_test_1.expect)((0, capabilities_1.capabilityGroupOf)("checkpointRollback")).toBe("checkpoint");
    (0, bun_test_1.expect)((0, capabilities_1.capabilityGroupOf)("nativeTerminalStop")).toBe("nativeTerminal");
    // Required members belong to no group: a runtime missing one is unusable, not
    // degraded.
    for (var _i = 0, REQUIRED_RUNTIME_MEMBERS_1 = capabilities_1.REQUIRED_RUNTIME_MEMBERS; _i < REQUIRED_RUNTIME_MEMBERS_1.length; _i++) {
        var member = REQUIRED_RUNTIME_MEMBERS_1[_i];
        (0, bun_test_1.expect)((0, capabilities_1.capabilityGroupOf)(member)).toBeUndefined();
    }
    (0, bun_test_1.expect)((0, capabilities_1.capabilityGroupOf)("notAMember")).toBeUndefined();
});
