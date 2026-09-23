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
exports.projectToolCall = projectToolCall;
exports.projectToolRender = projectToolRender;
exports.classifyTool = classifyTool;
exports.parseToolArguments = parseToolArguments;
exports.resultView = resultView;
exports.elapsedLabel = elapsedLabel;
exports.collapseToolOutput = collapseToolOutput;
exports.stripAnsiOutput = stripAnsiOutput;
exports.providerSafeThinkingSummary = providerSafeThinkingSummary;
/** Decodes a projected card from a metadata slot, or `undefined` when absent. */
function decodeIntent(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return undefined;
    var candidate = raw;
    if (typeof candidate.kind !== "string" ||
        typeof candidate.title !== "string" ||
        typeof candidate.summary !== "string")
        return undefined;
    return __assign(__assign({ kind: candidate.kind, title: candidate.title, summary: candidate.summary }, (typeof candidate.body === "string" ? { body: candidate.body } : {})), (Array.isArray(candidate.meta)
        ? { meta: candidate.meta }
        : {}));
}
/**
 * Decodes a tool's self-projected call card from the event metadata
 * (`metadata.call`), or `undefined` when the tool declared none.
 */
function projectToolCall(metadata) {
    if (metadata === void 0) { metadata = {}; }
    return decodeIntent(metadata.call);
}
/**
 * Decodes a tool's self-projected result card from the event metadata
 * (`metadata.render`), or `undefined` when the tool declared none. A malformed
 * intent is treated as absent — the client falls back to the plain result.
 */
function projectToolRender(metadata) {
    if (metadata === void 0) { metadata = {}; }
    return decodeIntent(metadata.render);
}
var sensitiveKey = /(?:api[_-]?key|token|secret|password|passphrase|credential|authorization|cookie)/iu;
function classifyTool(name, metadata) {
    if (metadata === void 0) { metadata = {}; }
    var lower = name.toLowerCase();
    var kind = typeof metadata.kind === "string" ? metadata.kind.toLowerCase() : "";
    if (kind === "diff" ||
        lower.includes("diff") ||
        lower === "apply_edits" ||
        lower === "edit")
        return "diff";
    if (kind === "workflow" || lower.includes("workflow"))
        return "workflow";
    if (kind === "background" || lower.includes("background"))
        return "background";
    if (kind === "subagent" ||
        lower === "task" ||
        lower.includes("subagent") ||
        lower.startsWith("agent_"))
        return "subagent";
    if (kind === "shell" ||
        lower === "run_shell" ||
        lower === "shell" ||
        lower === "bash")
        return "shell";
    if (kind === "read" || lower === "read" || lower === "read_file")
        return "read";
    if (kind === "write" || lower === "write" || lower === "write_file")
        return "write";
    if (kind === "grep" || lower === "grep")
        return "grep";
    if (kind === "glob" || lower === "glob")
        return "glob";
    if (kind === "webfetch" || lower === "web_fetch" || lower === "webfetch")
        return "webfetch";
    if (kind === "websearch" || lower === "web_search" || lower === "websearch")
        return "websearch";
    if (kind === "question" || lower === "ask_user" || lower === "question")
        return "question";
    if (kind === "execute" || lower === "execute")
        return "execute";
    if (kind === "terminal" || lower.includes("terminal"))
        return "terminal";
    if (kind === "sandbox" || lower.includes("sandbox"))
        return "sandbox";
    if (kind === "skill" || lower.includes("skill"))
        return "skill";
    return "generic";
}
function parseToolArguments(raw) {
    var trimmed = raw.trim();
    if (!trimmed)
        return { complete: false, keyArguments: [] };
    try {
        var value = JSON.parse(trimmed);
        var redacted = redactValue(value);
        return {
            complete: true,
            keyArguments: keyArguments(redacted),
            redactedJson: JSON.stringify(redacted, undefined, 2),
        };
    }
    catch (_a) {
        return { complete: false, keyArguments: [] };
    }
}
function resultView(result, maxLines, maxChars, presentation) {
    if (maxLines === void 0) { maxLines = 8; }
    if (maxChars === void 0) { maxChars = 1200; }
    if (presentation === void 0) { presentation = {}; }
    var human = humanReadableResult(result, presentation);
    var lines = human.preview.split("\n");
    var chars = Array.from(human.preview);
    var lineLimited = lines.length > maxLines;
    var charLimited = chars.length > maxChars;
    var previewByLine = lines.slice(0, maxLines).join("\n");
    var previewChars = Array.from(previewByLine).slice(0, maxChars).join("");
    var truncated = lineLimited || charLimited || previewChars.length < previewByLine.length;
    var preview = truncated ? "".concat(previewChars, "\n...") : human.preview;
    return {
        summary: human.summary,
        preview: preview,
        detail: result,
        truncated: truncated,
        totalChars: Array.from(result).length,
        totalLines: result.split("\n").length,
    };
}
function humanReadableResult(result, presentation) {
    var _a, _b, _c, _d;
    var value;
    try {
        value = JSON.parse(result);
    }
    catch (_e) {
        return { summary: plainSummary(result), preview: result };
    }
    if (presentation.kind === "diff" && Array.isArray(value)) {
        var changes = value.filter(isRecord);
        return {
            summary: "".concat(changes.length, " sandbox change").concat(changes.length === 1 ? "" : "s"),
            preview: changes.map(function (change) { return formatChange(change); }).join("\n") ||
                "No sandbox changes.",
        };
    }
    if (presentation.kind === "subagent" && isRecord(value)) {
        var id = stringValue(value.id);
        var status_1 = stringValue(value.status);
        var task = stringValue(value.task);
        return {
            summary: "".concat(id || "Subagent").concat(status_1 ? " \u00B7 ".concat(status_1) : ""),
            preview: [task ? "Task: ".concat(task) : undefined, "Subagent started."]
                .filter(Boolean)
                .join("\n"),
        };
    }
    if (presentation.kind === "workflow" && isRecord(value)) {
        var status_2 = (_a = stringValue(value.status)) !== null && _a !== void 0 ? _a : "unknown";
        var workflow = (_c = (_b = stringValue(value.workflow)) !== null && _b !== void 0 ? _b : stringValue(value.name)) !== null && _c !== void 0 ? _c : "workflow";
        var completed = Array.isArray(value.completedStepIDs)
            ? value.completedStepIDs.length
            : undefined;
        return {
            summary: "Workflow ".concat(workflow, " \u00B7 ").concat(status_2),
            preview: completed === undefined
                ? "Workflow result available."
                : "Completed steps: ".concat(completed),
        };
    }
    if (presentation.name === "browser_visit" && isRecord(value)) {
        var url = stringValue(value.url);
        var status_3 = value.status;
        var title = stringValue(value.title);
        var preview = stringValue(value.textPreview);
        var contentType = stringValue(value.contentType);
        return {
            summary: "Visited ".concat(title || url || "page").concat(status_3 ? " \u00B7 HTTP ".concat(status_3) : ""),
            preview: [
                title ? "Title: ".concat(title) : undefined,
                url ? "URL: ".concat(url) : undefined,
                contentType ? "Content type: ".concat(contentType) : undefined,
                preview ? "Preview: ".concat(truncateLine(preview, 280)) : undefined,
            ]
                .filter(Boolean)
                .join("\n"),
        };
    }
    if (presentation.name === "ask_user" && isRecord(value)) {
        var answers = Array.isArray(value.answers)
            ? value.answers
                .map(function (answer) {
                return Array.isArray(answer)
                    ? answer.map(String).join(", ")
                    : String(answer);
            })
                .filter(Boolean)
            : [];
        return {
            summary: answers.length ? "User answered" : "Question completed",
            preview: answers.length
                ? "Answer: ".concat(answers.join("; "))
                : "No answer selected.",
        };
    }
    if (isRecord(value)) {
        var entries = Object.entries(value).filter(function (_a) {
            var item = _a[1];
            return isDisplayValue(item);
        });
        return {
            summary: "".concat((_d = presentation.name) !== null && _d !== void 0 ? _d : "Tool", " completed"),
            preview: entries
                .slice(0, 8)
                .map(function (_a) {
                var key = _a[0], item = _a[1];
                return "".concat(humanKey(key), ": ").concat(formatValue(item));
            })
                .join("\n") || "Structured result available.",
        };
    }
    if (Array.isArray(value)) {
        return {
            summary: "".concat(value.length, " result item").concat(value.length === 1 ? "" : "s"),
            preview: value.slice(0, 8).map(formatValue).join("\n") || "No results.",
        };
    }
    return { summary: plainSummary(result), preview: String(value) };
}
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isDisplayValue(value) {
    return (value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        (Array.isArray(value) &&
            value.length <= 4 &&
            value.every(function (item) { return typeof item !== "object"; })));
}
function formatChange(change) {
    var _a, _b;
    var kind = (_a = stringValue(change.kind)) !== null && _a !== void 0 ? _a : "changed";
    var path = (_b = stringValue(change.path)) !== null && _b !== void 0 ? _b : "unknown path";
    var oldPath = stringValue(change.oldPath);
    var content = stringValue(change.content);
    var label = kind === "rename" && oldPath
        ? "Renamed ".concat(oldPath, " -> ").concat(path)
        : "".concat(changeVerb(kind), " ").concat(path);
    return [label, content ? "  ".concat(truncateLine(content, 160)) : undefined]
        .filter(Boolean)
        .join("\n");
}
function changeVerb(kind) {
    if (kind === "modify")
        return "Modified";
    if (kind === "add")
        return "Added";
    if (kind === "delete")
        return "Deleted";
    return "".concat(kind.charAt(0).toUpperCase()).concat(kind.slice(1));
}
function formatValue(value) {
    if (Array.isArray(value))
        return value.map(String).join(", ");
    return String(value);
}
function stringValue(value) {
    return typeof value === "string" ? value : undefined;
}
function humanKey(key) {
    return key.replace(/([a-z])([A-Z])/gu, "$1 $2");
}
function truncateLine(value, max) {
    var chars = Array.from(value);
    return chars.length > max ? "".concat(chars.slice(0, max).join(""), "...") : value;
}
function plainSummary(result) {
    var lines = result.split("\n");
    var chars = Array.from(result);
    return "".concat(lines.length, " line").concat(lines.length === 1 ? "" : "s", ", ").concat(chars.length, " chars");
}
function elapsedLabel(startedAt, endedAt, now) {
    if (now === void 0) { now = Date.now(); }
    if (!startedAt)
        return "";
    var elapsed = Math.max(0, (endedAt !== null && endedAt !== void 0 ? endedAt : now) - startedAt);
    if (elapsed < 1000)
        return "".concat(elapsed, "ms");
    return "".concat((elapsed / 1000).toFixed(elapsed < 10000 ? 1 : 0), "s");
}
function collapseToolOutput(output, maxLines, maxChars) {
    var lines = output.split("\n");
    if (lines.length <= maxLines && Array.from(output).length <= maxChars)
        return { output: output, overflow: false };
    var preview = lines.slice(0, maxLines).join("\n");
    if (Array.from(preview).length > maxChars)
        return {
            output: Array.from(preview)
                .slice(0, Math.max(0, maxChars - 1))
                .join("") + "…",
            overflow: true,
        };
    return {
        output: __spreadArray(__spreadArray([], lines.slice(0, maxLines), true), ["…"], false).join("\n"),
        overflow: true,
    };
}
function stripAnsiOutput(value) {
    return value.replace(/[\u001b\u009b](?:\][^\u0007]*(?:\u0007|\u001b\\)|\[[0-?]*[ -/]*[@-~])/gu, "");
}
function providerSafeThinkingSummary(reasoningVisible, text) {
    if (reasoningVisible)
        return text;
    if (!text.trim())
        return "Thinking received; details hidden by provider policy.";
    return "Thinking details hidden by provider policy.";
}
function redactValue(value) {
    if (Array.isArray(value))
        return value.map(redactValue);
    if (!value || typeof value !== "object")
        return value;
    return Object.fromEntries(Object.entries(value).map(function (_a) {
        var key = _a[0], item = _a[1];
        return [
            key,
            sensitiveKey.test(key) ? "[REDACTED]" : redactValue(item),
        ];
    }));
}
function keyArguments(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return [];
    return Object.entries(value)
        .filter(function (_a) {
        var _ = _a[0], item = _a[1];
        return item !== undefined && item !== null && typeof item !== "object";
    })
        .slice(0, 4)
        .map(function (_a) {
        var key = _a[0], item = _a[1];
        return "".concat(key, "=").concat(String(item).slice(0, 80));
    });
}
