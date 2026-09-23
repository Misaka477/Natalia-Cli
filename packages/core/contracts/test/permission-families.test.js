"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var permission_families_1 = require("../src/permission-families");
(0, bun_test_1.describe)("permission families", function () {
    (0, bun_test_1.test)("separates filesystem reads from writes", function () {
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("read_file").id).toBe("filesystem-read");
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("grep").id).toBe("filesystem-read");
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("write_file").id).toBe("filesystem-write");
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("apply_edits").id).toBe("filesystem-write");
    });
    (0, bun_test_1.test)("groups terminal operations across terminal IDs and risk levels", function () {
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("interactive_terminal_start")).toEqual(permission_families_1.PERMISSION_FAMILIES.interactiveTerminal);
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("interactive_terminal_keys")).toEqual(permission_families_1.PERMISSION_FAMILIES.interactiveTerminal);
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("terminal_observe")).toEqual(permission_families_1.PERMISSION_FAMILIES.interactiveTerminal);
    });
    (0, bun_test_1.test)("returns copies so consumers cannot mutate the shared catalog", function () {
        var classified = (0, permission_families_1.classifyPermissionFamily)("write_file");
        classified.scope = "changed by consumer";
        (0, bun_test_1.expect)(permission_families_1.PERMISSION_FAMILIES.filesystemWrite.scope).toBe("All filesystem write tools in this session");
    });
    (0, bun_test_1.test)("does not group unknown plugin tools by plugin owner", function () {
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("plugin_read", "plugin:demo").id).toBe("tool:plugin_read");
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("plugin_write", "plugin:demo").id).toBe("tool:plugin_write");
    });
    (0, bun_test_1.test)("uses known capability owners conservatively", function () {
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("background_start", "natalia-tool-process").id).toBe("managed-process");
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("custom", "natalia-tool-web").id).toBe("network");
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("custom", "natalia-tool-fs").id).toBe("tool:custom");
    });
    (0, bun_test_1.test)("groups every approval-requiring built-in workflow family", function () {
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("sandbox_execute").id).toBe("sandbox");
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("sandbox_merge").id).toBe("sandbox");
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("plan").id).toBe("planning");
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("todo_write").id).toBe("planning");
        (0, bun_test_1.expect)((0, permission_families_1.classifyPermissionFamily)("skill_load").id).toBe("skills");
    });
});
