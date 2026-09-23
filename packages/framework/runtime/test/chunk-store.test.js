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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var bun_test_1 = require("bun:test");
var chunk_store_1 = require("../src/chunk-store");
/** Deterministic pseudo-random bytes, so chunk boundaries are reproducible. */
function bytes(seed, length) {
    var out = Buffer.allocUnsafe(length);
    var x = seed >>> 0 || 1;
    for (var index = 0; index < length; index++) {
        x ^= x << 13;
        x >>>= 0;
        x ^= x >>> 17;
        x ^= x << 5;
        x >>>= 0;
        out[index] = x & 0xff;
    }
    return out;
}
/** Writes the legacy one-file-per-chunk layout by hand. */
function putLoose(root, payload) {
    return __awaiter(this, void 0, void 0, function () {
        var chunks, _i, _a, chunk, hash, path;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    chunks = [];
                    _i = 0, _a = (0, chunk_store_1.contentDefinedChunks)(payload);
                    _b.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    chunk = _a[_i];
                    hash = (0, node_crypto_1.createHash)("sha256").update(chunk).digest("hex");
                    path = (0, node_path_1.join)(root, hash.slice(0, 2), hash);
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true })];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)(path, chunk)];
                case 3:
                    _b.sent();
                    chunks.push(hash);
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/, { chunks: chunks, size: payload.length }];
            }
        });
    });
}
/** Every hash currently recorded in the pack index. */
function indexHashes(root) {
    return __awaiter(this, void 0, void 0, function () {
        var text, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "packs", "index.jsonl"), "utf8")];
                case 1:
                    text = _a.sent();
                    return [2 /*return*/, text
                            .split("\n")
                            .filter(Boolean)
                            .map(function (line) { return JSON.parse(line).h; })];
                case 2:
                    error_1 = _a.sent();
                    if (error_1.code === "ENOENT")
                        return [2 /*return*/, []];
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function countChunks(root) {
    return __awaiter(this, void 0, void 0, function () {
        var walk, error_2;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    walk = function (dir) { return __awaiter(_this, void 0, void 0, function () {
                        var entries, count, _i, entries_1, entry, _a, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0: return [4 /*yield*/, (0, promises_1.readdir)(dir, { withFileTypes: true })];
                                case 1:
                                    entries = _c.sent();
                                    count = 0;
                                    _i = 0, entries_1 = entries;
                                    _c.label = 2;
                                case 2:
                                    if (!(_i < entries_1.length)) return [3 /*break*/, 7];
                                    entry = entries_1[_i];
                                    _a = count;
                                    if (!entry.isDirectory()) return [3 /*break*/, 4];
                                    return [4 /*yield*/, walk((0, node_path_1.join)(dir, entry.name))];
                                case 3:
                                    _b = _c.sent();
                                    return [3 /*break*/, 5];
                                case 4:
                                    _b = entry.isFile()
                                        ? 1
                                        : 0;
                                    _c.label = 5;
                                case 5:
                                    count = _a + _b;
                                    _c.label = 6;
                                case 6:
                                    _i++;
                                    return [3 /*break*/, 2];
                                case 7: return [2 /*return*/, count];
                            }
                        });
                    }); };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, walk(root)];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_2 = _a.sent();
                    if (error_2.code === "ENOENT")
                        return [2 /*return*/, 0];
                    throw error_2;
                case 4: return [2 /*return*/];
            }
        });
    });
}
(0, bun_test_1.test)("chunk store round-trips a payload exactly", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, payload, ref, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunks-"))];
            case 1:
                root = _c.sent();
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 6, 8]);
                store = new chunk_store_1.ChunkStore(root);
                payload = bytes(7, 300000);
                return [4 /*yield*/, store.put(payload)];
            case 3:
                ref = _c.sent();
                (0, bun_test_1.expect)(ref.size).toBe(payload.length);
                (0, bun_test_1.expect)(ref.chunks.length).toBeGreaterThan(1);
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.get(ref)];
            case 4:
                _a.apply(void 0, [_c.sent()]).toEqual(payload);
                _b = bun_test_1.expect;
                return [4 /*yield*/, store.has(ref)];
            case 5:
                _b.apply(void 0, [_c.sent()]).toBe(true);
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 7:
                _c.sent();
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("chunk store handles the empty payload", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, ref, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunks-"))];
            case 1:
                root = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 5, 7]);
                store = new chunk_store_1.ChunkStore(root);
                return [4 /*yield*/, store.put(Buffer.alloc(0))];
            case 3:
                ref = _b.sent();
                (0, bun_test_1.expect)(ref).toEqual({ chunks: [], size: 0 });
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.get(ref)];
            case 4:
                _a.apply(void 0, [(_b.sent()).length]).toBe(0);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("identical payloads dedupe to the same on-disk chunks", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, payload, first, afterFirst, second, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunks-"))];
            case 1:
                root = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 7, 9]);
                store = new chunk_store_1.ChunkStore(root);
                payload = bytes(11, 200000);
                return [4 /*yield*/, store.put(payload)];
            case 3:
                first = _b.sent();
                return [4 /*yield*/, countChunks(root)];
            case 4:
                afterFirst = _b.sent();
                return [4 /*yield*/, store.put(payload)];
            case 5:
                second = _b.sent();
                (0, bun_test_1.expect)(second).toEqual(first);
                _a = bun_test_1.expect;
                return [4 /*yield*/, countChunks(root)];
            case 6:
                _a.apply(void 0, [_b.sent()]).toBe(afterFirst);
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 8:
                _b.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("content-defined boundaries resync after an edit, so chunks dedupe", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, base, edited, baseRef_1, editedRef, shared, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunks-"))];
            case 1:
                root = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 6, 8]);
                store = new chunk_store_1.ChunkStore(root);
                base = bytes(23, 500000);
                edited = Buffer.concat([Buffer.from("inserted-prefix\n"), base]);
                return [4 /*yield*/, store.put(base)];
            case 3:
                baseRef_1 = _b.sent();
                return [4 /*yield*/, store.put(edited)];
            case 4:
                editedRef = _b.sent();
                shared = editedRef.chunks.filter(function (hash) {
                    return baseRef_1.chunks.includes(hash);
                }).length;
                // Only the chunk(s) around the edit should change; a fixed-size split would
                // share nothing because every boundary shifts. Random data has ~8KiB
                // chunks, so 500KiB is ~60 chunks and the tail must clearly survive.
                (0, bun_test_1.expect)(shared).toBeGreaterThan(editedRef.chunks.length * 0.8);
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.get(editedRef)];
            case 5:
                _a.apply(void 0, [_b.sent()]).toEqual(edited);
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 7:
                _b.sent();
                return [7 /*endfinally*/];
            case 8: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("garbage collection removes only unreferenced chunks", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, kept, dropped, referenced, removed, _a, _b, _c, _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunks-"))];
            case 1:
                root = _h.sent();
                _h.label = 2;
            case 2:
                _h.trys.push([2, , 11, 13]);
                store = new chunk_store_1.ChunkStore(root);
                return [4 /*yield*/, store.put(bytes(3, 120000))];
            case 3:
                kept = _h.sent();
                return [4 /*yield*/, store.put(bytes(99, 120000))];
            case 4:
                dropped = _h.sent();
                referenced = new Set(kept.chunks);
                return [4 /*yield*/, store.collectGarbage(referenced)];
            case 5:
                removed = _h.sent();
                (0, bun_test_1.expect)(removed.removed).toBe(dropped.chunks.length);
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.get(kept)];
            case 6:
                _a.apply(void 0, [_h.sent()]).toEqual(bytes(3, 120000));
                _b = bun_test_1.expect;
                return [4 /*yield*/, store.has(dropped)];
            case 7:
                _b.apply(void 0, [_h.sent()]).toBe(false);
                // The published index no longer names any dead chunk.
                _c = bun_test_1.expect;
                return [4 /*yield*/, indexHashes(root)];
            case 8:
                // The published index no longer names any dead chunk.
                _c.apply(void 0, [_h.sent()]).toEqual(bun_test_1.expect.arrayContaining(kept.chunks));
                _e = bun_test_1.expect;
                return [4 /*yield*/, indexHashes(root)];
            case 9:
                _f = (_d = _e.apply(void 0, [(_h.sent()).length])).toBe;
                _g = Set.bind;
                return [4 /*yield*/, indexHashes(root)];
            case 10:
                _f.apply(_d, [new (_g.apply(Set, [void 0, _h.sent()]))().size]);
                return [3 /*break*/, 13];
            case 11: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 12:
                _h.sent();
                return [7 /*endfinally*/];
            case 13: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("chunk store detects a corrupted chunk on read", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, payload, ref, target_1, entry, path, corrupted, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunks-"))];
            case 1:
                root = _d.sent();
                _d.label = 2;
            case 2:
                _d.trys.push([2, , 9, 11]);
                store = new chunk_store_1.ChunkStore(root);
                payload = bytes(7, 200000);
                return [4 /*yield*/, store.put(payload)];
            case 3:
                ref = _d.sent();
                target_1 = ref.chunks[0];
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, "packs", "index.jsonl"), "utf8")];
            case 4:
                entry = (_d.sent())
                    .split("\n")
                    .filter(Boolean)
                    .map(function (line) { return JSON.parse(line); })
                    .find(function (candidate) { return candidate.h === target_1; });
                path = (0, node_path_1.join)(root, "packs", "pack_".concat(String(entry.p).padStart(6, "0"), ".pack"));
                _b = (_a = Buffer).from;
                return [4 /*yield*/, (0, promises_1.readFile)(path)];
            case 5:
                corrupted = _b.apply(_a, [_d.sent()]);
                corrupted[entry.o] = corrupted[entry.o] ^ 0xff;
                return [4 /*yield*/, (0, promises_1.writeFile)(path, corrupted)];
            case 6:
                _d.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(store.get(ref)).rejects.toThrow(/integrity/)];
            case 7:
                _d.sent();
                // Verification is opt-out: the size still checks out, only the hash differs.
                _c = bun_test_1.expect;
                return [4 /*yield*/, store.get(ref, { verify: false })];
            case 8:
                // Verification is opt-out: the size still checks out, only the hash differs.
                _c.apply(void 0, [(_d.sent()).length]).toBe(payload.length);
                return [3 /*break*/, 11];
            case 9: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 10:
                _d.sent();
                return [7 /*endfinally*/];
            case 11: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("garbage collection honours the age grace window", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, ref, held, _a, reaped;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunks-"))];
            case 1:
                root = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 7, 9]);
                store = new chunk_store_1.ChunkStore(root);
                return [4 /*yield*/, store.put(bytes(1, 50000))];
            case 3:
                ref = _b.sent();
                return [4 /*yield*/, store.collectGarbage(new Set(), false, {
                        minAgeMs: 60000,
                    })];
            case 4:
                held = _b.sent();
                (0, bun_test_1.expect)(held.removed).toBe(0);
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.has(ref)];
            case 5:
                _a.apply(void 0, [_b.sent()]).toBe(true);
                return [4 /*yield*/, store.collectGarbage(new Set(), false, {
                        minAgeMs: 0,
                    })];
            case 6:
                reaped = _b.sent();
                (0, bun_test_1.expect)(reaped.removed).toBe(ref.chunks.length);
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 8:
                _b.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("chunk store streams a payload without concatenating it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, payload, ref, parts, _a, _b, _c, chunk, e_1_1;
    var _d, e_1, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunks-"))];
            case 1:
                root = _g.sent();
                _g.label = 2;
            case 2:
                _g.trys.push([2, , 16, 18]);
                store = new chunk_store_1.ChunkStore(root);
                payload = bytes(13, 150000);
                return [4 /*yield*/, store.put(payload)];
            case 3:
                ref = _g.sent();
                parts = [];
                _g.label = 4;
            case 4:
                _g.trys.push([4, 9, 10, 15]);
                _a = true, _b = __asyncValues(store.read(ref));
                _g.label = 5;
            case 5: return [4 /*yield*/, _b.next()];
            case 6:
                if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 8];
                _f = _c.value;
                _a = false;
                chunk = _f;
                parts.push(chunk);
                _g.label = 7;
            case 7:
                _a = true;
                return [3 /*break*/, 5];
            case 8: return [3 /*break*/, 15];
            case 9:
                e_1_1 = _g.sent();
                e_1 = { error: e_1_1 };
                return [3 /*break*/, 15];
            case 10:
                _g.trys.push([10, , 13, 14]);
                if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 12];
                return [4 /*yield*/, _e.call(_b)];
            case 11:
                _g.sent();
                _g.label = 12;
            case 12: return [3 /*break*/, 14];
            case 13:
                if (e_1) throw e_1.error;
                return [7 /*endfinally*/];
            case 14: return [7 /*endfinally*/];
            case 15:
                (0, bun_test_1.expect)(parts.length).toBe(ref.chunks.length);
                (0, bun_test_1.expect)(Buffer.concat(parts).equals(payload)).toBe(true);
                return [3 /*break*/, 18];
            case 16: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 17:
                _g.sent();
                return [7 /*endfinally*/];
            case 18: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("chunker emits the same ranges for the same bytes", function () {
    var payload = bytes(5, 100000);
    var first = (0, chunk_store_1.contentDefinedChunks)(payload).map(function (chunk) { return chunk.length; });
    var second = (0, chunk_store_1.contentDefinedChunks)(payload).map(function (chunk) { return chunk.length; });
    (0, bun_test_1.expect)(first).toEqual(second);
    (0, bun_test_1.expect)(first.reduce(function (sum, length) { return sum + length; }, 0)).toBe(payload.length);
});
(0, bun_test_1.test)("migrateLegacyRoots merges per-session chunk dirs into the shared root", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, legacyA, legacyB, refA, refB, shared, refSharedA, refSharedB, sharedStore, migration, _a, _b, _c, _d, hashes, again;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunk-migrate-"))];
            case 1:
                root = _e.sent();
                _e.label = 2;
            case 2:
                _e.trys.push([2, , 14, 16]);
                legacyA = (0, node_path_1.join)(root, "ses_a");
                legacyB = (0, node_path_1.join)(root, "ses_b");
                return [4 /*yield*/, putLoose(legacyA, Buffer.from("payload a ".repeat(500)))];
            case 3:
                refA = _e.sent();
                return [4 /*yield*/, putLoose(legacyB, Buffer.from("payload b ".repeat(500)))];
            case 4:
                refB = _e.sent();
                shared = Buffer.from("shared payload ".repeat(500));
                return [4 /*yield*/, putLoose(legacyA, shared)];
            case 5:
                refSharedA = _e.sent();
                return [4 /*yield*/, putLoose(legacyB, shared)];
            case 6:
                refSharedB = _e.sent();
                sharedStore = new chunk_store_1.ChunkStore(root);
                return [4 /*yield*/, sharedStore.migrateLegacyRoots()];
            case 7:
                migration = _e.sent();
                (0, bun_test_1.expect)(migration.roots).toBe(2);
                (0, bun_test_1.expect)(migration.moved).toBeGreaterThan(0);
                // Every legacy ref now resolves from the shared root, and the shared chunk
                // exists exactly once.
                _a = bun_test_1.expect;
                return [4 /*yield*/, sharedStore.get(refA)];
            case 8:
                // Every legacy ref now resolves from the shared root, and the shared chunk
                // exists exactly once.
                _a.apply(void 0, [_e.sent()]).toEqual(Buffer.from("payload a ".repeat(500)));
                _b = bun_test_1.expect;
                return [4 /*yield*/, sharedStore.get(refB)];
            case 9:
                _b.apply(void 0, [_e.sent()]).toEqual(Buffer.from("payload b ".repeat(500)));
                _c = bun_test_1.expect;
                return [4 /*yield*/, sharedStore.get(refSharedA)];
            case 10:
                _c.apply(void 0, [_e.sent()]).toEqual(shared);
                _d = bun_test_1.expect;
                return [4 /*yield*/, sharedStore.get(refSharedB)];
            case 11:
                _d.apply(void 0, [_e.sent()]).toEqual(shared);
                return [4 /*yield*/, indexHashes(root)];
            case 12:
                hashes = _e.sent();
                (0, bun_test_1.expect)(new Set(hashes).size).toBe(hashes.length);
                (0, bun_test_1.expect)(new Set(hashes).size).toBe(new Set(__spreadArray(__spreadArray(__spreadArray([], refA.chunks, true), refB.chunks, true), refSharedA.chunks, true)).size);
                return [4 /*yield*/, sharedStore.migrateLegacyRoots()];
            case 13:
                again = _e.sent();
                (0, bun_test_1.expect)(again.roots).toBe(0);
                (0, bun_test_1.expect)(again.moved).toBe(0);
                return [3 /*break*/, 16];
            case 14: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 15:
                _e.sent();
                return [7 /*endfinally*/];
            case 16: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("migrateLegacyRoots leaves unknown directories untouched", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, notes, keep, store, migration, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunk-unknown-"))];
            case 1:
                root = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 7, 9]);
                notes = (0, node_path_1.join)(root, "notes");
                return [4 /*yield*/, (0, promises_1.mkdir)(notes, { recursive: true })];
            case 3:
                _b.sent();
                keep = (0, node_path_1.join)(notes, "keep.txt");
                return [4 /*yield*/, (0, promises_1.writeFile)(keep, "keep me")];
            case 4:
                _b.sent();
                store = new chunk_store_1.ChunkStore(root);
                return [4 /*yield*/, store.migrateLegacyRoots()];
            case 5:
                migration = _b.sent();
                (0, bun_test_1.expect)(migration.roots).toBe(0);
                (0, bun_test_1.expect)(migration.moved).toBe(0);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)(keep, "utf8")];
            case 6:
                _a.apply(void 0, [_b.sent()]).toBe("keep me");
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 8:
                _b.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("migrateLegacyRoots leaves corrupt session chunks in place", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, legacy, bad, store, migration, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunk-corrupt-"))];
            case 1:
                root = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 7, 9]);
                legacy = (0, node_path_1.join)(root, "ses_corrupt");
                return [4 /*yield*/, (0, promises_1.mkdir)(legacy, { recursive: true })];
            case 3:
                _b.sent();
                bad = (0, node_path_1.join)(legacy, "a".repeat(64));
                return [4 /*yield*/, (0, promises_1.writeFile)(bad, "not-a-chunk")];
            case 4:
                _b.sent();
                store = new chunk_store_1.ChunkStore(root);
                return [4 /*yield*/, store.migrateLegacyRoots()];
            case 5:
                migration = _b.sent();
                (0, bun_test_1.expect)(migration.moved).toBe(0);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)(bad, "utf8")];
            case 6:
                _a.apply(void 0, [_b.sent()]).toBe("not-a-chunk");
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 8:
                _b.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("migrateLegacyRoots never deletes the shared packs directory", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, packs, store, migration, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunk-packs-skip-"))];
            case 1:
                root = _c.sent();
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 9, 11]);
                packs = (0, node_path_1.join)(root, "packs");
                return [4 /*yield*/, (0, promises_1.mkdir)(packs, { recursive: true })];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(packs, "index.jsonl"), "")];
            case 4:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(packs, "pack_000001.pack"), "pack-bytes")];
            case 5:
                _c.sent();
                store = new chunk_store_1.ChunkStore(root);
                return [4 /*yield*/, store.migrateLegacyRoots()];
            case 6:
                migration = _c.sent();
                (0, bun_test_1.expect)(migration.roots).toBe(0);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(packs, "pack_000001.pack"), "utf8")];
            case 7:
                _a.apply(void 0, [_c.sent()]).toBe("pack-bytes");
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readdir)(packs)];
            case 8:
                _b.apply(void 0, [_c.sent()]).toEqual(bun_test_1.expect.arrayContaining(["index.jsonl"]));
                return [3 /*break*/, 11];
            case 9: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 10:
                _c.sent();
                return [7 /*endfinally*/];
            case 11: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("chunks are packed into append-only pack files, not one file each", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, ref, _a, _b, _i, _c, hash, loose, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunks-"))];
            case 1:
                root = _f.sent();
                _f.label = 2;
            case 2:
                _f.trys.push([2, , 13, 15]);
                store = new chunk_store_1.ChunkStore(root);
                return [4 /*yield*/, store.put(bytes(5, 200000))];
            case 3:
                ref = _f.sent();
                (0, bun_test_1.expect)(ref.chunks.length).toBeGreaterThan(1);
                _a = bun_test_1.expect;
                _b = Set.bind;
                return [4 /*yield*/, indexHashes(root)];
            case 4:
                _a.apply(void 0, [new (_b.apply(Set, [void 0, _f.sent()]))()]).toEqual(new Set(ref.chunks));
                _i = 0, _c = ref.chunks;
                _f.label = 5;
            case 5:
                if (!(_i < _c.length)) return [3 /*break*/, 11];
                hash = _c[_i];
                loose = true;
                _f.label = 6;
            case 6:
                _f.trys.push([6, 8, , 9]);
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, hash.slice(0, 2), hash))];
            case 7:
                _f.sent();
                return [3 /*break*/, 9];
            case 8:
                _d = _f.sent();
                loose = false;
                return [3 /*break*/, 9];
            case 9:
                (0, bun_test_1.expect)(loose).toBe(false);
                _f.label = 10;
            case 10:
                _i++;
                return [3 /*break*/, 5];
            case 11:
                // A second instance on the same root shares the in-process index.
                _e = bun_test_1.expect;
                return [4 /*yield*/, new chunk_store_1.ChunkStore(root).get(ref)];
            case 12:
                // A second instance on the same root shares the in-process index.
                _e.apply(void 0, [_f.sent()]).toEqual(bytes(5, 200000));
                return [3 /*break*/, 15];
            case 13: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 14:
                _f.sent();
                return [7 /*endfinally*/];
            case 15: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("packLooseChunks folds the legacy loose layout into packs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, payload, ref, store, _a, _b, _c, _d, _e, entries;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunks-"))];
            case 1:
                root = _f.sent();
                _f.label = 2;
            case 2:
                _f.trys.push([2, , 9, 11]);
                payload = bytes(9, 200000);
                return [4 /*yield*/, putLoose(root, payload)];
            case 3:
                ref = _f.sent();
                store = new chunk_store_1.ChunkStore(root);
                _a = bun_test_1.expect;
                return [4 /*yield*/, store.packLooseChunks()];
            case 4:
                _a.apply(void 0, [(_f.sent()).packed]).toBe(ref.chunks.length);
                _b = bun_test_1.expect;
                return [4 /*yield*/, store.get(ref)];
            case 5:
                _b.apply(void 0, [_f.sent()]).toEqual(payload);
                _c = bun_test_1.expect;
                _d = Set.bind;
                return [4 /*yield*/, indexHashes(root)];
            case 6:
                _c.apply(void 0, [new (_d.apply(Set, [void 0, _f.sent()]))()]).toEqual(new Set(ref.chunks));
                // Idempotent, and the empty shard directories are gone.
                _e = bun_test_1.expect;
                return [4 /*yield*/, store.packLooseChunks()];
            case 7:
                // Idempotent, and the empty shard directories are gone.
                _e.apply(void 0, [(_f.sent()).packed]).toBe(0);
                return [4 /*yield*/, (0, promises_1.readdir)(root, { withFileTypes: true })];
            case 8:
                entries = _f.sent();
                (0, bun_test_1.expect)(entries.some(function (entry) { return entry.isDirectory() && /^[0-9a-f]{2}$/u.test(entry.name); })).toBe(false);
                return [3 /*break*/, 11];
            case 9: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 10:
                _f.sent();
                return [7 /*endfinally*/];
            case 11: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("GC compaction rewrites a shared pack without losing live chunks", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, live, dead, _a, removed, _b, _c, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-chunks-"))];
            case 1:
                root = _g.sent();
                _g.label = 2;
            case 2:
                _g.trys.push([2, , 11, 13]);
                store = new chunk_store_1.ChunkStore(root);
                return [4 /*yield*/, store.put(bytes(31, 120000))];
            case 3:
                live = _g.sent();
                return [4 /*yield*/, store.put(bytes(32, 120000))];
            case 4:
                dead = _g.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, indexHashes(root)];
            case 5:
                _a.apply(void 0, [(_g.sent()).length]).toBe(live.chunks.length + dead.chunks.length);
                return [4 /*yield*/, store.collectGarbage(new Set(live.chunks))];
            case 6:
                removed = _g.sent();
                (0, bun_test_1.expect)(removed.removed).toBe(dead.chunks.length);
                _b = bun_test_1.expect;
                return [4 /*yield*/, store.get(live)];
            case 7:
                _b.apply(void 0, [_g.sent()]).toEqual(bytes(31, 120000));
                _c = bun_test_1.expect;
                return [4 /*yield*/, store.has(dead)];
            case 8:
                _c.apply(void 0, [_g.sent()]).toBe(false);
                _d = bun_test_1.expect;
                _e = Set.bind;
                return [4 /*yield*/, indexHashes(root)];
            case 9:
                _d.apply(void 0, [new (_e.apply(Set, [void 0, _g.sent()]))()]).toEqual(new Set(live.chunks));
                _f = bun_test_1.expect;
                return [4 /*yield*/, store.get(live, { verify: true })];
            case 10:
                _f.apply(void 0, [_g.sent()]).toEqual(bytes(31, 120000));
                return [3 /*break*/, 13];
            case 11: return [4 /*yield*/, (0, promises_1.rm)(root, { recursive: true, force: true })];
            case 12:
                _g.sent();
                return [7 /*endfinally*/];
            case 13: return [2 /*return*/];
        }
    });
}); });
