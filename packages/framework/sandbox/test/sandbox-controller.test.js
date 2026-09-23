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
var promises_2 = require("node:fs/promises");
var sandbox_controller_1 = require("../src/sandbox-controller");
(0, bun_test_1.test)("sandbox controller initializes lazily and refuses before init", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-controller-"))];
            case 1:
                root = _c.sent();
                controller = (0, sandbox_controller_1.createSandboxController)({ workspaceRoot: root });
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.list()).rejects.toThrow("sandbox manager is not initialized")];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.referencedObjectIDs()).rejects.toThrow("sandbox manager is not initialized")];
            case 3:
                _c.sent();
                (0, bun_test_1.expect)(controller.runningResourceCount()).toBe(0);
                return [4 /*yield*/, controller.init()];
            case 4:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, controller.list()];
            case 5:
                _a.apply(void 0, [_c.sent()]).toEqual([]);
                _b = bun_test_1.expect;
                return [4 /*yield*/, controller.referencedObjectIDs()];
            case 6:
                _b.apply(void 0, [_c.sent()]).toBeInstanceOf(Set);
                (0, bun_test_1.expect)(controller.runningResourceCount()).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox controller init is idempotent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-controller-2-"))];
            case 1:
                root = _b.sent();
                controller = (0, sandbox_controller_1.createSandboxController)({ workspaceRoot: root });
                return [4 /*yield*/, controller.init()];
            case 2:
                _b.sent();
                return [4 /*yield*/, controller.init()];
            case 3:
                _b.sent();
                return [4 /*yield*/, controller.create("idempotent")];
            case 4:
                _b.sent();
                return [4 /*yield*/, controller.init()];
            case 5:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, controller.list()];
            case 6:
                _a.apply(void 0, [(_b.sent()).map(function (_a) {
                        var id = _a.id;
                        return id;
                    })]).toEqual(["idempotent"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox controller close is lazy, idempotent, and final", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-close-"))];
            case 1:
                root = _a.sent();
                controller = (0, sandbox_controller_1.createSandboxController)({ workspaceRoot: root });
                return [4 /*yield*/, controller.close()];
            case 2:
                _a.sent();
                return [4 /*yield*/, controller.close()];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.init()).rejects.toThrow("sandbox controller is closed")];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.list()).rejects.toThrow("sandbox manager is not initialized")];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox controller close releases its initialized manager", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-release-"))];
            case 1:
                root = _a.sent();
                controller = (0, sandbox_controller_1.createSandboxController)({ workspaceRoot: root });
                return [4 /*yield*/, controller.init()];
            case 2:
                _a.sent();
                return [4 /*yield*/, controller.close()];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.list()).rejects.toThrow("sandbox manager is not initialized")];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.init()).rejects.toThrow("sandbox controller is closed")];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the default sandbox backend is our own git-free snapshot manager", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-default-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_2.mkdir)((0, node_path_1.join)(root, ".git"), { recursive: true })];
            case 2:
                _b.sent();
                controller = (0, sandbox_controller_1.createSandboxController)({ workspaceRoot: root });
                return [4 /*yield*/, controller.init()];
            case 3:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, controller.referencedObjectIDs()];
            case 4:
                _a.apply(void 0, [_b.sent()]).toBeInstanceOf(Set);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("sandbox.backend=worktree opts into the real-git backend when a repo exists", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-sandbox-worktree-opt-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_2.mkdir)((0, node_path_1.join)(root, ".git"), { recursive: true })];
            case 2:
                _b.sent();
                controller = (0, sandbox_controller_1.createSandboxController)({
                    workspaceRoot: root,
                    backend: function () { return "worktree"; },
                });
                return [4 /*yield*/, controller.init()];
            case 3:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, controller.referencedObjectIDs()];
            case 4:
                _a.apply(void 0, [_b.sent()]).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
