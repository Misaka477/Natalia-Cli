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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NATALIA_IGNORE_CONTENT = exports.DEFAULT_NATALIA_IGNORE_PATTERNS = exports.NATALIA_IGNORE_FILE = void 0;
exports.parseSnapshotIgnoreLine = parseSnapshotIgnoreLine;
exports.parseSnapshotIgnore = parseSnapshotIgnore;
exports.isSnapshotIgnored = isSnapshotIgnored;
exports.loadNataliaIgnore = loadNataliaIgnore;
exports.ensureNataliaIgnoreFile = ensureNataliaIgnoreFile;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
/** Workspace-root snapshot ignore file. It never participates in access policy. */
exports.NATALIA_IGNORE_FILE = ".nataliaignore";
/**
 * Default snapshot ignores. These are intentionally about build/runtime bulk,
 * not about hiding files from the UI or model tools.
 */
exports.DEFAULT_NATALIA_IGNORE_PATTERNS = [
    ".git/",
    ".natalia/",
    "node_modules/",
    "dist/",
    "build/",
    "target/",
    "coverage/",
    "__pycache__/",
    ".next/",
    ".turbo/",
    "*.log",
    "*.tmp",
    "*.swp",
];
exports.DEFAULT_NATALIA_IGNORE_CONTENT = "".concat(__spreadArray(__spreadArray([
    "# Natalia snapshot ignore",
    "# Used by checkpoint and sandbox only.",
    "# This file does not affect file visibility, reading, writing, search,",
    "# or model tool access.",
    ""
], exports.DEFAULT_NATALIA_IGNORE_PATTERNS, true), [
    "",
], false).join("\n"));
function normalizeIgnorePath(path) {
    return path.split(/[\\/]/u).join("/");
}
function parseSnapshotIgnoreLine(line, base) {
    if (base === void 0) { base = ""; }
    var value = line.trimEnd();
    if (!value || value.startsWith("#"))
        return;
    var negated = value.startsWith("!") && !value.startsWith("\\!");
    var rawPattern = (negated ? value.slice(1) : value).replace(/^\\([#!])/u, "$1");
    var directoryOnly = rawPattern.endsWith("/");
    var anchored = rawPattern.startsWith("/");
    var pattern = rawPattern.replace(/^\//u, "").replace(/\/$/u, "");
    if (!pattern)
        return;
    var body = globExpression(pattern);
    var prefix = anchored || pattern.includes("/") ? "^" : "^(?:.*/)?";
    return {
        base: base,
        directoryOnly: directoryOnly,
        negated: negated,
        pattern: new RegExp("".concat(prefix).concat(body, "(?:/.*)?$"), "u"),
    };
}
function parseSnapshotIgnore(contents, base) {
    if (base === void 0) { base = ""; }
    var rules = [];
    for (var _i = 0, _a = contents.split(/\r?\n/u); _i < _a.length; _i++) {
        var line = _a[_i];
        var rule = parseSnapshotIgnoreLine(line, base);
        if (rule)
            rules.push(rule);
    }
    return rules;
}
/**
 * Gitignore-style decision. `allowedIgnoredPaths` is only for structural
 * self-exclusions and exact trusted paths, never for normal file access.
 */
function isSnapshotIgnored(path, directory, rules, allowedIgnoredPaths) {
    var normalized = normalizeIgnorePath(path);
    if (allowedIgnoredPaths === null || allowedIgnoredPaths === void 0 ? void 0 : allowedIgnoredPaths.has(normalized))
        return false;
    return rules.reduce(function (ignored, rule) {
        if (rule.base &&
            normalized !== rule.base &&
            !normalized.startsWith("".concat(rule.base, "/")))
            return ignored;
        var relativePath = normalized.slice(rule.base.length).replace(/^\//u, "");
        if (!relativePath ||
            (rule.directoryOnly && !directory && !relativePath.includes("/")))
            return ignored;
        if (!rule.pattern.test(relativePath))
            return ignored;
        return !rule.negated;
    }, false);
}
function loadNataliaIgnore(workspaceRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var path, contents, patterns, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    path = (0, node_path_1.resolve)(workspaceRoot, exports.NATALIA_IGNORE_FILE);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 2:
                    contents = _a.sent();
                    patterns = contents
                        .split(/\r?\n/u)
                        .map(function (line) { return line.trim(); })
                        .filter(function (line) { return line && !line.startsWith("#"); });
                    return [2 /*return*/, {
                            path: path,
                            exists: true,
                            patterns: patterns,
                            rules: parseSnapshotIgnore(contents),
                        }];
                case 3:
                    error_1 = _a.sent();
                    if (error_1.code !== "ENOENT")
                        throw error_1;
                    return [2 /*return*/, { path: path, exists: false, patterns: [], rules: [] }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Creates the default `.nataliaignore` when absent. Existing files are never
 * overwritten; `migratedPatterns` is used only for the one-time
 * `checkpoint.ignore` migration.
 */
function ensureNataliaIgnoreFile(workspaceRoot_1) {
    return __awaiter(this, arguments, void 0, function (workspaceRoot, migratedPatterns) {
        var path, error_2, lines, migrated;
        if (migratedPatterns === void 0) { migratedPatterns = []; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    path = (0, node_path_1.resolve)(workspaceRoot, exports.NATALIA_IGNORE_FILE);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                case 2:
                    _a.sent();
                    return [2 /*return*/, { path: path, created: false }];
                case 3:
                    error_2 = _a.sent();
                    if (error_2.code !== "ENOENT")
                        throw error_2;
                    return [3 /*break*/, 4];
                case 4:
                    lines = __spreadArray([
                        "# Natalia snapshot ignore",
                        "# Used by checkpoint and sandbox only.",
                        "# This file does not affect file visibility, reading, writing, search,",
                        "# or model tool access.",
                        ""
                    ], exports.DEFAULT_NATALIA_IGNORE_PATTERNS, true);
                    migrated = migratedPatterns
                        .map(function (pattern) { return pattern.trim(); })
                        .filter(Boolean);
                    if (migrated.length) {
                        lines.push.apply(lines, __spreadArray(["", "# Migrated from checkpoint.ignore"], migrated, false));
                    }
                    lines.push("");
                    return [4 /*yield*/, (0, promises_1.writeFile)(path, "".concat(lines.join("\n"), "\n"), { mode: 384 })];
                case 5:
                    _a.sent();
                    return [2 /*return*/, { path: path, created: true }];
            }
        });
    });
}
function globExpression(pattern) {
    var expression = "";
    for (var index = 0; index < pattern.length; index++) {
        var character = pattern[index];
        var next = pattern[index + 1];
        if (character === "*" && next === "*") {
            index++;
            if (pattern[index + 1] === "/") {
                index++;
                expression += "(?:.*/)?";
                continue;
            }
            expression += ".*";
            continue;
        }
        if (character === "*") {
            expression += "[^/]*";
            continue;
        }
        if (character === "?") {
            expression += "[^/]";
            continue;
        }
        expression += character.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
    }
    return expression;
}
