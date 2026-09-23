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
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var provider = {
    provider: "plan-active-session",
    model: "plan-active-session-model",
    stream: function (_request) {
        return __asyncGenerator(this, arguments, function stream_1() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({ type: "done" })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    },
};
(0, bun_test_1.test)("plan documents are workspace-wide while activation is session-scoped", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, firstSessionID, client, marked, _a, _b, _c, _d, _e, _f, second, _g, _h, _j, _k, _l;
    var _m, _o;
    return __generator(this, function (_p) {
        switch (_p.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-active-session")];
            case 1:
                root = _p.sent();
                firstSessionID = "ses_plan_active_first";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: firstSessionID,
                    provider: provider,
                });
                client.start(function () { return undefined; });
                _p.label = 2;
            case 2:
                _p.trys.push([2, , 22, 24]);
                return [4 /*yield*/, client.sessionAttach(firstSessionID)];
            case 3:
                _p.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/workspace-plan.md",
                        content: "# Workspace plan\n",
                        title: "Workspace plan",
                    })];
            case 4:
                _p.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/workspace-plan.md",
                    })];
            case 5:
                marked = _p.sent();
                (0, bun_test_1.expect)(marked.planID).toBeTruthy();
                _a = bun_test_1.expect;
                return [4 /*yield*/, client.planDocUpdateStatus({
                        planID: marked.planID,
                        status: "audit_gaps",
                    })];
            case 6:
                _a.apply(void 0, [_p.sent()]).toEqual({ updated: true });
                // The plan is visible from the first session and has no active pointer yet.
                _b = bun_test_1.expect;
                return [4 /*yield*/, client.planDocList()];
            case 7:
                // The plan is visible from the first session and has no active pointer yet.
                _b.apply(void 0, [_p.sent()]).toEqual(bun_test_1.expect.arrayContaining([
                    bun_test_1.expect.objectContaining({
                        planID: marked.planID,
                        status: "audit_gaps",
                    }),
                ]));
                _c = bun_test_1.expect;
                return [4 /*yield*/, client.planDocActive()];
            case 8:
                _c.apply(void 0, [_p.sent()]).toEqual({});
                _d = bun_test_1.expect;
                return [4 /*yield*/, client.planDocActivate(marked.planID)];
            case 9:
                _d.apply(void 0, [_p.sent()]).toEqual({
                    planID: marked.planID,
                    updated: true,
                });
                _e = bun_test_1.expect;
                return [4 /*yield*/, client.planDocActive()];
            case 10:
                _e.apply(void 0, [_p.sent()]).toEqual({ planID: marked.planID });
                _f = bun_test_1.expect;
                return [4 /*yield*/, client.sessionList()];
            case 11:
                _f.apply(void 0, [(_m = (_p.sent()).find(function (session) { return session.id === firstSessionID; })) === null || _m === void 0 ? void 0 : _m.activePlanID]).toBe(marked.planID);
                return [4 /*yield*/, client.sessionNew()];
            case 12:
                second = _p.sent();
                return [4 /*yield*/, client.sessionAttach(second.sessionID)];
            case 13:
                _p.sent();
                _g = bun_test_1.expect;
                return [4 /*yield*/, client.planDocList()];
            case 14:
                _g.apply(void 0, [_p.sent()]).toEqual(bun_test_1.expect.arrayContaining([
                    bun_test_1.expect.objectContaining({
                        planID: marked.planID,
                        status: "audit_gaps",
                    }),
                ]));
                _h = bun_test_1.expect;
                return [4 /*yield*/, client.planDocActive()];
            case 15:
                _h.apply(void 0, [_p.sent()]).toEqual({});
                return [4 /*yield*/, client.planDocActivate(marked.planID)];
            case 16:
                _p.sent();
                _j = bun_test_1.expect;
                return [4 /*yield*/, client.planDocActive()];
            case 17:
                _j.apply(void 0, [_p.sent()]).toEqual({ planID: marked.planID });
                return [4 /*yield*/, client.sessionAttach(firstSessionID)];
            case 18:
                _p.sent();
                _k = bun_test_1.expect;
                return [4 /*yield*/, client.planDocActive()];
            case 19:
                _k.apply(void 0, [_p.sent()]).toEqual({ planID: marked.planID });
                return [4 /*yield*/, client.sessionAttach(second.sessionID)];
            case 20:
                _p.sent();
                _l = bun_test_1.expect;
                return [4 /*yield*/, client.planDocActive()];
            case 21:
                _l.apply(void 0, [_p.sent()]).toEqual({ planID: marked.planID });
                return [3 /*break*/, 24];
            case 22: return [4 /*yield*/, ((_o = client.dispose) === null || _o === void 0 ? void 0 : _o.call(client))];
            case 23:
                _p.sent();
                return [7 /*endfinally*/];
            case 24: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Nia and Navi prompts see workspace plans but only the session active plan", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, prompts, personas, providerWithPrompts, firstSessionID, client, marked, second, niaPromptWithoutActive, niaPromptAfterDeactivate;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-active-prompt")];
            case 1:
                root = _e.sent();
                prompts = {
                    main: [],
                    navi: [],
                    nia: [],
                };
                personas = {
                    main: [],
                    navi: [],
                    nia: [],
                };
                providerWithPrompts = {
                    provider: "plan-active-prompt",
                    model: "plan-active-prompt-model",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_2() {
                            var system, prompt, channel, seen;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        system = (_a = request.messages.find(function (message) { return message.role === "system"; })) === null || _a === void 0 ? void 0 : _a.content;
                                        prompt = typeof system === "string" ? system : "";
                                        channel = prompt.includes("<nia_chat_persona>")
                                            ? "nia"
                                            : prompt.includes("<navi_chat_persona>")
                                                ? "navi"
                                                : "main";
                                        personas[channel].push(prompt);
                                        seen = channel === "main"
                                            ? request.messages.map(function (message) { return message.content; }).join("\n")
                                            : "".concat(prompt, "\n").concat(request.messages
                                                .filter(function (message) {
                                                return message.role === "user" &&
                                                    message.content.includes("<runtime_context");
                                            })
                                                .map(function (message) { return message.content; })
                                                .join("\n"));
                                        prompts[channel].push(seen);
                                        return [4 /*yield*/, __await({ type: "content", text: "ok" })];
                                    case 1: return [4 /*yield*/, _b.sent()];
                                    case 2:
                                        _b.sent();
                                        return [4 /*yield*/, __await({ type: "done" })];
                                    case 3: return [4 /*yield*/, _b.sent()];
                                    case 4:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                firstSessionID = "ses_plan_prompt_first";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: firstSessionID,
                    provider: providerWithPrompts,
                });
                client.start(function () { return undefined; });
                _e.label = 2;
            case 2:
                _e.trys.push([2, , 18, 20]);
                return [4 /*yield*/, client.sessionAttach(firstSessionID)];
            case 3:
                _e.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/prompt-plan.md",
                        content: "# Prompt plan\n",
                        title: "Prompt plan",
                    })];
            case 4:
                _e.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/prompt-plan.md",
                        title: "Prompt plan",
                    })];
            case 5:
                marked = _e.sent();
                return [4 /*yield*/, client.planDocUpdateStatus({
                        planID: marked.planID,
                        status: "audit_gaps",
                    })];
            case 6:
                _e.sent();
                return [4 /*yield*/, client.planDocActivate(marked.planID)];
            case 7:
                _e.sent();
                return [4 /*yield*/, client.niaChat.submit({ text: "ping" })];
            case 8:
                _e.sent();
                return [4 /*yield*/, client.naviChat.submit({ text: "ping" })];
            case 9:
                _e.sent();
                return [4 /*yield*/, client.submitAndWait("main ping")];
            case 10:
                _e.sent();
                (0, bun_test_1.expect)(prompts.main.join("\n")).toContain("<next_plan_handoff>");
                (0, bun_test_1.expect)(prompts.main.join("\n")).toContain(marked.planID);
                (0, bun_test_1.expect)(prompts.nia.join("\n")).toContain("Active plan: ".concat(marked.planID, " \u00B7 audit_gaps \u00B7 Prompt plan"));
                (0, bun_test_1.expect)(prompts.nia.join("\n")).toContain("Known plan documents");
                (0, bun_test_1.expect)(prompts.nia.join("\n")).toContain(marked.planID);
                (0, bun_test_1.expect)(prompts.navi.join("\n")).toContain("Active plan (audit_gaps): Prompt plan");
                (0, bun_test_1.expect)(prompts.navi.join("\n")).toContain("Known plan documents");
                (0, bun_test_1.expect)(prompts.navi.join("\n")).toContain(marked.planID);
                return [4 /*yield*/, client.sessionNew()];
            case 11:
                second = _e.sent();
                return [4 /*yield*/, client.sessionAttach(second.sessionID)];
            case 12:
                _e.sent();
                return [4 /*yield*/, client.niaChat.submit({ text: "ping" })];
            case 13:
                _e.sent();
                return [4 /*yield*/, client.submitAndWait("main without active plan")];
            case 14:
                _e.sent();
                niaPromptWithoutActive = (_a = prompts.nia.at(-1)) !== null && _a !== void 0 ? _a : "";
                (0, bun_test_1.expect)(niaPromptWithoutActive).toContain("Active plan: none");
                (0, bun_test_1.expect)(niaPromptWithoutActive).toContain(marked.planID);
                (0, bun_test_1.expect)((_b = prompts.main.at(-1)) !== null && _b !== void 0 ? _b : "").not.toContain("<next_plan_handoff>");
                return [4 /*yield*/, client.sessionAttach(firstSessionID)];
            case 15:
                _e.sent();
                return [4 /*yield*/, client.planDocDeactivate()];
            case 16:
                _e.sent();
                return [4 /*yield*/, client.niaChat.submit({ text: "ping" })];
            case 17:
                _e.sent();
                niaPromptAfterDeactivate = (_c = prompts.nia.at(-1)) !== null && _c !== void 0 ? _c : "";
                (0, bun_test_1.expect)(niaPromptAfterDeactivate).toContain("Active plan: none");
                (0, bun_test_1.expect)(niaPromptAfterDeactivate).toContain(marked.planID);
                // ADR D1: the Navi/Nia system prompt is the static persona only —
                // byte-identical across sessions and workspace state. Live plans, mailbox
                // and collaboration messages arrive as `<runtime_context>` user messages.
                (0, bun_test_1.expect)(new Set(personas.navi).size).toBe(1);
                (0, bun_test_1.expect)(new Set(personas.nia).size).toBe(1);
                (0, bun_test_1.expect)(personas.nia[0]).toContain("<nia_chat_persona>");
                (0, bun_test_1.expect)(personas.nia[0]).not.toContain("Active plan");
                (0, bun_test_1.expect)(personas.nia[0]).not.toContain("Known plan documents");
                (0, bun_test_1.expect)(personas.navi[0]).toContain("<navi_chat_persona>");
                (0, bun_test_1.expect)(personas.navi[0]).not.toContain("Active plan");
                (0, bun_test_1.expect)(personas.navi[0]).not.toContain("Known plan documents");
                return [3 /*break*/, 20];
            case 18: return [4 /*yield*/, ((_d = client.dispose) === null || _d === void 0 ? void 0 : _d.call(client))];
            case 19:
                _e.sent();
                return [7 /*endfinally*/];
            case 20: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Nia can update the Markdown plan document without gaining project write access", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, niaToolNames, niaToolCallIssued, provider, sessionID, client, marked, document_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("nia-plan-write")];
            case 1:
                root = _b.sent();
                niaToolNames = [];
                niaToolCallIssued = false;
                provider = {
                    provider: "nia-plan-write",
                    model: "nia-plan-write-model",
                    stream: function (request) {
                        return __asyncGenerator(this, arguments, function stream_3() {
                            var system, prompt, hasToolResult;
                            var _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        system = (_a = request.messages.find(function (message) { return message.role === "system"; })) === null || _a === void 0 ? void 0 : _a.content;
                                        prompt = typeof system === "string" ? system : "";
                                        if (!!prompt.includes("<nia_chat_persona>")) return [3 /*break*/, 6];
                                        return [4 /*yield*/, __await({ type: "content", text: "ok" })];
                                    case 1: return [4 /*yield*/, _c.sent()];
                                    case 2:
                                        _c.sent();
                                        return [4 /*yield*/, __await({ type: "done" })];
                                    case 3: return [4 /*yield*/, _c.sent()];
                                    case 4:
                                        _c.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 5: return [2 /*return*/, _c.sent()];
                                    case 6:
                                        niaToolNames = ((_b = request.tools) !== null && _b !== void 0 ? _b : []).map(function (tool) { return tool.name; });
                                        hasToolResult = request.messages.some(function (message) { return message.role === "tool"; });
                                        if (!(!niaToolCallIssued && !hasToolResult)) return [3 /*break*/, 12];
                                        niaToolCallIssued = true;
                                        return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_write_nia_plan",
                                                        name: "plan_doc_write",
                                                        arguments: JSON.stringify({
                                                            path: "plans/nia-audit.md",
                                                            content: "# Nia updated plan\n\n- audit gap closed\n- next step recorded\n",
                                                        }),
                                                    },
                                                ],
                                            })];
                                    case 7: return [4 /*yield*/, _c.sent()];
                                    case 8:
                                        _c.sent();
                                        return [4 /*yield*/, __await({ type: "done" })];
                                    case 9: return [4 /*yield*/, _c.sent()];
                                    case 10:
                                        _c.sent();
                                        return [4 /*yield*/, __await(void 0)];
                                    case 11: return [2 /*return*/, _c.sent()];
                                    case 12: return [4 /*yield*/, __await({ type: "content", text: "updated the plan document" })];
                                    case 13: return [4 /*yield*/, _c.sent()];
                                    case 14:
                                        _c.sent();
                                        return [4 /*yield*/, __await({ type: "done" })];
                                    case 15: return [4 /*yield*/, _c.sent()];
                                    case 16:
                                        _c.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    },
                };
                sessionID = "ses_nia_plan_write";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    provider: provider,
                });
                client.start(function () { return undefined; });
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 9, 11]);
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/nia-audit.md",
                        content: "# Original plan\n",
                        title: "Nia audit plan",
                    })];
            case 4:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/nia-audit.md",
                        title: "Nia audit plan",
                    })];
            case 5:
                marked = _b.sent();
                return [4 /*yield*/, client.planDocActivate(marked.planID, sessionID)];
            case 6:
                _b.sent();
                return [4 /*yield*/, client.niaChat.submit({
                        text: "update the plan document with the latest notes",
                    })];
            case 7:
                _b.sent();
                (0, bun_test_1.expect)(niaToolNames).toContain("plan_doc_write");
                (0, bun_test_1.expect)(niaToolNames).not.toContain("write_file");
                (0, bun_test_1.expect)(niaToolNames).not.toContain("apply_edits");
                return [4 /*yield*/, client.planDocRead({
                        path: "plans/nia-audit.md",
                    })];
            case 8:
                document_1 = _b.sent();
                (0, bun_test_1.expect)(document_1.content).toContain("Nia updated plan");
                (0, bun_test_1.expect)(document_1.content).toContain("audit gap closed");
                return [3 /*break*/, 11];
            case 9: return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 10:
                _b.sent();
                return [7 /*endfinally*/];
            case 11: return [2 /*return*/];
        }
    });
}); });
