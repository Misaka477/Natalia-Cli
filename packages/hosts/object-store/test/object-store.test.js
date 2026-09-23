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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var src_1 = require("../src");
var native_index_1 = require("../src/native-index");
var sha256 = function (content) {
    return (0, node_crypto_1.createHash)("sha256").update(content).digest("hex");
};
function openStore(prefix) {
    return __awaiter(this, void 0, void 0, function () {
        var root;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), prefix))];
                case 1:
                    root = _a.sent();
                    return [2 /*return*/, { root: root, objects: new src_1.ObjectStore((0, node_path_1.join)(root, "objects")) }];
            }
        });
    });
}
(0, bun_test_1.test)("content-addressed store deduplicates identical blobs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var objects, id1, id2, _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, openStore("natalia-object-dedup-")];
            case 1:
                objects = (_f.sent()).objects;
                return [4 /*yield*/, objects.put("same content")];
            case 2:
                id1 = _f.sent();
                return [4 /*yield*/, objects.put("same content")];
            case 3:
                id2 = _f.sent();
                (0, bun_test_1.expect)(id1).toBe(sha256("same content"));
                (0, bun_test_1.expect)(id2).toBe(id1);
                _a = bun_test_1.expect;
                return [4 /*yield*/, objects.has(id1)];
            case 4:
                _a.apply(void 0, [_f.sent()]).toBe(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, objects.has("0000000000000000000000000000000000000000000000000000000000000000")];
            case 5:
                _b.apply(void 0, [_f.sent()]).toBe(false);
                _c = bun_test_1.expect;
                return [4 /*yield*/, objects.get(id1)];
            case 6:
                _c.apply(void 0, [(_f.sent()).toString("utf8")]).toBe("same content");
                _d = bun_test_1.expect;
                return [4 /*yield*/, objects.list()];
            case 7:
                _d.apply(void 0, [_f.sent()]).toEqual([id1]);
                return [4 /*yield*/, objects.delete(id1)];
            case 8:
                _f.sent();
                _e = bun_test_1.expect;
                return [4 /*yield*/, objects.has(id1)];
            case 9:
                _e.apply(void 0, [_f.sent()]).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("batch APIs roundtrip content and metadata", function () { return __awaiter(void 0, void 0, void 0, function () {
    var objects, ids, _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, openStore("natalia-object-batch-")];
            case 1:
                objects = (_f.sent()).objects;
                return [4 /*yield*/, objects.batchPut(["alpha", "beta", "gamma"])];
            case 2:
                ids = _f.sent();
                (0, bun_test_1.expect)(ids).toHaveLength(3);
                _a = bun_test_1.expect;
                return [4 /*yield*/, objects.batchHas(ids)];
            case 3:
                _a.apply(void 0, [_f.sent()]).toEqual([true, true, true]);
                _b = bun_test_1.expect;
                return [4 /*yield*/, objects.batchGet(ids)];
            case 4:
                _b.apply(void 0, [(_f.sent()).map(function (b) { return b === null || b === void 0 ? void 0 : b.toString("utf8"); })]).toEqual(["alpha", "beta", "gamma"]);
                return [4 /*yield*/, objects.putMeta("key:one", { ok: true, n: 1 })];
            case 5:
                _f.sent();
                _c = bun_test_1.expect;
                return [4 /*yield*/, objects.getMeta("key:one")];
            case 6:
                _c.apply(void 0, [_f.sent()]).toEqual({
                    ok: true,
                    n: 1,
                });
                return [4 /*yield*/, objects.putMeta("key:one", { ok: false, n: 2 })];
            case 7:
                _f.sent();
                _d = bun_test_1.expect;
                return [4 /*yield*/, objects.getMeta("key:one")];
            case 8:
                _d.apply(void 0, [_f.sent()]).toEqual({
                    ok: false,
                    n: 2,
                });
                return [4 /*yield*/, objects.deleteMeta("key:one")];
            case 9:
                _f.sent();
                _e = bun_test_1.expect;
                return [4 /*yield*/, objects.getMeta("key:one")];
            case 10:
                _e.apply(void 0, [_f.sent()]).toBeUndefined();
                return [4 /*yield*/, objects.vacuumMeta()];
            case 11:
                _f.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("large blobs are chunked and streamed without corruption", function () { return __awaiter(void 0, void 0, void 0, function () {
    var objects, text, id, restored, total, chunks, _a, _b, _c, chunk, e_1_1, _d;
    var _e, e_1, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0: return [4 /*yield*/, openStore("natalia-object-chunk-")];
            case 1:
                objects = (_h.sent()).objects;
                text = "0123456789abcdef".repeat(64 * 1024);
                return [4 /*yield*/, objects.put(text)];
            case 2:
                id = _h.sent();
                (0, bun_test_1.expect)(id).toBe(sha256(Buffer.from(text)));
                return [4 /*yield*/, objects.get(id)];
            case 3:
                restored = (_h.sent()).toString("utf8");
                (0, bun_test_1.expect)(restored).toBe(text);
                total = 0;
                chunks = 0;
                _h.label = 4;
            case 4:
                _h.trys.push([4, 9, 10, 15]);
                _a = true, _b = __asyncValues(objects.getStream(id));
                _h.label = 5;
            case 5: return [4 /*yield*/, _b.next()];
            case 6:
                if (!(_c = _h.sent(), _e = _c.done, !_e)) return [3 /*break*/, 8];
                _g = _c.value;
                _a = false;
                chunk = _g;
                total += chunk.byteLength;
                chunks++;
                _h.label = 7;
            case 7:
                _a = true;
                return [3 /*break*/, 5];
            case 8: return [3 /*break*/, 15];
            case 9:
                e_1_1 = _h.sent();
                e_1 = { error: e_1_1 };
                return [3 /*break*/, 15];
            case 10:
                _h.trys.push([10, , 13, 14]);
                if (!(!_a && !_e && (_f = _b.return))) return [3 /*break*/, 12];
                return [4 /*yield*/, _f.call(_b)];
            case 11:
                _h.sent();
                _h.label = 12;
            case 12: return [3 /*break*/, 14];
            case 13:
                if (e_1) throw e_1.error;
                return [7 /*endfinally*/];
            case 14: return [7 /*endfinally*/];
            case 15:
                (0, bun_test_1.expect)(total).toBe(text.length);
                (0, bun_test_1.expect)(chunks).toBeGreaterThan(1);
                _d = bun_test_1.expect;
                return [4 /*yield*/, objects.list()];
            case 16:
                _d.apply(void 0, [_h.sent()]).toContain(id);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("compact packs loose objects and keeps random reads working", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, objects, contents, ids, result, packs, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, openStore("natalia-object-pack-")];
            case 1:
                _a = _d.sent(), root = _a.root, objects = _a.objects;
                contents = Array.from({ length: 40 }, function (_, i) { return "object-".concat(i, "\n"); });
                return [4 /*yield*/, objects.batchPut(contents)];
            case 2:
                ids = _d.sent();
                return [4 /*yield*/, objects.compact()];
            case 3:
                result = _d.sent();
                (0, bun_test_1.expect)(result.packed).toBe(40);
                return [4 /*yield*/, (0, promises_1.readdir)((0, node_path_1.join)(root, "objects", "packs"))];
            case 4:
                packs = _d.sent();
                (0, bun_test_1.expect)(packs.some(function (name) { return name.endsWith(".pack"); })).toBe(true);
                (0, bun_test_1.expect)(packs.some(function (name) { return name.endsWith(".idx"); })).toBe(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, objects.batchHas(ids)];
            case 5:
                _b.apply(void 0, [_d.sent()]).toEqual(ids.map(function () { return true; }));
                _c = bun_test_1.expect;
                return [4 /*yield*/, objects.batchGet(ids)];
            case 6:
                _c.apply(void 0, [(_d.sent()).map(function (b) { return b === null || b === void 0 ? void 0 : b.toString("utf8"); })]).toEqual(contents);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("delta-packed similar objects survive a round trip", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, objects, base, current, baseID, currentID, idxFiles, idxBytes, count, offset, sawDelta, i, idLen, recordKind, baseLen, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, openStore("natalia-object-delta-")];
            case 1:
                _a = _d.sent(), root = _a.root, objects = _a.objects;
                base = "function add(a: number, b: number): number {\n" +
                    "  const total = a + b;\n" +
                    "  const label = `sum of ${a} and ${b}`;\n" +
                    "  console.log(label, total);\n" +
                    "  return total;\n" +
                    "}\n";
                current = base
                    .replace("a: number, b: number", "a: number, b: number, c: number")
                    .replace("a + b", "a + b + c");
                return [4 /*yield*/, objects.put(base)];
            case 2:
                baseID = _d.sent();
                return [4 /*yield*/, objects.put(current)];
            case 3:
                currentID = _d.sent();
                return [4 /*yield*/, objects.compact()];
            case 4:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.readdir)((0, node_path_1.join)(root, "objects", "packs"))];
            case 5:
                idxFiles = (_d.sent()).filter(function (name) { return name.endsWith(".idx"); });
                (0, bun_test_1.expect)(idxFiles.length).toBeGreaterThan(0);
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "objects", "packs", idxFiles[0]))];
            case 6:
                idxBytes = _d.sent();
                (0, bun_test_1.expect)(idxBytes.toString("ascii", 0, 4)).toBe("NDX1");
                count = idxBytes.readUInt32LE(8);
                offset = 12;
                sawDelta = false;
                for (i = 0; i < count; i++) {
                    idLen = idxBytes.readUInt32LE(offset);
                    offset += 4 + idLen;
                    recordKind = idxBytes[offset + 16];
                    offset += 17;
                    if (recordKind === 1) {
                        baseLen = idxBytes.readUInt32LE(offset);
                        offset += 4 + baseLen + 4;
                        sawDelta = true;
                    }
                }
                (0, bun_test_1.expect)(sawDelta).toBe(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, objects.get(baseID)];
            case 7:
                _b.apply(void 0, [(_d.sent()).toString("utf8")]).toBe(base);
                _c = bun_test_1.expect;
                return [4 /*yield*/, objects.get(currentID)];
            case 8:
                _c.apply(void 0, [(_d.sent()).toString("utf8")]).toBe(current);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("garbage collection preserves reachable objects including chunk manifests", function () { return __awaiter(void 0, void 0, void 0, function () {
    var objects, live, dead, largeText, liveLarge, deadLarge, result, _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, openStore("natalia-object-gc-")];
            case 1:
                objects = (_f.sent()).objects;
                return [4 /*yield*/, objects.put("live-content")];
            case 2:
                live = _f.sent();
                return [4 /*yield*/, objects.put("dead-content")];
            case 3:
                dead = _f.sent();
                largeText = "x".repeat(512 * 1024);
                return [4 /*yield*/, objects.put(largeText)];
            case 4:
                liveLarge = _f.sent();
                return [4 /*yield*/, objects.put("y".repeat(512 * 1024))];
            case 5:
                deadLarge = _f.sent();
                return [4 /*yield*/, objects.collectGarbage(new Set([live, liveLarge]))];
            case 6:
                result = _f.sent();
                (0, bun_test_1.expect)(result.unreachableObjects).toBeGreaterThanOrEqual(2);
                _a = bun_test_1.expect;
                return [4 /*yield*/, objects.has(live)];
            case 7:
                _a.apply(void 0, [_f.sent()]).toBe(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, objects.has(liveLarge)];
            case 8:
                _b.apply(void 0, [_f.sent()]).toBe(true);
                _c = bun_test_1.expect;
                return [4 /*yield*/, objects.get(liveLarge)];
            case 9:
                _c.apply(void 0, [(_f.sent()).toString()]).toBe(largeText);
                _d = bun_test_1.expect;
                return [4 /*yield*/, objects.has(dead)];
            case 10:
                _d.apply(void 0, [_f.sent()]).toBe(false);
                _e = bun_test_1.expect;
                return [4 /*yield*/, objects.has(deadLarge)];
            case 11:
                _e.apply(void 0, [_f.sent()]).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("native FFI index can parse generated binary .idx entries", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, objects, id, idxFiles, idx, entry;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, openStore("natalia-object-native-")];
            case 1:
                _a = _b.sent(), root = _a.root, objects = _a.objects;
                return [4 /*yield*/, objects.put("native-indexed-content")];
            case 2:
                id = _b.sent();
                return [4 /*yield*/, objects.compact()];
            case 3:
                _b.sent();
                if (!(0, native_index_1.nativePackIndexAvailable)())
                    return [2 /*return*/];
                return [4 /*yield*/, (0, promises_1.readdir)((0, node_path_1.join)(root, "objects", "packs"))];
            case 4:
                idxFiles = (_b.sent()).filter(function (name) { return name.endsWith(".idx"); });
                (0, bun_test_1.expect)(idxFiles.length).toBe(1);
                idx = new native_index_1.NativePackIndex((0, node_path_1.join)(root, "objects", "packs", idxFiles[0]));
                try {
                    entry = idx.find(id);
                    (0, bun_test_1.expect)(entry).toBeDefined();
                    (0, bun_test_1.expect)(entry.origLen).toBe(Buffer.byteLength("native-indexed-content"));
                    (0, bun_test_1.expect)(idx.find("not-present-in-this-pack")).toBeUndefined();
                }
                finally {
                    idx.free();
                }
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("multiple ObjectStore instances share the same content-addressed root", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, a, b, contents, ids, i, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-object-multi-"))];
            case 1:
                root = _d.sent();
                a = new src_1.ObjectStore((0, node_path_1.join)(root, "objects"));
                b = new src_1.ObjectStore((0, node_path_1.join)(root, "objects"));
                contents = Array.from({ length: 20 }, function (_, i) { return "shared-".concat(i); });
                return [4 /*yield*/, Promise.all(contents.map(function (c, i) { return (i % 2 ? a : b).put(c); }))];
            case 2:
                ids = _d.sent();
                i = 0;
                _d.label = 3;
            case 3:
                if (!(i < ids.length)) return [3 /*break*/, 8];
                _a = bun_test_1.expect;
                return [4 /*yield*/, a.has(ids[i])];
            case 4:
                _a.apply(void 0, [_d.sent()]).toBe(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, b.has(ids[i])];
            case 5:
                _b.apply(void 0, [_d.sent()]).toBe(true);
                _c = bun_test_1.expect;
                return [4 /*yield*/, (i % 2 ? b : a).get(ids[i])];
            case 6:
                _c.apply(void 0, [(_d.sent()).toString()]).toBe(contents[i]);
                _d.label = 7;
            case 7:
                i++;
                return [3 /*break*/, 3];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("delete removes a chunked object and everything it was made of", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, content, id, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "obj-del-chunked-"))];
            case 1:
                root = _c.sent();
                store = new src_1.ObjectStore(root);
                content = "x".repeat(3000000);
                return [4 /*yield*/, store.put(content)];
            case 2:
                id = _c.sent();
                return [4 /*yield*/, store.delete(id)];
            case 3:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.has(id)];
            case 4:
                _a.apply(void 0, [_c.sent()]).toBe(false);
                return [4 /*yield*/, (0, bun_test_1.expect)(store.get(id)).rejects.toThrow()];
            case 5:
                _c.sent();
                // Nothing survives to be found by a later sweep.
                _b = bun_test_1.expect;
                return [4 /*yield*/, store.list()];
            case 6:
                // Nothing survives to be found by a later sweep.
                _b.apply(void 0, [_c.sent()]).not.toContain(id);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("delete removes a packed object", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, id, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "obj-del-packed-"))];
            case 1:
                root = _b.sent();
                store = new src_1.ObjectStore(root);
                return [4 /*yield*/, store.put("packed content")];
            case 2:
                id = _b.sent();
                return [4 /*yield*/, store.compact()];
            case 3:
                _b.sent();
                return [4 /*yield*/, store.delete(id)];
            case 4:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.has(id)];
            case 5:
                _a.apply(void 0, [_b.sent()]).toBe(false);
                return [4 /*yield*/, (0, bun_test_1.expect)(store.get(id)).rejects.toThrow()];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("get refuses an object whose content no longer matches its address", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, id, path;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "obj-corrupt-"))];
            case 1:
                root = _a.sent();
                store = new src_1.ObjectStore(root);
                return [4 /*yield*/, store.put("the real content")];
            case 2:
                id = _a.sent();
                path = (0, node_path_1.join)(root, id.slice(0, 2), id);
                return [4 /*yield*/, (0, promises_1.writeFile)(path, "tampered content!!")];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(store.get(id)).rejects.toThrow(/corrupt/)];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("getStream refuses a chunked object whose chunks changed", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, id, meta, chunked, first;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "obj-corrupt-stream-"))];
            case 1:
                root = _a.sent();
                store = new src_1.ObjectStore(root);
                return [4 /*yield*/, store.put("y".repeat(3000000))];
            case 2:
                id = _a.sent();
                meta = store;
                return [4 /*yield*/, meta.getMeta("chunked:".concat(id))];
            case 3:
                chunked = _a.sent();
                first = chunked.chunks[0];
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, first.slice(0, 2), first), "not the chunk")];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((function () { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, _b, _c, _chunk, e_2_1;
                        var _d, e_2, _e, _f;
                        return __generator(this, function (_g) {
                            switch (_g.label) {
                                case 0:
                                    _g.trys.push([0, 5, 6, 11]);
                                    _a = true, _b = __asyncValues(store.getStream(id));
                                    _g.label = 1;
                                case 1: return [4 /*yield*/, _b.next()];
                                case 2:
                                    if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 4];
                                    _f = _c.value;
                                    _a = false;
                                    _chunk = _f;
                                    _g.label = 3;
                                case 3:
                                    _a = true;
                                    return [3 /*break*/, 1];
                                case 4: return [3 /*break*/, 11];
                                case 5:
                                    e_2_1 = _g.sent();
                                    e_2 = { error: e_2_1 };
                                    return [3 /*break*/, 11];
                                case 6:
                                    _g.trys.push([6, , 9, 10]);
                                    if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 8];
                                    return [4 /*yield*/, _e.call(_b)];
                                case 7:
                                    _g.sent();
                                    _g.label = 8;
                                case 8: return [3 /*break*/, 10];
                                case 9:
                                    if (e_2) throw e_2.error;
                                    return [7 /*endfinally*/];
                                case 10: return [7 /*endfinally*/];
                                case 11: return [2 /*return*/];
                            }
                        });
                    }); })()).rejects.toThrow(/corrupt/)];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
