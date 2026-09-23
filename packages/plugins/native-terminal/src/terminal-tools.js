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
exports.TERMINAL_OBSERVE_MODES = void 0;
exports.terminalTools = terminalTools;
exports.terminalToolFamily = terminalToolFamily;
/**
 * Tools that drive the one native terminal pane the model shares with the user.
 */
/**
 * Tools that drive the one native terminal pane the model shares with the user.
 *
 * There is a single pane on purpose: the model and the person are looking at the
 * same screen, so what the model types is visible and what the person typed is
 * part of the model's context. Reads are paged and bounded (`terminal-io.ts`)
 * because a terminal's scrollback is unbounded and a model that asks for "the
 * output" would otherwise receive a session's worth of it.
 */
var tools_1 = require("@anthelia/tools");
var tools_2 = require("@anthelia/tools");
var tools_3 = require("@anthelia/tools");
exports.TERMINAL_OBSERVE_MODES = [
    "full",
    "tail",
    "new_only",
    "cursor",
    "latest",
];
function requireNativeTerminal(context) {
    if (!context.terminal)
        throw new Error("Native Terminal Host is unavailable. Enable the PTY backend or install the Natalia WezTerm distribution to start an interactive terminal.");
    return context.terminal;
}
function modelNativeTerminalInfo(session) {
    return {
        id: session.id,
        host: session.host,
        paneID: session.paneID,
        windowID: session.windowID,
        muxWindowID: session.muxWindowID,
        tabID: session.tabID,
        command: session.command,
        cwd: session.cwd,
        status: session.status,
        startedAt: session.startedAt,
    };
}
function interactiveStartTool() {
    return {
        name: "interactive_terminal_start",
        description: "Start a real interactive Terminal session inside the workspace. On Windows the pane shell is Git Bash, not cmd.exe — use POSIX shell syntax.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: {
                command: { type: "string" },
                id: { type: "string" },
            },
            required: ["command"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, registry, session;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            registry = requireNativeTerminal(context);
                            return [4 /*yield*/, registry.start(__assign({ command: (0, tools_1.requireString)(args.command, "command"), cwd: context.workspaceRoot, id: (0, tools_1.optionalString)(args.id), 
                                    // I1/I3: the pane belongs to the turn's session. When that session is
                                    // not the attached one, the registry opens no window and steals no
                                    // focus — the human's Open terminal brings it up later.
                                    sessionID: context.parentSessionID }, (context.parentAgentID ? { agentID: context.parentAgentID } : {})))];
                        case 1:
                            session = _a.sent();
                            return [2 /*return*/, JSON.stringify(modelNativeTerminalInfo(session), null, 2)];
                    }
                });
            });
        },
    };
}
function interactiveReadTool() {
    return {
        name: "interactive_terminal_read",
        description: "Read a bounded line range from the same native Terminal pane used by the human. Returns text plus cursor position. Use startLine/endLine to page through complete scrollback without copying it all at once.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                maxLines: { type: "number" },
                startLine: { type: "number" },
                endLine: { type: "number" },
                cursor: { type: "number" },
            },
            required: ["id"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, startLine, cursor, endLine, pageStartLine, _a, text, cursorX, cursorY, rows, cols, page;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            startLine = (0, tools_1.optionalInteger)(args.startLine, "startLine");
                            cursor = (0, tools_1.optionalInteger)(args.cursor, "cursor");
                            endLine = (0, tools_1.optionalInteger)(args.endLine, "endLine");
                            if (startLine !== undefined && cursor !== undefined)
                                throw new Error("startLine and cursor cannot be used together");
                            pageStartLine = startLine !== null && startLine !== void 0 ? startLine : cursor;
                            return [4 /*yield*/, requireNativeTerminal(context).read(id, __assign({ maxLines: Math.max(1, Math.min((0, tools_1.numberOr)(args.maxLines, 60), 200)), startLine: pageStartLine, endLine: endLine }, (context.parentSessionID
                                    ? { sessionID: context.parentSessionID }
                                    : {})))];
                        case 1:
                            _a = _b.sent(), text = _a.text, cursorX = _a.cursorX, cursorY = _a.cursorY, rows = _a.rows, cols = _a.cols;
                            page = (0, tools_2.nativeTerminalReadPage)(text, {
                                startLine: pageStartLine,
                                endLine: endLine,
                            });
                            return [2 /*return*/, JSON.stringify({
                                    id: id,
                                    cursorX: cursorX,
                                    cursorY: cursorY,
                                    rows: rows,
                                    cols: cols,
                                    range: pageStartLine === undefined
                                        ? {
                                            kind: "tail",
                                            maxLines: Math.max(1, Math.min((0, tools_1.numberOr)(args.maxLines, 60), 200)),
                                        }
                                        : {
                                            kind: "lines",
                                            startLine: pageStartLine,
                                            endLine: endLine,
                                        },
                                    deliveredRange: pageStartLine === undefined
                                        ? { kind: "tail", deliveredLines: page.deliveredLines }
                                        : {
                                            kind: "lines",
                                            startLine: pageStartLine,
                                            endLine: page.endLine,
                                            deliveredLines: page.deliveredLines,
                                        },
                                    nextCursor: page.nextStartLine
                                        ? __assign({ startLine: page.nextStartLine }, (endLine === undefined ? {} : { endLine: endLine })) : undefined,
                                    text: page.text,
                                    truncated: page.truncated,
                                    totalBytes: page.totalBytes,
                                    rangeDiscovery: "native_scrollback_unbounded",
                                }, null, 2)];
                    }
                });
            });
        },
    };
}
function interactiveSearchTool() {
    return {
        name: "interactive_terminal_search",
        description: "Search a bounded native Terminal scrollback line range for literal UTF-8 text. Continue with nextCursor; it never transports the full terminal screen.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                query: { type: "string" },
                startLine: { type: "number" },
                endLine: { type: "number" },
                cursor: { type: "number" },
                maxMatches: { type: "number" },
            },
            required: ["id", "query"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, query, startLine, cursor, endLine, pageStartLine, pageEndLine, text, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            query = (0, tools_1.requireString)(args.query, "query");
                            if (!query)
                                throw new Error("query must not be empty");
                            if (new TextEncoder().encode(query).byteLength > 256)
                                throw new Error("query must be at most 256 UTF-8 bytes");
                            startLine = (0, tools_1.optionalInteger)(args.startLine, "startLine");
                            cursor = (0, tools_1.optionalInteger)(args.cursor, "cursor");
                            endLine = (0, tools_1.optionalInteger)(args.endLine, "endLine");
                            if (startLine !== undefined && cursor !== undefined)
                                throw new Error("startLine and cursor cannot be used together");
                            pageStartLine = startLine !== null && startLine !== void 0 ? startLine : cursor;
                            if (pageStartLine === undefined)
                                throw new Error("startLine or cursor is required for scrollback search");
                            if (endLine !== undefined && endLine < pageStartLine)
                                throw new Error("endLine must not be before startLine");
                            pageEndLine = Math.min(endLine !== null && endLine !== void 0 ? endLine : pageStartLine + 199, pageStartLine + 199);
                            return [4 /*yield*/, requireNativeTerminal(context).read(id, {
                                    startLine: pageStartLine,
                                    endLine: pageEndLine,
                                })];
                        case 1:
                            text = (_a.sent()).text;
                            result = (0, tools_2.nativeTerminalSearchPage)(text, {
                                query: query,
                                startLine: pageStartLine,
                                endLine: pageEndLine,
                                requestedEndLine: endLine,
                                maxMatches: Math.max(1, Math.min((0, tools_1.numberOr)(args.maxMatches, 20), 20)),
                            });
                            return [2 /*return*/, JSON.stringify(__assign({ id: id }, result), null, 2)];
                    }
                });
            });
        },
    };
}
function terminalObserveTool() {
    return {
        name: "terminal_observe",
        description: "Wait for a terminal screen revision or process exit, then return the current styled framebuffer. Timeout is a normal observation result. afterRevision is optional; omit it to get current state. Use mode='latest' for current state without waiting; mode='tail' for recent lines; mode='new_only' for only new output since last observation; mode='cursor' for lines around the cursor.",
        requiresApproval: false,
        timeoutSec: 35,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                afterRevision: { type: "number" },
                timeoutMs: { type: "number" },
                scrollbackRows: { type: "number" },
                mode: {
                    type: "string",
                    enum: __spreadArray([], exports.TERMINAL_OBSERVE_MODES, true),
                },
            },
            required: ["id"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, mode, afterRevision, snapshot, nativeTerminal, observation, text, session, previousText, lines, tailLines, lines, cursorY, contextLines, startLine, endLine;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            mode = args.mode || "full";
                            afterRevision = (0, tools_1.numberOr)(args.afterRevision, 0);
                            if (!(mode === "latest")) return [3 /*break*/, 2];
                            return [4 /*yield*/, requireNativeTerminal(context).snapshot(id)];
                        case 1:
                            snapshot = _b.sent();
                            return [2 /*return*/, JSON.stringify({
                                    id: id,
                                    host: "wezterm",
                                    revision: snapshot.revision,
                                    currentRevision: snapshot.revision,
                                    afterRevision: afterRevision,
                                    changed: snapshot.revision > afterRevision,
                                    // This mode reads the screen as it is and never waits, so it cannot
                                    // report a wait outcome. Saying "timeout" claimed the deadline passed
                                    // with no output, which reads as a stale frame even though the screen
                                    // was just reconciled, and "changed" was not one of the outcomes the
                                    // waiting modes report either.
                                    reason: "latest",
                                    cursorX: snapshot.cursorX,
                                    cursorY: snapshot.cursorY,
                                    rows: snapshot.rows,
                                    cols: snapshot.cols,
                                    mode: mode,
                                    text: (0, tools_3.truncateProcessOutput)(snapshot.text, 16384),
                                })];
                        case 2:
                            nativeTerminal = requireNativeTerminal(context);
                            return [4 /*yield*/, nativeTerminal.reconcile()];
                        case 3:
                            _b.sent();
                            return [4 /*yield*/, nativeTerminal.observe(id, afterRevision, {
                                    maxLines: Math.max(1, Math.min((0, tools_1.numberOr)(args.scrollbackRows, 60), 200)),
                                    timeoutMs: Math.max(1000, Math.min((0, tools_1.numberOr)(args.timeoutMs, 5000), 30000)),
                                })];
                        case 4:
                            observation = _b.sent();
                            text = observation.text;
                            session = nativeTerminal.session(id);
                            previousText = session.lastObservedText;
                            if (mode === "tail") {
                                lines = text.split("\n");
                                if (lines.at(-1) === "")
                                    lines.pop();
                                tailLines = Math.max(1, Math.min((0, tools_1.numberOr)(args.scrollbackRows, 60), 200));
                                text = lines.slice(-tailLines).join("\n");
                            }
                            else if (mode === "cursor") {
                                lines = text.split("\n");
                                if (lines.at(-1) === "")
                                    lines.pop();
                                cursorY = (_a = observation.cursorY) !== null && _a !== void 0 ? _a : 0;
                                contextLines = 10;
                                startLine = Math.max(0, cursorY - contextLines);
                                endLine = Math.min(lines.length, cursorY + contextLines + 1);
                                text = lines.slice(startLine, endLine).join("\n");
                            }
                            else if (mode === "new_only") {
                                if (previousText && text.startsWith(previousText)) {
                                    text = text.slice(previousText.length);
                                }
                            }
                            nativeTerminal.markObserved(id, observation.text, observation.session.revision);
                            return [2 /*return*/, JSON.stringify({
                                    id: id,
                                    host: "wezterm",
                                    revision: observation.session.revision,
                                    currentRevision: observation.session.revision,
                                    afterRevision: observation.afterRevision,
                                    changed: observation.changed,
                                    reason: observation.reason,
                                    cursorX: observation.cursorX,
                                    cursorY: observation.cursorY,
                                    rows: observation.rows,
                                    cols: observation.cols,
                                    mode: mode,
                                    text: (0, tools_3.truncateProcessOutput)(text, 16384),
                                }, null, 2)];
                    }
                });
            });
        },
    };
}
function interactiveWriteTool() {
    return {
        name: "interactive_terminal_write",
        description: "Write literal input to the native terminal pane without appending a newline. Prefer interactive_terminal_input with submit=false for new code.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                input: { type: "string" },
                idempotencyKey: { type: "string" },
            },
            required: ["id", "input"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, data, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            data = (0, tools_1.requireString)(args.input, "input");
                            return [4 /*yield*/, requireNativeTerminal(context).write(id, data, __assign({ idempotencyKey: (0, tools_1.optionalString)(args.idempotencyKey) }, (context.parentSessionID
                                    ? { sessionID: context.parentSessionID }
                                    : {})))];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, JSON.stringify(__assign({ id: id }, result))];
                    }
                });
            });
        },
    };
}
function interactiveSendLineTool() {
    return {
        name: "interactive_terminal_send_line",
        description: "Atomically write text and submit it with Enter to the native terminal pane. Prefer interactive_terminal_input with default submit=true for new code.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                text: { type: "string" },
                idempotencyKey: { type: "string" },
            },
            required: ["id", "text"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, text, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            text = (0, tools_1.requireString)(args.text, "text");
                            return [4 /*yield*/, requireNativeTerminal(context).write(id, "".concat(text, "\r"), __assign({ idempotencyKey: (0, tools_1.optionalString)(args.idempotencyKey) }, (context.parentSessionID
                                    ? { sessionID: context.parentSessionID }
                                    : {})))];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, JSON.stringify(__assign(__assign({ id: id }, result), { submitted: true }))];
                    }
                });
            });
        },
    };
}
function interactiveKeyTool() {
    return {
        name: "interactive_terminal_keys",
        description: "Send normalized key sequences to the native terminal pane. Prefer interactive_terminal_input with the keys array for new code.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                key: { type: "string" },
                keys: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            key: { type: "string" },
                            text: { type: "string" },
                            modifiers: { type: "array", items: { type: "string" } },
                            repeat: { type: "number" },
                        },
                        additionalProperties: false,
                    },
                },
            },
            required: ["id"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, sequence, bytes, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            sequence = Array.isArray(args.keys)
                                ? args.keys.map(function (item) { return (0, tools_1.requireObject)(item); })
                                : [(0, tools_1.requireObject)({ key: (0, tools_1.requireString)(args.key, "key") })];
                            if (!sequence.length)
                                throw new Error("keys must not be empty");
                            bytes = sequence.map(tools_2.encodeTerminalKey).join("");
                            return [4 /*yield*/, requireNativeTerminal(context).write(id, bytes, __assign({}, (context.parentSessionID
                                    ? { sessionID: context.parentSessionID }
                                    : {})))];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, JSON.stringify(__assign({ id: id, keys: sequence }, result))];
                    }
                });
            });
        },
    };
}
function interactiveInputTool() {
    return {
        name: "interactive_terminal_input",
        description: "Unified input for the native terminal pane. Prefer this over interactive_terminal_write, interactive_terminal_send_line, and interactive_terminal_keys. Use `text` alone for a shell command: text='ls -la' sends it and presses Enter (submit=true by default; submit=false suppresses it). Use `keys` when order matters: it is an ordered sequence sent one entry at a time, where each entry is either a key ({key:'Escape'}) or literal text ({text:'hello'}). Entering insert mode and typing is keys=[{key:'i'},{text:'hello'},{key:'Escape'}]; saving is keys=[{key:'Escape'},{text:':wq'},{key:'Enter'}]. Add Enter explicitly as {key:'Enter'} inside a sequence. Do not pass `text` and `keys` in the same call, because their relative order is not expressible that way; put the text inside the sequence instead. Use paste=true with `text` for large blocks in editors like vim (wraps it in bracketed paste escape sequences).",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                text: { type: "string" },
                keys: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            key: { type: "string" },
                            text: { type: "string" },
                            modifiers: { type: "array", items: { type: "string" } },
                            repeat: { type: "number" },
                        },
                        additionalProperties: false,
                    },
                },
                submit: { type: "boolean" },
                paste: { type: "boolean" },
                idempotencyKey: { type: "string" },
            },
            required: ["id"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, bytes, pasted, text, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            if (args.text === undefined && !Array.isArray(args.keys))
                                throw new Error("either text or keys is required");
                            // Two parallel fields cannot express interleaving, so the old behaviour
                            // silently sent all text before all keys. In an editor that reverses the
                            // intent: text meant for insert mode arrives while still in normal mode.
                            // Ordering is expressible inside `keys`, so ask for it there.
                            if (args.text !== undefined && Array.isArray(args.keys))
                                throw new Error("text and keys cannot be combined because their order is ambiguous; put the text inside the keys sequence instead, for example keys=[{key:'i'},{text:'hello'},{key:'Escape'}]");
                            bytes = "";
                            pasted = false;
                            if (args.text !== undefined) {
                                text = (0, tools_1.requireString)(args.text, "text");
                                if (args.paste && text) {
                                    bytes = "\u001B[?2004h".concat(text, "\u001B[?2004l");
                                    pasted = true;
                                }
                                else {
                                    bytes = text;
                                }
                            }
                            if (Array.isArray(args.keys))
                                bytes += args.keys
                                    .map(function (item) { return (0, tools_2.encodeTerminalKey)((0, tools_1.requireObject)(item)); })
                                    .join("");
                            if (!pasted && args.text !== undefined && args.submit !== false)
                                bytes += "\r";
                            if (!bytes)
                                throw new Error("input must not be empty");
                            return [4 /*yield*/, requireNativeTerminal(context).write(id, bytes, __assign({ idempotencyKey: (0, tools_1.optionalString)(args.idempotencyKey) }, (context.parentSessionID
                                    ? { sessionID: context.parentSessionID }
                                    : {})))];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, JSON.stringify(__assign(__assign({ id: id }, result), { submitted: args.submit !== false && !pasted }))];
                    }
                });
            });
        },
    };
}
function interactiveSnapshotTool() {
    return {
        name: "interactive_terminal_snapshot",
        description: "Return the current terminal screen text with cursor position and revision. Use this to check where you are without specifying afterRevision.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
            },
            required: ["id"],
            additionalProperties: false,
        },
        output: {
            schema: {
                type: "object",
                properties: { screen: { type: "string" } },
                required: ["screen"],
                additionalProperties: false,
            },
            presentCall: function (args) {
                var _a;
                return {
                    kind: "terminal",
                    title: String((_a = (0, tools_1.requireObject)(args).id) !== null && _a !== void 0 ? _a : ""),
                    summary: "snapshot",
                };
            },
            presentResult: function (args, value) {
                var _a;
                return {
                    kind: "terminal",
                    title: String((_a = (0, tools_1.requireObject)(args).id) !== null && _a !== void 0 ? _a : ""),
                    summary: "screen",
                    body: value,
                };
            },
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, snapshot;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            return [4 /*yield*/, requireNativeTerminal(context).snapshot(id)];
                        case 1:
                            snapshot = _a.sent();
                            return [2 /*return*/, JSON.stringify(__assign({ id: id, host: "wezterm" }, snapshot))];
                    }
                });
            });
        },
    };
}
function interactiveResizeTool() {
    return {
        name: "interactive_terminal_resize",
        description: "Resize an interactive Terminal session.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                rows: { type: "number" },
                cols: { type: "number" },
            },
            required: ["id", "rows", "cols"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, rows, cols, _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            rows = (0, tools_1.numberOr)(args.rows, 36);
                            cols = (0, tools_1.numberOr)(args.cols, 120);
                            _b = (_a = JSON).stringify;
                            _c = modelNativeTerminalInfo;
                            return [4 /*yield*/, requireNativeTerminal(context).resize(id, rows, cols, "model", context.parentSessionID)];
                        case 1: return [2 /*return*/, _b.apply(_a, [_c.apply(void 0, [_d.sent()]),
                                null,
                                2])];
                    }
                });
            });
        },
    };
}
function interactiveRequestHumanTool() {
    return {
        name: "interactive_terminal_request_human",
        description: 'Ask a human to take over the given native Terminal pane: call this when the pane is asking for something the model cannot and must not supply — a password, a secret, a yes/no judgment, an editor session. The reason must be 240 characters or fewer and state only the kind of input needed (e.g. "needs the sudo password"); never repeat screen content, file content, or anything that looks like a secret. With endTurn=false (default) the call returns immediately and you continue with other work, checking back with interactive_terminal_observe. With endTurn=true the current turn ends with a waiting_human result and the runtime automatically starts a new turn once the human finishes and releases the pane — say that you are waiting and do nothing else after the call.',
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                reason: { type: "string", maxLength: 240 },
                endTurn: { type: "boolean" },
            },
            required: ["id", "reason"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, reason, session;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            reason = (0, tools_1.requireString)(args.reason, "reason");
                            return [4 /*yield*/, requireNativeTerminal(context).requestHuman(id, reason, context.parentSessionID)];
                        case 1:
                            session = _a.sent();
                            return [2 /*return*/, JSON.stringify(__assign(__assign({}, modelNativeTerminalInfo(session)), { humanRequested: true, reason: reason, endTurn: args.endTurn === true }), null, 2)];
                    }
                });
            });
        },
    };
}
function interactiveStopTool() {
    return {
        name: "interactive_terminal_stop",
        description: "Stop the native Terminal pane.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var session;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, requireNativeTerminal(context).stop((0, tools_1.requireString)((0, tools_1.requireObject)(input).id, "id"), "model")];
                        case 1:
                            session = _a.sent();
                            return [2 /*return*/, JSON.stringify(__assign(__assign({}, modelNativeTerminalInfo(session)), { status: "exited" }))];
                    }
                });
            });
        },
    };
}
function interactiveListTool() {
    return {
        name: "interactive_terminal_list",
        description: "List real interactive Terminal sessions.",
        requiresApproval: false,
        parameters: { type: "object", properties: {}, additionalProperties: false },
        execute: function (_input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _b = (_a = JSON).stringify;
                            return [4 /*yield*/, requireNativeTerminal(context).list()];
                        case 1: return [2 /*return*/, _b.apply(_a, [(_c.sent()).map(modelNativeTerminalInfo),
                                null,
                                2])];
                    }
                });
            });
        },
    };
}
/** Every interactive terminal tool, including the observe entry point. */
function terminalTools() {
    return [
        interactiveStartTool(),
        terminalObserveTool(),
        interactiveReadTool(),
        interactiveSearchTool(),
        interactiveWriteTool(),
        interactiveSendLineTool(),
        interactiveKeyTool(),
        interactiveInputTool(),
        interactiveSnapshotTool(),
        interactiveResizeTool(),
        interactiveRequestHumanTool(),
        interactiveStopTool(),
        interactiveListTool(),
    ];
}
/**
 * Session scope: the pane is shared with the user and only exists while the
 * session is alive.
 */
function terminalToolFamily() {
    return {
        id: "terminal",
        name: "Terminal Tools",
        version: "1.0.0",
        description: "Native terminal panes and interactive programs.",
        scope: "session",
        tools: __spreadArray([], terminalTools(), true),
        aliases: __assign({}, tools_2.interactiveTerminalToolAliases),
    };
}
