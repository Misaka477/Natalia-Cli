"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var migrated_plugin_rules_1 = require("../src/migrated-plugin-rules");
/**
 * The two P3 layer rules (decisions §1.1/§1.2, master plan P3 row) —
 * unit-tested here because the guard's own run only proves today's tree
 * is clean, not that the rules BITE.
 */
(0, bun_test_1.test)("product policy never depends on the host layer — and only in shipped code", function () {
    var domainsFile = "packages/domains/work-ledger/src/controller.ts";
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findPolicyHostDependencyViolation)("@natalia/platform", domainsFile)).toContain("host layer");
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findPolicyHostDependencyViolation)("@natalia/object-store/extra", domainsFile)).toContain("@natalia/object-store");
    // Public engine API and siblings stay legal (§1.2: only через API/token).
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findPolicyHostDependencyViolation)("@natalia/contracts", domainsFile)).toBeUndefined();
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findPolicyHostDependencyViolation)("@natalia/runtime-services", domainsFile)).toBeUndefined();
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findPolicyHostDependencyViolation)("@natalia/platform", "packages/framework/client/src/x.ts")).toBeUndefined(); // scoped to domains
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findPolicyHostDependencyViolation)("@natalia/platform", domainsFile.replace("/src/", "/test/"))).toBeUndefined(); // tests may reach anywhere
});
(0, bun_test_1.test)("composition lives in the kernel layer — checked where it is declared", function () {
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findCompositionKernelViolation)(["packages/core/composition/src/index.ts"])).toBeUndefined();
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findCompositionKernelViolation)([
        "packages/framework/composition/src/index.ts",
    ])).toContain("kernel layer");
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findCompositionKernelViolation)(undefined)).toContain("missing");
});
(0, bun_test_1.test)("substrate core carries no policy import — the boundary bites", function () {
    var core = "packages/framework/substrate/src/context.ts";
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findSubstratePurityViolation)(core, 'import type { X } from "@natalia/work-ledger";')).toContain("product-context");
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findSubstratePurityViolation)(core, 'import type { X } from "@natalia/governance-ledger";')).toContain("governance-ledger");
    // Generic machinery stays legal (InteractiveWaiter's package is not the
    // policy collaboration of runtime/collaboration).
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findSubstratePurityViolation)(core, 'import type { X } from "@natalia/collaboration";')).toBeUndefined();
    // Files not yet on the list are simply not checked (the list grows per
    // extraction step).
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findSubstratePurityViolation)("packages/framework/client/src/runtime/ports.ts", 'from "@natalia/work-ledger"')).toBeUndefined();
    // context-ledger stays legal in substrate: the policy BAND governs the
    // prefix (it remains @natalia), while the import ban names §1.1's
    // concepts — context machinery underpins exec/initialize/ports.
    (0, bun_test_1.expect)((0, migrated_plugin_rules_1.findSubstratePurityViolation)(core, 'import type { L } from "@natalia/context-ledger";')).toBeUndefined();
});
