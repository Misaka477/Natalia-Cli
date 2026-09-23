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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var workspace_runtime_1 = require("../src/runtime/workspace-runtime");
function git(cwd, args) {
    return __awaiter(this, void 0, void 0, function () {
        var process, stdout, stderr, exitCode;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    process = Bun.spawn(__spreadArray(["git"], args, true), {
                        cwd: cwd,
                        stdin: "ignore",
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                    return [4 /*yield*/, new Response(process.stdout).text()];
                case 1:
                    stdout = _a.sent();
                    return [4 /*yield*/, new Response(process.stderr).text()];
                case 2:
                    stderr = _a.sent();
                    return [4 /*yield*/, process.exited];
                case 3:
                    exitCode = _a.sent();
                    if (exitCode !== 0)
                        throw new Error("git ".concat(args.join(" "), " failed: ").concat(stderr || stdout));
                    return [2 /*return*/, stdout];
            }
        });
    });
}
(0, bun_test_1.test)("parseStatusLine unwraps quoted paths and rename records", function () {
    (0, bun_test_1.expect)((0, workspace_runtime_1.parseStatusLine)('?? "file with space.txt"')).toEqual({
        path: "file with space.txt",
        operation: "added",
        untracked: true,
    });
    (0, bun_test_1.expect)((0, workspace_runtime_1.parseStatusLine)("R  old.ts -> new.ts")).toEqual({
        path: "new.ts",
        operation: "renamed",
        oldPath: "old.ts",
        untracked: false,
    });
    (0, bun_test_1.expect)((0, workspace_runtime_1.parseStatusLine)(" M src/app.ts")).toEqual({
        path: "src/app.ts",
        operation: "modified",
        untracked: false,
    });
});
(0, bun_test_1.test)("collectWorkspaceGitDiff returns empty for a non-git directory", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-git-diff-none-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "readme.txt"), "hello\n")];
            case 2:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, workspace_runtime_1.collectWorkspaceGitDiff)(root)];
            case 3:
                _a.apply(void 0, [_b.sent()]).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("collectWorkspaceGitDiff reports tracked and untracked worktree files", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, changes, modified, added;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-git-diff-worktree-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, git(root, ["init"])];
            case 2:
                _a.sent();
                return [4 /*yield*/, git(root, ["config", "user.email", "natalia@example.com"])];
            case 3:
                _a.sent();
                return [4 /*yield*/, git(root, ["config", "user.name", "Natalia"])];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "tracked.ts"), "const a = 1;\n")];
            case 5:
                _a.sent();
                return [4 /*yield*/, git(root, ["add", "tracked.ts"])];
            case 6:
                _a.sent();
                return [4 /*yield*/, git(root, ["commit", "-m", "init"])];
            case 7:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "tracked.ts"), "const a = 2;\n")];
            case 8:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "nested"), { recursive: true })];
            case 9:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "nested", "new.ts"), "export const n = 1;\n")];
            case 10:
                _a.sent();
                return [4 /*yield*/, (0, workspace_runtime_1.collectWorkspaceGitDiff)(root, {
                        from: "HEAD",
                        to: "WORKTREE",
                    })];
            case 11:
                changes = _a.sent();
                (0, bun_test_1.expect)(changes).toEqual(bun_test_1.expect.arrayContaining([
                    bun_test_1.expect.objectContaining({
                        path: "tracked.ts",
                        operation: "modified",
                    }),
                    bun_test_1.expect.objectContaining({
                        path: "nested/new.ts",
                        operation: "added",
                    }),
                ]));
                modified = changes.find(function (change) { return change.path === "tracked.ts"; });
                (0, bun_test_1.expect)(modified === null || modified === void 0 ? void 0 : modified.patch).toContain("-const a = 1;");
                (0, bun_test_1.expect)(modified === null || modified === void 0 ? void 0 : modified.patch).toContain("+const a = 2;");
                added = changes.find(function (change) { return change.path === "nested/new.ts"; });
                (0, bun_test_1.expect)(added === null || added === void 0 ? void 0 : added.patch).toContain("+export const n = 1;");
                return [2 /*return*/];
        }
    });
}); });
