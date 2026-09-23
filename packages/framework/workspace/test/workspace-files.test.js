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
var node_fs_1 = require("node:fs");
var promises_1 = require("node:fs/promises");
var node_fs_2 = require("node:fs");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var platform_1 = require("@natalia/platform");
/**
 * Symlink fixtures are skipped when the machine cannot create symlinks
 * (Windows without Developer Mode), because the containment rules under test
 * cannot be exercised without them.
 */
var symlinkSupported = await probeSymlinkSupport();
var symlinkTest = symlinkSupported ? bun_test_1.test : bun_test_1.test.skip;
function probeSymlinkSupport() {
    return __awaiter(this, void 0, void 0, function () {
        var root, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-symlink-probe-"))];
                case 1:
                    root = _b.sent();
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, 5, 7]);
                    return [4 /*yield*/, (0, promises_1.symlink)("target", (0, node_path_1.join)(root, "link"))];
                case 3:
                    _b.sent();
                    return [2 /*return*/, true];
                case 4:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 5: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true }).catch(function () { return undefined; })];
                case 6:
                    _b.sent();
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
symlinkTest("workspace files stay contained without hiding internal directories", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, outside, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-files-"))];
            case 1:
                root = _d.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-files-outside-"))];
            case 2:
                outside = _d.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "src"), { recursive: true })];
            case 3:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "node_modules", "pkg"), { recursive: true })];
            case 4:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "model.ts"), "export {}\n")];
            case 5:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "node_modules", "pkg", "hidden.ts"), "hidden\n")];
            case 6:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(outside, "secret.ts"), "secret\n")];
            case 7:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.symlink)(outside, (0, node_path_1.join)(root, "outside"))];
            case 8:
                _d.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: root, query: "model.ts" })];
            case 9:
                _a.apply(void 0, [_d.sent()]).toEqual(bun_test_1.expect.arrayContaining([{ path: "src/model.ts", type: "file" }]));
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: root })];
            case 10:
                _b.apply(void 0, [_d.sent()]).toEqual(bun_test_1.expect.arrayContaining([
                    bun_test_1.expect.objectContaining({
                        path: bun_test_1.expect.stringContaining("node_modules"),
                    }),
                ]));
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: root })];
            case 11:
                _c.apply(void 0, [_d.sent()]).not.toEqual(bun_test_1.expect.arrayContaining([
                    bun_test_1.expect.objectContaining({ path: bun_test_1.expect.stringContaining("outside") }),
                ]));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace file catalog avoids repeated scans until invalidated", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-files-cache-"))];
            case 1:
                root = _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "first.ts"), "export {}\n")];
            case 2:
                _d.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: root })];
            case 3:
                _a.apply(void 0, [_d.sent()]).toEqual([
                    { path: "first.ts", type: "file" },
                ]);
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "second.ts"), "export {}\n")];
            case 4:
                _d.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: root })];
            case 5:
                _b.apply(void 0, [_d.sent()]).toEqual([
                    { path: "first.ts", type: "file" },
                ]);
                (0, platform_1.invalidateWorkspaceFiles)(root);
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: root })];
            case 6:
                _c.apply(void 0, [_d.sent()]).toEqual([
                    { path: "first.ts", type: "file" },
                    { path: "second.ts", type: "file" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace file catalog ranks non-contiguous fuzzy matches", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-fuzzy-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "src"), { recursive: true })];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "component-model.ts"), "export {}\n")];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "command-menu.ts"), "export {}\n")];
            case 4:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "model.ts"), "export {}\n")];
            case 5:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: root, query: "cmt" })];
            case 6:
                _a.apply(void 0, [_b.sent()]).toEqual([
                    { path: "src/command-menu.ts", type: "file" },
                    { path: "src/component-model.ts", type: "file" },
                    { path: "src/model.ts", type: "file" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace file catalog filters fuzzy results by entry type", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-find-type-"))];
            case 1:
                root = _c.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "src", "models"), { recursive: true })];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "model.ts"), "export {}\n")];
            case 3:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({
                        workspaceRoot: root,
                        query: "mod",
                        type: "directory",
                    })];
            case 4:
                _a.apply(void 0, [_c.sent()]).toEqual([{ path: "src/models/", type: "directory" }]);
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({
                        workspaceRoot: root,
                        query: "mod",
                        type: "file",
                    })];
            case 5:
                _b.apply(void 0, [_c.sent()]).toEqual([{ path: "src/model.ts", type: "file" }]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace content search is text-only and line-aware", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-search-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "src"), { recursive: true })];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "match.ts"), "first\nneedle here\n")];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "binary.bin"), "needle\0hidden")];
            case 4:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.searchWorkspaceFiles)({
                        workspaceRoot: root,
                        query: "needle",
                        include: "*.ts",
                    })];
            case 5:
                _a.apply(void 0, [_b.sent()]).toEqual([{ path: "src/match.ts", line: 2, text: "needle here" }]);
                return [4 /*yield*/, (0, bun_test_1.expect)((0, platform_1.searchWorkspaceFiles)({ workspaceRoot: root, query: "" })).rejects.toThrow("workspace search query is required")];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace content search reaches past the first catalog page", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, index, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-search-deep-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "short"), { recursive: true })];
            case 2:
                _b.sent();
                index = 0;
                _b.label = 3;
            case 3:
                if (!(index < 220)) return [3 /*break*/, 6];
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "short", "file-".concat(index.toString().padStart(3, "0"), ".ts")), "no match here\n")];
            case 4:
                _b.sent();
                _b.label = 5;
            case 5:
                index++;
                return [3 /*break*/, 3];
            case 6: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "deep", "nested"), { recursive: true })];
            case 7:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "deep", "nested", "target.ts"), "the needle is here\n")];
            case 8:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.searchWorkspaceFiles)({
                        workspaceRoot: root,
                        query: "needle",
                        include: "deep/**/*.ts",
                    })];
            case 9:
                _a.apply(void 0, [_b.sent()]).toEqual([
                    { path: "deep/nested/target.ts", line: 1, text: "the needle is here" },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace list, read, and glob retain containment without hiding ignored files", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-api-"))];
            case 1:
                root = _f.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "src"), { recursive: true })];
            case 2:
                _f.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "node_modules", "pkg"), { recursive: true })];
            case 3:
                _f.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "model.ts"), "export const value = 1\n")];
            case 4:
                _f.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "data.bin"), "\0binary")];
            case 5:
                _f.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "node_modules", "pkg", "hidden.ts"), "hidden\n")];
            case 6:
                _f.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.listWorkspaceFiles)({ workspaceRoot: root })];
            case 7:
                _a.apply(void 0, [_f.sent()]).toEqual({
                    entries: [
                        { path: "node_modules/", type: "directory" },
                        { path: "src/", type: "directory" },
                    ],
                    truncated: false,
                });
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.globWorkspaceFiles)({ workspaceRoot: root, pattern: "**/*.ts" })];
            case 8:
                _b.apply(void 0, [_f.sent()]).toEqual([
                    { path: "node_modules/pkg/hidden.ts", type: "file" },
                    { path: "src/model.ts", type: "file" },
                ]);
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.readWorkspaceFile)({ workspaceRoot: root, path: "src/model.ts" })];
            case 9:
                _c.apply(void 0, [_f.sent()]).toMatchObject({
                    path: "src/model.ts",
                    content: "export const value = 1\n",
                    encoding: "utf8",
                    mime: "text/typescript",
                });
                _d = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.readWorkspaceFile)({ workspaceRoot: root, path: "src/data.bin" })];
            case 10:
                _d.apply(void 0, [_f.sent()]).toMatchObject({
                    encoding: "base64",
                });
                _e = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.listWorkspaceFiles)({ workspaceRoot: root, path: "node_modules" })];
            case 11:
                _e.apply(void 0, [(_f.sent())
                        .entries]).toEqual([{ path: "node_modules/pkg/", type: "directory" }]);
                return [4 /*yield*/, (0, bun_test_1.expect)((0, platform_1.readWorkspaceFile)({ workspaceRoot: root, path: "../outside" })).rejects.toThrow("workspace path must remain inside workspace")];
            case 12:
                _f.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace text reads paginate by line offset and byte budget", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, first, second;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-read-page-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "large.txt"), Array.from({ length: 2005 }, function (_, index) { return "line-".concat(index + 1); }).join("\n"))];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, platform_1.readWorkspaceFile)({
                        workspaceRoot: root,
                        path: "large.txt",
                        limit: 2000,
                    })];
            case 3:
                first = _a.sent();
                (0, bun_test_1.expect)(first).toMatchObject({
                    encoding: "utf8",
                    offset: 1,
                    truncated: true,
                    next: 2001,
                });
                (0, bun_test_1.expect)(first.content.split("\n")).toHaveLength(2000);
                return [4 /*yield*/, (0, platform_1.readWorkspaceFile)({
                        workspaceRoot: root,
                        path: "large.txt",
                        offset: first.next,
                    })];
            case 4:
                second = _a.sent();
                (0, bun_test_1.expect)(second).toMatchObject({
                    content: "line-2001\nline-2002\nline-2003\nline-2004\nline-2005",
                    offset: 2001,
                    truncated: false,
                });
                return [4 /*yield*/, (0, bun_test_1.expect)((0, platform_1.readWorkspaceFile)({
                        workspaceRoot: root,
                        path: "large.txt",
                        offset: 3000,
                    })).rejects.toThrow("workspace read offset is out of range")];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace reads recognized images as bounded base64 media", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, png, webp, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-media-"))];
            case 1:
                root = _c.sent();
                png = Buffer.from("89504e470d0a1a0a00000000", "hex");
                webp = Buffer.from("524946460000000057454250", "hex");
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "image.dat"), png)];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "image.webp"), webp)];
            case 3:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.readWorkspaceFile)({ workspaceRoot: root, path: "image.dat" })];
            case 4:
                _a.apply(void 0, [_c.sent()]).toEqual({
                    path: "image.dat",
                    content: png.toString("base64"),
                    encoding: "base64",
                    mime: "image/png",
                });
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.readWorkspaceFile)({ workspaceRoot: root, path: "image.webp" })];
            case 5:
                _b.apply(void 0, [_c.sent()]).toMatchObject({ encoding: "base64", mime: "image/webp" });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace directory lists use stable direct-child pagination", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-list-page-"))];
            case 1:
                root = _c.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "alpha"), { recursive: true })];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "beta"), { recursive: true })];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "a.txt"), "a\n")];
            case 4:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "b.txt"), "b\n")];
            case 5:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "alpha", "nested.txt"), "nested\n")];
            case 6:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.listWorkspaceFiles)({ workspaceRoot: root, limit: 2 })];
            case 7:
                _a.apply(void 0, [_c.sent()]).toEqual({
                    entries: [
                        { path: "alpha/", type: "directory" },
                        { path: "beta/", type: "directory" },
                    ],
                    truncated: true,
                    next: 3,
                });
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.listWorkspaceFiles)({ workspaceRoot: root, offset: 3, limit: 2 })];
            case 8:
                _b.apply(void 0, [_c.sent()]).toEqual({
                    entries: [
                        { path: "a.txt", type: "file" },
                        { path: "b.txt", type: "file" },
                    ],
                    truncated: false,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace access does not treat .gitignore as a visibility policy", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-gitignore-free-"))];
            case 1:
                root = _c.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "src", "generated"), { recursive: true })];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "node_modules", "pkg"), { recursive: true })];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".gitignore"), ["*.secret", "/root-only.txt", "generated/", "node_modules/"].join("\n"))];
            case 4:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "visible.ts"), "visible\n")];
            case 5:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "root-only.txt"), "hidden\n")];
            case 6:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "visible.secret"), "hidden\n")];
            case 7:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "generated", "code.ts"), "hidden\n")];
            case 8:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "node_modules", "pkg", "hidden.ts"), "hidden\n")];
            case 9:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: root, limit: 200 })];
            case 10:
                _a.apply(void 0, [_c.sent()]).toEqual(bun_test_1.expect.arrayContaining([
                    bun_test_1.expect.objectContaining({ path: "root-only.txt" }),
                    bun_test_1.expect.objectContaining({ path: "visible.secret" }),
                    bun_test_1.expect.objectContaining({ path: "src/generated/code.ts" }),
                    bun_test_1.expect.objectContaining({ path: "node_modules/pkg/hidden.ts" }),
                ]));
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.globWorkspaceFiles)({ workspaceRoot: root, pattern: "**/*.ts" })];
            case 11:
                _b.apply(void 0, [_c.sent()]).toEqual(bun_test_1.expect.arrayContaining([
                    { path: "node_modules/pkg/hidden.ts", type: "file" },
                    { path: "src/generated/code.ts", type: "file" },
                    { path: "visible.ts", type: "file" },
                ]));
                return [4 /*yield*/, (0, bun_test_1.expect)((0, platform_1.readWorkspaceFile)({ workspaceRoot: root, path: "root-only.txt" })).resolves.toMatchObject({ path: "root-only.txt", content: "hidden\n" })];
            case 12:
                _c.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, platform_1.listWorkspaceFiles)({ workspaceRoot: root, path: "node_modules" })).resolves.toMatchObject({
                        entries: [{ path: "node_modules/pkg/", type: "directory" }],
                    })];
            case 13:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
symlinkTest("workspace catalog ignores symlink cycles", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-cycle-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "src", "nested"), { recursive: true })];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "model.ts"), "export {}\n")];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.symlink)("..", (0, node_path_1.join)(root, "src", "nested", "parent"))];
            case 4:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: root, limit: 200 })];
            case 5:
                _a.apply(void 0, [_b.sent()]).toEqual(bun_test_1.expect.arrayContaining([{ path: "src/model.ts", type: "file" }]));
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspace search validates regex and honors complete include globs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-search-glob-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "src", "nested"), { recursive: true })];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "test"), { recursive: true })];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "match.ts"), "needle\n")];
            case 4:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "nested", "match.ts"), "needle\n")];
            case 5:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "test", "match.ts"), "needle\n")];
            case 6:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.searchWorkspaceFiles)({
                        workspaceRoot: root,
                        query: "needle",
                        include: "src/*.ts",
                    })];
            case 7:
                _a.apply(void 0, [_b.sent()]).toEqual([{ path: "src/match.ts", line: 1, text: "needle" }]);
                return [4 /*yield*/, (0, bun_test_1.expect)((0, platform_1.searchWorkspaceFiles)({ workspaceRoot: root, query: "[" })).rejects.toThrow("workspace search query must be a valid regular expression")];
            case 8:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
/**
 * inotify budget is per-user and shared with everything the desktop runs
 * (flatpak apps have been observed holding 80k+ watches, VS Code 50k); when
 * the pool is exhausted, fs.watch fails with ENOSPC no matter how correct the
 * code is. Probe with one real watch: budget present -> the tests really run,
 * budget gone -> skip with the reason instead of a fake "0 changes" failure.
 */
function inotifyBudgetAvailable() {
    var probeRoot = (0, node_fs_2.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-inotify-probe-"));
    var watcher;
    try {
        watcher = (0, node_fs_1.watch)(probeRoot, { persistent: false }, function () { return undefined; });
        return true;
    }
    catch (_a) {
        return false;
    }
    finally {
        watcher === null || watcher === void 0 ? void 0 : watcher.close();
    }
}
var watcherBudgetAvailable = inotifyBudgetAvailable();
var watcherTest = watcherBudgetAvailable ? bun_test_1.test : bun_test_1.test.skip;
if (!watcherBudgetAvailable)
    console.error("workspace watcher tests skipped: per-user inotify watch budget exhausted (fs.inotify.max_user_watches); " +
        "raise it with: sudo sysctl fs.inotify.max_user_watches=524288");
watcherTest("workspace watcher invalidates the catalog and watches new directories", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, changes, stop, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-watch-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "first.ts"), "export {}\n")];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: root })];
            case 3:
                _b.sent();
                changes = 0;
                return [4 /*yield*/, (0, platform_1.watchWorkspaceFiles)(root, function () { return changes++; })];
            case 4:
                stop = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "src"))];
            case 5:
                _b.sent();
                return [4 /*yield*/, Bun.sleep(150)];
            case 6:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src", "second.ts"), "export {}\n")];
            case 7:
                _b.sent();
                return [4 /*yield*/, Bun.sleep(150)];
            case 8:
                _b.sent();
                (0, bun_test_1.expect)(changes).toBeGreaterThan(0);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, platform_1.findWorkspaceFiles)({ workspaceRoot: root })];
            case 9:
                _a.apply(void 0, [_b.sent()]).toEqual(bun_test_1.expect.arrayContaining([{ path: "src/second.ts", type: "file" }]));
                stop();
                return [2 /*return*/];
        }
    });
}); });
watcherTest("workspace watcher prunes known-heavy internal directories", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, changes, stop;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-watch-excluded-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "node_modules", "deep"), { recursive: true })];
            case 2:
                _a.sent();
                changes = 0;
                return [4 /*yield*/, (0, platform_1.watchWorkspaceFiles)(root, function () { return changes++; })];
            case 3:
                stop = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "node_modules", "deep", "hidden.js"), "module.exports = {}\n")];
            case 4:
                _a.sent();
                return [4 /*yield*/, Bun.sleep(200)];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(changes).toBe(0);
                stop();
                return [2 /*return*/];
        }
    });
}); });
watcherTest("workspace watcher ignores Natalia runtime writes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, changes, stop;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-watch-ignore-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia", "perf"), { recursive: true })];
            case 2:
                _a.sent();
                changes = 0;
                return [4 /*yield*/, (0, platform_1.watchWorkspaceFiles)(root, function () { return changes++; })];
            case 3:
                stop = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "perf", "runtime.jsonl"), "{}\n")];
            case 4:
                _a.sent();
                return [4 /*yield*/, Bun.sleep(150)];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(changes).toBe(0);
                stop();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("read policy no longer blocks ignored workspace paths", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, relativePath;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-resource-policy-"))];
            case 1:
                root = _a.sent();
                relativePath = ".natalia/todos/ses_current.json";
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia", "todos"), { recursive: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, relativePath), '{"items":[]}\n')];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, platform_1.readWorkspaceFile)({ workspaceRoot: root, path: relativePath })).resolves.toMatchObject({ path: relativePath, content: '{"items":[]}\n' })];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, platform_1.readWorkspaceFile)({
                        workspaceRoot: root,
                        path: "../outside.json",
                    })).rejects.toThrow("workspace path must remain inside workspace")];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
