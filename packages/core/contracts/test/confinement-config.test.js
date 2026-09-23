"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var schema_foundation_1 = require("../src/schema-foundation");
(0, bun_test_1.test)("the shipped default is workspace-write (L1 confinement on)", function () {
    // The threat model speaking: runShell gets Landlock-level enforcement by
    // default, workspace and /tmp writable, the rest of the filesystem
    // read-only. An old config without the row parses to the same default.
    (0, bun_test_1.expect)(schema_foundation_1.confinementConfigSchema.parse({})).toEqual({
        mode: "workspace-write",
    });
});
(0, bun_test_1.test)("an explicit mode is preserved", function () {
    (0, bun_test_1.expect)(schema_foundation_1.confinementConfigSchema.parse({ mode: "read-only" })).toEqual({
        mode: "read-only",
    });
    (0, bun_test_1.expect)(schema_foundation_1.confinementConfigSchema.parse({ mode: "danger-full-access" })).toEqual({ mode: "danger-full-access" });
});
(0, bun_test_1.test)("an unknown mode is rejected", function () {
    (0, bun_test_1.expect)(function () { return schema_foundation_1.confinementConfigSchema.parse({ mode: "sometimes" }); }).toThrow();
});
