"use strict";
/**
 * The cache fabric (RINA study: an engine-level cache for memory AND
 * computation — retrieval is not always needed, and neither is recompute).
 *
 * Three design laws from the study are structural here, not advisory:
 *
 * 1. **Cacheability is an explicit classification.** A kind may only register
 *    with `deterministic: true` — the literal type makes the decision
 *    compile-time, so an unclassified kind cannot enter the registry at all.
 * 2. **A hit carries evidence; invalidation is hash/epoch, never a TTL.**
 *    Path-scoped kinds capture evidence at compute time and revalidate it
 *    before every hit (the file's own size + mtime as recorded by the fs);
 *    tree-scoped kinds are dropped on any workspace write — no guessing
 *    when something "should" expire. A hit that is actually stale is a
 *    correctness bug, which is worse than a miss.
 * 3. *(Speculation never persists — applies to the speculative tier, not
 *    to this primitive.)*
 *
 * The journal/cache boundary from the study holds: entries here are derived
 * heat that can always be thrown away; nothing factual lives only in a
 * cache entry.
 */
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
exports.DEFAULT_CACHE_MAX_BYTES = void 0;
exports.createCacheFabric = createCacheFabric;
function defaultSizeOf(value) {
    var _a, _b;
    if (typeof value === "string")
        return Buffer.byteLength(value, "utf8");
    if (value instanceof Buffer)
        return value.byteLength;
    try {
        return (_b = (_a = JSON.stringify(value)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
    }
    catch (_c) {
        return 0;
    }
}
/** 64 MiB of cached value heat: bounded so a long session cannot leak. */
exports.DEFAULT_CACHE_MAX_BYTES = 64 * 1024 * 1024;
function createCacheFabric(options) {
    var _a;
    if (options === void 0) { options = {}; }
    var maxBytes = (_a = options.maxBytes) !== null && _a !== void 0 ? _a : exports.DEFAULT_CACHE_MAX_BYTES;
    var kinds = new Map();
    var store = new Map();
    var inflight = new Map();
    var stats = new Map();
    var totalBytes = 0;
    function freshMetrics() {
        return {
            hits: 0,
            misses: 0,
            invalidations: 0,
            evictions: 0,
            entries: 0,
            bytes: 0,
            bytesServed: 0,
        };
    }
    function slot(kindID, key) {
        return "".concat(kindID, "\0").concat(key);
    }
    function kindOf(id) {
        return id.slice(0, id.indexOf("\u0000"));
    }
    function metricsFor(kindID) {
        var record = stats.get(kindID);
        if (!record) {
            record = freshMetrics();
            stats.set(kindID, record);
        }
        return record;
    }
    function recount(kindID) {
        var record = metricsFor(kindID);
        var entries = 0;
        var bytes = 0;
        var prefix = "".concat(kindID, "\0");
        for (var _i = 0, store_1 = store; _i < store_1.length; _i++) {
            var _a = store_1[_i], id = _a[0], entry = _a[1];
            if (id.startsWith(prefix)) {
                entries += 1;
                bytes += entry.size;
            }
        }
        record.entries = entries;
        record.bytes = bytes;
    }
    function drop(kindID, id) {
        var entry = store.get(id);
        if (!entry)
            return;
        store.delete(id);
        inflight.delete(id);
        totalBytes -= entry.size;
        metricsFor(kindID).invalidations += 1;
        recount(kindID);
    }
    function evictOverBudget() {
        while (totalBytes > maxBytes && store.size > 0) {
            // Map iteration order is insertion order, and hits re-insert, so the
            // first key is the least recently used.
            var oldest = store.keys().next();
            if (oldest.done)
                return;
            var id = oldest.value;
            drop(kindOf(id), id);
            var record = metricsFor(kindOf(id));
            record.invalidations -= 1;
            record.evictions += 1;
        }
    }
    var fabric = {
        registerKind: function (kind) {
            if (kinds.has(kind.id))
                throw new Error("duplicate cache kind: ".concat(kind.id));
            if (Boolean(kind.captureEvidence) !== Boolean(kind.validEvidence))
                throw new Error("cache kind \"".concat(kind.id, "\" must capture and validate evidence together (a capture without a validator freezes values forever)"));
            if (kind.invalidation === "path" && !kind.captureEvidence)
                throw new Error("cache kind \"".concat(kind.id, "\" is path-scoped but captures no path evidence \u2014 a written file would stay hot"));
            kinds.set(kind.id, kind);
            metricsFor(kind.id);
        },
        hasKind: function (kindID) {
            return kinds.has(kindID);
        },
        compute: function (kindID, key, compute) {
            return __awaiter(this, void 0, void 0, function () {
                var kind, id, record, existing, valid, _a, flight, run;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            kind = kinds.get(kindID);
                            if (!kind)
                                throw new Error("unknown cache kind: ".concat(kindID, " (kinds must be registered and classified before use)"));
                            id = slot(kindID, key);
                            record = metricsFor(kindID);
                            existing = store.get(id);
                            if (!existing) return [3 /*break*/, 5];
                            valid = true;
                            if (!kind.validEvidence) return [3 /*break*/, 4];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, kind.validEvidence(existing.evidence, key)];
                        case 2:
                            valid = _b.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            _a = _b.sent();
                            // A validator that cannot answer is a negative answer: without
                            // proof the entry is not a hit.
                            valid = false;
                            return [3 /*break*/, 4];
                        case 4:
                            if (valid) {
                                // Re-insert: this refreshes the entry's LRU position.
                                store.delete(id);
                                store.set(id, existing);
                                record.hits += 1;
                                record.bytesServed += existing.size;
                                return [2 /*return*/, existing.value];
                            }
                            // Stale evidence is a miss, not an invalidation: nothing wrote
                            // through the hooks, the file simply moved on underneath.
                            drop(kindID, id);
                            record.invalidations -= 1;
                            _b.label = 5;
                        case 5:
                            record.misses += 1;
                            flight = inflight.get(id);
                            if (flight)
                                return [2 /*return*/, flight];
                            run = Promise.resolve()
                                .then(function () { return compute(); })
                                .then(function (value) {
                                var _a;
                                var size = ((_a = kind.sizeOf) !== null && _a !== void 0 ? _a : defaultSizeOf)(value);
                                inflight.delete(id);
                                if (size <= maxBytes) {
                                    // Storing is best-effort AFTER the value exists: an evidence
                                    // capture that fails (a path the kind cannot stat) means there
                                    // is no proof for a future hit, so nothing is stored — but the
                                    // computation's value still returns. A cache never gets to fail
                                    // work that already succeeded.
                                    return Promise.resolve()
                                        .then(function () {
                                        return kind.captureEvidence ? kind.captureEvidence(key) : undefined;
                                    })
                                        .then(function (evidence) {
                                        store.set(id, { value: value, evidence: evidence, size: size });
                                        totalBytes += size;
                                        recount(kindID);
                                        evictOverBudget();
                                    }, function () { return undefined; })
                                        .then(function () { return value; });
                                }
                                return value;
                            })
                                .catch(function (error) {
                                inflight.delete(id);
                                throw error;
                            });
                            inflight.set(id, run);
                            return [2 /*return*/, run];
                    }
                });
            });
        },
        invalidatePaths: function (paths) {
            var _a;
            var written = new Set(paths);
            var dropped = 0;
            for (var _i = 0, _b = __spreadArray([], store.keys(), true); _i < _b.length; _i++) {
                var id = _b[_i];
                var kindID = kindOf(id);
                var kind = kinds.get(kindID);
                if (!kind)
                    continue;
                if (kind.invalidation === "tree") {
                    // Any workspace write can change a listing or a search result.
                    drop(kindID, id);
                    dropped += 1;
                    continue;
                }
                var evidence = (_a = store.get(id)) === null || _a === void 0 ? void 0 : _a.evidence;
                if ((evidence === null || evidence === void 0 ? void 0 : evidence.path) && written.has(evidence.path)) {
                    drop(kindID, id);
                    dropped += 1;
                }
            }
            return dropped;
        },
        markTreeChanged: function () {
            var _a;
            var dropped = 0;
            for (var _i = 0, _b = __spreadArray([], store.keys(), true); _i < _b.length; _i++) {
                var id = _b[_i];
                var kindID = kindOf(id);
                if (((_a = kinds.get(kindID)) === null || _a === void 0 ? void 0 : _a.invalidation) === "tree") {
                    drop(kindID, id);
                    dropped += 1;
                }
            }
            return dropped;
        },
        metrics: function (kindID) {
            var _a;
            if (kindID)
                return _a = {}, _a[kindID] = __assign({}, metricsFor(kindID)), _a;
            var all = {};
            for (var _i = 0, _b = kinds.keys(); _i < _b.length; _i++) {
                var id = _b[_i];
                all[id] = __assign({}, metricsFor(id));
            }
            for (var _c = 0, stats_1 = stats; _c < stats_1.length; _c++) {
                var _d = stats_1[_c], id = _d[0], record = _d[1];
                if (!(id in all))
                    all[id] = __assign({}, record);
            }
            return all;
        },
    };
    return fabric;
}
