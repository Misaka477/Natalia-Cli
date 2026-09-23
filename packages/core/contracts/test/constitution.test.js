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
var constitution_1 = require("../src/constitution");
(0, bun_test_1.test)("only the hard-coded self-protection rules are protected", function () {
    // The tool-execution SELF_PROTECTION_PATTERNS back exactly these three; a
    // journal edit cannot remove their guarantee.
    (0, bun_test_1.expect)(__spreadArray([], constitution_1.HARD_PROTECTED_CONSTITUTION_RULE_IDS, true).sort()).toEqual([
        "C-TERM-001",
        "C-TERM-002",
        "C-TERM-003",
    ]);
    for (var _i = 0, HARD_PROTECTED_CONSTITUTION_RULE_IDS_1 = constitution_1.HARD_PROTECTED_CONSTITUTION_RULE_IDS; _i < HARD_PROTECTED_CONSTITUTION_RULE_IDS_1.length; _i++) {
        var ruleID = HARD_PROTECTED_CONSTITUTION_RULE_IDS_1[_i];
        (0, bun_test_1.expect)((0, constitution_1.isHardProtectedConstitutionRule)(ruleID)).toBe(true);
    }
});
(0, bun_test_1.test)("release-scope runtime-policy and user rules are not protected", function () {
    // C-REL-* are release scope but journal-enforced, so the user may edit/delete.
    (0, bun_test_1.expect)((0, constitution_1.isHardProtectedConstitutionRule)("C-REL-001")).toBe(false);
    (0, bun_test_1.expect)((0, constitution_1.isHardProtectedConstitutionRule)("C-REL-002")).toBe(false);
    (0, bun_test_1.expect)((0, constitution_1.isHardProtectedConstitutionRule)("P-USER-abc")).toBe(false);
    (0, bun_test_1.expect)((0, constitution_1.isHardProtectedConstitutionRule)("")).toBe(false);
});
