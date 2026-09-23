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
exports.nativeTerminalSearchPage = nativeTerminalSearchPage;
exports.nativeTerminalReadPage = nativeTerminalReadPage;
exports.encodeTerminalKey = encodeTerminalKey;
/**
 * Terminal text handling: paging a native terminal's scrollback, and turning a
 * key description into the bytes a terminal expects.
 *
 * Both are pure string work with no registry, no process and no state, which is
 * why they are here rather than inside the tools that call them: the paging
 * budget and the key encoding are the parts worth testing directly, and they are
 * exported from the package because a consumer driving a terminal needs the same
 * encoding the model's tools use.
 */
var arguments_1 = require("./arguments");
function nativeTerminalSearchPage(text, input) {
    var lines = text.split("\n");
    if (lines.at(-1) === "")
        lines.pop();
    var matches = lines
        .flatMap(function (line, index) {
        return line.includes(input.query)
            ? [{ line: input.startLine + index, text: truncateTerminalLine(line) }]
            : [];
    })
        .slice(0, input.maxMatches);
    var scannedEndLine = input.startLine + Math.max(0, lines.length - 1);
    return {
        query: input.query,
        searchedRange: {
            startLine: input.startLine,
            endLine: Math.min(input.endLine, scannedEndLine),
            scannedLines: lines.length,
        },
        matches: matches,
        truncatedMatches: matches.length === input.maxMatches,
        nextCursor: lines.length === 200 &&
            (input.requestedEndLine === undefined ||
                scannedEndLine < input.requestedEndLine)
            ? __assign({ startLine: scannedEndLine + 1 }, (input.requestedEndLine === undefined
                ? {}
                : { endLine: input.requestedEndLine })) : undefined,
    };
}
function truncateTerminalLine(line) {
    return nativeTerminalReadPage(line, {}, 1024).text;
}
function nativeTerminalReadPage(text, input, maxBytes) {
    if (maxBytes === void 0) { maxBytes = 16384; }
    var bytes = Buffer.from(text);
    var totalBytes = bytes.byteLength;
    if (totalBytes <= maxBytes)
        return {
            text: text,
            totalBytes: totalBytes,
            truncated: false,
            deliveredLines: deliveredLineCount(text),
            endLine: input.startLine === undefined
                ? undefined
                : input.startLine + deliveredLineCount(text) - 1,
            nextStartLine: undefined,
        };
    var end = maxBytes;
    while (end > 0 && (bytes[end] & 0xc0) === 0x80)
        end--;
    var boundary = bytes.subarray(0, end).toString("utf8");
    var newline = boundary.lastIndexOf("\n");
    var pageText = newline >= 0 ? boundary.slice(0, newline + 1) : boundary;
    var deliveredLines = deliveredLineCount(pageText);
    return {
        text: pageText,
        totalBytes: totalBytes,
        truncated: true,
        deliveredLines: deliveredLines,
        endLine: input.startLine === undefined
            ? undefined
            : input.startLine + deliveredLines - 1,
        nextStartLine: input.startLine === undefined || deliveredLines === 0
            ? undefined
            : input.startLine + deliveredLines,
    };
}
function deliveredLineCount(text) {
    if (!text)
        return 0;
    var lines = text.split("\n");
    return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}
function encodeTerminalKey(input) {
    var modifiers = normalizeTerminalModifiers(input.modifiers);
    var repeat = input.repeat === undefined ? 1 : requireRepeat(input.repeat);
    var text = input.text === undefined ? undefined : (0, arguments_1.requireString)(input.text, "text");
    if (text !== undefined) {
        if (modifiers.size)
            throw new Error("UTF-8 committed text cannot have terminal modifiers");
        return text.repeat(repeat);
    }
    var rawKey = (0, arguments_1.requireString)(input.key, "key");
    var key = normalizeTerminalKey(rawKey);
    if (key.length === 1 && key >= "A" && key <= "Z" && !modifiers.has("shift"))
        modifiers.add("shift");
    var bytes = encodeTerminalKeyOnce(key, modifiers);
    return bytes.repeat(repeat);
}
function normalizeTerminalModifiers(value) {
    if (value === undefined)
        return new Set();
    if (!Array.isArray(value))
        throw new Error("modifiers must be an array");
    var modifiers = new Set(value.map(function (item) { return String(item).toLowerCase(); }));
    for (var _i = 0, modifiers_1 = modifiers; _i < modifiers_1.length; _i++) {
        var modifier = modifiers_1[_i];
        if (!["ctrl", "alt", "shift"].includes(modifier))
            throw new Error("unsupported terminal modifier: ".concat(modifier));
    }
    return modifiers;
}
function requireRepeat(value) {
    if (!Number.isInteger(value) ||
        value < 1 ||
        value > 100)
        throw new Error("repeat must be an integer between 1 and 100");
    return value;
}
function normalizeTerminalKey(value) {
    var _a;
    var aliases = {
        enter: "Enter",
        esc: "Esc",
        escape: "Esc",
        backspace: "Backspace",
        delete: "Delete",
        tab: "Tab",
        "ctrl-c": "CtrlC",
        "ctrl-d": "CtrlD",
        arrowup: "ArrowUp",
        arrowdown: "ArrowDown",
        arrowleft: "ArrowLeft",
        arrowright: "ArrowRight",
        home: "Home",
        end: "End",
        pageup: "PageUp",
        pagedown: "PageDown",
        insert: "Insert",
    };
    var canonical = (_a = aliases[value.toLowerCase()]) !== null && _a !== void 0 ? _a : value;
    if (/^F(?:[1-9]|1[0-2])$/u.test(canonical))
        return canonical;
    if (__spreadArray([], canonical, true).length === 1)
        return canonical;
    if (canonical === "CtrlC" || canonical === "CtrlD")
        return canonical;
    if ([
        "Enter",
        "Esc",
        "Backspace",
        "Delete",
        "Tab",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "Insert",
    ].includes(canonical))
        return canonical;
    throw new Error("unsupported terminal key: ".concat(value));
}
function encodeTerminalKeyOnce(key, modifiers) {
    if (key === "CtrlC")
        return "\x03";
    if (key === "CtrlD")
        return "\x04";
    var modifier = terminalModifierCode(modifiers);
    var plain = modifiers.size === 0;
    var base = {
        Enter: "\r",
        Esc: "\x1b",
        Tab: "\t",
        Backspace: "\x7f",
        Delete: "\x1b[3~",
        Insert: "\x1b[2~",
        Home: "\x1b[H",
        End: "\x1b[F",
        PageUp: "\x1b[5~",
        PageDown: "\x1b[6~",
        ArrowUp: "\x1b[A",
        ArrowDown: "\x1b[B",
        ArrowRight: "\x1b[C",
        ArrowLeft: "\x1b[D",
        F1: "\x1bOP",
        F2: "\x1bOQ",
        F3: "\x1bOR",
        F4: "\x1bOS",
        F5: "\x1b[15~",
        F6: "\x1b[17~",
        F7: "\x1b[18~",
        F8: "\x1b[19~",
        F9: "\x1b[20~",
        F10: "\x1b[21~",
        F11: "\x1b[23~",
        F12: "\x1b[24~",
    };
    if (key in base) {
        if (plain)
            return base[key];
        if (["Enter", "Esc", "Tab", "Backspace"].includes(key))
            throw new Error("terminal modifiers are not encodable for ".concat(key));
        return applyTerminalModifier(base[key], modifier);
    }
    if (key.length !== 1)
        throw new Error("unsupported terminal key: ".concat(key));
    if (modifiers.has("ctrl")) {
        var code = key.toUpperCase().codePointAt(0);
        if (code < 0x40 || code > 0x5f)
            throw new Error("Ctrl modifier is not encodable for ".concat(key));
        return "".concat(modifiers.has("alt") ? "\x1b" : "").concat(String.fromCharCode(code - 0x40));
    }
    return "".concat(modifiers.has("alt") ? "\x1b" : "").concat(key);
}
function terminalModifierCode(modifiers) {
    return (1 +
        Number(modifiers.has("shift")) +
        Number(modifiers.has("alt")) * 2 +
        Number(modifiers.has("ctrl")) * 4);
}
function applyTerminalModifier(bytes, modifier) {
    if (bytes.startsWith("\x1bO"))
        return "\u001B[1;".concat(modifier).concat(bytes.at(-1));
    if (bytes.endsWith("~"))
        return "".concat(bytes.slice(0, -1), ";").concat(modifier, "~");
    return "".concat(bytes.slice(0, -1), "1;").concat(modifier).concat(bytes.at(-1));
}
