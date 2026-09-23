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
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var echo = function (label) {
    if (label === void 0) { label = "echo"; }
    return ({
        name: "echo",
        description: "Echo one string",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
            additionalProperties: false,
        },
        execute: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, "".concat(label, ":").concat(input.text)];
                });
            });
        },
    });
};
var invocation = {
    sessionID: "ses_tool_invocation",
    agentID: "build",
    assistantMessageID: "msg_tool_invocation",
    toolCallID: "call_tool_invocation",
    name: "echo",
    arguments: { text: "hello" },
};
(0, bun_test_1.test)("materialized tools validate input and preserve invocation identity", function () { return __awaiter(void 0, void 0, void 0, function () {
    var materialized;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                materialized = (0, src_1.materializeTools)((0, src_1.createToolRegistry)([echo()]));
                (0, bun_test_1.expect)(materialized.definitions).toMatchObject([
                    { name: "echo", description: "Echo one string" },
                ]);
                return [4 /*yield*/, (0, bun_test_1.expect)(materialized.settle(invocation, { workspaceRoot: "/tmp" })).resolves.toEqual({
                        status: "succeeded",
                        output: "echo:hello",
                    })];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(materialized.settle(__assign(__assign({}, invocation), { arguments: { unexpected: true } }), { workspaceRoot: "/tmp" })).resolves.toMatchObject({
                        status: "failed",
                        error: bun_test_1.expect.stringContaining("Invalid tool input"),
                    })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("materialized tools report numeric bounds with the failing field", function () { return __awaiter(void 0, void 0, void 0, function () {
    var bounded, materialized;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                bounded = __assign(__assign({}, echo()), { parameters: {
                        type: "object",
                        properties: { offset: { type: "integer", minimum: 1 } },
                        required: ["offset"],
                        additionalProperties: false,
                    } });
                materialized = (0, src_1.materializeTools)((0, src_1.createToolRegistry)([bounded]));
                return [4 /*yield*/, (0, bun_test_1.expect)(materialized.settle(__assign(__assign({}, invocation), { arguments: { offset: 0 } }), { workspaceRoot: "/tmp" })).resolves.toEqual({
                        status: "failed",
                        error: "Invalid tool input: offset: must be at least 1",
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("materialized tools reject removed and replaced registrations as stale", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, materialized;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = (0, src_1.createToolRegistry)([echo("first")]);
                materialized = (0, src_1.materializeTools)(registry);
                registry.set("echo", echo("second"));
                (0, bun_test_1.expect)(materialized.resolve("echo")).toEqual({
                    status: "stale",
                    error: "Stale tool call: echo",
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(materialized.settle(invocation, { workspaceRoot: "/tmp" })).resolves.toEqual({
                        status: "stale",
                        error: "Stale tool call: echo",
                    })];
            case 1:
                _a.sent();
                registry.delete("echo");
                return [4 /*yield*/, (0, bun_test_1.expect)(materialized.settle(invocation, { workspaceRoot: "/tmp" })).resolves.toEqual({
                        status: "stale",
                        error: "Stale tool call: echo",
                    })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("materialized tools report names absent at provider turn creation as unknown", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, materialized;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = (0, src_1.createToolRegistry)([]);
                materialized = (0, src_1.materializeTools)(registry);
                registry.set("echo", echo());
                (0, bun_test_1.expect)(materialized.resolve("echo")).toEqual({
                    status: "unknown",
                    error: "Unknown tool: echo",
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(materialized.settle(invocation, { workspaceRoot: "/tmp" })).resolves.toEqual({
                        status: "unknown",
                        error: "Unknown tool: echo",
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
