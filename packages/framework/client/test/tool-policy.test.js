"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var src_1 = require("../src");
var tools_1 = require("@anthelia/tools");
var tools_2 = require("@anthelia/tools");
var runtime_services_1 = require("@natalia/runtime-services");
var testing_1 = require("@natalia/testing");
(0, bun_test_1.test)("createToolPolicyHookLayer default allows all tools", function () {
    var layer = (0, src_1.createToolPolicyHookLayer)();
    (0, bun_test_1.expect)(layer.isToolAllowed("read_file")).toBe(true);
    (0, bun_test_1.expect)(layer.isToolAllowed("write_file")).toBe(true);
    (0, bun_test_1.expect)(layer.isToolAllowed("unknown")).toBe(true);
});
(0, bun_test_1.test)("createToolPolicyHookLayer allow list restricts tools", function () {
    var policy = { allow: ["read_file", "glob"] };
    var layer = (0, src_1.createToolPolicyHookLayer)(policy);
    (0, bun_test_1.expect)(layer.isToolAllowed("read_file")).toBe(true);
    (0, bun_test_1.expect)(layer.isToolAllowed("glob")).toBe(true);
    (0, bun_test_1.expect)(layer.isToolAllowed("write_file")).toBe(false);
    (0, bun_test_1.expect)(layer.isToolAllowed("run_shell")).toBe(false);
});
(0, bun_test_1.test)("createToolPolicyHookLayer exclude list blocks specific tools", function () {
    var policy = { exclude: ["write_file", "edit_file"] };
    var layer = (0, src_1.createToolPolicyHookLayer)(policy);
    (0, bun_test_1.expect)(layer.isToolAllowed("read_file")).toBe(true);
    (0, bun_test_1.expect)(layer.isToolAllowed("glob")).toBe(true);
    (0, bun_test_1.expect)(layer.isToolAllowed("write_file")).toBe(false);
    (0, bun_test_1.expect)(layer.isToolAllowed("edit_file")).toBe(false);
});
(0, bun_test_1.test)("createToolPolicyHookLayer allow and exclude together", function () {
    var policy = {
        allow: ["read_*", "write_*"],
        exclude: ["write_file"],
    };
    var layer = (0, src_1.createToolPolicyHookLayer)(policy);
    (0, bun_test_1.expect)(layer.isToolAllowed("read_file")).toBe(true);
    (0, bun_test_1.expect)(layer.isToolAllowed("read_dir")).toBe(true);
    (0, bun_test_1.expect)(layer.isToolAllowed("write_file")).toBe(false);
    (0, bun_test_1.expect)(layer.isToolAllowed("write_dir")).toBe(true);
});
(0, bun_test_1.test)("createToolPolicyHookLayer filterTools filters arrays", function () {
    var policy = { allow: ["read_file", "glob"] };
    var layer = (0, src_1.createToolPolicyHookLayer)(policy);
    var tools = [
        { name: "read_file", description: "a" },
        { name: "write_file", description: "b" },
        { name: "glob", description: "c" },
    ];
    var filtered = layer.filterTools(tools);
    (0, bun_test_1.expect)(filtered).toEqual([
        { name: "read_file", description: "a" },
        { name: "glob", description: "c" },
    ]);
});
(0, bun_test_1.test)("createToolPolicyHookLayer preExecute blocks disallowed tools", function () { return __awaiter(void 0, void 0, void 0, function () {
    var policy, layer, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                policy = { exclude: ["dangerous_tool"] };
                layer = (0, src_1.createToolPolicyHookLayer)(policy);
                return [4 /*yield*/, layer.preExecute({
                        turnID: "turn_1",
                        toolName: "dangerous_tool",
                        toolCallID: "call_1",
                        arguments: "{}",
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result.allowed).toBe(false);
                (0, bun_test_1.expect)(result.diagnostics).toContain("blocked by policy: dangerous_tool");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("createToolPolicyHookLayer preExecute allows allowed tools", function () { return __awaiter(void 0, void 0, void 0, function () {
    var layer, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                layer = (0, src_1.createToolPolicyHookLayer)();
                return [4 /*yield*/, layer.preExecute({
                        turnID: "turn_1",
                        toolName: "read_file",
                        toolCallID: "call_1",
                        arguments: '{"path":"test.txt"}',
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result.allowed).toBe(true);
                (0, bun_test_1.expect)(result.diagnostics).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("invalid command policy regex fails closed with a diagnostic", function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        result = (0, tools_1.evaluatePermissionRules)({ commands: { denyPatterns: ["["] } }, "run_shell", { command: "echo safe" });
        (0, bun_test_1.expect)(result.allowed).toBe(false);
        (0, bun_test_1.expect)(result.diagnostics.join(" ")).toContain("invalid command deny pattern");
        return [2 /*return*/];
    });
}); });
(0, bun_test_1.test)("structured profile command rules parse only one simple Bash command", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, source;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, tools_2.parseBashSimpleCommand)("git push origin main")).resolves.toEqual({
                    ok: true,
                    command: { tokens: ["git", "push", "origin", "main"] },
                })];
            case 1:
                _b.sent();
                _i = 0, _a = [
                    "git status && git push",
                    "git status | less",
                    "git status > status.txt",
                    "echo $(date)",
                    "(git status)",
                    "function check() { git status; }",
                ];
                _b.label = 2;
            case 2:
                if (!(_i < _a.length)) return [3 /*break*/, 5];
                source = _a[_i];
                return [4 /*yield*/, (0, bun_test_1.expect)((0, tools_2.parseBashSimpleCommand)(source)).resolves.toMatchObject({
                        ok: false,
                    })];
            case 3:
                _b.sent();
                _b.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("structured profile command rules use exact AST token prefixes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var denied;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, tools_1.evaluatePermissionProfileCommandRules)({
                    mode: "blacklist",
                    rules: [{ command: "rm -rf /tmp", reason: "temporary files are owned" }],
                }, "run_shell", { command: "rm -rf /tmp generated" })];
            case 1:
                denied = _a.sent();
                (0, bun_test_1.expect)(denied).toMatchObject({
                    allowed: false,
                    reason: "command blocked by policy",
                });
                return [4 /*yield*/, (0, bun_test_1.expect)((0, tools_1.evaluatePermissionProfileCommandRules)({
                        mode: "blacklist",
                        rules: [{ command: "rm -rf /tmp" }],
                    }, "run_shell", { command: "rm -rf /var/tmp" })).resolves.toMatchObject({ allowed: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, tools_1.evaluatePermissionProfileCommandRules)({
                        mode: "blacklist",
                        rules: [{ command: "git push" }],
                    }, "run_shell", { command: "git diff" })).resolves.toMatchObject({ allowed: true })];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("structured profile command rules enforce whitelist and fail closed", function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, tools_1.evaluatePermissionProfileCommandRules)({ mode: "whitelist", rules: [{ command: "git diff" }] }, "interactive_terminal_send_line", { id: "term", text: "git diff --stat" })).resolves.toMatchObject({ allowed: true })];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, tools_1.evaluatePermissionProfileCommandRules)({ mode: "whitelist", rules: [{ command: "git diff" }] }, "interactive_terminal_send_line", { id: "term", text: "git status" })).resolves.toMatchObject({ allowed: false })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, tools_1.evaluatePermissionProfileCommandRules)({ mode: "whitelist", rules: [{ command: "git status && pwd" }] }, "run_shell", { command: "git status" })).resolves.toMatchObject({
                        allowed: false,
                        reason: "command policy configuration is invalid",
                    })];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("terminal command buffer evaluates the complete pane line on submit", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, rules;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer();
                rules = { mode: "blacklist", rules: [{ command: "rm -rf" }] };
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(rules, "interactive_terminal_write", {
                        id: "pane_a",
                        input: "rm ",
                    })).resolves.toMatchObject({ allowed: true })];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(rules, "interactive_terminal_send_line", {
                        id: "pane_a",
                        text: "-rf /tmp",
                    })).resolves.toMatchObject({ allowed: false, clearTerminal: true })];
            case 2:
                _a.sent();
                // The denied command was cleared, so a later command on this pane is not
                // contaminated by the old prefix.
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(rules, "interactive_terminal_send_line", {
                        id: "pane_a",
                        text: "git status",
                    })).resolves.toMatchObject({ allowed: true })];
            case 3:
                // The denied command was cleared, so a later command on this pane is not
                // contaminated by the old prefix.
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("terminal command buffer intersects profile and active module rules", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, profile, module;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer();
                profile = {
                    mode: "whitelist",
                    rules: [{ command: "git status" }],
                };
                module = {
                    mode: "blacklist",
                    rules: [{ command: "git status", reason: "module only reads diffs" }],
                };
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate([profile, module], "interactive_terminal_send_line", {
                        id: "pane_a",
                        text: "git status",
                    })).resolves.toMatchObject({
                        allowed: false,
                        clearTerminal: true,
                        diagnostics: [bun_test_1.expect.stringContaining("active module deny rule")],
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("terminal command buffer is pane-scoped and fails closed for unsafe input", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, rules;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer();
                rules = {
                    mode: "whitelist",
                    rules: [{ command: "git diff" }],
                };
                return [4 /*yield*/, buffer.evaluate(rules, "interactive_terminal_write", {
                        id: "pane_a",
                        input: "git ",
                    })];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(rules, "interactive_terminal_send_line", {
                        id: "pane_b",
                        text: "git diff --stat",
                    })).resolves.toMatchObject({ allowed: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(rules, "interactive_terminal_keys", {
                        id: "pane_a",
                        keys: [{ key: "ArrowUp" }],
                    })).resolves.toMatchObject({ allowed: false, clearTerminal: true })];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(rules, "interactive_terminal_send_line", {
                        id: "pane_a",
                        text: "diff --stat",
                    })).resolves.toMatchObject({ allowed: false })];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("apply_edits is evaluated per path it touches", function () {
    var fileRules = {
        files: {
            writePaths: [
                { pattern: "protected/*", allow: false, reason: "protected" },
            ],
        },
    };
    // An edit that touches a protected path is blocked even when it also touches
    // an allowed one.
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(fileRules, "apply_edits", {
        edits: [
            { path: "open.ts", operation: "replace", oldText: "a", newText: "A" },
            {
                path: "protected/secret.ts",
                operation: "replace",
                oldText: "b",
                newText: "B",
            },
        ],
    })).toMatchObject({ allowed: false, reason: "protected" });
    // An edit that avoids protected paths is allowed.
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(fileRules, "apply_edits", {
        edits: [
            { path: "open.ts", operation: "replace", oldText: "a", newText: "A" },
        ],
    })).toMatchObject({ allowed: true });
});
(0, bun_test_1.test)("agent rules cover sandbox paths and all command-launching tools", function () {
    var fileRules = {
        files: {
            writePaths: [
                { pattern: "protected/*", allow: false, reason: "protected" },
            ],
        },
    };
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(fileRules, "sandbox_write", {
        path: "protected/note.txt",
    })).toMatchObject({ allowed: false, reason: "protected" });
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(fileRules, "browser_screenshot", {
        path: "protected/page.png",
    })).toMatchObject({ allowed: false, reason: "protected" });
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)({ files: { readPaths: fileRules.files.writePaths } }, "glob", { path: "protected/note.txt" })).toMatchObject({ allowed: false, reason: "protected" });
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)({ files: { readPaths: fileRules.files.writePaths } }, "grep", { path: "protected/note.txt" })).toMatchObject({ allowed: false, reason: "protected" });
    var commandRules = { commands: { denyPatterns: ["rm\\s+-rf"] } };
    for (var _i = 0, _a = [
        "sandbox_execute",
        "sandbox_resource_start",
        "process_start",
        "background_start",
        "interactive_start",
        "interactive_terminal_start",
    ]; _i < _a.length; _i++) {
        var toolName = _a[_i];
        (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(commandRules, toolName, {
            command: "rm -rf generated",
        })).toMatchObject({ allowed: false, reason: "command blocked by policy" });
    }
});
(0, bun_test_1.test)("command policy covers terminal input, not only command arguments", function () {
    var rules = { commands: { denyPatterns: ["rm\\s+-rf"] } };
    // Every terminal write entry point, under both its canonical name and its
    // registered alias, carrying the command in whichever field that tool uses.
    var calls = [
        ["interactive_terminal_send_line", { id: "t", text: "rm -rf /" }],
        ["interactive_terminal_write", { id: "t", input: "rm -rf /" }],
        ["interactive_terminal_input", { id: "t", text: "rm -rf /" }],
        ["interactive_terminal_keys", { id: "t", key: "rm -rf /" }],
        ["interactive_send_line", { id: "t", text: "rm -rf /" }],
        ["interactive_write", { id: "t", input: "rm -rf /" }],
        ["interactive_input", { id: "t", text: "rm -rf /" }],
        ["interactive_keys", { id: "t", key: "rm -rf /" }],
    ];
    for (var _i = 0, calls_1 = calls; _i < calls_1.length; _i++) {
        var _a = calls_1[_i], toolName = _a[0], args = _a[1];
        (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, toolName, args)).toMatchObject({
            allowed: false,
            reason: "command blocked by policy",
        });
    }
});
(0, bun_test_1.test)("terminal command text reconstructs key-by-key typing", function () {
    // Typing a command one key at a time must not evade the policy.
    (0, bun_test_1.expect)((0, tools_1.commandTextForTool)("interactive_terminal_input", {
        keys: [
            { key: "r" },
            { key: "m" },
            { key: " " },
            { key: "-" },
            { key: "r" },
            { key: "f" },
        ],
    })).toBe("rm -rf");
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)({ commands: { denyPatterns: ["rm\\s+-rf"] } }, "interactive_terminal_input", {
        id: "t",
        keys: [{ text: "rm" }, { text: " -rf" }, { text: " /" }],
    })).toMatchObject({ allowed: false });
});
(0, bun_test_1.test)("terminal command text keeps separate input sources apart", function () {
    // Sources are joined by newline so two harmless fields cannot be spliced
    // into a token that neither of them contained.
    (0, bun_test_1.expect)((0, tools_1.commandTextForTool)("interactive_terminal_input", {
        text: "r",
        keys: [{ key: "m" }],
    })).toBe("r\nm");
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)({ commands: { denyPatterns: ["\\brm\\b"] } }, "interactive_terminal_input", { id: "t", text: "r", keys: [{ key: "m" }] })).toMatchObject({ allowed: true });
});
(0, bun_test_1.test)("terminal input honours command allow lists and ignores unrelated tools", function () {
    var allowOnlyGit = { commands: { allowPatterns: ["^git\\s"] } };
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(allowOnlyGit, "interactive_terminal_send_line", {
        id: "t",
        text: "git status",
    })).toMatchObject({ allowed: true });
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(allowOnlyGit, "interactive_terminal_send_line", {
        id: "t",
        text: "ls",
    })).toMatchObject({ allowed: false, reason: "command blocked by policy" });
    // A tool that runs no command is not a command carrier, whatever its args.
    (0, bun_test_1.expect)((0, tools_1.commandTextForTool)("read_file", { text: "rm -rf /" })).toBeUndefined();
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)({ commands: { denyPatterns: ["rm\\s+-rf"] } }, "read_file", { path: "a.txt", text: "rm -rf /" })).toMatchObject({ allowed: true });
    // Calls that carry no input at all stay undefined rather than empty string.
    (0, bun_test_1.expect)((0, tools_1.commandTextForTool)("interactive_terminal_input", { id: "t" })).toBeUndefined();
});
(0, bun_test_1.test)("file rules cannot be evaded by respelling the same path", function () {
    var rules = {
        files: {
            writePaths: [
                { pattern: "secret.txt", allow: false, reason: "protected" },
            ],
            readPaths: [{ pattern: "secret.txt", allow: false, reason: "protected" }],
        },
    };
    var root = "/tmp/policy-workspace";
    // Every spelling below resolves to the same file the tool would write.
    for (var _i = 0, _a = [
        "secret.txt",
        "./secret.txt",
        "dir/../secret.txt",
        "/tmp/policy-workspace/secret.txt",
        ".\\secret.txt",
    ]; _i < _a.length; _i++) {
        var path = _a[_i];
        (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "write_file", { path: path }, root)).toMatchObject({ allowed: false, reason: "protected" });
        (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "read_file", { path: path }, root)).toMatchObject({ allowed: false, reason: "protected" });
    }
    // Different files stay allowed, so normalization does not over-block.
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "write_file", { path: "other.txt" }, root)).toMatchObject({ allowed: true });
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "write_file", { path: "sub/secret.txt" }, root)).toMatchObject({ allowed: true });
    // Rules still apply when no workspace root is supplied.
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "write_file", { path: "./secret.txt" })).toMatchObject({ allowed: false, reason: "protected" });
});
(0, bun_test_1.test)("terminal low-risk approval scopes bind one terminal and exclude high-risk input", function () {
    (0, bun_test_1.expect)((0, runtime_services_1.terminalApprovalScope)("interactive_terminal_send_line", JSON.stringify({ id: "terminal_a", text: "ls" }))).toMatchObject({
        terminalID: "terminal_a",
        scope: "terminal:terminal_a:low-risk",
        risk: "terminal_low",
    });
    (0, bun_test_1.expect)((0, runtime_services_1.terminalApprovalScope)("interactive_terminal_send_line", JSON.stringify({ id: "terminal_b", text: "ls" }))).toMatchObject({ scope: "terminal:terminal_b:low-risk" });
    (0, bun_test_1.expect)((0, runtime_services_1.terminalApprovalScope)("interactive_terminal_send_line", JSON.stringify({ id: "terminal_a", text: "rm -rf generated" }))).toMatchObject({
        scope: "terminal:terminal_a:high-risk",
        risk: "terminal_high",
    });
    (0, bun_test_1.expect)((0, runtime_services_1.terminalApprovalScope)("interactive_terminal_keys", JSON.stringify({ id: "terminal_a", key: "ArrowUp" }))).toMatchObject({ risk: "terminal_high" });
    (0, bun_test_1.expect)((0, runtime_services_1.terminalInputRisk)("interactive_terminal_keys", {
        key: "x",
    })).toBe("terminal_low");
    (0, bun_test_1.expect)((0, runtime_services_1.terminalInputRisk)("interactive_terminal_keys", {
        key: "x",
        modifiers: ["ctrl"],
    })).toBe("terminal_high");
});
(0, bun_test_1.test)("createToolPolicyHookLayer preExecute calls custom hook", function () { return __awaiter(void 0, void 0, void 0, function () {
    var calls, hooks, layer, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                calls = [];
                hooks = {
                    preExecute: function (event) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            calls.push(event.toolName);
                            return [2 /*return*/, { allowed: true, diagnostics: ["custom check ok"] }];
                        });
                    }); },
                };
                layer = (0, src_1.createToolPolicyHookLayer)(undefined, hooks);
                return [4 /*yield*/, layer.preExecute({
                        turnID: "turn_1",
                        toolName: "read_file",
                        toolCallID: "call_1",
                        arguments: "{}",
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(calls).toEqual(["read_file"]);
                (0, bun_test_1.expect)(result.allowed).toBe(true);
                (0, bun_test_1.expect)(result.diagnostics).toContain("custom check ok");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("createToolPolicyHookLayer preExecute hook can block", function () { return __awaiter(void 0, void 0, void 0, function () {
    var hooks, layer, allowed, blocked;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                hooks = {
                    preExecute: function (event) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            if (event.toolName === "write_file")
                                return [2 /*return*/, { allowed: false, diagnostics: ["write not allowed by hook"] }];
                            return [2 /*return*/, { allowed: true, diagnostics: [] }];
                        });
                    }); },
                };
                layer = (0, src_1.createToolPolicyHookLayer)(undefined, hooks);
                return [4 /*yield*/, layer.preExecute({
                        turnID: "turn_1",
                        toolName: "read_file",
                        toolCallID: "call_1",
                        arguments: "{}",
                    })];
            case 1:
                allowed = _a.sent();
                return [4 /*yield*/, layer.preExecute({
                        turnID: "turn_1",
                        toolName: "write_file",
                        toolCallID: "call_2",
                        arguments: "{}",
                    })];
            case 2:
                blocked = _a.sent();
                (0, bun_test_1.expect)(allowed.allowed).toBe(true);
                (0, bun_test_1.expect)(blocked.allowed).toBe(false);
                (0, bun_test_1.expect)(blocked.diagnostics).toContain("write not allowed by hook");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("createToolPolicyHookLayer preserves terminal cleanup on a policy denial", function () { return __awaiter(void 0, void 0, void 0, function () {
    var layer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                layer = (0, src_1.createToolPolicyHookLayer)(undefined, {
                    preExecute: function () { return ({
                        allowed: false,
                        diagnostics: ["blocked command"],
                        clearTerminal: true,
                    }); },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(layer.preExecute({
                        turnID: "turn_1",
                        toolName: "interactive_terminal_send_line",
                        toolCallID: "call_1",
                        arguments: '{"id":"pane"}',
                    })).resolves.toMatchObject({ allowed: false, clearTerminal: true })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("createToolPolicyHookLayer postExecute calls custom hook", function () { return __awaiter(void 0, void 0, void 0, function () {
    var captured, hooks, layer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                captured = [];
                hooks = {
                    postExecute: function (event) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            captured.push({
                                toolName: event.toolName,
                                result: event.result,
                                error: event.error,
                            });
                            return [2 /*return*/];
                        });
                    }); },
                };
                layer = (0, src_1.createToolPolicyHookLayer)(undefined, hooks);
                return [4 /*yield*/, layer.postExecute({
                        turnID: "turn_1",
                        toolName: "read_file",
                        toolCallID: "call_1",
                        arguments: "{}",
                        result: "file content",
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(captured).toEqual([
                    { toolName: "read_file", result: "file content", error: undefined },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("createToolPolicyHookLayer postExecute captures errors", function () { return __awaiter(void 0, void 0, void 0, function () {
    var captured, hooks, layer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                captured = [];
                hooks = {
                    postExecute: function (event) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            captured.push({ toolName: event.toolName, error: event.error });
                            return [2 /*return*/];
                        });
                    }); },
                };
                layer = (0, src_1.createToolPolicyHookLayer)(undefined, hooks);
                return [4 /*yield*/, layer.postExecute({
                        turnID: "turn_1",
                        toolName: "write_file",
                        toolCallID: "call_2",
                        arguments: "{}",
                        error: "permission denied",
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(captured).toEqual([
                    { toolName: "write_file", error: "permission denied" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("real runtime client with allow policy prevents excluded tools from provider", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, requests, provider, policy, client, toolsSent, toolNames;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-policy-allow-"))];
            case 1:
                root = _c.sent();
                events = [];
                requests = [];
                provider = {
                    provider: "scripted-policy",
                    model: "scripted-policy-model",
                    requests: requests,
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_1() {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        requests.push(request);
                                        return [4 /*yield*/, __await({ type: "content", text: "ok" })];
                                    case 1: return [4 /*yield*/, _a.sent()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, __await({ type: "done" })];
                                    case 3: return [4 /*yield*/, _a.sent()];
                                    case 4:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                policy = { allow: ["read_file"] };
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_policy_allow",
                    provider: provider,
                    permissionMode: "auto",
                    toolPolicy: policy,
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("run")];
            case 2:
                _c.sent();
                toolsSent = (_b = (_a = requests[0]) === null || _a === void 0 ? void 0 : _a.tools) !== null && _b !== void 0 ? _b : [];
                toolNames = toolsSent.map(function (t) { return t.name; });
                (0, bun_test_1.expect)(toolNames).toContain("read_file");
                (0, bun_test_1.expect)(toolNames).not.toContain("write_file");
                (0, bun_test_1.expect)(toolNames).not.toContain("run_shell");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("mode permission profile overrides default runtime approval mode", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, client, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-mode-permission-"))];
            case 1:
                root = _c.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _c.sent();
                return [4 /*yield*/, Bun.write((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        agentModes: {
                            ask: { approval: "ask", description: "Ask" },
                            safe: { approval: "read_only", description: "Safe mode" },
                            review: { approval: "read_only", description: "Review mode" },
                        },
                        defaultAgentMode: "review",
                    }))];
            case 3:
                _c.sent();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_mode_permission",
                    provider: toolCallingProviderWithName("read_file"),
                });
                client.start(function () { return undefined; });
                _a = bun_test_1.expect;
                return [4 /*yield*/, ((_b = client.runtimeStatus) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 4:
                _a.apply(void 0, [_c.sent()]).toMatchObject({
                    permissions: "read_only",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("permission profile command rules deny before execution and audit the decision", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-profile-command-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, Bun.write((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        agentModes: {
                            guarded: {
                                approval: "auto",
                                description: "Guarded commands",
                                commandRules: {
                                    mode: "blacklist",
                                    rules: [{ command: "git push", reason: "publish manually" }],
                                },
                            },
                        },
                    }))];
            case 3:
                _a.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_profile_command",
                    permissionProfile: "guarded",
                    provider: {
                        provider: "scripted-command",
                        model: "scripted-command-model",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_2() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 3];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_command",
                                                            name: "run_shell",
                                                            arguments: JSON.stringify({ command: "git push origin main" }),
                                                        },
                                                    ],
                                                })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            _a.label = 3;
                                        case 3: return [4 /*yield*/, __await({ type: "done" })];
                                        case 4: return [4 /*yield*/, _a.sent()];
                                        case 5:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("publish changes")];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "policy.decision",
                    toolName: "run_shell",
                    decision: "deny",
                    reason: bun_test_1.expect.stringContaining('command matches profile deny rule "git push"'),
                }));
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "approval.request"; })).toBe(false);
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "tool.update",
                    name: "run_shell",
                    status: "failed",
                }));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("explicit toolPolicy cannot bypass agent file permissions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-agent-policy-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, Bun.write((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        defaultAgent: "review",
                        agents: {
                            review: {
                                description: "Review",
                                permissions: {
                                    files: {
                                        writePaths: [
                                            { pattern: "protected.txt", allow: false, reason: "protected" },
                                        ],
                                    },
                                },
                            },
                        },
                    }))];
            case 3:
                _a.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_agent_policy",
                    provider: writeProvider("protected.txt"),
                    permissionMode: "auto",
                    toolPolicy: { allow: ["write_file"] },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("write protected")];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "tool.update",
                    name: "write_file",
                    status: "failed",
                    summary: bun_test_1.expect.stringContaining("protected"),
                }));
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(root, "protected.txt"), "utf8")).rejects.toMatchObject({
                        code: "ENOENT",
                    })];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("agent command rules block sandbox execution before approval", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-sandbox-policy-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, Bun.write((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        defaultAgent: "review",
                        agents: {
                            review: {
                                description: "Review",
                                permissions: { commands: { denyPatterns: ["rm\\s+-rf"] } },
                            },
                        },
                    }))];
            case 3:
                _a.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_sandbox_policy",
                    provider: sandboxCommandProvider(),
                    permissionMode: "auto",
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("run sandbox command")];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "tool.update",
                    name: "sandbox_execute",
                    status: "failed",
                    summary: bun_test_1.expect.stringContaining("command matches deny pattern"),
                }));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox merge preflight rejects every denied manifest path atomically", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sandboxes, events, client;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-sandbox-merge-policy-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, Bun.write((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        sandbox: { promoteCommand: "true" },
                        defaultAgent: "review",
                        agents: {
                            review: {
                                description: "Review",
                                permissions: {
                                    files: {
                                        writePaths: [
                                            {
                                                pattern: "protected.txt",
                                                allow: false,
                                                reason: "protected by agent policy",
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    }))];
            case 3:
                _a.sent();
                sandboxes = new testing_1.WorkspaceSandboxTestManager((0, node_path_1.join)(root, ".natalia", "sandboxes"));
                return [4 /*yield*/, sandboxes.create("box")];
            case 4:
                _a.sent();
                return [4 /*yield*/, sandboxes.write("box", "allowed.txt", "allowed")];
            case 5:
                _a.sent();
                return [4 /*yield*/, sandboxes.write("box", "protected.txt", "protected")];
            case 6:
                _a.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_sandbox_merge_policy",
                    permissionMode: "auto",
                    provider: sandboxMergeProvider(),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("merge sandbox changes")];
            case 7:
                _a.sent();
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "tool.update",
                    name: "sandbox_merge",
                    status: "failed",
                    summary: bun_test_1.expect.stringContaining("protected by agent policy"),
                }));
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(root, "allowed.txt"), "utf8")).rejects.toMatchObject({
                        code: "ENOENT",
                    })];
            case 8:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(root, "protected.txt"), "utf8")).rejects.toMatchObject({
                        code: "ENOENT",
                    })];
            case 9:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox merge preflight permits a manifest when every path is allowed", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sandboxes, events, client, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-sandbox-merge-allow-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        sandbox: { promoteCommand: "true" },
                    }))];
            case 3:
                _b.sent();
                sandboxes = new testing_1.WorkspaceSandboxTestManager((0, node_path_1.join)(root, ".natalia", "sandboxes"));
                return [4 /*yield*/, sandboxes.create("box")];
            case 4:
                _b.sent();
                return [4 /*yield*/, sandboxes.write("box", "allowed.txt", "allowed")];
            case 5:
                _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_sandbox_merge_allow",
                    permissionMode: "auto",
                    provider: sandboxMergeProvider(),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("merge sandbox changes")];
            case 6:
                _b.sent();
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "tool.update",
                    name: "sandbox_merge",
                    status: "succeeded",
                }));
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "allowed.txt"), "utf8")];
            case 7:
                _a.apply(void 0, [_b.sent()]).toBe("allowed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox merge exclusion applies to catalog and forced execution", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sandboxes, events, requests, client;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-sandbox-merge-exclude-"))];
            case 1:
                root = _c.sent();
                sandboxes = new testing_1.WorkspaceSandboxTestManager((0, node_path_1.join)(root, ".natalia", "sandboxes"));
                return [4 /*yield*/, sandboxes.create("box")];
            case 2:
                _c.sent();
                return [4 /*yield*/, sandboxes.write("box", "allowed.txt", "allowed")];
            case 3:
                _c.sent();
                events = [];
                requests = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_sandbox_merge_exclude",
                    permissionMode: "auto",
                    toolPolicy: { exclude: ["sandbox_merge"] },
                    provider: {
                        provider: "scripted-sandbox-merge-exclude",
                        model: "scripted-sandbox-merge-exclude-model",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_3() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            requests.push(request);
                                            if (!!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 3];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "merge",
                                                            name: "sandbox_merge",
                                                            arguments: JSON.stringify({ id: "box" }),
                                                        },
                                                    ],
                                                })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            _a.label = 3;
                                        case 3: return [4 /*yield*/, __await({ type: "done" })];
                                        case 4: return [4 /*yield*/, _a.sent()];
                                        case 5:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("merge sandbox changes")];
            case 4:
                _c.sent();
                (0, bun_test_1.expect)((_b = (_a = requests[0]) === null || _a === void 0 ? void 0 : _a.tools) === null || _b === void 0 ? void 0 : _b.map(function (tool) { return tool.name; })).not.toContain("sandbox_merge");
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "tool.update",
                    name: "sandbox_merge",
                    status: "failed",
                    summary: "Unknown tool: sandbox_merge",
                }));
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)((0, node_path_1.join)(root, "allowed.txt"), "utf8")).rejects.toMatchObject({
                        code: "ENOENT",
                    })];
            case 5:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("agent read paths block glob and grep before exposing protected files", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, _i, _a, name_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-search-policy-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "allowed.ts"), "const value = 'needle';\n")];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "protected.ts"), "const secret = 'needle';\n")];
            case 4:
                _b.sent();
                return [4 /*yield*/, Bun.write((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        defaultAgent: "review",
                        agents: {
                            review: {
                                description: "Review",
                                permissions: {
                                    files: {
                                        readPaths: [
                                            {
                                                pattern: "protected.ts",
                                                allow: false,
                                                reason: "protected read path",
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    }))];
            case 5:
                _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_search_policy",
                    permissionMode: "auto",
                    provider: searchPolicyProvider(),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("search workspace")];
            case 6:
                _b.sent();
                for (_i = 0, _a = ["glob", "grep"]; _i < _a.length; _i++) {
                    name_1 = _a[_i];
                    (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                        type: "tool.update",
                        name: name_1,
                        status: "failed",
                        summary: bun_test_1.expect.stringContaining("protected read path"),
                    }));
                }
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("real runtime client with exclude policy blocks tool execution", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, policy, provider, client, failedEvents;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-policy-block-"))];
            case 1:
                root = _a.sent();
                events = [];
                policy = { exclude: ["read_file"] };
                provider = blockTestProvider();
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_policy_block",
                    provider: provider,
                    permissionMode: "auto",
                    toolPolicy: policy,
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read input.txt")];
            case 2:
                _a.sent();
                failedEvents = events.filter(function (event) {
                    return event.type === "tool.update" &&
                        event.name === "read_file" &&
                        event.status === "failed";
                });
                (0, bun_test_1.expect)(failedEvents.length).toBeGreaterThan(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("runtime persists safe policy decisions without tool arguments", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, history, decision;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-policy-audit-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _b.sent();
                return [4 /*yield*/, Bun.write((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        defaultAgent: "review",
                        agents: {
                            review: {
                                description: "Review",
                                permissions: {
                                    files: {
                                        writePaths: [
                                            {
                                                pattern: "protected.txt",
                                                allow: false,
                                                reason: "protected by agent policy",
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    }))];
            case 3:
                _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_policy_audit",
                    permissionMode: "auto",
                    provider: writeProvider("protected.txt"),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read input.txt")];
            case 4:
                _b.sent();
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "policy.decision",
                    toolName: "write_file",
                    decision: "deny",
                    reason: 'write to "protected.txt" blocked: protected by agent policy',
                }));
                return [4 /*yield*/, client.history({ limit: 500 })];
            case 5:
                history = _b.sent();
                decision = (_a = history.events.find(function (entry) { return entry.event.type === "policy.decision"; })) === null || _a === void 0 ? void 0 : _a.event;
                (0, bun_test_1.expect)(decision).toEqual({
                    type: "policy.decision",
                    turnID: bun_test_1.expect.any(String),
                    toolName: "write_file",
                    toolCallID: "call_write",
                    decision: "deny",
                    reason: 'write to "protected.txt" blocked: protected by agent policy',
                    sessionID: "ses_ts7_policy_audit",
                });
                (0, bun_test_1.expect)(JSON.stringify(decision)).not.toContain("content");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("catalog policy denials are durably distinguished from unknown tools", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-catalog-audit-"))];
            case 1:
                root = _a.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_catalog_audit",
                    permissionMode: "auto",
                    toolPolicy: { exclude: ["read_file"] },
                    provider: blockTestProvider(),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read input.txt")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(events).toContainEqual(bun_test_1.expect.objectContaining({
                    type: "policy.decision",
                    toolName: "read_file",
                    decision: "deny",
                    reason: "tool is excluded from the runtime catalog by policy",
                }));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("real runtime client hooks emit diagnostics on preExecute", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, hookCalls, hooks, client, diagEvents;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-hooks-pre-"))];
            case 1:
                root = _a.sent();
                events = [];
                hookCalls = [];
                hooks = {
                    preExecute: function (event) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            hookCalls.push("pre:".concat(event.toolName));
                            return [2 /*return*/, {
                                    allowed: true,
                                    diagnostics: ["pre-check passed for ".concat(event.toolName)],
                                }];
                        });
                    }); },
                };
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_hooks_pre",
                    provider: toolCallingProviderWithName("read_file"),
                    permissionMode: "auto",
                    hooks: hooks,
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(hookCalls).toContain("pre:read_file");
                diagEvents = events.filter(function (event) {
                    return event.type === "diagnostic" && event.message.includes("pre-check passed");
                });
                (0, bun_test_1.expect)(diagEvents.length).toBeGreaterThan(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("real runtime client hooks call postExecute after tool success", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, captured, hooks, client;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-hooks-post-"))];
            case 1:
                root = _b.sent();
                events = [];
                captured = [];
                hooks = {
                    postExecute: function (event) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            captured.push({ toolName: event.toolName, result: event.result });
                            return [2 /*return*/];
                        });
                    }); },
                };
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_hooks_post",
                    provider: toolCallingProviderWithName("read_file"),
                    permissionMode: "auto",
                    hooks: hooks,
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read")];
            case 2:
                _b.sent();
                (0, bun_test_1.expect)(captured.length).toBeGreaterThan(0);
                (0, bun_test_1.expect)((_a = captured[0]) === null || _a === void 0 ? void 0 : _a.toolName).toBe("read_file");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("real runtime client hooks call postExecute with error on failure", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, captured, hooks, client;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-hooks-error-"))];
            case 1:
                root = _a.sent();
                events = [];
                captured = [];
                hooks = {
                    postExecute: function (event) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            captured.push({ toolName: event.toolName, error: event.error });
                            return [2 /*return*/];
                        });
                    }); },
                };
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_hooks_error",
                    provider: toolCallingProviderWithName("read_file"),
                    permissionMode: "auto",
                    hooks: hooks,
                    toolPolicy: { exclude: ["read_file"] },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(captured.length).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("real runtime client toolPolicy filters executeToolCalls lookup", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, policy, provider, client, succeeded;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-policy-lookup-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "test.txt"), "data\n")];
            case 2:
                _a.sent();
                events = [];
                policy = { allow: ["read_file"] };
                provider = toolCallingProviderWithName("read_file");
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_policy_lookup",
                    provider: provider,
                    permissionMode: "auto",
                    toolPolicy: policy,
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read")];
            case 3:
                _a.sent();
                succeeded = events.some(function (event) {
                    return event.type === "tool.update" &&
                        event.name === "read_file" &&
                        event.status === "succeeded";
                });
                (0, bun_test_1.expect)(succeeded).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("real runtime client preExecute hook can block execution", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, hooks, provider, client, failedEvents;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-hooks-block-"))];
            case 1:
                root = _a.sent();
                events = [];
                hooks = {
                    preExecute: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, { allowed: false, diagnostics: ["blocked by custom hook"] }];
                        });
                    }); },
                };
                provider = toolCallingProviderWithName("read_file");
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_hooks_block",
                    provider: provider,
                    permissionMode: "auto",
                    hooks: hooks,
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read")];
            case 2:
                _a.sent();
                failedEvents = events.filter(function (event) {
                    return event.type === "tool.update" &&
                        event.status === "failed" &&
                        event.name === "read_file";
                });
                (0, bun_test_1.expect)(failedEvents.length).toBeGreaterThan(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("real runtime client no policy or hooks preserves default behavior", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, succeeded;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ts7-default-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "test.txt"), "default\n")];
            case 2:
                _a.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_ts7_default",
                    provider: toolCallingProviderWithName("read_file"),
                    permissionMode: "auto",
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read")];
            case 3:
                _a.sent();
                succeeded = events.some(function (event) {
                    return event.type === "tool.update" &&
                        event.name === "read_file" &&
                        event.status === "succeeded";
                });
                (0, bun_test_1.expect)(succeeded).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
function toolCallingProviderWithName(toolName) {
    return {
        provider: "scripted-tool",
        model: "scripted-tool-model",
        stream: function (request) {
            return __asyncGenerator(this, arguments, function stream_4() {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!request.messages.some(function (m) { return m.role === "tool"; })) return [3 /*break*/, 6];
                            return [4 /*yield*/, __await({
                                    type: "tool_call",
                                    calls: [
                                        { id: "call_1", name: toolName, arguments: '{"path":"test.txt"}' },
                                    ],
                                })];
                        case 1: return [4 /*yield*/, _a.sent()];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 3: return [4 /*yield*/, _a.sent()];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, __await(void 0)];
                        case 5: return [2 /*return*/, _a.sent()];
                        case 6: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                        case 7: return [4 /*yield*/, _a.sent()];
                        case 8:
                            _a.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 9: return [4 /*yield*/, _a.sent()];
                        case 10:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
function writeProvider(path) {
    return {
        provider: "scripted-write",
        model: "scripted-write-model",
        stream: function (request) {
            return __asyncGenerator(this, arguments, function stream_5() {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 3];
                            return [4 /*yield*/, __await({
                                    type: "tool_call",
                                    calls: [
                                        {
                                            id: "call_write",
                                            name: "write_file",
                                            arguments: JSON.stringify({ path: path, content: "blocked" }),
                                        },
                                    ],
                                })];
                        case 1: return [4 /*yield*/, _a.sent()];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3: return [4 /*yield*/, __await({ type: "done" })];
                        case 4: return [4 /*yield*/, _a.sent()];
                        case 5:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
function sandboxCommandProvider() {
    return {
        provider: "scripted-sandbox",
        model: "scripted-sandbox-model",
        stream: function (request) {
            return __asyncGenerator(this, arguments, function stream_6() {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 3];
                            return [4 /*yield*/, __await({
                                    type: "tool_call",
                                    calls: [
                                        {
                                            id: "call_sandbox",
                                            name: "sandbox_execute",
                                            arguments: JSON.stringify({
                                                id: "box",
                                                command: "rm -rf generated",
                                            }),
                                        },
                                    ],
                                })];
                        case 1: return [4 /*yield*/, _a.sent()];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3: return [4 /*yield*/, __await({ type: "done" })];
                        case 4: return [4 /*yield*/, _a.sent()];
                        case 5:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
function sandboxMergeProvider() {
    return {
        provider: "scripted-sandbox-merge",
        model: "scripted-sandbox-merge-model",
        stream: function (request) {
            return __asyncGenerator(this, arguments, function stream_7() {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 3];
                            return [4 /*yield*/, __await({
                                    type: "tool_call",
                                    calls: [
                                        {
                                            id: "merge",
                                            name: "sandbox_merge",
                                            arguments: JSON.stringify({ id: "box" }),
                                        },
                                    ],
                                })];
                        case 1: return [4 /*yield*/, _a.sent()];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3: return [4 /*yield*/, __await({ type: "done" })];
                        case 4: return [4 /*yield*/, _a.sent()];
                        case 5:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
function searchPolicyProvider() {
    return {
        provider: "scripted-search-policy",
        model: "scripted-search-policy-model",
        stream: function (request) {
            return __asyncGenerator(this, arguments, function stream_8() {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 3];
                            return [4 /*yield*/, __await({
                                    type: "tool_call",
                                    calls: [
                                        {
                                            id: "glob",
                                            name: "glob",
                                            arguments: JSON.stringify({ pattern: "*.ts" }),
                                        },
                                        {
                                            id: "grep",
                                            name: "grep",
                                            arguments: JSON.stringify({
                                                pattern: "needle",
                                                include: "*.ts",
                                            }),
                                        },
                                    ],
                                })];
                        case 1: return [4 /*yield*/, _a.sent()];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3: return [4 /*yield*/, __await({ type: "done" })];
                        case 4: return [4 /*yield*/, _a.sent()];
                        case 5:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
function blockTestProvider() {
    return {
        provider: "block-test",
        model: "block-test-model",
        stream: function (request) {
            return __asyncGenerator(this, arguments, function stream_9() {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!request.messages.some(function (m) { return m.role === "tool"; })) return [3 /*break*/, 6];
                            return [4 /*yield*/, __await({
                                    type: "tool_call",
                                    calls: [
                                        {
                                            id: "call_read",
                                            name: "read_file",
                                            arguments: '{"path":"input.txt"}',
                                        },
                                    ],
                                })];
                        case 1: return [4 /*yield*/, _a.sent()];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 3: return [4 /*yield*/, _a.sent()];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, __await(void 0)];
                        case 5: return [2 /*return*/, _a.sent()];
                        case 6: return [4 /*yield*/, __await({ type: "content", text: "done" })];
                        case 7: return [4 /*yield*/, _a.sent()];
                        case 8:
                            _a.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 9: return [4 /*yield*/, _a.sent()];
                        case 10:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
/** Foreground program the fake host reports for the pane, one step at a time. */
function foregroundSequence(steps) {
    var _this = this;
    var index = 0;
    return function () { return __awaiter(_this, void 0, void 0, function () {
        var step;
        var _a;
        return __generator(this, function (_b) {
            step = steps[Math.min(index++, steps.length - 1)];
            if ("unsupported" in step)
                return [2 /*return*/, { supported: false, reason: step.unsupported }];
            if ("none" in step)
                return [2 /*return*/, { supported: true, process: undefined }];
            return [2 /*return*/, {
                    supported: true,
                    process: { pid: (_a = step.pid) !== null && _a !== void 0 ? _a : 4242, name: step.program },
                }];
        });
    }); };
}
var WHITELIST_WITH_VIM = {
    mode: "whitelist",
    rules: [{ command: "git diff" }, { command: "vim" }],
};
(0, bun_test_1.test)("an unauthorized interactive program never leaves Bash command policy", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer({
                    foregroundProgram: foregroundSequence([{ program: "vim" }]),
                });
                // `vim` is a permitted command but no interactive program is authorized, so
                // the pane stays in Bash mode and vim's own keystrokes are still policed.
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", {
                        id: "pane_a",
                        text: "vim notes.md",
                    })).resolves.toMatchObject({ allowed: true })];
            case 1:
                // `vim` is a permitted command but no interactive program is authorized, so
                // the pane stays in Bash mode and vim's own keystrokes are still policed.
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toEqual({ mode: "bash" });
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", {
                        id: "pane_a",
                        text: ":wq",
                    })).resolves.toMatchObject({ allowed: false, clearTerminal: true })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an authorized program takes over the pane only once the host confirms it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, programs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer({
                    foregroundProgram: foregroundSequence([
                        { program: "bash" },
                        { program: "vim" },
                    ]),
                });
                programs = { allow: [{ command: "vim" }] };
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: "vim notes.md" }, programs)).resolves.toMatchObject({ allowed: true })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toMatchObject({
                    mode: "pending_program",
                    program: "vim",
                });
                // The shell is still in the foreground, so the takeover is not accepted yet
                // and the input remains under Bash policy.
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: ":set number" }, programs)).resolves.toMatchObject({ allowed: false })];
            case 2:
                // The shell is still in the foreground, so the takeover is not accepted yet
                // and the input remains under Bash policy.
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toEqual({ mode: "bash" });
                return [4 /*yield*/, buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: "vim notes.md" }, programs)];
            case 3:
                _a.sent();
                // Now the host reports vim in the foreground: its protocol input passes
                // without being parsed as Bash.
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: ":set number" }, programs)).resolves.toMatchObject({ allowed: true })];
            case 4:
                // Now the host reports vim in the foreground: its protocol input passes
                // without being parsed as Bash.
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toMatchObject({
                    mode: "interactive_program",
                    program: "vim",
                    pid: 4242,
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_input", { id: "pane_a", text: "i some prose | with pipes", submit: true }, programs)).resolves.toMatchObject({ allowed: true })];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a confirmed program exit returns the pane to Bash command policy", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, programs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer({
                    foregroundProgram: foregroundSequence([
                        { program: "vim" },
                        { program: "bash" },
                    ]),
                });
                programs = { allow: [{ command: "vim" }] };
                return [4 /*yield*/, buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: "vim notes.md" }, programs)];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: ":wq" }, programs)).resolves.toMatchObject({ allowed: true })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toMatchObject({
                    mode: "interactive_program",
                });
                // The host now reports the shell again, which is the only accepted way back.
                // The dangerous command that follows is policed as Bash again.
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate({ mode: "blacklist", rules: [{ command: "rm" }] }, "interactive_terminal_send_line", { id: "pane_a", text: "rm -rf /" }, programs)).resolves.toMatchObject({ allowed: false, clearTerminal: true })];
            case 3:
                // The host now reports the shell again, which is the only accepted way back.
                // The dangerous command that follows is policed as Bash again.
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toEqual({ mode: "bash" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an unconfirmable foreground blocks interactive input instead of sending it raw", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, programs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer({
                    foregroundProgram: foregroundSequence([
                        { program: "vim" },
                        {
                            unsupported: "foreground process confirmation is unavailable on win32",
                        },
                    ]),
                });
                programs = { allow: [{ command: "vim" }] };
                return [4 /*yield*/, buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: "vim notes.md" }, programs)];
            case 1:
                _a.sent();
                return [4 /*yield*/, buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: ":w" }, programs)];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toMatchObject({
                    mode: "interactive_program",
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: ":wq" }, programs)).resolves.toMatchObject({
                        allowed: false,
                        clearTerminal: true,
                        diagnostics: [bun_test_1.expect.stringContaining("cannot be confirmed")],
                    })];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toEqual({ mode: "bash" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a host that cannot report the foreground never enters interactive mode", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, programs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer();
                programs = { allow: [{ command: "vim" }] };
                return [4 /*yield*/, buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: "vim notes.md" }, programs)];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: ":wq" }, programs)).resolves.toMatchObject({ allowed: false })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toEqual({ mode: "bash" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a module can narrow the authorized programs but never widen them", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, rules;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer({
                    foregroundProgram: foregroundSequence([{ program: "python3" }]),
                });
                rules = {
                    mode: "whitelist",
                    rules: [{ command: "vim" }, { command: "python3" }],
                };
                // The module allows python3, the profile only vim, so the intersection is
                // empty and no takeover happens.
                return [4 /*yield*/, buffer.evaluate(rules, "interactive_terminal_send_line", { id: "pane_a", text: "python3" }, [{ allow: [{ command: "vim" }] }, { allow: [{ command: "python3" }] }])];
            case 1:
                // The module allows python3, the profile only vim, so the intersection is
                // empty and no takeover happens.
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toEqual({ mode: "bash" });
                // With both layers allowing python3 the takeover is authorized.
                return [4 /*yield*/, buffer.evaluate(rules, "interactive_terminal_send_line", { id: "pane_a", text: "python3" }, [{ allow: [{ command: "python3" }] }, { allow: [{ command: "python3" }] }])];
            case 2:
                // With both layers allowing python3 the takeover is authorized.
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toMatchObject({
                    mode: "pending_program",
                    program: "python3",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("allowAny authorizes an unlisted simple launch after command policy", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, rules;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer({
                    foregroundProgram: foregroundSequence([{ program: "python3" }]),
                });
                rules = {
                    mode: "whitelist",
                    rules: [{ command: "python3" }],
                };
                return [4 /*yield*/, buffer.evaluate(rules, "interactive_terminal_send_line", { id: "pane_any", text: "python3 -q" }, { allowAny: true, allow: [] })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_any")).toMatchObject({
                    mode: "pending_program",
                    program: "python3",
                    launch: "python3 -q",
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(buffer.evaluate(rules, "interactive_terminal_send_line", { id: "pane_any", text: "print('ready')" }, { allowAny: true, allow: [] })).resolves.toMatchObject({ allowed: true })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_any")).toMatchObject({
                    mode: "interactive_program",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("allowAny works without enabling command rules", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer({
                    foregroundProgram: foregroundSequence([{ program: "python3" }]),
                });
                return [4 /*yield*/, buffer.evaluate(undefined, "interactive_terminal_send_line", { id: "pane_any", text: "python3" }, { allowAny: true, allow: [] })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_any")).toMatchObject({
                    mode: "pending_program",
                    program: "python3",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a module allowlist narrows a profile allowAny authorization", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, rules;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer({
                    foregroundProgram: foregroundSequence([{ program: "python3" }]),
                });
                rules = {
                    mode: "whitelist",
                    rules: [{ command: "python3" }, { command: "vim" }],
                };
                return [4 /*yield*/, buffer.evaluate(rules, "interactive_terminal_send_line", { id: "pane_any", text: "python3" }, [{ allowAny: true, allow: [] }, { allow: [{ command: "vim" }] }])];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_any")).toEqual({ mode: "bash" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("stopping a pane clears its interactive program mode", function () { return __awaiter(void 0, void 0, void 0, function () {
    var buffer, programs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                buffer = new tools_1.TerminalCommandBuffer({
                    foregroundProgram: foregroundSequence([{ program: "vim" }]),
                });
                programs = { allow: [{ command: "vim" }] };
                return [4 /*yield*/, buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: "vim notes.md" }, programs)];
            case 1:
                _a.sent();
                return [4 /*yield*/, buffer.evaluate(WHITELIST_WITH_VIM, "interactive_terminal_send_line", { id: "pane_a", text: ":w" }, programs)];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toMatchObject({
                    mode: "interactive_program",
                });
                buffer.clear("pane_a");
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toEqual({ mode: "bash" });
                buffer.clearAll();
                (0, bun_test_1.expect)(buffer.paneMode("pane_a")).toEqual({ mode: "bash" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("module path allow rules form a whitelist scope", function () {
    var rules = {
        files: {
            writePaths: [{ pattern: "docs/**", allow: true }],
            readPaths: [{ pattern: "docs/**", allow: true }],
        },
    };
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "write_file", { path: "docs/a.md" })).toMatchObject({ allowed: true });
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "write_file", { path: "src/a.ts" })).toMatchObject({
        allowed: false,
        reason: "path is outside the allowed module scope",
    });
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "read_file", { path: "docs/a.md" })).toMatchObject({ allowed: true });
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "read_file", { path: "README.md" })).toMatchObject({ allowed: false });
});
(0, bun_test_1.test)("deny path rules win over broad allow scopes", function () {
    var rules = {
        files: {
            writePaths: [
                { pattern: "docs/**", allow: true },
                { pattern: "docs/secrets/**", allow: false, reason: "protected" },
            ],
        },
    };
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "write_file", { path: "docs/a.md" })).toMatchObject({ allowed: true });
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "write_file", { path: "docs/secrets/key" })).toMatchObject({ allowed: false, reason: "protected" });
});
(0, bun_test_1.test)("mixed legacy deny-only rules keep deny semantics without a whitelist", function () {
    var rules = {
        files: {
            writePaths: [
                { pattern: "protected/*", allow: false, reason: "protected" },
            ],
        },
    };
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "write_file", {
        path: "protected/note.txt",
    })).toMatchObject({ allowed: false, reason: "protected" });
    (0, bun_test_1.expect)((0, tools_1.evaluatePermissionRules)(rules, "write_file", { path: "other/note.txt" })).toMatchObject({ allowed: true });
});
