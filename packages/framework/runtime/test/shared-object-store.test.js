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
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var object_store_1 = require("@natalia/object-store");
var checkpoint_1 = require("../src/checkpoint");
var context_1 = require("../src/context");
var sandbox_1 = require("@anthelia/sandbox");
var sha = function (content) {
    return (0, node_crypto_1.createHash)("sha256").update(content).digest("hex");
};
(0, bun_test_1.test)("checkpoint and the sandbox share one content-addressed object library", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, objects, ledger, store, sandbox, manifest, objectID, _a, _b, records, lastManifest, checkpointHash;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-shared-objects-"))];
            case 1:
                root = _c.sent();
                objects = new object_store_1.ObjectStore((0, node_path_1.join)(root, ".natalia", "objects"));
                // The checkpoint snapshots a workspace file.
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "work"), { recursive: true })];
            case 2:
                // The checkpoint snapshots a workspace file.
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "work", "same.txt"), "identical content\n")];
            case 3:
                _c.sent();
                ledger = new context_1.ContextLedger();
                return [4 /*yield*/, checkpoint_1.CheckpointStore.open({
                        sessionID: "ses_shared",
                        workspaceRoot: root,
                    })];
            case 4:
                store = _c.sent();
                return [4 /*yield*/, store.createCheckpoint({ reason: "manual", context: ledger, step: 1 })];
            case 5:
                _c.sent();
                sandbox = new sandbox_1.SnapshotSandboxManager(root);
                return [4 /*yield*/, sandbox.initialize()];
            case 6:
                _c.sent();
                return [4 /*yield*/, sandbox.create("snap.1")];
            case 7:
                manifest = _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(manifest.root, "same.txt"), "identical content\n")];
            case 8:
                _c.sent();
                return [4 /*yield*/, sandbox.previewMerge("snap.1")];
            case 9:
                _c.sent();
                objectID = sha("identical content\n");
                _a = bun_test_1.expect;
                return [4 /*yield*/, objects.has(objectID)];
            case 10:
                _a.apply(void 0, [_c.sent()]).toBe(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, objects.list()];
            case 11:
                _b.apply(void 0, [(_c.sent()).filter(function (id) { return id === objectID; })]).toHaveLength(1);
                return [4 /*yield*/, store.list()];
            case 12:
                records = _c.sent();
                return [4 /*yield*/, store.loadManifest(records.at(-1))];
            case 13:
                lastManifest = _c.sent();
                checkpointHash = Object.values(lastManifest.entries)[0].objectHash;
                (0, bun_test_1.expect)(checkpointHash).toBe(objectID);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("checkpoint GC preserves the sandbox's live objects via extra reachability", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, objects, sandbox, manifest, ledger, store, applied, _a, _b, _c, _d, without;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-shared-gc-"))];
            case 1:
                root = _e.sent();
                objects = new object_store_1.ObjectStore((0, node_path_1.join)(root, ".natalia", "objects"));
                sandbox = new sandbox_1.SnapshotSandboxManager(root);
                return [4 /*yield*/, sandbox.initialize()];
            case 2:
                _e.sent();
                return [4 /*yield*/, sandbox.create("keep.1")];
            case 3:
                manifest = _e.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(manifest.root, "keep.txt"), "sandbox content\n")];
            case 4:
                _e.sent();
                return [4 /*yield*/, sandbox.previewMerge("keep.1")];
            case 5:
                _e.sent();
                ledger = new context_1.ContextLedger();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "work"), { recursive: true })];
            case 6:
                _e.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "work", "other.txt"), "checkpoint content\n")];
            case 7:
                _e.sent();
                return [4 /*yield*/, checkpoint_1.CheckpointStore.open({
                        sessionID: "ses_shared_gc",
                        workspaceRoot: root,
                    })];
            case 8:
                store = _e.sent();
                return [4 /*yield*/, store.createCheckpoint({ reason: "manual", context: ledger, step: 1 })];
            case 9:
                _e.sent();
                _b = (_a = store).gcObjects;
                _c = [false];
                return [4 /*yield*/, sandbox.referencedObjectIDs()];
            case 10: return [4 /*yield*/, _b.apply(_a, _c.concat([_e.sent()]))];
            case 11:
                applied = _e.sent();
                (0, bun_test_1.expect)(applied.unreachableObjects).toBe(0);
                _d = bun_test_1.expect;
                return [4 /*yield*/, objects.has(sha("sandbox content\n"))];
            case 12:
                _d.apply(void 0, [_e.sent()]).toBe(true);
                return [4 /*yield*/, store.gcObjects(true)];
            case 13:
                without = _e.sent();
                (0, bun_test_1.expect)(without.unreachableObjects).toBeGreaterThan(0);
                return [2 /*return*/];
        }
    });
}); });
