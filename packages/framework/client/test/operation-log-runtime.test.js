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
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
var e2e_harness_1 = require("./e2e-harness");
var main_1 = require("../src/runtime/main");
/**
 * The operation log wired through the runtime (interface spec §4.5): a
 * real turn lands records in the configured directory, and — the point of
 * record-side injection — a turn-scoped record carries sessionID+turnID
 * that NO call site passed.
 */
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var scratch = "";
(0, bun_test_1.beforeAll)(function () {
    scratch = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "operation-log-runtime-"));
});
(0, bun_test_1.afterAll)(function () {
    (0, node_fs_1.rmSync)(scratch, { recursive: true, force: true });
});
(0, bun_test_1.test)("a real turn writes correlated records to the configured log", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, logDir, events, sessionID, client, path, records, _i, records_1, record, correlated;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("operation-log-runtime")];
            case 1:
                root = _b.sent();
                logDir = (0, node_path_1.join)(scratch, "logs");
                events = [];
                sessionID = "ses_oplog_runtime";
                client = (0, main_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    permissionMode: "auto",
                    operationLogsDir: logDir,
                    provider: (0, e2e_harness_1.createScriptedProvider)({ main: [{ text: "ok" }] }),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("hello runtime")];
            case 3:
                _b.sent();
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 4:
                _b.sent(); // dispose drains the log (close -> flush)
                path = (0, node_path_1.join)(logDir, "operations.jsonl");
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(path)).toBe(true);
                records = (0, node_fs_1.readFileSync)(path, "utf8")
                    .split("\n")
                    .filter(Boolean)
                    .map(function (line) {
                    return JSON.parse(line);
                });
                (0, bun_test_1.expect)(records.length).toBeGreaterThan(0);
                // Every record is schema-shaped (the journal's discipline, ported).
                for (_i = 0, records_1 = records; _i < records_1.length; _i++) {
                    record = records_1[_i];
                    (0, bun_test_1.expect)(typeof record.level).toBe("string");
                    (0, bun_test_1.expect)(typeof record.component).toBe("string");
                    (0, bun_test_1.expect)(typeof record.message).toBe("string");
                }
                correlated = records.filter(function (record) { var _a, _b; return ((_a = record.corr) === null || _a === void 0 ? void 0 : _a.sessionID) && ((_b = record.corr) === null || _b === void 0 ? void 0 : _b.turnID); });
                (0, bun_test_1.expect)(correlated.length).toBeGreaterThan(0);
                (0, bun_test_1.expect)(correlated[0].corr.sessionID).toBe("ses_oplog_runtime");
                (0, bun_test_1.expect)(correlated[0].corr.turnID).toMatch(/^turn_/u);
                return [2 /*return*/];
        }
    });
}); }, 60000);
