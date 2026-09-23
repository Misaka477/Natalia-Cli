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
exports.patchToStructured = patchToStructured;
exports.countPatch = countPatch;
exports.diffToChanges = diffToChanges;
function patchToStructured(patch) {
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
            var text = raw.slice(1);
            current.lines.push({
                type: "add",
                text: text,
                oldLineNumber: null,
                newLineNumber: newLine++,
            });
            additions++;
            continue;
        }
        if (raw.startsWith("-")) {
            var text = raw.slice(1);
            current.lines.push({
                type: "delete",
                text: text,
                oldLineNumber: oldLine++,
                newLineNumber: null,
            });
            deletions++;
            continue;
        }
        if (raw.startsWith(" ")) {
            var text = raw.slice(1);
            current.lines.push({
                type: "context",
                text: text,
                oldLineNumber: oldLine++,
                newLineNumber: newLine++,
            });
            continue;
        }
    }
    return { hunks: hunks, additions: additions, deletions: deletions };
}
function countPatch(patch) {
    var additions = 0;
    var deletions = 0;
    for (var _i = 0, _a = patch.split("\n"); _i < _a.length; _i++) {
        var line = _a[_i];
        if (line.startsWith("+") && !line.startsWith("+++"))
            additions++;
        else if (line.startsWith("-") && !line.startsWith("---"))
            deletions++;
    }
    return { additions: additions, deletions: deletions };
}
function diffToChanges(rawDiff) {
    var _a;
    var changes = [];
    var sections = rawDiff.split(/(?=^diff --git )/m);
    for (var _i = 0, sections_1 = sections; _i < sections_1.length; _i++) {
        var section = sections_1[_i];
        if (!section.trim())
            continue;
        var header = (_a = section.split("\n")[0]) !== null && _a !== void 0 ? _a : "";
        var match = header.match(/^diff --git a\/(.+) b\/(.+)$/u);
        if (!match)
            continue;
        var path = match[2];
        var counts = countPatch(section);
        var patch = section.trim() ? section.trimEnd() + "\n" : undefined;
        var structured = patch ? patchToStructured(patch) : undefined;
        changes.push(__assign(__assign({ path: path, operation: "modified", additions: counts.additions, deletions: counts.deletions }, (patch ? { patch: patch } : {})), (structured ? { structured: structured } : {})));
    }
    return changes;
}
