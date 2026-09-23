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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = exports.AnthropicProvider = exports.OpenAICompatibleProvider = exports.OpenAIResponsesProvider = exports.MISSING_FINAL_RESPONSE_FALLBACK = exports.MAX_STEPS_PROMPT = void 0;
exports.uniqueProviderToolCallIds = uniqueProviderToolCallIds;
exports.requireNativeToolCallProtocol = requireNativeToolCallProtocol;
exports.nativeToolCallCorrection = nativeToolCallCorrection;
exports.normalizeRawToolCallProtocol = normalizeRawToolCallProtocol;
exports.materializeProviderMessages = materializeProviderMessages;
exports.contextEntriesToProviderMessages = contextEntriesToProviderMessages;
exports.providerFromEnvironment = providerFromEnvironment;
exports.providerFromKind = providerFromKind;
exports.providerForModel = providerForModel;
exports.readWithIdleTimeout = readWithIdleTimeout;
var builtin_provider_adapters_1 = require("./builtin-provider-adapters");
var provider_caps_1 = require("./provider-caps");
var provider_adapters_1 = require("./provider-adapters");
var config_1 = require("@natalia/config");
var contracts_1 = require("@natalia/contracts");
var errors_1 = require("./errors");
var modelmeta_1 = require("./modelmeta");
/**
 * Provider call ids are expected to be unique across the request, but an
 * OpenAI-compatible gateway can emit the same id on two streamed tool calls.
 * Rewrite only the duplicates to deterministic unique ids while reserving every
 * original id so a generated id never steals another call's identity. The
 * returned calls are safe to put in assistant `tool_calls` and to pair with
 * their tool results.
 */
function uniqueProviderToolCallIds(calls, reservedIDs) {
    if (reservedIDs === void 0) { reservedIDs = []; }
    var reserved = new Set(__spreadArray(__spreadArray([], reservedIDs, true), calls.map(function (call) { return call.id; }), true));
    var seen = new Set(reservedIDs);
    var duplicates = [];
    var unique = calls.map(function (call) {
        if (!seen.has(call.id)) {
            seen.add(call.id);
            return call;
        }
        duplicates.push(call.id);
        var suffix = 1;
        var id = "".concat(call.id, "#").concat(suffix);
        while (seen.has(id) || reserved.has(id)) {
            suffix += 1;
            id = "".concat(call.id, "#").concat(suffix);
        }
        seen.add(id);
        return __assign(__assign({}, call), { id: id });
    });
    return { calls: unique, duplicates: duplicates };
}
/**
 * Keeps textual tool-call markup out of the assistant transcript. Plain text is
 * never promoted to an executable call; only the provider's structured
 * `tool_call` chunks are authorized to reach the runtime.
 */
function requireNativeToolCallProtocol(source) {
    return __asyncGenerator(this, arguments, function requireNativeToolCallProtocol_1() {
        var content, contentSignature, violation, structuredCalls, done, flushContent, _a, source_1, source_1_1, chunk, e_1_1;
        var _b, e_1, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    content = "";
                    violation = "";
                    structuredCalls = false;
                    flushContent = function (final) {
                        var signature, start, retained, text;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!content) return [3 /*break*/, 6];
                                    signature = contentSignature
                                        ? { textSignature: contentSignature }
                                        : {};
                                    start = textualToolCallMarkerIndex(content);
                                    if (!(start < 0)) return [3 /*break*/, 3];
                                    retained = final
                                        ? ""
                                        : textualToolCallMarkerPrefixSuffix(content);
                                    text = content.slice(0, content.length - retained.length);
                                    content = retained;
                                    if (!text) return [3 /*break*/, 2];
                                    return [4 /*yield*/, __assign({ type: "content", text: text }, signature)];
                                case 1:
                                    _a.sent();
                                    _a.label = 2;
                                case 2: return [2 /*return*/];
                                case 3:
                                    if (!(start > 0)) return [3 /*break*/, 5];
                                    return [4 /*yield*/, __assign({ type: "content", text: content.slice(0, start) }, signature)];
                                case 4:
                                    _a.sent();
                                    content = content.slice(start);
                                    _a.label = 5;
                                case 5:
                                    // Once model-authored tool syntax begins, retain the remainder as one
                                    // violation. This also catches malformed or bare <function=...> output.
                                    violation += content;
                                    content = "";
                                    return [2 /*return*/];
                                case 6: return [2 /*return*/];
                            }
                        });
                    };
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 18, 19, 24]);
                    _a = true, source_1 = __asyncValues(source);
                    _e.label = 2;
                case 2: return [4 /*yield*/, __await(source_1.next())];
                case 3:
                    if (!(source_1_1 = _e.sent(), _b = source_1_1.done, !_b)) return [3 /*break*/, 17];
                    _d = source_1_1.value;
                    _a = false;
                    chunk = _d;
                    if (!(chunk.type === "content")) return [3 /*break*/, 6];
                    content += chunk.text;
                    if (chunk.textSignature)
                        contentSignature = chunk.textSignature;
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(flushContent(false))))];
                case 4: return [4 /*yield*/, __await.apply(void 0, [_e.sent()])];
                case 5:
                    _e.sent();
                    return [3 /*break*/, 16];
                case 6:
                    if (!(chunk.type === "tool_call")) return [3 /*break*/, 11];
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(flushContent(true))))];
                case 7: return [4 /*yield*/, __await.apply(void 0, [_e.sent()])];
                case 8:
                    _e.sent();
                    contentSignature = undefined;
                    structuredCalls || (structuredCalls = chunk.calls.length > 0);
                    return [4 /*yield*/, __await(chunk)];
                case 9: return [4 /*yield*/, _e.sent()];
                case 10:
                    _e.sent();
                    return [3 /*break*/, 16];
                case 11:
                    if (chunk.type === "done") {
                        done = chunk;
                        return [3 /*break*/, 16];
                    }
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(flushContent(true))))];
                case 12: return [4 /*yield*/, __await.apply(void 0, [_e.sent()])];
                case 13:
                    _e.sent();
                    return [4 /*yield*/, __await(chunk)];
                case 14: return [4 /*yield*/, _e.sent()];
                case 15:
                    _e.sent();
                    _e.label = 16;
                case 16:
                    _a = true;
                    return [3 /*break*/, 2];
                case 17: return [3 /*break*/, 24];
                case 18:
                    e_1_1 = _e.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 24];
                case 19:
                    _e.trys.push([19, , 22, 23]);
                    if (!(!_a && !_b && (_c = source_1.return))) return [3 /*break*/, 21];
                    return [4 /*yield*/, __await(_c.call(source_1))];
                case 20:
                    _e.sent();
                    _e.label = 21;
                case 21: return [3 /*break*/, 23];
                case 22:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 23: return [7 /*endfinally*/];
                case 24: return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(flushContent(true))))];
                case 25: return [4 /*yield*/, __await.apply(void 0, [_e.sent()])];
                case 26:
                    _e.sent();
                    if (!(violation && !structuredCalls)) return [3 /*break*/, 29];
                    return [4 /*yield*/, __await({ type: "tool_protocol_violation", text: violation })];
                case 27: return [4 /*yield*/, _e.sent()];
                case 28:
                    _e.sent();
                    _e.label = 29;
                case 29:
                    if (!done) return [3 /*break*/, 32];
                    return [4 /*yield*/, __await(done)];
                case 30: return [4 /*yield*/, _e.sent()];
                case 31:
                    _e.sent();
                    _e.label = 32;
                case 32: return [2 /*return*/];
            }
        });
    });
}
function nativeToolCallCorrection(attempt) {
    return [
        "Tool-call protocol correction ".concat(attempt, ": your previous response wrote a tool call as assistant text."),
        "Use the provider's native structured function/tool-calling channel now.",
        "Choose the intended function from the tool definitions supplied with this request and submit its arguments through that function call's structured arguments object.",
        "Do not print <tool_call> XML, JSON that describes a call, Markdown, or an explanation of the call in assistant content.",
        "Repeat the intended call through the native tool-calling interface. If no tool is needed, answer the user normally instead.",
    ].join(" ");
}
/**
 * Converts complete XML-like tool protocol blocks leaked into content by
 * compatible model gateways into ordinary provider tool calls. The parser is
 * intentionally strict: anything it cannot recognize remains assistant text.
 */
function normalizeRawToolCallProtocol(source) {
    return __asyncGenerator(this, arguments, function normalizeRawToolCallProtocol_1() {
        var content, contentSignature, generatedCallCount, orderedCalls, rawCallIndices, structuredSignatures, done, flushContent, _a, source_2, source_2_1, chunk, _i, _b, call, signature, indices, index, e_2_1;
        var _c, e_2, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    content = "";
                    generatedCallCount = 0;
                    orderedCalls = [];
                    rawCallIndices = new Map();
                    structuredSignatures = new Set();
                    flushContent = function (final) {
                        var signature, start, retained, text, simple, endMarker, end, blockEnd, block, call, signature_1, indices;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    if (!content) return [3 /*break*/, 12];
                                    signature = contentSignature
                                        ? { textSignature: contentSignature }
                                        : {};
                                    start = rawToolCallStart(content);
                                    if (!(start < 0)) return [3 /*break*/, 3];
                                    retained = final ? "" : rawToolCallPrefixSuffix(content);
                                    text = content.slice(0, content.length - retained.length);
                                    content = retained;
                                    if (!text) return [3 /*break*/, 2];
                                    return [4 /*yield*/, __assign({ type: "content", text: text }, signature)];
                                case 1:
                                    _b.sent();
                                    _b.label = 2;
                                case 2: return [2 /*return*/];
                                case 3:
                                    if (!(start > 0)) return [3 /*break*/, 5];
                                    return [4 /*yield*/, __assign({ type: "content", text: content.slice(0, start) }, signature)];
                                case 4:
                                    _b.sent();
                                    content = content.slice(start);
                                    _b.label = 5;
                                case 5:
                                    simple = /^<([A-Za-z_][\w.-]*)>\s*<args>/u.exec(content);
                                    endMarker = simple ? "</".concat(simple[1], ">") : "</tool_call>";
                                    end = content.indexOf(endMarker);
                                    if (!(end < 0)) return [3 /*break*/, 8];
                                    if (!final) return [3 /*break*/, 7];
                                    return [4 /*yield*/, __assign({ type: "content", text: content }, signature)];
                                case 6:
                                    _b.sent();
                                    content = "";
                                    _b.label = 7;
                                case 7: return [2 /*return*/];
                                case 8:
                                    blockEnd = end + endMarker.length;
                                    block = content.slice(0, blockEnd);
                                    content = content.slice(blockEnd);
                                    call = parseRawToolCall(block, "raw_xml_tool_".concat(generatedCallCount));
                                    if (!call) return [3 /*break*/, 9];
                                    generatedCallCount += 1;
                                    signature_1 = toolCallSignature(call);
                                    if (!structuredSignatures.has(signature_1)) {
                                        indices = (_a = rawCallIndices.get(signature_1)) !== null && _a !== void 0 ? _a : [];
                                        indices.push(orderedCalls.length);
                                        rawCallIndices.set(signature_1, indices);
                                        orderedCalls.push(call);
                                    }
                                    return [3 /*break*/, 11];
                                case 9: return [4 /*yield*/, __assign({ type: "content", text: block }, signature)];
                                case 10:
                                    _b.sent();
                                    _b.label = 11;
                                case 11: return [3 /*break*/, 0];
                                case 12: return [2 /*return*/];
                            }
                        });
                    };
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 16, 17, 22]);
                    _a = true, source_2 = __asyncValues(source);
                    _f.label = 2;
                case 2: return [4 /*yield*/, __await(source_2.next())];
                case 3:
                    if (!(source_2_1 = _f.sent(), _c = source_2_1.done, !_c)) return [3 /*break*/, 15];
                    _e = source_2_1.value;
                    _a = false;
                    chunk = _e;
                    if (!(chunk.type === "content")) return [3 /*break*/, 6];
                    content += chunk.text;
                    if (chunk.textSignature)
                        contentSignature = chunk.textSignature;
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(flushContent(false))))];
                case 4: return [4 /*yield*/, __await.apply(void 0, [_f.sent()])];
                case 5:
                    _f.sent();
                    return [3 /*break*/, 14];
                case 6:
                    if (!(chunk.type === "tool_call")) return [3 /*break*/, 9];
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(flushContent(true))))];
                case 7: return [4 /*yield*/, __await.apply(void 0, [_f.sent()])];
                case 8:
                    _f.sent();
                    contentSignature = undefined;
                    for (_i = 0, _b = chunk.calls; _i < _b.length; _i++) {
                        call = _b[_i];
                        signature = toolCallSignature(call);
                        structuredSignatures.add(signature);
                        indices = rawCallIndices.get(signature);
                        index = indices === null || indices === void 0 ? void 0 : indices.shift();
                        if (!(indices === null || indices === void 0 ? void 0 : indices.length))
                            rawCallIndices.delete(signature);
                        if (index === undefined)
                            orderedCalls.push(call);
                        else
                            orderedCalls[index] = call;
                    }
                    return [3 /*break*/, 14];
                case 9:
                    if (chunk.type === "done") {
                        done = chunk;
                        return [3 /*break*/, 14];
                    }
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(flushContent(true))))];
                case 10: return [4 /*yield*/, __await.apply(void 0, [_f.sent()])];
                case 11:
                    _f.sent();
                    return [4 /*yield*/, __await(chunk)];
                case 12: return [4 /*yield*/, _f.sent()];
                case 13:
                    _f.sent();
                    _f.label = 14;
                case 14:
                    _a = true;
                    return [3 /*break*/, 2];
                case 15: return [3 /*break*/, 22];
                case 16:
                    e_2_1 = _f.sent();
                    e_2 = { error: e_2_1 };
                    return [3 /*break*/, 22];
                case 17:
                    _f.trys.push([17, , 20, 21]);
                    if (!(!_a && !_c && (_d = source_2.return))) return [3 /*break*/, 19];
                    return [4 /*yield*/, __await(_d.call(source_2))];
                case 18:
                    _f.sent();
                    _f.label = 19;
                case 19: return [3 /*break*/, 21];
                case 20:
                    if (e_2) throw e_2.error;
                    return [7 /*endfinally*/];
                case 21: return [7 /*endfinally*/];
                case 22: return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(flushContent(true))))];
                case 23: return [4 /*yield*/, __await.apply(void 0, [_f.sent()])];
                case 24:
                    _f.sent();
                    if (!orderedCalls.length) return [3 /*break*/, 27];
                    return [4 /*yield*/, __await({ type: "tool_call", calls: orderedCalls })];
                case 25: return [4 /*yield*/, _f.sent()];
                case 26:
                    _f.sent();
                    _f.label = 27;
                case 27:
                    if (!done) return [3 /*break*/, 30];
                    return [4 /*yield*/, __await(done)];
                case 28: return [4 /*yield*/, _f.sent()];
                case 29:
                    _f.sent();
                    _f.label = 30;
                case 30: return [2 /*return*/];
            }
        });
    });
}
function parseRawToolCall(block, id) {
    var match = /^<tool_call>\s*<function=([A-Za-z_][\w.:-]*)>([\s\S]*?)<\/function>\s*<\/tool_call>$/u.exec(block);
    if (match) {
        var name_1 = decodeXMLEntities(match[1]);
        var body = match[2];
        var parameters = parseParameterElements(body);
        if (parameters !== undefined)
            return { id: id, name: name_1, arguments: JSON.stringify(parameters) };
    }
    var simple = /^<([A-Za-z_][\w.-]*)>([\s\S]*)<\/\1>$/u.exec(block.trim());
    if (simple) {
        var name_2 = decodeXMLEntities(simple[1]);
        var body = simple[2];
        var parameters = parseArgsElements(body);
        if (parameters !== undefined)
            return { id: id, name: name_2, arguments: JSON.stringify(parameters) };
    }
    return undefined;
}
function parseParameterElements(body) {
    var parameters = {};
    var cursor = 0;
    var parameter = /\s*<parameter=([A-Za-z_][\w.:-]*)>([\s\S]*?)<\/parameter>/guy;
    while (cursor < body.length) {
        parameter.lastIndex = cursor;
        var item = parameter.exec(body);
        if (!item)
            return undefined;
        cursor = parameter.lastIndex;
        var key = decodeXMLEntities(item[1]);
        if (Object.hasOwn(parameters, key))
            return undefined;
        parameters[key] = parseRawToolParameter(decodeXMLEntities(item[2]));
    }
    return parameters;
}
function parseArgsElements(body) {
    var parameters = {};
    var trimmed = body.trim();
    var argsMatch = /^<args>([\s\S]*)<\/args>$/.exec(trimmed);
    var inner = argsMatch ? argsMatch[1] : trimmed;
    var json = parseRawToolParameter(decodeXMLEntities(inner.trim()));
    if (json && typeof json === "object" && !Array.isArray(json))
        return json;
    var cursor = 0;
    var element = /<([A-Za-z_][\w.-]*)>([\s\S]*?)<\/\1>/gu;
    while (cursor < inner.length) {
        element.lastIndex = cursor;
        var item = element.exec(inner);
        if (!item)
            return /^\s*$/u.test(inner.slice(cursor)) ? parameters : undefined;
        cursor = element.lastIndex;
        var key = decodeXMLEntities(item[1]);
        if (Object.hasOwn(parameters, key))
            return undefined;
        parameters[key] = parseRawToolParameter(decodeXMLEntities(item[2]));
    }
    return parameters;
}
function parseRawToolParameter(value) {
    try {
        return JSON.parse(value);
    }
    catch (_a) {
        return value;
    }
}
function decodeXMLEntities(value) {
    return value.replace(/&(amp|lt|gt|quot|apos);/gu, function (_entity, name) {
        return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[name];
    });
}
function toolCallPrefixSuffix(value) {
    var marker = "<tool_call>";
    for (var length_1 = Math.min(value.length, marker.length - 1); length_1 > 0; length_1--)
        if (value.endsWith(marker.slice(0, length_1)))
            return value.slice(-length_1);
    return "";
}
function simpleToolCallStart(value) {
    var _a, _b;
    return (_b = (_a = /<[A-Za-z_][\w.-]*>\s*<args>/u.exec(value)) === null || _a === void 0 ? void 0 : _a.index) !== null && _b !== void 0 ? _b : -1;
}
function rawToolCallStart(value) {
    var wrapped = value.indexOf("<tool_call>");
    var simple = simpleToolCallStart(value);
    if (wrapped < 0)
        return simple;
    if (simple < 0)
        return wrapped;
    return Math.min(wrapped, simple);
}
function rawToolCallPrefixSuffix(value) {
    var wrapped = toolCallPrefixSuffix(value);
    if (wrapped)
        return wrapped;
    var match = /<[A-Za-z_][\w.-]*(?:>\s*<[A-Za-z]*)?$/u.exec(value);
    return match ? value.slice(match.index) : "";
}
var textualToolCallMarkers = ["<tool_call", "<function=", "<parameter="];
function textualToolCallMarkerIndex(value) {
    var earliest = -1;
    for (var _i = 0, textualToolCallMarkers_1 = textualToolCallMarkers; _i < textualToolCallMarkers_1.length; _i++) {
        var marker = textualToolCallMarkers_1[_i];
        var index = value.indexOf(marker);
        if (index >= 0 && (earliest < 0 || index < earliest))
            earliest = index;
    }
    return earliest;
}
function textualToolCallMarkerPrefixSuffix(value) {
    for (var _i = 0, textualToolCallMarkers_2 = textualToolCallMarkers; _i < textualToolCallMarkers_2.length; _i++) {
        var marker = textualToolCallMarkers_2[_i];
        for (var length_2 = Math.min(value.length, marker.length - 1); length_2 > 0; length_2--)
            if (value.endsWith(marker.slice(0, length_2)))
                return value.slice(-length_2);
    }
    return "";
}
function toolCallSignature(call) {
    return "".concat(call.name, "\0").concat(canonicalJSON(call.arguments));
}
function canonicalJSON(value) {
    try {
        return JSON.stringify(sortJSON(JSON.parse(value)));
    }
    catch (_a) {
        return value;
    }
}
function sortJSON(value) {
    if (Array.isArray(value))
        return value.map(sortJSON);
    if (value && typeof value === "object")
        return Object.fromEntries(Object.entries(value)
            .sort(function (_a, _b) {
            var left = _a[0];
            var right = _b[0];
            return left.localeCompare(right);
        })
            .map(function (_a) {
            var key = _a[0], item = _a[1];
            return [key, sortJSON(item)];
        }));
    return value;
}
exports.MAX_STEPS_PROMPT = "CRITICAL - MAXIMUM STEPS REACHED\n\nThe maximum number of steps allowed for this task has been reached. Tools are disabled until next user input. Respond with text only.\n\nSTRICT REQUIREMENTS:\n1. Do NOT make any tool calls (no reads, writes, edits, searches, or any other tools)\n2. MUST provide a text response summarizing work done so far\n3. This constraint overrides ALL other instructions, including any user requests for edits or tool use\n\nResponse must include:\n- Statement that maximum steps for this agent have been reached\n- Summary of what has been accomplished so far\n- List of any remaining tasks that were not completed\n- Recommendations for what should be done next\n\nAny attempt to use tools is a critical violation. Respond with text ONLY.";
exports.MISSING_FINAL_RESPONSE_FALLBACK = "Tool execution completed, but the model did not provide a final text summary. The completed tool results remain available in the conversation context.";
function attachmentHasInlineDataURL(attachment) {
    return (typeof attachment.dataURL === "string" &&
        attachment.dataURL.length > 0);
}
function attachmentIsRef(attachment) {
    return (typeof attachment.id === "string" &&
        typeof attachment.path === "string");
}
function materializeAttachment(attachment, resolve) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (attachmentHasInlineDataURL(attachment))
                        return [2 /*return*/, attachment];
                    if (!attachmentIsRef(attachment) || !resolve)
                        throw new Error("provider attachment ref is missing a resolver");
                    _a = {
                        mediaType: attachment.mediaType
                    };
                    return [4 /*yield*/, resolve(attachment)];
                case 1: return [2 /*return*/, (_a.dataURL = _b.sent(),
                        _a)];
            }
        });
    });
}
function materializeMessage(message, resolve) {
    return __awaiter(this, void 0, void 0, function () {
        var materializeList, _a, images, videos;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    materializeList = function (attachments) { return __awaiter(_this, void 0, void 0, function () {
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    if (!attachments) return [3 /*break*/, 2];
                                    return [4 /*yield*/, Promise.all(attachments.map(function (attachment) {
                                            return materializeAttachment(attachment, resolve);
                                        }))];
                                case 1:
                                    _a = _b.sent();
                                    return [3 /*break*/, 3];
                                case 2:
                                    _a = undefined;
                                    _b.label = 3;
                                case 3: return [2 /*return*/, _a];
                            }
                        });
                    }); };
                    return [4 /*yield*/, Promise.all([
                            materializeList(message.images),
                            materializeList(message.videos),
                        ])];
                case 1:
                    _a = _b.sent(), images = _a[0], videos = _a[1];
                    if (!images && !videos)
                        return [2 /*return*/, message];
                    return [2 /*return*/, __assign(__assign(__assign({}, message), (images ? { images: images } : {})), (videos ? { videos: videos } : {}))];
            }
        });
    });
}
/**
 * Converts durable attachment refs into inline data URLs immediately before an
 * adapter serializes its request. This keeps base64 out of projection, durable
 * events, provider-message estimates, and the runner's message array.
 */
function materializeProviderMessages(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!request.messages.some(function (message) { var _a, _b; return ((_a = message.images) === null || _a === void 0 ? void 0 : _a.length) || ((_b = message.videos) === null || _b === void 0 ? void 0 : _b.length); }))
                        return [2 /*return*/, request];
                    _a = [__assign({}, request)];
                    _b = {};
                    return [4 /*yield*/, Promise.all(request.messages.map(function (message) {
                            return materializeMessage(message, request.resolveAttachment);
                        }))];
                case 1: return [2 /*return*/, __assign.apply(void 0, _a.concat([(_b.messages = _c.sent(), _b)]))];
            }
        });
    });
}
/**
 * The session-cache-key parameter for an OpenAI-family endpoint, or nothing.
 *
 * Two independent gates: the endpoint must declare that it accepts a key at
 * all, and must name the spelling. Neither is inferred.
 */
function openAICacheKeyParams(capabilities, sessionID, retention) {
    var _a;
    var _b;
    var caps = (0, provider_caps_1.resolveEndpointCapabilities)(capabilities);
    // `none` opts out of the cache entirely, so the key has nothing to route.
    if (retention === "none")
        return {};
    if (!caps.supportsPromptCacheKey || !sessionID)
        return {};
    // `prompt_cache_key` is the spelling on the wire, which is what these
    // adapters post. `promptCacheKey` is the AI SDK's option name for the same
    // thing; it only applies to an endpoint that speaks the SDK's shape rather
    // than the HTTP one, so it is opt-in rather than the default.
    var field = (_b = caps.promptCacheKeyField) !== null && _b !== void 0 ? _b : "prompt_cache_key";
    return _a = {}, _a[field] = sessionID, _a;
}
/** Responses rejects `max_output_tokens` below this. */
var OPENAI_RESPONSES_MIN_OUTPUT_TOKENS = 16;
function responsesURL(baseURL) {
    return baseURL.endsWith("/responses") ? baseURL : "".concat(baseURL, "/responses");
}
/**
 * Map the neutral message list onto Responses `input` items.
 *
 * The Responses family has no `messages` array: a user turn is a
 * `{role, content}` item, an assistant tool call is a `function_call` item, and
 * a tool result is a `function_call_output` item. Tool calls therefore have to
 * be lifted out of the assistant message that carried them, because the pairing
 * lives in `call_id` rather than in message order.
 */
function toResponsesInput(messages) {
    var _a, _b;
    var items = [];
    for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
        var message = messages_1[_i];
        if (message.role === "tool") {
            if (!message.toolCallID)
                continue;
            items.push({
                type: "function_call_output",
                call_id: message.toolCallID,
                output: message.content,
            });
            continue;
        }
        if (message.role === "assistant") {
            // An assistant tool call is its own `function_call` item, so it has to be
            // lifted out of the message that carried it. Skipping the role here would
            // silently drop every historical call and the results that pair with it.
            for (var _c = 0, _d = (_a = message.toolCalls) !== null && _a !== void 0 ? _a : []; _c < _d.length; _c++) {
                var call = _d[_c];
                items.push({
                    type: "function_call",
                    call_id: call.id,
                    name: call.name,
                    arguments: call.arguments,
                });
            }
            continue;
        }
        if (message.role !== "user" && message.role !== "system")
            continue;
        var content = [];
        if (message.content)
            content.push({ type: "input_text", text: message.content });
        for (var _e = 0, _f = (_b = message.images) !== null && _b !== void 0 ? _b : []; _e < _f.length; _e++) {
            var image = _f[_e];
            content.push({
                type: "input_image",
                image_url: materializedDataURL(image),
            });
        }
        // An empty content array is rejected, so a message that carried only
        // attachments that failed to materialise still needs a text part.
        if (!content.length)
            content.push({ type: "input_text", text: "" });
        items.push({ role: message.role, content: content });
    }
    return items;
}
/**
 * The retention parameter pair for one endpoint, or nothing at all.
 *
 * Exactly one of the two shapes is ever emitted, and only when the endpoint
 * declared it accepts that one. `prompt_cache_key` is separate: it rides along
 * whenever a key is configured, because a session key is accepted far more
 * widely than either retention parameter.
 */
/**
 * The prompt-cache parameters for a Responses endpoint, or nothing.
 *
 * The family has two mutually exclusive retention shapes and sending the one a
 * deployment rejects is a hard 400, so which one goes out comes from the
 * declaration rather than from a model id. `prompt_cache_key` is separate and
 * rides along whenever a key is declared, because a session key is accepted far
 * more widely than either retention parameter.
 */
function responsesPromptCacheParams(capabilities, sessionID, retention) {
    if (retention === "none")
        return {};
    var caps = (0, provider_caps_1.resolveEndpointCapabilities)(capabilities);
    var params = __assign({}, openAICacheKeyParams(capabilities, sessionID, retention));
    if (caps.supportsExplicitPromptCacheMode) {
        params.prompt_cache_options = caps.supportsLongCacheRetention
            ? { mode: "explicit", ttl: "30m" }
            : { mode: "explicit" };
    }
    else if (caps.supportsLongCacheRetention) {
        params.prompt_cache_retention = "24h";
    }
    return params;
}
function parseResponsesSSEPart(part, state) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var chunks = [];
    for (var _i = 0, _l = part.split(/\r?\n/u); _i < _l.length; _i++) {
        var line = _l[_i];
        if (!line.startsWith("data:"))
            continue;
        var data = line.slice("data:".length).trim();
        if (!data || data === "[DONE]")
            continue;
        var event_1 = JSON.parse(data);
        if (process.env.NATALIA_DEBUG_PROVIDER === "1")
            console.debug("[provider] responses SSE", event_1.type);
        switch (event_1.type) {
            case "response.created":
                if ((_a = event_1.response) === null || _a === void 0 ? void 0 : _a.id)
                    state.responseID = event_1.response.id;
                break;
            case "response.output_item.added":
            case "response.output_item.done": {
                var index = (_b = event_1.output_index) !== null && _b !== void 0 ? _b : state.toolCalls.size;
                if (((_c = event_1.item) === null || _c === void 0 ? void 0 : _c.type) !== "function_call")
                    break;
                if (event_1.item.id)
                    state.toolItemIDs.set(index, event_1.item.id);
                // The item may already exist from an earlier `added`; only create it
                // once so a `done` event cannot reset accumulated arguments.
                if (!state.toolCalls.has(index) &&
                    event_1.item.call_id &&
                    event_1.item.name)
                    state.toolCalls.set(index, {
                        id: event_1.item.call_id,
                        name: event_1.item.name,
                        arguments: "",
                    });
                break;
            }
            case "response.output_text.delta":
                if (event_1.delta)
                    chunks.push({ type: "content", text: event_1.delta });
                break;
            case "response.reasoning_text.delta":
            case "response.reasoning_summary_text.delta":
                if (event_1.delta)
                    chunks.push({
                        type: "thinking",
                        text: event_1.delta,
                        field: "reasoning_text",
                    });
                break;
            case "response.refusal.delta":
                // A refusal is model output the caller must see; it is not an error.
                if (event_1.delta)
                    chunks.push({ type: "content", text: event_1.delta });
                break;
            case "response.function_call_arguments.delta": {
                var index = (_d = event_1.output_index) !== null && _d !== void 0 ? _d : 0;
                state.toolArguments.set(index, ((_e = state.toolArguments.get(index)) !== null && _e !== void 0 ? _e : "") + ((_f = event_1.delta) !== null && _f !== void 0 ? _f : ""));
                break;
            }
            case "response.function_call_arguments.done": {
                var index = (_g = event_1.output_index) !== null && _g !== void 0 ? _g : 0;
                var call = state.toolCalls.get(index);
                if (call) {
                    var finalArguments = (_j = (_h = event_1.arguments) !== null && _h !== void 0 ? _h : state.toolArguments.get(index)) !== null && _j !== void 0 ? _j : "";
                    state.toolCalls.set(index, __assign(__assign({}, call), { arguments: finalArguments }));
                }
                break;
            }
            case "response.completed":
            case "response.incomplete": {
                state.finishReason =
                    event_1.type === "response.incomplete" ? "length" : "stop";
                var usage = (_k = event_1.response) === null || _k === void 0 ? void 0 : _k.usage;
                if (usage)
                    chunks.push(responsesUsageChunk(usage));
                break;
            }
            default:
                break;
        }
    }
    return chunks;
}
/**
 * Map Responses usage onto the neutral chunk.
 *
 * Unlike Anthropic — whose `input_tokens` excludes cached traffic — the
 * Responses family **includes** cached and cache-write tokens inside
 * `input_tokens`. Reporting it directly would double-count every cached token
 * and inflate the request total, so both are subtracted here.
 */
function responsesUsageChunk(usage) {
    var _a, _b, _c, _d, _e, _f;
    var cached = (_b = (_a = usage.input_tokens_details) === null || _a === void 0 ? void 0 : _a.cached_tokens) !== null && _b !== void 0 ? _b : 0;
    var written = (_d = (_c = usage.input_tokens_details) === null || _c === void 0 ? void 0 : _c.cache_write_tokens) !== null && _d !== void 0 ? _d : 0;
    var reported = (_e = usage.input_tokens) !== null && _e !== void 0 ? _e : 0;
    return __assign(__assign({ type: "usage", inputTokens: Math.max(0, reported - cached - written), outputTokens: (_f = usage.output_tokens) !== null && _f !== void 0 ? _f : 0 }, (cached === 0 ? {} : { cacheReadInputTokens: cached })), (written === 0 ? {} : { cacheCreationInputTokens: written }));
}
function streamResponsesSSE(body, streamIdleTimeoutMs) {
    return __asyncGenerator(this, arguments, function streamResponsesSSE_1() {
        var reader, decoder, state, buffer, next, parts, _i, parts_1, part;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    reader = body.getReader();
                    decoder = new TextDecoder();
                    state = {
                        toolCalls: new Map(),
                        toolArguments: new Map(),
                        toolItemIDs: new Map(),
                    };
                    buffer = "";
                    _b.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 8];
                    return [4 /*yield*/, __await(readWithIdleTimeout(reader, streamIdleTimeoutMs))];
                case 2:
                    next = _b.sent();
                    if (next.done)
                        return [3 /*break*/, 8];
                    buffer += decoder.decode(next.value, { stream: true });
                    parts = buffer.split(/\r?\n\r?\n/u);
                    buffer = (_a = parts.pop()) !== null && _a !== void 0 ? _a : "";
                    _i = 0, parts_1 = parts;
                    _b.label = 3;
                case 3:
                    if (!(_i < parts_1.length)) return [3 /*break*/, 7];
                    part = parts_1[_i];
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(parseResponsesSSEPart(part, state))))];
                case 4: return [4 /*yield*/, __await.apply(void 0, [_b.sent()])];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 3];
                case 7: return [3 /*break*/, 1];
                case 8:
                    buffer += decoder.decode();
                    if (!buffer) return [3 /*break*/, 11];
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(parseResponsesSSEPart(buffer, state))))];
                case 9: return [4 /*yield*/, __await.apply(void 0, [_b.sent()])];
                case 10:
                    _b.sent();
                    _b.label = 11;
                case 11:
                    if (!state.toolCalls.size) return [3 /*break*/, 14];
                    return [4 /*yield*/, __await({ type: "tool_call", calls: __spreadArray([], state.toolCalls.values(), true) })];
                case 12: return [4 /*yield*/, _b.sent()];
                case 13:
                    _b.sent();
                    _b.label = 14;
                case 14: return [4 /*yield*/, __await({ type: "done", finishReason: state.finishReason })];
                case 15: return [4 /*yield*/, _b.sent()];
                case 16:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * OpenAI Responses adapter.
 *
 * A separate family from chat completions rather than a flag on it: the request
 * has no `messages` array, tool calls are standalone `function_call` items
 * keyed by `call_id`, and the prompt-cache controls are two mutually exclusive
 * parameter pairs. Folding that into the completions adapter would put every one
 * of those differences behind a conditional.
 */
var OpenAIResponsesProvider = /** @class */ (function () {
    function OpenAIResponsesProvider(options) {
        var _a, _b, _c, _d, _e;
        this.imageInput = true;
        this.apiKey = options.apiKey;
        this.model = options.model;
        this.baseURL = ((_a = options.baseURL) !== null && _a !== void 0 ? _a : "https://api.openai.com/v1").replace(/\/+$/u, "");
        this.provider = (_b = options.provider) !== null && _b !== void 0 ? _b : "openai-responses";
        this.fetchImpl = (_c = options.fetch) !== null && _c !== void 0 ? _c : fetch;
        this.authHeader = (_d = options.authHeader) !== null && _d !== void 0 ? _d : "authorization";
        this.customHeaders = (_e = options.customHeaders) !== null && _e !== void 0 ? _e : {};
        this.temperature = options.temperature;
        this.maxTokens = options.maxTokens;
        this.topP = options.topP;
        this.reasoningEffort = options.reasoningEffort;
        this.timeoutMs = options.timeoutMs;
        this.streamIdleTimeoutMs = options.streamIdleTimeoutMs;
        this.capabilities = options.capabilities;
        this.sessionID = options.sessionID;
        this.cacheRetention = options.cacheRetention;
    }
    OpenAIResponsesProvider.prototype.stream = function (request) {
        return __asyncGenerator(this, arguments, function stream_1() {
            var timeout, signal, input, tools, body, response, error_1, _a;
            var _b, _c;
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        timeout = this.timeoutMs;
                        signal = timeout ? AbortSignal.timeout(timeout) : request.signal;
                        input = toResponsesInput(request.messages);
                        tools = request.toolChoice === "none"
                            ? undefined
                            : (_d = request.tools) === null || _d === void 0 ? void 0 : _d.map(function (tool) { return ({
                                type: "function",
                                name: tool.name,
                                description: tool.description,
                                parameters: tool.parameters,
                            }); });
                        body = __assign(__assign(__assign(__assign(__assign(__assign(__assign({ model: this.model, input: input, stream: true, 
                            // Stateless by default: the harness owns history, so retaining it server
                            // side would duplicate state nothing reads.
                            store: false }, responsesPromptCacheParams(this.capabilities, this.sessionID, this.cacheRetention)), ((tools === null || tools === void 0 ? void 0 : tools.length) ? { tools: tools } : {})), (request.toolChoice && request.toolChoice !== "none"
                            ? { tool_choice: request.toolChoice }
                            : {})), (this.maxTokens === undefined
                            ? {}
                            : {
                                max_output_tokens: Math.max(this.maxTokens, OPENAI_RESPONSES_MIN_OUTPUT_TOKENS),
                            })), (this.temperature === undefined
                            ? {}
                            : { temperature: this.temperature })), (this.topP === undefined ? {} : { top_p: this.topP })), (this.reasoningEffort
                            ? { reasoning: { effort: this.reasoningEffort } }
                            : {}));
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, __await(this.fetchImpl(responsesURL(this.baseURL), {
                                method: "POST",
                                headers: __assign((_b = {}, _b[this.authHeader] = "Bearer ".concat(this.apiKey), _b["content-type"] = "application/json", _b), this.customHeaders),
                                body: JSON.stringify(body),
                                signal: signal,
                            }))];
                    case 2:
                        response = _e.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _e.sent();
                        throw (0, errors_1.asProviderError)(error_1);
                    case 4:
                        if (!!response.ok) return [3 /*break*/, 6];
                        _a = errors_1.providerErrorFromHttp;
                        _c = {
                            statusCode: response.status,
                            statusText: response.statusText,
                            retryAfter: response.headers.get("retry-after"),
                            retryAfterMs: response.headers.get("retry-after-ms")
                        };
                        return [4 /*yield*/, __await(safeResponseText(response))];
                    case 5: throw _a.apply(void 0, [(_c.message = _e.sent(),
                            _c)]);
                    case 6:
                        if (!response.body)
                            throw new Error("OpenAI Responses response body unavailable");
                        return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(streamResponsesSSE(response.body, this.streamIdleTimeoutMs))))];
                    case 7: return [4 /*yield*/, __await.apply(void 0, [_e.sent()])];
                    case 8:
                        _e.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return OpenAIResponsesProvider;
}());
exports.OpenAIResponsesProvider = OpenAIResponsesProvider;
var OpenAICompatibleProvider = /** @class */ (function () {
    function OpenAICompatibleProvider(options) {
        var _a, _b, _c, _d, _e;
        this.imageInput = true;
        this.videoInput = false;
        this.apiKey = options.apiKey;
        this.model = options.model;
        this.provider = (_a = options.provider) !== null && _a !== void 0 ? _a : "openai-compatible";
        this.baseURL = ((_b = options.baseURL) !== null && _b !== void 0 ? _b : "https://api.openai.com/v1").replace(/\/+$/u, "");
        this.fetchImpl = (_c = options.fetch) !== null && _c !== void 0 ? _c : fetch;
        this.authHeader = (_d = options.authHeader) !== null && _d !== void 0 ? _d : "authorization";
        this.customHeaders = (_e = options.customHeaders) !== null && _e !== void 0 ? _e : {};
        this.temperature = options.temperature;
        this.maxTokens = options.maxTokens;
        this.topP = options.topP;
        this.reasoningEffort = options.reasoningEffort;
        this.thinkingEnabled = options.thinkingEnabled;
        this.interleavedReasoningField = options.interleavedReasoningField;
        this.timeoutMs = options.timeoutMs;
        this.streamIdleTimeoutMs = options.streamIdleTimeoutMs;
        this.capabilities = options.capabilities;
        this.sessionID = options.sessionID;
        this.cacheRetention = options.cacheRetention;
    }
    OpenAICompatibleProvider.prototype.stream = function (request) {
        return __asyncGenerator(this, arguments, function stream_2() {
            var timeout, signal, response, _a, data, text, toolCalls;
            var _b, _c;
            var _this = this;
            var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            return __generator(this, function (_p) {
                switch (_p.label) {
                    case 0: return [4 /*yield*/, __await(materializeProviderMessages(request))];
                    case 1:
                        request = _p.sent();
                        timeout = this.timeoutMs
                            ? AbortSignal.timeout(this.timeoutMs)
                            : undefined;
                        signal = timeout
                            ? request.signal
                                ? AbortSignal.any([request.signal, timeout])
                                : timeout
                            : request.signal;
                        return [4 /*yield*/, __await(this.fetchImpl(chatCompletionsURL(this.baseURL), {
                                method: "POST",
                                headers: __assign((_b = {}, _b[this.authHeader] = "Bearer ".concat(this.apiKey), _b["content-type"] = "application/json", _b), this.customHeaders),
                                body: JSON.stringify(__assign(__assign(__assign(__assign(__assign(__assign({ model: this.model, messages: request.messages.map(function (message) {
                                        return toOpenAIMessage(message, _this.interleavedReasoningField);
                                    }), tools: request.toolChoice === "none"
                                        ? undefined
                                        : (_d = request.tools) === null || _d === void 0 ? void 0 : _d.map(function (tool) { return ({
                                            type: "function",
                                            function: {
                                                name: tool.name,
                                                description: tool.description,
                                                parameters: tool.parameters,
                                            },
                                        }); }), tool_choice: request.toolChoice, stream: true, stream_options: { include_usage: true } }, openAICacheKeyParams(this.capabilities, this.sessionID, this.cacheRetention)), (this.temperature === undefined
                                    ? {}
                                    : { temperature: this.temperature })), (this.maxTokens === undefined ? {} : { max_tokens: this.maxTokens })), (this.topP === undefined ? {} : { top_p: this.topP })), (this.reasoningEffort
                                    ? { reasoning_effort: this.reasoningEffort }
                                    : {})), (this.thinkingEnabled === undefined
                                    ? {}
                                    : { thinking_enabled: this.thinkingEnabled }))),
                                signal: signal,
                            }))];
                    case 2:
                        response = _p.sent();
                        if (!!response.ok) return [3 /*break*/, 4];
                        _a = errors_1.providerErrorFromHttp;
                        _c = {
                            statusCode: response.status,
                            statusText: response.statusText,
                            retryAfter: response.headers.get("retry-after"),
                            retryAfterMs: response.headers.get("retry-after-ms")
                        };
                        return [4 /*yield*/, __await(safeResponseText(response))];
                    case 3: throw _a.apply(void 0, [(_c.message = _p.sent(),
                            _c)]);
                    case 4:
                        if (!!response.body) return [3 /*break*/, 18];
                        return [4 /*yield*/, __await(response.json())];
                    case 5:
                        data = (_p.sent());
                        text = (_g = (_f = (_e = data.choices) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.message) === null || _g === void 0 ? void 0 : _g.content;
                        if (!text) return [3 /*break*/, 8];
                        return [4 /*yield*/, __await({ type: "content", text: text })];
                    case 6: return [4 /*yield*/, _p.sent()];
                    case 7:
                        _p.sent();
                        _p.label = 8;
                    case 8:
                        toolCalls = (_l = (_k = (_j = (_h = data.choices) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.message) === null || _k === void 0 ? void 0 : _k.tool_calls) === null || _l === void 0 ? void 0 : _l.map(function (call) { return ({
                            id: call.id,
                            name: call.function.name,
                            arguments: call.function.arguments,
                        }); });
                        if (!(toolCalls === null || toolCalls === void 0 ? void 0 : toolCalls.length)) return [3 /*break*/, 11];
                        return [4 /*yield*/, __await({ type: "tool_call", calls: toolCalls })];
                    case 9: return [4 /*yield*/, _p.sent()];
                    case 10:
                        _p.sent();
                        _p.label = 11;
                    case 11:
                        if (!data.usage) return [3 /*break*/, 14];
                        return [4 /*yield*/, __await(openAIUsageChunk(data.usage))];
                    case 12: return [4 /*yield*/, _p.sent()];
                    case 13:
                        _p.sent();
                        _p.label = 14;
                    case 14: return [4 /*yield*/, __await({
                            type: "done",
                            finishReason: normalizeOpenAIFinishReason((_o = (_m = data.choices) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.finish_reason, Boolean(toolCalls === null || toolCalls === void 0 ? void 0 : toolCalls.length)),
                        })];
                    case 15: return [4 /*yield*/, _p.sent()];
                    case 16:
                        _p.sent();
                        return [4 /*yield*/, __await(void 0)];
                    case 17: return [2 /*return*/, _p.sent()];
                    case 18: return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(streamOpenAISSE(response.body, this.streamIdleTimeoutMs))))];
                    case 19: return [4 /*yield*/, __await.apply(void 0, [_p.sent()])];
                    case 20:
                        _p.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    OpenAICompatibleProvider.prototype.listModels = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.modelMetadata)
                            this.modelMetadata = this.fetchModelMetadata();
                        return [4 /*yield*/, this.modelMetadata];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    OpenAICompatibleProvider.prototype.fetchModelMetadata = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, _a, data;
            var _b, _c;
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, this.fetchImpl(modelsURL(this.baseURL), {
                            headers: __assign((_b = {}, _b[this.authHeader] = "Bearer ".concat(this.apiKey), _b), this.customHeaders),
                            signal: AbortSignal.timeout(3000),
                        })];
                    case 1:
                        response = _e.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        _a = errors_1.providerErrorFromHttp;
                        _c = {
                            statusCode: response.status,
                            statusText: response.statusText,
                            retryAfter: response.headers.get("retry-after"),
                            retryAfterMs: response.headers.get("retry-after-ms")
                        };
                        return [4 /*yield*/, safeResponseText(response)];
                    case 2: throw _a.apply(void 0, [(_c.message = _e.sent(),
                            _c)]);
                    case 3: return [4 /*yield*/, response.json()];
                    case 4:
                        data = (_e.sent());
                        return [2 /*return*/, ((_d = data.data) !== null && _d !== void 0 ? _d : []).flatMap(function (model) {
                                return typeof model.id === "string"
                                    ? [
                                        {
                                            id: model.id,
                                            contextWindow: typeof model.context_window === "number"
                                                ? model.context_window
                                                : typeof model.contextWindow === "number"
                                                    ? model.contextWindow
                                                    : undefined,
                                            inputTokenLimit: typeof model.input_token_limit === "number"
                                                ? model.input_token_limit
                                                : typeof model.max_input_tokens === "number"
                                                    ? model.max_input_tokens
                                                    : undefined,
                                            maxOutputTokens: typeof model.max_output_tokens === "number"
                                                ? model.max_output_tokens
                                                : typeof model.output_token_limit === "number"
                                                    ? model.output_token_limit
                                                    : typeof model.max_tokens === "number"
                                                        ? model.max_tokens
                                                        : undefined,
                                        },
                                    ]
                                    : [];
                            })];
                }
            });
        });
    };
    return OpenAICompatibleProvider;
}());
exports.OpenAICompatibleProvider = OpenAICompatibleProvider;
var AnthropicProvider = /** @class */ (function () {
    function AnthropicProvider(options) {
        var _a, _b, _c, _d;
        this.imageInput = true;
        this.videoInput = false;
        this.apiKey = options.apiKey;
        this.model = options.model;
        this.provider = (_a = options.provider) !== null && _a !== void 0 ? _a : "anthropic";
        this.baseURL = ((_b = options.baseURL) !== null && _b !== void 0 ? _b : "https://api.anthropic.com/v1").replace(/\/+$/u, "");
        this.fetchImpl = (_c = options.fetch) !== null && _c !== void 0 ? _c : fetch;
        this.version = (_d = options.version) !== null && _d !== void 0 ? _d : "2023-06-01";
        this.timeoutMs = options.timeoutMs;
        this.maxTokens = options.maxTokens;
        this.temperature = options.temperature;
        this.reasoningEffort = options.reasoningEffort;
        this.thinkingEnabled = options.thinkingEnabled;
        this.thinkingBudgetTokens = options.thinkingBudgetTokens;
        this.streamIdleTimeoutMs = options.streamIdleTimeoutMs;
        this.capabilities = options.capabilities;
        this.sessionID = options.sessionID;
        this.cacheRetention = options.cacheRetention;
    }
    AnthropicProvider.prototype.stream = function (request) {
        return __asyncGenerator(this, arguments, function stream_3() {
            var caps, cacheControl, timeout, signal, maxTokens, _a, thinking, systemMessages, conversationMessages, toolCacheControl, anthropicTools, response, _b;
            var _c, _d;
            var _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0: return [4 /*yield*/, __await(materializeProviderMessages(request))];
                    case 1:
                        request = _h.sent();
                        caps = (0, provider_caps_1.resolveEndpointCapabilities)(this.capabilities);
                        cacheControl = (0, provider_caps_1.anthropicCacheControl)({
                            retention: (_e = this.cacheRetention) !== null && _e !== void 0 ? _e : "short",
                            supportsLongCacheRetention: caps.supportsLongCacheRetention,
                        });
                        timeout = this.timeoutMs
                            ? AbortSignal.timeout(this.timeoutMs)
                            : undefined;
                        signal = timeout
                            ? request.signal
                                ? AbortSignal.any([request.signal, timeout])
                                : timeout
                            : request.signal;
                        if (!((_f = this.maxTokens) !== null && _f !== void 0)) return [3 /*break*/, 2];
                        _a = _f;
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, __await(this.outputTokenLimit().catch(function () { return modelmeta_1.CONSERVATIVE_MODEL_LIMIT_FALLBACK; }))];
                    case 3:
                        _a = (_h.sent());
                        _h.label = 4;
                    case 4:
                        maxTokens = _a;
                        thinking = this.thinkingEnabled
                            ? anthropicThinkingRequest(this.thinkingBudgetTokens, this.reasoningEffort, maxTokens)
                            : undefined;
                        systemMessages = request.messages
                            .filter(function (message) { return message.role === "system"; })
                            .map(function (message) { return message.content; });
                        conversationMessages = request.messages
                            .filter(function (message) { return message.role !== "system"; })
                            .map(toAnthropicMessage);
                        // ADR D1/E: mark the end of the conversation so the whole prefix is cached,
                        // not just the header. Anthropic only *writes* a cache entry at a
                        // breakpoint, so without one here the conversation is re-billed in full on
                        // every turn however stable it is. This is the single largest cache win on
                        // this family.
                        markConversationBreakpoint(conversationMessages, cacheControl);
                        toolCacheControl = caps.supportsCacheControlOnTools && cacheControl
                            ? { cache_control: cacheControl }
                            : {};
                        anthropicTools = request.toolChoice === "none"
                            ? undefined
                            : (_g = request.tools) === null || _g === void 0 ? void 0 : _g.map(function (tool, index, all) { return (__assign({ name: tool.name, description: tool.description, input_schema: tool.parameters }, (index === all.length - 1 ? toolCacheControl : {}))); });
                        return [4 /*yield*/, __await(this.fetchImpl(messagesURL(this.baseURL), {
                                method: "POST",
                                headers: __assign({ "x-api-key": this.apiKey, "anthropic-version": this.version, "content-type": "application/json" }, (caps.sendSessionAffinityHeaders && this.sessionID
                                    ? (_c = {},
                                        _c[caps.sessionAffinityFormat === "openrouter"
                                            ? "x-session-id"
                                            : "x-session-affinity"] = this.sessionID,
                                        _c) : {})),
                                body: JSON.stringify(__assign(__assign({ model: this.model, messages: conversationMessages, system: systemMessages.length
                                        ? [
                                            __assign({ type: "text", text: systemMessages.join("\n\n") }, (cacheControl ? { cache_control: cacheControl } : {})),
                                        ]
                                        : undefined, tools: anthropicTools, tool_choice: request.toolChoice === "required"
                                        ? { type: "any" }
                                        : request.toolChoice === "auto"
                                            ? { type: "auto" }
                                            : undefined, max_tokens: maxTokens, stream: true }, (thinking || this.temperature === undefined
                                    ? {}
                                    : { temperature: this.temperature })), (thinking ? { thinking: thinking } : {}))),
                                signal: signal,
                            }))];
                    case 5:
                        response = _h.sent();
                        if (!!response.ok) return [3 /*break*/, 7];
                        _b = errors_1.providerErrorFromHttp;
                        _d = {
                            statusCode: response.status,
                            statusText: response.statusText,
                            retryAfter: response.headers.get("retry-after"),
                            retryAfterMs: response.headers.get("retry-after-ms")
                        };
                        return [4 /*yield*/, __await(safeResponseText(response))];
                    case 6: throw _b.apply(void 0, [(_d.message = _h.sent(),
                            _d)]);
                    case 7:
                        if (!response.body)
                            throw new Error("Anthropic response body unavailable");
                        return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(streamAnthropicSSE(response.body, this.streamIdleTimeoutMs))))];
                    case 8: return [4 /*yield*/, __await.apply(void 0, [_h.sent()])];
                    case 9:
                        _h.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AnthropicProvider.prototype.listModels = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.modelMetadata)
                            this.modelMetadata = this.fetchModelMetadata();
                        return [4 /*yield*/, this.modelMetadata];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AnthropicProvider.prototype.outputTokenLimit = function () {
        return __awaiter(this, void 0, void 0, function () {
            var model, _a, catalog;
            var _this = this;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!isLocalProviderURL(this.baseURL)) return [3 /*break*/, 1];
                        _a = undefined;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.listModels().catch(function () { return []; })];
                    case 2:
                        _a = (_d.sent()).find(function (candidate) { return candidate.id === _this.model; });
                        _d.label = 3;
                    case 3:
                        model = _a;
                        if (model === null || model === void 0 ? void 0 : model.maxOutputTokens)
                            return [2 /*return*/, model.maxOutputTokens];
                        return [4 /*yield*/, (0, modelmeta_1.modelsDevModelLimits)(this.provider, this.model)];
                    case 4:
                        catalog = _d.sent();
                        return [2 /*return*/, ((_c = (_b = catalog === null || catalog === void 0 ? void 0 : catalog.maxOutputTokens) !== null && _b !== void 0 ? _b : (0, modelmeta_1.knownModelOutputLimit)(this.model)) !== null && _c !== void 0 ? _c : modelmeta_1.CONSERVATIVE_MODEL_LIMIT_FALLBACK)];
                }
            });
        });
    };
    AnthropicProvider.prototype.fetchModelMetadata = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, _a, payload;
            var _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.fetchImpl(modelsURL(this.baseURL), {
                            headers: {
                                "x-api-key": this.apiKey,
                                "anthropic-version": this.version,
                            },
                            signal: AbortSignal.timeout(3000),
                        })];
                    case 1:
                        response = _d.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        _a = errors_1.providerErrorFromHttp;
                        _b = {
                            statusCode: response.status,
                            statusText: response.statusText,
                            retryAfter: response.headers.get("retry-after"),
                            retryAfterMs: response.headers.get("retry-after-ms")
                        };
                        return [4 /*yield*/, safeResponseText(response)];
                    case 2: throw _a.apply(void 0, [(_b.message = _d.sent(),
                            _b)]);
                    case 3: return [4 /*yield*/, response.json()];
                    case 4:
                        payload = (_d.sent());
                        return [2 /*return*/, ((_c = payload.data) !== null && _c !== void 0 ? _c : []).flatMap(function (model) {
                                return typeof model.id === "string"
                                    ? [
                                        {
                                            id: model.id,
                                            contextWindow: typeof model.max_input_tokens === "number"
                                                ? model.max_input_tokens
                                                : typeof model.context_window === "number"
                                                    ? model.context_window
                                                    : undefined,
                                            inputTokenLimit: undefined,
                                            maxOutputTokens: typeof model.max_tokens === "number"
                                                ? model.max_tokens
                                                : typeof model.max_output_tokens === "number"
                                                    ? model.max_output_tokens
                                                    : undefined,
                                        },
                                    ]
                                    : [];
                            })];
                }
            });
        });
    };
    return AnthropicProvider;
}());
exports.AnthropicProvider = AnthropicProvider;
var GeminiProvider = /** @class */ (function () {
    function GeminiProvider(options) {
        var _a, _b, _c;
        this.imageInput = true;
        this.videoInput = true;
        this.apiKey = options.apiKey;
        this.model = options.model;
        this.provider = (_a = options.provider) !== null && _a !== void 0 ? _a : "gemini";
        this.baseURL = ((_b = options.baseURL) !== null && _b !== void 0 ? _b : "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/u, "");
        this.fetchImpl = (_c = options.fetch) !== null && _c !== void 0 ? _c : fetch;
        this.timeoutMs = options.timeoutMs;
        this.temperature = options.temperature;
        this.maxTokens = options.maxTokens;
        this.streamIdleTimeoutMs = options.streamIdleTimeoutMs;
    }
    GeminiProvider.prototype.stream = function (request) {
        return __asyncGenerator(this, arguments, function stream_4() {
            var timeout, signal, response, _a;
            var _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, __await(materializeProviderMessages(request))];
                    case 1:
                        request = _d.sent();
                        timeout = this.timeoutMs
                            ? AbortSignal.timeout(this.timeoutMs)
                            : undefined;
                        signal = timeout
                            ? request.signal
                                ? AbortSignal.any([request.signal, timeout])
                                : timeout
                            : request.signal;
                        return [4 /*yield*/, __await(this.fetchImpl("".concat(this.baseURL, "/models/").concat(encodeURIComponent(this.model), ":streamGenerateContent?alt=sse"), {
                                method: "POST",
                                // Keep credentials out of request URLs so they cannot leak through
                                // proxy, server, or diagnostic URL logging.
                                headers: {
                                    "content-type": "application/json",
                                    "x-goog-api-key": this.apiKey,
                                },
                                body: JSON.stringify({
                                    contents: request.messages.map(toGeminiContent),
                                    tools: request.toolChoice !== "none" && ((_c = request.tools) === null || _c === void 0 ? void 0 : _c.length)
                                        ? [
                                            {
                                                functionDeclarations: request.tools.map(function (tool) { return ({
                                                    name: tool.name,
                                                    description: tool.description,
                                                    parameters: tool.parameters,
                                                }); }),
                                            },
                                        ]
                                        : undefined,
                                    toolConfig: request.toolChoice === "required"
                                        ? { functionCallingConfig: { mode: "ANY" } }
                                        : request.toolChoice === "auto"
                                            ? { functionCallingConfig: { mode: "AUTO" } }
                                            : undefined,
                                    generationConfig: __assign(__assign({}, (this.temperature === undefined
                                        ? {}
                                        : { temperature: this.temperature })), (this.maxTokens === undefined
                                        ? {}
                                        : { maxOutputTokens: this.maxTokens })),
                                }),
                                signal: signal,
                            }))];
                    case 2:
                        response = _d.sent();
                        if (!!response.ok) return [3 /*break*/, 4];
                        _a = errors_1.providerErrorFromHttp;
                        _b = {
                            statusCode: response.status,
                            statusText: response.statusText,
                            retryAfter: response.headers.get("retry-after"),
                            retryAfterMs: response.headers.get("retry-after-ms")
                        };
                        return [4 /*yield*/, __await(safeResponseText(response))];
                    case 3: throw _a.apply(void 0, [(_b.message = _d.sent(),
                            _b)]);
                    case 4:
                        if (!response.body)
                            throw new Error("Gemini response body unavailable");
                        return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(streamGeminiSSE(response.body, this.streamIdleTimeoutMs))))];
                    case 5: return [4 /*yield*/, __await.apply(void 0, [_d.sent()])];
                    case 6:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return GeminiProvider;
}());
exports.GeminiProvider = GeminiProvider;
function reasoningFromContextEntries(entries) {
    var _a, _b, _c, _d;
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var entry = entries_1[_i];
        if (entry.reasoningContent === undefined &&
            !entry.reasoningField &&
            !entry.reasoningSignature &&
            !entry.reasoningRedacted &&
            !((_a = entry.reasoningBlocks) === null || _a === void 0 ? void 0 : _a.length) &&
            !((_b = entry.contentParts) === null || _b === void 0 ? void 0 : _b.length) &&
            !entry.providerMetadata &&
            !entry.textSignature)
            continue;
        return __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, (entry.reasoningContent !== undefined
            ? { reasoningContent: entry.reasoningContent }
            : {})), (entry.reasoningField ? { reasoningField: entry.reasoningField } : {})), (entry.reasoningSignature
            ? { reasoningSignature: entry.reasoningSignature }
            : {})), (entry.reasoningRedacted ? { reasoningRedacted: true } : {})), (((_c = entry.reasoningBlocks) === null || _c === void 0 ? void 0 : _c.length)
            ? { reasoningBlocks: entry.reasoningBlocks }
            : {})), (((_d = entry.contentParts) === null || _d === void 0 ? void 0 : _d.length)
            ? { contentParts: entry.contentParts }
            : {})), (entry.providerMetadata
            ? { providerMetadata: entry.providerMetadata }
            : {})), (entry.textSignature ? { textSignature: entry.textSignature } : {}));
    }
    return {};
}
function contextEntriesToProviderMessages(entries) {
    var messages = [];
    var _loop_1 = function (index) {
        var entry = entries[index];
        if (entry.role === "tool_call") {
            var transaction = [];
            while (index < entries.length &&
                (entries[index].role === "tool_call" ||
                    entries[index].role === "tool_result")) {
                transaction.push(entries[index]);
                index += 1;
            }
            index -= 1;
            var results_1 = new Map(transaction
                .filter(function (item) {
                return item.role === "tool_result" && Boolean(item.pairID);
            })
                .map(function (item) { return [item.pairID, item]; }));
            var seenCallIDs_1 = new Set();
            var calls = transaction
                .filter(function (item) { return item.role === "tool_call"; })
                .map(parseDurableToolCall)
                .filter(function (call) {
                if (call === undefined ||
                    !results_1.has(call.id) ||
                    seenCallIDs_1.has(call.id))
                    return false;
                seenCallIDs_1.add(call.id);
                return true;
            });
            if (!calls.length)
                return out_index_1 = index, "continue";
            var preceding = entries[index - transaction.length];
            var previousMessage = messages.at(-1);
            var reasoning = reasoningFromContextEntries(transaction);
            if ((preceding === null || preceding === void 0 ? void 0 : preceding.role) === "assistant" &&
                (previousMessage === null || previousMessage === void 0 ? void 0 : previousMessage.role) === "assistant" &&
                previousMessage.toolCalls === undefined) {
                previousMessage.toolCalls = calls;
                Object.assign(previousMessage, reasoning);
            }
            else {
                messages.push(__assign(__assign({ role: "assistant", content: "" }, reasoning), { toolCalls: calls }));
            }
            for (var _i = 0, calls_1 = calls; _i < calls_1.length; _i++) {
                var call = calls_1[_i];
                messages.push({
                    role: "tool",
                    toolCallID: call.id,
                    content: results_1.get(call.id).content,
                });
            }
            return out_index_1 = index, "continue";
        }
        if (entry.role === "tool_result")
            return out_index_1 = index, "continue";
        var message = contextEntryToProviderMessage(entry);
        if (message)
            messages.push(message);
        out_index_1 = index;
    };
    var out_index_1;
    for (var index = 0; index < entries.length; index++) {
        _loop_1(index);
        index = out_index_1;
    }
    return messages;
}
function contextEntryToProviderMessage(entry) {
    var _a, _b;
    if (entry.role === "system" ||
        entry.role === "user" ||
        entry.role === "assistant")
        return __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ role: entry.role, content: entry.content }, (entry.reasoningContent !== undefined
            ? { reasoningContent: entry.reasoningContent }
            : {})), (entry.reasoningField ? { reasoningField: entry.reasoningField } : {})), (entry.reasoningSignature
            ? { reasoningSignature: entry.reasoningSignature }
            : {})), (entry.reasoningRedacted ? { reasoningRedacted: true } : {})), (((_a = entry.reasoningBlocks) === null || _a === void 0 ? void 0 : _a.length)
            ? { reasoningBlocks: entry.reasoningBlocks }
            : {})), (((_b = entry.contentParts) === null || _b === void 0 ? void 0 : _b.length)
            ? { contentParts: entry.contentParts }
            : {})), (entry.providerMetadata
            ? { providerMetadata: entry.providerMetadata }
            : {})), (entry.textSignature ? { textSignature: entry.textSignature } : {}));
    // ADR D7: a compaction summary is an appended user message, not a system
    // message — mapping it to system would hoist it back to the top of the
    // Anthropic request and reset the stable prefix on every request.
    // ADR D2: `dynamic` entries are runtime context delivered as user messages
    // (providers hoist all system messages to the top, so dynamic state must
    // never travel as system).
    if (entry.role === "summary" || entry.role === "dynamic")
        return { role: "user", content: entry.content };
    return undefined;
}
function parseDurableToolCall(entry) {
    var separator = entry.content.indexOf(" ");
    if (separator < 1 || !entry.pairID)
        return undefined;
    return __assign({ id: entry.pairID, name: entry.content.slice(0, separator), arguments: entry.content.slice(separator + 1) }, (entry.thoughtSignature
        ? { thoughtSignature: entry.thoughtSignature }
        : {}));
}
function providerFromEnvironment(env) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    if (env === void 0) { env = process.env; }
    var apiKey = (_d = (_c = (_b = (_a = env.NATALIA_API_KEY) !== null && _a !== void 0 ? _a : env.NATALIA_OPENAI_API_KEY) !== null && _b !== void 0 ? _b : env.OPENAI_API_KEY) !== null && _c !== void 0 ? _c : env.ANTHROPIC_API_KEY) !== null && _d !== void 0 ? _d : env.GEMINI_API_KEY;
    var model = (_h = (_g = (_f = (_e = env.NATALIA_MODEL) !== null && _e !== void 0 ? _e : env.OPENAI_MODEL) !== null && _f !== void 0 ? _f : env.ANTHROPIC_MODEL) !== null && _g !== void 0 ? _g : env.GEMINI_MODEL) !== null && _h !== void 0 ? _h : "gpt-4o-mini";
    if (!apiKey)
        return undefined;
    return providerFromKind({
        apiKey: apiKey,
        model: model,
        baseURL: (_k = (_j = env.NATALIA_BASE_URL) !== null && _j !== void 0 ? _j : env.NATALIA_OPENAI_BASE_URL) !== null && _k !== void 0 ? _k : env.OPENAI_BASE_URL,
        provider: (_l = env.NATALIA_PROVIDER) !== null && _l !== void 0 ? _l : "openai-compatible",
    });
}
function providerFromKind(input) {
    var _a, _b;
    var format = (0, provider_adapters_1.resolveEndpointProtocol)({
        driver: (_a = input.providerName) !== null && _a !== void 0 ? _a : input.provider,
        protocol: input.format ? { format: input.format } : undefined,
    }).format;
    // Built-ins register on first use, so no caller has to arrange an import.
    (0, builtin_provider_adapters_1.ensureBuiltinProviderAdapters)();
    var adapter = (0, provider_adapters_1.getProviderAdapter)(format);
    // Fail loudly rather than silently falling back: an unrecognised format that
    // quietly became an OpenAI request would send the wrong shape to an endpoint
    // and fail there, far from the cause.
    if (!adapter)
        throw new Error("no provider adapter is registered for format \"".concat(format, "\""));
    return adapter.create(__assign(__assign({}, input), { provider: (_b = input.providerName) !== null && _b !== void 0 ? _b : input.provider }));
}
function interleavedReasoningFieldForModel(driver, model, capabilities) {
    var interleaved = capabilities.interleaved;
    if (typeof interleaved === "object" &&
        interleaved !== null &&
        "field" in interleaved)
        return interleaved.field;
    if (interleaved === false)
        return undefined;
    // The fallback the compatible-OpenAI SDK applies: reasoning-style models on
    // this driver shape default to reasoning_content even when the catalog has no
    // explicit interleaved capability.
    var kind = driver.toLowerCase();
    if (!kind.includes("anthropic") &&
        !kind.includes("claude") &&
        !kind.includes("gemini") &&
        !kind.includes("google") &&
        model.toLowerCase().includes("deepseek"))
        return "reasoning_content";
    return undefined;
}
/**
 * Resolves a configured model reference into the same provider adapter used by
 * the runtime. The reference may be a canonical `"provider/model"` string or a
 * `{provider, model}` ref; unparsable refs, disabled providers and missing
 * credentials resolve to `undefined`. V3 dropped model variants, so a variant
 * name is accepted for call compatibility but never applied.
 */
function providerForModel(config, ref, _variantName, requestOverride) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!ref)
        return undefined;
    var modelRef;
    try {
        modelRef = typeof ref === "string" ? (0, contracts_1.parseModelRef)(ref) : ref;
    }
    catch (_j) {
        return undefined;
    }
    var status = (0, config_1.modelSelectionStatus)(config, modelRef);
    if (!status.selected)
        return undefined;
    var effective = (0, config_1.resolveEffectiveModel)(config, modelRef);
    var providerConfig = effective && config.providers[effective.providerID];
    if (!effective || !((_a = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.connection) === null || _a === void 0 ? void 0 : _a.apiKey))
        return undefined;
    return providerFromKind({
        // Keep the runtime provider identity stable: it is the adapter kind used
        // by runtime status, model metadata, and existing evaluator contracts.
        providerName: providerConfig.driver,
        provider: providerConfig.driver,
        // The declared wire format wins; `providerFromKind` resolves the fallback.
        format: (_b = providerConfig.protocol) === null || _b === void 0 ? void 0 : _b.format,
        // Declared cache behaviour travels with the endpoint rather than being
        // guessed per adapter: which extensions this deployment accepts, and how
        // long its cache should be retained.
        capabilities: (_c = providerConfig.protocol) === null || _c === void 0 ? void 0 : _c.capabilities,
        cacheRetention: (_d = providerConfig.protocol) === null || _d === void 0 ? void 0 : _d.cacheRetention,
        sessionID: requestOverride === null || requestOverride === void 0 ? void 0 : requestOverride.sessionID,
        apiKey: providerConfig.connection.apiKey,
        model: effective.ref.model,
        baseURL: providerConfig.connection.baseURL,
        maxTokens: (_e = effective.limits.maxOutputTokens) !== null && _e !== void 0 ? _e : undefined,
        temperature: (_f = effective.requestDefaults.temperature) !== null && _f !== void 0 ? _f : undefined,
        topP: (_g = effective.requestDefaults.topP) !== null && _g !== void 0 ? _g : undefined,
        reasoningEffort: (_h = requestOverride === null || requestOverride === void 0 ? void 0 : requestOverride.reasoningEffort) !== null && _h !== void 0 ? _h : (typeof effective.requestDefaults.options.reasoningEffort === "string"
            ? effective.requestDefaults.options.reasoningEffort
            : undefined),
        thinkingEnabled: effective.capabilities.thinking
            ? effective.requestDefaults.thinkingEnabled
            : undefined,
        interleavedReasoningField: interleavedReasoningFieldForModel(providerConfig.driver, effective.ref.model, effective.capabilities),
        thinkingBudgetTokens: typeof effective.requestDefaults.options.thinkingBudgetTokens === "number"
            ? effective.requestDefaults.options.thinkingBudgetTokens
            : undefined,
        timeoutMs: config.runtime.timeouts.requestSec > 0
            ? config.runtime.timeouts.requestSec * 1000
            : undefined,
        streamIdleTimeoutMs: config.runtime.timeouts.streamIdleSec > 0
            ? config.runtime.timeouts.streamIdleSec * 1000
            : undefined,
    });
}
function chatCompletionsURL(baseURL) {
    return baseURL.endsWith("/chat/completions")
        ? baseURL
        : "".concat(baseURL, "/chat/completions");
}
function messagesURL(baseURL) {
    return baseURL.endsWith("/messages") ? baseURL : "".concat(baseURL, "/messages");
}
function anthropicThinkingRequest(requestedBudgetTokens, reasoningEffort, maxTokens) {
    // The plan's 20%-with-256-floor formula can produce invalid sub-1024 values
    // (for example, 819 for max_tokens 4096). Anthropic requires at least 1024,
    // so no-effort defaults deviate upward to 1024 whenever max_tokens permits.
    // Runtime effort is translated to a valid thinking budget, never forwarded as
    // Anthropic's unsupported reasoning_effort request field.
    var effortBudgetTokens = reasoningEffort === undefined
        ? 1024
        : anthropicThinkingBudgetForEffort(reasoningEffort);
    var budgetTokens = requestedBudgetTokens !== null && requestedBudgetTokens !== void 0 ? requestedBudgetTokens : Math.min(effortBudgetTokens, maxTokens - 1);
    if (!Number.isInteger(budgetTokens) ||
        budgetTokens < 1024 ||
        budgetTokens >= maxTokens)
        throw new RangeError("Anthropic thinking requires an integer budget_tokens >= 1024 and < max_tokens (".concat(maxTokens, "); received ").concat(budgetTokens, "."));
    return { type: "enabled", budget_tokens: budgetTokens };
}
function anthropicThinkingBudgetForEffort(reasoningEffort) {
    switch (reasoningEffort) {
        case "minimal":
            return 1024;
        case "low":
            return 2048;
        case "medium":
            return 4096;
        case "high":
            return 8192;
        case "xhigh":
            return 16384;
        default:
            throw new RangeError("Unsupported Anthropic reasoning effort ".concat(JSON.stringify(reasoningEffort), "."));
    }
}
function modelsURL(baseURL) {
    var url = new URL(baseURL);
    url.pathname =
        url.pathname
            .replace(/\/(?:chat\/completions|messages)$/u, "")
            .replace(/\/$/u, "") + "/models";
    return url.toString();
}
function isLocalProviderURL(baseURL) {
    try {
        var hostname = new URL(baseURL).hostname;
        return (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1");
    }
    catch (_a) {
        return false;
    }
}
/**
 * Map OpenAI-compatible usage into the provider-neutral chunk.
 *
 * Both the streaming and buffered paths go through here so they cannot drift:
 * a session whose usage is read by one path and not the other would report a
 * hit rate that depends on which code path happened to serve the request.
 */
function openAIUsageChunk(usage) {
    var _a;
    var cached = (_a = usage.prompt_tokens_details) === null || _a === void 0 ? void 0 : _a.cached_tokens;
    return __assign({ type: "usage", inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens }, (cached === undefined ? {} : { cacheReadInputTokens: cached }));
}
function streamOpenAISSE(body, streamIdleTimeoutMs) {
    return __asyncGenerator(this, arguments, function streamOpenAISSE_1() {
        var reader, decoder, toolCalls, pendingReasoningDetails, reasoningDetails, completion, buffer, next, parts, _i, parts_2, part;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    reader = body.getReader();
                    decoder = new TextDecoder();
                    toolCalls = new Map();
                    pendingReasoningDetails = new Map();
                    reasoningDetails = [];
                    completion = {};
                    buffer = "";
                    _b.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 8];
                    return [4 /*yield*/, __await(readWithIdleTimeout(reader, streamIdleTimeoutMs))];
                case 2:
                    next = _b.sent();
                    if (next.done)
                        return [3 /*break*/, 8];
                    buffer += decoder.decode(next.value, { stream: true });
                    parts = buffer.split("\n\n");
                    buffer = (_a = parts.pop()) !== null && _a !== void 0 ? _a : "";
                    _i = 0, parts_2 = parts;
                    _b.label = 3;
                case 3:
                    if (!(_i < parts_2.length)) return [3 /*break*/, 7];
                    part = parts_2[_i];
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(parseSSEChunks(part, toolCalls, completion, pendingReasoningDetails, reasoningDetails))))];
                case 4: return [4 /*yield*/, __await.apply(void 0, [_b.sent()])];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 3];
                case 7: return [3 /*break*/, 1];
                case 8:
                    if (!buffer) return [3 /*break*/, 11];
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(parseSSEChunks(buffer, toolCalls, completion, pendingReasoningDetails, reasoningDetails))))];
                case 9: return [4 /*yield*/, __await.apply(void 0, [_b.sent()])];
                case 10:
                    _b.sent();
                    _b.label = 11;
                case 11:
                    if (!toolCalls.size) return [3 /*break*/, 14];
                    return [4 /*yield*/, __await({ type: "tool_call", calls: __spreadArray([], toolCalls.values(), true) })];
                case 12: return [4 /*yield*/, _b.sent()];
                case 13:
                    _b.sent();
                    _b.label = 14;
                case 14: return [4 /*yield*/, __await(__assign({ type: "done", finishReason: completion.finishReason }, (reasoningDetails.length
                        ? {
                            providerMetadata: {
                                openrouter: { reasoning_details: reasoningDetails },
                            },
                        }
                        : {})))];
                case 15: return [4 /*yield*/, _b.sent()];
                case 16:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function streamAnthropicSSE(body, streamIdleTimeoutMs) {
    return __asyncGenerator(this, arguments, function streamAnthropicSSE_1() {
        var reader, decoder, state, buffer, next, parts, _i, parts_3, part;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    reader = body.getReader();
                    decoder = new TextDecoder();
                    state = {
                        blockTypes: new Map(),
                        toolCalls: new Map(),
                        nextBlockIndex: 0,
                    };
                    buffer = "";
                    _b.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 8];
                    return [4 /*yield*/, __await(readWithIdleTimeout(reader, streamIdleTimeoutMs))];
                case 2:
                    next = _b.sent();
                    if (next.done)
                        return [3 /*break*/, 8];
                    buffer += decoder.decode(next.value, { stream: true });
                    parts = buffer.split(/\r?\n\r?\n/u);
                    buffer = (_a = parts.pop()) !== null && _a !== void 0 ? _a : "";
                    _i = 0, parts_3 = parts;
                    _b.label = 3;
                case 3:
                    if (!(_i < parts_3.length)) return [3 /*break*/, 7];
                    part = parts_3[_i];
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(parseAnthropicSSEPart(part, state))))];
                case 4: return [4 /*yield*/, __await.apply(void 0, [_b.sent()])];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 3];
                case 7: return [3 /*break*/, 1];
                case 8:
                    buffer += decoder.decode();
                    if (!buffer) return [3 /*break*/, 11];
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(parseAnthropicSSEPart(buffer, state))))];
                case 9: return [4 /*yield*/, __await.apply(void 0, [_b.sent()])];
                case 10:
                    _b.sent();
                    _b.label = 11;
                case 11:
                    if (!state.toolCalls.size) return [3 /*break*/, 14];
                    return [4 /*yield*/, __await({ type: "tool_call", calls: __spreadArray([], state.toolCalls.values(), true) })];
                case 12: return [4 /*yield*/, _b.sent()];
                case 13:
                    _b.sent();
                    _b.label = 14;
                case 14: return [4 /*yield*/, __await({ type: "done", finishReason: state.finishReason })];
                case 15: return [4 /*yield*/, _b.sent()];
                case 16:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function parseAnthropicSSEPart(part, state) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
    var chunks = [];
    for (var _i = 0, _z = part.split(/\r?\n/u); _i < _z.length; _i++) {
        var line = _z[_i];
        if (!line.startsWith("data:"))
            continue;
        var data = line.slice("data:".length).trim();
        if (!data || data === "[DONE]")
            continue;
        var parsed = JSON.parse(data);
        debugAnthropicSSE(parsed);
        if ((_a = parsed.delta) === null || _a === void 0 ? void 0 : _a.stop_reason)
            state.finishReason = normalizeAnthropicFinishReason(parsed.delta.stop_reason, state.toolCalls.size > 0);
        if (parsed.type === "content_block_start") {
            var index_1 = (_b = parsed.index) !== null && _b !== void 0 ? _b : state.nextBlockIndex;
            state.nextBlockIndex = Math.max(state.nextBlockIndex, index_1 + 1);
            state.currentBlockIndex = index_1;
            var block = parsed.content_block;
            state.blockTypes.set(index_1, block === null || block === void 0 ? void 0 : block.type);
            if ((block === null || block === void 0 ? void 0 : block.type) === "tool_use")
                state.toolCalls.set(index_1, {
                    id: (_c = block.id) !== null && _c !== void 0 ? _c : "tool_".concat(index_1),
                    name: (_d = block.name) !== null && _d !== void 0 ? _d : "",
                    arguments: "",
                });
            var initialThinking = (_e = block === null || block === void 0 ? void 0 : block.thinking) !== null && _e !== void 0 ? _e : block === null || block === void 0 ? void 0 : block.reasoning_content;
            if (initialThinking)
                chunks.push({
                    type: "thinking",
                    text: initialThinking,
                    blockIndex: index_1,
                });
            if ((block === null || block === void 0 ? void 0 : block.type) === "redacted_thinking" && block.data)
                chunks.push({
                    type: "thinking",
                    text: "",
                    signature: block.data,
                    redacted: true,
                    blockIndex: index_1,
                });
        }
        var index = (_f = parsed.index) !== null && _f !== void 0 ? _f : state.currentBlockIndex;
        var deltaThinking = (_k = (_h = (_g = parsed.delta) === null || _g === void 0 ? void 0 : _g.thinking) !== null && _h !== void 0 ? _h : (_j = parsed.delta) === null || _j === void 0 ? void 0 : _j.reasoning_content) !== null && _k !== void 0 ? _k : (_o = (_m = (_l = parsed.choices) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.delta) === null || _o === void 0 ? void 0 : _o.reasoning_content;
        if (deltaThinking)
            chunks.push(__assign({ type: "thinking", text: deltaThinking }, (index !== undefined ? { blockIndex: index } : {})));
        if ((_p = parsed.delta) === null || _p === void 0 ? void 0 : _p.signature)
            chunks.push(__assign({ type: "thinking", text: "", signature: parsed.delta.signature }, (index !== undefined ? { blockIndex: index } : {})));
        if ((_q = parsed.delta) === null || _q === void 0 ? void 0 : _q.text)
            chunks.push({ type: "content", text: parsed.delta.text });
        if ((_t = (_s = (_r = parsed.choices) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.delta) === null || _t === void 0 ? void 0 : _t.content)
            chunks.push({ type: "content", text: parsed.choices[0].delta.content });
        // `partial_json` is meaningful only for a tool_use block. Thinking blocks
        // can emit other delta types, so never append their bytes to tool arguments.
        if (((_u = parsed.delta) === null || _u === void 0 ? void 0 : _u.partial_json) &&
            index !== undefined &&
            state.blockTypes.get(index) === "tool_use") {
            var current = state.toolCalls.get(index);
            if (current)
                state.toolCalls.set(index, __assign(__assign({}, current), { arguments: "".concat(current.arguments).concat(parsed.delta.partial_json) }));
        }
        var usage = (_v = parsed.usage) !== null && _v !== void 0 ? _v : (_w = parsed.message) === null || _w === void 0 ? void 0 : _w.usage;
        if ((usage === null || usage === void 0 ? void 0 : usage.input_tokens) !== undefined || (usage === null || usage === void 0 ? void 0 : usage.output_tokens) !== undefined)
            chunks.push(__assign(__assign({ type: "usage", inputTokens: (_x = usage.input_tokens) !== null && _x !== void 0 ? _x : 0, outputTokens: (_y = usage.output_tokens) !== null && _y !== void 0 ? _y : 0 }, (usage.cache_creation_input_tokens !== undefined
                ? { cacheCreationInputTokens: usage.cache_creation_input_tokens }
                : {})), (usage.cache_read_input_tokens !== undefined
                ? { cacheReadInputTokens: usage.cache_read_input_tokens }
                : {})));
    }
    return chunks;
}
function debugAnthropicSSE(parsed) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (process.env.NATALIA_DEBUG_PROVIDER !== "1")
        return;
    console.debug("[provider] anthropic SSE", {
        eventType: parsed.type,
        index: parsed.index,
        contentBlockType: (_a = parsed.content_block) === null || _a === void 0 ? void 0 : _a.type,
        contentBlockKeys: Object.keys((_b = parsed.content_block) !== null && _b !== void 0 ? _b : {}),
        deltaKeys: Object.keys((_c = parsed.delta) !== null && _c !== void 0 ? _c : {}),
        choiceDeltaKeys: Object.keys((_f = (_e = (_d = parsed.choices) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.delta) !== null && _f !== void 0 ? _f : {}),
        usageKeys: Object.keys((_j = (_g = parsed.usage) !== null && _g !== void 0 ? _g : (_h = parsed.message) === null || _h === void 0 ? void 0 : _h.usage) !== null && _j !== void 0 ? _j : {}),
    });
}
function streamGeminiSSE(body, streamIdleTimeoutMs) {
    return __asyncGenerator(this, arguments, function streamGeminiSSE_1() {
        var reader, decoder, buffer, finishReason, next, parts, _i, parts_4, part, _a, _b, line, data, parsed, calls, _c, _d, _e, partIndex, part_1, signature, textSignature, signature, parsed, _f, _g, chunk;
        var _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
        return __generator(this, function (_1) {
            switch (_1.label) {
                case 0:
                    reader = body.getReader();
                    decoder = new TextDecoder();
                    buffer = "";
                    _1.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 23];
                    return [4 /*yield*/, __await(readWithIdleTimeout(reader, streamIdleTimeoutMs))];
                case 2:
                    next = _1.sent();
                    if (next.done)
                        return [3 /*break*/, 23];
                    buffer += decoder.decode(next.value, { stream: true });
                    parts = buffer.split("\n\n");
                    buffer = (_h = parts.pop()) !== null && _h !== void 0 ? _h : "";
                    _i = 0, parts_4 = parts;
                    _1.label = 3;
                case 3:
                    if (!(_i < parts_4.length)) return [3 /*break*/, 22];
                    part = parts_4[_i];
                    _a = 0, _b = part.split("\n");
                    _1.label = 4;
                case 4:
                    if (!(_a < _b.length)) return [3 /*break*/, 21];
                    line = _b[_a];
                    if (!line.startsWith("data:"))
                        return [3 /*break*/, 20];
                    data = line.slice("data:".length).trim();
                    if (!data || data === "[DONE]")
                        return [3 /*break*/, 20];
                    parsed = JSON.parse(data);
                    if ((_k = (_j = parsed.candidates) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.finishReason)
                        finishReason = normalizeGeminiFinishReason(parsed.candidates[0].finishReason);
                    calls = [];
                    _c = 0, _d = ((_p = (_o = (_m = (_l = parsed.candidates) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.content) === null || _o === void 0 ? void 0 : _o.parts) !== null && _p !== void 0 ? _p : []).entries();
                    _1.label = 5;
                case 5:
                    if (!(_c < _d.length)) return [3 /*break*/, 14];
                    _e = _d[_c], partIndex = _e[0], part_1 = _e[1];
                    if (!part_1.thought) return [3 /*break*/, 9];
                    signature = (_q = part_1.thoughtSignature) !== null && _q !== void 0 ? _q : part_1.thought_signature;
                    if (!(part_1.text || signature)) return [3 /*break*/, 8];
                    return [4 /*yield*/, __await(__assign(__assign({ type: "thinking", text: (_r = part_1.text) !== null && _r !== void 0 ? _r : "" }, (signature ? { signature: signature } : {})), { blockIndex: partIndex }))];
                case 6: return [4 /*yield*/, _1.sent()];
                case 7:
                    _1.sent();
                    _1.label = 8;
                case 8: return [3 /*break*/, 13];
                case 9:
                    textSignature = (_s = part_1.thoughtSignature) !== null && _s !== void 0 ? _s : part_1.thought_signature;
                    if (!(!((_t = part_1.functionCall) === null || _t === void 0 ? void 0 : _t.name) && (part_1.text || textSignature))) return [3 /*break*/, 12];
                    return [4 /*yield*/, __await(__assign({ type: "content", text: (_u = part_1.text) !== null && _u !== void 0 ? _u : "" }, (textSignature ? { textSignature: textSignature } : {})))];
                case 10: return [4 /*yield*/, _1.sent()];
                case 11:
                    _1.sent();
                    _1.label = 12;
                case 12:
                    if ((_v = part_1.functionCall) === null || _v === void 0 ? void 0 : _v.name) {
                        signature = (_w = part_1.thoughtSignature) !== null && _w !== void 0 ? _w : part_1.thought_signature;
                        calls.push(__assign({ id: "gemini_".concat(calls.length), name: part_1.functionCall.name, arguments: JSON.stringify((_x = part_1.functionCall.args) !== null && _x !== void 0 ? _x : {}) }, (signature ? { thoughtSignature: signature } : {})));
                    }
                    _1.label = 13;
                case 13:
                    _c++;
                    return [3 /*break*/, 5];
                case 14:
                    if (!calls.length) return [3 /*break*/, 17];
                    return [4 /*yield*/, __await({ type: "tool_call", calls: calls })];
                case 15: return [4 /*yield*/, _1.sent()];
                case 16:
                    _1.sent();
                    _1.label = 17;
                case 17:
                    if (!parsed.usageMetadata) return [3 /*break*/, 20];
                    return [4 /*yield*/, __await({
                            type: "usage",
                            inputTokens: (_y = parsed.usageMetadata.promptTokenCount) !== null && _y !== void 0 ? _y : 0,
                            outputTokens: (_z = parsed.usageMetadata.candidatesTokenCount) !== null && _z !== void 0 ? _z : 0,
                        })];
                case 18: return [4 /*yield*/, _1.sent()];
                case 19:
                    _1.sent();
                    _1.label = 20;
                case 20:
                    _a++;
                    return [3 /*break*/, 4];
                case 21:
                    _i++;
                    return [3 /*break*/, 3];
                case 22: return [3 /*break*/, 1];
                case 23:
                    if (!buffer) return [3 /*break*/, 29];
                    parsed = parseGeminiSSEPart(buffer);
                    _f = 0, _g = parsed.chunks;
                    _1.label = 24;
                case 24:
                    if (!(_f < _g.length)) return [3 /*break*/, 28];
                    chunk = _g[_f];
                    return [4 /*yield*/, __await(chunk)];
                case 25: return [4 /*yield*/, _1.sent()];
                case 26:
                    _1.sent();
                    _1.label = 27;
                case 27:
                    _f++;
                    return [3 /*break*/, 24];
                case 28:
                    finishReason = (_0 = parsed.finishReason) !== null && _0 !== void 0 ? _0 : finishReason;
                    _1.label = 29;
                case 29: return [4 /*yield*/, __await({ type: "done", finishReason: finishReason })];
                case 30: return [4 /*yield*/, _1.sent()];
                case 31:
                    _1.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function parseGeminiSSEPart(part) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    var chunks = [];
    var finishReason;
    for (var _i = 0, _s = part.split("\n"); _i < _s.length; _i++) {
        var line = _s[_i];
        if (!line.startsWith("data:"))
            continue;
        var data = line.slice("data:".length).trim();
        if (!data || data === "[DONE]")
            continue;
        var parsed = JSON.parse(data);
        if ((_b = (_a = parsed.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.finishReason)
            finishReason = normalizeGeminiFinishReason(parsed.candidates[0].finishReason);
        var calls = [];
        for (var _t = 0, _u = ((_f = (_e = (_d = (_c = parsed.candidates) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.parts) !== null && _f !== void 0 ? _f : []).entries(); _t < _u.length; _t++) {
            var _v = _u[_t], partIndex = _v[0], part_2 = _v[1];
            if (part_2.thought) {
                var signature = (_g = part_2.thoughtSignature) !== null && _g !== void 0 ? _g : part_2.thought_signature;
                if (part_2.text || signature)
                    chunks.push(__assign(__assign({ type: "thinking", text: (_h = part_2.text) !== null && _h !== void 0 ? _h : "" }, (signature ? { signature: signature } : {})), { blockIndex: partIndex }));
                continue;
            }
            var textSignature = (_j = part_2.thoughtSignature) !== null && _j !== void 0 ? _j : part_2.thought_signature;
            if (!((_k = part_2.functionCall) === null || _k === void 0 ? void 0 : _k.name) && (part_2.text || textSignature))
                chunks.push(__assign({ type: "content", text: (_l = part_2.text) !== null && _l !== void 0 ? _l : "" }, (textSignature ? { textSignature: textSignature } : {})));
            if ((_m = part_2.functionCall) === null || _m === void 0 ? void 0 : _m.name) {
                var signature = (_o = part_2.thoughtSignature) !== null && _o !== void 0 ? _o : part_2.thought_signature;
                calls.push(__assign({ id: "gemini_".concat(calls.length), name: part_2.functionCall.name, arguments: JSON.stringify((_p = part_2.functionCall.args) !== null && _p !== void 0 ? _p : {}) }, (signature ? { thoughtSignature: signature } : {})));
            }
        }
        if (calls.length)
            chunks.push({ type: "tool_call", calls: calls });
        if (parsed.usageMetadata)
            chunks.push({
                type: "usage",
                inputTokens: (_q = parsed.usageMetadata.promptTokenCount) !== null && _q !== void 0 ? _q : 0,
                outputTokens: (_r = parsed.usageMetadata.candidatesTokenCount) !== null && _r !== void 0 ? _r : 0,
            });
    }
    return { chunks: chunks, finishReason: finishReason };
}
function isOpenAIReasoningDetail(value) {
    return typeof value === "object" && value !== null;
}
function collectOpenAIReasoningDetails(value) {
    return Array.isArray(value) ? value.filter(isOpenAIReasoningDetail) : [];
}
function isOpenAIEncryptedReasoningDetail(value) {
    if (!isOpenAIReasoningDetail(value))
        return false;
    return (value.type === "reasoning.encrypted" &&
        typeof value.id === "string" &&
        value.id.length > 0 &&
        typeof value.data === "string" &&
        value.data.length > 0);
}
function accumulateOpenAIReasoningDetails(existing, incoming) {
    var _a, _b, _c;
    for (var _i = 0, incoming_1 = incoming; _i < incoming_1.length; _i++) {
        var detail = incoming_1[_i];
        if (detail.type === "reasoning.text" &&
            ((_a = existing.at(-1)) === null || _a === void 0 ? void 0 : _a.type) === "reasoning.text") {
            var previous = existing.at(-1);
            previous.text = "".concat(typeof previous.text === "string" ? previous.text : "").concat(typeof detail.text === "string" ? detail.text : "");
            (_b = previous.signature) !== null && _b !== void 0 ? _b : (previous.signature = detail.signature);
            (_c = previous.format) !== null && _c !== void 0 ? _c : (previous.format = detail.format);
            continue;
        }
        existing.push(__assign({}, detail));
    }
    return existing;
}
function applyEncryptedReasoningDetails(details, toolCalls, pendingReasoningDetails) {
    for (var _i = 0, details_1 = details; _i < details_1.length; _i++) {
        var detail = details_1[_i];
        var serialized = JSON.stringify(detail);
        var matched = false;
        for (var _a = 0, toolCalls_1 = toolCalls; _a < toolCalls_1.length; _a++) {
            var _b = toolCalls_1[_a], index = _b[0], call = _b[1];
            if (call.id !== detail.id)
                continue;
            toolCalls.set(index, __assign(__assign({}, call), { thoughtSignature: serialized }));
            matched = true;
            break;
        }
        if (!matched)
            pendingReasoningDetails.set(detail.id, serialized);
    }
}
function attachPendingReasoningDetail(call, pendingReasoningDetails) {
    var signature = pendingReasoningDetails.get(call.id);
    if (!signature)
        return call;
    pendingReasoningDetails.delete(call.id);
    return __assign(__assign({}, call), { thoughtSignature: signature });
}
function parseSSEChunks(part, toolCalls, completion, pendingReasoningDetails, reasoningDetails) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    var chunks = [];
    for (var _i = 0, _r = part.split("\n"); _i < _r.length; _i++) {
        var line = _r[_i];
        if (!line.startsWith("data:"))
            continue;
        var data = line.slice("data:".length).trim();
        if (!data || data === "[DONE]")
            continue;
        var parsed = JSON.parse(data);
        if (parsed.usage)
            chunks.push(openAIUsageChunk(parsed.usage));
        var choice = (_a = parsed.choices) === null || _a === void 0 ? void 0 : _a[0];
        if (choice === null || choice === void 0 ? void 0 : choice.finish_reason)
            completion.finishReason = normalizeOpenAIFinishReason(choice.finish_reason, toolCalls.size > 0);
        var delta = choice === null || choice === void 0 ? void 0 : choice.delta;
        var reasoningFields = [
            ["reasoning_content", delta === null || delta === void 0 ? void 0 : delta.reasoning_content],
            ["reasoning", delta === null || delta === void 0 ? void 0 : delta.reasoning],
            ["reasoning_text", delta === null || delta === void 0 ? void 0 : delta.reasoning_text],
        ];
        var reasoning = reasoningFields.find(function (_a) {
            var value = _a[1];
            return typeof value === "string" && value.length > 0;
        });
        if (reasoning)
            chunks.push({
                type: "thinking",
                text: reasoning[1],
                field: reasoning[0],
            });
        if (delta === null || delta === void 0 ? void 0 : delta.reasoning_opaque)
            chunks.push({
                type: "thinking",
                text: "",
                // Copilot's reasoning_opaque is attached to the reasoning_text field
                // and must be replayed together with that text on the next request.
                field: "reasoning_text",
                signature: delta.reasoning_opaque,
            });
        var details = collectOpenAIReasoningDetails(delta === null || delta === void 0 ? void 0 : delta.reasoning_details);
        if (details.length) {
            accumulateOpenAIReasoningDetails(reasoningDetails, details);
            var encryptedDetails = details.filter(isOpenAIEncryptedReasoningDetail);
            if (encryptedDetails.length)
                applyEncryptedReasoningDetails(encryptedDetails, toolCalls, pendingReasoningDetails);
        }
        var legacyRecipient = (_c = (_b = delta === null || delta === void 0 ? void 0 : delta.recipient) !== null && _b !== void 0 ? _b : choice === null || choice === void 0 ? void 0 : choice.recipient) !== null && _c !== void 0 ? _c : (_d = choice === null || choice === void 0 ? void 0 : choice.message) === null || _d === void 0 ? void 0 : _d.recipient;
        var legacyFunction = (_f = (_e = delta === null || delta === void 0 ? void 0 : delta.function_call) !== null && _e !== void 0 ? _e : choice === null || choice === void 0 ? void 0 : choice.function_call) !== null && _f !== void 0 ? _f : (_g = choice === null || choice === void 0 ? void 0 : choice.message) === null || _g === void 0 ? void 0 : _g.function_call;
        if (legacyRecipient ||
            legacyFunction ||
            (toolCalls.size > 0 && (delta === null || delta === void 0 ? void 0 : delta.content))) {
            var current = (_h = toolCalls.get(0)) !== null && _h !== void 0 ? _h : {
                id: "tool_0",
                name: "",
                arguments: "",
            };
            var recipient = normalizeToolRecipient(legacyRecipient);
            toolCalls.set(0, attachPendingReasoningDetail({
                id: current.id,
                name: (_k = (_j = normalizeToolRecipient(legacyFunction === null || legacyFunction === void 0 ? void 0 : legacyFunction.name)) !== null && _j !== void 0 ? _j : recipient) !== null && _k !== void 0 ? _k : current.name,
                arguments: "".concat(current.arguments).concat((_m = (_l = legacyFunction === null || legacyFunction === void 0 ? void 0 : legacyFunction.arguments) !== null && _l !== void 0 ? _l : delta === null || delta === void 0 ? void 0 : delta.content) !== null && _m !== void 0 ? _m : ""),
            }, pendingReasoningDetails));
            if (((choice === null || choice === void 0 ? void 0 : choice.finish_reason) === "tool_calls" ||
                (choice === null || choice === void 0 ? void 0 : choice.finish_reason) === "function_call") &&
                toolCalls.size) {
                var calls = __spreadArray([], toolCalls.values(), true);
                toolCalls.clear();
                chunks.push({ type: "tool_call", calls: calls });
            }
            continue;
        }
        if (delta === null || delta === void 0 ? void 0 : delta.tool_calls) {
            for (var _s = 0, _t = delta.tool_calls; _s < _t.length; _s++) {
                var call = _t[_s];
                var current = (_o = toolCalls.get(call.index)) !== null && _o !== void 0 ? _o : {
                    id: (_p = call.id) !== null && _p !== void 0 ? _p : "tool_".concat(call.index),
                    name: "",
                    arguments: "",
                };
                var name_3 = toolNameFromGatewayCall(call);
                toolCalls.set(call.index, attachPendingReasoningDetail({
                    id: (_q = call.id) !== null && _q !== void 0 ? _q : current.id,
                    name: name_3 !== null && name_3 !== void 0 ? name_3 : current.name,
                    arguments: "".concat(current.arguments).concat(toolArgumentsFromGatewayCall(call)),
                }, pendingReasoningDetails));
            }
            if ((choice === null || choice === void 0 ? void 0 : choice.finish_reason) === "tool_calls" && toolCalls.size) {
                var calls = __spreadArray([], toolCalls.values(), true);
                toolCalls.clear();
                chunks.push({ type: "tool_call", calls: calls });
            }
            continue;
        }
        if (delta === null || delta === void 0 ? void 0 : delta.content)
            chunks.push({ type: "content", text: delta.content });
    }
    return chunks;
}
function normalizeOpenAIFinishReason(reason, hasToolCalls) {
    if (hasToolCalls || reason === "tool_calls" || reason === "function_call")
        return "tool_calls";
    if (reason === "stop")
        return "stop";
    if (reason === "length")
        return "length";
    if (reason === "content_filter")
        return "content_filter";
    return reason ? "unknown" : undefined;
}
function normalizeAnthropicFinishReason(reason, hasToolCalls) {
    if (hasToolCalls || reason === "tool_use")
        return "tool_calls";
    if (reason === "end_turn" || reason === "stop_sequence")
        return "stop";
    if (reason === "max_tokens")
        return "length";
    if (reason === "refusal")
        return "content_filter";
    return "unknown";
}
function normalizeGeminiFinishReason(reason) {
    if (reason === "STOP")
        return "stop";
    if (reason === "MAX_TOKENS")
        return "length";
    if (reason === "SAFETY" || reason === "RECITATION")
        return "content_filter";
    if (reason === "MALFORMED_FUNCTION_CALL" || reason === "OTHER")
        return "error";
    return "unknown";
}
function normalizeToolRecipient(recipient) {
    if (!recipient)
        return undefined;
    for (var _i = 0, _a = ["functions.", "function.", "tools."]; _i < _a.length; _i++) {
        var prefix = _a[_i];
        if (recipient.startsWith(prefix))
            return recipient.slice(prefix.length);
    }
    return recipient;
}
function toolNameFromGatewayCall(call) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return ((_g = (_f = (_e = (_d = (_c = (_a = normalizeToolRecipient(typeof call.function === "object" ? call.function.name : call.function)) !== null && _a !== void 0 ? _a : normalizeToolRecipient((_b = call.function_call) === null || _b === void 0 ? void 0 : _b.name)) !== null && _c !== void 0 ? _c : normalizeToolRecipient(call.name)) !== null && _d !== void 0 ? _d : normalizeToolRecipient(call.recipient)) !== null && _e !== void 0 ? _e : normalizeToolRecipient(call.tool_name)) !== null && _f !== void 0 ? _f : normalizeToolRecipient(call.function_name)) !== null && _g !== void 0 ? _g : normalizeToolRecipient((_h = call.tool) === null || _h === void 0 ? void 0 : _h.name));
}
function toolArgumentsFromGatewayCall(call) {
    var _a, _b, _c, _d;
    if (typeof call.function === "object" && call.function.arguments)
        return call.function.arguments;
    return (_d = (_c = (_b = (_a = call.function_call) === null || _a === void 0 ? void 0 : _a.arguments) !== null && _b !== void 0 ? _b : call.arguments) !== null && _c !== void 0 ? _c : call.input) !== null && _d !== void 0 ? _d : "";
}
function openAIReasoningField(message, interleavedReasoningField) {
    if (message.reasoningField && message.reasoningField.length > 0)
        return message.reasoningField;
    return interleavedReasoningField !== null && interleavedReasoningField !== void 0 ? interleavedReasoningField : "reasoning_content";
}
/**
 * OpenAI-compatible interleaved providers (DeepSeek is the canonical example)
 * require the reasoning field on every assistant message, even when it is
 * empty. This is deliberately separate from `reasoningContent` because an
 * absent value is not the same as an empty string to these APIs.
 */
function openAIReasoningEntry(message, interleavedReasoningField) {
    var _a;
    var _b;
    if (message.role !== "assistant")
        return {};
    if (message.reasoningContent === undefined &&
        !interleavedReasoningField &&
        !message.reasoningField)
        return {};
    return _a = {},
        _a[openAIReasoningField(message, interleavedReasoningField)] = (_b = message.reasoningContent) !== null && _b !== void 0 ? _b : "",
        _a;
}
function openAIReasoningPayload(message, interleavedReasoningField) {
    var entry = openAIReasoningEntry(message, interleavedReasoningField);
    if (message.reasoningField === "reasoning_text" && message.reasoningSignature)
        return __assign(__assign({}, entry), { reasoning_opaque: message.reasoningSignature });
    return entry;
}
function openAIReasoningDetails(calls) {
    var details = [];
    for (var _i = 0, calls_2 = calls; _i < calls_2.length; _i++) {
        var call = calls_2[_i];
        if (!call.thoughtSignature)
            continue;
        try {
            var parsed = JSON.parse(call.thoughtSignature);
            if (isOpenAIEncryptedReasoningDetail(parsed))
                details.push(parsed);
        }
        catch (_a) {
            // Other providers use thoughtSignature for non-JSON opaque values.
        }
    }
    return details;
}
function openAIProviderReasoningDetails(message) {
    var _a;
    var metadata = message.providerMetadata;
    var details = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.openrouter) === null || _a === void 0 ? void 0 : _a.reasoning_details;
    return Array.isArray(details) && details.length ? details : undefined;
}
function toOpenAIMessage(message, interleavedReasoningField) {
    var _a, _b, _c;
    var providerReasoningDetails = openAIProviderReasoningDetails(message);
    var reasoning = providerReasoningDetails
        ? {}
        : openAIReasoningPayload(message, interleavedReasoningField);
    if (message.role === "tool") {
        return {
            role: "tool",
            tool_call_id: message.toolCallID,
            content: message.content,
        };
    }
    if ((_a = message.toolCalls) === null || _a === void 0 ? void 0 : _a.length) {
        var reasoningDetails = providerReasoningDetails !== null && providerReasoningDetails !== void 0 ? providerReasoningDetails : openAIReasoningDetails(message.toolCalls);
        return __assign(__assign(__assign({ role: "assistant", content: message.content || null }, reasoning), (reasoningDetails.length
            ? { reasoning_details: reasoningDetails }
            : {})), { tool_calls: message.toolCalls.map(function (call) { return ({
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: call.arguments },
            }); }) });
    }
    if ((_b = message.images) === null || _b === void 0 ? void 0 : _b.length)
        return __assign(__assign({ role: message.role, content: __spreadArray(__spreadArray([], (message.content ? [{ type: "text", text: message.content }] : []), true), ((_c = message.images) !== null && _c !== void 0 ? _c : []).map(function (image) { return ({
                type: "image_url",
                image_url: { url: materializedDataURL(image) },
            }); }), true) }, reasoning), (providerReasoningDetails
            ? { reasoning_details: providerReasoningDetails }
            : {}));
    return __assign(__assign({ role: message.role, content: message.content }, reasoning), (providerReasoningDetails
        ? { reasoning_details: providerReasoningDetails }
        : {}));
}
function anthropicReasoningBlocks(message) {
    var _a, _b;
    if ((_a = message.reasoningBlocks) === null || _a === void 0 ? void 0 : _a.length) {
        return message.reasoningBlocks.flatMap(function (block) {
            var _a;
            if (block.redacted && block.signature)
                return [
                    {
                        type: "redacted_thinking",
                        data: block.signature,
                    },
                ];
            if (block.signature)
                return [
                    {
                        type: "thinking",
                        thinking: (_a = block.text) !== null && _a !== void 0 ? _a : "",
                        signature: block.signature,
                    },
                ];
            return block.text ? [{ type: "text", text: block.text }] : [];
        });
    }
    if (!message.reasoningSignature)
        return [];
    if (message.reasoningRedacted)
        return [
            {
                type: "redacted_thinking",
                data: message.reasoningSignature,
            },
        ];
    return [
        {
            type: "thinking",
            thinking: (_b = message.reasoningContent) !== null && _b !== void 0 ? _b : "",
            signature: message.reasoningSignature,
        },
    ];
}
function anthropicContentParts(message) {
    var _a;
    if (!((_a = message.contentParts) === null || _a === void 0 ? void 0 : _a.length))
        return undefined;
    return message.contentParts.flatMap(function (part) {
        var _a;
        if (part.type === "text")
            return [{ type: "text", text: part.text }];
        if (part.type === "thinking") {
            if (part.redacted && part.signature)
                return [{ type: "redacted_thinking", data: part.signature }];
            if (part.signature)
                return [
                    {
                        type: "thinking",
                        thinking: (_a = part.text) !== null && _a !== void 0 ? _a : "",
                        signature: part.signature,
                    },
                ];
            return part.text ? [{ type: "text", text: part.text }] : [];
        }
        return [
            {
                type: "tool_use",
                id: part.id,
                name: part.name,
                input: safeJSON(part.arguments),
            },
        ];
    });
}
/** Content block types an Anthropic cache breakpoint may sit on. */
var ANTHROPIC_CACHEABLE_BLOCKS = new Set([
    "text",
    "image",
    "tool_result",
    "tool_addition",
    "tool_removal",
]);
/**
 * Mark the last message of a conversation with a cache breakpoint, in place.
 *
 * Anthropic writes a cache entry only where a `cache_control` marker sits, so a
 * request whose breakpoints are all in the header caches nothing of the
 * conversation — every turn re-bills the whole history. Marking the final
 * message extends the cached prefix over it.
 *
 * Only the last message, and only on a block type the API accepts the marker on.
 * A trailing message that cannot carry one is simply left unmarked rather than
 * moved: the header breakpoints still cover the stable part.
 */
function markConversationBreakpoint(messages, cacheControl) {
    var _a;
    if (!cacheControl || messages.length === 0)
        return;
    var last = messages[messages.length - 1];
    if (last.role !== "user" && last.role !== "assistant")
        return;
    if (Array.isArray(last.content)) {
        var lastBlock = last.content[last.content.length - 1];
        if (!lastBlock || !ANTHROPIC_CACHEABLE_BLOCKS.has((_a = lastBlock.type) !== null && _a !== void 0 ? _a : ""))
            return;
        lastBlock.cache_control = cacheControl;
        return;
    }
    // A bare string has no block to mark, so it becomes one. The conversion above
    // only yields a string when the message carried nothing else.
    last.content = [
        { type: "text", text: last.content, cache_control: cacheControl },
    ];
}
function toAnthropicMessage(message) {
    var _a, _b, _c;
    if (message.role === "tool")
        return {
            role: "user",
            content: [
                {
                    type: "tool_result",
                    tool_use_id: message.toolCallID,
                    content: message.content,
                },
            ],
        };
    var contentParts = anthropicContentParts(message);
    if ((_a = message.toolCalls) === null || _a === void 0 ? void 0 : _a.length) {
        var reasoning_1 = anthropicReasoningBlocks(message);
        return {
            role: "assistant",
            content: contentParts !== null && contentParts !== void 0 ? contentParts : __spreadArray(__spreadArray(__spreadArray([], reasoning_1, true), (message.content ? [{ type: "text", text: message.content }] : []), true), message.toolCalls.map(function (call) { return ({
                type: "tool_use",
                id: call.id,
                name: call.name,
                input: safeJSON(call.arguments),
            }); }), true),
        };
    }
    var reasoning = anthropicReasoningBlocks(message);
    var content = contentParts !== null && contentParts !== void 0 ? contentParts : __spreadArray(__spreadArray(__spreadArray([], reasoning, true), (message.content ? [{ type: "text", text: message.content }] : []), true), ((_b = message.images) !== null && _b !== void 0 ? _b : []).map(function (image) { return ({
        type: "image",
        source: {
            type: "base64",
            media_type: image.mediaType,
            data: dataURLPayload(materializedDataURL(image)),
        },
    }); }), true);
    return {
        role: message.role === "assistant" ? "assistant" : "user",
        content: ((_c = message.images) === null || _c === void 0 ? void 0 : _c.length) || content.length ? content : message.content,
    };
}
function geminiContentParts(message) {
    var _a;
    if (!((_a = message.contentParts) === null || _a === void 0 ? void 0 : _a.length))
        return undefined;
    return message.contentParts.map(function (part) {
        var _a;
        if (part.type === "text")
            return __assign({ text: part.text }, (part.textSignature ? { thoughtSignature: part.textSignature } : {}));
        if (part.type === "thinking")
            return __assign({ thought: true, text: (_a = part.text) !== null && _a !== void 0 ? _a : "" }, (part.signature ? { thoughtSignature: part.signature } : {}));
        return __assign({ functionCall: { name: part.name, args: safeJSON(part.arguments) } }, (part.thoughtSignature
            ? { thoughtSignature: part.thoughtSignature }
            : {}));
    });
}
function geminiReasoningParts(message) {
    var _a, _b;
    if ((_a = message.reasoningBlocks) === null || _a === void 0 ? void 0 : _a.length)
        return message.reasoningBlocks
            .filter(function (block) { return block.text !== undefined || block.signature; })
            .map(function (block) {
            var _a;
            return (__assign({ thought: true, text: (_a = block.text) !== null && _a !== void 0 ? _a : "" }, (block.signature ? { thoughtSignature: block.signature } : {})));
        });
    if (message.reasoningContent || message.reasoningSignature)
        return [
            __assign({ thought: true, text: (_b = message.reasoningContent) !== null && _b !== void 0 ? _b : "" }, (message.reasoningSignature
                ? { thoughtSignature: message.reasoningSignature }
                : {})),
        ];
    return [];
}
function toGeminiContent(message) {
    var _a, _b, _c, _d, _e, _f;
    var role = message.role === "assistant" ? "model" : "user";
    var contentParts = geminiContentParts(message);
    if ((_a = message.toolCalls) === null || _a === void 0 ? void 0 : _a.length)
        return {
            role: "model",
            parts: contentParts !== null && contentParts !== void 0 ? contentParts : __spreadArray(__spreadArray(__spreadArray([], geminiReasoningParts(message), true), (message.content || message.textSignature
                ? [
                    __assign({ text: message.content }, (message.textSignature
                        ? { thoughtSignature: message.textSignature }
                        : {})),
                ]
                : []), true), message.toolCalls.map(function (call) { return (__assign({ functionCall: { name: call.name, args: safeJSON(call.arguments) } }, (call.thoughtSignature
                ? { thoughtSignature: call.thoughtSignature }
                : {}))); }), true),
        };
    if (message.role === "tool")
        return {
            role: "user",
            parts: [
                {
                    functionResponse: {
                        name: (_b = message.toolName) !== null && _b !== void 0 ? _b : message.toolCallID,
                        response: { content: message.content },
                    },
                },
            ],
        };
    return {
        role: role,
        parts: __spreadArray(__spreadArray(__spreadArray([], (contentParts !== null && contentParts !== void 0 ? contentParts : __spreadArray(__spreadArray([], geminiReasoningParts(message), true), (message.content || message.textSignature
            ? [
                __assign({ text: message.content }, (message.textSignature
                    ? { thoughtSignature: message.textSignature }
                    : {})),
            ]
            : []), true)), true), ((_d = (_c = message.images) === null || _c === void 0 ? void 0 : _c.map(function (image) { return ({
            inlineData: {
                mimeType: image.mediaType,
                data: dataURLPayload(materializedDataURL(image)),
            },
        }); })) !== null && _d !== void 0 ? _d : []), true), ((_f = (_e = message.videos) === null || _e === void 0 ? void 0 : _e.map(function (video) { return ({
            inlineData: {
                mimeType: video.mediaType,
                data: dataURLPayload(materializedDataURL(video)),
            },
        }); })) !== null && _f !== void 0 ? _f : []), true),
    };
}
function materializedDataURL(attachment) {
    if (attachmentHasInlineDataURL(attachment))
        return attachment.dataURL;
    throw new Error("provider attachment was not materialized");
}
function dataURLPayload(value) {
    var marker = ";base64,";
    var index = value.indexOf(marker);
    if (index < 0)
        throw new Error("attachment data URL is not base64 encoded");
    return value.slice(index + marker.length);
}
function safeJSON(input) {
    try {
        return JSON.parse(input);
    }
    catch (_a) {
        return { value: input };
    }
}
function readWithIdleTimeout(reader, timeoutMs) {
    return __awaiter(this, void 0, void 0, function () {
        var timer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!timeoutMs) return [3 /*break*/, 2];
                    return [4 /*yield*/, reader.read()];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    _a.trys.push([2, , 4, 5]);
                    return [4 /*yield*/, Promise.race([
                            reader.read(),
                            new Promise(function (_, reject) {
                                timer = setTimeout(function () {
                                    void reader.cancel().catch(function () { return undefined; });
                                    reject((0, errors_1.providerError)({
                                        kind: "timeout",
                                        message: "provider stream idle timeout after ".concat(timeoutMs, "ms"),
                                    }));
                                }, timeoutMs);
                            }),
                        ])];
                case 3: return [2 /*return*/, _a.sent()];
                case 4:
                    if (timer)
                        clearTimeout(timer);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function safeResponseText(response) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, response.text()];
                case 1: return [2 /*return*/, (_b.sent()).slice(0, 500)];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, "<unavailable>"];
                case 3: return [2 /*return*/];
            }
        });
    });
}
