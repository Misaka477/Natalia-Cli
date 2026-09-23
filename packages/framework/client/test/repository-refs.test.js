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
var substrate_1 = require("@anthelia/substrate");
var governance_ledger_1 = require("@natalia/governance-ledger");
function makeGitRepo() {
    return __awaiter(this, void 0, void 0, function () {
        var dir, run;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-refs-git-"))];
                case 1:
                    dir = _a.sent();
                    run = function (args) {
                        return Bun.spawnSync(args, { cwd: dir, stdout: "pipe", stderr: "pipe" });
                    };
                    if (!run(["git", "init", "-q"]).success)
                        return [2 /*return*/, undefined];
                    run(["git", "config", "user.email", "test@example.com"]);
                    run(["git", "config", "user.name", "test"]);
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(dir, "file.txt"), "hello")];
                case 2:
                    _a.sent();
                    run(["git", "add", "-A"]);
                    if (!run(["git", "commit", "-q", "-m", "init"]).success)
                        return [2 /*return*/, undefined];
                    return [2 /*return*/, dir];
            }
        });
    });
}
(0, bun_test_1.test)("captureRepositoryRefsSync stamps a safe commit hash and injected version", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, refs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, makeGitRepo()];
            case 1:
                dir = _a.sent();
                if (!dir)
                    return [2 /*return*/]; // git unavailable in this environment
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 3, 6]);
                refs = (0, substrate_1.captureRepositoryRefsSync)(dir, {
                    NATALIA_VERSION: "0.0.0-m13",
                });
                (0, bun_test_1.expect)(refs.repositoryVersion).toBe("0.0.0-m13");
                (0, bun_test_1.expect)(refs.commit).toMatch(/^[0-9a-f]{40}$/u);
                return [3 /*break*/, 6];
            case 3:
                if (!dir) return [3 /*break*/, 5];
                return [4 /*yield*/, (0, promises_1.rm)(dir, { recursive: true, force: true })];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5: return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("captureRepositoryRefsSync is fail-soft outside a git repo", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, refs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-refs-nogit-"))];
            case 1:
                dir = _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 3, 5]);
                refs = (0, substrate_1.captureRepositoryRefsSync)(dir, {});
                (0, bun_test_1.expect)(refs.commit).toBeUndefined();
                (0, bun_test_1.expect)(refs.repositoryVersion).toBeUndefined();
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, (0, promises_1.rm)(dir, { recursive: true, force: true })];
            case 4:
                _a.sent();
                return [7 /*endfinally*/];
            case 5: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("captureManifestRef hashes the public catalog and is absent otherwise", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, _a, ref;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-refs-manifest-"))];
            case 1:
                dir = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 7, 9]);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, substrate_1.captureManifestRef)(dir)];
            case 3:
                _a.apply(void 0, [_b.sent()]).toBeUndefined();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(dir, ".natalia"), { recursive: true })];
            case 4:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(dir, ".natalia", "models-dev-catalog.json"), JSON.stringify({ models: ["a"] }))];
            case 5:
                _b.sent();
                return [4 /*yield*/, (0, substrate_1.captureManifestRef)(dir)];
            case 6:
                ref = _b.sent();
                (0, bun_test_1.expect)(ref).toMatch(/^models-dev-catalog:[0-9a-f]+$/u);
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, (0, promises_1.rm)(dir, { recursive: true, force: true })];
            case 8:
                _b.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("buildEvidenceRecorded carries the repository refs", function () {
    var event = (0, governance_ledger_1.buildEvidenceRecorded)({
        id: "evidence:1",
        taskID: "task-1",
        objective: "ship it",
        status: "validated",
        repositoryVersion: "0.0.0-m13",
        commit: "abcdef0123456789",
        manifestRef: "models-dev-catalog:deadbeef",
    });
    (0, bun_test_1.expect)(event).toMatchObject({
        repositoryVersion: "0.0.0-m13",
        commit: "abcdef0123456789",
        manifestRef: "models-dev-catalog:deadbeef",
    });
    // Omitting them keeps the event clean (no empty strings).
    var bare = (0, governance_ledger_1.buildEvidenceRecorded)({
        id: "evidence:2",
        taskID: "task-1",
        objective: "ship it",
        status: "validated",
    });
    (0, bun_test_1.expect)("repositoryVersion" in bare).toBe(false);
    (0, bun_test_1.expect)("commit" in bare).toBe(false);
    (0, bun_test_1.expect)("manifestRef" in bare).toBe(false);
});
(0, bun_test_1.test)("captureRepositoryRefFields spreads the version and commit only when present", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, bare, repo, fields;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-refs-fields-"))];
            case 1:
                dir = _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 3, 5]);
                bare = (0, substrate_1.captureRepositoryRefFields)(dir);
                (0, bun_test_1.expect)(bare).toEqual({});
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, (0, promises_1.rm)(dir, { recursive: true, force: true })];
            case 4:
                _a.sent();
                return [7 /*endfinally*/];
            case 5: return [4 /*yield*/, makeGitRepo()];
            case 6:
                repo = _a.sent();
                if (!repo)
                    return [2 /*return*/]; // git unavailable in this environment
                _a.label = 7;
            case 7:
                _a.trys.push([7, , 8, 10]);
                fields = (0, substrate_1.captureRepositoryRefFields)(repo);
                (0, bun_test_1.expect)(fields.commit).toMatch(/^[0-9a-f]{40}$/u);
                return [3 /*break*/, 10];
            case 8: return [4 /*yield*/, (0, promises_1.rm)(repo, { recursive: true, force: true })];
            case 9:
                _a.sent();
                return [7 /*endfinally*/];
            case 10: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("captureRepositoryEvidenceFields unions the sync refs with the manifest ref", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, fields;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-refs-evidence-"))];
            case 1:
                dir = _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 6, 8]);
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(dir, ".natalia"), { recursive: true })];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(dir, ".natalia", "models-dev-catalog.json"), JSON.stringify({ models: ["a"] }))];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, substrate_1.captureRepositoryEvidenceFields)(dir)];
            case 5:
                fields = _a.sent();
                (0, bun_test_1.expect)(fields.manifestRef).toMatch(/^models-dev-catalog:[0-9a-f]+$/u);
                // No git repo: commit stays absent rather than an empty string.
                (0, bun_test_1.expect)("commit" in fields).toBe(false);
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, (0, promises_1.rm)(dir, { recursive: true, force: true })];
            case 7:
                _a.sent();
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
