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
exports.isInvalidGeneratedSessionTitle = isInvalidGeneratedSessionTitle;
exports.sanitizeSessionTitleInput = sanitizeSessionTitleInput;
exports.normalizeSessionTitle = normalizeSessionTitle;
exports.fallbackSessionTitle = fallbackSessionTitle;
exports.generateSessionTitle = generateSessionTitle;
var INPUT_LIMIT = 600;
var OUTPUT_LIMIT = 96;
var TITLE_TIMEOUT_MS = 8000;
function isInvalidGeneratedSessionTitle(value) {
    var candidate = value.trim();
    if (!candidate)
        return true;
    return /^(?:chatcmpl(?:[\s_-]+tool)?|cmpl|completion|request|response|req|resp|call|toolu?)[\s_-]+[A-Za-z0-9_-]{6,}$/iu.test(candidate);
}
function sanitizeSessionTitleInput(text) {
    return text
        .replace(/((?:api[_-]?key|token|password|secret)\s*[:=]\s*)[^\s,;]+/giu, "$1[redacted]")
        .replace(/\b(?:sk|pk|rk)[_-][A-Za-z0-9_-]{12,}\b|\bAIza[A-Za-z0-9_-]{12,}\b|\b(?:ghp|github_pat|xox[baprs])_[A-Za-z0-9_-]{12,}\b/gu, "[redacted]")
        .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu, "[redacted]")
        .replace(/\/home\/[^/\s]+(?:\/[^\s]*)?/gu, "[home path]")
        .replace(/\s+/gu, " ")
        .trim()
        .slice(0, INPUT_LIMIT);
}
function normalizeSessionTitle(value) {
    if (isInvalidGeneratedSessionTitle(value))
        return "";
    var normalized = value
        .replace(/[\r\n]+/gu, " ")
        .replace(/[`*_#>[\]{}()"']/gu, "")
        .replace(/[\p{P}\p{S}]+/gu, " ")
        .replace(/\s+/gu, " ")
        .trim()
        .slice(0, OUTPUT_LIMIT);
    return isInvalidGeneratedSessionTitle(normalized) ? "" : normalized;
}
function fallbackSessionTitle(sanitizedText) {
    return normalizeSessionTitle(sanitizedText).slice(0, 64) || "Untitled";
}
function generateSessionTitle(provider_1, text_1) {
    return __awaiter(this, arguments, void 0, function (provider, text, options) {
        var sanitizedText, controller, abort, timer, iterator, rejectCancellation, cancelled, cancelCollection, collect, cleanup;
        var _this = this;
        var _a, _b, _c, _d;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    sanitizedText = sanitizeSessionTitleInput(text);
                    controller = new AbortController();
                    abort = function () { var _a, _b; return controller.abort((_b = (_a = options.signal) === null || _a === void 0 ? void 0 : _a.reason) !== null && _b !== void 0 ? _b : new Error("runtime disposed")); };
                    (_a = options.signal) === null || _a === void 0 ? void 0 : _a.addEventListener("abort", abort, { once: true });
                    if ((_b = options.signal) === null || _b === void 0 ? void 0 : _b.aborted)
                        abort();
                    cancelled = new Promise(function (_, reject) {
                        rejectCancellation = reject;
                    });
                    cancelCollection = function () {
                        return rejectCancellation === null || rejectCancellation === void 0 ? void 0 : rejectCancellation(controller.signal.reason instanceof Error
                            ? controller.signal.reason
                            : new DOMException("session title generation cancelled", "AbortError"));
                    };
                    controller.signal.addEventListener("abort", cancelCollection, { once: true });
                    collect = function () { return __awaiter(_this, void 0, void 0, function () {
                        var output, emittedToolCall, stream, next, chunk;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    output = "";
                                    emittedToolCall = false;
                                    stream = ((_a = options.stream) !== null && _a !== void 0 ? _a : provider.stream.bind(provider))({
                                        signal: controller.signal,
                                        messages: [
                                            {
                                                role: "system",
                                                content: "Create a concise session topic in the same language as the user text. Return only one plain title, no quotes, markdown, punctuation, explanation, tools, or reasoning.",
                                            },
                                            { role: "user", content: sanitizedText },
                                        ],
                                    });
                                    iterator = stream[Symbol.asyncIterator]();
                                    _b.label = 1;
                                case 1:
                                    if (!true) return [3 /*break*/, 3];
                                    return [4 /*yield*/, iterator.next()];
                                case 2:
                                    next = _b.sent();
                                    if (next.done)
                                        return [3 /*break*/, 3];
                                    chunk = next.value;
                                    if (chunk.type === "content")
                                        output += chunk.text;
                                    if (chunk.type === "tool_call")
                                        emittedToolCall = true;
                                    if (output.length >= OUTPUT_LIMIT * 2)
                                        return [3 /*break*/, 3];
                                    return [3 /*break*/, 1];
                                case 3:
                                    if (controller.signal.aborted)
                                        throw controller.signal.reason instanceof Error
                                            ? controller.signal.reason
                                            : new DOMException("session title generation cancelled", "AbortError");
                                    return [2 /*return*/, emittedToolCall ? "" : normalizeSessionTitle(output)];
                            }
                        });
                    }); };
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, , 3, 6]);
                    return [4 /*yield*/, Promise.race([
                            collect(),
                            cancelled,
                            new Promise(function (_, reject) {
                                var _a;
                                timer = setTimeout(function () {
                                    controller.abort(new Error("session title generation timed out"));
                                    reject(new Error("session title generation timed out"));
                                }, (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : TITLE_TIMEOUT_MS);
                            }),
                        ])];
                case 2: return [2 /*return*/, _e.sent()];
                case 3:
                    if (timer)
                        clearTimeout(timer);
                    controller.abort();
                    (_c = options.signal) === null || _c === void 0 ? void 0 : _c.removeEventListener("abort", abort);
                    controller.signal.removeEventListener("abort", cancelCollection);
                    cleanup = (_d = iterator === null || iterator === void 0 ? void 0 : iterator.return) === null || _d === void 0 ? void 0 : _d.call(iterator).catch(function () { return undefined; });
                    if (!cleanup) return [3 /*break*/, 5];
                    return [4 /*yield*/, Promise.race([
                            cleanup,
                            new Promise(function (resolve) { return setTimeout(resolve, 250); }),
                        ])];
                case 4:
                    _e.sent();
                    _e.label = 5;
                case 5: return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
