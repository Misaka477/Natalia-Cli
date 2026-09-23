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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var src_1 = require("../src");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var e2e_harness_1 = require("./e2e-harness");
var SESSION = "ses_e2e_workgraph_integrity";
(0, bun_test_1.test)("Phase 3 E2E: work graph integrity reports a stable graph and unattributed changes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, client, integrity, before;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workgraph-integrity-e2e")];
            case 1:
                root = _b.sent();
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "standby" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                // A decision node in the graph (well-formed, with session correlation).
                return [4 /*yield*/, client.recordDecision({ decision: "append runtime context" }, SESSION)];
            case 3:
                // A decision node in the graph (well-formed, with session correlation).
                _b.sent();
                return [4 /*yield*/, client.workGraphIntegrity(SESSION)];
            case 4:
                integrity = _b.sent();
                (0, bun_test_1.expect)(integrity.nodeCount).toBeGreaterThan(0);
                (0, bun_test_1.expect)(integrity.stable).toBe(true);
                (0, bun_test_1.expect)(integrity.danglingEdges).toEqual([]);
                (0, bun_test_1.expect)(integrity.duplicateNodeIDs).toEqual([]);
                // Every node the runtime wrote carries session correlation.
                (0, bun_test_1.expect)(integrity.incompleteNodes).toEqual([]);
                return [4 /*yield*/, client.unattributedChanges(SESSION)];
            case 5:
                before = _b.sent();
                (0, bun_test_1.expect)(before).toEqual([]);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 3 E2E: an external workspace change surfaces through the unattributedChanges read surface", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, client, unattributed, integrity;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-wg-unattributed-"))];
            case 1:
                root = _b.sent();
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_1() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("hello")];
            case 3:
                _b.sent();
                // An external edit no tool claimed.
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "external-note.txt"), "written outside\n")];
            case 4:
                // An external edit no tool claimed.
                _b.sent();
                return [4 /*yield*/, Bun.sleep(400)];
            case 5:
                _b.sent();
                // The reconcile discovers it and graphs it as an isolated external node.
                return [4 /*yield*/, client.confirmedWorkspaceChanges(SESSION)];
            case 6:
                // The reconcile discovers it and graphs it as an isolated external node.
                _b.sent();
                return [4 /*yield*/, Bun.sleep(200)];
            case 7:
                _b.sent();
                return [4 /*yield*/, client.unattributedChanges(SESSION)];
            case 8:
                unattributed = _b.sent();
                (0, bun_test_1.expect)(unattributed.some(function (change) { return change.path === "external-note.txt"; })).toBe(true);
                return [4 /*yield*/, client.workGraphIntegrity(SESSION)];
            case 9:
                integrity = _b.sent();
                (0, bun_test_1.expect)(integrity.stable).toBe(true);
                (0, bun_test_1.expect)(integrity.danglingEdges).toEqual([]);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 10:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
