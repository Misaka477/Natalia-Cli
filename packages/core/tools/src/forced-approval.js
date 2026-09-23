"use strict";
/**
 * Forced command approval policy.
 *
 * Some commands are always human-gated even when the session permission mode
 * is `auto`. The first policy of this kind is git write operations: they are
 * never granted for a session, and read-only mode still refuses them.
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiresForcedGitApproval = requiresForcedGitApproval;
exports.requiresForcedGitApprovalAst = requiresForcedGitApprovalAst;
var bash_command_policy_1 = require("./bash-command-policy");
var FORCED_GIT_SUBCOMMANDS = new Set([
    "commit",
    "push",
    "merge",
    "rebase",
    "reset",
    "cherry-pick",
    "revert",
    "clean",
]);
function stripShellQuotes(value) {
    // Wrapper commands often leave a quote attached to only one side of a word
    // (`bash -lc 'git commit'` makes the subcommand token `commit'`). Trim any
    // leading/trailing shell quote characters rather than requiring a balanced
    // pair so conservative detection still sees the subcommand.
    return value.replace(/^["'`]+|["'`]+$/gu, "");
}
function shellTokens(value) {
    var _a;
    return (_a = value.match(/(?:[^\s"'`]+|"[^"]*"|'[^']*')+/gu)) !== null && _a !== void 0 ? _a : [];
}
function gitSubcommand(tokens) {
    for (var index = 0; index < tokens.length; index += 1) {
        var token = stripShellQuotes(tokens[index]);
        if (token === "-C" ||
            token === "-c" ||
            token === "--git-dir" ||
            token === "--work-tree" ||
            token === "--namespace" ||
            token === "--exec-path") {
            index += 1;
            continue;
        }
        if (token.startsWith("--") && token.includes("="))
            continue;
        if (token.startsWith("-"))
            continue;
        return token;
    }
    return undefined;
}
function isForcedGitSubcommand(subcommand, tokens) {
    if (!subcommand)
        return false;
    if (FORCED_GIT_SUBCOMMANDS.has(subcommand))
        return true;
    if (subcommand === "branch") {
        var flags = tokens
            .slice(tokens.indexOf(subcommand) + 1)
            .map(stripShellQuotes);
        return (flags.includes("-D") ||
            (flags.includes("--delete") && flags.includes("--force")));
    }
    if (subcommand === "tag") {
        var flags = tokens
            .slice(tokens.indexOf(subcommand) + 1)
            .map(stripShellQuotes);
        return !flags.includes("-l") && !flags.includes("--list");
    }
    return false;
}
/**
 * Detects git write operations that must always enter interactive approval.
 *
 * The detector is intentionally conservative: command obfuscation or a missed
 * compound form can only cause a false approval prompt, not an unapproved git
 * write, because the runtime also applies this to terminal input paths.
 */
function requiresForcedGitApproval(commandText) {
    if (!commandText)
        return undefined;
    var matcher = /\bgit(?:\.exe)?\b/giu;
    var match;
    while ((match = matcher.exec(commandText))) {
        var rest = commandText.slice(match.index + match[0].length);
        var tokens = shellTokens(rest);
        var subcommand = gitSubcommand(tokens);
        if (isForcedGitSubcommand(subcommand, tokens))
            return {
                ruleID: "C-REL-001",
                subcommand: subcommand,
                reason: "git ".concat(subcommand),
            };
    }
    return undefined;
}
/**
 * AST-level detector.
 *
 * The regex detector still handles the common cases cheaply. This pass walks
 * every Bash command node and also resolves simple aliases / variable
 * assignments, so forms such as:
 *
 *   alias g=git; g commit
 *   g=git; $g commit
 *   foo() { git commit; }
 *
 * cannot hide a git write behind a command name that never contains "git".
 */
function requiresForcedGitApprovalAst(commandText) {
    return __awaiter(this, void 0, void 0, function () {
        var direct, aliases, variables, result;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!commandText)
                        return [2 /*return*/, undefined];
                    direct = requiresForcedGitApproval(commandText);
                    if (direct)
                        return [2 /*return*/, direct];
                    aliases = new Map();
                    variables = new Map();
                    return [4 /*yield*/, (0, bash_command_policy_1.visitBashCommands)(commandText, function (nodeText, nodeType) { return __awaiter(_this, void 0, void 0, function () {
                            var nodeApproval, tokens, _a, name_1, value, first, approval_1, approval_2, _b, name_2, value, _i, _c, token, _d, name_3, value, approval_3, commandIndex, target, targetName, replacement, rest, approval;
                            var _e, _f, _g;
                            return __generator(this, function (_h) {
                                switch (_h.label) {
                                    case 0:
                                        if (result)
                                            return [2 /*return*/];
                                        nodeApproval = requiresForcedGitApproval(nodeText);
                                        if (nodeApproval) {
                                            result = nodeApproval;
                                            return [2 /*return*/];
                                        }
                                        tokens = shellTokens(nodeText);
                                        if (!tokens.length)
                                            return [2 /*return*/];
                                        if (nodeType === "variable_assignment" && tokens.length === 1) {
                                            _a = splitAssignment(tokens[0]), name_1 = _a[0], value = _a[1];
                                            if (name_1 && value)
                                                variables.set(name_1, value);
                                            return [2 /*return*/];
                                        }
                                        first = stripShellQuotes(tokens[0]);
                                        if (!(["bash", "dash", "ksh", "sh", "zsh"].includes(first) &&
                                            ((_e = tokens[1]) === null || _e === void 0 ? void 0 : _e.startsWith("-")) &&
                                            tokens[1].includes("c") &&
                                            tokens[2])) return [3 /*break*/, 2];
                                        return [4 /*yield*/, requiresForcedGitApprovalAst(stripShellQuotes(tokens[2]))];
                                    case 1:
                                        approval_1 = _h.sent();
                                        if (approval_1)
                                            result = approval_1;
                                        return [2 /*return*/];
                                    case 2:
                                        if (!(first === "eval" && tokens[1])) return [3 /*break*/, 4];
                                        return [4 /*yield*/, requiresForcedGitApprovalAst(tokens.slice(1).map(stripShellQuotes).join(" "))];
                                    case 3:
                                        approval_2 = _h.sent();
                                        if (approval_2)
                                            result = approval_2;
                                        return [2 /*return*/];
                                    case 4:
                                        if (["declare", "export", "local", "readonly", "typeset"].includes(first) &&
                                            tokens[1]) {
                                            _b = splitAssignment(stripShellQuotes(tokens[1])), name_2 = _b[0], value = _b[1];
                                            if (name_2 && value)
                                                variables.set(name_2, value);
                                            return [2 /*return*/];
                                        }
                                        if (first === "alias") {
                                            for (_i = 0, _c = tokens.slice(1); _i < _c.length; _i++) {
                                                token = _c[_i];
                                                _d = splitAssignment(token), name_3 = _d[0], value = _d[1];
                                                if (!name_3 || !value)
                                                    continue;
                                                aliases.set(name_3, value);
                                                approval_3 = requiresForcedGitApproval(value);
                                                if (approval_3) {
                                                    result = approval_3;
                                                    return [2 /*return*/];
                                                }
                                            }
                                            return [2 /*return*/];
                                        }
                                        commandIndex = 0;
                                        if (first === "command" || first === "builtin")
                                            commandIndex = 1;
                                        target = stripShellQuotes((_f = tokens[commandIndex]) !== null && _f !== void 0 ? _f : "");
                                        targetName = target.startsWith("$") ? target.slice(1) : target;
                                        replacement = (_g = aliases.get(targetName)) !== null && _g !== void 0 ? _g : variables.get(targetName);
                                        if (!replacement)
                                            return [2 /*return*/];
                                        rest = tokens
                                            .slice(commandIndex + 1)
                                            .map(stripShellQuotes)
                                            .join(" ");
                                        approval = requiresForcedGitApproval(rest ? "".concat(replacement, " ").concat(rest) : replacement);
                                        if (approval)
                                            result = approval;
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, result];
            }
        });
    });
}
function splitAssignment(token) {
    var equals = token.indexOf("=");
    if (equals <= 0)
        return [undefined, undefined];
    var name = stripShellQuotes(token.slice(0, equals));
    var value = stripShellQuotes(token.slice(equals + 1));
    if (!name || !value || name.startsWith("-"))
        return [undefined, undefined];
    return [name, value];
}
