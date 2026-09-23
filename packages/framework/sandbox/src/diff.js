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
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffText = diffText;
exports.unifiedPatchToStructured = unifiedPatchToStructured;
exports.diffTextAsync = diffTextAsync;
function diffText(path, oldText, newText) {
    var before = oldText !== null && oldText !== void 0 ? oldText : "";
    var after = newText !== null && newText !== void 0 ? newText : "";
    var a = before.endsWith("\n")
        ? before.slice(0, -1).split("\n")
        : before
            ? before.split("\n")
            : [];
    var b = after.endsWith("\n")
        ? after.slice(0, -1).split("\n")
        : after
            ? after.split("\n")
            : [];
    if (a.length === 0 && b.length === 0)
        return { additions: 0, deletions: 0 };
    var ops = diffLineOps(a, b);
    var additions = 0;
    var deletions = 0;
    for (var _i = 0, ops_1 = ops; _i < ops_1.length; _i++) {
        var op = ops_1[_i];
        if (op.type === "insert")
            additions++;
        if (op.type === "delete")
            deletions++;
    }
    if (additions === 0 && deletions === 0)
        return { additions: 0, deletions: 0 };
    return {
        additions: additions,
        deletions: deletions,
        patch: renderUnifiedPatch(path, ops),
    };
}
function renderUnifiedPatch(path, ops) {
    var entries = [];
    var oldLine = 1;
    var newLine = 1;
    for (var _i = 0, ops_2 = ops; _i < ops_2.length; _i++) {
        var op = ops_2[_i];
        entries.push({ op: op, oldLine: oldLine, newLine: newLine });
        if (op.type !== "insert")
            oldLine++;
        if (op.type !== "delete")
            newLine++;
    }
    var changeIndexes = entries.flatMap(function (entry, index) {
        return entry.op.type === "equal" ? [] : [index];
    });
    if (!changeIndexes.length)
        return "";
    var context = 3;
    var ranges = [];
    for (var _a = 0, changeIndexes_1 = changeIndexes; _a < changeIndexes_1.length; _a++) {
        var index = changeIndexes_1[_a];
        var start = Math.max(0, index - context);
        var end = Math.min(entries.length - 1, index + context);
        var last = ranges.at(-1);
        if (last && start <= last[1] + 1)
            last[1] = Math.max(last[1], end);
        else
            ranges.push([start, end]);
    }
    var lines = ["--- a/".concat(path), "+++ b/".concat(path)];
    for (var _b = 0, ranges_1 = ranges; _b < ranges_1.length; _b++) {
        var _c = ranges_1[_b], start = _c[0], end = _c[1];
        var first = entries[start];
        var slice = entries.slice(start, end + 1);
        var oldCount = slice.filter(function (entry) { return entry.op.type !== "insert"; }).length;
        var newCount = slice.filter(function (entry) { return entry.op.type !== "delete"; }).length;
        lines.push("@@ -".concat(first.oldLine, ",").concat(oldCount, " +").concat(first.newLine, ",").concat(newCount, " @@"));
        for (var _d = 0, slice_1 = slice; _d < slice_1.length; _d++) {
            var entry = slice_1[_d];
            if (entry.op.type === "insert")
                lines.push("+".concat(entry.op.text));
            else if (entry.op.type === "delete")
                lines.push("-".concat(entry.op.text));
            else
                lines.push(" ".concat(entry.op.text));
        }
    }
    return lines.join("\n") + "\n";
}
function unifiedPatchToStructured(patch) {
    var _a, _b;
    var hunks = [];
    var oldLine = 0;
    var newLine = 0;
    var additions = 0;
    var deletions = 0;
    var inHunk = false;
    var current;
    for (var _i = 0, _c = patch.split("\n"); _i < _c.length; _i++) {
        var raw = _c[_i];
        if (raw.startsWith("diff --git")) {
            inHunk = false;
            current = undefined;
            continue;
        }
        if (raw.startsWith("@@")) {
            var match = raw.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u);
            if (match) {
                var oldStart = Number(match[1]);
                var oldCount = Number((_a = match[2]) !== null && _a !== void 0 ? _a : 1);
                var newStart = Number(match[3]);
                var newCount = Number((_b = match[4]) !== null && _b !== void 0 ? _b : 1);
                oldLine = oldStart;
                newLine = newStart;
                inHunk = true;
                current = {
                    oldStart: oldStart,
                    oldCount: oldCount,
                    newStart: newStart,
                    newCount: newCount,
                    lines: [],
                };
                hunks.push(current);
            }
            continue;
        }
        if (!inHunk || !current)
            continue;
        if (raw.startsWith("---") || raw.startsWith("+++") || raw.startsWith("\\"))
            continue;
        if (raw.startsWith("+")) {
            current.lines.push({
                type: "add",
                text: raw.slice(1),
                oldLineNumber: null,
                newLineNumber: newLine++,
            });
            additions++;
        }
        else if (raw.startsWith("-")) {
            current.lines.push({
                type: "delete",
                text: raw.slice(1),
                oldLineNumber: oldLine++,
                newLineNumber: null,
            });
            deletions++;
        }
        else if (raw.startsWith(" ")) {
            current.lines.push({
                type: "context",
                text: raw.slice(1),
                oldLineNumber: oldLine++,
                newLineNumber: newLine++,
            });
        }
    }
    return { hunks: hunks, additions: additions, deletions: deletions };
}
function renderStructuredPatch(diff) {
    if (!diff.hunks.length)
        return "";
    var lines = [];
    for (var _i = 0, _a = diff.hunks; _i < _a.length; _i++) {
        var hunk = _a[_i];
        lines.push("@@ -".concat(hunk.oldStart, ",").concat(hunk.oldCount, " +").concat(hunk.newStart, ",").concat(hunk.newCount, " @@"));
        for (var _b = 0, _c = hunk.lines; _b < _c.length; _b++) {
            var line = _c[_b];
            if (line.type === "add")
                lines.push("+".concat(line.text));
            else if (line.type === "delete")
                lines.push("-".concat(line.text));
            else
                lines.push(" ".concat(line.text));
        }
    }
    return lines.join("\n") + "\n";
}
function diffLineOps(a, b) {
    var maxLines = 2000;
    if (a.length > maxLines || b.length > maxLines) {
        var ops_3 = [];
        for (var _i = 0, a_1 = a; _i < a_1.length; _i++) {
            var line = a_1[_i];
            ops_3.push({ type: "delete", text: line });
        }
        for (var _a = 0, b_1 = b; _a < b_1.length; _a++) {
            var line = b_1[_a];
            ops_3.push({ type: "insert", text: line });
        }
        return ops_3;
    }
    var n = a.length;
    var m = b.length;
    var dp = Array.from({ length: n + 1 }, function () {
        return new Array(m + 1).fill(0);
    });
    for (var i_1 = n - 1; i_1 >= 0; i_1--) {
        for (var j_1 = m - 1; j_1 >= 0; j_1--) {
            dp[i_1][j_1] =
                a[i_1] === b[j_1]
                    ? dp[i_1 + 1][j_1 + 1] + 1
                    : Math.max(dp[i_1 + 1][j_1], dp[i_1][j_1 + 1]);
        }
    }
    var ops = [];
    var i = 0;
    var j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            ops.push({ type: "equal", text: a[i] });
            i++;
            j++;
        }
        else if (dp[i + 1][j] >= dp[i][j + 1]) {
            ops.push({ type: "delete", text: a[i] });
            i++;
        }
        else {
            ops.push({ type: "insert", text: b[j] });
            j++;
        }
    }
    while (i < n)
        ops.push({ type: "delete", text: a[i++] });
    while (j < m)
        ops.push({ type: "insert", text: b[j++] });
    return ops;
}
/**
 * High-quality text diff backed by `git diff --no-index`.
 *
 * The object store provides old/new contents; git is used only as the diff
 * engine, not as the workspace data source.
 */
function diffTextAsync(path, oldText, newText) {
    return __awaiter(this, void 0, void 0, function () {
        var diffWasmStructured, wasm, patch, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@natalia/diff-wasm"); })];
                case 1:
                    diffWasmStructured = (_b.sent()).diffWasmStructured;
                    return [4 /*yield*/, diffWasmStructured(oldText !== null && oldText !== void 0 ? oldText : "", newText !== null && newText !== void 0 ? newText : "")];
                case 2:
                    wasm = _b.sent();
                    patch = wasm.hunks.length
                        ? "--- a/".concat(path, "\n+++ b/").concat(path, "\n").concat(renderStructuredPatch(wasm))
                        : undefined;
                    return [2 /*return*/, __assign(__assign({ additions: wasm.additions, deletions: wasm.deletions }, (patch ? { patch: patch } : {})), { structured: wasm })];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, diffText(path, oldText, newText)];
            }
        });
    });
}
