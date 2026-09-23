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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var provider_1 = require("../src/provider");
var config_1 = require("@natalia/config");
var modelmeta_1 = require("../src/modelmeta");
(0, bun_test_1.test)("raw XML-like tool protocol becomes structured calls while preserving prose", function () { return __awaiter(void 0, void 0, void 0, function () {
    function source() {
        return __asyncGenerator(this, arguments, function source_1() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({ type: "content", text: "Before <tool_" })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __await({
                                type: "content",
                                text: "call><function=agent_attach><parameter=agentId>a6</parameter><parameter=options>{&quot;mode&quot;:&quot;fast&quot;}</parameter></function></tool_call> after",
                            })];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, __await({ type: "done" })];
                    case 5: return [4 /*yield*/, _a.sent()];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var chunks, _a, _b, _c, chunk, e_1_1;
    var _d, e_1, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_1.normalizeRawToolCallProtocol)(source()));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_1_1 = _g.sent();
                e_1 = { error: e_1_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_1) throw e_1.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    { type: "content", text: "Before " },
                    { type: "content", text: " after" },
                    {
                        type: "tool_call",
                        calls: [
                            {
                                id: "raw_xml_tool_0",
                                name: "agent_attach",
                                arguments: '{"agentId":"a6","options":{"mode":"fast"}}',
                            },
                        ],
                    },
                    { type: "done" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("simple args XML-like tool protocol becomes a structured call", function () { return __awaiter(void 0, void 0, void 0, function () {
    function source() {
        return __asyncGenerator(this, arguments, function source_2() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({ type: "content", text: "Before <edit_file><ar" })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __await({
                                type: "content",
                                text: "gs>{&quot;path&quot;:&quot;note.txt&quot;,&quot;content&quot;:&quot;updated&quot;}</args></edit_file> after",
                            })];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, __await({ type: "done" })];
                    case 5: return [4 /*yield*/, _a.sent()];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var chunks, _a, _b, _c, chunk, e_2_1;
    var _d, e_2, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_1.normalizeRawToolCallProtocol)(source()));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_2_1 = _g.sent();
                e_2 = { error: e_2_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_2) throw e_2.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    { type: "content", text: "Before " },
                    { type: "content", text: " after" },
                    {
                        type: "tool_call",
                        calls: [
                            {
                                id: "raw_xml_tool_0",
                                name: "edit_file",
                                arguments: '{"path":"note.txt","content":"updated"}',
                            },
                        ],
                    },
                    { type: "done" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("raw XML normalization preserves the provider finish reason", function () { return __awaiter(void 0, void 0, void 0, function () {
    function source() {
        return __asyncGenerator(this, arguments, function source_3() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({ type: "content", text: "partial" })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __await({ type: "done", finishReason: "length" })];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var chunks, _a, _b, _c, chunk, e_3_1;
    var _d, e_3, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_1.normalizeRawToolCallProtocol)(source()));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_3_1 = _g.sent();
                e_3 = { error: e_3_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_3) throw e_3.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    { type: "content", text: "partial" },
                    { type: "done", finishReason: "length" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("raw XML-like tool protocol leaves malformed or incomplete blocks untouched", function () { return __awaiter(void 0, void 0, void 0, function () {
    function source() {
        return __asyncGenerator(this, arguments, function source_4() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({
                            type: "content",
                            text: "<tool_call><function=read_file><parameter=path>a.txt</function></tool_call>",
                        })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __await({
                                type: "content",
                                text: " and <tool_call><function=glob><parameter=pattern>*.ts</parameter>",
                            })];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var chunks, _a, _b, _c, chunk, e_4_1;
    var _d, e_4, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_1.normalizeRawToolCallProtocol)(source()));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_4_1 = _g.sent();
                e_4 = { error: e_4_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_4) throw e_4.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks.filter(function (chunk) { return chunk.type === "tool_call"; })).toEqual([]);
                (0, bun_test_1.expect)(chunks
                    .filter(function (chunk) {
                    return chunk.type === "content";
                })
                    .map(function (chunk) { return chunk.text; })
                    .join("")).toBe("<tool_call><function=read_file><parameter=path>a.txt</function></tool_call> and <tool_call><function=glob><parameter=pattern>*.ts</parameter>");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("raw XML-like calls duplicate native calls only once", function () { return __awaiter(void 0, void 0, void 0, function () {
    function source() {
        return __asyncGenerator(this, arguments, function source_5() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({
                            type: "content",
                            text: '<tool_call><function=glob><parameter=pattern>"*.ts"</parameter></function></tool_call>',
                        })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __await({
                                type: "tool_call",
                                calls: [
                                    { id: "native_1", name: "glob", arguments: '{"pattern":"*.ts"}' },
                                ],
                            })];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var chunks, _a, _b, _c, chunk, e_5_1;
    var _d, e_5, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_1.normalizeRawToolCallProtocol)(source()));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_5_1 = _g.sent();
                e_5 = { error: e_5_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_5) throw e_5.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    {
                        type: "tool_call",
                        calls: [
                            { id: "native_1", name: "glob", arguments: '{"pattern":"*.ts"}' },
                        ],
                    },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native calls with identical arguments retain distinct call IDs", function () { return __awaiter(void 0, void 0, void 0, function () {
    function source() {
        return __asyncGenerator(this, arguments, function source_6() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({
                            type: "tool_call",
                            calls: [
                                { id: "native_1", name: "glob", arguments: '{"pattern":"*.ts"}' },
                                { id: "native_2", name: "glob", arguments: '{"pattern":"*.ts"}' },
                            ],
                        })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var chunks, _a, _b, _c, chunk, e_6_1;
    var _d, e_6, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_1.normalizeRawToolCallProtocol)(source()));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_6_1 = _g.sent();
                e_6 = { error: e_6_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_6) throw e_6.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    {
                        type: "tool_call",
                        calls: [
                            { id: "native_1", name: "glob", arguments: '{"pattern":"*.ts"}' },
                            { id: "native_2", name: "glob", arguments: '{"pattern":"*.ts"}' },
                        ],
                    },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("raw and native tool calls retain their source order", function () { return __awaiter(void 0, void 0, void 0, function () {
    function source() {
        return __asyncGenerator(this, arguments, function source_7() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({
                            type: "content",
                            text: '<tool_call><function=read_file><parameter=path>"a.ts"</parameter></function></tool_call>',
                        })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __await({
                                type: "tool_call",
                                calls: [
                                    { id: "native_1", name: "glob", arguments: '{"pattern":"*.ts"}' },
                                ],
                            })];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var chunks, _a, _b, _c, chunk, e_7_1;
    var _d, e_7, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_1.normalizeRawToolCallProtocol)(source()));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_7_1 = _g.sent();
                e_7 = { error: e_7_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_7) throw e_7.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    {
                        type: "tool_call",
                        calls: [
                            {
                                id: "raw_xml_tool_0",
                                name: "read_file",
                                arguments: '{"path":"a.ts"}',
                            },
                            { id: "native_1", name: "glob", arguments: '{"pattern":"*.ts"}' },
                        ],
                    },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a partial raw marker is flushed before a native event", function () { return __awaiter(void 0, void 0, void 0, function () {
    function source() {
        return __asyncGenerator(this, arguments, function source_8() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({ type: "content", text: "Before <tool_" })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __await({ type: "thinking", text: "checking" })];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var chunks, _a, _b, _c, chunk, e_8_1;
    var _d, e_8, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_1.normalizeRawToolCallProtocol)(source()));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_8_1 = _g.sent();
                e_8 = { error: e_8_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_8) throw e_8.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    { type: "content", text: "Before " },
                    { type: "content", text: "<tool_" },
                    { type: "thinking", text: "checking" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native protocol guard reports textual calls without executing them", function () { return __awaiter(void 0, void 0, void 0, function () {
    function source() {
        return __asyncGenerator(this, arguments, function source_9() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({ type: "content", text: "Inspecting. <tool_" })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __await({
                                type: "content",
                                text: "call><function=read_file><parameter=path>a.txt</parameter></function></tool_call>",
                            })];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, __await({ type: "done", finishReason: "stop" })];
                    case 5: return [4 /*yield*/, _a.sent()];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var chunks, _a, _b, _c, chunk, e_9_1;
    var _d, e_9, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_1.requireNativeToolCallProtocol)(source()));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_9_1 = _g.sent();
                e_9 = { error: e_9_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_9) throw e_9.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    { type: "content", text: "Inspecting. " },
                    {
                        type: "tool_protocol_violation",
                        text: "<tool_call><function=read_file><parameter=path>a.txt</parameter></function></tool_call>",
                    },
                    { type: "done", finishReason: "stop" },
                ]);
                (0, bun_test_1.expect)(chunks.some(function (chunk) { return chunk.type === "tool_call"; })).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native protocol guard rejects bare function markup split across chunks", function () { return __awaiter(void 0, void 0, void 0, function () {
    function source() {
        return __asyncGenerator(this, arguments, function source_10() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({ type: "content", text: "Inspecting. <func" })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __await({
                                type: "content",
                                text: "tion=run_shell><parameter=command>git status</parameter></function>",
                            })];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, __await({ type: "done", finishReason: "stop" })];
                    case 5: return [4 /*yield*/, _a.sent()];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var chunks, _a, _b, _c, chunk, e_10_1;
    var _d, e_10, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_1.requireNativeToolCallProtocol)(source()));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_10_1 = _g.sent();
                e_10 = { error: e_10_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_10) throw e_10.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    { type: "content", text: "Inspecting. " },
                    {
                        type: "tool_protocol_violation",
                        text: "<function=run_shell><parameter=command>git status</parameter></function>",
                    },
                    { type: "done", finishReason: "stop" },
                ]);
                (0, bun_test_1.expect)(chunks.some(function (chunk) { return chunk.type === "tool_call"; })).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native protocol guard preserves structured provider calls", function () { return __awaiter(void 0, void 0, void 0, function () {
    function source() {
        return __asyncGenerator(this, arguments, function source_11() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({
                            type: "tool_call",
                            calls: [
                                { id: "native_1", name: "read_file", arguments: '{"path":"a.txt"}' },
                            ],
                        })];
                    case 1: return [4 /*yield*/, _a.sent()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __await({ type: "done", finishReason: "tool_calls" })];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    var chunks, _a, _b, _c, chunk, e_11_1;
    var _d, e_11, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues((0, provider_1.requireNativeToolCallProtocol)(source()));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_11_1 = _g.sent();
                e_11 = { error: e_11_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_11) throw e_11.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    {
                        type: "tool_call",
                        calls: [
                            { id: "native_1", name: "read_file", arguments: '{"path":"a.txt"}' },
                        ],
                    },
                    { type: "done", finishReason: "tool_calls" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible provider accepts both base and complete chat endpoint URLs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requested, fetchImpl, _i, _a, baseURL, provider, _b, _c, _d, _chunk, e_12_1;
    var _e, e_12, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                requested = [];
                fetchImpl = Object.assign(function (input) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        requested.push(String(input));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _i = 0, _a = [
                    "https://gateway.example/v1",
                    "https://gateway.example/v1/chat/completions",
                ];
                _h.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 14];
                baseURL = _a[_i];
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "test-key",
                    model: "test-model",
                    baseURL: baseURL,
                    fetch: fetchImpl,
                });
                _h.label = 2;
            case 2:
                _h.trys.push([2, 7, 8, 13]);
                _b = true, _c = (e_12 = void 0, __asyncValues(provider.stream({ messages: [] })));
                _h.label = 3;
            case 3: return [4 /*yield*/, _c.next()];
            case 4:
                if (!(_d = _h.sent(), _e = _d.done, !_e)) return [3 /*break*/, 6];
                _g = _d.value;
                _b = false;
                _chunk = _g;
                _h.label = 5;
            case 5:
                _b = true;
                return [3 /*break*/, 3];
            case 6: return [3 /*break*/, 13];
            case 7:
                e_12_1 = _h.sent();
                e_12 = { error: e_12_1 };
                return [3 /*break*/, 13];
            case 8:
                _h.trys.push([8, , 11, 12]);
                if (!(!_b && !_e && (_f = _c.return))) return [3 /*break*/, 10];
                return [4 /*yield*/, _f.call(_c)];
            case 9:
                _h.sent();
                _h.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                if (e_12) throw e_12.error;
                return [7 /*endfinally*/];
            case 12: return [7 /*endfinally*/];
            case 13:
                _i++;
                return [3 /*break*/, 1];
            case 14:
                (0, bun_test_1.expect)(requested).toEqual([
                    "https://gateway.example/v1/chat/completions",
                    "https://gateway.example/v1/chat/completions",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("provider adapters map tool choice and omit tools when disabled", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, bodies, fetchFor, providers, _i, providers_1, provider, _a, _b, toolChoice, _c, _d, _e, _chunk, e_13_1;
    var _f, e_13, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                tools = [
                    {
                        name: "read_file",
                        description: "Read a file",
                        parameters: { type: "object", properties: {} },
                    },
                ];
                bodies = {
                    openai: [],
                    anthropic: [],
                    gemini: [],
                };
                fetchFor = function (name, response) {
                    return Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            bodies[name].push(JSON.parse(String(init === null || init === void 0 ? void 0 : init.body)));
                            return [2 /*return*/, new Response(response, {
                                    headers: { "content-type": "text/event-stream" },
                                })];
                        });
                    }); }, { preconnect: fetch.preconnect });
                };
                providers = [
                    new provider_1.OpenAICompatibleProvider({
                        apiKey: "key",
                        model: "model",
                        fetch: fetchFor("openai", "data: [DONE]\n\n"),
                    }),
                    new provider_1.AnthropicProvider({
                        apiKey: "key",
                        model: "model",
                        maxTokens: 1024,
                        fetch: fetchFor("anthropic", "event: message_stop\ndata: {}\n\n"),
                    }),
                    new provider_1.GeminiProvider({
                        apiKey: "key",
                        model: "model",
                        fetch: fetchFor("gemini", "data: {}\n\n"),
                    }),
                ];
                _i = 0, providers_1 = providers;
                _j.label = 1;
            case 1:
                if (!(_i < providers_1.length)) return [3 /*break*/, 16];
                provider = providers_1[_i];
                _a = 0, _b = ["auto", "required", "none"];
                _j.label = 2;
            case 2:
                if (!(_a < _b.length)) return [3 /*break*/, 15];
                toolChoice = _b[_a];
                _j.label = 3;
            case 3:
                _j.trys.push([3, 8, 9, 14]);
                _c = true, _d = (e_13 = void 0, __asyncValues(provider.stream({
                    messages: [],
                    tools: tools,
                    toolChoice: toolChoice,
                })));
                _j.label = 4;
            case 4: return [4 /*yield*/, _d.next()];
            case 5:
                if (!(_e = _j.sent(), _f = _e.done, !_f)) return [3 /*break*/, 7];
                _h = _e.value;
                _c = false;
                _chunk = _h;
                _j.label = 6;
            case 6:
                _c = true;
                return [3 /*break*/, 4];
            case 7: return [3 /*break*/, 14];
            case 8:
                e_13_1 = _j.sent();
                e_13 = { error: e_13_1 };
                return [3 /*break*/, 14];
            case 9:
                _j.trys.push([9, , 12, 13]);
                if (!(!_c && !_f && (_g = _d.return))) return [3 /*break*/, 11];
                return [4 /*yield*/, _g.call(_d)];
            case 10:
                _j.sent();
                _j.label = 11;
            case 11: return [3 /*break*/, 13];
            case 12:
                if (e_13) throw e_13.error;
                return [7 /*endfinally*/];
            case 13: return [7 /*endfinally*/];
            case 14:
                _a++;
                return [3 /*break*/, 2];
            case 15:
                _i++;
                return [3 /*break*/, 1];
            case 16:
                (0, bun_test_1.expect)(bodies.openai.map(function (body) { return body.tool_choice; })).toEqual([
                    "auto",
                    "required",
                    "none",
                ]);
                (0, bun_test_1.expect)(bodies.openai[2]).not.toHaveProperty("tools");
                (0, bun_test_1.expect)(bodies.anthropic.map(function (body) { return body.tool_choice; })).toEqual([
                    { type: "auto" },
                    { type: "any" },
                    undefined,
                ]);
                (0, bun_test_1.expect)(bodies.anthropic[2]).not.toHaveProperty("tools");
                (0, bun_test_1.expect)(bodies.gemini.map(function (body) { return body.toolConfig; })).toEqual([
                    { functionCallingConfig: { mode: "AUTO" } },
                    { functionCallingConfig: { mode: "ANY" } },
                    undefined,
                ]);
                (0, bun_test_1.expect)(bodies.gemini[2]).not.toHaveProperty("tools");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("configured provider resolution preserves the adapter provider identity", function () {
    var config = (0, config_1.defaultConfigV3)();
    config.providers.internal_gateway = {
        name: "Internal Gateway",
        driver: "anthropic-compatible",
        enabled: true,
        connection: { apiKey: "test-key" },
        requestDefaults: { stream: true, headers: {}, options: {} },
    };
    config.catalog.providers.internal_gateway = {
        models: {
            "review-model": {
                name: "review-model",
                status: "stable",
                source: "manual",
                capabilities: {
                    toolCall: false,
                    reasoning: false,
                    thinking: false,
                    imageInput: false,
                    videoInput: false,
                },
                limits: { contextWindow: "auto", maxOutputTokens: null },
            },
        },
    };
    config.modelOverrides["internal_gateway/review-model"] = {
        enabled: true,
        name: "Review",
        requestDefaults: { temperature: null, topP: null },
        requestOptions: {},
        headers: {},
    };
    config.defaultModel = { provider: "internal_gateway", model: "review-model" };
    var provider = (0, provider_1.providerForModel)(config, config.defaultModel);
    (0, bun_test_1.expect)(provider).toBeInstanceOf(provider_1.AnthropicProvider);
    (0, bun_test_1.expect)(provider).toMatchObject({
        provider: "anthropic-compatible",
        model: "review-model",
    });
});
(0, bun_test_1.test)("providerForModel applies the DeepSeek interleaved reasoning default", function () { return __awaiter(void 0, void 0, void 0, function () {
    var config, body, originalFetch, provider, _a, _b, _c, _chunk, e_14_1;
    var _d, e_14, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                config = (0, config_1.defaultConfigV3)();
                config.providers.deepseek_gateway = {
                    name: "DeepSeek Gateway",
                    driver: "openai-compatible",
                    enabled: true,
                    connection: { apiKey: "test-key" },
                    requestDefaults: { stream: true, headers: {}, options: {} },
                };
                config.catalog.providers.deepseek_gateway = {
                    models: {
                        "deepseek-chat": {
                            name: "deepseek-chat",
                            status: "stable",
                            source: "manual",
                            capabilities: {
                                toolCall: true,
                                reasoning: true,
                                thinking: true,
                                imageInput: false,
                                videoInput: false,
                            },
                            limits: { contextWindow: "auto", maxOutputTokens: null },
                        },
                    },
                };
                config.modelOverrides["deepseek_gateway/deepseek-chat"] = {
                    enabled: true,
                    name: "DeepSeek Chat",
                    requestDefaults: { temperature: null, topP: null },
                    requestOptions: {},
                    headers: {},
                };
                originalFetch = globalThis.fetch;
                globalThis.fetch = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _g.label = 1;
            case 1:
                _g.trys.push([1, , 14, 15]);
                provider = (0, provider_1.providerForModel)(config, "deepseek_gateway/deepseek-chat");
                (0, bun_test_1.expect)(provider).toBeInstanceOf(provider_1.OpenAICompatibleProvider);
                _g.label = 2;
            case 2:
                _g.trys.push([2, 7, 8, 13]);
                _a = true, _b = __asyncValues(provider.stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "",
                            toolCalls: [{ id: "call_1", name: "read_file", arguments: "{}" }],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "call_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _g.label = 3;
            case 3: return [4 /*yield*/, _b.next()];
            case 4:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 6];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _g.label = 5;
            case 5:
                _a = true;
                return [3 /*break*/, 3];
            case 6: return [3 /*break*/, 13];
            case 7:
                e_14_1 = _g.sent();
                e_14 = { error: e_14_1 };
                return [3 /*break*/, 13];
            case 8:
                _g.trys.push([8, , 11, 12]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 10];
                return [4 /*yield*/, _e.call(_b)];
            case 9:
                _g.sent();
                _g.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                if (e_14) throw e_14.error;
                return [7 /*endfinally*/];
            case 12: return [7 /*endfinally*/];
            case 13: return [3 /*break*/, 15];
            case 14:
                globalThis.fetch = originalFetch;
                return [7 /*endfinally*/];
            case 15:
                (0, bun_test_1.expect)((body === null || body === void 0 ? void 0 : body.messages)[0]).toMatchObject({
                    role: "assistant",
                    reasoning_content: "",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("providerForModel honors an explicit interleaved reasoning field", function () { return __awaiter(void 0, void 0, void 0, function () {
    var config, body, originalFetch, provider, _a, _b, _c, _chunk, e_15_1;
    var _d, e_15, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                config = (0, config_1.defaultConfigV3)();
                config.providers.interleaved_gateway = {
                    name: "Interleaved Gateway",
                    driver: "openai-compatible",
                    enabled: true,
                    connection: { apiKey: "test-key" },
                    requestDefaults: { stream: true, headers: {}, options: {} },
                };
                config.catalog.providers.interleaved_gateway = {
                    models: {
                        "gateway-thinker": {
                            name: "gateway-thinker",
                            status: "stable",
                            source: "manual",
                            capabilities: {
                                toolCall: true,
                                reasoning: true,
                                thinking: true,
                                imageInput: false,
                                videoInput: false,
                                interleaved: { field: "reasoning" },
                            },
                            limits: { contextWindow: "auto", maxOutputTokens: null },
                        },
                    },
                };
                config.modelOverrides["interleaved_gateway/gateway-thinker"] = {
                    enabled: true,
                    name: "Gateway Thinker",
                    requestDefaults: { temperature: null, topP: null },
                    requestOptions: {},
                    headers: {},
                };
                originalFetch = globalThis.fetch;
                globalThis.fetch = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _g.label = 1;
            case 1:
                _g.trys.push([1, , 14, 15]);
                provider = (0, provider_1.providerForModel)(config, "interleaved_gateway/gateway-thinker");
                (0, bun_test_1.expect)(provider).toBeInstanceOf(provider_1.OpenAICompatibleProvider);
                _g.label = 2;
            case 2:
                _g.trys.push([2, 7, 8, 13]);
                _a = true, _b = __asyncValues(provider.stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "",
                            toolCalls: [{ id: "call_1", name: "read_file", arguments: "{}" }],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "call_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _g.label = 3;
            case 3: return [4 /*yield*/, _b.next()];
            case 4:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 6];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _g.label = 5;
            case 5:
                _a = true;
                return [3 /*break*/, 3];
            case 6: return [3 /*break*/, 13];
            case 7:
                e_15_1 = _g.sent();
                e_15 = { error: e_15_1 };
                return [3 /*break*/, 13];
            case 8:
                _g.trys.push([8, , 11, 12]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 10];
                return [4 /*yield*/, _e.call(_b)];
            case 9:
                _g.sent();
                _g.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                if (e_15) throw e_15.error;
                return [7 /*endfinally*/];
            case 12: return [7 /*endfinally*/];
            case 13: return [3 /*break*/, 15];
            case 14:
                globalThis.fetch = originalFetch;
                return [7 /*endfinally*/];
            case 15:
                (0, bun_test_1.expect)((body === null || body === void 0 ? void 0 : body.messages)[0]).toMatchObject({
                    role: "assistant",
                    reasoning: "",
                });
                (0, bun_test_1.expect)((body === null || body === void 0 ? void 0 : body.messages)[0]).not.toHaveProperty("reasoning_content");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic-compatible provider names use the Messages API adapter", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requested, bodies, fetchImpl, _i, _a, baseURL, provider, _b, _c, _d, _chunk, e_16_1;
    var _e, e_16, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                requested = [];
                bodies = [];
                fetchImpl = Object.assign(function (input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    var url;
                    return __generator(this, function (_a) {
                        url = String(input);
                        requested.push(url);
                        if (url.endsWith("/models"))
                            return [2 /*return*/, Response.json({
                                    data: [
                                        {
                                            id: "claude-compatible-model",
                                            max_input_tokens: 200000,
                                            max_tokens: 32000,
                                        },
                                    ],
                                })];
                        bodies.push(JSON.parse(String(init === null || init === void 0 ? void 0 : init.body)));
                        return [2 /*return*/, new Response("event: message_stop\ndata: {}\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _i = 0, _a = [
                    "https://gateway.example/v1",
                    "https://gateway.example/v1/messages",
                ];
                _h.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 14];
                baseURL = _a[_i];
                provider = (0, provider_1.providerFromKind)({
                    provider: "anthropic-compatible",
                    apiKey: "test-key",
                    model: "claude-compatible-model",
                    baseURL: baseURL,
                    fetch: fetchImpl,
                });
                (0, bun_test_1.expect)(provider).toBeInstanceOf(provider_1.AnthropicProvider);
                _h.label = 2;
            case 2:
                _h.trys.push([2, 7, 8, 13]);
                _b = true, _c = (e_16 = void 0, __asyncValues(provider.stream({ messages: [] })));
                _h.label = 3;
            case 3: return [4 /*yield*/, _c.next()];
            case 4:
                if (!(_d = _h.sent(), _e = _d.done, !_e)) return [3 /*break*/, 6];
                _g = _d.value;
                _b = false;
                _chunk = _g;
                _h.label = 5;
            case 5:
                _b = true;
                return [3 /*break*/, 3];
            case 6: return [3 /*break*/, 13];
            case 7:
                e_16_1 = _h.sent();
                e_16 = { error: e_16_1 };
                return [3 /*break*/, 13];
            case 8:
                _h.trys.push([8, , 11, 12]);
                if (!(!_b && !_e && (_f = _c.return))) return [3 /*break*/, 10];
                return [4 /*yield*/, _f.call(_c)];
            case 9:
                _h.sent();
                _h.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                if (e_16) throw e_16.error;
                return [7 /*endfinally*/];
            case 12: return [7 /*endfinally*/];
            case 13:
                _i++;
                return [3 /*break*/, 1];
            case 14:
                (0, bun_test_1.expect)(requested).toEqual([
                    "https://gateway.example/v1/models",
                    "https://gateway.example/v1/messages",
                    "https://gateway.example/v1/models",
                    "https://gateway.example/v1/messages",
                ]);
                (0, bun_test_1.expect)(bodies.map(function (body) { return body.max_tokens; })).toEqual([32000, 32000]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible provider preserves content and usage from the same SSE frame", function () { return __awaiter(void 0, void 0, void 0, function () {
    var fetchImpl, provider, chunks, _a, _b, _c, chunk, e_17_1;
    var _d, e_17, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        return [2 /*return*/, new Response([
                                'data: {"choices":[{"delta":{"content":"hello","reasoning_content":"think"}}],"usage":{"prompt_tokens":3,"completion_tokens":2}}',
                                "",
                                "data: [DONE]",
                                "",
                            ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "test-key",
                    model: "test-model",
                    fetch: fetchImpl,
                });
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_17_1 = _g.sent();
                e_17 = { error: e_17_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_17) throw e_17.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual(bun_test_1.expect.arrayContaining([
                    { type: "usage", inputTokens: 3, outputTokens: 2 },
                    { type: "thinking", text: "think", field: "reasoning_content" },
                    { type: "content", text: "hello" },
                ]));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible keeps reasoning_content when it shares a delta with tool_calls", function () { return __awaiter(void 0, void 0, void 0, function () {
    var sse, chunks, _a, _b, _c, chunk, e_18_1;
    var _d, e_18, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                sse = "data: ".concat(JSON.stringify({
                    choices: [
                        {
                            delta: {
                                reasoning_content: "final thought",
                                tool_calls: [
                                    {
                                        index: 0,
                                        id: "call_1",
                                        function: { name: "read_file", arguments: "{}" },
                                    },
                                ],
                            },
                            finish_reason: "tool_calls",
                        },
                    ],
                }), "\n\n") + "data: [DONE]\n\n";
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.OpenAICompatibleProvider({
                    apiKey: "key",
                    model: "deepseek-thinking",
                    fetch: Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, new Response(sse, {
                                    headers: { "content-type": "text/event-stream" },
                                })];
                        });
                    }); }, { preconnect: fetch.preconnect }),
                }).stream({ messages: [{ role: "user", content: "go" }] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_18_1 = _g.sent();
                e_18 = { error: e_18_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_18) throw e_18.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    {
                        type: "thinking",
                        text: "final thought",
                        field: "reasoning_content",
                    },
                    {
                        type: "tool_call",
                        calls: [
                            {
                                id: "call_1",
                                name: "read_file",
                                arguments: "{}",
                            },
                        ],
                    },
                    { type: "done", finishReason: "tool_calls" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible provider maps legacy function and recipient streaming calls", function () { return __awaiter(void 0, void 0, void 0, function () {
    var fetchImpl, provider, chunks, _a, _b, _c, chunk, e_19_1;
    var _d, e_19, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        return [2 /*return*/, new Response([
                                'data: {"choices":[{"delta":{"recipient":"functions.run_shell","content":"{\\"command\\":\\"pwd"}}]}',
                                "",
                                'data: {"choices":[{"delta":{"content":"\\"}"},"finish_reason":"tool_calls"}]}',
                                "",
                                'data: {"choices":[{"delta":{"function_call":{"name":"glob","arguments":"{\\"pattern\\":\\"*.ts\\"}"}},"finish_reason":"function_call"}]}',
                                "",
                                "data: [DONE]",
                                "",
                            ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "test-key",
                    model: "test-model",
                    fetch: fetchImpl,
                });
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_19_1 = _g.sent();
                e_19 = { error: e_19_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_19) throw e_19.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual(bun_test_1.expect.arrayContaining([
                    {
                        type: "tool_call",
                        calls: [
                            {
                                id: "tool_0",
                                name: "run_shell",
                                arguments: '{"command":"pwd"}',
                            },
                        ],
                    },
                    {
                        type: "tool_call",
                        calls: [
                            { id: "tool_0", name: "glob", arguments: '{"pattern":"*.ts"}' },
                        ],
                    },
                ]));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible provider accepts gateway tool-call name aliases", function () { return __awaiter(void 0, void 0, void 0, function () {
    var fetchImpl, provider, chunks, _a, _b, _c, chunk, e_20_1;
    var _d, e_20, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        return [2 /*return*/, new Response([
                                'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_top_name","name":"glob","function":{"arguments":"{\\"pattern\\":\\"*.ts\\"}"}}]}}]}',
                                "",
                                'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"call_recipient","recipient":"functions.run_shell","function":{"arguments":"{\\"command\\":\\"pwd\\"}"}}]},"finish_reason":"tool_calls"}]}',
                                "",
                                "data: [DONE]",
                                "",
                            ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "test-key",
                    model: "test-model",
                    fetch: fetchImpl,
                });
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_20_1 = _g.sent();
                e_20 = { error: e_20_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_20) throw e_20.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual(bun_test_1.expect.arrayContaining([
                    {
                        type: "tool_call",
                        calls: [
                            {
                                id: "call_top_name",
                                name: "glob",
                                arguments: '{"pattern":"*.ts"}',
                            },
                            {
                                id: "call_recipient",
                                name: "run_shell",
                                arguments: '{"command":"pwd"}',
                            },
                        ],
                    },
                ]));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible provider waits for a later function name fragment", function () { return __awaiter(void 0, void 0, void 0, function () {
    var fetchImpl, provider, chunks, _a, _b, _c, chunk, e_21_1;
    var _d, e_21, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        return [2 /*return*/, new Response([
                                'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"path\\":\\"README"}}]}}]}',
                                "",
                                'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"read_file","arguments":".md\\"}"}}]},"finish_reason":"tool_calls"}]}',
                                "",
                                "data: [DONE]",
                                "",
                            ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "test-key",
                    model: "test-model",
                    fetch: fetchImpl,
                });
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_21_1 = _g.sent();
                e_21 = { error: e_21_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_21) throw e_21.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    {
                        type: "tool_call",
                        calls: [
                            {
                                id: "tool_0",
                                name: "read_file",
                                arguments: '{"path":"README.md"}',
                            },
                        ],
                    },
                    { type: "done", finishReason: "tool_calls" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible provider normalizes alternate gateway function fields", function () { return __awaiter(void 0, void 0, void 0, function () {
    var fetchImpl, provider, chunks, _a, _b, _c, chunk, e_22_1;
    var _d, e_22, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        return [2 /*return*/, new Response([
                                'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_function","function":"functions.read_file","input":"{\\"path\\":\\"README.md\\"}"},{"index":1,"id":"call_alias","tool_name":"tools.glob","arguments":"{\\"pattern\\":\\"*.ts\\"}"}]},"finish_reason":"tool_calls"}]}',
                                "",
                                "data: [DONE]",
                                "",
                            ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "test-key",
                    model: "test-model",
                    fetch: fetchImpl,
                });
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_22_1 = _g.sent();
                e_22 = { error: e_22_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_22) throw e_22.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual(bun_test_1.expect.arrayContaining([
                    {
                        type: "tool_call",
                        calls: [
                            {
                                id: "call_function",
                                name: "read_file",
                                arguments: '{"path":"README.md"}',
                            },
                            {
                                id: "call_alias",
                                name: "glob",
                                arguments: '{"pattern":"*.ts"}',
                            },
                        ],
                    },
                ]));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible provider sends active profile request parameters safely", function () { return __awaiter(void 0, void 0, void 0, function () {
    var headers, body, fetchImpl, provider, _a, _b, _c, _chunk, e_23_1;
    var _d, e_23, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        headers = new Headers(init === null || init === void 0 ? void 0 : init.headers);
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "test-key",
                    model: "test-model",
                    authHeader: "x-provider-key",
                    customHeaders: { "x-request-source": "natalia" },
                    temperature: 0.2,
                    maxTokens: 4096,
                    topP: 0.9,
                    reasoningEffort: "high",
                    thinkingEnabled: true,
                    fetch: fetchImpl,
                });
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_23_1 = _g.sent();
                e_23 = { error: e_23_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_23) throw e_23.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(headers === null || headers === void 0 ? void 0 : headers.get("x-provider-key")).toBe("Bearer test-key");
                (0, bun_test_1.expect)(headers === null || headers === void 0 ? void 0 : headers.get("x-request-source")).toBe("natalia");
                (0, bun_test_1.expect)(body).toMatchObject({
                    temperature: 0.2,
                    max_tokens: 4096,
                    top_p: 0.9,
                    reasoning_effort: "high",
                    thinking_enabled: true,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible provider omits unsupported reasoning and thinking request options", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, provider, _a, _b, _c, _chunk, e_24_1;
    var _d, e_24, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "test-key",
                    model: "test-model",
                    reasoningEffort: undefined,
                    thinkingEnabled: undefined,
                    fetch: fetchImpl,
                });
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_24_1 = _g.sent();
                e_24 = { error: e_24_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_24) throw e_24.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(body).not.toHaveProperty("reasoning_effort");
                (0, bun_test_1.expect)(body).not.toHaveProperty("thinking_enabled");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("providers lower image parts to their native request formats", function () { return __awaiter(void 0, void 0, void 0, function () {
    var request, bodies, fetchFor, _a, _b, _c, _chunk, e_25_1, _d, _e, _f, _chunk, e_26_1, anthropic, gemini;
    var _g, e_25, _h, _j, _k, e_26, _l, _m;
    var _o, _p;
    return __generator(this, function (_q) {
        switch (_q.label) {
            case 0:
                request = {
                    messages: [
                        {
                            role: "user",
                            content: "inspect",
                            images: [
                                {
                                    mediaType: "image/png",
                                    dataURL: "data:image/png;base64,cG5n",
                                },
                            ],
                        },
                    ],
                };
                bodies = {};
                fetchFor = function (name) {
                    return Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            bodies[name] = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                            return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                    headers: { "content-type": "text/event-stream" },
                                })];
                        });
                    }); }, { preconnect: fetch.preconnect });
                };
                _q.label = 1;
            case 1:
                _q.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.AnthropicProvider({
                    apiKey: "key",
                    model: "model",
                    fetch: fetchFor("anthropic"),
                }).stream(request));
                _q.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _q.sent(), _g = _c.done, !_g)) return [3 /*break*/, 5];
                _j = _c.value;
                _a = false;
                _chunk = _j;
                _q.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_25_1 = _q.sent();
                e_25 = { error: e_25_1 };
                return [3 /*break*/, 12];
            case 7:
                _q.trys.push([7, , 10, 11]);
                if (!(!_a && !_g && (_h = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _h.call(_b)];
            case 8:
                _q.sent();
                _q.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_25) throw e_25.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                _q.trys.push([12, 17, 18, 23]);
                _d = true, _e = __asyncValues(new provider_1.GeminiProvider({
                    apiKey: "key",
                    model: "model",
                    fetch: fetchFor("gemini"),
                }).stream(request));
                _q.label = 13;
            case 13: return [4 /*yield*/, _e.next()];
            case 14:
                if (!(_f = _q.sent(), _k = _f.done, !_k)) return [3 /*break*/, 16];
                _m = _f.value;
                _d = false;
                _chunk = _m;
                _q.label = 15;
            case 15:
                _d = true;
                return [3 /*break*/, 13];
            case 16: return [3 /*break*/, 23];
            case 17:
                e_26_1 = _q.sent();
                e_26 = { error: e_26_1 };
                return [3 /*break*/, 23];
            case 18:
                _q.trys.push([18, , 21, 22]);
                if (!(!_d && !_k && (_l = _e.return))) return [3 /*break*/, 20];
                return [4 /*yield*/, _l.call(_e)];
            case 19:
                _q.sent();
                _q.label = 20;
            case 20: return [3 /*break*/, 22];
            case 21:
                if (e_26) throw e_26.error;
                return [7 /*endfinally*/];
            case 22: return [7 /*endfinally*/];
            case 23:
                anthropic = bodies.anthropic.messages;
                gemini = bodies.gemini.contents;
                (0, bun_test_1.expect)((_o = anthropic[0]) === null || _o === void 0 ? void 0 : _o.content.find(function (part) { return part.type === "image"; })).toMatchObject({
                    source: { type: "base64", media_type: "image/png", data: "cG5n" },
                });
                (0, bun_test_1.expect)((_p = gemini[0]) === null || _p === void 0 ? void 0 : _p.parts.find(function (part) { return part.inlineData; })).toMatchObject({
                    inlineData: { mimeType: "image/png", data: "cG5n" },
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("provider adapters materialize durable attachment refs through the resolver", function () { return __awaiter(void 0, void 0, void 0, function () {
    var resolved, request, body, fetchImpl, _a, _b, _c, _chunk, e_27_1, messages;
    var _d, e_27, _e, _f;
    var _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                resolved = 0;
                request = {
                    messages: [
                        {
                            role: "user",
                            content: "inspect",
                            images: [
                                {
                                    id: "att_1",
                                    path: ".natalia/attachments/att_1-image.png",
                                    filename: "image.png",
                                    mediaType: "image/png",
                                    byteLength: 8,
                                    sha256: "image-hash",
                                },
                            ],
                        },
                    ],
                    resolveAttachment: function (attachment) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            resolved += 1;
                            (0, bun_test_1.expect)(attachment.id).toBe("att_1");
                            return [2 /*return*/, "data:image/png;base64,cG5n"];
                        });
                    }); },
                };
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _h.label = 1;
            case 1:
                _h.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.AnthropicProvider({
                    apiKey: "key",
                    model: "model",
                    fetch: fetchImpl,
                }).stream(request));
                _h.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _h.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _h.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_27_1 = _h.sent();
                e_27 = { error: e_27_1 };
                return [3 /*break*/, 12];
            case 7:
                _h.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _h.sent();
                _h.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_27) throw e_27.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(resolved).toBe(1);
                messages = body === null || body === void 0 ? void 0 : body.messages;
                (0, bun_test_1.expect)((_g = messages[0]) === null || _g === void 0 ? void 0 : _g.content.find(function (part) { return part.type === "image"; })).toMatchObject({
                    source: { type: "base64", media_type: "image/png", data: "cG5n" },
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible forwards assistant reasoning_content on tool-call follow-up", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, provider, _a, _b, _c, _chunk, e_28_1;
    var _d, e_28, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "key",
                    model: "deepseek-thinking",
                    fetch: fetchImpl,
                });
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "",
                            reasoningContent: "I should call the tool first.",
                            toolCalls: [{ id: "call_1", name: "read_file", arguments: "{}" }],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "call_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_28_1 = _g.sent();
                e_28 = { error: e_28_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_28) throw e_28.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)((body === null || body === void 0 ? void 0 : body.messages)[0]).toMatchObject({
                    role: "assistant",
                    reasoning_content: "I should call the tool first.",
                    tool_calls: [
                        {
                            id: "call_1",
                            type: "function",
                            function: { name: "read_file", arguments: "{}" },
                        },
                    ],
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible keeps the provider reasoning field on assistant replay", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, provider, _a, _b, _c, _chunk, e_29_1;
    var _d, e_29, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "key",
                    model: "gateway-thinking",
                    fetch: fetchImpl,
                });
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "",
                            reasoningContent: "plan",
                            reasoningField: "reasoning",
                            toolCalls: [{ id: "call_1", name: "read_file", arguments: "{}" }],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "call_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_29_1 = _g.sent();
                e_29 = { error: e_29_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_29) throw e_29.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)((body === null || body === void 0 ? void 0 : body.messages)[0]).toMatchObject({
                    role: "assistant",
                    reasoning: "plan",
                });
                (0, bun_test_1.expect)((body === null || body === void 0 ? void 0 : body.messages)[0]).not.toHaveProperty("reasoning_content");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible interleaved replay sends an empty reasoning field", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, provider, _a, _b, _c, _chunk, e_30_1;
    var _d, e_30, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "key",
                    model: "deepseek-chat",
                    interleavedReasoningField: "reasoning_content",
                    fetch: fetchImpl,
                });
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "",
                            toolCalls: [{ id: "call_1", name: "read_file", arguments: "{}" }],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "call_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_30_1 = _g.sent();
                e_30 = { error: e_30_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_30) throw e_30.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)((body === null || body === void 0 ? void 0 : body.messages)[0]).toMatchObject({
                    role: "assistant",
                    reasoning_content: "",
                    tool_calls: [
                        {
                            id: "call_1",
                            type: "function",
                            function: { name: "read_file", arguments: "{}" },
                        },
                    ],
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible preserves encrypted reasoning_details across tool calls", function () { return __awaiter(void 0, void 0, void 0, function () {
    var reasoningDetail, body, calls, fetchImpl, provider, chunks, _a, _b, _c, chunk, e_31_1, toolCall, _d, _e, _f, _chunk, e_32_1;
    var _g, e_31, _h, _j, _k, e_32, _l, _m;
    var _o;
    return __generator(this, function (_p) {
        switch (_p.label) {
            case 0:
                reasoningDetail = {
                    type: "reasoning.encrypted",
                    id: "call_1",
                    data: "encrypted-signature",
                };
                calls = 0;
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        calls += 1;
                        if (calls === 1)
                            return [2 /*return*/, new Response([
                                    "data: ".concat(JSON.stringify({ choices: [{ delta: { reasoning_details: [reasoningDetail] } }] })),
                                    "",
                                    "data: ".concat(JSON.stringify({
                                        choices: [
                                            {
                                                finish_reason: "tool_calls",
                                                delta: {
                                                    tool_calls: [
                                                        {
                                                            index: 0,
                                                            id: "call_1",
                                                            type: "function",
                                                            function: {
                                                                name: "read_file",
                                                                arguments: "{}",
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                        ],
                                    })),
                                    "",
                                    "data: [DONE]",
                                    "",
                                ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "key",
                    model: "gemini-test",
                    fetch: fetchImpl,
                });
                chunks = [];
                _p.label = 1;
            case 1:
                _p.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _p.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _p.sent(), _g = _c.done, !_g)) return [3 /*break*/, 5];
                _j = _c.value;
                _a = false;
                chunk = _j;
                chunks.push(chunk);
                _p.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_31_1 = _p.sent();
                e_31 = { error: e_31_1 };
                return [3 /*break*/, 12];
            case 7:
                _p.trys.push([7, , 10, 11]);
                if (!(!_a && !_g && (_h = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _h.call(_b)];
            case 8:
                _p.sent();
                _p.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_31) throw e_31.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                toolCall = (_o = chunks.find(function (chunk) {
                    return chunk.type === "tool_call";
                })) === null || _o === void 0 ? void 0 : _o.calls[0];
                (0, bun_test_1.expect)(toolCall === null || toolCall === void 0 ? void 0 : toolCall.thoughtSignature).toBe(JSON.stringify(reasoningDetail));
                if (!toolCall)
                    throw new Error("expected a streamed tool call");
                _p.label = 13;
            case 13:
                _p.trys.push([13, 18, 19, 24]);
                _d = true, _e = __asyncValues(provider.stream({
                    messages: [
                        { role: "assistant", content: "", toolCalls: [toolCall] },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "call_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _p.label = 14;
            case 14: return [4 /*yield*/, _e.next()];
            case 15:
                if (!(_f = _p.sent(), _k = _f.done, !_k)) return [3 /*break*/, 17];
                _m = _f.value;
                _d = false;
                _chunk = _m;
                _p.label = 16;
            case 16:
                _d = true;
                return [3 /*break*/, 14];
            case 17: return [3 /*break*/, 24];
            case 18:
                e_32_1 = _p.sent();
                e_32 = { error: e_32_1 };
                return [3 /*break*/, 24];
            case 19:
                _p.trys.push([19, , 22, 23]);
                if (!(!_d && !_k && (_l = _e.return))) return [3 /*break*/, 21];
                return [4 /*yield*/, _l.call(_e)];
            case 20:
                _p.sent();
                _p.label = 21;
            case 21: return [3 /*break*/, 23];
            case 22:
                if (e_32) throw e_32.error;
                return [7 /*endfinally*/];
            case 23: return [7 /*endfinally*/];
            case 24:
                (0, bun_test_1.expect)((body === null || body === void 0 ? void 0 : body.messages)[0]).toMatchObject({
                    role: "assistant",
                    reasoning_details: [reasoningDetail],
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible accumulates OpenRouter reasoning_details for replay", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, calls, firstDetail, secondDetail, fetchImpl, provider, chunks, _a, _b, _c, chunk, e_33_1, done, _d, _e, _f, _chunk, e_34_1, assistant;
    var _g, e_33, _h, _j, _k, e_34, _l, _m;
    return __generator(this, function (_o) {
        switch (_o.label) {
            case 0:
                calls = 0;
                firstDetail = {
                    type: "reasoning.text",
                    text: "think",
                    index: 0,
                };
                secondDetail = {
                    type: "reasoning.text",
                    text: "ing",
                    signature: "sig",
                    format: "anthropic-claude-v1",
                    index: 0,
                };
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        calls += 1;
                        if (calls === 1)
                            return [2 /*return*/, new Response([
                                    "data: ".concat(JSON.stringify({
                                        choices: [{ delta: { reasoning_details: [firstDetail] } }],
                                    })),
                                    "",
                                    "data: ".concat(JSON.stringify({
                                        choices: [
                                            {
                                                delta: {
                                                    reasoning_details: [secondDetail],
                                                    content: "answer",
                                                },
                                                finish_reason: "stop",
                                            },
                                        ],
                                    })),
                                    "",
                                    "data: [DONE]",
                                    "",
                                ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "key",
                    model: "openrouter-test",
                    interleavedReasoningField: "reasoning_content",
                    fetch: fetchImpl,
                });
                chunks = [];
                _o.label = 1;
            case 1:
                _o.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _o.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _o.sent(), _g = _c.done, !_g)) return [3 /*break*/, 5];
                _j = _c.value;
                _a = false;
                chunk = _j;
                chunks.push(chunk);
                _o.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_33_1 = _o.sent();
                e_33 = { error: e_33_1 };
                return [3 /*break*/, 12];
            case 7:
                _o.trys.push([7, , 10, 11]);
                if (!(!_a && !_g && (_h = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _h.call(_b)];
            case 8:
                _o.sent();
                _o.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_33) throw e_33.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                done = chunks.find(function (chunk) {
                    return chunk.type === "done";
                });
                (0, bun_test_1.expect)(done === null || done === void 0 ? void 0 : done.providerMetadata).toEqual({
                    openrouter: {
                        reasoning_details: [
                            {
                                type: "reasoning.text",
                                text: "thinking",
                                signature: "sig",
                                format: "anthropic-claude-v1",
                                index: 0,
                            },
                        ],
                    },
                });
                _o.label = 13;
            case 13:
                _o.trys.push([13, 18, 19, 24]);
                _d = true, _e = __asyncValues(provider.stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "answer",
                            providerMetadata: done === null || done === void 0 ? void 0 : done.providerMetadata,
                        },
                    ],
                }));
                _o.label = 14;
            case 14: return [4 /*yield*/, _e.next()];
            case 15:
                if (!(_f = _o.sent(), _k = _f.done, !_k)) return [3 /*break*/, 17];
                _m = _f.value;
                _d = false;
                _chunk = _m;
                _o.label = 16;
            case 16:
                _d = true;
                return [3 /*break*/, 14];
            case 17: return [3 /*break*/, 24];
            case 18:
                e_34_1 = _o.sent();
                e_34 = { error: e_34_1 };
                return [3 /*break*/, 24];
            case 19:
                _o.trys.push([19, , 22, 23]);
                if (!(!_d && !_k && (_l = _e.return))) return [3 /*break*/, 21];
                return [4 /*yield*/, _l.call(_e)];
            case 20:
                _o.sent();
                _o.label = 21;
            case 21: return [3 /*break*/, 23];
            case 22:
                if (e_34) throw e_34.error;
                return [7 /*endfinally*/];
            case 23: return [7 /*endfinally*/];
            case 24:
                assistant = (body === null || body === void 0 ? void 0 : body.messages)[0];
                (0, bun_test_1.expect)(assistant).toMatchObject({
                    role: "assistant",
                    reasoning_details: [
                        {
                            type: "reasoning.text",
                            text: "thinking",
                            signature: "sig",
                            format: "anthropic-claude-v1",
                            index: 0,
                        },
                    ],
                });
                (0, bun_test_1.expect)(assistant).not.toHaveProperty("reasoning_content");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible preserves reasoning_opaque for replay", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, calls, fetchImpl, provider, chunks, _a, _b, _c, chunk, e_35_1, toolCall, _d, _e, _f, _chunk, e_36_1;
    var _g, e_35, _h, _j, _k, e_36, _l, _m;
    var _o;
    return __generator(this, function (_p) {
        switch (_p.label) {
            case 0:
                calls = 0;
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        calls += 1;
                        if (calls === 1)
                            return [2 /*return*/, new Response([
                                    "data: ".concat(JSON.stringify({
                                        choices: [
                                            {
                                                delta: {
                                                    reasoning_text: "think",
                                                    reasoning_opaque: "opaque-signature",
                                                },
                                            },
                                        ],
                                    })),
                                    "",
                                    "data: ".concat(JSON.stringify({
                                        choices: [
                                            {
                                                finish_reason: "tool_calls",
                                                delta: {
                                                    tool_calls: [
                                                        {
                                                            index: 0,
                                                            id: "call_1",
                                                            type: "function",
                                                            function: { name: "read_file", arguments: "{}" },
                                                        },
                                                    ],
                                                },
                                            },
                                        ],
                                    })),
                                    "",
                                    "data: [DONE]",
                                    "",
                                ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "key",
                    model: "copilot-test",
                    fetch: fetchImpl,
                });
                chunks = [];
                _p.label = 1;
            case 1:
                _p.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _p.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _p.sent(), _g = _c.done, !_g)) return [3 /*break*/, 5];
                _j = _c.value;
                _a = false;
                chunk = _j;
                chunks.push(chunk);
                _p.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_35_1 = _p.sent();
                e_35 = { error: e_35_1 };
                return [3 /*break*/, 12];
            case 7:
                _p.trys.push([7, , 10, 11]);
                if (!(!_a && !_g && (_h = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _h.call(_b)];
            case 8:
                _p.sent();
                _p.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_35) throw e_35.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toContainEqual({
                    type: "thinking",
                    text: "think",
                    field: "reasoning_text",
                });
                (0, bun_test_1.expect)(chunks).toContainEqual({
                    type: "thinking",
                    text: "",
                    field: "reasoning_text",
                    signature: "opaque-signature",
                });
                toolCall = (_o = chunks.find(function (chunk) {
                    return chunk.type === "tool_call";
                })) === null || _o === void 0 ? void 0 : _o.calls[0];
                if (!toolCall)
                    throw new Error("expected a streamed tool call");
                _p.label = 13;
            case 13:
                _p.trys.push([13, 18, 19, 24]);
                _d = true, _e = __asyncValues(provider.stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "",
                            reasoningContent: "think",
                            reasoningField: "reasoning_text",
                            reasoningSignature: "opaque-signature",
                            toolCalls: [toolCall],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "call_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _p.label = 14;
            case 14: return [4 /*yield*/, _e.next()];
            case 15:
                if (!(_f = _p.sent(), _k = _f.done, !_k)) return [3 /*break*/, 17];
                _m = _f.value;
                _d = false;
                _chunk = _m;
                _p.label = 16;
            case 16:
                _d = true;
                return [3 /*break*/, 14];
            case 17: return [3 /*break*/, 24];
            case 18:
                e_36_1 = _p.sent();
                e_36 = { error: e_36_1 };
                return [3 /*break*/, 24];
            case 19:
                _p.trys.push([19, , 22, 23]);
                if (!(!_d && !_k && (_l = _e.return))) return [3 /*break*/, 21];
                return [4 /*yield*/, _l.call(_e)];
            case 20:
                _p.sent();
                _p.label = 21;
            case 21: return [3 /*break*/, 23];
            case 22:
                if (e_36) throw e_36.error;
                return [7 /*endfinally*/];
            case 23: return [7 /*endfinally*/];
            case 24:
                (0, bun_test_1.expect)((body === null || body === void 0 ? void 0 : body.messages)[0]).toMatchObject({
                    role: "assistant",
                    reasoning_text: "think",
                    reasoning_opaque: "opaque-signature",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic forwards signed thinking blocks on assistant tool-call replay", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, _a, _b, _c, _chunk, e_37_1;
    var _d, e_37, _e, _f;
    var _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _h.label = 1;
            case 1:
                _h.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.AnthropicProvider({
                    apiKey: "key",
                    model: "claude-thinking",
                    fetch: fetchImpl,
                }).stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "",
                            reasoningContent: "inspect the workspace",
                            reasoningSignature: "signed-thinking",
                            toolCalls: [{ id: "toolu_1", name: "read_file", arguments: "{}" }],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "toolu_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _h.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _h.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _h.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_37_1 = _h.sent();
                e_37 = { error: e_37_1 };
                return [3 /*break*/, 12];
            case 7:
                _h.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _h.sent();
                _h.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_37) throw e_37.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)((_g = (body === null || body === void 0 ? void 0 : body.messages)[0]) === null || _g === void 0 ? void 0 : _g.content).toEqual([
                    {
                        type: "thinking",
                        thinking: "inspect the workspace",
                        signature: "signed-thinking",
                    },
                    {
                        type: "tool_use",
                        id: "toolu_1",
                        name: "read_file",
                        input: {},
                    },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Gemini forwards thought signatures on assistant tool-call replay", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, _a, _b, _c, _chunk, e_38_1, contents;
    var _d, e_38, _e, _f;
    var _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _h.label = 1;
            case 1:
                _h.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.GeminiProvider({
                    apiKey: "key",
                    model: "gemini-3-pro",
                    fetch: fetchImpl,
                }).stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "",
                            reasoningContent: "internal thought",
                            reasoningSignature: "thought-sig",
                            toolCalls: [
                                {
                                    id: "call_1",
                                    name: "read_file",
                                    arguments: "{}",
                                    thoughtSignature: "call-sig",
                                },
                            ],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "call_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _h.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _h.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _h.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_38_1 = _h.sent();
                e_38 = { error: e_38_1 };
                return [3 /*break*/, 12];
            case 7:
                _h.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _h.sent();
                _h.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_38) throw e_38.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                contents = body === null || body === void 0 ? void 0 : body.contents;
                (0, bun_test_1.expect)((_g = contents[0]) === null || _g === void 0 ? void 0 : _g.parts).toEqual([
                    {
                        thought: true,
                        text: "internal thought",
                        thoughtSignature: "thought-sig",
                    },
                    {
                        functionCall: { name: "read_file", args: {} },
                        thoughtSignature: "call-sig",
                    },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Gemini preserves a text part thoughtSignature across replay", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, calls, fetchImpl, provider, chunks, _a, _b, _c, chunk, e_39_1, _d, _e, _f, _chunk, e_40_1, contents;
    var _g, e_39, _h, _j, _k, e_40, _l, _m;
    var _o;
    return __generator(this, function (_p) {
        switch (_p.label) {
            case 0:
                calls = 0;
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        calls += 1;
                        if (calls === 1)
                            return [2 /*return*/, new Response([
                                    "data: ".concat(JSON.stringify({
                                        candidates: [
                                            {
                                                content: {
                                                    parts: [{ text: "visible", thoughtSignature: "text-sig" }],
                                                },
                                            },
                                        ],
                                    })),
                                    "",
                                    "data: [DONE]",
                                    "",
                                ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.GeminiProvider({
                    apiKey: "key",
                    model: "gemini-3-pro",
                    fetch: fetchImpl,
                });
                chunks = [];
                _p.label = 1;
            case 1:
                _p.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _p.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _p.sent(), _g = _c.done, !_g)) return [3 /*break*/, 5];
                _j = _c.value;
                _a = false;
                chunk = _j;
                chunks.push(chunk);
                _p.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_39_1 = _p.sent();
                e_39 = { error: e_39_1 };
                return [3 /*break*/, 12];
            case 7:
                _p.trys.push([7, , 10, 11]);
                if (!(!_a && !_g && (_h = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _h.call(_b)];
            case 8:
                _p.sent();
                _p.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_39) throw e_39.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toContainEqual({
                    type: "content",
                    text: "visible",
                    textSignature: "text-sig",
                });
                _p.label = 13;
            case 13:
                _p.trys.push([13, 18, 19, 24]);
                _d = true, _e = __asyncValues(provider.stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "visible",
                            textSignature: "text-sig",
                        },
                    ],
                }));
                _p.label = 14;
            case 14: return [4 /*yield*/, _e.next()];
            case 15:
                if (!(_f = _p.sent(), _k = _f.done, !_k)) return [3 /*break*/, 17];
                _m = _f.value;
                _d = false;
                _chunk = _m;
                _p.label = 16;
            case 16:
                _d = true;
                return [3 /*break*/, 14];
            case 17: return [3 /*break*/, 24];
            case 18:
                e_40_1 = _p.sent();
                e_40 = { error: e_40_1 };
                return [3 /*break*/, 24];
            case 19:
                _p.trys.push([19, , 22, 23]);
                if (!(!_d && !_k && (_l = _e.return))) return [3 /*break*/, 21];
                return [4 /*yield*/, _l.call(_e)];
            case 20:
                _p.sent();
                _p.label = 21;
            case 21: return [3 /*break*/, 23];
            case 22:
                if (e_40) throw e_40.error;
                return [7 /*endfinally*/];
            case 23: return [7 /*endfinally*/];
            case 24:
                contents = body === null || body === void 0 ? void 0 : body.contents;
                (0, bun_test_1.expect)((_o = contents[0]) === null || _o === void 0 ? void 0 : _o.parts).toEqual([
                    { text: "visible", thoughtSignature: "text-sig" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Gemini preserves multiple thought signatures in order", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, calls, fetchImpl, provider, chunks, _a, _b, _c, chunk, e_41_1, _d, _e, _f, _chunk, e_42_1, contents;
    var _g, e_41, _h, _j, _k, e_42, _l, _m;
    var _o;
    return __generator(this, function (_p) {
        switch (_p.label) {
            case 0:
                calls = 0;
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        calls += 1;
                        if (calls === 1)
                            return [2 /*return*/, new Response([
                                    "data: ".concat(JSON.stringify({
                                        candidates: [
                                            {
                                                content: {
                                                    parts: [
                                                        {
                                                            thought: true,
                                                            text: "plan A",
                                                            thoughtSignature: "sig-A",
                                                        },
                                                        {
                                                            thought: true,
                                                            text: "plan B",
                                                            thoughtSignature: "sig-B",
                                                        },
                                                        {
                                                            functionCall: { name: "read_file", args: {} },
                                                            thoughtSignature: "call-sig",
                                                        },
                                                    ],
                                                },
                                            },
                                        ],
                                    })),
                                    "",
                                    "data: [DONE]",
                                    "",
                                ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.GeminiProvider({
                    apiKey: "key",
                    model: "gemini-3-pro",
                    fetch: fetchImpl,
                });
                chunks = [];
                _p.label = 1;
            case 1:
                _p.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _p.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _p.sent(), _g = _c.done, !_g)) return [3 /*break*/, 5];
                _j = _c.value;
                _a = false;
                chunk = _j;
                chunks.push(chunk);
                _p.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_41_1 = _p.sent();
                e_41 = { error: e_41_1 };
                return [3 /*break*/, 12];
            case 7:
                _p.trys.push([7, , 10, 11]);
                if (!(!_a && !_g && (_h = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _h.call(_b)];
            case 8:
                _p.sent();
                _p.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_41) throw e_41.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toContainEqual({
                    type: "thinking",
                    text: "plan A",
                    signature: "sig-A",
                    blockIndex: 0,
                });
                (0, bun_test_1.expect)(chunks).toContainEqual({
                    type: "thinking",
                    text: "plan B",
                    signature: "sig-B",
                    blockIndex: 1,
                });
                _p.label = 13;
            case 13:
                _p.trys.push([13, 18, 19, 24]);
                _d = true, _e = __asyncValues(provider.stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "",
                            reasoningBlocks: [
                                { text: "plan A", signature: "sig-A" },
                                { text: "plan B", signature: "sig-B" },
                            ],
                            toolCalls: [
                                {
                                    id: "call_1",
                                    name: "read_file",
                                    arguments: "{}",
                                    thoughtSignature: "call-sig",
                                },
                            ],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "call_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _p.label = 14;
            case 14: return [4 /*yield*/, _e.next()];
            case 15:
                if (!(_f = _p.sent(), _k = _f.done, !_k)) return [3 /*break*/, 17];
                _m = _f.value;
                _d = false;
                _chunk = _m;
                _p.label = 16;
            case 16:
                _d = true;
                return [3 /*break*/, 14];
            case 17: return [3 /*break*/, 24];
            case 18:
                e_42_1 = _p.sent();
                e_42 = { error: e_42_1 };
                return [3 /*break*/, 24];
            case 19:
                _p.trys.push([19, , 22, 23]);
                if (!(!_d && !_k && (_l = _e.return))) return [3 /*break*/, 21];
                return [4 /*yield*/, _l.call(_e)];
            case 20:
                _p.sent();
                _p.label = 21;
            case 21: return [3 /*break*/, 23];
            case 22:
                if (e_42) throw e_42.error;
                return [7 /*endfinally*/];
            case 23: return [7 /*endfinally*/];
            case 24:
                contents = body === null || body === void 0 ? void 0 : body.contents;
                (0, bun_test_1.expect)((_o = contents[0]) === null || _o === void 0 ? void 0 : _o.parts).toEqual([
                    { thought: true, text: "plan A", thoughtSignature: "sig-A" },
                    { thought: true, text: "plan B", thoughtSignature: "sig-B" },
                    {
                        functionCall: { name: "read_file", args: {} },
                        thoughtSignature: "call-sig",
                    },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Gemini replays content parts in provider order", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, _a, _b, _c, _chunk, e_43_1, contents;
    var _d, e_43, _e, _f;
    var _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _h.label = 1;
            case 1:
                _h.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.GeminiProvider({
                    apiKey: "key",
                    model: "gemini-3-pro",
                    fetch: fetchImpl,
                }).stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "fallback text",
                            textSignature: "text-sig",
                            contentParts: [
                                { type: "thinking", text: "plan A", signature: "sig-A" },
                                { type: "text", text: "visible", textSignature: "text-sig" },
                                {
                                    type: "tool_call",
                                    id: "call_1",
                                    name: "read_file",
                                    arguments: "{}",
                                    thoughtSignature: "call-sig",
                                },
                            ],
                            toolCalls: [
                                {
                                    id: "call_1",
                                    name: "read_file",
                                    arguments: "{}",
                                    thoughtSignature: "call-sig",
                                },
                            ],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "call_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _h.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _h.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _h.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_43_1 = _h.sent();
                e_43 = { error: e_43_1 };
                return [3 /*break*/, 12];
            case 7:
                _h.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _h.sent();
                _h.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_43) throw e_43.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                contents = body === null || body === void 0 ? void 0 : body.contents;
                (0, bun_test_1.expect)((_g = contents[0]) === null || _g === void 0 ? void 0 : _g.parts).toEqual([
                    { thought: true, text: "plan A", thoughtSignature: "sig-A" },
                    { text: "visible", thoughtSignature: "text-sig" },
                    {
                        functionCall: { name: "read_file", args: {} },
                        thoughtSignature: "call-sig",
                    },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic parser exposes signature deltas for replay", function () { return __awaiter(void 0, void 0, void 0, function () {
    var sse, chunks, _a, _b, _c, chunk, e_44_1;
    var _d, e_44, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                sse = [
                    {
                        type: "content_block_start",
                        index: 0,
                        content_block: { type: "thinking", thinking: "" },
                    },
                    {
                        type: "content_block_delta",
                        index: 0,
                        delta: { type: "thinking_delta", thinking: "plan" },
                    },
                    {
                        type: "content_block_delta",
                        index: 0,
                        delta: { type: "signature_delta", signature: "sig" },
                    },
                    { type: "message_delta", delta: { stop_reason: "end_turn" } },
                ]
                    .map(function (event) { return "data: ".concat(JSON.stringify(event), "\n\n"); })
                    .join("");
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.AnthropicProvider({
                    apiKey: "key",
                    model: "claude-thinking",
                    fetch: Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, new Response(sse, {
                                    headers: { "content-type": "text/event-stream" },
                                })];
                        });
                    }); }, { preconnect: fetch.preconnect }),
                }).stream({ messages: [{ role: "user", content: "go" }] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_44_1 = _g.sent();
                e_44 = { error: e_44_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_44) throw e_44.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    { type: "thinking", text: "plan", blockIndex: 0 },
                    { type: "thinking", text: "", signature: "sig", blockIndex: 0 },
                    { type: "done", finishReason: "stop" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic parser keeps multiple thinking blocks distinct", function () { return __awaiter(void 0, void 0, void 0, function () {
    var sse, chunks, _a, _b, _c, chunk, e_45_1;
    var _d, e_45, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                sse = [
                    {
                        type: "content_block_start",
                        index: 0,
                        content_block: { type: "thinking", thinking: "plan A" },
                    },
                    {
                        type: "content_block_delta",
                        index: 0,
                        delta: { type: "signature_delta", signature: "sig-A" },
                    },
                    {
                        type: "content_block_start",
                        index: 1,
                        content_block: { type: "thinking", thinking: "plan B" },
                    },
                    {
                        type: "content_block_delta",
                        index: 1,
                        delta: { type: "signature_delta", signature: "sig-B" },
                    },
                    { type: "message_delta", delta: { stop_reason: "end_turn" } },
                ]
                    .map(function (event) { return "data: ".concat(JSON.stringify(event), "\n\n"); })
                    .join("");
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.AnthropicProvider({
                    apiKey: "key",
                    model: "claude-thinking",
                    fetch: Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, new Response(sse, {
                                    headers: { "content-type": "text/event-stream" },
                                })];
                        });
                    }); }, { preconnect: fetch.preconnect }),
                }).stream({ messages: [{ role: "user", content: "go" }] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_45_1 = _g.sent();
                e_45 = { error: e_45_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_45) throw e_45.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    { type: "thinking", text: "plan A", blockIndex: 0 },
                    { type: "thinking", text: "", signature: "sig-A", blockIndex: 0 },
                    { type: "thinking", text: "plan B", blockIndex: 1 },
                    { type: "thinking", text: "", signature: "sig-B", blockIndex: 1 },
                    { type: "done", finishReason: "stop" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic replays multiple signed thinking blocks in order", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, _a, _b, _c, _chunk, e_46_1;
    var _d, e_46, _e, _f;
    var _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _h.label = 1;
            case 1:
                _h.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.AnthropicProvider({
                    apiKey: "key",
                    model: "claude-thinking",
                    fetch: fetchImpl,
                }).stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "",
                            reasoningBlocks: [
                                { text: "plan A", signature: "sig-A" },
                                { text: "plan B", signature: "sig-B" },
                                { signature: "redacted-data", redacted: true },
                            ],
                            toolCalls: [{ id: "toolu_1", name: "read_file", arguments: "{}" }],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "toolu_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _h.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _h.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _h.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_46_1 = _h.sent();
                e_46 = { error: e_46_1 };
                return [3 /*break*/, 12];
            case 7:
                _h.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _h.sent();
                _h.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_46) throw e_46.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)((_g = (body === null || body === void 0 ? void 0 : body.messages)[0]) === null || _g === void 0 ? void 0 : _g.content).toEqual([
                    { type: "thinking", thinking: "plan A", signature: "sig-A" },
                    { type: "thinking", thinking: "plan B", signature: "sig-B" },
                    { type: "redacted_thinking", data: "redacted-data" },
                    {
                        type: "tool_use",
                        id: "toolu_1",
                        name: "read_file",
                        input: {},
                    },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic replays content parts in provider order", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, _a, _b, _c, _chunk, e_47_1;
    var _d, e_47, _e, _f;
    var _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _h.label = 1;
            case 1:
                _h.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.AnthropicProvider({
                    apiKey: "key",
                    model: "claude-thinking",
                    fetch: fetchImpl,
                }).stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "fallback text",
                            contentParts: [
                                { type: "thinking", text: "plan", signature: "sig-A" },
                                { type: "text", text: "visible" },
                                {
                                    type: "tool_call",
                                    id: "toolu_1",
                                    name: "read_file",
                                    arguments: "{}",
                                    thoughtSignature: "call-sig",
                                },
                            ],
                            toolCalls: [
                                {
                                    id: "toolu_1",
                                    name: "read_file",
                                    arguments: "{}",
                                    thoughtSignature: "call-sig",
                                },
                            ],
                        },
                        {
                            role: "tool",
                            content: "ok",
                            toolCallID: "toolu_1",
                            toolName: "read_file",
                        },
                    ],
                }));
                _h.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _h.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _h.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_47_1 = _h.sent();
                e_47 = { error: e_47_1 };
                return [3 /*break*/, 12];
            case 7:
                _h.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _h.sent();
                _h.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_47) throw e_47.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)((_g = (body === null || body === void 0 ? void 0 : body.messages)[0]) === null || _g === void 0 ? void 0 : _g.content).toEqual([
                    { type: "thinking", thinking: "plan", signature: "sig-A" },
                    { type: "text", text: "visible" },
                    { type: "tool_use", id: "toolu_1", name: "read_file", input: {} },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Gemini parser exposes thought signatures on thinking and tool-call parts", function () { return __awaiter(void 0, void 0, void 0, function () {
    var sse, chunks, _a, _b, _c, chunk, e_48_1;
    var _d, e_48, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                sse = [
                    {
                        candidates: [
                            {
                                content: {
                                    parts: [
                                        { thought: true, text: "plan", thoughtSignature: "thought-sig" },
                                        {
                                            functionCall: { name: "read_file", args: {} },
                                            thoughtSignature: "call-sig",
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                    { candidates: [{ finishReason: "STOP" }] },
                ]
                    .map(function (event) { return "data: ".concat(JSON.stringify(event), "\n\n"); })
                    .join("");
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.GeminiProvider({
                    apiKey: "key",
                    model: "gemini-3-pro",
                    fetch: Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, new Response(sse, {
                                    headers: { "content-type": "text/event-stream" },
                                })];
                        });
                    }); }, { preconnect: fetch.preconnect }),
                }).stream({ messages: [{ role: "user", content: "go" }] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_48_1 = _g.sent();
                e_48 = { error: e_48_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_48) throw e_48.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    {
                        type: "thinking",
                        text: "plan",
                        signature: "thought-sig",
                        blockIndex: 0,
                    },
                    {
                        type: "tool_call",
                        calls: [
                            {
                                id: "gemini_0",
                                name: "read_file",
                                arguments: "{}",
                                thoughtSignature: "call-sig",
                            },
                        ],
                    },
                    { type: "done", finishReason: "stop" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Gemini lowers videos while Anthropic and OpenAI-compatible declare no video support", function () { return __awaiter(void 0, void 0, void 0, function () {
    var request, geminiBody, fetchFor, _a, _b, _c, _chunk, e_49_1, gemini, parts;
    var _d, e_49, _e, _f;
    var _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                request = {
                    messages: [
                        {
                            role: "user",
                            content: "watch",
                            videos: [
                                {
                                    mediaType: "video/mp4",
                                    dataURL: "data:video/mp4;base64,bXA0",
                                },
                            ],
                        },
                    ],
                };
                fetchFor = function (name) {
                    return Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            if (name === "gemini")
                                geminiBody = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                            return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                    headers: { "content-type": "text/event-stream" },
                                })];
                        });
                    }); }, { preconnect: fetch.preconnect });
                };
                (0, bun_test_1.expect)(new provider_1.OpenAICompatibleProvider({ apiKey: "key", model: "model" }).videoInput).toBe(false);
                (0, bun_test_1.expect)(new provider_1.AnthropicProvider({
                    apiKey: "key",
                    model: "model",
                    fetch: fetchFor("anthropic"),
                }).videoInput).toBe(false);
                _j.label = 1;
            case 1:
                _j.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(new provider_1.GeminiProvider({
                    apiKey: "key",
                    model: "model",
                    fetch: fetchFor("gemini"),
                }).stream(request));
                _j.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _j.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _j.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_49_1 = _j.sent();
                e_49 = { error: e_49_1 };
                return [3 /*break*/, 12];
            case 7:
                _j.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _j.sent();
                _j.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_49) throw e_49.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                gemini = geminiBody === null || geminiBody === void 0 ? void 0 : geminiBody.contents;
                parts = ((_h = (_g = gemini === null || gemini === void 0 ? void 0 : gemini[0]) === null || _g === void 0 ? void 0 : _g.parts) !== null && _h !== void 0 ? _h : []);
                (0, bun_test_1.expect)(parts.find(function (part) { return part.inlineData; })).toMatchObject({
                    inlineData: { mimeType: "video/mp4", data: "bXA0" },
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Gemini function responses retain the original function name", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, provider, _a, _b, _c, _chunk, e_50_1, contents;
    var _d, e_50, _e, _f;
    var _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.GeminiProvider({
                    apiKey: "key",
                    model: "model",
                    fetch: fetchImpl,
                });
                _k.label = 1;
            case 1:
                _k.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({
                    messages: [
                        {
                            role: "assistant",
                            content: "",
                            toolCalls: [{ id: "call_1", name: "workspace_read", arguments: "{}" }],
                        },
                        {
                            role: "tool",
                            toolCallID: "call_1",
                            toolName: "workspace_read",
                            content: "result",
                        },
                    ],
                }));
                _k.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _k.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _k.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_50_1 = _k.sent();
                e_50 = { error: e_50_1 };
                return [3 /*break*/, 12];
            case 7:
                _k.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _k.sent();
                _k.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_50) throw e_50.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                contents = body === null || body === void 0 ? void 0 : body.contents;
                (0, bun_test_1.expect)((_j = (_h = (_g = contents[1]) === null || _g === void 0 ? void 0 : _g.parts[0]) === null || _h === void 0 ? void 0 : _h.functionResponse) === null || _j === void 0 ? void 0 : _j.name).toBe("workspace_read");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("provider stream idle timeout cancels a stalled SSE reader with typed timeout", function () { return __awaiter(void 0, void 0, void 0, function () {
    var cancelled, reader;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                cancelled = false;
                reader = {
                    read: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, new Promise(function () { return undefined; })];
                            case 1: return [2 /*return*/, _a.sent()];
                        }
                    }); }); },
                    cancel: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            cancelled = true;
                            return [2 /*return*/];
                        });
                    }); },
                };
                return [4 /*yield*/, (0, bun_test_1.expect)((0, provider_1.readWithIdleTimeout)(reader, 5)).rejects.toMatchObject({
                        kind: "timeout",
                        message: bun_test_1.expect.stringContaining("stream idle timeout"),
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(cancelled).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible catalog discovery keeps credentials out of URLs and feeds context resolution", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requested, authorization, fetchImpl, provider, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                requested = "";
                authorization = "";
                fetchImpl = Object.assign(function (input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a;
                    return __generator(this, function (_b) {
                        requested = String(input);
                        authorization = (_a = new Headers(init === null || init === void 0 ? void 0 : init.headers).get("authorization")) !== null && _a !== void 0 ? _a : "";
                        return [2 /*return*/, Response.json({
                                data: [{ id: "catalog-model", context_window: 123456 }],
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.OpenAICompatibleProvider({
                    apiKey: "catalog-secret",
                    model: "catalog-model",
                    baseURL: "https://gateway.example/v1",
                    fetch: fetchImpl,
                });
                _a = bun_test_1.expect;
                return [4 /*yield*/, provider.listModels()];
            case 1:
                _a.apply(void 0, [_c.sent()]).toEqual([
                    { id: "catalog-model", contextWindow: 123456, inputTokenLimit: undefined },
                ]);
                (0, bun_test_1.expect)(requested).toBe("https://gateway.example/v1/models");
                (0, bun_test_1.expect)(requested).not.toContain("catalog-secret");
                (0, bun_test_1.expect)(authorization).toBe("Bearer catalog-secret");
                _b = bun_test_1.expect;
                return [4 /*yield*/, new modelmeta_1.ContextWindowResolver().resolve({
                        provider: provider.provider,
                        model: provider.model,
                        providerAdapter: provider,
                    })];
            case 2:
                _b.apply(void 0, [(_c.sent()).tokens]).toBe(123456);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("durable tool result context preserves its tool_call_id for the next turn", function () {
    var messages = (0, provider_1.contextEntriesToProviderMessages)([
        {
            id: "call_1",
            role: "tool_call",
            content: 'read_file {"path":"hello.txt"}',
            pairID: "provider_call_1",
        },
        {
            id: "result_1",
            role: "tool_result",
            content: "hello",
            pairID: "provider_call_1",
        },
    ]);
    (0, bun_test_1.expect)(messages).toEqual([
        {
            role: "assistant",
            content: "",
            toolCalls: [
                {
                    id: "provider_call_1",
                    name: "read_file",
                    arguments: '{"path":"hello.txt"}',
                },
            ],
        },
        { role: "tool", toolCallID: "provider_call_1", content: "hello" },
    ]);
});
(0, bun_test_1.test)("durable context restores reasoning and tool thought signatures", function () {
    var messages = (0, provider_1.contextEntriesToProviderMessages)([
        {
            id: "call_1",
            role: "tool_call",
            content: 'read_file {"path":"hello.txt"}',
            pairID: "provider_call_1",
            reasoningContent: "need to inspect",
            reasoningField: "reasoning_content",
            thoughtSignature: "tool-sig",
        },
        {
            id: "result_1",
            role: "tool_result",
            content: "hello",
            pairID: "provider_call_1",
        },
    ]);
    (0, bun_test_1.expect)(messages[0]).toMatchObject({
        role: "assistant",
        reasoningContent: "need to inspect",
        reasoningField: "reasoning_content",
        toolCalls: [
            {
                id: "provider_call_1",
                name: "read_file",
                arguments: '{"path":"hello.txt"}',
                thoughtSignature: "tool-sig",
            },
        ],
    });
});
(0, bun_test_1.test)("durable parallel tool calls are grouped before all tool results", function () {
    var messages = (0, provider_1.contextEntriesToProviderMessages)([
        {
            id: "call_1",
            role: "tool_call",
            content: 'read_file {"path":"a.txt"}',
            pairID: "provider_call_1",
        },
        {
            id: "call_2",
            role: "tool_call",
            content: 'read_file {"path":"b.txt"}',
            pairID: "provider_call_2",
        },
        {
            id: "result_1",
            role: "tool_result",
            content: "a",
            pairID: "provider_call_1",
        },
        {
            id: "result_2",
            role: "tool_result",
            content: "b",
            pairID: "provider_call_2",
        },
    ]);
    (0, bun_test_1.expect)(messages).toEqual([
        {
            role: "assistant",
            content: "",
            toolCalls: [
                {
                    id: "provider_call_1",
                    name: "read_file",
                    arguments: '{"path":"a.txt"}',
                },
                {
                    id: "provider_call_2",
                    name: "read_file",
                    arguments: '{"path":"b.txt"}',
                },
            ],
        },
        { role: "tool", toolCallID: "provider_call_1", content: "a" },
        { role: "tool", toolCallID: "provider_call_2", content: "b" },
    ]);
});
(0, bun_test_1.test)("durable assistant text stays on the tool-call message", function () {
    (0, bun_test_1.expect)((0, provider_1.contextEntriesToProviderMessages)([
        { id: "assistant", role: "assistant", content: "I will inspect it." },
        {
            id: "call",
            role: "tool_call",
            content: 'read_file {"path":"a.txt"}',
            pairID: "provider_call",
        },
        {
            id: "result",
            role: "tool_result",
            content: "a",
            pairID: "provider_call",
        },
    ])).toEqual([
        {
            role: "assistant",
            content: "I will inspect it.",
            toolCalls: [
                {
                    id: "provider_call",
                    name: "read_file",
                    arguments: '{"path":"a.txt"}',
                },
            ],
        },
        { role: "tool", toolCallID: "provider_call", content: "a" },
    ]);
});
(0, bun_test_1.test)("durable context omits interrupted tool calls without results", function () {
    (0, bun_test_1.expect)((0, provider_1.contextEntriesToProviderMessages)([
        {
            id: "call_orphan",
            role: "tool_call",
            content: 'read_file {"path":"missing.txt"}',
            pairID: "provider_call_orphan",
        },
        { id: "user", role: "user", content: "continue" },
    ])).toEqual([{ role: "user", content: "continue" }]);
});
(0, bun_test_1.test)("Anthropic provider streams text usage and tool calls", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, provider, chunks, _a, _b, _c, chunk, e_51_1, anthropicTools;
    var _d, e_51, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response([
                                'data: {"type":"content_block_start","content_block":{"type":"tool_use","id":"tool_1","name":"read_file"}}',
                                "",
                                'data: {"type":"input_json_delta","delta":{"partial_json":"{\\\"path\\\":\\\"a.txt\\\"}"}}',
                                "",
                                'data: {"type":"content_block_delta","delta":{"text":"hello"}}',
                                "",
                                'data: {"type":"message_delta","usage":{"input_tokens":5,"output_tokens":7}}',
                                "",
                            ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.AnthropicProvider({
                    apiKey: "test-key",
                    model: "claude-test",
                    fetch: fetchImpl,
                    // The tool breakpoint is a declared extension; this test opts in.
                    capabilities: { supportsCacheControlOnTools: true },
                });
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({
                    messages: [{ role: "user", content: "hi" }],
                    tools: [{ name: "read_file", description: "read", parameters: {} }],
                }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_51_1 = _g.sent();
                e_51 = { error: e_51_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_51) throw e_51.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                anthropicTools = body === null || body === void 0 ? void 0 : body["tools"];
                (0, bun_test_1.expect)(anthropicTools).toHaveLength(1);
                // A single tool is the last tool, so it carries the prefix breakpoint.
                (0, bun_test_1.expect)(anthropicTools[0].cache_control).toEqual({ type: "ephemeral" });
                (0, bun_test_1.expect)(chunks).toEqual(bun_test_1.expect.arrayContaining([
                    { type: "content", text: "hello" },
                    { type: "usage", inputTokens: 5, outputTokens: 7 },
                    {
                        type: "tool_call",
                        calls: [
                            { id: "tool_1", name: "read_file", arguments: '{"path":"a.txt"}' },
                        ],
                    },
                ]));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic provider streams thinking variants without polluting tool JSON at fragmented CRLF EOF", function () { return __awaiter(void 0, void 0, void 0, function () {
    var encoder, events, body, fetchImpl, provider, chunks, _a, _b, _c, chunk, e_52_1;
    var _d, e_52, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                encoder = new TextEncoder();
                events = [
                    'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"plan"}}',
                    'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":" more","partial_json":"{\\"ignored\\":true}"}}',
                    'data: {"type":"content_block_delta","index":0,"delta":{"reasoning_content":" compat"}}',
                    'data: {"choices":[{"delta":{"reasoning_content":" gateway","content":" choice text"}}]}',
                    'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tool_1","name":"read_file"}}',
                    'data: {"type":"content_block_start","index":2,"content_block":{"type":"text"}}',
                    'data: {"type":"content_block_delta","index":2,"delta":{"text":"hello"}}',
                    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"input_tokens":5,"output_tokens":7}}',
                    'data: {"type":"input_json_delta","index":1,"delta":{"partial_json":"{\\"path\\":\\"a.txt\\"}"}}',
                ].join("\r\n\r\n");
                body = new ReadableStream({
                    start: function (controller) {
                        for (var index = 0; index < events.length; index += 17)
                            controller.enqueue(encoder.encode(events.slice(index, index + 17)));
                        controller.close();
                    },
                });
                fetchImpl = Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        return [2 /*return*/, new Response(body, {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.AnthropicProvider({
                    apiKey: "test-key",
                    model: "claude-test",
                    maxTokens: 4096,
                    fetch: fetchImpl,
                });
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_52_1 = _g.sent();
                e_52 = { error: e_52_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_52) throw e_52.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(chunks).toEqual([
                    { type: "thinking", text: "plan", blockIndex: 0 },
                    { type: "thinking", text: " more", blockIndex: 0 },
                    { type: "thinking", text: " compat", blockIndex: 0 },
                    { type: "thinking", text: " gateway", blockIndex: 0 },
                    { type: "content", text: " choice text" },
                    { type: "content", text: "hello" },
                    { type: "usage", inputTokens: 5, outputTokens: 7 },
                    {
                        type: "tool_call",
                        calls: [
                            { id: "tool_1", name: "read_file", arguments: '{"path":"a.txt"}' },
                        ],
                    },
                    { type: "done", finishReason: "tool_calls" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic thinking request is opt-in, validates its default budget, and honors an explicit budget", function () { return __awaiter(void 0, void 0, void 0, function () {
    var bodies, fetchImpl, _i, _a, options, provider, _b, _c, _d, _chunk, e_53_1;
    var _e, e_53, _f, _g;
    var _h, _j, _k;
    return __generator(this, function (_l) {
        switch (_l.label) {
            case 0:
                bodies = [];
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        bodies.push(JSON.parse(String(init === null || init === void 0 ? void 0 : init.body)));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _i = 0, _a = [
                    { thinkingEnabled: false },
                    { thinkingEnabled: true },
                    { thinkingEnabled: true, thinkingBudgetTokens: 2048 },
                ];
                _l.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 14];
                options = _a[_i];
                provider = new provider_1.AnthropicProvider(__assign({ apiKey: "test-key", model: "claude-test", maxTokens: 4096, temperature: 0.2, fetch: fetchImpl }, options));
                _l.label = 2;
            case 2:
                _l.trys.push([2, 7, 8, 13]);
                _b = true, _c = (e_53 = void 0, __asyncValues(provider.stream({ messages: [] })));
                _l.label = 3;
            case 3: return [4 /*yield*/, _c.next()];
            case 4:
                if (!(_d = _l.sent(), _e = _d.done, !_e)) return [3 /*break*/, 6];
                _g = _d.value;
                _b = false;
                _chunk = _g;
                _l.label = 5;
            case 5:
                _b = true;
                return [3 /*break*/, 3];
            case 6: return [3 /*break*/, 13];
            case 7:
                e_53_1 = _l.sent();
                e_53 = { error: e_53_1 };
                return [3 /*break*/, 13];
            case 8:
                _l.trys.push([8, , 11, 12]);
                if (!(!_b && !_e && (_f = _c.return))) return [3 /*break*/, 10];
                return [4 /*yield*/, _f.call(_c)];
            case 9:
                _l.sent();
                _l.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                if (e_53) throw e_53.error;
                return [7 /*endfinally*/];
            case 12: return [7 /*endfinally*/];
            case 13:
                _i++;
                return [3 /*break*/, 1];
            case 14:
                (0, bun_test_1.expect)(bodies[0]).not.toHaveProperty("thinking");
                (0, bun_test_1.expect)((_h = bodies[0]) === null || _h === void 0 ? void 0 : _h.temperature).toBe(0.2);
                (0, bun_test_1.expect)((_j = bodies[1]) === null || _j === void 0 ? void 0 : _j.thinking).toEqual({
                    type: "enabled",
                    budget_tokens: 1024,
                });
                (0, bun_test_1.expect)((_k = bodies[2]) === null || _k === void 0 ? void 0 : _k.thinking).toEqual({
                    type: "enabled",
                    budget_tokens: 2048,
                });
                (0, bun_test_1.expect)(bodies[1]).not.toHaveProperty("temperature");
                (0, bun_test_1.expect)(bodies[2]).not.toHaveProperty("temperature");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic thinking rejects invalid budgets before fetch", function () { return __awaiter(void 0, void 0, void 0, function () {
    var fetchCalls, fetchImpl, _loop_1, _i, _a, options;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                fetchCalls = 0;
                fetchImpl = Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        fetchCalls += 1;
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _loop_1 = function (options) {
                    var provider;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                provider = new provider_1.AnthropicProvider(__assign({ apiKey: "test-key", model: "claude-test", thinkingEnabled: true, fetch: fetchImpl }, options));
                                return [4 /*yield*/, (0, bun_test_1.expect)((function () { return __awaiter(void 0, void 0, void 0, function () {
                                        var _a, _b, _c, _chunk, e_54_1;
                                        var _d, e_54, _e, _f;
                                        return __generator(this, function (_g) {
                                            switch (_g.label) {
                                                case 0:
                                                    _g.trys.push([0, 5, 6, 11]);
                                                    _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                                                    _g.label = 1;
                                                case 1: return [4 /*yield*/, _b.next()];
                                                case 2:
                                                    if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 4];
                                                    _f = _c.value;
                                                    _a = false;
                                                    _chunk = _f;
                                                    _g.label = 3;
                                                case 3:
                                                    _a = true;
                                                    return [3 /*break*/, 1];
                                                case 4: return [3 /*break*/, 11];
                                                case 5:
                                                    e_54_1 = _g.sent();
                                                    e_54 = { error: e_54_1 };
                                                    return [3 /*break*/, 11];
                                                case 6:
                                                    _g.trys.push([6, , 9, 10]);
                                                    if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 8];
                                                    return [4 /*yield*/, _e.call(_b)];
                                                case 7:
                                                    _g.sent();
                                                    _g.label = 8;
                                                case 8: return [3 /*break*/, 10];
                                                case 9:
                                                    if (e_54) throw e_54.error;
                                                    return [7 /*endfinally*/];
                                                case 10: return [7 /*endfinally*/];
                                                case 11: return [2 /*return*/];
                                            }
                                        });
                                    }); })()).rejects.toThrow("Anthropic thinking requires an integer budget_tokens")];
                            case 1:
                                _c.sent();
                                return [2 /*return*/];
                        }
                    });
                };
                _i = 0, _a = [
                    { maxTokens: 1024 },
                    { maxTokens: 4096, thinkingBudgetTokens: 1023 },
                    { maxTokens: 4096, thinkingBudgetTokens: 4096 },
                ];
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                options = _a[_i];
                return [5 /*yield**/, _loop_1(options)];
            case 2:
                _b.sent();
                _b.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4:
                (0, bun_test_1.expect)(fetchCalls).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic reasoning effort maps to thinking budgets and clamps to max_tokens", function () { return __awaiter(void 0, void 0, void 0, function () {
    var bodies, fetchImpl, _i, _a, reasoningEffort, provider, _b, _c, _d, _chunk, e_55_1, budgets, clampedProvider, _e, _f, _g, _chunk, e_56_1;
    var _h, e_55, _j, _k, _l, e_56, _m, _o;
    var _p;
    return __generator(this, function (_q) {
        switch (_q.label) {
            case 0:
                bodies = [];
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        bodies.push(JSON.parse(String(init === null || init === void 0 ? void 0 : init.body)));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _i = 0, _a = ["minimal", "low", "medium", "high", "xhigh"];
                _q.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 14];
                reasoningEffort = _a[_i];
                provider = new provider_1.AnthropicProvider({
                    apiKey: "test-key",
                    model: "claude-test",
                    maxTokens: 32768,
                    thinkingEnabled: true,
                    reasoningEffort: reasoningEffort,
                    fetch: fetchImpl,
                });
                _q.label = 2;
            case 2:
                _q.trys.push([2, 7, 8, 13]);
                _b = true, _c = (e_55 = void 0, __asyncValues(provider.stream({ messages: [] })));
                _q.label = 3;
            case 3: return [4 /*yield*/, _c.next()];
            case 4:
                if (!(_d = _q.sent(), _h = _d.done, !_h)) return [3 /*break*/, 6];
                _k = _d.value;
                _b = false;
                _chunk = _k;
                _q.label = 5;
            case 5:
                _b = true;
                return [3 /*break*/, 3];
            case 6: return [3 /*break*/, 13];
            case 7:
                e_55_1 = _q.sent();
                e_55 = { error: e_55_1 };
                return [3 /*break*/, 13];
            case 8:
                _q.trys.push([8, , 11, 12]);
                if (!(!_b && !_h && (_j = _c.return))) return [3 /*break*/, 10];
                return [4 /*yield*/, _j.call(_c)];
            case 9:
                _q.sent();
                _q.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                if (e_55) throw e_55.error;
                return [7 /*endfinally*/];
            case 12: return [7 /*endfinally*/];
            case 13:
                _i++;
                return [3 /*break*/, 1];
            case 14:
                budgets = bodies.map(function (body) { return body.thinking.budget_tokens; });
                (0, bun_test_1.expect)(budgets).toEqual([1024, 2048, 4096, 8192, 16384]);
                clampedProvider = new provider_1.AnthropicProvider({
                    apiKey: "test-key",
                    model: "claude-test",
                    maxTokens: 5000,
                    thinkingEnabled: true,
                    reasoningEffort: "high",
                    fetch: fetchImpl,
                });
                _q.label = 15;
            case 15:
                _q.trys.push([15, 20, 21, 26]);
                _e = true, _f = __asyncValues(clampedProvider.stream({ messages: [] }));
                _q.label = 16;
            case 16: return [4 /*yield*/, _f.next()];
            case 17:
                if (!(_g = _q.sent(), _l = _g.done, !_l)) return [3 /*break*/, 19];
                _o = _g.value;
                _e = false;
                _chunk = _o;
                _q.label = 18;
            case 18:
                _e = true;
                return [3 /*break*/, 16];
            case 19: return [3 /*break*/, 26];
            case 20:
                e_56_1 = _q.sent();
                e_56 = { error: e_56_1 };
                return [3 /*break*/, 26];
            case 21:
                _q.trys.push([21, , 24, 25]);
                if (!(!_e && !_l && (_m = _f.return))) return [3 /*break*/, 23];
                return [4 /*yield*/, _m.call(_f)];
            case 22:
                _q.sent();
                _q.label = 23;
            case 23: return [3 /*break*/, 25];
            case 24:
                if (e_56) throw e_56.error;
                return [7 /*endfinally*/];
            case 25: return [7 /*endfinally*/];
            case 26:
                (0, bun_test_1.expect)((_p = bodies.at(-1)) === null || _p === void 0 ? void 0 : _p.thinking).toEqual({
                    type: "enabled",
                    budget_tokens: 4999,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic explicit thinking budget overrides reasoning effort", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, fetchImpl, provider, _a, _b, _c, _chunk, e_57_1;
    var _d, e_57, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.AnthropicProvider({
                    apiKey: "test-key",
                    model: "claude-test",
                    maxTokens: 32768,
                    thinkingEnabled: true,
                    reasoningEffort: "xhigh",
                    thinkingBudgetTokens: 2048,
                    fetch: fetchImpl,
                });
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_57_1 = _g.sent();
                e_57 = { error: e_57_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_57) throw e_57.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(body === null || body === void 0 ? void 0 : body.thinking).toEqual({ type: "enabled", budget_tokens: 2048 });
                (0, bun_test_1.expect)(body).not.toHaveProperty("reasoning_effort");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("providerForModel forwards Anthropic thinking settings", function () { return __awaiter(void 0, void 0, void 0, function () {
    var config, body, originalFetch, provider, _a, _b, _c, _chunk, e_58_1;
    var _d, e_58, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                config = (0, config_1.defaultConfigV3)();
                config.providers.internal_gateway = {
                    name: "Internal Gateway",
                    driver: "anthropic-compatible",
                    enabled: true,
                    connection: { apiKey: "test-key" },
                    requestDefaults: {
                        stream: true,
                        headers: {},
                        options: { reasoningEffort: "high", thinkingBudgetTokens: 2048 },
                    },
                };
                config.catalog.providers.internal_gateway = {
                    models: {
                        "thinking-model": {
                            name: "thinking-model",
                            status: "stable",
                            source: "manual",
                            capabilities: {
                                toolCall: false,
                                reasoning: true,
                                thinking: true,
                                imageInput: false,
                                videoInput: false,
                            },
                            limits: { contextWindow: "auto", maxOutputTokens: 4096 },
                        },
                    },
                };
                config.modelOverrides["internal_gateway/thinking-model"] = {
                    enabled: true,
                    name: "Thinking",
                    requestDefaults: { temperature: null, topP: null, thinkingEnabled: true },
                    requestOptions: {},
                    headers: {},
                };
                originalFetch = globalThis.fetch;
                globalThis.fetch = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        return [2 /*return*/, new Response("data: [DONE]\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                _g.label = 1;
            case 1:
                _g.trys.push([1, , 14, 15]);
                provider = (0, provider_1.providerForModel)(config, "internal_gateway/thinking-model");
                (0, bun_test_1.expect)(provider).toBeInstanceOf(provider_1.AnthropicProvider);
                _g.label = 2;
            case 2:
                _g.trys.push([2, 7, 8, 13]);
                _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                _g.label = 3;
            case 3: return [4 /*yield*/, _b.next()];
            case 4:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 6];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _g.label = 5;
            case 5:
                _a = true;
                return [3 /*break*/, 3];
            case 6: return [3 /*break*/, 13];
            case 7:
                e_58_1 = _g.sent();
                e_58 = { error: e_58_1 };
                return [3 /*break*/, 13];
            case 8:
                _g.trys.push([8, , 11, 12]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 10];
                return [4 /*yield*/, _e.call(_b)];
            case 9:
                _g.sent();
                _g.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                if (e_58) throw e_58.error;
                return [7 /*endfinally*/];
            case 12: return [7 /*endfinally*/];
            case 13: return [3 /*break*/, 15];
            case 14:
                globalThis.fetch = originalFetch;
                return [7 /*endfinally*/];
            case 15:
                (0, bun_test_1.expect)(body === null || body === void 0 ? void 0 : body.thinking).toEqual({ type: "enabled", budget_tokens: 2048 });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Gemini provider maps SSE content function calls and usage without placing its key in the URL", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requested, headers, fetchImpl, provider, chunks, _a, _b, _c, chunk, e_59_1;
    var _d, e_59, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                fetchImpl = Object.assign(function (input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        requested = String(input);
                        headers = new Headers(init === null || init === void 0 ? void 0 : init.headers);
                        return [2 /*return*/, new Response([
                                'data: {"candidates":[{"content":{"parts":[{"text":"hi"},{"functionCall":{"name":"glob","args":{"pattern":"**/*.ts"}}}]}}],"usageMetadata":{"promptTokenCount":2,"candidatesTokenCount":3}}',
                                "",
                            ].join("\n"), { headers: { "content-type": "text/event-stream" } })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.GeminiProvider({
                    apiKey: "test-key",
                    model: "gemini-test",
                    fetch: fetchImpl,
                });
                chunks = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({
                    messages: [{ role: "user", content: "hi" }],
                }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                chunks.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_59_1 = _g.sent();
                e_59 = { error: e_59_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_59) throw e_59.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(requested).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:streamGenerateContent?alt=sse");
                (0, bun_test_1.expect)(headers === null || headers === void 0 ? void 0 : headers.get("x-goog-api-key")).toBe("test-key");
                (0, bun_test_1.expect)(chunks).toEqual(bun_test_1.expect.arrayContaining([
                    { type: "content", text: "hi" },
                    {
                        type: "tool_call",
                        calls: [
                            { id: "gemini_0", name: "glob", arguments: '{"pattern":"**/*.ts"}' },
                        ],
                    },
                    { type: "usage", inputTokens: 2, outputTokens: 3 },
                ]));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("uniqueProviderToolCallIds remaps duplicates without stealing reserved ids", function () {
    var _a;
    var normalized = (0, provider_1.uniqueProviderToolCallIds)([
        { id: "call_1", name: "read_file", arguments: "{}" },
        { id: "call_1", name: "glob", arguments: "{}" },
        { id: "call_1#1", name: "grep", arguments: "{}" },
    ]);
    (0, bun_test_1.expect)(normalized.duplicates).toEqual(["call_1"]);
    (0, bun_test_1.expect)(normalized.calls.map(function (call) { return call.id; })).toEqual([
        "call_1",
        "call_1#2",
        "call_1#1",
    ]);
    (0, bun_test_1.expect)(normalized.calls.map(function (call) { return call.name; })).toEqual([
        "read_file",
        "glob",
        "grep",
    ]);
    var crossStep = (0, provider_1.uniqueProviderToolCallIds)([{ id: "call_1", name: "read_file", arguments: "{}" }], ["call_1"]);
    (0, bun_test_1.expect)(crossStep.duplicates).toEqual(["call_1"]);
    (0, bun_test_1.expect)((_a = crossStep.calls[0]) === null || _a === void 0 ? void 0 : _a.id).toBe("call_1#1");
});
(0, bun_test_1.test)("contextEntriesToProviderMessages collapses duplicate ledger call pairs", function () {
    var _a;
    var messages = (0, provider_1.contextEntriesToProviderMessages)([
        {
            id: "call_a",
            role: "tool_call",
            content: 'read_file {"path":"a"}',
            pairID: "call_x",
        },
        {
            id: "result_a",
            role: "tool_result",
            content: "a",
            pairID: "call_x",
        },
        {
            id: "call_b",
            role: "tool_call",
            content: 'read_file {"path":"a"}',
            pairID: "call_x",
        },
        {
            id: "result_b",
            role: "tool_result",
            content: "a again",
            pairID: "call_x",
        },
    ]);
    (0, bun_test_1.expect)(messages.flatMap(function (message) { var _a; return (_a = message.toolCalls) !== null && _a !== void 0 ? _a : []; })).toHaveLength(1);
    (0, bun_test_1.expect)(messages.filter(function (message) { return message.role === "tool"; })).toHaveLength(1);
    (0, bun_test_1.expect)((_a = messages.flatMap(function (message) { var _a; return (_a = message.toolCalls) !== null && _a !== void 0 ? _a : []; })[0]) === null || _a === void 0 ? void 0 : _a.id).toBe("call_x");
});
(0, bun_test_1.test)("Anthropic requests emit cache_control breakpoints on the stable prefix (ADR E)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var bodies, provider, _a, _b, _c, _chunk, e_60_1, body, system, tools;
    var _d, e_60, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                bodies = [];
                provider = new provider_1.AnthropicProvider({
                    apiKey: "key",
                    model: "model",
                    maxTokens: 1024,
                    // The tool breakpoint is a declared extension, so this test opts in. The
                    // system-block breakpoint needs no declaration: it is native to the format.
                    capabilities: { supportsCacheControlOnTools: true },
                    fetch: Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            bodies.push(JSON.parse(String(init === null || init === void 0 ? void 0 : init.body)));
                            return [2 /*return*/, new Response("event: message_stop\ndata: {}\n\n", {
                                    headers: { "content-type": "text/event-stream" },
                                })];
                        });
                    }); }, { preconnect: fetch.preconnect }),
                });
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({
                    messages: [
                        { role: "system", content: "static persona" },
                        { role: "user", content: "hello" },
                    ],
                    tools: [
                        {
                            name: "read_file",
                            description: "read",
                            parameters: { type: "object", properties: {} },
                        },
                        {
                            name: "run_shell",
                            description: "run",
                            parameters: { type: "object", properties: {} },
                        },
                    ],
                }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_60_1 = _g.sent();
                e_60 = { error: e_60_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_60) throw e_60.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                body = bodies[0];
                system = body.system;
                (0, bun_test_1.expect)(system).toHaveLength(1);
                (0, bun_test_1.expect)(system[0].text).toBe("static persona");
                (0, bun_test_1.expect)(system[0].cache_control).toEqual({ type: "ephemeral" });
                tools = body.tools;
                (0, bun_test_1.expect)(tools).toHaveLength(2);
                (0, bun_test_1.expect)(tools[0].cache_control).toBeUndefined();
                (0, bun_test_1.expect)(tools[1].cache_control).toEqual({ type: "ephemeral" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic usage chunks carry the cache metrics (ADR E)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var provider, usages, _a, _b, _c, chunk, e_61_1;
    var _d, e_61, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                provider = new provider_1.AnthropicProvider({
                    apiKey: "key",
                    model: "model",
                    maxTokens: 1024,
                    fetch: Object.assign(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, new Response("event: message_start\n" +
                                    'data: {"type":"message_start","message":{"usage":{"input_tokens":100,"output_tokens":0,"cache_creation_input_tokens":80,"cache_read_input_tokens":20}}}\n\n' +
                                    "event: message_stop\n\n", { headers: { "content-type": "text/event-stream" } })];
                        });
                    }); }, { preconnect: fetch.preconnect }),
                });
                usages = [];
                _g.label = 1;
            case 1:
                _g.trys.push([1, 6, 7, 12]);
                _a = true, _b = __asyncValues(provider.stream({
                    messages: [{ role: "user", content: "hi" }],
                }));
                _g.label = 2;
            case 2: return [4 /*yield*/, _b.next()];
            case 3:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                _f = _c.value;
                _a = false;
                chunk = _f;
                if (chunk.type === "usage")
                    usages.push(chunk);
                _g.label = 4;
            case 4:
                _a = true;
                return [3 /*break*/, 2];
            case 5: return [3 /*break*/, 12];
            case 6:
                e_61_1 = _g.sent();
                e_61 = { error: e_61_1 };
                return [3 /*break*/, 12];
            case 7:
                _g.trys.push([7, , 10, 11]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                return [4 /*yield*/, _e.call(_b)];
            case 8:
                _g.sent();
                _g.label = 9;
            case 9: return [3 /*break*/, 11];
            case 10:
                if (e_61) throw e_61.error;
                return [7 /*endfinally*/];
            case 11: return [7 /*endfinally*/];
            case 12:
                (0, bun_test_1.expect)(usages).toHaveLength(1);
                (0, bun_test_1.expect)(usages[0]).toMatchObject({
                    inputTokens: 100,
                    cacheCreationInputTokens: 80,
                    cacheReadInputTokens: 20,
                });
                return [2 /*return*/];
        }
    });
}); });
/** Drive the OpenAI-compatible adapter over one SSE body and collect its chunks. */
function collectOpenAIChunks(sse) {
    return __awaiter(this, void 0, void 0, function () {
        var fetchImpl, provider, chunks, _a, _b, _c, chunk, e_62_1;
        var _this = this;
        var _d, e_62, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    fetchImpl = Object.assign(function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, new Response(sse, {
                                    headers: { "content-type": "text/event-stream" },
                                })];
                        });
                    }); }, { preconnect: fetch.preconnect });
                    provider = new provider_1.OpenAICompatibleProvider({
                        apiKey: "test-key",
                        model: "test-model",
                        fetch: fetchImpl,
                    });
                    chunks = [];
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 6, 7, 12]);
                    _a = true, _b = __asyncValues(provider.stream({ messages: [] }));
                    _g.label = 2;
                case 2: return [4 /*yield*/, _b.next()];
                case 3:
                    if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                    _f = _c.value;
                    _a = false;
                    chunk = _f;
                    chunks.push(chunk);
                    _g.label = 4;
                case 4:
                    _a = true;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 12];
                case 6:
                    e_62_1 = _g.sent();
                    e_62 = { error: e_62_1 };
                    return [3 /*break*/, 12];
                case 7:
                    _g.trys.push([7, , 10, 11]);
                    if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                    return [4 /*yield*/, _e.call(_b)];
                case 8:
                    _g.sent();
                    _g.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (e_62) throw e_62.error;
                    return [7 /*endfinally*/];
                case 11: return [7 /*endfinally*/];
                case 12: return [2 /*return*/, chunks];
            }
        });
    });
}
(0, bun_test_1.test)("OpenAI-compatible reports prefix-cache reads from prompt_tokens_details", function () { return __awaiter(void 0, void 0, void 0, function () {
    var chunks, usage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, collectOpenAIChunks([
                    'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":12000,"completion_tokens":4,"prompt_tokens_details":{"cached_tokens":11000}}}',
                    "",
                    "data: [DONE]",
                    "",
                ].join("\n"))];
            case 1:
                chunks = _a.sent();
                usage = chunks.find(function (chunk) { return chunk.type === "usage"; });
                (0, bun_test_1.expect)(usage).toEqual({
                    type: "usage",
                    inputTokens: 12000,
                    outputTokens: 4,
                    cacheReadInputTokens: 11000,
                });
                // OpenAI bills no cache write, so that field must stay absent rather than 0 —
                // a 0 would claim the endpoint reported a write it never measured.
                (0, bun_test_1.expect)(usage).not.toHaveProperty("cacheCreationInputTokens");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible omits the cache read when the endpoint reports none", function () { return __awaiter(void 0, void 0, void 0, function () {
    var chunks;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, collectOpenAIChunks([
                    'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":8,"completion_tokens":2}}',
                    "",
                    "data: [DONE]",
                    "",
                ].join("\n"))];
            case 1:
                chunks = _a.sent();
                (0, bun_test_1.expect)(chunks.find(function (chunk) { return chunk.type === "usage"; })).toEqual({
                    type: "usage",
                    inputTokens: 8,
                    outputTokens: 2,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible treats an explicit zero cached_tokens as a reported read", function () { return __awaiter(void 0, void 0, void 0, function () {
    var chunks;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, collectOpenAIChunks([
                    'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":900,"completion_tokens":2,"prompt_tokens_details":{"cached_tokens":0}}}',
                    "",
                    "data: [DONE]",
                    "",
                ].join("\n"))];
            case 1:
                chunks = _a.sent();
                (0, bun_test_1.expect)(chunks.find(function (chunk) { return chunk.type === "usage"; })).toEqual({
                    type: "usage",
                    inputTokens: 900,
                    outputTokens: 2,
                    cacheReadInputTokens: 0,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("OpenAI-compatible reads cache usage on the buffered path too", function () { return __awaiter(void 0, void 0, void 0, function () {
    var chunks, usage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, collectOpenAIChunks([
                    'data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"prompt_tokens":5000,"completion_tokens":3,"prompt_tokens_details":{"cached_tokens":5000}}}',
                    "",
                    "data: [DONE]",
                    "",
                ].join("\n"))];
            case 1:
                chunks = _a.sent();
                usage = chunks.find(function (chunk) { return chunk.type === "usage"; });
                (0, bun_test_1.expect)(usage).toMatchObject({ cacheReadInputTokens: 5000 });
                return [2 /*return*/];
        }
    });
}); });
/** Drive the Anthropic adapter and capture the request body and headers. */
function runAnthropic(input) {
    return __awaiter(this, void 0, void 0, function () {
        var sent, headers, fetchImpl, provider, _a, _b, _c, _chunk, e_63_1;
        var _this = this;
        var _d, e_63, _e, _f;
        var _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    sent = {};
                    headers = {};
                    fetchImpl = Object.assign(function (_url, init) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, _b;
                        return __generator(this, function (_c) {
                            sent = JSON.parse(String((_a = init === null || init === void 0 ? void 0 : init.body) !== null && _a !== void 0 ? _a : "{}"));
                            headers = Object.fromEntries(Object.entries(((_b = init === null || init === void 0 ? void 0 : init.headers) !== null && _b !== void 0 ? _b : {})));
                            return [2 /*return*/, new Response("", {
                                    status: 200,
                                    headers: { "content-type": "text/event-stream" },
                                })];
                        });
                    }); }, { preconnect: fetch.preconnect });
                    provider = new provider_1.AnthropicProvider(__assign(__assign(__assign({ apiKey: "test-key", model: "claude-test", fetch: fetchImpl }, (input.capabilities ? { capabilities: input.capabilities } : {})), (input.sessionID ? { sessionID: input.sessionID } : {})), (input.cacheRetention ? { cacheRetention: input.cacheRetention } : {})));
                    _h.label = 1;
                case 1:
                    _h.trys.push([1, 6, 7, 12]);
                    _a = true, _b = __asyncValues(provider.stream(__assign({ messages: (_g = input.messages) !== null && _g !== void 0 ? _g : [{ role: "user", content: "hi" }] }, (input.tools ? { tools: input.tools } : {}))));
                    _h.label = 2;
                case 2: return [4 /*yield*/, _b.next()];
                case 3:
                    if (!(_c = _h.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                    _f = _c.value;
                    _a = false;
                    _chunk = _f;
                    ;
                    _h.label = 4;
                case 4:
                    _a = true;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 12];
                case 6:
                    e_63_1 = _h.sent();
                    e_63 = { error: e_63_1 };
                    return [3 /*break*/, 12];
                case 7:
                    _h.trys.push([7, , 10, 11]);
                    if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                    return [4 /*yield*/, _e.call(_b)];
                case 8:
                    _h.sent();
                    _h.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (e_63) throw e_63.error;
                    return [7 /*endfinally*/];
                case 11: return [7 /*endfinally*/];
                case 12: return [2 /*return*/, { body: sent, headers: headers }];
            }
        });
    });
}
var ONE_TOOL = [
    { name: "read_file", description: "read", parameters: { type: "object" } },
];
(0, bun_test_1.test)("Anthropic omits tool cache_control until the endpoint declares it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var undeclared, declared;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runAnthropic({ tools: ONE_TOOL })];
            case 1:
                undeclared = _a.sent();
                (0, bun_test_1.expect)(undeclared.body.tools[0]).not.toHaveProperty("cache_control");
                return [4 /*yield*/, runAnthropic({
                        tools: ONE_TOOL,
                        capabilities: { supportsCacheControlOnTools: true },
                    })];
            case 2:
                declared = _a.sent();
                (0, bun_test_1.expect)(declared.body.tools[0].cache_control).toEqual({ type: "ephemeral" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic always marks the system block, which is native to the format", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, system;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runAnthropic({
                    messages: [
                        { role: "system", content: "be terse" },
                        { role: "user", content: "hi" },
                    ],
                })];
            case 1:
                body = (_a.sent()).body;
                system = body.system[0];
                (0, bun_test_1.expect)(system.cache_control).toEqual({ type: "ephemeral" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic sends no session affinity header until the endpoint declares it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var undeclared, declared, openrouter;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runAnthropic({ sessionID: "ses_abc" })];
            case 1:
                undeclared = _a.sent();
                (0, bun_test_1.expect)(undeclared.headers).not.toHaveProperty("x-session-affinity");
                (0, bun_test_1.expect)(undeclared.headers).not.toHaveProperty("x-session-id");
                return [4 /*yield*/, runAnthropic({
                        sessionID: "ses_abc",
                        capabilities: { sendSessionAffinityHeaders: true },
                    })];
            case 2:
                declared = _a.sent();
                (0, bun_test_1.expect)(declared.headers["x-session-affinity"]).toBe("ses_abc");
                return [4 /*yield*/, runAnthropic({
                        sessionID: "ses_abc",
                        capabilities: {
                            sendSessionAffinityHeaders: true,
                            sessionAffinityFormat: "openrouter",
                        },
                    })];
            case 3:
                openrouter = _a.sent();
                (0, bun_test_1.expect)(openrouter.headers["x-session-id"]).toBe("ses_abc");
                (0, bun_test_1.expect)(openrouter.headers).not.toHaveProperty("x-session-affinity");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic sends no affinity header without a session id", function () { return __awaiter(void 0, void 0, void 0, function () {
    var headers;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runAnthropic({
                    capabilities: { sendSessionAffinityHeaders: true },
                })];
            case 1:
                headers = (_a.sent()).headers;
                (0, bun_test_1.expect)(headers).not.toHaveProperty("x-session-affinity");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic sends ttl 1h only when retention and the capability agree", function () { return __awaiter(void 0, void 0, void 0, function () {
    var undeclared, declared;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runAnthropic({
                    messages: [
                        { role: "system", content: "s" },
                        { role: "user", content: "hi" },
                    ],
                    cacheRetention: "long",
                })];
            case 1:
                undeclared = _a.sent();
                // Long asked for, long not declared: degrades rather than sending a ttl the
                // deployment would reject.
                (0, bun_test_1.expect)(undeclared.body.system[0].cache_control).toEqual({ type: "ephemeral" });
                return [4 /*yield*/, runAnthropic({
                        messages: [
                            { role: "system", content: "s" },
                            { role: "user", content: "hi" },
                        ],
                        cacheRetention: "long",
                        capabilities: { supportsLongCacheRetention: true },
                    })];
            case 2:
                declared = _a.sent();
                (0, bun_test_1.expect)(declared.body.system[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic retention none omits the cache marker everywhere", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runAnthropic({
                    messages: [
                        { role: "system", content: "s" },
                        { role: "user", content: "hi" },
                    ],
                    tools: [
                        { name: "read_file", description: "r", parameters: { type: "object" } },
                    ],
                    cacheRetention: "none",
                    capabilities: { supportsCacheControlOnTools: true },
                })];
            case 1:
                body = (_a.sent()).body;
                (0, bun_test_1.expect)(body.system[0]).not.toHaveProperty("cache_control");
                (0, bun_test_1.expect)(body.tools[0]).not.toHaveProperty("cache_control");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic marks the last conversation message so the whole prefix is cached", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, messages;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runAnthropic({
                    messages: [
                        { role: "system", content: "s" },
                        { role: "user", content: "first" },
                        { role: "assistant", content: "ok" },
                        { role: "user", content: "second" },
                    ],
                })];
            case 1:
                body = (_a.sent()).body;
                messages = body.messages;
                (0, bun_test_1.expect)(messages).toHaveLength(3);
                // Only the last message carries the conversation breakpoint.
                (0, bun_test_1.expect)(messages[0].content[0]).not.toHaveProperty("cache_control");
                (0, bun_test_1.expect)(messages[1].content[0]).not.toHaveProperty("cache_control");
                (0, bun_test_1.expect)(messages[2].content[0].cache_control).toEqual({ type: "ephemeral" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic marks a trailing tool result, which is a user-role block", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, messages, last;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runAnthropic({
                    messages: [
                        { role: "user", content: "read it" },
                        {
                            role: "assistant",
                            content: "",
                            toolCalls: [{ id: "c1", name: "read_file", arguments: "{}" }],
                        },
                        {
                            role: "tool",
                            content: "file body",
                            toolCallID: "c1",
                            toolName: "read_file",
                        },
                    ],
                })];
            case 1:
                body = (_a.sent()).body;
                messages = body.messages;
                last = messages[messages.length - 1];
                (0, bun_test_1.expect)(last.role).toBe("user");
                (0, bun_test_1.expect)(last.content[0].type).toBe("tool_result");
                (0, bun_test_1.expect)(last.content[0].cache_control).toEqual({ type: "ephemeral" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic conversation breakpoint honours retention and its capability", function () { return __awaiter(void 0, void 0, void 0, function () {
    var none, longUndeclared, longDeclared;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runAnthropic({ cacheRetention: "none" })];
            case 1:
                none = _a.sent();
                (0, bun_test_1.expect)(none.body.messages[0].content[0]).not.toHaveProperty("cache_control");
                return [4 /*yield*/, runAnthropic({ cacheRetention: "long" })];
            case 2:
                longUndeclared = _a.sent();
                (0, bun_test_1.expect)(longUndeclared.body.messages[0].content[0].cache_control).toEqual({ type: "ephemeral" });
                return [4 /*yield*/, runAnthropic({
                        cacheRetention: "long",
                        capabilities: { supportsLongCacheRetention: true },
                    })];
            case 3:
                longDeclared = _a.sent();
                (0, bun_test_1.expect)(longDeclared.body.messages[0].content[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic converts a bare-string last message rather than skipping it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var body, messages;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, runAnthropic({
                    messages: [{ role: "user", content: "" }],
                })];
            case 1:
                body = (_a.sent()).body;
                messages = body.messages;
                (0, bun_test_1.expect)(Array.isArray(messages[0].content)).toBe(true);
                (0, bun_test_1.expect)(messages[0].content[0].cache_control).toEqual({ type: "ephemeral" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Anthropic cached prefix grows monotonically across turns", function () { return __awaiter(void 0, void 0, void 0, function () {
    var requests, fetchImpl, provider, turns, _i, turns_1, messages, _a, _b, _c, _chunk, e_64_1, key, index, previous, current, marked;
    var _d, e_64, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                requests = [];
                fetchImpl = Object.assign(function (_input, init) { return __awaiter(void 0, void 0, void 0, function () {
                    var body;
                    return __generator(this, function (_a) {
                        body = JSON.parse(String(init === null || init === void 0 ? void 0 : init.body));
                        requests.push(body.messages);
                        return [2 /*return*/, new Response("event: message_stop\ndata: {}\n\n", {
                                headers: { "content-type": "text/event-stream" },
                            })];
                    });
                }); }, { preconnect: fetch.preconnect });
                provider = new provider_1.AnthropicProvider({
                    apiKey: "k",
                    model: "m",
                    maxTokens: 64,
                    fetch: fetchImpl,
                });
                turns = [
                    [{ role: "user", content: "one" }],
                    [
                        { role: "user", content: "one" },
                        { role: "assistant", content: "reply one" },
                        { role: "user", content: "two" },
                    ],
                    [
                        { role: "user", content: "one" },
                        { role: "assistant", content: "reply one" },
                        { role: "user", content: "two" },
                        { role: "assistant", content: "reply two" },
                        { role: "user", content: "three" },
                    ],
                ];
                _i = 0, turns_1 = turns;
                _g.label = 1;
            case 1:
                if (!(_i < turns_1.length)) return [3 /*break*/, 14];
                messages = turns_1[_i];
                _g.label = 2;
            case 2:
                _g.trys.push([2, 7, 8, 13]);
                _a = true, _b = (e_64 = void 0, __asyncValues(provider.stream({ messages: messages })));
                _g.label = 3;
            case 3: return [4 /*yield*/, _b.next()];
            case 4:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 6];
                _f = _c.value;
                _a = false;
                _chunk = _f;
                _g.label = 5;
            case 5:
                _a = true;
                return [3 /*break*/, 3];
            case 6: return [3 /*break*/, 13];
            case 7:
                e_64_1 = _g.sent();
                e_64 = { error: e_64_1 };
                return [3 /*break*/, 13];
            case 8:
                _g.trys.push([8, , 11, 12]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 10];
                return [4 /*yield*/, _e.call(_b)];
            case 9:
                _g.sent();
                _g.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                if (e_64) throw e_64.error;
                return [7 /*endfinally*/];
            case 12: return [7 /*endfinally*/];
            case 13:
                _i++;
                return [3 /*break*/, 1];
            case 14:
                (0, bun_test_1.expect)(requests).toHaveLength(3);
                key = function (m) {
                    var copy = __assign({}, m);
                    if (Array.isArray(copy.content))
                        copy.content = copy.content.map(function (block) {
                            var _ignored = block.cache_control, rest = __rest(block, ["cache_control"]);
                            return rest;
                        });
                    return JSON.stringify(copy);
                };
                // Turn N's messages are a prefix of turn N+1's: nothing already sent changes.
                for (index = 1; index < requests.length; index += 1) {
                    previous = requests[index - 1].map(key);
                    current = requests[index].map(key);
                    (0, bun_test_1.expect)(current.length).toBeGreaterThan(previous.length);
                    (0, bun_test_1.expect)(current.slice(0, previous.length)).toEqual(previous);
                }
                marked = function (messages) {
                    return messages.filter(function (message) {
                        return Array.isArray(message.content)
                            ? message.content.some(function (block) { return block.cache_control !== undefined; })
                            : false;
                    }).length;
                };
                (0, bun_test_1.expect)(marked(requests[2])).toBe(1);
                (0, bun_test_1.expect)(marked(requests[2])).toBeLessThan(requests[2].length);
                return [2 /*return*/];
        }
    });
}); });
