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
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
function makeStore() {
    return __awaiter(this, void 0, void 0, function () {
        var root, ledger, store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-audit-rounds-"))];
                case 1:
                    root = _a.sent();
                    ledger = new src_1.ContextLedger();
                    ledger.add({ id: "user", role: "user", content: "start" });
                    return [4 /*yield*/, (0, src_1.initializeDefaultCheckpointStore)({
                            sessionID: "ses_audit_rounds",
                            workspaceRoot: root,
                            context: ledger,
                        })];
                case 2:
                    store = _a.sent();
                    return [2 /*return*/, { root: root, ledger: ledger, store: store }];
            }
        });
    });
}
(0, bun_test_1.test)("audit round checkpoints are listed and diffable across rounds", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, ledger, store, round1, round2, current, between, _b, auditRecords;
    var _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, makeStore()];
            case 1:
                _a = _f.sent(), root = _a.root, ledger = _a.ledger, store = _a.store;
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src.txt"), "one\n")];
            case 2:
                _f.sent();
                ledger.add({ id: "a1", role: "assistant", content: "write one" });
                return [4 /*yield*/, store.createAuditRoundCheckpoint({
                        planID: "plan_rounds",
                        round: 1,
                        verdict: "gaps",
                        context: ledger,
                        step: ledger.journalStatus().messageCount,
                        sessionID: "ses_audit_rounds",
                    })];
            case 3:
                round1 = _f.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src.txt"), "one\ntwo\n")];
            case 4:
                _f.sent();
                ledger.add({ id: "a2", role: "assistant", content: "write two" });
                return [4 /*yield*/, store.createAuditRoundCheckpoint({
                        planID: "plan_rounds",
                        round: 2,
                        verdict: "gaps",
                        context: ledger,
                        step: ledger.journalStatus().messageCount,
                        sessionID: "ses_audit_rounds",
                    })];
            case 5:
                round2 = _f.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "src.txt"), "one\ntwo\nthree\n")];
            case 6:
                _f.sent();
                return [4 /*yield*/, store.diffCheckpoints({ kind: "round", planID: "plan_rounds", round: 2 }, { kind: "current" })];
            case 7:
                current = _f.sent();
                return [4 /*yield*/, store.diffCheckpoints({ kind: "round", planID: "plan_rounds", round: 1 }, { kind: "round", planID: "plan_rounds", round: 2 })];
            case 8:
                between = _f.sent();
                (0, bun_test_1.expect)(round1.reason).toBe("audit_round");
                (0, bun_test_1.expect)(round2.metadata).toMatchObject({
                    kind: "audit_round",
                    planID: "plan_rounds",
                    round: 2,
                });
                _b = bun_test_1.expect;
                return [4 /*yield*/, store.listAuditRounds("plan_rounds")];
            case 9:
                _b.apply(void 0, [_f.sent()]).toEqual([
                    bun_test_1.expect.objectContaining({ round: 1, verdict: "gaps" }),
                    bun_test_1.expect.objectContaining({ round: 2, verdict: "gaps" }),
                ]);
                return [4 /*yield*/, store.listCheckpointsByKind("audit")];
            case 10:
                auditRecords = _f.sent();
                (0, bun_test_1.expect)(auditRecords.map(function (record) { return record.reason; })).toEqual(bun_test_1.expect.arrayContaining(["baseline", "audit_round", "audit_round"]));
                (0, bun_test_1.expect)(between).toHaveLength(1);
                (0, bun_test_1.expect)((_c = between[0]) === null || _c === void 0 ? void 0 : _c.path).toBe("src.txt");
                (0, bun_test_1.expect)((_d = between[0]) === null || _d === void 0 ? void 0 : _d.operation).toBe("modified");
                (0, bun_test_1.expect)(current).toHaveLength(1);
                (0, bun_test_1.expect)((_e = current[0]) === null || _e === void 0 ? void 0 : _e.after).toContain("three");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("duplicate audit round is rejected", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, ledger, store, input;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, makeStore()];
            case 1:
                _a = _b.sent(), ledger = _a.ledger, store = _a.store;
                input = {
                    planID: "plan_rounds",
                    round: 1,
                    verdict: "passed",
                    context: ledger,
                    step: 1,
                    sessionID: "ses_audit_rounds",
                };
                return [4 /*yield*/, store.createAuditRoundCheckpoint(input)];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(store.createAuditRoundCheckpoint(input)).rejects.toThrow(/audit round already exists/u)];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
