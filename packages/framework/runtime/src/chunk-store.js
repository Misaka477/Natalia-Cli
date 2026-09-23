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
exports.ChunkStore = void 0;
exports.contentDefinedChunks = contentDefinedChunks;
/**
 * Content-defined chunk store — the physical dedup layer for large checkpoint
 * payloads.
 *
 * Checkpoint journals used to inline a full workspace manifest and a full
 * context-ledger snapshot per record. Most of those bytes repeat across
 * records, so the durable representation is now split:
 *
 *   * the semantic layer (checkpoint.ts) removes the *obvious* duplication by
 *     storing only what changed (allow-list: the new context entries and the
 *     changed manifest entries);
 *   * this store removes the *non-obvious* duplication by chunking the
 *     serialized payload on content-defined boundaries and deduplicating the
 *     chunks by SHA-256. A chunk that already exists is never written twice,
 *     so a repeated tool result, a shared manifest region or an unchanged
 *     anchor band costs one copy no matter how many records reference it.
 *
 * Content-defined (rolling-hash) boundaries are what make this work across
 * versions of the same payload: appending to the front/overwriting a range
 * only reshapes the chunks near the edit, so everything else still dedupes.
 * A fixed-size split would shift every boundary and dedupe nothing.
 *
 * Physical layout (v3):
 *
 *   * `packs/pack_<n>.pack` — append-only pack files holding many chunks;
 *   * `packs/index.jsonl` — append-only `hash -> {pack, offset, length}` map;
 *   * `<xx>/<hash>` — the legacy one-file-per-chunk layout, still read as a
 *     fallback and folded into packs by `packLooseChunks()`.
 *
 * Packing keeps one directory from holding hundreds of thousands of tiny
 * files. Compaction rewrites only the packs that actually contain dead chunks,
 * atomically swaps the index, and keeps the old packs as `.stale` for a grace
 * window before reclaiming them.
 */
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
/**
 * Chunker tuning. Average 8 KiB keeps the per-chunk index small relative to
 * the payload while still giving CDC enough boundary freedom to dedupe; the
 * min/max bounds stop a pathological rolling hash from producing tiny or huge
 * chunks.
 */
var MIN_CHUNK = 2 * 1024;
var MAX_CHUNK = 64 * 1024;
var AVG_CHUNK = 8 * 1024;
var MASK = AVG_CHUNK - 1;
/** Roll to a new pack beyond this size so a single file stays readable. */
var MAX_PACK_BYTES = 64 * 1024 * 1024;
/** A compaction keeps old packs as `.stale` for this long before reclaiming. */
var STALE_PACK_GRACE_MS = 60000;
/** Deterministic gear table (LCG), so chunk boundaries are process-stable. */
var GEAR = (function () {
    var table = new Uint32Array(256);
    var x = 0x2545f491;
    for (var index = 0; index < 256; index++) {
        x ^= x << 13;
        x >>>= 0;
        x ^= x >>> 17;
        x ^= x << 5;
        x >>>= 0;
        table[index] = x >>> 0;
    }
    return table;
})();
/**
 * Splits `bytes` into content-defined chunks and returns them in order. An
 * empty payload yields no chunks (the ref then reconstructs to "").
 */
function contentDefinedChunks(bytes) {
    var chunks = [];
    var start = 0;
    var hash = 0;
    for (var index = 0; index < bytes.length; index++) {
        hash = ((hash << 1) + GEAR[bytes[index]]) >>> 0;
        var size = index - start + 1;
        if ((size >= MIN_CHUNK && (hash & MASK) === 0) || size >= MAX_CHUNK) {
            chunks.push(bytes.subarray(start, index + 1));
            start = index + 1;
            hash = 0;
        }
    }
    if (start < bytes.length)
        chunks.push(bytes.subarray(start));
    return chunks;
}
function sha256Hex(bytes) {
    return (0, node_crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function isCode(error, code) {
    return (error === null || error === void 0 ? void 0 : error.code) === code;
}
function pathExists(path) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.stat)(path)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, true];
                case 2:
                    error_1 = _a.sent();
                    if (isCode(error_1, "ENOENT"))
                        return [2 /*return*/, false];
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function sha256FileHex(path) {
    return __awaiter(this, void 0, void 0, function () {
        var bytes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.readFile)(path).catch(function (error) {
                        if (isCode(error, "ENOENT"))
                            return undefined;
                        throw error;
                    })];
                case 1:
                    bytes = _a.sent();
                    return [2 /*return*/, bytes ? sha256Hex(bytes) : undefined];
            }
        });
    });
}
/** Removes empty directories bottom-up, never touching files. */
function removeEmptyDirectories(dir) {
    return __awaiter(this, void 0, void 0, function () {
        var entries, error_2, _i, entries_1, entry;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.readdir)(dir, { withFileTypes: true })];
                case 1:
                    entries = _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    if (isCode(error_2, "ENOENT"))
                        return [2 /*return*/];
                    throw error_2;
                case 3:
                    _i = 0, entries_1 = entries;
                    _a.label = 4;
                case 4:
                    if (!(_i < entries_1.length)) return [3 /*break*/, 7];
                    entry = entries_1[_i];
                    if (!entry.isDirectory()) return [3 /*break*/, 6];
                    return [4 /*yield*/, removeEmptyDirectories((0, node_path_1.join)(dir, entry.name))];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7: return [4 /*yield*/, (0, promises_1.rmdir)(dir).catch(function (error) {
                        if (isCode(error, "ENOENT") || isCode(error, "ENOTEMPTY"))
                            return;
                        throw error;
                    })];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var rootStates = new Map();
function stateFor(root) {
    var state = rootStates.get(root);
    if (!state) {
        state = {
            index: new Map(),
            packSizes: new Map(),
            currentPack: 1,
            currentOffset: 0,
            loaded: false,
        };
        rootStates.set(root, state);
    }
    return state;
}
/** Serializes all mutations for one root, across every in-process instance. */
var rootLocks = new Map();
function withRootLock(root, work) {
    return __awaiter(this, void 0, void 0, function () {
        var previous, release, gate;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    previous = (_a = rootLocks.get(root)) !== null && _a !== void 0 ? _a : Promise.resolve();
                    gate = new Promise(function (resolve) { return (release = resolve); });
                    rootLocks.set(root, previous.then(function () { return gate; }));
                    return [4 /*yield*/, previous.catch(function () { return undefined; })];
                case 1:
                    _b.sent();
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, , 4, 5]);
                    return [4 /*yield*/, work()];
                case 3: return [2 /*return*/, _b.sent()];
                case 4:
                    release();
                    if (rootLocks.get(root) === gate)
                        rootLocks.delete(root);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function indexLine(hash, entry) {
    return "".concat(JSON.stringify({ h: hash, p: entry.pack, o: entry.offset, l: entry.length }), "\n");
}
/**
 * A git-style content-addressed chunk library. Chunks are immutable and
 * addressed by their own hash, so writes are idempotent and concurrent writers
 * can race safely.
 */
var ChunkStore = /** @class */ (function () {
    function ChunkStore(root) {
        this.root = root;
        this.packsDir = (0, node_path_1.join)(root, "packs");
        this.indexPath = (0, node_path_1.join)(this.packsDir, "index.jsonl");
        this.state = stateFor(root);
    }
    ChunkStore.prototype.looseChunkPath = function (hash) {
        return (0, node_path_1.join)(this.root, hash.slice(0, 2), hash);
    };
    ChunkStore.prototype.packPath = function (pack) {
        return (0, node_path_1.join)(this.packsDir, "pack_".concat(String(pack).padStart(6, "0"), ".pack"));
    };
    /** Loads `packs/index.jsonl` into the shared root state (once per process). */
    ChunkStore.prototype.loadState = function () {
        return __awaiter(this, void 0, void 0, function () {
            var text, error_3, _i, _a, line, parsed, h, p, o, l, packs, last;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (this.state.loaded)
                            return [2 /*return*/];
                        this.state.loaded = true;
                        this.state.index.clear();
                        this.state.packSizes.clear();
                        text = "";
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, promises_1.readFile)(this.indexPath, "utf8")];
                    case 2:
                        text = _d.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _d.sent();
                        if (isCode(error_3, "ENOENT"))
                            return [2 /*return*/];
                        throw error_3;
                    case 4:
                        for (_i = 0, _a = text.split("\n"); _i < _a.length; _i++) {
                            line = _a[_i];
                            if (!line)
                                continue;
                            parsed = void 0;
                            try {
                                parsed = JSON.parse(line);
                            }
                            catch (_e) {
                                continue;
                            }
                            h = parsed.h, p = parsed.p, o = parsed.o, l = parsed.l;
                            if (typeof h !== "string" ||
                                typeof p !== "number" ||
                                typeof o !== "number" ||
                                typeof l !== "number")
                                continue;
                            this.state.index.set(h, { pack: p, offset: o, length: l });
                            this.state.packSizes.set(p, Math.max((_b = this.state.packSizes.get(p)) !== null && _b !== void 0 ? _b : 0, o + l));
                        }
                        packs = __spreadArray([], this.state.packSizes.keys(), true).sort(function (a, b) { return a - b; });
                        last = packs.at(-1);
                        this.state.currentPack = last !== null && last !== void 0 ? last : 1;
                        this.state.currentOffset = last ? ((_c = this.state.packSizes.get(last)) !== null && _c !== void 0 ? _c : 0) : 0;
                        return [2 /*return*/];
                }
            });
        });
    };
    ChunkStore.prototype.reloadState = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.state.loaded = false;
                        return [4 /*yield*/, this.loadState()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /** Stores a payload, writing only chunks that are not already present. */
    ChunkStore.prototype.put = function (bytes) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, chunks;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        payload = Buffer.from(bytes);
                        chunks = [];
                        return [4 /*yield*/, this.loadState()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, withRootLock(this.root, function () { return __awaiter(_this, void 0, void 0, function () {
                                var _i, _a, chunk, hash, _b, offset, pack, entry;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0: return [4 /*yield*/, this.loadState()];
                                        case 1:
                                            _c.sent();
                                            _i = 0, _a = contentDefinedChunks(payload);
                                            _c.label = 2;
                                        case 2:
                                            if (!(_i < _a.length)) return [3 /*break*/, 9];
                                            chunk = _a[_i];
                                            hash = sha256Hex(chunk);
                                            _b = this.state.index.has(hash);
                                            if (_b) return [3 /*break*/, 4];
                                            return [4 /*yield*/, pathExists(this.looseChunkPath(hash))];
                                        case 3:
                                            _b = (_c.sent());
                                            _c.label = 4;
                                        case 4:
                                            // A loose legacy copy still counts as present; `packLooseChunks` folds
                                            // it into a pack later.
                                            if (_b) {
                                                chunks.push(hash);
                                                return [3 /*break*/, 8];
                                            }
                                            if (this.state.currentOffset >= MAX_PACK_BYTES) {
                                                this.state.currentPack += 1;
                                                this.state.currentOffset = 0;
                                            }
                                            return [4 /*yield*/, (0, promises_1.mkdir)(this.packsDir, { recursive: true, mode: 448 })];
                                        case 5:
                                            _c.sent();
                                            offset = this.state.currentOffset;
                                            pack = this.state.currentPack;
                                            return [4 /*yield*/, (0, promises_1.appendFile)(this.packPath(pack), chunk, { mode: 384 })];
                                        case 6:
                                            _c.sent();
                                            this.state.currentOffset += chunk.length;
                                            this.state.packSizes.set(pack, this.state.currentOffset);
                                            entry = {
                                                pack: pack,
                                                offset: offset,
                                                length: chunk.length,
                                            };
                                            this.state.index.set(hash, entry);
                                            // Index after the bytes: a crash leaves an orphaned chunk, never a
                                            // dangling reference.
                                            return [4 /*yield*/, (0, promises_1.appendFile)(this.indexPath, indexLine(hash, entry), {
                                                    mode: 384,
                                                })];
                                        case 7:
                                            // Index after the bytes: a crash leaves an orphaned chunk, never a
                                            // dangling reference.
                                            _c.sent();
                                            chunks.push(hash);
                                            _c.label = 8;
                                        case 8:
                                            _i++;
                                            return [3 /*break*/, 2];
                                        case 9: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { chunks: chunks, size: payload.length }];
                }
            });
        });
    };
    ChunkStore.prototype.readPackRange = function (entry) {
        return __awaiter(this, void 0, void 0, function () {
            var handle, buffer, bytesRead;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.open)(this.packPath(entry.pack), "r")];
                    case 1:
                        handle = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, , 4, 6]);
                        buffer = Buffer.allocUnsafe(entry.length);
                        return [4 /*yield*/, handle.read(buffer, 0, entry.length, entry.offset)];
                    case 3:
                        bytesRead = (_a.sent()).bytesRead;
                        if (bytesRead !== entry.length)
                            throw new Error("chunk read short: expected ".concat(entry.length, " bytes, got ").concat(bytesRead));
                        return [2 /*return*/, buffer];
                    case 4: return [4 /*yield*/, handle.close()];
                    case 5:
                        _a.sent();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    ChunkStore.prototype.readChunk = function (hash) {
        return __awaiter(this, void 0, void 0, function () {
            var attempt, entry, error_4, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        attempt = 0;
                        _a.label = 1;
                    case 1:
                        if (!(attempt < 2)) return [3 /*break*/, 13];
                        entry = this.state.index.get(hash);
                        if (!entry) return [3 /*break*/, 7];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 7]);
                        return [4 /*yield*/, this.readPackRange(entry)];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4:
                        error_4 = _a.sent();
                        if (!(attempt === 0 && isCode(error_4, "ENOENT"))) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.reloadState()];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 12];
                    case 6: throw error_4;
                    case 7:
                        _a.trys.push([7, 9, , 12]);
                        return [4 /*yield*/, (0, promises_1.readFile)(this.looseChunkPath(hash))];
                    case 8: return [2 /*return*/, _a.sent()];
                    case 9:
                        error_5 = _a.sent();
                        if (!(attempt === 0)) return [3 /*break*/, 11];
                        // A sibling process may have packed it since our index was loaded.
                        return [4 /*yield*/, this.reloadState()];
                    case 10:
                        // A sibling process may have packed it since our index was loaded.
                        _a.sent();
                        return [3 /*break*/, 12];
                    case 11: throw error_5;
                    case 12:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 13: throw new Error("chunk not found: ".concat(hash));
                }
            });
        });
    };
    /**
     * Streams a payload one chunk at a time, re-hashing each chunk against its
     * content address unless `verify` is disabled. Callers that write into a sink
     * never hold the whole payload; `get` preallocates one output buffer so it
     * never holds both the chunk list and a second concatenated copy.
     */
    ChunkStore.prototype.read = function (ref_1) {
        return __asyncGenerator(this, arguments, function read_1(ref, options) {
            var verify, _i, _a, hash, chunk, actual;
            var _b;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        verify = (_b = options.verify) !== null && _b !== void 0 ? _b : true;
                        return [4 /*yield*/, __await(this.loadState())];
                    case 1:
                        _c.sent();
                        _i = 0, _a = ref.chunks;
                        _c.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 10];
                        hash = _a[_i];
                        return [4 /*yield*/, __await(this.readChunk(hash))];
                    case 3:
                        chunk = _c.sent();
                        if (!(verify && sha256Hex(chunk) !== hash)) return [3 /*break*/, 6];
                        // A stale cross-process index entry: reload and retry once.
                        return [4 /*yield*/, __await(this.reloadState())];
                    case 4:
                        // A stale cross-process index entry: reload and retry once.
                        _c.sent();
                        return [4 /*yield*/, __await(this.readChunk(hash))];
                    case 5:
                        chunk = _c.sent();
                        actual = sha256Hex(chunk);
                        if (actual !== hash)
                            throw new Error("chunk ".concat(hash, " failed integrity check (content hashes to ").concat(actual, ")"));
                        _c.label = 6;
                    case 6: return [4 /*yield*/, __await(chunk)];
                    case 7: return [4 /*yield*/, _c.sent()];
                    case 8:
                        _c.sent();
                        _c.label = 9;
                    case 9:
                        _i++;
                        return [3 /*break*/, 2];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /** Rebuilds a payload, verifying per-chunk content and the total length. */
    ChunkStore.prototype.get = function (ref_1) {
        return __awaiter(this, arguments, void 0, function (ref, options) {
            var output, offset, _a, _b, _c, chunk, e_1_1;
            var _d, e_1, _e, _f;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        output = Buffer.allocUnsafe(ref.size);
                        offset = 0;
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 6, 7, 12]);
                        _a = true, _b = __asyncValues(this.read(ref, options));
                        _g.label = 2;
                    case 2: return [4 /*yield*/, _b.next()];
                    case 3:
                        if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                        _f = _c.value;
                        _a = false;
                        chunk = _f;
                        if (offset + chunk.length > ref.size)
                            throw new Error("chunk payload overruns declared size ".concat(ref.size, " at offset ").concat(offset));
                        chunk.copy(output, offset);
                        offset += chunk.length;
                        _g.label = 4;
                    case 4:
                        _a = true;
                        return [3 /*break*/, 2];
                    case 5: return [3 /*break*/, 12];
                    case 6:
                        e_1_1 = _g.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 12];
                    case 7:
                        _g.trys.push([7, , 10, 11]);
                        if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                        return [4 /*yield*/, _e.call(_b)];
                    case 8:
                        _g.sent();
                        _g.label = 9;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        if (e_1) throw e_1.error;
                        return [7 /*endfinally*/];
                    case 11: return [7 /*endfinally*/];
                    case 12:
                        if (offset !== ref.size)
                            throw new Error("chunk payload size mismatch: expected ".concat(ref.size, ", got ").concat(offset));
                        return [2 /*return*/, output];
                }
            });
        });
    };
    /** True when every chunk of the ref is present. */
    ChunkStore.prototype.has = function (ref) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, hash, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.loadState()];
                    case 1:
                        _c.sent();
                        _i = 0, _a = ref.chunks;
                        _c.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        hash = _a[_i];
                        _b = !this.state.index.has(hash);
                        if (!_b) return [3 /*break*/, 4];
                        return [4 /*yield*/, pathExists(this.looseChunkPath(hash))];
                    case 3:
                        _b = !(_c.sent());
                        _c.label = 4;
                    case 4:
                        if (_b)
                            return [2 /*return*/, false];
                        _c.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 2];
                    case 6: return [2 /*return*/, true];
                }
            });
        });
    };
    /**
     * Folds the legacy one-file-per-chunk layout into packs. Idempotent and safe
     * to run at every startup: an empty loose layout costs one directory scan.
     */
    ChunkStore.prototype.packLooseChunks = function () {
        return __awaiter(this, void 0, void 0, function () {
            var packed;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        packed = 0;
                        return [4 /*yield*/, this.loadState()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, withRootLock(this.root, function () { return __awaiter(_this, void 0, void 0, function () {
                                var entries, error_6, files, walk, _i, entries_2, entry, _a, files_1, full, hash, packedEntry, packed_1, chunk, offset, pack, packEntry, _b, entries_3, entry, shard, remaining;
                                var _this = this;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0: return [4 /*yield*/, this.loadState()];
                                        case 1:
                                            _c.sent();
                                            _c.label = 2;
                                        case 2:
                                            _c.trys.push([2, 4, , 5]);
                                            return [4 /*yield*/, (0, promises_1.readdir)(this.root, { withFileTypes: true })];
                                        case 3:
                                            entries = _c.sent();
                                            return [3 /*break*/, 5];
                                        case 4:
                                            error_6 = _c.sent();
                                            if (isCode(error_6, "ENOENT"))
                                                return [2 /*return*/];
                                            throw error_6;
                                        case 5:
                                            files = [];
                                            walk = function (dir) { return __awaiter(_this, void 0, void 0, function () {
                                                var children, error_7, _i, children_1, child, full;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0:
                                                            _a.trys.push([0, 2, , 3]);
                                                            return [4 /*yield*/, (0, promises_1.readdir)(dir, { withFileTypes: true })];
                                                        case 1:
                                                            children = _a.sent();
                                                            return [3 /*break*/, 3];
                                                        case 2:
                                                            error_7 = _a.sent();
                                                            if (isCode(error_7, "ENOENT"))
                                                                return [2 /*return*/];
                                                            throw error_7;
                                                        case 3:
                                                            _i = 0, children_1 = children;
                                                            _a.label = 4;
                                                        case 4:
                                                            if (!(_i < children_1.length)) return [3 /*break*/, 8];
                                                            child = children_1[_i];
                                                            full = (0, node_path_1.join)(dir, child.name);
                                                            if (!child.isDirectory()) return [3 /*break*/, 6];
                                                            return [4 /*yield*/, walk(full)];
                                                        case 5:
                                                            _a.sent();
                                                            return [3 /*break*/, 7];
                                                        case 6:
                                                            if (child.isFile())
                                                                files.push(full);
                                                            _a.label = 7;
                                                        case 7:
                                                            _i++;
                                                            return [3 /*break*/, 4];
                                                        case 8: return [2 /*return*/];
                                                    }
                                                });
                                            }); };
                                            _i = 0, entries_2 = entries;
                                            _c.label = 6;
                                        case 6:
                                            if (!(_i < entries_2.length)) return [3 /*break*/, 9];
                                            entry = entries_2[_i];
                                            if (!entry.isDirectory() || entry.name === "packs")
                                                return [3 /*break*/, 8];
                                            return [4 /*yield*/, walk((0, node_path_1.join)(this.root, entry.name))];
                                        case 7:
                                            _c.sent();
                                            _c.label = 8;
                                        case 8:
                                            _i++;
                                            return [3 /*break*/, 6];
                                        case 9:
                                            _a = 0, files_1 = files;
                                            _c.label = 10;
                                        case 10:
                                            if (!(_a < files_1.length)) return [3 /*break*/, 20];
                                            full = files_1[_a];
                                            hash = (0, node_path_1.basename)(full);
                                            packedEntry = this.state.index.get(hash);
                                            if (!packedEntry) return [3 /*break*/, 13];
                                            return [4 /*yield*/, this.readPackRange(packedEntry).catch(function () { return undefined; })];
                                        case 11:
                                            packed_1 = _c.sent();
                                            if (!(packed_1 && sha256Hex(packed_1) === hash)) return [3 /*break*/, 13];
                                            return [4 /*yield*/, (0, promises_1.rm)(full, { force: true }).catch(function () { return undefined; })];
                                        case 12:
                                            _c.sent();
                                            return [3 /*break*/, 19];
                                        case 13: return [4 /*yield*/, (0, promises_1.readFile)(full)];
                                        case 14:
                                            chunk = _c.sent();
                                            if (sha256Hex(chunk) !== hash)
                                                return [3 /*break*/, 19];
                                            if (this.state.currentOffset >= MAX_PACK_BYTES) {
                                                this.state.currentPack += 1;
                                                this.state.currentOffset = 0;
                                            }
                                            return [4 /*yield*/, (0, promises_1.mkdir)(this.packsDir, { recursive: true, mode: 448 })];
                                        case 15:
                                            _c.sent();
                                            offset = this.state.currentOffset;
                                            pack = this.state.currentPack;
                                            return [4 /*yield*/, (0, promises_1.appendFile)(this.packPath(pack), chunk, { mode: 384 })];
                                        case 16:
                                            _c.sent();
                                            this.state.currentOffset += chunk.length;
                                            this.state.packSizes.set(pack, this.state.currentOffset);
                                            packEntry = { pack: pack, offset: offset, length: chunk.length };
                                            this.state.index.set(hash, packEntry);
                                            return [4 /*yield*/, (0, promises_1.appendFile)(this.indexPath, indexLine(hash, packEntry), {
                                                    mode: 384,
                                                })];
                                        case 17:
                                            _c.sent();
                                            return [4 /*yield*/, (0, promises_1.rm)(full, { force: true })];
                                        case 18:
                                            _c.sent();
                                            packed += 1;
                                            _c.label = 19;
                                        case 19:
                                            _a++;
                                            return [3 /*break*/, 10];
                                        case 20:
                                            _b = 0, entries_3 = entries;
                                            _c.label = 21;
                                        case 21:
                                            if (!(_b < entries_3.length)) return [3 /*break*/, 25];
                                            entry = entries_3[_b];
                                            if (!entry.isDirectory() || entry.name === "packs")
                                                return [3 /*break*/, 24];
                                            shard = (0, node_path_1.join)(this.root, entry.name);
                                            return [4 /*yield*/, (0, promises_1.readdir)(shard).catch(function () { return ["keep"]; })];
                                        case 22:
                                            remaining = _c.sent();
                                            if (!(remaining.length === 0)) return [3 /*break*/, 24];
                                            return [4 /*yield*/, (0, promises_1.rm)(shard, { recursive: true, force: true }).catch(function () { return undefined; })];
                                        case 23:
                                            _c.sent();
                                            _c.label = 24;
                                        case 24:
                                            _b++;
                                            return [3 /*break*/, 21];
                                        case 25: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { packed: packed }];
                }
            });
        });
    };
    /**
     * Deletes every stored chunk whose hash is not in `referenced`, then
     * compacts packs that held dead chunks. Only call this with the complete set
     * of live refs (checkpoint journals plus any other owner), or live payloads
     * are lost.
     */
    ChunkStore.prototype.collectGarbage = function (referenced_1) {
        return __awaiter(this, arguments, void 0, function (referenced, dryRun, options) {
            var minAgeMs, compact, cutoff, removed, bytes, looseWalk, dead, deadByPack, _i, _a, _b, hash, entry, info, _c, dead_1, _d, entry;
            var _this = this;
            var _e, _f, _g, _h;
            if (dryRun === void 0) { dryRun = false; }
            if (options === void 0) { options = {}; }
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        minAgeMs = (_e = options.minAgeMs) !== null && _e !== void 0 ? _e : 0;
                        compact = (_f = options.compact) !== null && _f !== void 0 ? _f : true;
                        cutoff = Date.now() - minAgeMs;
                        return [4 /*yield*/, this.loadState()];
                    case 1:
                        _j.sent();
                        removed = 0;
                        bytes = 0;
                        looseWalk = function (dir) { return __awaiter(_this, void 0, void 0, function () {
                            var entries, error_8, _i, entries_4, entry, full, info;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, (0, promises_1.readdir)(dir, { withFileTypes: true })];
                                    case 1:
                                        entries = _a.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_8 = _a.sent();
                                        if (isCode(error_8, "ENOENT"))
                                            return [2 /*return*/];
                                        throw error_8;
                                    case 3:
                                        _i = 0, entries_4 = entries;
                                        _a.label = 4;
                                    case 4:
                                        if (!(_i < entries_4.length)) return [3 /*break*/, 11];
                                        entry = entries_4[_i];
                                        full = (0, node_path_1.join)(dir, entry.name);
                                        if (!entry.isDirectory()) return [3 /*break*/, 6];
                                        if (dir === this.root && entry.name === "packs")
                                            return [3 /*break*/, 10];
                                        return [4 /*yield*/, looseWalk(full)];
                                    case 5:
                                        _a.sent();
                                        return [3 /*break*/, 10];
                                    case 6:
                                        if (!entry.isFile())
                                            return [3 /*break*/, 10];
                                        if (referenced.has(entry.name))
                                            return [3 /*break*/, 10];
                                        return [4 /*yield*/, (0, promises_1.stat)(full)];
                                    case 7:
                                        info = _a.sent();
                                        if (minAgeMs > 0 && info.mtimeMs > cutoff)
                                            return [3 /*break*/, 10];
                                        if (!!dryRun) return [3 /*break*/, 9];
                                        return [4 /*yield*/, (0, promises_1.rm)(full, { force: true })];
                                    case 8:
                                        _a.sent();
                                        _a.label = 9;
                                    case 9:
                                        removed += 1;
                                        bytes += info.size;
                                        _a.label = 10;
                                    case 10:
                                        _i++;
                                        return [3 /*break*/, 4];
                                    case 11: return [2 /*return*/];
                                }
                            });
                        }); };
                        return [4 /*yield*/, looseWalk(this.root)];
                    case 2:
                        _j.sent();
                        dead = new Map();
                        deadByPack = new Map();
                        _i = 0, _a = this.state.index;
                        _j.label = 3;
                    case 3:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        _b = _a[_i], hash = _b[0], entry = _b[1];
                        if (referenced.has(hash))
                            return [3 /*break*/, 5];
                        return [4 /*yield*/, (0, promises_1.stat)(this.packPath(entry.pack)).catch(function () { return undefined; })];
                    case 4:
                        info = _j.sent();
                        if (!info) {
                            // The pack file is gone (a concurrent cross-process compaction): the
                            // entry is dead either way.
                            dead.set(hash, entry);
                            deadByPack.set(entry.pack, __spreadArray(__spreadArray([], ((_g = deadByPack.get(entry.pack)) !== null && _g !== void 0 ? _g : []), true), [
                                entry,
                            ], false));
                            return [3 /*break*/, 5];
                        }
                        if (minAgeMs > 0 && info.mtimeMs > cutoff)
                            return [3 /*break*/, 5];
                        dead.set(hash, entry);
                        deadByPack.set(entry.pack, __spreadArray(__spreadArray([], ((_h = deadByPack.get(entry.pack)) !== null && _h !== void 0 ? _h : []), true), [
                            entry,
                        ], false));
                        _j.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6:
                        for (_c = 0, dead_1 = dead; _c < dead_1.length; _c++) {
                            _d = dead_1[_c], entry = _d[1];
                            removed += 1;
                            bytes += entry.length;
                        }
                        if (!(dryRun || dead.size === 0)) return [3 /*break*/, 9];
                        if (!(!dryRun && dead.size === 0)) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.reapStalePacks(cutoff)];
                    case 7:
                        _j.sent();
                        _j.label = 8;
                    case 8: return [2 /*return*/, { removed: removed, bytes: bytes }];
                    case 9: return [4 /*yield*/, withRootLock(this.root, function () { return __awaiter(_this, void 0, void 0, function () {
                            var live, packsToRewrite, _i, _a, _b, hash, entry;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4 /*yield*/, this.loadState()];
                                    case 1:
                                        _c.sent();
                                        live = new Map();
                                        packsToRewrite = new Set();
                                        for (_i = 0, _a = this.state.index; _i < _a.length; _i++) {
                                            _b = _a[_i], hash = _b[0], entry = _b[1];
                                            if (referenced.has(hash)) {
                                                live.set(hash, entry);
                                                continue;
                                            }
                                            packsToRewrite.add(entry.pack);
                                        }
                                        if (!(compact && packsToRewrite.size > 0)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, this.compactPacks(live, packsToRewrite)];
                                    case 2:
                                        _c.sent();
                                        return [3 /*break*/, 5];
                                    case 3: 
                                    // No rewrite: drop the dead index entries, keep the packs as-is.
                                    return [4 /*yield*/, this.rewriteIndex(live)];
                                    case 4:
                                        // No rewrite: drop the dead index entries, keep the packs as-is.
                                        _c.sent();
                                        _c.label = 5;
                                    case 5: return [4 /*yield*/, this.reapStalePacks(cutoff)];
                                    case 6:
                                        _c.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 10:
                        _j.sent();
                        return [2 /*return*/, { removed: removed, bytes: bytes }];
                }
            });
        });
    };
    /** Writes `live` as the new index, atomically, and swaps the shared state. */
    ChunkStore.prototype.rewriteIndex = function (live) {
        return __awaiter(this, void 0, void 0, function () {
            var temp, contents, _i, live_1, _a, hash, entry, packs, last;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.mkdir)(this.packsDir, { recursive: true, mode: 448 })];
                    case 1:
                        _d.sent();
                        temp = "".concat(this.indexPath, ".").concat(process.pid, ".tmp");
                        contents = __spreadArray([], live, true).map(function (_a) {
                            var hash = _a[0], entry = _a[1];
                            return indexLine(hash, entry);
                        })
                            .join("");
                        return [4 /*yield*/, (0, promises_1.writeFile)(temp, contents, { mode: 384 })];
                    case 2:
                        _d.sent();
                        return [4 /*yield*/, (0, promises_1.rename)(temp, this.indexPath)];
                    case 3:
                        _d.sent();
                        this.state.index.clear();
                        this.state.packSizes.clear();
                        for (_i = 0, live_1 = live; _i < live_1.length; _i++) {
                            _a = live_1[_i], hash = _a[0], entry = _a[1];
                            this.state.index.set(hash, entry);
                            this.state.packSizes.set(entry.pack, Math.max((_b = this.state.packSizes.get(entry.pack)) !== null && _b !== void 0 ? _b : 0, entry.offset + entry.length));
                        }
                        packs = __spreadArray([], this.state.packSizes.keys(), true).sort(function (a, b) { return a - b; });
                        last = packs.at(-1);
                        this.state.currentPack = last !== null && last !== void 0 ? last : 1;
                        this.state.currentOffset = last ? ((_c = this.state.packSizes.get(last)) !== null && _c !== void 0 ? _c : 0) : 0;
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Rewrites `packsToRewrite` (each containing at least one dead chunk) into
     * fresh packs, keeping every live chunk. The old packs are renamed to
     * `.stale` before the new index is published, so a reader that is mid-flight
     * never sees a half-written pack.
     */
    ChunkStore.prototype.compactPacks = function (live, packsToRewrite) {
        return __awaiter(this, void 0, void 0, function () {
            var liveByPack, _i, live_2, _a, hash, entry, nextPack, nextOffset, rewritten, kept, _b, live_3, _c, hash, entry, _d, _e, pack, entries, _f, entries_5, _g, hash, entry, chunk, merged;
            var _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        liveByPack = new Map();
                        for (_i = 0, live_2 = live; _i < live_2.length; _i++) {
                            _a = live_2[_i], hash = _a[0], entry = _a[1];
                            liveByPack.set(entry.pack, __spreadArray(__spreadArray([], ((_h = liveByPack.get(entry.pack)) !== null && _h !== void 0 ? _h : []), true), [
                                [hash, entry],
                            ], false));
                        }
                        nextPack = Math.max.apply(Math, __spreadArray([0], __spreadArray([], this.state.packSizes.keys(), true), false)) + 1;
                        nextOffset = 0;
                        rewritten = new Map();
                        kept = new Map();
                        for (_b = 0, live_3 = live; _b < live_3.length; _b++) {
                            _c = live_3[_b], hash = _c[0], entry = _c[1];
                            if (!packsToRewrite.has(entry.pack))
                                kept.set(hash, entry);
                        }
                        _d = 0, _e = __spreadArray([], packsToRewrite, true).sort(function (a, b) { return a - b; });
                        _k.label = 1;
                    case 1:
                        if (!(_d < _e.length)) return [3 /*break*/, 10];
                        pack = _e[_d];
                        entries = (_j = liveByPack.get(pack)) !== null && _j !== void 0 ? _j : [];
                        _f = 0, entries_5 = entries;
                        _k.label = 2;
                    case 2:
                        if (!(_f < entries_5.length)) return [3 /*break*/, 7];
                        _g = entries_5[_f], hash = _g[0], entry = _g[1];
                        return [4 /*yield*/, this.readPackRange(entry)];
                    case 3:
                        chunk = _k.sent();
                        if (nextOffset >= MAX_PACK_BYTES) {
                            nextPack += 1;
                            nextOffset = 0;
                        }
                        return [4 /*yield*/, (0, promises_1.mkdir)(this.packsDir, { recursive: true, mode: 448 })];
                    case 4:
                        _k.sent();
                        return [4 /*yield*/, (0, promises_1.appendFile)(this.packPath(nextPack), chunk, { mode: 384 })];
                    case 5:
                        _k.sent();
                        rewritten.set(hash, {
                            pack: nextPack,
                            offset: nextOffset,
                            length: chunk.length,
                        });
                        nextOffset += chunk.length;
                        _k.label = 6;
                    case 6:
                        _f++;
                        return [3 /*break*/, 2];
                    case 7: 
                    // Keep the old data recoverable for the grace window.
                    return [4 /*yield*/, (0, promises_1.rename)(this.packPath(pack), "".concat(this.packPath(pack), ".stale")).catch(function (error) {
                            if (!isCode(error, "ENOENT"))
                                throw error;
                        })];
                    case 8:
                        // Keep the old data recoverable for the grace window.
                        _k.sent();
                        _k.label = 9;
                    case 9:
                        _d++;
                        return [3 /*break*/, 1];
                    case 10:
                        merged = new Map(__spreadArray(__spreadArray([], kept, true), rewritten, true));
                        return [4 /*yield*/, this.rewriteIndex(merged)];
                    case 11:
                        _k.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /** Deletes `.stale` packs older than `cutoff`. */
    ChunkStore.prototype.reapStalePacks = function (cutoff) {
        return __awaiter(this, void 0, void 0, function () {
            var entries, error_9, _i, entries_6, entry, full, info;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, promises_1.readdir)(this.packsDir, { withFileTypes: true })];
                    case 1:
                        entries = _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_9 = _a.sent();
                        if (isCode(error_9, "ENOENT"))
                            return [2 /*return*/];
                        throw error_9;
                    case 3:
                        _i = 0, entries_6 = entries;
                        _a.label = 4;
                    case 4:
                        if (!(_i < entries_6.length)) return [3 /*break*/, 8];
                        entry = entries_6[_i];
                        if (!entry.isFile() || !entry.name.endsWith(".stale"))
                            return [3 /*break*/, 7];
                        full = (0, node_path_1.join)(this.packsDir, entry.name);
                        return [4 /*yield*/, (0, promises_1.stat)(full).catch(function () { return undefined; })];
                    case 5:
                        info = _a.sent();
                        if (!info)
                            return [3 /*break*/, 7];
                        if (info.mtimeMs > cutoff)
                            return [3 /*break*/, 7];
                        return [4 /*yield*/, (0, promises_1.rm)(full, { force: true })];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 4];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Moves chunks from a legacy per-session root into this (shared) root.
     *
     * Source files are deleted only after a byte-identical target has been
     * verified. A failed copy therefore leaves the source in place; a later run
     * can retry it. Legacy session directories are removed only when empty.
     */
    ChunkStore.prototype.mergeFrom = function (legacyRoot) {
        return __awaiter(this, void 0, void 0, function () {
            var moved, skipped, walk;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        moved = 0;
                        skipped = 0;
                        walk = function (dir) { return __awaiter(_this, void 0, void 0, function () {
                            var entries, error_10, _i, entries_7, entry, full, hash, sourceHash, target, targetHash, error_11, temp, copiedHash;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, (0, promises_1.readdir)(dir, { withFileTypes: true })];
                                    case 1:
                                        entries = _a.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_10 = _a.sent();
                                        if (isCode(error_10, "ENOENT"))
                                            return [2 /*return*/];
                                        throw error_10;
                                    case 3:
                                        _i = 0, entries_7 = entries;
                                        _a.label = 4;
                                    case 4:
                                        if (!(_i < entries_7.length)) return [3 /*break*/, 25];
                                        entry = entries_7[_i];
                                        full = (0, node_path_1.join)(dir, entry.name);
                                        if (!entry.isDirectory()) return [3 /*break*/, 6];
                                        return [4 /*yield*/, walk(full)];
                                    case 5:
                                        _a.sent();
                                        return [3 /*break*/, 24];
                                    case 6:
                                        if (!entry.isFile())
                                            return [3 /*break*/, 24];
                                        hash = entry.name;
                                        if (!/^[0-9a-f]{64}$/u.test(hash)) {
                                            skipped += 1;
                                            console.warn("[checkpoint] chunk migration skipped non-hash file ".concat(full));
                                            return [3 /*break*/, 24];
                                        }
                                        return [4 /*yield*/, sha256FileHex(full)];
                                    case 7:
                                        sourceHash = _a.sent();
                                        if (sourceHash !== hash) {
                                            skipped += 1;
                                            console.warn("[checkpoint] chunk migration skipped corrupt file ".concat(full));
                                            return [3 /*break*/, 24];
                                        }
                                        target = this.looseChunkPath(hash);
                                        return [4 /*yield*/, sha256FileHex(target)];
                                    case 8:
                                        targetHash = _a.sent();
                                        if (!(targetHash !== undefined)) return [3 /*break*/, 12];
                                        if (!(targetHash === hash)) return [3 /*break*/, 10];
                                        return [4 /*yield*/, (0, promises_1.rm)(full, { force: true }).catch(function () { return undefined; })];
                                    case 9:
                                        _a.sent();
                                        skipped += 1;
                                        return [3 /*break*/, 11];
                                    case 10:
                                        skipped += 1;
                                        console.warn("[checkpoint] chunk migration kept ".concat(full, ": target ").concat(target, " is corrupt"));
                                        _a.label = 11;
                                    case 11: return [3 /*break*/, 24];
                                    case 12: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(target), { recursive: true, mode: 448 })];
                                    case 13:
                                        _a.sent();
                                        _a.label = 14;
                                    case 14:
                                        _a.trys.push([14, 16, , 23]);
                                        return [4 /*yield*/, (0, promises_1.rename)(full, target)];
                                    case 15:
                                        _a.sent();
                                        return [3 /*break*/, 23];
                                    case 16:
                                        error_11 = _a.sent();
                                        if (!isCode(error_11, "EXDEV"))
                                            throw error_11;
                                        temp = "".concat(target, ".").concat(process.pid, ".tmp");
                                        return [4 /*yield*/, (0, promises_1.copyFile)(full, temp)];
                                    case 17:
                                        _a.sent();
                                        return [4 /*yield*/, sha256FileHex(temp)];
                                    case 18:
                                        copiedHash = _a.sent();
                                        if (!(copiedHash !== hash)) return [3 /*break*/, 20];
                                        return [4 /*yield*/, (0, promises_1.rm)(temp, { force: true }).catch(function () { return undefined; })];
                                    case 19:
                                        _a.sent();
                                        throw new Error("chunk migration copy failed verification for ".concat(hash));
                                    case 20: return [4 /*yield*/, (0, promises_1.rename)(temp, target)];
                                    case 21:
                                        _a.sent();
                                        return [4 /*yield*/, (0, promises_1.rm)(full, { force: true }).catch(function () { return undefined; })];
                                    case 22:
                                        _a.sent();
                                        return [3 /*break*/, 23];
                                    case 23:
                                        moved += 1;
                                        _a.label = 24;
                                    case 24:
                                        _i++;
                                        return [3 /*break*/, 4];
                                    case 25: return [2 /*return*/];
                                }
                            });
                        }); };
                        return [4 /*yield*/, walk(legacyRoot)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, removeEmptyDirectories(legacyRoot)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { moved: moved, skipped: skipped }];
                }
            });
        });
    };
    /**
     * One-time upgrade from the per-session chunk roots of the pre-shared layout
     * (`.natalia/chunks/<sessionID>/…`) to the shared root.
     *
     * Only directories named like a Natalia session are considered legacy roots.
     * The shared `packs/` directory, two-hex shard directories, and any unknown
     * directory are never deleted. Unknown directories are left byte-for-byte.
     */
    ChunkStore.prototype.migrateLegacyRoots = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, withRootLock(this.root, function () { return __awaiter(_this, void 0, void 0, function () {
                            var entries, error_12, moved, roots, _i, entries_8, entry, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, (0, promises_1.readdir)(this.root, { withFileTypes: true })];
                                    case 1:
                                        entries = _b.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_12 = _b.sent();
                                        if (isCode(error_12, "ENOENT"))
                                            return [2 /*return*/, { moved: 0, roots: 0 }];
                                        throw error_12;
                                    case 3:
                                        moved = 0;
                                        roots = 0;
                                        _i = 0, entries_8 = entries;
                                        _b.label = 4;
                                    case 4:
                                        if (!(_i < entries_8.length)) return [3 /*break*/, 7];
                                        entry = entries_8[_i];
                                        if (!entry.isDirectory())
                                            return [3 /*break*/, 6];
                                        if (entry.name === "packs" || /^[0-9a-f]{2}$/u.test(entry.name))
                                            return [3 /*break*/, 6];
                                        if (!entry.name.startsWith("ses_")) {
                                            console.warn("[checkpoint] chunk migration left unknown directory untouched: ".concat((0, node_path_1.join)(this.root, entry.name)));
                                            return [3 /*break*/, 6];
                                        }
                                        roots += 1;
                                        _a = moved;
                                        return [4 /*yield*/, this.mergeFrom((0, node_path_1.join)(this.root, entry.name))];
                                    case 5:
                                        moved = _a + (_b.sent()).moved;
                                        _b.label = 6;
                                    case 6:
                                        _i++;
                                        return [3 /*break*/, 4];
                                    case 7: return [2 /*return*/, { moved: moved, roots: roots }];
                                }
                            });
                        }); })];
                    case 1:
                        result = _a.sent();
                        if (!(result.roots > 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.packLooseChunks()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/, result];
                }
            });
        });
    };
    return ChunkStore;
}());
exports.ChunkStore = ChunkStore;
