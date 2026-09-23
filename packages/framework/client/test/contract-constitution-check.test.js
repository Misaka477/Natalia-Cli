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
var contract_constitution_check_1 = require("../src/runtime/contract-constitution-check");
function denyRule(ruleID, paths, extra) {
    var _a;
    return __assign(__assign({ type: "constitution.rule_added", id: "constitution:rule:".concat(ruleID), ruleID: ruleID, statement: "deny ".concat((_a = paths === null || paths === void 0 ? void 0 : paths.join(",")) !== null && _a !== void 0 ? _a : "tools-only"), scope: "project", priority: "high", source: "user", enforcement: "deny", overridePolicy: "forbidden" }, (paths ? { appliesTo: { paths: paths } } : {})), extra);
}
(0, bun_test_1.test)("a scope entry naming a deny-covered path is a conflict", function () {
    var conflicts = (0, contract_constitution_check_1.checkContractAgainstConstitution)({
        entries: [
            "rotate the .env credentials",
            "refactor packages/framework/client",
        ],
        rules: [denyRule("C-ENV-001", ["**/.env"])],
    });
    (0, bun_test_1.expect)(conflicts).toEqual([
        {
            ruleID: "C-ENV-001",
            entry: "rotate the .env credentials",
            path: ".env",
        },
    ]);
});
(0, bun_test_1.test)("a directory-glob deny rule matches a path named under it", function () {
    var conflicts = (0, contract_constitution_check_1.checkContractAgainstConstitution)({
        entries: ["rewrite src/legacy/old.ts"],
        rules: [denyRule("C-LEG-001", ["src/legacy/**"])],
    });
    (0, bun_test_1.expect)(conflicts).toHaveLength(1);
    (0, bun_test_1.expect)(conflicts[0]).toMatchObject({
        ruleID: "C-LEG-001",
        path: "src/legacy/old.ts",
    });
});
(0, bun_test_1.test)("a deny rule that does not cover the named path is silent", function () {
    var conflicts = (0, contract_constitution_check_1.checkContractAgainstConstitution)({
        entries: ["refactor packages/framework/client/src"],
        rules: [denyRule("C-ENV-001", ["**/.env"])],
    });
    (0, bun_test_1.expect)(conflicts).toEqual([]);
});
(0, bun_test_1.test)("prose entries with no path tokens stay silent", function () {
    var conflicts = (0, contract_constitution_check_1.checkContractAgainstConstitution)({
        entries: ["no new runtime dependency", "delete the old evaluator"],
        rules: [denyRule("C-ANY-001", ["**/*"])],
    });
    (0, bun_test_1.expect)(conflicts).toEqual([]);
});
(0, bun_test_1.test)("only deny rules conflict — warn and approval hits do not", function () {
    var conflicts = (0, contract_constitution_check_1.checkContractAgainstConstitution)({
        entries: ["edit src/x.ts"],
        rules: [
            denyRule("C-WARN-001", ["src/**"], { enforcement: "warn" }),
            denyRule("C-APPR-001", ["src/**"], { enforcement: "approval" }),
        ],
    });
    (0, bun_test_1.expect)(conflicts).toEqual([]);
});
(0, bun_test_1.test)("a deny rule without a paths anchor (tools-only) stays silent", function () {
    var conflicts = (0, contract_constitution_check_1.checkContractAgainstConstitution)({
        entries: ["edit src/x.ts"],
        rules: [
            denyRule("C-TOOL-001", undefined, {
                appliesTo: { tools: ["file_write"] },
            }),
        ],
    });
    (0, bun_test_1.expect)(conflicts).toEqual([]);
});
(0, bun_test_1.test)("a broad glob token conflicts when a deny pattern lives under it", function () {
    var conflicts = (0, contract_constitution_check_1.checkContractAgainstConstitution)({
        entries: ["migrate everything under src/**", "audit src/"],
        rules: [denyRule("C-LEG-001", ["src/legacy/**"])],
    });
    (0, bun_test_1.expect)(conflicts.map(function (conflict) { return conflict.path; })).toEqual([
        "src/**",
        "src/",
    ]);
});
(0, bun_test_1.test)("backticks and quotes around a token are stripped", function () {
    var conflicts = (0, contract_constitution_check_1.checkContractAgainstConstitution)({
        entries: ['edit `.env` and "secrets/key.pem" (then stop)'],
        rules: [
            denyRule("C-ENV-001", ["**/.env"]),
            denyRule("C-KEY-001", ["secrets/**"]),
        ],
    });
    (0, bun_test_1.expect)(conflicts.map(function (conflict) { return conflict.path; }).sort()).toEqual([
        ".env",
        "secrets/key.pem",
    ]);
});
(0, bun_test_1.test)("one conflict per rule/entry/token, even when repeated", function () {
    var conflicts = (0, contract_constitution_check_1.checkContractAgainstConstitution)({
        entries: [".env and .env again"],
        rules: [denyRule("C-ENV-001", ["**/.env", ".env"])],
    });
    (0, bun_test_1.expect)(conflicts).toHaveLength(1);
});
(0, bun_test_1.test)("no deny rules means no work and no conflicts", function () {
    var conflicts = (0, contract_constitution_check_1.checkContractAgainstConstitution)({
        entries: ["edit src/x.ts"],
        rules: [denyRule("C-WARN-001", ["src/**"], { enforcement: "warn" })],
    });
    (0, bun_test_1.expect)(conflicts).toEqual([]);
});
