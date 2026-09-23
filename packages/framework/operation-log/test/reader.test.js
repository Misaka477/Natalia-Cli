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
var index_1 = require("../src/index");
var base = "";
(0, bun_test_1.beforeAll)(function () {
    base = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "operation-reader-"));
});
(0, bun_test_1.afterAll)(function () {
    (0, node_fs_1.rmSync)(base, { recursive: true, force: true });
});
(0, bun_test_1.test)("the read side filters like the unified query and reads rotated files", function () { return __awaiter(void 0, void 0, void 0, function () {
    var dir, log, index, component, level, all, activeOnly, severe, collab, seq27, tail, future;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                dir = (0, node_path_1.join)(base, "logs");
                log = (0, index_1.createOperationLog)({
                    dir: dir,
                    maxBytes: 400,
                    keep: 3,
                    level: "trace",
                });
                for (index = 0; index < 30; index += 1) {
                    component = index % 2 === 0 ? "collab" : "shutdown";
                    level = index % 5 === 0 ? "error" : index % 3 === 0 ? "warn" : "info";
                    log.component(component)[level]("message ".concat(index), { seq: index });
                }
                return [4 /*yield*/, log.flush()];
            case 1:
                _a.sent();
                all = (0, index_1.readOperationRecords)(dir);
                // keep is a BOUND: 30 written, only the retained tail is readable — the
                // reader spans active + rotated, and retention actually bites.
                (0, bun_test_1.expect)(log.stats().rotated).toBeGreaterThan(0);
                (0, bun_test_1.expect)(all.length).toBeGreaterThan(0);
                (0, bun_test_1.expect)(all.length).toBeLessThan(30);
                (0, bun_test_1.expect)(all.map(function (record) { return record.message; })).toContain("message 29");
                activeOnly = (0, node_fs_1.readFileSync)((0, node_path_1.join)(dir, "operations.jsonl"), "utf8")
                    .split("\n")
                    .filter(Boolean);
                (0, bun_test_1.expect)(all.length).toBeGreaterThan(activeOnly.length);
                severe = (0, index_1.readOperationRecords)(dir, { level: "warn" });
                (0, bun_test_1.expect)(severe.every(function (record) { return record.level === "warn" || record.level === "error"; })).toBe(true);
                (0, bun_test_1.expect)(severe.length).toBeLessThan(30);
                collab = (0, index_1.readOperationRecords)(dir, { component: "collab" });
                (0, bun_test_1.expect)(collab.every(function (record) { return record.component === "collab"; })).toBe(true);
                seq27 = (0, index_1.readOperationRecords)(dir, { contains: '"seq":27' });
                (0, bun_test_1.expect)(seq27).toHaveLength(1);
                tail = (0, index_1.readOperationRecords)(dir, { limit: 5 });
                (0, bun_test_1.expect)(tail).toHaveLength(5);
                (0, bun_test_1.expect)(tail.at(-1)).toMatchObject({ message: "message 29" });
                future = (0, index_1.readOperationRecords)(dir, {
                    since: "2999-01-01T00:00:00.000Z",
                });
                (0, bun_test_1.expect)(future).toHaveLength(0);
                return [4 /*yield*/, log.close()];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
