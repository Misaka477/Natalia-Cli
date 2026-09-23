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
var goal_completion_check_1 = require("../src/runtime/goal/goal-completion-check");
function workspace() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-goal-check-"))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
(0, bun_test_1.test)("no configured command means no check at all", function () {
    // An invented default would fail every workspace with no test suite, and a
    // silently passing one would be theatre.
    (0, bun_test_1.expect)((0, goal_completion_check_1.runCompletionCheck)({ workspaceRoot: "/tmp", command: undefined })).toBeUndefined();
});
(0, bun_test_1.test)("a passing command reports success with no detail", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                result = (0, goal_completion_check_1.runCompletionCheck)({ workspaceRoot: root, command: "true" });
                (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.ok).toBe(true);
                (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.command).toBe("true");
                (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.detail).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a failing command reports the exit code and its output", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                result = (0, goal_completion_check_1.runCompletionCheck)({
                    workspaceRoot: root,
                    command: "echo 'tests failed'; exit 3",
                });
                (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.ok).toBe(false);
                (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.detail).toContain("Exit code 3");
                // The output is shown to the model so it can see why it was refused.
                (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.detail).toContain("tests failed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the command runs in the workspace root", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "marker.txt"), "here")];
            case 2:
                _a.sent();
                result = (0, goal_completion_check_1.runCompletionCheck)({
                    workspaceRoot: root,
                    command: "test -f marker.txt",
                });
                (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.ok).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a huge output is bounded, because the result is read by the model", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, workspace()];
            case 1:
                root = _a.sent();
                result = (0, goal_completion_check_1.runCompletionCheck)({
                    workspaceRoot: root,
                    command: "printf 'x%.0s' $(seq 1 20000); exit 1",
                });
                (0, bun_test_1.expect)(result === null || result === void 0 ? void 0 : result.ok).toBe(false);
                // Bounded rather than dumped: an unbounded dump spends the context the check
                // is trying to protect.
                (0, bun_test_1.expect)(result.detail.length).toBeLessThan(4400);
                (0, bun_test_1.expect)(result.detail).toContain("more characters");
                return [2 /*return*/];
        }
    });
}); });
