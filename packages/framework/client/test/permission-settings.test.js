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
var permission_settings_1 = require("../src/permission-settings");
function config(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ defaultAgentMode: "default", agentModes: {
            default: {
                approval: "ask",
                description: "",
                systemPrompt: "",
                allowedTools: [],
                excludedTools: [],
                mcpServers: [],
                skills: true,
            },
            strict: {
                approval: "auto",
                description: "",
                systemPrompt: "",
                allowedTools: [],
                excludedTools: [],
                mcpServers: [],
                skills: true,
            },
            read_only: {
                approval: "read_only",
                description: "",
                systemPrompt: "",
                allowedTools: [],
                excludedTools: [],
                mcpServers: [],
                skills: true,
            },
        } }, overrides);
}
(0, bun_test_1.test)("an explicitly requested profile wins and sets the mode", function () {
    var derived = (0, permission_settings_1.derivePermissionSettings)({
        config: config({ defaultAgentMode: "strict" }),
        requestedProfile: "read_only",
        optionMode: undefined,
        permissionMode: "ask",
    });
    if (!derived.found)
        throw new Error("expected found");
    (0, bun_test_1.expect)(derived.selectedProfile.approval).toBe("read_only");
    (0, bun_test_1.expect)(derived.mode).toBe("read_only");
    (0, bun_test_1.expect)(derived.defaultMode).toBe("read_only");
});
(0, bun_test_1.test)("a missing requested profile returns found:false", function () {
    var derived = (0, permission_settings_1.derivePermissionSettings)({
        config: config(),
        requestedProfile: "does-not-exist",
        optionMode: undefined,
        permissionMode: "ask",
    });
    (0, bun_test_1.expect)(derived.found).toBe(false);
});
(0, bun_test_1.test)("without a requested profile the mode default or profile approval applies", function () {
    var derived = (0, permission_settings_1.derivePermissionSettings)({
        config: config({ defaultAgentMode: "strict" }),
        requestedProfile: undefined,
        optionMode: undefined,
        permissionMode: "ask",
    });
    if (!derived.found)
        throw new Error("expected found");
    // strict mode has approval auto.
    (0, bun_test_1.expect)(derived.selectedProfile.approval).toBe("auto");
    (0, bun_test_1.expect)(derived.mode).toBe("auto");
});
(0, bun_test_1.test)("an explicit option mode is preserved", function () {
    var derived = (0, permission_settings_1.derivePermissionSettings)({
        config: config({ defaultAgentMode: "strict" }),
        requestedProfile: undefined,
        optionMode: "read_only",
        permissionMode: "read_only",
    });
    if (!derived.found)
        throw new Error("expected found");
    (0, bun_test_1.expect)(derived.selectedProfile.approval).toBe("auto");
    (0, bun_test_1.expect)(derived.mode).toBe("read_only");
});
