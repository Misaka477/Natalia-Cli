"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var rina_1 = require("@natalia/rina");
var read_cache_1 = require("../src/runtime/tool-execution/read-cache");
/**
 * The pipeline wrap (RINA study's L1 insertion): the classification decides
 * who is cached, the fabric decides hit/miss, and without a fabric every
 * tool runs — caching may save work, it may never become a correctness
 * dependency.
 */
function counting() {
    var _this = this;
    var runs = 0;
    return {
        execute: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                runs += 1;
                return [2 /*return*/, "content"];
            });
        }); },
        executions: function () { return runs; },
    };
}
function fabric() {
    var instance = (0, rina_1.createCacheFabric)();
    for (var _i = 0, L1_CACHE_KINDS_1 = rina_1.L1_CACHE_KINDS; _i < L1_CACHE_KINDS_1.length; _i++) {
        var kind = L1_CACHE_KINDS_1[_i];
        instance.registerKind(kind);
    }
    return instance;
}
(0, bun_test_1.test)("the key is stable across property order at every depth", function () {
    (0, bun_test_1.expect)((0, read_cache_1.stableCacheKey)({ b: 1, a: [{ y: 2, x: 3 }] })).toBe((0, read_cache_1.stableCacheKey)({ a: [{ x: 3, y: 2 }], b: 1 }));
    (0, bun_test_1.expect)((0, read_cache_1.stableCacheKey)({ path: "/a" })).not.toBe((0, read_cache_1.stableCacheKey)({ path: "/b" }));
});
(0, bun_test_1.test)("a classified tool executes once; repeats serve from the fabric", function () { return __awaiter(void 0, void 0, void 0, function () {
    var cache, work, dir, path, parsed, first, second, metrics;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                cache = fabric();
                work = counting();
                dir = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "read-cache-"));
                path = (0, node_path_1.join)(dir, "index.ts");
                (0, node_fs_1.writeFileSync)(path, "content");
                parsed = { path: path };
                return [4 /*yield*/, (0, read_cache_1.executeWithReadCache)({
                        fabric: cache,
                        toolName: "read_file",
                        parsed: parsed,
                        execute: work.execute,
                    })];
            case 1:
                first = _a.sent();
                return [4 /*yield*/, (0, read_cache_1.executeWithReadCache)({
                        fabric: cache,
                        toolName: "read_file",
                        // Equal inputs in a different property order must share the key.
                        parsed: { path: path },
                        execute: work.execute,
                    })];
            case 2:
                second = _a.sent();
                (0, bun_test_1.expect)(first).toBe("content");
                (0, bun_test_1.expect)(second).toBe("content");
                (0, bun_test_1.expect)(work.executions()).toBe(1);
                metrics = cache.metrics("tool.fs-read")["tool.fs-read"];
                (0, bun_test_1.expect)(metrics.misses).toBe(1);
                (0, bun_test_1.expect)(metrics.hits).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("unclassified tools and a missing fabric always execute", function () { return __awaiter(void 0, void 0, void 0, function () {
    var cache, work, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                cache = fabric();
                work = counting();
                // run_shell is on no list: every call runs (and it is the opaque writer
                // that flushes trees, not a candidate for caching).
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, read_cache_1.executeWithReadCache)({
                        fabric: cache,
                        toolName: "run_shell",
                        parsed: { command: "echo hi" },
                        execute: work.execute,
                    })];
            case 1:
                // run_shell is on no list: every call runs (and it is the opaque writer
                // that flushes trees, not a candidate for caching).
                _a.apply(void 0, [_c.sent()]).toBe("content");
                (0, bun_test_1.expect)(work.executions()).toBe(1);
                // No fabric provided (tests, partial runtimes): still runs.
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, read_cache_1.executeWithReadCache)({
                        fabric: undefined,
                        toolName: "read_file",
                        parsed: { path: "x" },
                        execute: work.execute,
                    })];
            case 2:
                // No fabric provided (tests, partial runtimes): still runs.
                _b.apply(void 0, [_c.sent()]).toBe("content");
                (0, bun_test_1.expect)(work.executions()).toBe(2);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the classification list matches the study's split", function () {
    // fs-read/glob/search are cacheable; shell/web/ask/todo/process are not —
    // the wrap consults exactly READ_CACHE_TOOL_KINDS, so absence is the rule.
    (0, bun_test_1.expect)(__assign({}, rina_1.READ_CACHE_TOOL_KINDS)).toEqual({
        read_file: "tool.fs-read",
        glob: "tool.glob",
        grep: "tool.search",
    });
    (0, bun_test_1.expect)(rina_1.READ_CACHE_TOOL_KINDS.run_shell).toBeUndefined();
    (0, bun_test_1.expect)(rina_1.READ_CACHE_TOOL_KINDS.run_natalia_ask).toBeUndefined();
});
var scratch = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "read-cache-cleanup-"));
(0, bun_test_1.afterAll)(function () {
    (0, node_fs_1.rmSync)(scratch, { recursive: true, force: true });
});
