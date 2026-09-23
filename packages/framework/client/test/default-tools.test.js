"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var capability_1 = require("@natalia/capability");
var tool_family_capabilities_1 = require("../src/capabilities/tool-family-capabilities");
/**
 * The static assembly now contributes nothing: every built-in tool family loads
 * through the built-in plugin catalog. These tests pin that the static path is
 * empty, so a migrated tool can never be re-registered behind the plugin's back.
 */
function builtinTools() {
    return (0, tool_family_capabilities_1.createToolRegistryFromCapabilities)({
        registry: new capability_1.CapabilityRegistry(),
    }).tools;
}
(0, bun_test_1.test)("migrated plugin tools are absent from the static tool assembly", function () {
    (0, bun_test_1.expect)(builtinTools().has("ask_user")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("todo_read")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("glob")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("grep")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("read_file")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("write_file")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("edit_file")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("image_read")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("apply_edits")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("web_fetch")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("web_search")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("browser_visit")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("browser_screenshot")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("run_shell")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("agent_spawn")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("interactive_terminal_start")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("sandbox_create")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("process_start")).toBe(false);
    (0, bun_test_1.expect)(builtinTools().has("background_start")).toBe(false);
});
