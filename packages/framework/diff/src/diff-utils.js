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
exports.diffLines = diffLines;
exports.structuredRows = structuredRows;
exports.languageFromPath = languageFromPath;
function diffLines(patch) {
    if (!patch)
        return [];
    var lines = [];
    var oldLine = 0;
    var newLine = 0;
    var inHunk = false;
    for (var _i = 0, _a = patch.split("\n"); _i < _a.length; _i++) {
        var line = _a[_i];
        if (line.startsWith("diff --git")) {
            inHunk = false;
            oldLine = 0;
            newLine = 0;
            lines.push({ type: "is-header", sign: "", text: line });
            continue;
        }
        if (line.startsWith("@@")) {
            var match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/u);
            if (match) {
                oldLine = Number(match[1]);
                newLine = Number(match[2]);
            }
            inHunk = true;
            lines.push({ type: "is-header", sign: "", text: line });
            continue;
        }
        if (line.startsWith("+++") || line.startsWith("---")) {
            lines.push({ type: "is-header", sign: "", text: line });
            continue;
        }
        if (!inHunk) {
            lines.push({ type: "", sign: "", text: line });
            continue;
        }
        if (line.startsWith("+")) {
            lines.push({
                type: "is-added",
                sign: "+",
                text: line.slice(1),
                newNo: newLine++,
            });
            continue;
        }
        if (line.startsWith("-")) {
            lines.push({
                type: "is-removed",
                sign: "-",
                text: line.slice(1),
                oldNo: oldLine++,
            });
            continue;
        }
        if (line.startsWith(" ")) {
            lines.push({
                type: "",
                sign: " ",
                text: line.slice(1),
                oldNo: oldLine++,
                newNo: newLine++,
            });
            continue;
        }
        lines.push({ type: "", sign: "", text: line });
    }
    return lines;
}
function structuredRows(result) {
    try {
        return result.hunks.flatMap(function (hunk) { return __spreadArray([
            {
                type: "is-header",
                sign: "",
                text: "@@ -".concat(hunk.oldStart, ",").concat(hunk.oldCount, " +").concat(hunk.newStart, ",").concat(hunk.newCount, " @@"),
                oldNo: "",
                newNo: "",
            }
        ], hunk.lines.map(function (line) {
            var _a, _b;
            return (__assign(__assign({ type: line.type === "add"
                    ? "is-added"
                    : line.type === "delete"
                        ? "is-removed"
                        : "", sign: line.type === "add" ? "+" : line.type === "delete" ? "-" : " ", text: line.text, oldNo: (_a = line.oldLineNumber) !== null && _a !== void 0 ? _a : "", newNo: (_b = line.newLineNumber) !== null && _b !== void 0 ? _b : "" }, (Array.isArray(line.wordRanges) && line.wordRanges.length
                ? { highlights: line.wordRanges }
                : {})), (Array.isArray(line.syntaxParts) && line.syntaxParts.length
                ? { syntax: line.syntaxParts }
                : {})));
        }), true); });
    }
    catch (_a) {
        return [];
    }
}
function languageFromPath(path) {
    var lower = path.toLowerCase();
    if (lower.endsWith(".ts") ||
        lower.endsWith(".tsx") ||
        lower.endsWith(".mts") ||
        lower.endsWith(".cts"))
        return "typescript";
    if (lower.endsWith(".js") ||
        lower.endsWith(".jsx") ||
        lower.endsWith(".mjs") ||
        lower.endsWith(".cjs"))
        return "javascript";
    if (lower.endsWith(".json"))
        return "json";
    if (lower.endsWith(".py"))
        return "python";
    if (lower.endsWith(".rs"))
        return "rust";
    if (lower.endsWith(".go"))
        return "go";
    if (lower.endsWith(".java"))
        return "java";
    if (lower.endsWith(".c") || lower.endsWith(".h"))
        return "c";
    if (lower.endsWith(".cpp") ||
        lower.endsWith(".cc") ||
        lower.endsWith(".cxx") ||
        lower.endsWith(".hpp"))
        return "cpp";
    if (lower.endsWith(".cs"))
        return "csharp";
    if (lower.endsWith(".rb"))
        return "ruby";
    if (lower.endsWith(".php"))
        return "php";
    if (lower.endsWith(".swift"))
        return "swift";
    if (lower.endsWith(".kt") || lower.endsWith(".kts"))
        return "kotlin";
    if (lower.endsWith(".scala"))
        return "scala";
    if (lower.endsWith(".sql"))
        return "sql";
    if (lower.endsWith(".sh") || lower.endsWith(".bash"))
        return "bash";
    if (lower.endsWith(".yml") || lower.endsWith(".yaml"))
        return "yaml";
    if (lower.endsWith(".toml"))
        return "toml";
    if (lower.endsWith(".md"))
        return "markdown";
    if (lower.endsWith(".css"))
        return "css";
    if (lower.endsWith(".scss") || lower.endsWith(".sass"))
        return "scss";
    if (lower.endsWith(".html") || lower.endsWith(".vue"))
        return "xml";
    return undefined;
}
