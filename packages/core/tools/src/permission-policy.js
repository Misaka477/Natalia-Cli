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
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _TerminalCommandBuffer_lines, _TerminalCommandBuffer_modes, _TerminalCommandBuffer_foreground;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalCommandBuffer = exports.createToolPolicyHookLayer = void 0;
exports.commandTextForTool = commandTextForTool;
exports.workspaceWritePathsForTool = workspaceWritePathsForTool;
exports.workspaceWritePathForTool = workspaceWritePathForTool;
exports.evaluatePermissionRules = evaluatePermissionRules;
exports.evaluatePermissionProfileCommandRules = evaluatePermissionProfileCommandRules;
var node_path_1 = require("node:path");
var bash_command_policy_1 = require("./bash-command-policy");
var tool_policy_1 = require("./tool-policy");
Object.defineProperty(exports, "createToolPolicyHookLayer", { enumerable: true, get: function () { return tool_policy_1.createToolPolicyHookLayer; } });
var TERMINAL_COMMAND_BUFFER_LIMIT = 16 * 1024;
/**
 * Tools that receive the command to run as an argument, so the command policy
 * reads `command`.
 */
var COMMAND_ARGUMENT_TOOLS = [
    "run_shell",
    "sandbox_execute",
    "sandbox_resource_start",
    "process_start",
    "background_start",
    "interactive_start",
    "interactive_terminal_start",
];
/**
 * Terminal input tools carry the command as terminal input instead of as a
 * command argument. They have to be checked by the same policy: otherwise a
 * model opens a shell once, which is checked, and then feeds every later
 * command through terminal input, which was not. Both the canonical names and
 * the registered aliases are listed because either name can be called.
 */
var TERMINAL_INPUT_TOOLS = [
    "interactive_terminal_write",
    "interactive_terminal_send_line",
    "interactive_terminal_keys",
    "interactive_terminal_input",
    "interactive_write",
    "interactive_send_line",
    "interactive_keys",
    "interactive_input",
];
/**
 * The command text a policy should judge for one tool call, or undefined when
 * the call carries no command. Shell and terminal paths deliberately share this
 * one function so a rule cannot hold on one path and be absent on the other.
 */
function commandTextForTool(toolName, args) {
    if (COMMAND_ARGUMENT_TOOLS.includes(toolName))
        return typeof args.command === "string" ? args.command : undefined;
    if (!TERMINAL_INPUT_TOOLS.includes(toolName))
        return undefined;
    return terminalInputText(args);
}
/**
 * Tools whose `path` argument names a file in the workspace that the call will
 * write. `sandbox_write` is absent on purpose: it writes inside a sandbox, not the
 * workspace. `sandbox_merge` is also absent because a merge does not name its
 * paths in its own arguments — `authorizeSandboxMerge` authorizes each merged path
 * individually and is the only place those paths are known.
 */
var WORKSPACE_WRITE_TOOLS = [
    "write_file",
    "edit_file",
    "apply_edits",
    "browser_screenshot",
];
/**
 * The workspace files one tool call will write, or an empty array when it
 * writes nothing there. `apply_edits` names every path in its structured edits;
 * the path-based write tools name a single `path`.
 *
 * Exported so the permission layer can evaluate each touched path, while
 * `workspaceWritePathForTool` keeps answering the single-path question the
 * write lock, constitution check and Work Graph writer ask.
 */
function workspaceWritePathsForTool(toolName, args) {
    if (toolName === "apply_edits") {
        var edits = Array.isArray(args.edits) ? args.edits : [];
        return edits.flatMap(function (entry) {
            if (!entry || typeof entry !== "object")
                return [];
            var path = entry.path;
            return typeof path === "string" && path.trim() ? [path] : [];
        });
    }
    if (!WORKSPACE_WRITE_TOOLS.includes(toolName))
        return [];
    return typeof args.path === "string" && args.path.trim() ? [args.path] : [];
}
/**
 * The workspace file one tool call will write, or undefined when the call writes
 * nothing there.
 *
 * Exported so the permission layer, the constitution check and the Work Graph
 * writer all answer "does this call change a workspace file, and which one?" from
 * one place. Three private copies of that list would drift, and the copy that
 * drifted would be the one enforcing policy.
 *
 * `apply_edits` can touch many files, so it reports the whole-workspace scope
 * `"."`: the write lock serialises it like any write, and the mutation registry
 * attributes any workspace change to it.
 */
function workspaceWritePathForTool(toolName, args) {
    var paths = workspaceWritePathsForTool(toolName, args);
    if (!paths.length)
        return undefined;
    if (toolName === "apply_edits")
        return ".";
    return paths[0];
}
/**
 * Key sequences are joined without a separator because a model can type a
 * command one key at a time, and only the reconstructed string shows what was
 * typed. Separate sources are joined by newline so they cannot merge into a
 * token that neither of them contained.
 */
function terminalInputText(args) {
    var segments = [];
    if (typeof args.text === "string")
        segments.push(args.text);
    if (typeof args.input === "string")
        segments.push(args.input);
    if (typeof args.key === "string")
        segments.push(args.key);
    if (Array.isArray(args.keys)) {
        var typed = [];
        for (var _i = 0, _a = args.keys; _i < _a.length; _i++) {
            var entry = _a[_i];
            if (typeof entry === "string") {
                typed.push(entry);
                continue;
            }
            if (!entry || typeof entry !== "object")
                continue;
            var key = entry;
            if (typeof key.text === "string")
                typed.push(key.text);
            else if (typeof key.key === "string")
                typed.push(key.key);
        }
        if (typed.length)
            segments.push(typed.join(""));
    }
    var text = segments.join("\n");
    return text.length ? text : undefined;
}
/**
 * File rules are written as workspace-relative patterns, but a tool resolves
 * its path against the workspace root before touching disk. `secret.txt` and
 * `./secret.txt` are therefore the same file, and matching the raw argument let
 * a rule be evaded by respelling the path. Paths are normalized to the same
 * workspace-relative POSIX form the tool will actually use.
 *
 * Both the normalized and the raw spelling are tested, so this can only ever
 * block more than before, never less.
 */
function policyPathCandidates(path, workspaceRoot) {
    var candidates = new Set([path]);
    var slashed = path.replace(/\\/gu, "/");
    candidates.add(slashed);
    if (workspaceRoot) {
        var absolute = (0, node_path_1.resolve)(workspaceRoot, path);
        var relativePath = (0, node_path_1.relative)((0, node_path_1.resolve)(workspaceRoot), absolute);
        // A path outside the workspace is matched by its absolute form. Tools
        // reject those anyway, but a rule must not silently stop applying.
        candidates.add(relativePath &&
            !relativePath.startsWith("..") &&
            !(0, node_path_1.isAbsolute)(relativePath)
            ? relativePath.replace(/\\/gu, "/")
            : absolute.replace(/\\/gu, "/"));
    }
    else {
        candidates.add((0, node_path_1.normalize)(slashed).replace(/\\/gu, "/"));
    }
    for (var _i = 0, _a = __spreadArray([], candidates, true); _i < _a.length; _i++) {
        var candidate = _a[_i];
        if (candidate.startsWith("./"))
            candidates.add(candidate.slice(2));
    }
    return __spreadArray([], candidates, true).filter(function (candidate) { return candidate.length > 0; });
}
function evaluateResourceRules(rules, path, workspaceRoot) {
    var _a;
    var candidates = policyPathCandidates(path, workspaceRoot);
    var matches = function (rule) {
        return candidates.some(function (candidate) { return pathMatch(candidate, rule.pattern); });
    };
    // Explicit and legacy implicit deny rules win even when a broad allow scope
    // also matches. This lets a module allow `src/**` while protecting secrets.
    var denied = rules.find(function (rule) { return rule.allow !== true && matches(rule); });
    if (denied)
        return {
            allowed: false,
            reason: (_a = denied.reason) !== null && _a !== void 0 ? _a : "path denied",
            diagnostics: [],
        };
    var allowRules = rules.filter(function (rule) { return rule.allow === true; });
    if (allowRules.length && !allowRules.some(matches))
        return {
            allowed: false,
            reason: "path is outside the allowed module scope",
            diagnostics: [],
        };
    return { allowed: true, diagnostics: [] };
}
function evaluatePermissionRules(rules, toolName, args, workspaceRoot) {
    var _a;
    var diags = [];
    if (!rules)
        return { allowed: true, diagnostics: diags };
    // Check tool allow/exclude
    if (rules.tools) {
        var allowP = compilePatterns(rules.tools.allow);
        var excludeP = compilePatterns(rules.tools.exclude);
        if (allowP.length && !allowP.some(function (p) { return p.test(toolName); })) {
            diags.push("tool \"".concat(toolName, "\" not in allow list"));
            return {
                allowed: false,
                reason: "tool blocked by policy",
                diagnostics: diags,
            };
        }
        if (excludeP.some(function (p) { return p.test(toolName); })) {
            diags.push("tool \"".concat(toolName, "\" in exclude list"));
            return {
                allowed: false,
                reason: "tool blocked by policy",
                diagnostics: diags,
            };
        }
    }
    var readsPath = ["read_file", "read_media_file", "glob", "grep"].includes(toolName);
    // `sandbox_write` and `sandbox_merge` stay in this check even though they are
    // not workspace writes: a sandbox path is still a path a profile may restrict,
    // and merge arrives here through `authorizeSandboxMerge` with a synthesized
    // per-path argument.
    var writePaths = workspaceWritePathsForTool(toolName, args);
    var writesPath = writePaths.length > 0 ||
        ["sandbox_write", "sandbox_merge"].includes(toolName);
    if (rules.files && (readsPath || writesPath)) {
        // A path-based write tool names a single `path`; `apply_edits` names every
        // path in its structured edit list; `sandbox_write` names a sandbox path
        // directly.
        var evaluatedWritePaths = writesPath && writePaths.length
            ? writePaths
            : typeof args.path === "string"
                ? [args.path]
                : [];
        var evaluatedReadPaths = readsPath && typeof args.path === "string" ? [args.path] : [];
        for (var _i = 0, _b = __spreadArray(__spreadArray([], evaluatedWritePaths, true), evaluatedReadPaths, true); _i < _b.length; _i++) {
            var path = _b[_i];
            if (writesPath && rules.files.writePaths) {
                var decision = evaluateResourceRules(rules.files.writePaths, path, workspaceRoot);
                if (!decision.allowed) {
                    diags.push("write to \"".concat(path, "\" blocked: ").concat(decision.reason));
                    return {
                        allowed: false,
                        reason: decision.reason,
                        diagnostics: diags,
                    };
                }
            }
            if (readsPath && rules.files.readPaths) {
                var decision = evaluateResourceRules(rules.files.readPaths, path, workspaceRoot);
                if (!decision.allowed) {
                    diags.push("read of \"".concat(path, "\" blocked: ").concat(decision.reason));
                    return {
                        allowed: false,
                        reason: decision.reason,
                        diagnostics: diags,
                    };
                }
            }
        }
    }
    if (rules.commands) {
        var cmd = commandTextForTool(toolName, args);
        if (cmd) {
            var denied = matchesCommandPatterns(cmd, rules.commands.denyPatterns);
            if (denied.error) {
                diags.push("invalid command deny pattern: ".concat(denied.error));
                return {
                    allowed: false,
                    reason: "command policy configuration is invalid",
                    diagnostics: diags,
                };
            }
            if (denied.matches) {
                diags.push("command matches deny pattern");
                return {
                    allowed: false,
                    reason: "command blocked by policy",
                    diagnostics: diags,
                };
            }
            var allowed = matchesCommandPatterns(cmd, rules.commands.allowPatterns);
            if (allowed.error) {
                diags.push("invalid command allow pattern: ".concat(allowed.error));
                return {
                    allowed: false,
                    reason: "command policy configuration is invalid",
                    diagnostics: diags,
                };
            }
            if (((_a = rules.commands.allowPatterns) === null || _a === void 0 ? void 0 : _a.length) && !allowed.matches) {
                diags.push("command does not match any allow pattern");
                return {
                    allowed: false,
                    reason: "command blocked by policy",
                    diagnostics: diags,
                };
            }
        }
    }
    return { allowed: true, diagnostics: diags };
}
/**
 * Applies the structured command rules written by permission-profile editing.
 * Legacy regular-expression rules remain in `evaluatePermissionRules` for
 * compatibility and are deliberately evaluated before this profile layer.
 */
function evaluatePermissionProfileCommandRules(rules_1, toolName_1, args_1) {
    return __awaiter(this, arguments, void 0, function (rules, toolName, args, scope) {
        var diagnostics, source, command, parsedRules, invalidRule, matched;
        var _this = this;
        if (scope === void 0) { scope = "profile"; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    diagnostics = [];
                    if (!rules || rules.mode === "none")
                        return [2 /*return*/, { allowed: true, diagnostics: diagnostics }];
                    source = commandTextForTool(toolName, args);
                    if (!source)
                        return [2 /*return*/, { allowed: true, diagnostics: diagnostics }];
                    return [4 /*yield*/, (0, bash_command_policy_1.parseBashSimpleCommand)(source)];
                case 1:
                    command = _a.sent();
                    if (!command.ok)
                        return [2 /*return*/, {
                                allowed: false,
                                reason: "command blocked by policy",
                                diagnostics: ["command could not be parsed safely: ".concat(command.reason)],
                            }];
                    return [4 /*yield*/, Promise.all(rules.rules.map(function (rule) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _a = {
                                            rule: rule
                                        };
                                        return [4 /*yield*/, (0, bash_command_policy_1.parseBashCommandRule)(rule)];
                                    case 1: return [2 /*return*/, (_a.parsed = _b.sent(),
                                            _a)];
                                }
                            });
                        }); }))];
                case 2:
                    parsedRules = _a.sent();
                    invalidRule = parsedRules.find(function (_a) {
                        var parsed = _a.parsed;
                        return !parsed.ok;
                    });
                    if (invalidRule)
                        return [2 /*return*/, {
                                allowed: false,
                                reason: "command policy configuration is invalid",
                                diagnostics: [
                                    "invalid ".concat(scope, " command rule \"").concat(invalidRule.rule.command, "\": ").concat(parseFailureReason(invalidRule.parsed)),
                                ],
                            }];
                    matched = parsedRules.find(function (_a) {
                        var parsed = _a.parsed;
                        return parsed.ok && (0, bash_command_policy_1.commandHasPrefix)(command.command, parsed.command);
                    });
                    if (rules.mode === "blacklist" && matched)
                        return [2 /*return*/, {
                                allowed: false,
                                reason: "command blocked by policy",
                                diagnostics: [
                                    "command matches ".concat(scope, " deny rule \"").concat(matched.rule.command, "\"").concat(matched.rule.reason ? ": ".concat(matched.rule.reason) : ""),
                                ],
                            }];
                    if (rules.mode === "whitelist" && !matched)
                        return [2 /*return*/, {
                                allowed: false,
                                reason: "command blocked by policy",
                                diagnostics: ["command does not match any ".concat(scope, " allow rule")],
                            }];
                    return [2 /*return*/, { allowed: true, diagnostics: diagnostics }];
            }
        });
    });
}
/** Keeps one unsubmitted Bash line per managed pane for structured profiles. */
var TerminalCommandBuffer = /** @class */ (function () {
    function TerminalCommandBuffer(options) {
        if (options === void 0) { options = {}; }
        _TerminalCommandBuffer_lines.set(this, new Map());
        _TerminalCommandBuffer_modes.set(this, new Map());
        _TerminalCommandBuffer_foreground.set(this, void 0);
        __classPrivateFieldSet(this, _TerminalCommandBuffer_foreground, options.foregroundProgram, "f");
    }
    TerminalCommandBuffer.prototype.clear = function (id) {
        __classPrivateFieldGet(this, _TerminalCommandBuffer_lines, "f").delete(id);
        __classPrivateFieldGet(this, _TerminalCommandBuffer_modes, "f").delete(id);
    };
    TerminalCommandBuffer.prototype.clearAll = function () {
        __classPrivateFieldGet(this, _TerminalCommandBuffer_lines, "f").clear();
        __classPrivateFieldGet(this, _TerminalCommandBuffer_modes, "f").clear();
    };
    TerminalCommandBuffer.prototype.paneMode = function (id) {
        var _a;
        return (_a = __classPrivateFieldGet(this, _TerminalCommandBuffer_modes, "f").get(id)) !== null && _a !== void 0 ? _a : { mode: "bash" };
    };
    TerminalCommandBuffer.prototype.evaluate = function (rules_1, toolName_1, args_1) {
        return __awaiter(this, arguments, void 0, function (rules, toolName, args, interactivePrograms) {
            var activeRules, authorizedPrograms, input, resolved, line, _i, _a, _b, index, rules_2, check, launch;
            var _c;
            if (interactivePrograms === void 0) { interactivePrograms = undefined; }
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        activeRules = (Array.isArray(rules) ? rules : [rules]).filter(function (rule) {
                            return Boolean(rule) && rule.mode !== "none";
                        });
                        authorizedPrograms = interactiveProgramAuthorization(interactivePrograms);
                        if (!activeRules.length &&
                            !authorizedPrograms.allowAny &&
                            !authorizedPrograms.allow.length)
                            return [2 /*return*/, undefined];
                        input = terminalCommandInput(toolName, args);
                        if (!input)
                            return [2 /*return*/, undefined];
                        if (!input.id)
                            return [2 /*return*/, denyTerminalBuffer("terminal command policy requires a pane id")];
                        return [4 /*yield*/, this.resolvePaneMode(input.id, authorizedPrograms)];
                    case 1:
                        resolved = _d.sent();
                        if (resolved)
                            return [2 /*return*/, resolved];
                        if (this.paneMode(input.id).mode === "interactive_program") {
                            // The authorized program owns the pane, so its input follows the program's
                            // own protocol rather than Bash syntax. Nothing is buffered or parsed.
                            __classPrivateFieldGet(this, _TerminalCommandBuffer_lines, "f").delete(input.id);
                            return [2 /*return*/, { allowed: true, diagnostics: [] }];
                        }
                        if (input.unsupported) {
                            this.clear(input.id);
                            return [2 /*return*/, denyTerminalBuffer(input.unsupported, true)];
                        }
                        line = "".concat((_c = __classPrivateFieldGet(this, _TerminalCommandBuffer_lines, "f").get(input.id)) !== null && _c !== void 0 ? _c : "").concat(input.text);
                        if (new TextEncoder().encode(line).byteLength > TERMINAL_COMMAND_BUFFER_LIMIT) {
                            this.clear(input.id);
                            return [2 /*return*/, denyTerminalBuffer("terminal command buffer exceeded ".concat(TERMINAL_COMMAND_BUFFER_LIMIT, " bytes"), true)];
                        }
                        if (!input.submit) {
                            __classPrivateFieldGet(this, _TerminalCommandBuffer_lines, "f").set(input.id, line);
                            return [2 /*return*/, { allowed: true, diagnostics: [] }];
                        }
                        __classPrivateFieldGet(this, _TerminalCommandBuffer_lines, "f").delete(input.id);
                        _i = 0, _a = activeRules.entries();
                        _d.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        _b = _a[_i], index = _b[0], rules_2 = _b[1];
                        return [4 /*yield*/, evaluatePermissionProfileCommandRules(rules_2, "run_shell", { command: line }, index === 0 ? "profile" : "active module")];
                    case 3:
                        check = _d.sent();
                        if (!check.allowed)
                            return [2 /*return*/, __assign(__assign({}, check), { clearTerminal: true })];
                        _d.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, authorizedLaunch(line, authorizedPrograms)];
                    case 6:
                        launch = _d.sent();
                        if (launch)
                            __classPrivateFieldGet(this, _TerminalCommandBuffer_modes, "f").set(input.id, {
                                mode: "pending_program",
                                program: launch.program,
                                launch: launch.launch,
                            });
                        return [2 /*return*/, { allowed: true, diagnostics: [] }];
                }
            });
        });
    };
    /**
     * Confirms or retires the pane's interactive-program mode before any input is
     * considered. Returns a denial when the mode exists but cannot be confirmed.
     */
    TerminalCommandBuffer.prototype.resolvePaneMode = function (paneID, authorizedPrograms) {
        return __awaiter(this, void 0, void 0, function () {
            var current, probe;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        current = __classPrivateFieldGet(this, _TerminalCommandBuffer_modes, "f").get(paneID);
                        if (!current || current.mode === "bash")
                            return [2 /*return*/, undefined];
                        if (!authorizedPrograms.allowAny && !authorizedPrograms.allow.length) {
                            // The authorization disappeared, for example on a module switch.
                            __classPrivateFieldGet(this, _TerminalCommandBuffer_modes, "f").delete(paneID);
                            return [2 /*return*/, undefined];
                        }
                        if (!__classPrivateFieldGet(this, _TerminalCommandBuffer_foreground, "f")) {
                            __classPrivateFieldGet(this, _TerminalCommandBuffer_modes, "f").delete(paneID);
                            return [2 /*return*/, current.mode === "interactive_program"
                                    ? denyTerminalBuffer("interactive program ".concat(current.program, " cannot be confirmed on this host"), true)
                                    : undefined];
                        }
                        return [4 /*yield*/, __classPrivateFieldGet(this, _TerminalCommandBuffer_foreground, "f").call(this, paneID)];
                    case 1:
                        probe = _a.sent();
                        if (!probe.supported) {
                            __classPrivateFieldGet(this, _TerminalCommandBuffer_modes, "f").delete(paneID);
                            return [2 /*return*/, current.mode === "interactive_program"
                                    ? denyTerminalBuffer("interactive program ".concat(current.program, " cannot be confirmed: ").concat(probe.reason), true)
                                    : undefined];
                        }
                        if (probe.process && programMatches(probe.process.name, current.program)) {
                            __classPrivateFieldGet(this, _TerminalCommandBuffer_modes, "f").set(paneID, {
                                mode: "interactive_program",
                                program: current.program,
                                launch: current.launch,
                                pid: probe.process.pid,
                            });
                            return [2 /*return*/, undefined];
                        }
                        // The operating system confirms the program is no longer in the foreground,
                        // which is the only accepted way to return to Bash policy.
                        __classPrivateFieldGet(this, _TerminalCommandBuffer_modes, "f").delete(paneID);
                        return [2 /*return*/, undefined];
                }
            });
        });
    };
    return TerminalCommandBuffer;
}());
exports.TerminalCommandBuffer = TerminalCommandBuffer;
_TerminalCommandBuffer_lines = new WeakMap(), _TerminalCommandBuffer_modes = new WeakMap(), _TerminalCommandBuffer_foreground = new WeakMap();
function interactiveProgramAuthorization(input) {
    var groups = (Array.isArray(input) ? input : [input]).filter(function (group) { var _a; return Boolean(group && (group.allowAny || ((_a = group.allow) === null || _a === void 0 ? void 0 : _a.length))); });
    if (!groups.length)
        return { allowAny: false, allow: [] };
    // A module can only narrow the profile, never widen it, so an interactive
    // program must be allowed by every configured layer.
    return groups.reduce(function (effective, group, index) {
        if (index === 0)
            return { allowAny: group.allowAny === true, allow: group.allow };
        if (effective.allowAny)
            return { allowAny: group.allowAny === true, allow: group.allow };
        if (group.allowAny)
            return effective;
        return {
            allowAny: false,
            allow: effective.allow.filter(function (rule) {
                return group.allow.some(function (other) { return other.command === rule.command; });
            }),
        };
    }, { allowAny: false, allow: [] });
}
function authorizedLaunch(line, authorization) {
    return __awaiter(this, void 0, void 0, function () {
        var command, executable, _i, _a, rule, parsed, program;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!authorization.allowAny && !authorization.allow.length)
                        return [2 /*return*/, undefined];
                    return [4 /*yield*/, (0, bash_command_policy_1.parseBashSimpleCommand)(line)];
                case 1:
                    command = _d.sent();
                    if (!command.ok)
                        return [2 /*return*/, undefined];
                    if (authorization.allowAny) {
                        executable = command.command.tokens[0];
                        return [2 /*return*/, {
                                program: (_b = executable.split("/").pop()) !== null && _b !== void 0 ? _b : executable,
                                launch: line,
                            }];
                    }
                    _i = 0, _a = authorization.allow;
                    _d.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    rule = _a[_i];
                    return [4 /*yield*/, (0, bash_command_policy_1.parseBashCommandRule)(rule)];
                case 3:
                    parsed = _d.sent();
                    if (!parsed.ok)
                        return [3 /*break*/, 4];
                    if (!(0, bash_command_policy_1.commandHasPrefix)(command.command, parsed.command))
                        return [3 /*break*/, 4];
                    program = parsed.command.tokens[0];
                    return [2 /*return*/, {
                            program: (_c = program.split("/").pop()) !== null && _c !== void 0 ? _c : program,
                            launch: rule.command,
                        }];
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, undefined];
            }
        });
    });
}
function programMatches(foreground, program) {
    return foreground === program || foreground === program.slice(0, 15);
}
function denyTerminalBuffer(diagnostic, clearTerminal) {
    if (clearTerminal === void 0) { clearTerminal = false; }
    return {
        allowed: false,
        reason: "command blocked by policy",
        diagnostics: [diagnostic],
        clearTerminal: clearTerminal,
    };
}
function terminalCommandInput(toolName, args) {
    if (!TERMINAL_INPUT_TOOLS.includes(toolName))
        return undefined;
    var id = typeof args.id === "string" ? args.id : undefined;
    if (toolName === "interactive_terminal_send_line" ||
        toolName === "interactive_send_line")
        return terminalCommandText(id, args.text, true);
    if (toolName === "interactive_terminal_write" ||
        toolName === "interactive_write")
        return terminalCommandText(id, args.input, false);
    if (toolName === "interactive_terminal_input" ||
        toolName === "interactive_input") {
        if (args.paste)
            return {
                id: id,
                text: "",
                submit: false,
                unsupported: "terminal paste is not allowed while command rules are active",
            };
        if (typeof args.text === "string")
            return terminalCommandText(id, args.text, args.submit !== false);
    }
    return terminalCommandKeys(id, args);
}
function terminalCommandText(id, value, submit) {
    if (typeof value !== "string")
        return {
            id: id,
            text: "",
            submit: false,
            unsupported: "terminal command input must be text",
        };
    if (/\r|\n/u.test(value))
        return {
            id: id,
            text: "",
            submit: false,
            unsupported: "terminal command input cannot contain a newline while command rules are active",
        };
    return { id: id, text: value, submit: submit };
}
function terminalCommandKeys(id, args) {
    var entries = Array.isArray(args.keys)
        ? args.keys
        : args.key === undefined
            ? []
            : [{ key: args.key, modifiers: args.modifiers }];
    var text = "";
    var submit = false;
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var entry = entries_1[_i];
        if (!entry || typeof entry !== "object")
            return {
                id: id,
                text: "",
                submit: false,
                unsupported: "terminal command keys must be structured entries",
            };
        var key = entry;
        if (Array.isArray(key.modifiers) && key.modifiers.length)
            return {
                id: id,
                text: "",
                submit: false,
                unsupported: "terminal modified keys are not allowed while command rules are active",
            };
        if (typeof key.text === "string") {
            if (/\r|\n/u.test(key.text))
                return {
                    id: id,
                    text: "",
                    submit: false,
                    unsupported: "terminal command input cannot contain a newline while command rules are active",
                };
            text += key.text;
            continue;
        }
        if (key.key === "Enter" || key.key === "return") {
            submit = true;
            continue;
        }
        if (typeof key.key === "string" && Array.from(key.key).length === 1) {
            text += key.key;
            continue;
        }
        return {
            id: id,
            text: "",
            submit: false,
            unsupported: "terminal control keys are not allowed while command rules are active",
        };
    }
    return { id: id, text: text, submit: submit };
}
function parseFailureReason(result) {
    return result.ok ? "unknown parser failure" : result.reason;
}
function pathMatch(path, pattern) {
    var escaped = pattern
        .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
        .replace(/\\\*/gu, ".*");
    return new RegExp("^".concat(escaped, "$"), "u").test(path);
}
function matchesCommandPatterns(command, patterns) {
    var _a;
    try {
        return {
            matches: (_a = patterns === null || patterns === void 0 ? void 0 : patterns.some(function (pattern) { return new RegExp(pattern, "iu").test(command); })) !== null && _a !== void 0 ? _a : false,
        };
    }
    catch (error) {
        return {
            matches: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
function compilePatterns(patterns) {
    if (!patterns || patterns.length === 0)
        return [];
    return patterns.map(function (p) {
        var escaped = p
            .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
            .replace(/\\\*/gu, ".*");
        return new RegExp("^".concat(escaped, "$"), "u");
    });
}
