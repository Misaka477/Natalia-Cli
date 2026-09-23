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
var src_1 = require("../src");
var src_2 = require("../src");
(0, bun_test_1.test)("workspace framework services construct and release their resources", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, mutations, files, writeLock, release, found;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-services-"))];
            case 1:
                root = _a.sent();
                mutations = (0, src_2.createMutationRegistry)();
                files = (0, src_2.createWorkspaceFilesController)({
                    workspaceRoot: root,
                    listPaths: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, ["main.ts"]];
                    }); }); },
                    resolveMutation: function (path) {
                        var mutation = mutations.match({ path: path, operation: "modified" });
                        if (!mutation)
                            return undefined;
                        var identity = {
                            origin: mutation.operationID ? "sandbox_merge" : "tool",
                        };
                        if (mutation.turnID)
                            identity.turnID = mutation.turnID;
                        if (mutation.callID)
                            identity.callID = mutation.callID;
                        if (mutation.operationID)
                            identity.operationID = mutation.operationID;
                        if (mutation.sessionID)
                            identity.sessionID = mutation.sessionID;
                        if (mutation.episodeID)
                            identity.episodeID = mutation.episodeID;
                        return identity;
                    },
                });
                writeLock = (0, src_2.createWorkspaceWriteLock)();
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 8, 10]);
                (0, bun_test_1.expect)(src_1.workspaceWriteLock.id).toBe("workspace.writeLock");
                (0, bun_test_1.expect)(src_1.workspaceMutations.id).toBe("workspace.mutations");
                (0, bun_test_1.expect)(src_1.workspaceFiles.id).toBe("workspace.files");
                return [4 /*yield*/, files.init()];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(files.observationStatus()).toMatchObject({
                    health: "healthy",
                });
                return [4 /*yield*/, writeLock.acquire()];
            case 4:
                release = _a.sent();
                (0, bun_test_1.expect)(release).toBeTypeOf("function");
                release();
                mutations.register({
                    callID: "call-1",
                    toolName: "edit_file",
                    authorizedPaths: ["main.ts"],
                    expectedOperations: ["modified"],
                });
                (0, bun_test_1.expect)(mutations.match({ path: "main.ts", operation: "modified" })).toMatchObject({ callID: "call-1" });
                mutations.settle("call-1");
                (0, bun_test_1.expect)(mutations.pendingCount()).toBe(0);
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "main.ts"), "const needle = true\n")];
            case 5:
                _a.sent();
                // The service init warms the catalog cache; make the direct read
                // deterministic instead of depending on fs.watch delivery timing.
                (0, src_2.invalidateWorkspaceFiles)(root);
                return [4 /*yield*/, (0, src_2.findWorkspaceFiles)({ workspaceRoot: root, limit: 50 })];
            case 6:
                found = _a.sent();
                (0, bun_test_1.expect)(found.map(function (file) { return file.path; })).toContain("main.ts");
                return [4 /*yield*/, (0, bun_test_1.expect)(files.reconcile()).resolves.toBeDefined()];
            case 7:
                _a.sent();
                return [3 /*break*/, 10];
            case 8:
                files.close();
                return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 9:
                _a.sent();
                return [7 /*endfinally*/];
            case 10: return [2 /*return*/];
        }
    });
}); });
