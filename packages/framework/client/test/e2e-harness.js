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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectAgent = detectAgent;
exports.createScriptedProvider = createScriptedProvider;
exports.reduceRuntimeEvents = reduceRuntimeEvents;
exports.waitFor = waitFor;
exports.lastEvent = lastEvent;
var view_store_1 = require("@natalia/view-store");
function toolNames(request) {
    var _a;
    return new Set(((_a = request.tools) !== null && _a !== void 0 ? _a : []).map(function (tool) { return tool.name; }));
}
/**
 * Routes a provider call to the agent that owns the visible tool surface. The
 * runtime uses one provider object for all channels; a deterministic E2E script
 * must not let a Nia wake consume the Main Agent's next step.
 */
function detectAgent(request) {
    var names = toolNames(request);
    if (names.has("record_decision") ||
        names.has("record_validation") ||
        names.has("record_completion"))
        return "main";
    if (names.has("audit_report"))
        return "nia";
    if (names.has("plan_propose"))
        return "navi";
    var system = request.messages
        .filter(function (message) { return message.role === "system"; })
        .map(function (message) { return message.content; })
        .join("\n");
    if (system.includes("<nia_chat_persona>"))
        return "nia";
    if (system.includes("<navi_chat_persona>"))
        return "navi";
    return "main";
}
function readToolResults(request) {
    return request.messages
        .filter(function (message) {
        return message.role === "tool";
    })
        .map(function (message) {
        var _a;
        return (__assign(__assign(__assign({}, (message.toolCallID ? { toolCallID: message.toolCallID } : {})), (message.toolName ? { toolName: message.toolName } : {})), { content: String((_a = message.content) !== null && _a !== void 0 ? _a : "") }));
    });
}
/**
 * A scripted provider for deterministic end-to-end tests.
 *
 * Each agent has its own cursor, so a Nia audit wake cannot advance the Main
 * Agent's script and vice versa. Steps are selected in order; an optional
 * `when` guard may inspect the request/tool results when a step depends on a
 * prior RPC result.
 */
function createScriptedProvider(scripts) {
    var cursors = { main: 0, navi: 0, nia: 0 };
    var calls = { main: 0, navi: 0, nia: 0 };
    return {
        provider: "e2e-scripted",
        model: "e2e-scripted-model",
        stream: function (request) {
            return __asyncGenerator(this, arguments, function stream_1() {
                var agent, script, toolResults, latestToolResult, stepIndex, step, candidate, context_1, context, tool, id, text;
                var _a, _b, _c, _d, _e, _f, _g, _h;
                return __generator(this, function (_j) {
                    switch (_j.label) {
                        case 0:
                            agent = detectAgent(request);
                            script = (_a = scripts[agent]) !== null && _a !== void 0 ? _a : [];
                            toolResults = readToolResults(request);
                            latestToolResult = toolResults.at(-1);
                            stepIndex = (_b = cursors[agent]) !== null && _b !== void 0 ? _b : 0;
                            while (stepIndex < script.length) {
                                candidate = script[stepIndex];
                                stepIndex += 1;
                                if (!candidate.when) {
                                    step = candidate;
                                    break;
                                }
                                context_1 = __assign({ agent: agent, call: (_c = calls[agent]) !== null && _c !== void 0 ? _c : 0, request: request, toolResults: toolResults }, (latestToolResult ? { latestToolResult: latestToolResult } : {}));
                                if (candidate.when(context_1)) {
                                    step = candidate;
                                    break;
                                }
                            }
                            cursors[agent] = stepIndex;
                            calls[agent] = ((_d = calls[agent]) !== null && _d !== void 0 ? _d : 0) + 1;
                            if (!!step) return [3 /*break*/, 6];
                            return [4 /*yield*/, __await({ type: "content", text: "".concat(agent, " script complete") })];
                        case 1: return [4 /*yield*/, _j.sent()];
                        case 2:
                            _j.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 3: return [4 /*yield*/, _j.sent()];
                        case 4:
                            _j.sent();
                            return [4 /*yield*/, __await(void 0)];
                        case 5: return [2 /*return*/, _j.sent()];
                        case 6:
                            context = __assign({ agent: agent, call: (_e = calls[agent]) !== null && _e !== void 0 ? _e : 0, request: request, toolResults: toolResults }, (latestToolResult ? { latestToolResult: latestToolResult } : {}));
                            tool = typeof step.tool === "function" ? step.tool(context) : step.tool;
                            if (!tool) return [3 /*break*/, 12];
                            id = (_f = tool.id) !== null && _f !== void 0 ? _f : "".concat(agent, ":call:").concat((_g = calls[agent]) !== null && _g !== void 0 ? _g : 0, ":").concat(stepIndex.toString(36));
                            return [4 /*yield*/, __await({
                                    type: "tool_call",
                                    calls: [
                                        {
                                            id: id,
                                            name: tool.name,
                                            arguments: typeof tool.arguments === "string"
                                                ? tool.arguments
                                                : JSON.stringify(tool.arguments),
                                        },
                                    ],
                                })];
                        case 7: return [4 /*yield*/, _j.sent()];
                        case 8:
                            _j.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 9: return [4 /*yield*/, _j.sent()];
                        case 10:
                            _j.sent();
                            return [4 /*yield*/, __await(void 0)];
                        case 11: return [2 /*return*/, _j.sent()];
                        case 12:
                            text = typeof step.text === "function"
                                ? step.text(context)
                                : ((_h = step.text) !== null && _h !== void 0 ? _h : "".concat(agent, " step complete"));
                            return [4 /*yield*/, __await({ type: "content", text: text })];
                        case 13: return [4 /*yield*/, _j.sent()];
                        case 14:
                            _j.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 15: return [4 /*yield*/, _j.sent()];
                        case 16:
                            _j.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
/** Fold a runtime event stream through the same host projection third-party UI uses. */
function reduceRuntimeEvents(events) {
    var state = (0, view_store_1.initialState)();
    for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
        var event_1 = events_1[_i];
        (0, view_store_1.applyEvent)(state, event_1);
    }
    return state;
}
/** Poll an assertion condition without depending on wall-clock sleeps in tests. */
function waitFor(condition_1) {
    return __awaiter(this, arguments, void 0, function (condition, input) {
        var timeoutMs, intervalMs, started;
        var _a, _b;
        if (input === void 0) { input = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    timeoutMs = (_a = input.timeoutMs) !== null && _a !== void 0 ? _a : 5000;
                    intervalMs = (_b = input.intervalMs) !== null && _b !== void 0 ? _b : 10;
                    started = Date.now();
                    _c.label = 1;
                case 1:
                    if (!!condition()) return [3 /*break*/, 3];
                    if (Date.now() - started > timeoutMs)
                        throw new Error("timed out waiting for E2E condition");
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, intervalMs); })];
                case 2:
                    _c.sent();
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/** Small helper for tests that need the latest event of one type. */
function lastEvent(events, type) {
    return events
        .filter(function (event) {
        return event.type === type;
    })
        .at(-1);
}
