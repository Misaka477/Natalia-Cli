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
 * The fabric's discipline, tested by observing each law break:
 * a stale hit, an unbounded store, an unclassified kind, a guessed TTL —
 * every one must be impossible, not merely unlikely.
 */
var base = "";
var workspace = "";
(0, bun_test_1.beforeAll)(function () {
    base = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rina-fabric-"));
    workspace = (0, node_path_1.join)(base, "workspace");
    (0, node_fs_1.mkdirSync)(workspace, { recursive: true });
});
(0, bun_test_1.afterAll)(function () {
    (0, node_fs_1.rmSync)(base, { recursive: true, force: true });
});
/** A fabric with the L1 kinds and a deliberately small budget for LRU tests. */
function fabric(maxBytes) {
    var instance = (0, index_1.createCacheFabric)(maxBytes ? { maxBytes: maxBytes } : {});
    for (var _i = 0, L1_CACHE_KINDS_1 = index_1.L1_CACHE_KINDS; _i < L1_CACHE_KINDS_1.length; _i++) {
        var kind = L1_CACHE_KINDS_1[_i];
        instance.registerKind(kind);
    }
    return instance;
}
function file(name, content) {
    var path = (0, node_path_1.join)(workspace, name);
    (0, node_fs_1.writeFileSync)(path, content);
    return { path: path, key: JSON.stringify({ path: path }) };
}
(0, bun_test_1.test)("the L1 classification is the explicit list", function () { return __awaiter(void 0, void 0, void 0, function () {
    var instance;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                instance = fabric();
                (0, bun_test_1.expect)(instance.hasKind("tool.fs-read")).toBe(true);
                (0, bun_test_1.expect)(instance.hasKind("tool.glob")).toBe(true);
                (0, bun_test_1.expect)(instance.hasKind("tool.search")).toBe(true);
                // An unlisted kind does not exist for the fabric: compute throws rather
                // than silently running through (law 1 would be decorative otherwise).
                return [4 /*yield*/, (0, bun_test_1.expect)(instance.compute("tool.web", "k", function () { return "v"; })).rejects.toThrow(/unknown cache kind/u)];
            case 1:
                // An unlisted kind does not exist for the fabric: compute throws rather
                // than silently running through (law 1 would be decorative otherwise).
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("path-scoped kinds must carry evidence (registration enforces it)", function () {
    var instance = (0, index_1.createCacheFabric)();
    var captureOnly = {
        id: "bad.capture-only",
        deterministic: true,
        invalidation: "path",
        captureEvidence: function (key) { return ({ path: key }); },
    };
    (0, bun_test_1.expect)(function () { return instance.registerKind(captureOnly); }).toThrow(/validate evidence/u);
    var noEvidence = {
        id: "bad.no-evidence",
        deterministic: true,
        invalidation: "path",
    };
    (0, bun_test_1.expect)(function () { return instance.registerKind(noEvidence); }).toThrow(/written file/u);
    var partial = {
        id: "bad.validate-only",
        deterministic: true,
        invalidation: "tree",
        validEvidence: function () { return true; },
    };
    (0, bun_test_1.expect)(function () { return instance.registerKind(partial); }).toThrow(/together/u);
    instance.registerKind(index_1.toolGlobKind);
    (0, bun_test_1.expect)(function () { return instance.registerKind(index_1.toolGlobKind); }).toThrow(/duplicate/u);
});
(0, bun_test_1.test)("a miss computes once, a hit serves without computing", function () { return __awaiter(void 0, void 0, void 0, function () {
    var instance, key, computed, compute, _a, _b, metrics;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                instance = fabric();
                key = file("a.txt", "alpha").key;
                computed = 0;
                compute = function () {
                    computed += 1;
                    return "alpha";
                };
                _a = bun_test_1.expect;
                return [4 /*yield*/, instance.compute("tool.fs-read", key, compute)];
            case 1:
                _a.apply(void 0, [_c.sent()]).toBe("alpha");
                _b = bun_test_1.expect;
                return [4 /*yield*/, instance.compute("tool.fs-read", key, compute)];
            case 2:
                _b.apply(void 0, [_c.sent()]).toBe("alpha");
                (0, bun_test_1.expect)(computed).toBe(1);
                metrics = instance.metrics("tool.fs-read")["tool.fs-read"];
                (0, bun_test_1.expect)(metrics.misses).toBe(1);
                (0, bun_test_1.expect)(metrics.hits).toBe(1);
                (0, bun_test_1.expect)(metrics.bytesServed).toBe("alpha".length);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("concurrent callers share one computation (single-flight)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var instance, key, computed, compute, _a, first, second;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                instance = fabric();
                key = file("b.txt", "beta").key;
                computed = 0;
                compute = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                computed += 1;
                                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                            case 1:
                                _a.sent();
                                return [2 /*return*/, "beta"];
                        }
                    });
                }); };
                return [4 /*yield*/, Promise.all([
                        instance.compute("tool.fs-read", key, compute),
                        instance.compute("tool.fs-read", key, compute),
                    ])];
            case 1:
                _a = _b.sent(), first = _a[0], second = _a[1];
                (0, bun_test_1.expect)(first).toBe("beta");
                (0, bun_test_1.expect)(second).toBe("beta");
                (0, bun_test_1.expect)(computed).toBe(1); // the subagent-re-reads case: one execution
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("evidence catches a write the hooks never saw (external writer)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var instance, _a, path, key, computed, compute, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                instance = fabric();
                _a = file("c.txt", "one"), path = _a.path, key = _a.key;
                computed = 0;
                compute = function () {
                    computed += 1;
                    return computed === 1 ? "one" : "two";
                };
                _b = bun_test_1.expect;
                return [4 /*yield*/, instance.compute("tool.fs-read", key, compute)];
            case 1:
                _b.apply(void 0, [_d.sent()]).toBe("one");
                // Change the file out-of-band and rewind mtime by a second: size and
                // mtimeNs still disagree with the capture, so the next call recomputes.
                (0, node_fs_1.writeFileSync)(path, "two!");
                (0, node_fs_1.utimesSync)(path, new Date(0), new Date(0));
                _c = bun_test_1.expect;
                return [4 /*yield*/, instance.compute("tool.fs-read", key, compute)];
            case 2:
                _c.apply(void 0, [_d.sent()]).toBe("two");
                (0, bun_test_1.expect)(computed).toBe(2);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a written path drops only its own entries; any write drops trees", function () { return __awaiter(void 0, void 0, void 0, function () {
    var instance, first, second, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                instance = fabric();
                first = file("d.txt", "d");
                second = file("e.txt", "e");
                return [4 /*yield*/, instance.compute("tool.fs-read", first.key, function () { return "d"; })];
            case 1:
                _b.sent();
                return [4 /*yield*/, instance.compute("tool.fs-read", second.key, function () { return "e"; })];
            case 2:
                _b.sent();
                return [4 /*yield*/, instance.compute("tool.glob", "*.md", function () { return "list"; })];
            case 3:
                _b.sent();
                return [4 /*yield*/, instance.compute("tool.search", "needle", function () { return "hits"; })];
            case 4:
                _b.sent();
                (0, bun_test_1.expect)(instance.invalidatePaths([first.path])).toBe(3); // own entry + both trees
                _a = bun_test_1.expect;
                return [4 /*yield*/, instance.compute("tool.fs-read", second.key, function () { return "E"; })];
            case 5:
                _a.apply(void 0, [_b.sent()]).toBe("e"); // untouched path still hot
                (0, bun_test_1.expect)(instance.metrics("tool.glob")["tool.glob"].entries).toBe(0);
                (0, bun_test_1.expect)(instance.metrics("tool.search")["tool.search"].entries).toBe(0);
                return [4 /*yield*/, instance.compute("tool.glob", "*.md", function () { return "list"; })];
            case 6:
                _b.sent();
                (0, bun_test_1.expect)(instance.markTreeChanged()).toBe(1);
                (0, bun_test_1.expect)(instance.metrics("tool.glob")["tool.glob"].entries).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the budget bounds the store and evicts least-recently-used", function () { return __awaiter(void 0, void 0, void 0, function () {
    var instance, metrics, recomputed;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                instance = fabric(10);
                return [4 /*yield*/, instance.compute("tool.glob", "k1", function () { return "12345"; })];
            case 1:
                _a.sent();
                return [4 /*yield*/, instance.compute("tool.glob", "k2", function () { return "67890"; })];
            case 2:
                _a.sent();
                // Touch k1 so k2 becomes least recently used.
                return [4 /*yield*/, instance.compute("tool.glob", "k1", function () { return "wrong"; })];
            case 3:
                // Touch k1 so k2 becomes least recently used.
                _a.sent();
                return [4 /*yield*/, instance.compute("tool.glob", "k3", function () { return "abcdefghij"; })];
            case 4:
                _a.sent();
                metrics = instance.metrics("tool.glob")["tool.glob"];
                (0, bun_test_1.expect)(metrics.bytes).toBeLessThanOrEqual(10);
                (0, bun_test_1.expect)(metrics.evictions).toBeGreaterThan(0);
                recomputed = false;
                return [4 /*yield*/, instance.compute("tool.glob", "k2", function () {
                        recomputed = true;
                        return "fresh";
                    })];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(recomputed).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a failed compute stores nothing and the error propagates", function () { return __awaiter(void 0, void 0, void 0, function () {
    var instance, key, caught, error_1, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                instance = fabric();
                key = file("boom.txt", "x").key;
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, instance.compute("tool.fs-read", key, function () {
                        throw new Error("read failed");
                    })];
            case 2:
                _b.sent();
                return [3 /*break*/, 4];
            case 3:
                error_1 = _b.sent();
                caught = error_1;
                return [3 /*break*/, 4];
            case 4:
                (0, bun_test_1.expect)(caught.message).toBe("read failed");
                (0, bun_test_1.expect)(instance.metrics("tool.fs-read")["tool.fs-read"].entries).toBe(0);
                // The next call recomputes rather than replaying the failure.
                _a = bun_test_1.expect;
                return [4 /*yield*/, instance.compute("tool.fs-read", key, function () { return "ok"; })];
            case 5:
                // The next call recomputes rather than replaying the failure.
                _a.apply(void 0, [_b.sent()]).toBe("ok");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("metrics are per-kind and complete", function () { return __awaiter(void 0, void 0, void 0, function () {
    var instance, key, all, fs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                instance = fabric();
                key = file("m.txt", "metrics").key;
                return [4 /*yield*/, instance.compute("tool.fs-read", key, function () { return "metrics"; })];
            case 1:
                _a.sent();
                return [4 /*yield*/, instance.compute("tool.fs-read", key, function () { return "metrics"; })];
            case 2:
                _a.sent();
                all = instance.metrics();
                (0, bun_test_1.expect)(Object.keys(all).sort()).toEqual([
                    "tool.fs-read",
                    "tool.glob",
                    "tool.search",
                ]);
                fs = all["tool.fs-read"];
                (0, bun_test_1.expect)(fs).toMatchObject({ hits: 1, misses: 1, invalidations: 0 });
                (0, bun_test_1.expect)(fs.bytes).toBeGreaterThan(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the kinds are deterministic by type (law 1, compile-enforced)", function () {
    // `deterministic: false` cannot satisfy CacheKindDefinition — this file
    // compiling at all is the assertion; the runtime checks the rest.
    var honest = {
        id: "probe",
        deterministic: true,
        invalidation: "tree",
    };
    (0, bun_test_1.expect)(honest.deterministic).toBe(true);
    (0, bun_test_1.expect)(index_1.toolFsReadKind.invalidation).toBe("path");
    (0, bun_test_1.expect)(index_1.toolSearchKind.invalidation).toBe("tree");
});
