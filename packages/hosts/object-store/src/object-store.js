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
exports.ObjectStore = void 0;
/**
 * The shared content-addressed object store — one object library for the
 * framework's durable snapshots.
 *
 * Both checkpoint and the sandbox's git-free backend write here, so identical
 * files across the two subsystems share a single object (git's one global
 * object database). Objects are addressed by sha256 and stored git-style in
 * two-character prefix directories, so a directory listing never has to scan
 * a flat pile of thousands of files.
 *
 * Garbage collection is owner-relative: `collectGarbage(reachable)` deletes
 * every object the caller did not mark reachable. Owners (checkpoint journals,
 * sandbox snapshot indices) compute their own reachable set and union it, so
 * one owner's GC can never prune another owner's live objects.
 */
var bun_sqlite_1 = require("bun:sqlite");
var node_crypto_1 = require("node:crypto");
var node_fs_1 = require("node:fs");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_zlib_1 = require("node:zlib");
var native_index_1 = require("./native-index");
function objectStoreWorkerDisabled() {
    return (globalThis
        .__NATALIA_OBJECT_STORE_NO_WORKER === true);
}
var ObjectStore = /** @class */ (function () {
    function ObjectStore(root) {
        this.root = root;
        this.lru = new Map();
        this.lruBytes = 0;
        this.lruMaxBytes = 32 * 1024 * 1024;
        this.lruMaxEntryBytes = 4 * 1024 * 1024;
        this.chunkMin = 32 * 1024;
        this.chunkMax = 1024 * 1024;
        this.chunkMask = 0x3ffff;
        this.packMagic = Buffer.from("NPAC", "ascii");
        this.packVersion = 1;
        this.packs = new Map();
        this.packsLoaded = false;
        this.nativeIndexes = new Map();
        this.packBloom = new Uint8Array(1 << 20);
        this.packBloomInitialized = false;
        var metaDir = (0, node_path_1.join)(root, ".meta");
        (0, node_fs_1.mkdirSync)(metaDir, { recursive: true, mode: 448 });
        this.metaDb = new bun_sqlite_1.Database((0, node_path_1.join)(metaDir, "index.sqlite"));
        this.metaDb.run("\n      CREATE TABLE IF NOT EXISTS metadata (\n        namespace TEXT NOT NULL,\n        key TEXT NOT NULL,\n        value TEXT NOT NULL,\n        updated_at INTEGER NOT NULL,\n        PRIMARY KEY(namespace, key)\n      );\n    ");
        this.metaDb.run("PRAGMA journal_mode=WAL");
        this.metaDb.run("PRAGMA synchronous=NORMAL");
    }
    /** Stores a blob if absent, returning its content id. */
    ObjectStore.prototype.put = function (content) {
        return __awaiter(this, void 0, void 0, function () {
            var data, id, chunks, chunkIds, _i, chunks_1, chunk, _a, _b, manifest, manifestId;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        data = Buffer.from(content);
                        id = (0, node_crypto_1.createHash)("sha256").update(data).digest("hex");
                        return [4 /*yield*/, this.has(id)];
                    case 1:
                        if (_c.sent())
                            return [2 /*return*/, id];
                        if (!(data.length > this.chunkMin)) return [3 /*break*/, 8];
                        chunks = this.splitIntoChunks(data);
                        if (!(chunks.length > 1)) return [3 /*break*/, 8];
                        chunkIds = [];
                        _i = 0, chunks_1 = chunks;
                        _c.label = 2;
                    case 2:
                        if (!(_i < chunks_1.length)) return [3 /*break*/, 5];
                        chunk = chunks_1[_i];
                        _b = (_a = chunkIds).push;
                        return [4 /*yield*/, this.putRaw(chunk)];
                    case 3:
                        _b.apply(_a, [_c.sent()]);
                        _c.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        manifest = JSON.stringify({ version: 1, chunks: chunkIds });
                        return [4 /*yield*/, this.putRaw(manifest)];
                    case 6:
                        manifestId = _c.sent();
                        return [4 /*yield*/, this.putMeta("chunked:".concat(id), {
                                manifestId: manifestId,
                                totalLength: data.length,
                                chunks: chunkIds,
                            })];
                    case 7:
                        _c.sent();
                        return [2 /*return*/, id];
                    case 8: return [4 /*yield*/, this.putRaw(data)];
                    case 9: return [2 /*return*/, _c.sent()];
                }
            });
        });
    };
    ObjectStore.prototype.has = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.lru.has(id))
                            return [2 /*return*/, true];
                        return [4 /*yield*/, this.getMeta("chunked:".concat(id))];
                    case 1:
                        if (_b.sent())
                            return [2 /*return*/, true];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, (0, promises_1.stat)(this.objectPath(id))];
                    case 3:
                        _b.sent();
                        return [2 /*return*/, true];
                    case 4:
                        _a = _b.sent();
                        return [3 /*break*/, 5];
                    case 5:
                        if (this.packBloomInitialized && !this.bloomMaybe(id))
                            return [2 /*return*/, false];
                        return [4 /*yield*/, this.loadPackIndexes()];
                    case 6:
                        _b.sent();
                        return [2 /*return*/, this.packs.has(id)];
                }
            });
        });
    };
    ObjectStore.prototype.bloomSet = function (id) {
        var b1 = this.bloomHash(id, 1) & (this.packBloom.length - 1);
        var b2 = this.bloomHash(id, 2) & (this.packBloom.length - 1);
        this.packBloom[b1] = 1;
        this.packBloom[b2] = 1;
    };
    ObjectStore.prototype.bloomMaybe = function (id) {
        var b1 = this.bloomHash(id, 1) & (this.packBloom.length - 1);
        var b2 = this.bloomHash(id, 2) & (this.packBloom.length - 1);
        return this.packBloom[b1] === 1 && this.packBloom[b2] === 1;
    };
    ObjectStore.prototype.bloomHash = function (id, salt) {
        var hash = 2166136261;
        for (var i = 0; i < id.length; i++) {
            hash ^= id.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        hash ^= salt;
        return hash >>> 0;
    };
    ObjectStore.prototype.get = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var cached, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        cached = this.lru.get(id);
                        if (cached) {
                            this.lru.delete(id);
                            this.lru.set(id, cached);
                            return [2 /*return*/, cached];
                        }
                        _a = this.verify;
                        _b = [id];
                        return [4 /*yield*/, this.readObject(id)];
                    case 1: return [2 /*return*/, _a.apply(this, _b.concat([_c.sent()]))];
                }
            });
        });
    };
    /**
     * Checks an object against the address it was fetched by.
     *
     * The store addresses by sha256, which buys deduplication on write; verifying
     * on read is what turns that same address into an integrity check. Without it
     * a truncated write or a rotted file is returned as content — and since the
     * caller has no checksum of its own, nothing downstream can tell.
     *
     * Read cost is one hash over bytes that were just read to build the buffer.
     */
    ObjectStore.prototype.verify = function (id, buffer) {
        var actual = (0, node_crypto_1.createHash)("sha256").update(buffer).digest("hex");
        if (actual !== id)
            throw new Error("object ".concat(id, " is corrupt: content hashes to ").concat(actual));
        return buffer;
    };
    ObjectStore.prototype.readObject = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var chunked, manifest, _a, _b, parts, _i, _c, chunkId, _d, _e, buffer, buffer, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, this.getMeta("chunked:".concat(id))];
                    case 1:
                        chunked = _g.sent();
                        if (!chunked) return [3 /*break*/, 7];
                        _b = (_a = JSON).parse;
                        return [4 /*yield*/, this.getRaw(chunked.manifestId)];
                    case 2:
                        manifest = _b.apply(_a, [(_g.sent()).toString("utf8")]);
                        parts = [];
                        _i = 0, _c = manifest.chunks;
                        _g.label = 3;
                    case 3:
                        if (!(_i < _c.length)) return [3 /*break*/, 6];
                        chunkId = _c[_i];
                        _e = (_d = parts).push;
                        return [4 /*yield*/, this.getRaw(chunkId)];
                    case 4:
                        _e.apply(_d, [_g.sent()]);
                        _g.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6:
                        buffer = Buffer.concat(parts);
                        this.cacheSet(id, buffer);
                        return [2 /*return*/, buffer];
                    case 7:
                        _g.trys.push([7, 9, , 11]);
                        return [4 /*yield*/, (0, promises_1.readFile)(this.objectPath(id))];
                    case 8:
                        buffer = _g.sent();
                        this.cacheSet(id, buffer);
                        return [2 /*return*/, buffer];
                    case 9:
                        _f = _g.sent();
                        return [4 /*yield*/, this.packGet(id)];
                    case 10: return [2 /*return*/, _g.sent()];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Streams an object's contents without forcing a whole large object into one
     * Buffer. Chunked objects yield each stored chunk; normal objects yield a
     * single buffer.
     */
    ObjectStore.prototype.getStream = function (id) {
        return __asyncGenerator(this, arguments, function getStream_1() {
            var chunked, manifest, _a, _b, hash, _i, _c, chunkId, chunk, actual;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, __await(this.getMeta("chunked:".concat(id)))];
                    case 1:
                        chunked = _d.sent();
                        if (!!chunked) return [3 /*break*/, 6];
                        return [4 /*yield*/, __await(this.get(id))];
                    case 2: return [4 /*yield*/, __await.apply(void 0, [_d.sent()])];
                    case 3: return [4 /*yield*/, _d.sent()];
                    case 4:
                        _d.sent();
                        return [4 /*yield*/, __await(void 0)];
                    case 5: return [2 /*return*/, _d.sent()];
                    case 6:
                        _b = (_a = JSON).parse;
                        return [4 /*yield*/, __await(this.getRaw(chunked.manifestId))];
                    case 7:
                        manifest = _b.apply(_a, [(_d.sent()).toString("utf8")]);
                        hash = (0, node_crypto_1.createHash)("sha256");
                        _i = 0, _c = manifest.chunks;
                        _d.label = 8;
                    case 8:
                        if (!(_i < _c.length)) return [3 /*break*/, 13];
                        chunkId = _c[_i];
                        return [4 /*yield*/, __await(this.getRaw(chunkId))];
                    case 9:
                        chunk = _d.sent();
                        hash.update(chunk);
                        return [4 /*yield*/, __await(chunk)];
                    case 10: return [4 /*yield*/, _d.sent()];
                    case 11:
                        _d.sent();
                        _d.label = 12;
                    case 12:
                        _i++;
                        return [3 /*break*/, 8];
                    case 13:
                        actual = hash.digest("hex");
                        if (actual !== id)
                            throw new Error("object ".concat(id, " is corrupt: content hashes to ").concat(actual));
                        return [2 /*return*/];
                }
            });
        });
    };
    ObjectStore.prototype.putRaw = function (content) {
        return __awaiter(this, void 0, void 0, function () {
            var data, id, path;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        data = Buffer.from(content);
                        id = (0, node_crypto_1.createHash)("sha256").update(data).digest("hex");
                        return [4 /*yield*/, this.has(id)];
                    case 1:
                        if (_a.sent())
                            return [2 /*return*/, id];
                        path = this.objectPath(id);
                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(path, ".."), { recursive: true, mode: 448 })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.writeFile)(path, data, { mode: 384 })];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, id];
                }
            });
        });
    };
    ObjectStore.prototype.getRaw = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 4]);
                        return [4 /*yield*/, (0, promises_1.readFile)(this.objectPath(id))];
                    case 1: return [2 /*return*/, _b.sent()];
                    case 2:
                        _a = _b.sent();
                        return [4 /*yield*/, this.packGet(id)];
                    case 3: return [2 /*return*/, _b.sent()];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ObjectStore.prototype.splitIntoChunks = function (data) {
        var chunks = [];
        var start = 0;
        while (start < data.length) {
            var end = Math.min(data.length, start + this.chunkMax);
            var hash = 0;
            for (var i = start; i < end; i++) {
                hash =
                    (((hash << 1) + (hash << 7) + (hash << 15) + data[i]) >>> 0) ^
                        data[i];
                if (i - start >= this.chunkMin &&
                    (hash & this.chunkMask) === 0 &&
                    i + 1 < data.length) {
                    end = i + 1;
                    break;
                }
            }
            chunks.push(data.subarray(start, end));
            start = end;
        }
        return chunks;
    };
    ObjectStore.prototype.batchHas = function (ids) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.all(ids.map(function (id) { return _this.has(id); }))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ObjectStore.prototype.batchGet = function (ids) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.all(ids.map(function (id) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, this.get(id)];
                                    case 1: return [2 /*return*/, _b.sent()];
                                    case 2:
                                        _a = _b.sent();
                                        return [2 /*return*/, undefined];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); }))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ObjectStore.prototype.batchPut = function (contents) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.all(contents.map(function (content) { return _this.put(content); }))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Removes an object however it is stored.
     *
     * Three forms have to be handled, and removing the loose file covers only the
     * first: a chunked object never had one (its bytes live as chunk objects
     * behind metadata), and a packed object's loose file was already removed by
     * the pack. Miss either and `delete` becomes a no-op that still reports
     * success while `has` and `get` keep answering.
     */
    ObjectStore.prototype.delete = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var existing, chunked, _i, _a, chunkId, cached;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        existing = this.lru.get(id);
                        if (existing) {
                            this.lru.delete(id);
                            this.lruBytes -= existing.byteLength;
                        }
                        return [4 /*yield*/, this.getMeta("chunked:".concat(id))];
                    case 1:
                        chunked = _c.sent();
                        if (!chunked) return [3 /*break*/, 7];
                        _i = 0, _a = __spreadArray([chunked.manifestId], ((_b = chunked.chunks) !== null && _b !== void 0 ? _b : []), true);
                        _c.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        chunkId = _a[_i];
                        return [4 /*yield*/, (0, promises_1.rm)(this.objectPath(chunkId), { force: true })];
                    case 3:
                        _c.sent();
                        cached = this.lru.get(chunkId);
                        if (cached) {
                            this.lru.delete(chunkId);
                            this.lruBytes -= cached.byteLength;
                        }
                        _c.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, this.deleteMeta("chunked:".concat(id))];
                    case 6:
                        _c.sent();
                        _c.label = 7;
                    case 7: return [4 /*yield*/, (0, promises_1.rm)(this.objectPath(id), { force: true })];
                    case 8:
                        _c.sent();
                        // A pack is an append-only file, so the only way to remove one object from
                        // it is to write the pack again without that object.
                        return [4 /*yield*/, this.loadPackIndexes()];
                    case 9:
                        // A pack is an append-only file, so the only way to remove one object from
                        // it is to write the pack again without that object.
                        _c.sent();
                        if (!this.packs.has(id)) return [3 /*break*/, 11];
                        return [4 /*yield*/, this.rebuildPacks(new Set(__spreadArray([], this.packs.keys(), true).filter(function (packed) { return packed !== id; })))];
                    case 10:
                        _c.sent();
                        _c.label = 11;
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    ObjectStore.prototype.cacheSet = function (id, buffer) {
        if (buffer.byteLength > this.lruMaxEntryBytes)
            return;
        var existing = this.lru.get(id);
        if (existing)
            this.lruBytes -= existing.byteLength;
        this.lru.delete(id);
        this.lru.set(id, buffer);
        this.lruBytes += buffer.byteLength;
        while (this.lruBytes > this.lruMaxBytes && this.lru.size > 0) {
            var _a = this.lru.entries().next().value, oldest = _a[0], value = _a[1];
            this.lru.delete(oldest);
            this.lruBytes -= value.byteLength;
        }
    };
    ObjectStore.prototype.mapConcurrent = function (items, limit, fn) {
        return __awaiter(this, void 0, void 0, function () {
            var results, next, workers;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = new Array(items.length);
                        next = 0;
                        workers = Array.from({ length: Math.min(limit, items.length) }, function () { return __awaiter(_this, void 0, void 0, function () {
                            var index, _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        if (!true) return [3 /*break*/, 2];
                                        index = next++;
                                        if (index >= items.length)
                                            return [2 /*return*/];
                                        _a = results;
                                        _b = index;
                                        return [4 /*yield*/, fn(items[index])];
                                    case 1:
                                        _a[_b] = _c.sent();
                                        return [3 /*break*/, 0];
                                    case 2: return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(workers)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, results];
                }
            });
        });
    };
    /** Stores a small JSON metadata record under an arbitrary logical key. */
    ObjectStore.prototype.putMeta = function (key, value) {
        return __awaiter(this, void 0, void 0, function () {
            var path;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.metaDb.run("INSERT INTO metadata (namespace, key, value, updated_at)\n       VALUES (?, ?, ?, ?)\n       ON CONFLICT(namespace, key) DO UPDATE SET\n         value = excluded.value,\n         updated_at = excluded.updated_at", ["default", key, JSON.stringify(value), Date.now()]);
                        path = this.metaPath(key);
                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(path, ".."), { recursive: true, mode: 448 })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.writeFile)(path, JSON.stringify(value), { mode: 384 })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ObjectStore.prototype.getMeta = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var row, _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        row = this.metaDb
                            .query("SELECT value FROM metadata WHERE namespace = ? AND key = ?")
                            .get("default", key);
                        if (row) {
                            try {
                                return [2 /*return*/, JSON.parse(row.value)];
                            }
                            catch (_e) {
                                return [2 /*return*/, undefined];
                            }
                        }
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        _b = (_a = JSON).parse;
                        return [4 /*yield*/, (0, promises_1.readFile)(this.metaPath(key), "utf8")];
                    case 2: return [2 /*return*/, _b.apply(_a, [_d.sent()])];
                    case 3:
                        _c = _d.sent();
                        return [2 /*return*/, undefined];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ObjectStore.prototype.deleteMeta = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.metaDb.run("DELETE FROM metadata WHERE namespace = ? AND key = ?", [
                            "default",
                            key,
                        ]);
                        return [4 /*yield*/, (0, promises_1.rm)(this.metaPath(key), { force: true })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /** Compacts the SQLite metadata file after heavy delete/eviction work. */
    ObjectStore.prototype.vacuumMeta = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.metaDb.run("VACUUM");
                return [2 /*return*/];
            });
        });
    };
    /** Every object id currently in the store. */
    ObjectStore.prototype.list = function () {
        return __awaiter(this, void 0, void 0, function () {
            var ids, _i, _a, prefix, dir, _b, _c, name_1, _d, _e, id, chunkedRows, _f, chunkedRows_1, row;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        ids = new Set();
                        _i = 0;
                        return [4 /*yield*/, (0, promises_1.readdir)(this.root).catch(function () { return []; })];
                    case 1:
                        _a = _g.sent();
                        _g.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        prefix = _a[_i];
                        if (prefix.length !== 2)
                            return [3 /*break*/, 6];
                        dir = (0, node_path_1.join)(this.root, prefix);
                        _b = 0;
                        return [4 /*yield*/, (0, promises_1.readdir)(dir).catch(function () { return []; })];
                    case 3:
                        _c = _g.sent();
                        _g.label = 4;
                    case 4:
                        if (!(_b < _c.length)) return [3 /*break*/, 6];
                        name_1 = _c[_b];
                        if (name_1.startsWith(prefix))
                            ids.add(name_1);
                        _g.label = 5;
                    case 5:
                        _b++;
                        return [3 /*break*/, 4];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [4 /*yield*/, this.loadPackIndexes()];
                    case 8:
                        _g.sent();
                        for (_d = 0, _e = this.packs.keys(); _d < _e.length; _d++) {
                            id = _e[_d];
                            ids.add(id);
                        }
                        chunkedRows = this.metaDb
                            .query("SELECT key FROM metadata WHERE namespace = ? AND key LIKE ?")
                            .all("default", "chunked:%");
                        for (_f = 0, chunkedRows_1 = chunkedRows; _f < chunkedRows_1.length; _f++) {
                            row = chunkedRows_1[_f];
                            ids.add(row.key.slice("chunked:".length));
                        }
                        return [2 /*return*/, __spreadArray([], ids, true)];
                }
            });
        });
    };
    /**
     * Deletes every object not in `reachable`. Owners compute the union of what
     * they reference — checkpoint journals and sandbox snapshot indices — so this
     * never prunes a live object of another owner.
     */
    ObjectStore.prototype.collectGarbage = function (reachable) {
        return __awaiter(this, void 0, void 0, function () {
            var workerResult, allIds, _a, extendedReachable, _i, reachable_1, id, chunked, _b, _c, chunkId, unreachableIds, unreachableObjects, bytes, _d, unreachableIds_1, id, chunked, path, _e, _f, cached, keepRawIds, _g, extendedReachable_1, id;
            var _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0: return [4 /*yield*/, this.tryMaintenance({
                            op: "collectGarbage",
                            root: this.root,
                            reachable: __spreadArray([], reachable, true),
                        })];
                    case 1:
                        workerResult = _j.sent();
                        if (!workerResult) return [3 /*break*/, 3];
                        this.packsLoaded = false;
                        this.packs.clear();
                        this.lru.clear();
                        this.lruBytes = 0;
                        return [4 /*yield*/, this.loadPackIndexes()];
                    case 2:
                        _j.sent();
                        return [2 /*return*/, workerResult];
                    case 3: return [4 /*yield*/, this.loadPackIndexes()];
                    case 4:
                        _j.sent();
                        _a = Set.bind;
                        return [4 /*yield*/, this.list()];
                    case 5:
                        allIds = new (_a.apply(Set, [void 0, _j.sent()]))();
                        extendedReachable = new Set(reachable);
                        _i = 0, reachable_1 = reachable;
                        _j.label = 6;
                    case 6:
                        if (!(_i < reachable_1.length)) return [3 /*break*/, 9];
                        id = reachable_1[_i];
                        return [4 /*yield*/, this.getMeta("chunked:".concat(id))];
                    case 7:
                        chunked = _j.sent();
                        if (!chunked)
                            return [3 /*break*/, 8];
                        extendedReachable.add(chunked.manifestId);
                        for (_b = 0, _c = (_h = chunked.chunks) !== null && _h !== void 0 ? _h : []; _b < _c.length; _b++) {
                            chunkId = _c[_b];
                            extendedReachable.add(chunkId);
                        }
                        _j.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 6];
                    case 9:
                        unreachableIds = __spreadArray([], allIds, true).filter(function (id) { return !extendedReachable.has(id); });
                        unreachableObjects = 0;
                        bytes = 0;
                        _d = 0, unreachableIds_1 = unreachableIds;
                        _j.label = 10;
                    case 10:
                        if (!(_d < unreachableIds_1.length)) return [3 /*break*/, 20];
                        id = unreachableIds_1[_d];
                        return [4 /*yield*/, this.getMeta("chunked:".concat(id))];
                    case 11:
                        chunked = _j.sent();
                        if (!chunked) return [3 /*break*/, 13];
                        return [4 /*yield*/, this.deleteMeta("chunked:".concat(id))];
                    case 12:
                        _j.sent();
                        unreachableObjects++;
                        return [3 /*break*/, 19];
                    case 13:
                        path = this.objectPath(id);
                        _j.label = 14;
                    case 14:
                        _j.trys.push([14, 16, , 17]);
                        _e = bytes;
                        return [4 /*yield*/, (0, promises_1.stat)(path)];
                    case 15:
                        bytes = _e + (_j.sent()).size;
                        return [3 /*break*/, 17];
                    case 16:
                        _f = _j.sent();
                        return [3 /*break*/, 19];
                    case 17: return [4 /*yield*/, (0, promises_1.rm)(path, { force: true })];
                    case 18:
                        _j.sent();
                        cached = this.lru.get(id);
                        if (cached) {
                            this.lru.delete(id);
                            this.lruBytes -= cached.byteLength;
                        }
                        unreachableObjects++;
                        _j.label = 19;
                    case 19:
                        _d++;
                        return [3 /*break*/, 10];
                    case 20:
                        keepRawIds = new Set();
                        _g = 0, extendedReachable_1 = extendedReachable;
                        _j.label = 21;
                    case 21:
                        if (!(_g < extendedReachable_1.length)) return [3 /*break*/, 24];
                        id = extendedReachable_1[_g];
                        return [4 /*yield*/, this.getMeta("chunked:".concat(id))];
                    case 22:
                        if (_j.sent())
                            return [3 /*break*/, 23];
                        keepRawIds.add(id);
                        _j.label = 23;
                    case 23:
                        _g++;
                        return [3 /*break*/, 21];
                    case 24: return [4 /*yield*/, this.rebuildPacks(keepRawIds)];
                    case 25:
                        _j.sent();
                        return [2 /*return*/, { unreachableObjects: unreachableObjects, bytes: bytes }];
                }
            });
        });
    };
    ObjectStore.prototype.rebuildPacks = function (keepIds) {
        return __awaiter(this, void 0, void 0, function () {
            var oldPackFiles, packDir, _i, oldPackFiles_1, file, oldIndexes, _a, _b, file, stamp, packFile, indexEntries, keepIdList, originals, originalById, fd, offset, lastId, lastOriginal, _c, keepIds_1, id, original, delta, baseId, baseIdBuffer, header, compressed, idBuffer, header, error_1, _d, oldPackFiles_2, file;
            var _this = this;
            var _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, this.loadPackIndexes()];
                    case 1:
                        _g.sent();
                        oldPackFiles = new Set(__spreadArray([], this.packs.values(), true).map(function (entry) { return entry.packFile; }));
                        packDir = (0, node_path_1.join)(this.root, "packs");
                        return [4 /*yield*/, (0, promises_1.mkdir)(packDir, { recursive: true, mode: 448 })];
                    case 2:
                        _g.sent();
                        if (!!keepIds.size) return [3 /*break*/, 12];
                        _i = 0, oldPackFiles_1 = oldPackFiles;
                        _g.label = 3;
                    case 3:
                        if (!(_i < oldPackFiles_1.length)) return [3 /*break*/, 6];
                        file = oldPackFiles_1[_i];
                        return [4 /*yield*/, (0, promises_1.rm)(file, { force: true })];
                    case 4:
                        _g.sent();
                        (_e = this.nativeIndexes.get(file)) === null || _e === void 0 ? void 0 : _e.free();
                        _g.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [4 /*yield*/, (0, promises_1.readdir)(packDir).catch(function () { return []; })];
                    case 7:
                        oldIndexes = _g.sent();
                        _a = 0, _b = oldIndexes.filter(function (name) { return name.endsWith(".idx.json") || name.endsWith(".idx"); });
                        _g.label = 8;
                    case 8:
                        if (!(_a < _b.length)) return [3 /*break*/, 11];
                        file = _b[_a];
                        return [4 /*yield*/, (0, promises_1.rm)((0, node_path_1.join)(packDir, file), { force: true })];
                    case 9:
                        _g.sent();
                        _g.label = 10;
                    case 10:
                        _a++;
                        return [3 /*break*/, 8];
                    case 11:
                        this.nativeIndexes.clear();
                        this.packs.clear();
                        this.packsLoaded = false;
                        return [2 /*return*/];
                    case 12:
                        stamp = Date.now().toString(36);
                        packFile = (0, node_path_1.join)(packDir, "pack-".concat(stamp, ".pack"));
                        indexEntries = [];
                        keepIdList = __spreadArray([], keepIds, true);
                        return [4 /*yield*/, this.mapConcurrent(keepIdList, 4, function (id) { return __awaiter(_this, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _b.trys.push([0, 2, , 4]);
                                            return [4 /*yield*/, (0, promises_1.readFile)(this.objectPath(id))];
                                        case 1: return [2 /*return*/, _b.sent()];
                                        case 2:
                                            _a = _b.sent();
                                            return [4 /*yield*/, this.packGet(id)];
                                        case 3: return [2 /*return*/, _b.sent()];
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 13:
                        originals = _g.sent();
                        originalById = new Map(originals.map(function (original, index) { return [keepIdList[index], original]; }));
                        return [4 /*yield*/, (0, promises_1.open)(packFile, "w")];
                    case 14:
                        fd = _g.sent();
                        return [4 /*yield*/, fd.write(this.packMagic)];
                    case 15:
                        _g.sent();
                        return [4 /*yield*/, fd.write(Buffer.from([this.packVersion]))];
                    case 16:
                        _g.sent();
                        offset = this.packMagic.length + 1;
                        _g.label = 17;
                    case 17:
                        _g.trys.push([17, 28, , 31]);
                        _c = 0, keepIds_1 = keepIds;
                        _g.label = 18;
                    case 18:
                        if (!(_c < keepIds_1.length)) return [3 /*break*/, 26];
                        id = keepIds_1[_c];
                        original = originalById.get(id);
                        delta = lastOriginal && this.deltaSize(original, lastOriginal)
                            ? this.computeDelta(lastOriginal, original)
                            : undefined;
                        if (!delta) return [3 /*break*/, 21];
                        baseId = lastId;
                        baseIdBuffer = Buffer.from(baseId, "utf8");
                        header = Buffer.alloc(1 + 4 + baseIdBuffer.length + 4 + 4);
                        header.writeUInt8(1, 0);
                        header.writeUInt32LE(baseIdBuffer.length, 1);
                        baseIdBuffer.copy(header, 5);
                        header.writeUInt32LE(original.length, 5 + baseIdBuffer.length);
                        header.writeUInt32LE(delta.bytes.length, 9 + baseIdBuffer.length);
                        return [4 /*yield*/, fd.write(header)];
                    case 19:
                        _g.sent();
                        return [4 /*yield*/, fd.write(delta.bytes)];
                    case 20:
                        _g.sent();
                        indexEntries.push({
                            id: id,
                            offset: offset,
                            dataOffset: offset + header.length,
                            origLen: original.length,
                            compLen: 0,
                            kind: 1,
                            baseId: baseId,
                            deltaLen: delta.bytes.length,
                        });
                        offset += header.length + delta.bytes.length;
                        return [3 /*break*/, 24];
                    case 21:
                        compressed = (0, node_zlib_1.deflateSync)(original);
                        idBuffer = Buffer.from(id, "utf8");
                        header = Buffer.alloc(1 + 4 + idBuffer.length + 4 + 4);
                        header.writeUInt8(0, 0);
                        header.writeUInt32LE(idBuffer.length, 1);
                        idBuffer.copy(header, 5);
                        header.writeUInt32LE(original.length, 5 + idBuffer.length);
                        header.writeUInt32LE(compressed.length, 9 + idBuffer.length);
                        return [4 /*yield*/, fd.write(header)];
                    case 22:
                        _g.sent();
                        return [4 /*yield*/, fd.write(compressed)];
                    case 23:
                        _g.sent();
                        indexEntries.push({
                            id: id,
                            offset: offset,
                            dataOffset: offset + header.length,
                            origLen: original.length,
                            compLen: compressed.length,
                            kind: 0,
                        });
                        offset += header.length + compressed.length;
                        _g.label = 24;
                    case 24:
                        lastId = id;
                        lastOriginal = original;
                        _g.label = 25;
                    case 25:
                        _c++;
                        return [3 /*break*/, 18];
                    case 26: return [4 /*yield*/, fd.close()];
                    case 27:
                        _g.sent();
                        return [3 /*break*/, 31];
                    case 28:
                        error_1 = _g.sent();
                        return [4 /*yield*/, fd.close().catch(function () { return undefined; })];
                    case 29:
                        _g.sent();
                        return [4 /*yield*/, (0, promises_1.rm)(packFile, { force: true })];
                    case 30:
                        _g.sent();
                        throw error_1;
                    case 31: return [4 /*yield*/, this.writeBinaryIndex(packFile, indexEntries)];
                    case 32:
                        _g.sent();
                        _d = 0, oldPackFiles_2 = oldPackFiles;
                        _g.label = 33;
                    case 33:
                        if (!(_d < oldPackFiles_2.length)) return [3 /*break*/, 38];
                        file = oldPackFiles_2[_d];
                        return [4 /*yield*/, (0, promises_1.rm)(file, { force: true })];
                    case 34:
                        _g.sent();
                        return [4 /*yield*/, (0, promises_1.rm)(file.replace(/\.pack$/, ".idx.json"), { force: true })];
                    case 35:
                        _g.sent();
                        return [4 /*yield*/, (0, promises_1.rm)(file.replace(/\.pack$/, ".idx"), { force: true })];
                    case 36:
                        _g.sent();
                        (_f = this.nativeIndexes.get(file)) === null || _f === void 0 ? void 0 : _f.free();
                        this.nativeIndexes.delete(file);
                        _g.label = 37;
                    case 37:
                        _d++;
                        return [3 /*break*/, 33];
                    case 38:
                        this.packs.clear();
                        this.packsLoaded = false;
                        return [4 /*yield*/, this.loadPackIndexes()];
                    case 39:
                        _g.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ObjectStore.prototype.tryMaintenance = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var runObjectStoreMaintenance, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (objectStoreWorkerDisabled())
                            return [2 /*return*/, undefined];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./object-store-worker-client"); })];
                    case 2:
                        runObjectStoreMaintenance = (_b.sent()).runObjectStoreMaintenance;
                        return [4 /*yield*/, runObjectStoreMaintenance(request)];
                    case 3: return [2 /*return*/, _b.sent()];
                    case 4:
                        _a = _b.sent();
                        return [2 /*return*/, undefined];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Writes a pack file containing loose objects and removes the loose copies.
     * This is the Phase C compaction entry point; random reads still work
     * through the pack index.
     */
    ObjectStore.prototype.compact = function () {
        return __awaiter(this, void 0, void 0, function () {
            var looseIds, workerResult, packDir, stamp, packFile, indexEntries, looseOriginals, originalById, fd, offset, totalBytes, lastId, lastOriginal, _i, looseIds_1, id, original, delta, baseId, baseIdBuffer, header, compressed, idBuffer, header, error_2, _a, looseIds_2, id;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.listLoose()];
                    case 1:
                        looseIds = _b.sent();
                        if (!looseIds.length)
                            return [2 /*return*/, { packed: 0, bytes: 0, packFile: "" }];
                        return [4 /*yield*/, this.tryMaintenance({ op: "compact", root: this.root })];
                    case 2:
                        workerResult = _b.sent();
                        if (!workerResult) return [3 /*break*/, 4];
                        this.packsLoaded = false;
                        this.packs.clear();
                        this.lru.clear();
                        this.lruBytes = 0;
                        return [4 /*yield*/, this.loadPackIndexes()];
                    case 3:
                        _b.sent();
                        return [2 /*return*/, workerResult];
                    case 4:
                        packDir = (0, node_path_1.join)(this.root, "packs");
                        return [4 /*yield*/, (0, promises_1.mkdir)(packDir, { recursive: true, mode: 448 })];
                    case 5:
                        _b.sent();
                        stamp = Date.now().toString(36);
                        packFile = (0, node_path_1.join)(packDir, "pack-".concat(stamp, ".pack"));
                        indexEntries = [];
                        return [4 /*yield*/, this.mapConcurrent(looseIds, 4, function (id) {
                                return (0, promises_1.readFile)(_this.objectPath(id));
                            })];
                    case 6:
                        looseOriginals = _b.sent();
                        originalById = new Map(looseOriginals.map(function (original, index) { return [looseIds[index], original]; }));
                        return [4 /*yield*/, (0, promises_1.open)(packFile, "w")];
                    case 7:
                        fd = _b.sent();
                        return [4 /*yield*/, fd.write(this.packMagic)];
                    case 8:
                        _b.sent();
                        return [4 /*yield*/, fd.write(Buffer.from([this.packVersion]))];
                    case 9:
                        _b.sent();
                        offset = this.packMagic.length + 1;
                        totalBytes = 0;
                        _b.label = 10;
                    case 10:
                        _b.trys.push([10, 21, , 24]);
                        _i = 0, looseIds_1 = looseIds;
                        _b.label = 11;
                    case 11:
                        if (!(_i < looseIds_1.length)) return [3 /*break*/, 19];
                        id = looseIds_1[_i];
                        original = originalById.get(id);
                        delta = lastOriginal && this.deltaSize(original, lastOriginal)
                            ? this.computeDelta(lastOriginal, original)
                            : undefined;
                        if (!delta) return [3 /*break*/, 14];
                        baseId = lastId;
                        baseIdBuffer = Buffer.from(baseId, "utf8");
                        header = Buffer.alloc(1 + 4 + baseIdBuffer.length + 4 + 4);
                        header.writeUInt8(1, 0);
                        header.writeUInt32LE(baseIdBuffer.length, 1);
                        baseIdBuffer.copy(header, 5);
                        header.writeUInt32LE(original.length, 5 + baseIdBuffer.length);
                        header.writeUInt32LE(delta.bytes.length, 9 + baseIdBuffer.length);
                        return [4 /*yield*/, fd.write(header)];
                    case 12:
                        _b.sent();
                        return [4 /*yield*/, fd.write(delta.bytes)];
                    case 13:
                        _b.sent();
                        indexEntries.push({
                            id: id,
                            offset: offset,
                            dataOffset: offset + header.length,
                            origLen: original.length,
                            compLen: 0,
                            kind: 1,
                            baseId: baseId,
                            deltaLen: delta.bytes.length,
                        });
                        offset += header.length + delta.bytes.length;
                        return [3 /*break*/, 17];
                    case 14:
                        compressed = (0, node_zlib_1.deflateSync)(original);
                        idBuffer = Buffer.from(id, "utf8");
                        header = Buffer.alloc(1 + 4 + idBuffer.length + 4 + 4);
                        header.writeUInt8(0, 0);
                        header.writeUInt32LE(idBuffer.length, 1);
                        idBuffer.copy(header, 5);
                        header.writeUInt32LE(original.length, 5 + idBuffer.length);
                        header.writeUInt32LE(compressed.length, 9 + idBuffer.length);
                        return [4 /*yield*/, fd.write(header)];
                    case 15:
                        _b.sent();
                        return [4 /*yield*/, fd.write(compressed)];
                    case 16:
                        _b.sent();
                        indexEntries.push({
                            id: id,
                            offset: offset,
                            dataOffset: offset + header.length,
                            origLen: original.length,
                            compLen: compressed.length,
                            kind: 0,
                        });
                        offset += header.length + compressed.length;
                        _b.label = 17;
                    case 17:
                        totalBytes += original.length;
                        lastId = id;
                        lastOriginal = original;
                        _b.label = 18;
                    case 18:
                        _i++;
                        return [3 /*break*/, 11];
                    case 19: return [4 /*yield*/, fd.close()];
                    case 20:
                        _b.sent();
                        return [3 /*break*/, 24];
                    case 21:
                        error_2 = _b.sent();
                        return [4 /*yield*/, fd.close().catch(function () { return undefined; })];
                    case 22:
                        _b.sent();
                        return [4 /*yield*/, (0, promises_1.rm)(packFile, { force: true })];
                    case 23:
                        _b.sent();
                        throw error_2;
                    case 24: return [4 /*yield*/, this.writeBinaryIndex(packFile, indexEntries)];
                    case 25:
                        _b.sent();
                        this.packsLoaded = false;
                        return [4 /*yield*/, this.loadPackIndexes()];
                    case 26:
                        _b.sent();
                        _a = 0, looseIds_2 = looseIds;
                        _b.label = 27;
                    case 27:
                        if (!(_a < looseIds_2.length)) return [3 /*break*/, 30];
                        id = looseIds_2[_a];
                        return [4 /*yield*/, (0, promises_1.rm)(this.objectPath(id), { force: true })];
                    case 28:
                        _b.sent();
                        this.lru.delete(id);
                        _b.label = 29;
                    case 29:
                        _a++;
                        return [3 /*break*/, 27];
                    case 30: return [2 /*return*/, { packed: looseIds.length, bytes: totalBytes, packFile: packFile }];
                }
            });
        });
    };
    ObjectStore.prototype.loadPackIndexes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var packDir, files, _i, files_1, file, packFile, entries, _a, _b, _c, _d, _e, _f, entries_1, entry, _g;
            var _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        if (this.packsLoaded)
                            return [2 /*return*/];
                        this.packsLoaded = true;
                        this.packBloom.fill(0);
                        this.packBloomInitialized = false;
                        this.nativeIndexes.clear();
                        packDir = (0, node_path_1.join)(this.root, "packs");
                        return [4 /*yield*/, (0, promises_1.readdir)(packDir).catch(function () { return []; })];
                    case 1:
                        files = _j.sent();
                        _i = 0, files_1 = files;
                        _j.label = 2;
                    case 2:
                        if (!(_i < files_1.length)) return [3 /*break*/, 14];
                        file = files_1[_i];
                        packFile = file.endsWith(".idx")
                            ? (0, node_path_1.join)(packDir, file.replace(/\.idx$/, ".pack"))
                            : file.endsWith(".idx.json")
                                ? (0, node_path_1.join)(packDir, file.replace(/\.idx\.json$/, ".pack"))
                                : undefined;
                        if (!packFile)
                            return [3 /*break*/, 13];
                        entries = void 0;
                        _j.label = 3;
                    case 3:
                        _j.trys.push([3, 12, , 13]);
                        if (!file.endsWith(".idx")) return [3 /*break*/, 5];
                        _b = this.readBinaryIndex;
                        return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(packDir, file))];
                    case 4:
                        _a = _b.apply(this, [_j.sent()]);
                        return [3 /*break*/, 7];
                    case 5:
                        _d = (_c = JSON).parse;
                        return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(packDir, file), "utf8")];
                    case 6:
                        _a = _d.apply(_c, [_j.sent()]);
                        _j.label = 7;
                    case 7:
                        entries = _a;
                        _j.label = 8;
                    case 8:
                        _j.trys.push([8, 10, , 11]);
                        return [4 /*yield*/, (0, promises_1.stat)(packFile)];
                    case 9:
                        _j.sent();
                        return [3 /*break*/, 11];
                    case 10:
                        _e = _j.sent();
                        return [3 /*break*/, 13];
                    case 11:
                        if (file.endsWith(".idx") && (0, native_index_1.nativePackIndexAvailable)()) {
                            try {
                                this.nativeIndexes.set(packFile, new native_index_1.NativePackIndex(packFile));
                            }
                            catch (_k) {
                                // Native module optional; JS binary parser remains authoritative.
                            }
                        }
                        for (_f = 0, entries_1 = entries; _f < entries_1.length; _f++) {
                            entry = entries_1[_f];
                            this.packs.set(entry.id, __assign(__assign({ packFile: packFile, offset: entry.offset, dataOffset: entry.dataOffset, origLen: entry.origLen, compLen: entry.compLen, kind: (_h = entry.kind) !== null && _h !== void 0 ? _h : 0 }, (entry.baseId ? { baseId: entry.baseId } : {})), (entry.deltaLen !== undefined
                                ? { deltaLen: entry.deltaLen }
                                : {})));
                            this.bloomSet(entry.id);
                        }
                        return [3 /*break*/, 13];
                    case 12:
                        _g = _j.sent();
                        return [3 /*break*/, 13];
                    case 13:
                        _i++;
                        return [3 /*break*/, 2];
                    case 14:
                        this.packBloomInitialized = true;
                        return [2 /*return*/];
                }
            });
        });
    };
    ObjectStore.prototype.readBinaryIndex = function (buffer) {
        if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "NDX1")
            throw new Error("invalid binary pack index");
        var count = buffer.readUInt32LE(8);
        var offset = 12;
        var entries = [];
        for (var i = 0; i < count; i++) {
            var idLen = buffer.readUInt32LE(offset);
            offset += 4;
            var id = buffer.toString("utf8", offset, offset + idLen);
            offset += idLen;
            var recOffset = buffer.readUInt32LE(offset);
            var dataOffset = buffer.readUInt32LE(offset + 4);
            var origLen = buffer.readUInt32LE(offset + 8);
            var compLen = buffer.readUInt32LE(offset + 12);
            var kind = buffer[offset + 16];
            offset += 17;
            var baseId = void 0;
            var deltaLen = void 0;
            if (kind === 1) {
                var baseLen = buffer.readUInt32LE(offset);
                offset += 4;
                baseId = buffer.toString("utf8", offset, offset + baseLen);
                offset += baseLen;
                deltaLen = buffer.readUInt32LE(offset);
                offset += 4;
            }
            entries.push(__assign(__assign({ id: id, offset: recOffset, dataOffset: dataOffset, origLen: origLen, compLen: compLen, kind: kind }, (baseId ? { baseId: baseId } : {})), (deltaLen !== undefined ? { deltaLen: deltaLen } : {})));
        }
        return entries;
    };
    ObjectStore.prototype.writeBinaryIndex = function (packFile, entries) {
        return __awaiter(this, void 0, void 0, function () {
            var indexPath, buffers, _i, entries_2, entry, idBuffer, baseIdBuffer, header, o;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        indexPath = packFile.replace(/\.pack$/, ".idx");
                        buffers = [Buffer.from("NDX1", "ascii"), Buffer.alloc(8)];
                        buffers[1].writeUInt32LE(1, 0);
                        buffers[1].writeUInt32LE(entries.length, 4);
                        for (_i = 0, entries_2 = entries; _i < entries_2.length; _i++) {
                            entry = entries_2[_i];
                            idBuffer = Buffer.from(entry.id, "utf8");
                            baseIdBuffer = entry.baseId
                                ? Buffer.from(entry.baseId, "utf8")
                                : undefined;
                            header = Buffer.alloc(4 +
                                idBuffer.length +
                                4 +
                                4 +
                                4 +
                                4 +
                                1 +
                                (entry.kind === 1 ? 4 + ((_a = baseIdBuffer === null || baseIdBuffer === void 0 ? void 0 : baseIdBuffer.length) !== null && _a !== void 0 ? _a : 0) + 4 : 0));
                            o = 0;
                            header.writeUInt32LE(idBuffer.length, o);
                            o += 4;
                            idBuffer.copy(header, o);
                            o += idBuffer.length;
                            header.writeUInt32LE(entry.offset, o);
                            o += 4;
                            header.writeUInt32LE(entry.dataOffset, o);
                            o += 4;
                            header.writeUInt32LE(entry.origLen, o);
                            o += 4;
                            header.writeUInt32LE(entry.compLen, o);
                            o += 4;
                            header.writeUInt8(entry.kind, o);
                            o += 1;
                            if (entry.kind === 1) {
                                header.writeUInt32LE((_b = baseIdBuffer === null || baseIdBuffer === void 0 ? void 0 : baseIdBuffer.length) !== null && _b !== void 0 ? _b : 0, o);
                                o += 4;
                                if (baseIdBuffer)
                                    baseIdBuffer.copy(header, o);
                                o += (_c = baseIdBuffer === null || baseIdBuffer === void 0 ? void 0 : baseIdBuffer.length) !== null && _c !== void 0 ? _c : 0;
                                header.writeUInt32LE((_d = entry.deltaLen) !== null && _d !== void 0 ? _d : 0, o);
                            }
                            buffers.push(header);
                        }
                        return [4 /*yield*/, (0, promises_1.writeFile)(indexPath, Buffer.concat(buffers), { mode: 384 })];
                    case 1:
                        _e.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ObjectStore.prototype.deltaSize = function (current, base) {
        if (current.length < 64 || base.length < 64)
            return false;
        var delta = this.computeDelta(base, current).bytes;
        // Only use delta when the instruction stream is meaningfully smaller
        // than shipping the whole object as a full zlib record.
        return delta.length < current.length * 0.7;
    };
    ObjectStore.prototype.computeDelta = function (base, current) {
        var instructions = [];
        var literal = [];
        var i = 0;
        var minMatch = 8;
        var window = 16;
        var baseWindows = new Map();
        for (var pos = 0; pos + window <= base.length; pos++) {
            baseWindows.set(base.subarray(pos, pos + window).toString("latin1"), pos);
        }
        var flushLiteral = function () {
            if (!literal.length)
                return;
            var buf = Buffer.from(literal);
            var head = Buffer.alloc(5);
            head.writeUInt8(1, 0);
            head.writeUInt32LE(buf.length, 1);
            instructions.push(head, buf);
            literal.length = 0;
        };
        while (i < current.length) {
            var bestLen = 0;
            var bestPos = 0;
            if (i + window <= current.length) {
                var key = current.subarray(i, i + window).toString("latin1");
                var candidate = baseWindows.get(key);
                if (candidate !== undefined) {
                    var pos = candidate;
                    var len = window;
                    while (i + len < current.length &&
                        pos + len < base.length &&
                        base[pos + len] === current[i + len])
                        len++;
                    bestLen = len;
                    bestPos = pos;
                }
            }
            if (bestLen >= minMatch) {
                flushLiteral();
                var head = Buffer.alloc(9);
                head.writeUInt8(0, 0);
                head.writeUInt32LE(bestPos, 1);
                head.writeUInt32LE(bestLen, 5);
                instructions.push(head);
                i += bestLen;
            }
            else {
                literal.push(current[i]);
                i++;
            }
        }
        flushLiteral();
        return { bytes: Buffer.concat(instructions) };
    };
    ObjectStore.prototype.applyDelta = function (base, delta, expectedLen) {
        var parts = [];
        var offset = 0;
        while (offset < delta.length) {
            var op = delta[offset++];
            if (op === 0) {
                var pos = delta.readUInt32LE(offset);
                var len = delta.readUInt32LE(offset + 4);
                offset += 8;
                parts.push(base.subarray(pos, pos + len));
            }
            else if (op === 1) {
                var len = delta.readUInt32LE(offset);
                offset += 4;
                parts.push(delta.subarray(offset, offset + len));
                offset += len;
            }
            else {
                throw new Error("unknown delta op ".concat(op));
            }
        }
        var original = Buffer.concat(parts);
        if (original.length !== expectedLen)
            throw new Error("delta result length mismatch");
        return original;
    };
    ObjectStore.prototype.findNativeEntry = function (id) {
        for (var _i = 0, _a = this.nativeIndexes; _i < _a.length; _i++) {
            var _b = _a[_i], packFile = _b[0], native = _b[1];
            var found = native.find(id);
            if (found)
                return __assign(__assign({}, found), { packFile: packFile });
        }
        return undefined;
    };
    ObjectStore.prototype.packGet = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var nativeEntry, entry, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.loadPackIndexes()];
                    case 1:
                        _a.sent();
                        nativeEntry = this.findNativeEntry(id);
                        if (!(nativeEntry && nativeEntry.kind === 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.readPackEntry(id, {
                                packFile: nativeEntry.packFile,
                                offset: nativeEntry.offset,
                                dataOffset: nativeEntry.dataOffset,
                                origLen: nativeEntry.origLen,
                                compLen: nativeEntry.compLen,
                                kind: 0,
                            })];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        entry = this.packs.get(id);
                        if (!entry)
                            throw new Error("object not found: ".concat(id));
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 9]);
                        return [4 /*yield*/, this.readPackEntry(id, entry)];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6:
                        error_3 = _a.sent();
                        if (error_3.code !== "ENOENT")
                            throw error_3;
                        // Another ObjectStore instance may have repacked/deleted this pack.
                        this.packsLoaded = false;
                        this.packs.clear();
                        return [4 /*yield*/, this.loadPackIndexes()];
                    case 7:
                        _a.sent();
                        entry = this.packs.get(id);
                        if (!entry)
                            throw new Error("object not found: ".concat(id));
                        return [4 /*yield*/, this.readPackEntry(id, entry)];
                    case 8: return [2 /*return*/, _a.sent()];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    ObjectStore.prototype.readPackEntry = function (id, entry) {
        return __awaiter(this, void 0, void 0, function () {
            var fd, delta, base, _a, original_1, compressed, original;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.open)(entry.packFile, "r")];
                    case 1:
                        fd = _c.sent();
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, , 9, 11]);
                        if (!(entry.kind === 1)) return [3 /*break*/, 7];
                        delta = Buffer.alloc((_b = entry.deltaLen) !== null && _b !== void 0 ? _b : 0);
                        return [4 /*yield*/, fd.read(delta, 0, delta.length, entry.dataOffset)];
                    case 3:
                        _c.sent();
                        if (!entry.baseId) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.getRaw(entry.baseId)];
                    case 4:
                        _a = _c.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        _a = undefined;
                        _c.label = 6;
                    case 6:
                        base = _a;
                        if (!base)
                            throw new Error("missing delta base for ".concat(id));
                        original_1 = this.applyDelta(base, delta, entry.origLen);
                        this.cacheSet(id, original_1);
                        return [2 /*return*/, original_1];
                    case 7:
                        compressed = Buffer.alloc(entry.compLen);
                        return [4 /*yield*/, fd.read(compressed, 0, entry.compLen, entry.dataOffset)];
                    case 8:
                        _c.sent();
                        original = (0, node_zlib_1.inflateSync)(compressed);
                        if (original.length !== entry.origLen)
                            throw new Error("pack object size mismatch for ".concat(id));
                        this.cacheSet(id, original);
                        return [2 /*return*/, original];
                    case 9: return [4 /*yield*/, fd.close()];
                    case 10:
                        _c.sent();
                        return [7 /*endfinally*/];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    ObjectStore.prototype.listLoose = function () {
        return __awaiter(this, void 0, void 0, function () {
            var ids, _i, _a, prefix, dir, _b, _c, name_2;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        ids = [];
                        _i = 0;
                        return [4 /*yield*/, (0, promises_1.readdir)(this.root).catch(function () { return []; })];
                    case 1:
                        _a = _d.sent();
                        _d.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        prefix = _a[_i];
                        if (prefix.length !== 2)
                            return [3 /*break*/, 6];
                        dir = (0, node_path_1.join)(this.root, prefix);
                        _b = 0;
                        return [4 /*yield*/, (0, promises_1.readdir)(dir).catch(function () { return []; })];
                    case 3:
                        _c = _d.sent();
                        _d.label = 4;
                    case 4:
                        if (!(_b < _c.length)) return [3 /*break*/, 6];
                        name_2 = _c[_b];
                        if (name_2.startsWith(prefix))
                            ids.push(name_2);
                        _d.label = 5;
                    case 5:
                        _b++;
                        return [3 /*break*/, 4];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: return [2 /*return*/, ids];
                }
            });
        });
    };
    ObjectStore.prototype.objectPath = function (id) {
        return (0, node_path_1.join)(this.root, id.slice(0, 2), id);
    };
    ObjectStore.prototype.metaPath = function (key) {
        return (0, node_path_1.join)(this.root, ".meta", Buffer.from(key).toString("base64url") + ".json");
    };
    return ObjectStore;
}());
exports.ObjectStore = ObjectStore;
