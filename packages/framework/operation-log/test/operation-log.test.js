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
/**
 * The operation-log layer (decisions §5 + interface spec §4.5): records
 * whose correlation arrives on the record side, one redaction exit, and a
 * telemetry facility that degrades instead of ever throwing.
 */
var base = "";
(0, bun_test_1.beforeAll)(function () {
    base = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "operation-log-"));
});
(0, bun_test_1.afterAll)(function () {
    (0, node_fs_1.rmSync)(base, { recursive: true, force: true });
});
function dir(name) {
    var path = (0, node_path_1.join)(base, name);
    (0, node_fs_1.mkdirSync)(path, { recursive: true });
    return path;
}
function records(path) {
    return __awaiter(this, void 0, void 0, function () {
        var log;
        return __generator(this, function (_a) {
            log = (0, node_path_1.join)(path, "operations.jsonl");
            if (!(0, node_fs_1.existsSync)(log))
                return [2 /*return*/, []];
            return [2 /*return*/, (0, node_fs_1.readFileSync)(log, "utf8")
                    .split("\n")
                    .filter(Boolean)
                    .map(function (line) { return JSON.parse(line); })];
        });
    });
}
(0, bun_test_1.test)("records are JSONL with level, component, message and fields", function () { return __awaiter(void 0, void 0, void 0, function () {
    var path, log, record;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                path = dir("shape");
                log = (0, index_1.createOperationLog)({ dir: path });
                log.component("wake").info("admitted", { sessionID: "ses_1", round: 2 });
                return [4 /*yield*/, log.flush()];
            case 1:
                _a.sent();
                return [4 /*yield*/, records(path)];
            case 2:
                record = (_a.sent())[0];
                (0, bun_test_1.expect)(record).toMatchObject({
                    level: "info",
                    component: "wake",
                    message: "admitted",
                    fields: { sessionID: "ses_1", round: 2 },
                });
                (0, bun_test_1.expect)(typeof record.at).toBe("string");
                return [4 /*yield*/, log.close()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the level gate is the primary retention", function () { return __awaiter(void 0, void 0, void 0, function () {
    var path, log, lines, verbose, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                path = dir("levels");
                log = (0, index_1.createOperationLog)({ dir: path });
                log.component("x").debug("invisible");
                log.component("x").trace("also invisible");
                log.component("x").warn("kept");
                log.component("x").error("kept too");
                return [4 /*yield*/, log.flush()];
            case 1:
                _b.sent();
                return [4 /*yield*/, records(path)];
            case 2:
                lines = _b.sent();
                (0, bun_test_1.expect)(lines.map(function (line) { return line.level; })).toEqual(["warn", "error"]);
                return [4 /*yield*/, log.close()];
            case 3:
                _b.sent();
                verbose = (0, index_1.createOperationLog)({ dir: dir("levels2"), level: "trace" });
                verbose.component("x").debug("now visible");
                return [4 /*yield*/, verbose.flush()];
            case 4:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, records(dir("levels2"))];
            case 5:
                _a.apply(void 0, [(_b.sent()).map(function (line) { return line.level; })]).toEqual([
                    "debug",
                ]);
                return [4 /*yield*/, verbose.close()];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("correlation is injected on the record side and merges through nests", function () { return __awaiter(void 0, void 0, void 0, function () {
    var path, log, outside, byMessage, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                path = dir("corr");
                log = (0, index_1.createOperationLog)({ dir: path });
                outside = log.component("outside");
                outside.info("no ids here"); // outside any scope: no corr at all
                log.runWithCorrelation({ sessionID: "ses_a" }, function () {
                    log.component("turn").info("started");
                    log.runWithCorrelation({ turnID: "turn_b" }, function () {
                        // The record side accumulates — no call site passed either id.
                        log.component("tool").info("running");
                        // A bound override wins over the ambient bag.
                        log
                            .component("tool")
                            .withCorrelation({ toolCallID: "call_1" })
                            .info("with tool id");
                    });
                });
                return [4 /*yield*/, log.flush()];
            case 1:
                _b.sent();
                _a = Map.bind;
                return [4 /*yield*/, records(path)];
            case 2:
                byMessage = new (_a.apply(Map, [void 0, (_b.sent()).map(function (record) { return [record.message, record.corr]; })]))();
                (0, bun_test_1.expect)(byMessage.get("no ids here")).toBeUndefined();
                (0, bun_test_1.expect)(byMessage.get("started")).toEqual({ sessionID: "ses_a" });
                (0, bun_test_1.expect)(byMessage.get("running")).toEqual({
                    sessionID: "ses_a",
                    turnID: "turn_b",
                });
                (0, bun_test_1.expect)(byMessage.get("with tool id")).toEqual({
                    sessionID: "ses_a",
                    turnID: "turn_b",
                    toolCallID: "call_1",
                });
                return [4 /*yield*/, log.close()];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("rotation keeps a bounded tail", function () { return __awaiter(void 0, void 0, void 0, function () {
    var path, log, index, files;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                path = dir("rotate");
                log = (0, index_1.createOperationLog)({ dir: path, maxBytes: 400, keep: 2 });
                for (index = 0; index < 40; index += 1)
                    log.component("bulk").info("record ".concat(index));
                return [4 /*yield*/, log.flush()];
            case 1:
                _a.sent();
                files = (0, node_fs_1.readdirSync)(path).sort();
                (0, bun_test_1.expect)(files).toContain("operations.jsonl");
                (0, bun_test_1.expect)(files).toContain("operations.jsonl.1");
                (0, bun_test_1.expect)(files).toContain("operations.jsonl.2");
                (0, bun_test_1.expect)(files).not.toContain("operations.jsonl.3"); // keep = 2
                (0, bun_test_1.expect)(log.stats().rotated).toBeGreaterThan(0);
                return [4 /*yield*/, log.close()];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an unwritable directory disables telemetry without throwing", function () { return __awaiter(void 0, void 0, void 0, function () {
    var path, log, stats;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                path = dir("readonly");
                (0, node_fs_1.chmodSync)(path, 320);
                _a.label = 1;
            case 1:
                _a.trys.push([1, , 4, 5]);
                log = (0, index_1.createOperationLog)({ dir: (0, node_path_1.join)(path, "nested") });
                log.component("x").error("must not throw");
                return [4 /*yield*/, log.flush()];
            case 2:
                _a.sent();
                stats = log.stats();
                (0, bun_test_1.expect)(stats.written).toBe(0);
                (0, bun_test_1.expect)(stats.disabledReason).toBeTruthy();
                return [4 /*yield*/, log.close()];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                (0, node_fs_1.chmodSync)(path, 448);
                return [7 /*endfinally*/];
            case 5: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("redaction is the single exit — fields pass through it too", function () { return __awaiter(void 0, void 0, void 0, function () {
    var path, log, raw;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                path = dir("redact");
                log = (0, index_1.createOperationLog)({
                    dir: path,
                    redact: function (line) { return line.replaceAll("hunter2", "[redacted]"); },
                });
                log.component("config").warn("api key", { key: "hunter2" });
                return [4 /*yield*/, log.flush()];
            case 1:
                _a.sent();
                raw = (0, node_fs_1.readFileSync)((0, node_path_1.join)(path, "operations.jsonl"), "utf8");
                (0, bun_test_1.expect)(raw).not.toContain("hunter2");
                (0, bun_test_1.expect)(raw).toContain("[redacted]");
                return [4 /*yield*/, log.close()];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("records keep their order through the async chain", function () { return __awaiter(void 0, void 0, void 0, function () {
    var path, log, index, messages;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                path = dir("order");
                log = (0, index_1.createOperationLog)({ dir: path });
                for (index = 0; index < 50; index += 1)
                    log.component("seq").info("m".concat(index));
                return [4 /*yield*/, log.flush()];
            case 1:
                _a.sent();
                return [4 /*yield*/, records(path)];
            case 2:
                messages = (_a.sent()).map(function (record) { return record.message; });
                (0, bun_test_1.expect)(messages).toHaveLength(50);
                (0, bun_test_1.expect)(messages[0]).toBe("m0");
                (0, bun_test_1.expect)(messages[49]).toBe("m49");
                return [4 /*yield*/, log.close()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("logOf falls back to the no-op log — telemetry degrades, never crashes", function () {
    var log = (0, index_1.logOf)({ getOptional: function () { return undefined; } });
    (0, bun_test_1.expect)(function () {
        log.component("bare").error("somewhere without a runtime");
        log.runWithCorrelation({ sessionID: "ses" }, function () {
            return log.component("bare").info("still fine");
        });
    }).not.toThrow();
    (0, bun_test_1.expect)((0, index_1.logOf)({ getOptional: function () { return index_1.noopOperationLog; } })).toBe(index_1.noopOperationLog);
    (0, bun_test_1.expect)(index_1.noopOperationLog.stats().disabledReason).toBeTruthy();
});
