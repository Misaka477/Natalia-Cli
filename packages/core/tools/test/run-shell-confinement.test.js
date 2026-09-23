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
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var confinement_1 = require("@natalia/confinement");
var run_shell_1 = require("../src/run-shell");
/**
 * runShell's confinement seam (sandbox study §6: the exec primitive becomes
 * confinement-aware; the policy rides the call). The real-confinement cases
 * are gated on the built backend — same discipline as the object-store's
 * native index: an environment without cargo has no binary, and the
 * fail-closed refusal is covered at the wrap layer's own tests.
 *
 * Both directories live inside the package (outside every temp root), so
 * `workspace-write` may write the workspace and must deny its sibling: the
 * always-granted `/tmp` can never make the assertion pass on its own.
 */
var available = (0, confinement_1.confinementAvailable)();
var workspace = "";
var outside = "";
(0, bun_test_1.beforeAll)(function () {
    var base = (0, node_path_1.join)(import.meta.dir, ".run-shell-confinement-".concat(process.pid));
    workspace = (0, node_path_1.join)(base, "workspace");
    outside = (0, node_path_1.join)(base, "outside");
    (0, node_fs_1.mkdirSync)(workspace, { recursive: true });
    (0, node_fs_1.mkdirSync)(outside, { recursive: true });
});
(0, bun_test_1.afterAll)(function () {
    (0, node_fs_1.rmSync)((0, node_path_1.join)(import.meta.dir, ".run-shell-confinement-".concat(process.pid)), {
        recursive: true,
        force: true,
    });
});
function context(confinement) {
    return __assign({ workspaceRoot: workspace }, (confinement ? { confinement: confinement } : {}));
}
(0, bun_test_1.test)("without a policy the command runs unconfined (today's behavior)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var target, output;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                target = (0, node_path_1.join)(outside, "raw.txt");
                return [4 /*yield*/, (0, run_shell_1.runShell)("echo ok > \"".concat(target, "\""), context(), 30)];
            case 1:
                output = _a.sent();
                (0, bun_test_1.expect)(output).toContain("exit=0");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("explicit danger-full-access also runs unconfined", function () { return __awaiter(void 0, void 0, void 0, function () {
    var target, output;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                target = (0, node_path_1.join)(outside, "danger.txt");
                return [4 /*yield*/, (0, run_shell_1.runShell)("echo ok > \"".concat(target, "\""), {
                        workspaceRoot: workspace,
                        confinement: "danger-full-access",
                    }, 30)];
            case 1:
                output = _a.sent();
                (0, bun_test_1.expect)(output).toContain("exit=0");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace-write allows the workspace and denies the sibling", function () { return __awaiter(void 0, void 0, void 0, function () {
    var inside, blocked, output, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!available)
                    return [2 /*return*/];
                inside = (0, node_path_1.join)(workspace, "allowed.txt");
                blocked = (0, node_path_1.join)(outside, "denied.txt");
                return [4 /*yield*/, (0, run_shell_1.runShell)("echo ok > \"".concat(inside, "\" && echo bad > \"").concat(blocked, "\""), context("workspace-write"), 30).catch(function (error) { return error.message; })];
            case 1:
                output = _c.sent();
                (0, bun_test_1.expect)(output).toContain("exit=");
                // The first write landed, the second was refused by the kernel.
                _a = bun_test_1.expect;
                return [4 /*yield*/, Bun.file(inside).exists()];
            case 2:
                // The first write landed, the second was refused by the kernel.
                _a.apply(void 0, [_c.sent()]).toBe(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, Bun.file(blocked).exists()];
            case 3:
                _b.apply(void 0, [_c.sent()]).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("read-only denies writes even inside the workspace", function () { return __awaiter(void 0, void 0, void 0, function () {
    var target, output, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!available)
                    return [2 /*return*/];
                target = (0, node_path_1.join)(workspace, "ro-denied.txt");
                return [4 /*yield*/, (0, run_shell_1.runShell)("echo x > \"".concat(target, "\""), context("read-only"), 30).catch(function (error) { return error.message; })];
            case 1:
                output = _b.sent();
                (0, bun_test_1.expect)(output).not.toContain("exit=0");
                _a = bun_test_1.expect;
                return [4 /*yield*/, Bun.file(target).exists()];
            case 2:
                _a.apply(void 0, [_b.sent()]).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a confined command's own failure still reports its output", function () { return __awaiter(void 0, void 0, void 0, function () {
    var output;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!available)
                    return [2 /*return*/];
                return [4 /*yield*/, (0, run_shell_1.runShell)("echo to-stderr >&2; exit 3", context("workspace-write"), 30).catch(function (error) { return error.message; })];
            case 1:
                output = _a.sent();
                (0, bun_test_1.expect)(output).toContain("exit=3");
                (0, bun_test_1.expect)(output).toContain("to-stderr");
                return [2 /*return*/];
        }
    });
}); });
