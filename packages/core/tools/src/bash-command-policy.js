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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureBashCommandParser = ensureBashCommandParser;
exports.parseBashSimpleCommand = parseBashSimpleCommand;
exports.parseBashCommandRule = parseBashCommandRule;
exports.visitBashCommands = visitBashCommands;
exports.commandHasPrefix = commandHasPrefix;
var node_url_1 = require("node:url");
var web_tree_sitter_1 = require("web-tree-sitter");
var parserReady;
function ensureBashCommandParser() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getParser()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function parseBashSimpleCommand(source) {
    return __awaiter(this, void 0, void 0, function () {
        var parser, tree, root, statements, command, parts_1, name_1, tokens;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, getParser()];
                case 1:
                    parser = _c.sent();
                    tree = parser.parse(source);
                    if (!tree)
                        return [2 /*return*/, { ok: false, reason: "Bash parser did not produce an AST" }];
                    try {
                        root = tree.rootNode;
                        if (root.hasError)
                            return [2 /*return*/, {
                                    ok: false,
                                    reason: "Bash command contains incomplete or invalid syntax",
                                }];
                        statements = root.namedChildren.filter(isNode);
                        if (statements.length !== 1 || ((_a = statements[0]) === null || _a === void 0 ? void 0 : _a.type) !== "command")
                            return [2 /*return*/, {
                                    ok: false,
                                    reason: "only one simple Bash command is allowed",
                                }];
                        command = statements[0];
                        if (!command)
                            return [2 /*return*/, { ok: false, reason: "Bash command is empty" }];
                        parts_1 = command.namedChildren.filter(isNode);
                        name_1 = command.childForFieldName("name");
                        if (!name_1 || ((_b = parts_1[0]) === null || _b === void 0 ? void 0 : _b.type) !== "command_name")
                            return [2 /*return*/, {
                                    ok: false,
                                    reason: "Bash command must start with a program name",
                                }];
                        if (name_1.namedChildren.filter(isNode).length !== 1)
                            return [2 /*return*/, {
                                    ok: false,
                                    reason: "Bash command name contains unsupported syntax",
                                }];
                        if (parts_1.some(function (part) { return part !== parts_1[0] && part.type !== "word"; }))
                            return [2 /*return*/, {
                                    ok: false,
                                    reason: "Bash command contains unsupported syntax",
                                }];
                        if (parts_1
                            .slice(1)
                            .some(function (part) { return part.namedChildren.filter(isNode).length > 0; }))
                            return [2 /*return*/, {
                                    ok: false,
                                    reason: "Bash command contains unsupported syntax",
                                }];
                        tokens = parts_1.map(function (part) { return part.text; });
                        if (tokens.some(function (token) { return token.length === 0; }))
                            return [2 /*return*/, { ok: false, reason: "Bash command contains an empty token" }];
                        return [2 /*return*/, { ok: true, command: { tokens: tokens } }];
                    }
                    finally {
                        tree.delete();
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function parseBashCommandRule(rule) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, parseBashSimpleCommand(rule.command)];
        });
    });
}
/**
 * Visits every command / variable-assignment node in a Bash script, including
 * nodes nested inside compound commands, functions, subshells, pipelines and
 * command substitutions. The callback receives the raw node text; callers can
 * tokenize it for policy checks without needing the tree to outlive the walk.
 */
function visitBashCommands(source, visit) {
    return __awaiter(this, void 0, void 0, function () {
        var parser, tree, root, walk_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getParser()];
                case 1:
                    parser = _a.sent();
                    tree = parser.parse(source);
                    if (!tree)
                        return [2 /*return*/, { ok: false, reason: "Bash parser did not produce an AST" }];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 4, 5]);
                    root = tree.rootNode;
                    walk_1 = function (node) { return __awaiter(_this, void 0, void 0, function () {
                        var _i, _a, child;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    if (!(node.type === "command" || node.type === "variable_assignment")) return [3 /*break*/, 2];
                                    return [4 /*yield*/, visit(node.text, node.type)];
                                case 1:
                                    _b.sent();
                                    _b.label = 2;
                                case 2:
                                    _i = 0, _a = node.namedChildren.filter(isNode);
                                    _b.label = 3;
                                case 3:
                                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                                    child = _a[_i];
                                    return [4 /*yield*/, walk_1(child)];
                                case 4:
                                    _b.sent();
                                    _b.label = 5;
                                case 5:
                                    _i++;
                                    return [3 /*break*/, 3];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, walk_1(root)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, root.hasError
                            ? { ok: false, reason: "Bash command contains invalid syntax" }
                            : { ok: true }];
                case 4:
                    tree.delete();
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function commandHasPrefix(command, prefix) {
    return (prefix.tokens.length <= command.tokens.length &&
        prefix.tokens.every(function (token, index) { return command.tokens[index] === token; }));
}
function getParser() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            parserReady !== null && parserReady !== void 0 ? parserReady : (parserReady = createParser());
            return [2 /*return*/, parserReady];
        });
    });
}
function createParser() {
    return __awaiter(this, void 0, void 0, function () {
        var grammar, parser, selfCheck;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, web_tree_sitter_1.Parser.init()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, web_tree_sitter_1.Language.load((0, node_url_1.fileURLToPath)(import.meta.resolve("@vscode/tree-sitter-wasm/wasm/tree-sitter-bash.wasm")))];
                case 2:
                    grammar = _a.sent();
                    parser = new web_tree_sitter_1.Parser();
                    parser.setLanguage(grammar);
                    selfCheck = parser.parse("command true");
                    if (!selfCheck || selfCheck.rootNode.hasError) {
                        selfCheck === null || selfCheck === void 0 ? void 0 : selfCheck.delete();
                        parser.delete();
                        throw new Error("Bash Tree-sitter grammar self-check failed");
                    }
                    selfCheck.delete();
                    return [2 /*return*/, parser];
            }
        });
    });
}
function isNode(node) {
    return node !== null;
}
