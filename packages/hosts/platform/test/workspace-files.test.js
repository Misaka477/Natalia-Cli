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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var index_1 = require("../src/index");
function tmp(prefix) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), prefix))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
var exists = function (p) {
    return (0, promises_1.stat)(p)
        .then(function () { return true; })
        .catch(function () { return false; });
};
(0, bun_test_1.test)("createWorkspaceFile cannot escape the workspace through a symlinked directory", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ws, outside, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tmp("natalia-ws-create-")];
            case 1:
                ws = _b.sent();
                return [4 /*yield*/, tmp("natalia-outside-")];
            case 2:
                outside = _b.sent();
                return [4 /*yield*/, (0, promises_1.symlink)(outside, (0, node_path_1.join)(ws, "escape"))];
            case 3:
                _b.sent();
                // Lexically inside the workspace, but `escape` is a symlink pointing out.
                return [4 /*yield*/, (0, bun_test_1.expect)((0, index_1.createWorkspaceFile)({
                        workspaceRoot: ws,
                        path: "escape/evil.txt",
                        content: "x",
                    })).rejects.toThrow(/must remain inside workspace/)];
            case 4:
                // Lexically inside the workspace, but `escape` is a symlink pointing out.
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, exists((0, node_path_1.join)(outside, "evil.txt"))];
            case 5:
                _a.apply(void 0, [_b.sent()]).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("createWorkspaceFile still creates a deep new path inside the workspace", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ws, result, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, tmp("natalia-ws-deep-")];
            case 1:
                ws = _b.sent();
                return [4 /*yield*/, (0, index_1.createWorkspaceFile)({
                        workspaceRoot: ws,
                        path: "a/b/c/deep.txt",
                        content: "ok",
                    })];
            case 2:
                result = _b.sent();
                (0, bun_test_1.expect)(result.created).toBe(true);
                _a = bun_test_1.expect;
                return [4 /*yield*/, exists((0, node_path_1.join)(ws, "a/b/c/deep.txt"))];
            case 3:
                _a.apply(void 0, [_b.sent()]).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace write ops reject absolute and .. paths before touching disk", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ws;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tmp("natalia-ws-reject-")];
            case 1:
                ws = _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, index_1.createWorkspaceFile)({
                        workspaceRoot: ws,
                        path: "../escape.txt",
                        content: "x",
                    })).rejects.toThrow(/must remain inside workspace/)];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, index_1.writeWorkspaceFile)({ workspaceRoot: ws, path: "/etc/evil", content: "x" })).rejects.toThrow(/must remain inside workspace/)];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, index_1.deleteWorkspaceFile)({ workspaceRoot: ws, path: "../x" })).rejects.toThrow(/must remain inside workspace/)];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, index_1.renameWorkspaceFile)({ workspaceRoot: ws, path: "../a", newPath: "b" })).rejects.toThrow(/must remain inside workspace/)];
            case 5:
                _a.sent();
                // A rename destination that escapes is refused too.
                return [4 /*yield*/, (0, index_1.writeWorkspaceFile)({
                        workspaceRoot: ws,
                        path: "src.txt",
                        content: "x",
                    })];
            case 6:
                // A rename destination that escapes is refused too.
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, index_1.renameWorkspaceFile)({
                        workspaceRoot: ws,
                        path: "src.txt",
                        newPath: "../out.txt",
                    })).rejects.toThrow(/must remain inside workspace/)];
            case 7:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
