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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
exports.CheckpointJournal = void 0;
exports.journalNeedsMigration = journalNeedsMigration;
exports.contextMetaOf = contextMetaOf;
exports.manifestMetaOf = manifestMetaOf;
exports.migrateAllCheckpointJournals = migrateAllCheckpointJournals;
exports.pruneV2Backups = pruneV2Backups;
/**
 * Durable checkpoint journal (format v3) — semantic delta + content-defined
 * chunk storage.
 *
 * A v2 record inlined a full workspace manifest and a full context-ledger
 * snapshot. Across a long session those are ~99% redundant, which made the
 * journal — and every full-journal rewrite — grow without bound. A v3 record
 * keeps the small scalar header inline and stores the two payloads separately:
 *
 *   * **semantic layer (A):** a context or manifest only stores what changed
 *     versus the previous record (`{ added, removed }`), falling back to a full
 *     "anchor" whenever the change is not a provable prefix extension (context
 *     compaction, a large manifest rewrite, the first record). This is where
 *     the ~190× reduction comes from.
 *   * **physical layer (CDC):** the payload bytes go through the content-defined
 *     chunk store, which deduplicates any repeated byte range across records.
 *
 * Reads stay cheap because the two layers are lazy: `summary` exposes only the
 * scalar header, and full context/manifest are reconstructed on demand by
 * replaying deltas from the nearest anchor.
 */
var node_crypto_1 = require("node:crypto");
var node_fs_1 = require("node:fs");
var platform_1 = require("@natalia/platform");
var promises_1 = require("node:fs/promises");
var node_readline_1 = require("node:readline");
var node_events_1 = require("node:events");
var node_path_1 = require("node:path");
var chunk_store_1 = require("./chunk-store");
var INLINE_MAX_BYTES = 4 * 1024;
function sameManifestEntry(left, right) {
    return (left.kind === right.kind &&
        left.objectHash === right.objectHash &&
        left.size === right.size &&
        left.mode === right.mode &&
        left.linkTarget === right.linkTarget);
}
function sameEntry(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
/** True when `next` extends `previous` without touching an existing entry. */
function isPrefixExtension(previous, next) {
    if (next.length < previous.length)
        return false;
    for (var index = 0; index < previous.length; index++)
        if (!sameEntry(previous[index], next[index]))
            return false;
    return true;
}
/**
 * Legacy v2 records may carry a `pty` resource kind that was renamed to
 * `terminal`. Normalising here (rather than in `list()`) keeps it off the hot
 * path: it only runs when a context is actually materialized.
 */
function normalizeContext(context) {
    var _a;
    if (!((_a = context.resources) === null || _a === void 0 ? void 0 : _a.some(function (resource) { return resource.kind === "pty"; })))
        return context;
    return __assign(__assign({}, context), { resources: context.resources.map(function (resource) {
            return resource.kind === "pty"
                ? __assign(__assign({}, resource), { kind: "terminal" }) : resource;
        }) });
}
/**
 * True when the journal's first record is v2. The first record carries its
 * `schemaVersion` in the first bytes, so a small head read is enough even when
 * the record itself is megabytes.
 */
function journalNeedsMigration(path) {
    return __awaiter(this, void 0, void 0, function () {
        var handle, buffer, bytesRead, head, version, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 7, , 8]);
                    return [4 /*yield*/, (0, promises_1.open)(path, "r")];
                case 1:
                    handle = _b.sent();
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, , 4, 6]);
                    buffer = Buffer.allocUnsafe(4096);
                    return [4 /*yield*/, handle.read(buffer, 0, 4096, 0)];
                case 3:
                    bytesRead = (_b.sent()).bytesRead;
                    head = buffer.subarray(0, bytesRead).toString("utf8");
                    version = (_a = /"schemaVersion"\s*:\s*(\d+)/u.exec(head)) === null || _a === void 0 ? void 0 : _a[1];
                    return [2 /*return*/, version !== undefined && version !== "3"];
                case 4: return [4 /*yield*/, handle.close()];
                case 5:
                    _b.sent();
                    return [7 /*endfinally*/];
                case 6: return [3 /*break*/, 8];
                case 7:
                    error_1 = _b.sent();
                    if (error_1.code === "ENOENT")
                        return [2 /*return*/, false];
                    throw error_1;
                case 8: return [2 /*return*/];
            }
        });
    });
}
function contextMetaOf(context) {
    return {
        journalOffset: context.journalOffset,
        step: context.step,
        tokenEstimate: context.tokenEstimate,
        compactionGeneration: context.compactionGeneration,
        entryCount: context.entries.length,
    };
}
/** Scalar manifest header; never materializes `entries`. */
function manifestMetaOf(manifest) {
    return {
        root: manifest.root,
        complete: manifest.complete,
        errors: manifest.errors,
        ignoredFiles: manifest.ignoredFiles,
        totalBytes: manifest.totalBytes,
        entryCount: Object.keys(manifest.entries).length,
    };
}
/**
 * A parsed checkpoint journal. Holds the small stored descriptors in memory and
 * reconstructs context/manifest lazily, so listing a 1400-checkpoint session
 * touches ~200 KB of headers instead of ~1 GB of snapshots.
 */
var CheckpointJournal = /** @class */ (function () {
    function CheckpointJournal(path, chunks, entries) {
        this.path = path;
        this.chunks = chunks;
        this.entries = entries;
        this.bySequence = new Map();
        this.contextMemo = new Map();
        this.manifestMemo = new Map();
        this.reindex();
    }
    CheckpointJournal.load = function (path, chunks) {
        return __awaiter(this, void 0, void 0, function () {
            var text, error_2, entries, _i, _a, line, parsed;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, promises_1.readFile)(path, "utf8")];
                    case 1:
                        text = _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _b.sent();
                        if (error_2.code === "ENOENT")
                            return [2 /*return*/, new CheckpointJournal(path, chunks, [])];
                        throw error_2;
                    case 3:
                        entries = [];
                        for (_i = 0, _a = text.split("\n"); _i < _a.length; _i++) {
                            line = _a[_i];
                            if (!line)
                                continue;
                            parsed = JSON.parse(line);
                            if (parsed.schemaVersion === 3)
                                entries.push({ schema: 3, stored: parsed });
                            else
                                entries.push({ schema: 2, record: parsed });
                        }
                        return [2 /*return*/, new CheckpointJournal(path, chunks, entries)];
                }
            });
        });
    };
    /**
     * Rewrites a v2 journal (inline manifest + context per record) as v3
     * (delta + CDC). Streams line by line so a 1 GB legacy journal never has to
     * be held in memory, keeps the previous full record for delta encoding, and
     * copies the original to `<journal>.v2-backup` before the atomic replace.
     */
    CheckpointJournal.migrate = function (path, chunks) {
        return __awaiter(this, void 0, void 0, function () {
            var backup, temp, helper, output, input, reader, previous, migrated, _a, reader_1, reader_1_1, line, parsed, record, stored, e_1_1, handle, error_3;
            var _b, e_1, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, journalNeedsMigration(path)];
                    case 1:
                        if (!(_e.sent()))
                            return [2 /*return*/, undefined];
                        backup = "".concat(path, ".v2-backup");
                        temp = "".concat(path, ".").concat((0, node_crypto_1.randomUUID)(), ".tmp");
                        helper = new CheckpointJournal(path, chunks, []);
                        output = (0, node_fs_1.createWriteStream)(temp, { mode: 384 });
                        input = (0, node_fs_1.createReadStream)(path, { encoding: "utf8" });
                        reader = (0, node_readline_1.createInterface)({ input: input, crlfDelay: Infinity });
                        migrated = 0;
                        _e.label = 2;
                    case 2:
                        _e.trys.push([2, 30, , 32]);
                        _e.label = 3;
                    case 3:
                        _e.trys.push([3, 14, 15, 20]);
                        _a = true, reader_1 = __asyncValues(reader);
                        _e.label = 4;
                    case 4: return [4 /*yield*/, reader_1.next()];
                    case 5:
                        if (!(reader_1_1 = _e.sent(), _b = reader_1_1.done, !_b)) return [3 /*break*/, 13];
                        _d = reader_1_1.value;
                        _a = false;
                        line = _d;
                        if (!line)
                            return [3 /*break*/, 12];
                        parsed = JSON.parse(line);
                        if (!(parsed.schemaVersion === 3)) return [3 /*break*/, 8];
                        if (!!output.write("".concat(line, "\n"))) return [3 /*break*/, 7];
                        return [4 /*yield*/, (0, node_events_1.once)(output, "drain")];
                    case 6:
                        _e.sent();
                        _e.label = 7;
                    case 7: return [3 /*break*/, 12];
                    case 8:
                        record = parsed;
                        return [4 /*yield*/, helper.encode(record, previous)];
                    case 9:
                        stored = _e.sent();
                        if (!!output.write("".concat(JSON.stringify(stored), "\n"))) return [3 /*break*/, 11];
                        return [4 /*yield*/, (0, node_events_1.once)(output, "drain")];
                    case 10:
                        _e.sent();
                        _e.label = 11;
                    case 11:
                        previous = record;
                        migrated += 1;
                        _e.label = 12;
                    case 12:
                        _a = true;
                        return [3 /*break*/, 4];
                    case 13: return [3 /*break*/, 20];
                    case 14:
                        e_1_1 = _e.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 20];
                    case 15:
                        _e.trys.push([15, , 18, 19]);
                        if (!(!_a && !_b && (_c = reader_1.return))) return [3 /*break*/, 17];
                        return [4 /*yield*/, _c.call(reader_1)];
                    case 16:
                        _e.sent();
                        _e.label = 17;
                    case 17: return [3 /*break*/, 19];
                    case 18:
                        if (e_1) throw e_1.error;
                        return [7 /*endfinally*/];
                    case 19: return [7 /*endfinally*/];
                    case 20: return [4 /*yield*/, new Promise(function (resolve, reject) {
                            output.once("finish", function () { return resolve(); });
                            output.once("error", reject);
                            output.end();
                        })];
                    case 21:
                        _e.sent();
                        return [4 /*yield*/, (0, promises_1.open)(temp, "r+")];
                    case 22:
                        handle = _e.sent();
                        _e.label = 23;
                    case 23:
                        _e.trys.push([23, , 25, 27]);
                        return [4 /*yield*/, handle.sync()];
                    case 24:
                        _e.sent();
                        return [3 /*break*/, 27];
                    case 25: return [4 /*yield*/, handle.close()];
                    case 26:
                        _e.sent();
                        return [7 /*endfinally*/];
                    case 27: return [4 /*yield*/, (0, promises_1.copyFile)(path, backup)];
                    case 28:
                        _e.sent();
                        return [4 /*yield*/, (0, promises_1.rename)(temp, path)];
                    case 29:
                        _e.sent();
                        return [2 /*return*/, { migrated: migrated, backup: backup }];
                    case 30:
                        error_3 = _e.sent();
                        output.destroy();
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("node:fs/promises"); }).then(function (_a) {
                                var rm = _a.rm;
                                return rm(temp, { force: true });
                            })
                                .catch(function () { return undefined; })];
                    case 31:
                        _e.sent();
                        throw error_3;
                    case 32: return [2 /*return*/];
                }
            });
        });
    };
    Object.defineProperty(CheckpointJournal.prototype, "length", {
        get: function () {
            return this.entries.length;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(CheckpointJournal.prototype, "isEmpty", {
        /** True when the journal has at least one record (used by baseline setup). */
        get: function () {
            return this.entries.length === 0;
        },
        enumerable: false,
        configurable: true
    });
    CheckpointJournal.prototype.reindex = function () {
        this.bySequence.clear();
        for (var index = 0; index < this.entries.length; index++) {
            var sequence = this.sequenceAt(index);
            if (sequence !== undefined)
                this.bySequence.set(sequence, index);
        }
    };
    CheckpointJournal.prototype.sequenceAt = function (index) {
        var entry = this.entries[index];
        if (!entry)
            return undefined;
        return entry.schema === 3 ? entry.stored.sequence : entry.record.sequence;
    };
    CheckpointJournal.prototype.indexOfSequence = function (sequence) {
        return this.bySequence.get(sequence);
    };
    CheckpointJournal.prototype.indexOfID = function (id) {
        if (id === "last")
            return this.entries.length - 1;
        for (var index = 0; index < this.entries.length; index++) {
            var entry = this.entries[index];
            var matches = entry.schema === 3
                ? entry.stored.id === id || String(entry.stored.sequence) === id
                : entry.record.id === id || String(entry.record.sequence) === id;
            if (matches)
                return index;
        }
        return undefined;
    };
    CheckpointJournal.prototype.contextMetaAt = function (index) {
        var entry = this.entries[index];
        if (!entry)
            return undefined;
        if (entry.schema === 2)
            return entry.record.context
                ? contextMetaOf(entry.record.context)
                : undefined;
        var context = entry.stored.context;
        return {
            journalOffset: context.journalOffset,
            step: context.step,
            tokenEstimate: context.tokenEstimate,
            compactionGeneration: context.compactionGeneration,
            entryCount: context.entryCount,
        };
    };
    /** Reconstructs the full ledger context for a record, replaying deltas. */
    CheckpointJournal.prototype.contextAt = function (index) {
        return __awaiter(this, void 0, void 0, function () {
            var cached, entry, context_1, stored, context, payload, baseIndex, base, payload, delta, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cached = this.contextMemo.get(index);
                        if (cached)
                            return [2 /*return*/, cached];
                        entry = this.entries[index];
                        if (!entry)
                            throw new Error("checkpoint index out of range: ".concat(index));
                        if (entry.schema === 2) {
                            context_1 = entry.record.context
                                ? normalizeContext(entry.record.context)
                                : emptyContext();
                            this.contextMemo.set(index, context_1);
                            return [2 /*return*/, context_1];
                        }
                        stored = entry.stored.context;
                        if (!(stored.kind === "anchor")) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.decodePayload(stored)];
                    case 1:
                        payload = _a.sent();
                        context = normalizeContext(JSON.parse(payload.toString("utf8")));
                        return [3 /*break*/, 5];
                    case 2:
                        baseIndex = stored.base === undefined
                            ? undefined
                            : this.indexOfSequence(stored.base);
                        if (baseIndex === undefined)
                            throw new Error("checkpoint context delta names missing base ".concat(stored.base));
                        return [4 /*yield*/, this.contextAt(baseIndex)];
                    case 3:
                        base = _a.sent();
                        return [4 /*yield*/, this.decodePayload(stored)];
                    case 4:
                        payload = _a.sent();
                        delta = JSON.parse(payload.toString("utf8"));
                        context = __assign(__assign(__assign({}, base), { entries: __spreadArray(__spreadArray([], base.entries, true), delta.added, true), resources: delta.resources }), (delta.checkpoint ? { checkpoint: delta.checkpoint } : {}));
                        _a.label = 5;
                    case 5:
                        result = __assign(__assign({}, context), { journalOffset: stored.journalOffset, step: stored.step, tokenEstimate: stored.tokenEstimate, compactionGeneration: stored.compactionGeneration });
                        this.contextMemo.set(index, result);
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /** Reconstructs the full workspace manifest for a record. */
    CheckpointJournal.prototype.manifestAt = function (index) {
        return __awaiter(this, void 0, void 0, function () {
            var cached, entry, legacy, stored, manifest, payload, baseIndex, base, payload, delta, entries, _i, _a, path, _b, _c, _d, path, value, result;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        cached = this.manifestMemo.get(index);
                        if (cached)
                            return [2 /*return*/, cached];
                        entry = this.entries[index];
                        if (!entry)
                            throw new Error("checkpoint index out of range: ".concat(index));
                        if (entry.schema === 2) {
                            legacy = entry.record.manifest;
                            if (!legacy)
                                throw new Error("checkpoint manifest missing: ".concat(entry.record.id));
                            this.manifestMemo.set(index, legacy);
                            return [2 /*return*/, legacy];
                        }
                        stored = entry.stored.manifest;
                        if (!(stored.kind === "anchor")) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.decodePayload(stored)];
                    case 1:
                        payload = _e.sent();
                        manifest = JSON.parse(payload.toString("utf8"));
                        return [3 /*break*/, 5];
                    case 2:
                        baseIndex = stored.base === undefined
                            ? undefined
                            : this.indexOfSequence(stored.base);
                        if (baseIndex === undefined)
                            throw new Error("checkpoint manifest delta names missing base ".concat(stored.base));
                        return [4 /*yield*/, this.manifestAt(baseIndex)];
                    case 3:
                        base = _e.sent();
                        return [4 /*yield*/, this.decodePayload(stored)];
                    case 4:
                        payload = _e.sent();
                        delta = JSON.parse(payload.toString("utf8"));
                        entries = __assign({}, base.entries);
                        for (_i = 0, _a = delta.removed; _i < _a.length; _i++) {
                            path = _a[_i];
                            delete entries[path];
                        }
                        for (_b = 0, _c = Object.entries(delta.added); _b < _c.length; _b++) {
                            _d = _c[_b], path = _d[0], value = _d[1];
                            entries[path] = value;
                        }
                        manifest = __assign(__assign({}, base), { entries: entries });
                        _e.label = 5;
                    case 5:
                        result = __assign(__assign({}, manifest), { root: stored.root, complete: stored.complete, errors: stored.errors, ignoredFiles: stored.ignoredFiles, totalBytes: stored.totalBytes });
                        this.manifestMemo.set(index, result);
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /** Light record for listings: scalar context header, no ledger entries. */
    CheckpointJournal.prototype.legacyRecord = function (record, includeContext) {
        var context = record.context, manifest = record.manifest, rest = __rest(record, ["context", "manifest"]);
        return __assign(__assign(__assign(__assign(__assign({}, rest), (manifest ? { manifest: manifest } : {})), { manifestMeta: manifest
                ? manifestMetaOf(manifest)
                : {
                    root: record.cwd,
                    complete: record.complete,
                    errors: record.errors,
                    ignoredFiles: 0,
                    totalBytes: 0,
                    entryCount: 0,
                } }), (includeContext && context ? { context: context } : {})), { contextMeta: context ? contextMetaOf(context) : emptyMeta() });
    };
    CheckpointJournal.prototype.summaryAt = function (index) {
        return __awaiter(this, void 0, void 0, function () {
            var entry;
            return __generator(this, function (_a) {
                entry = this.entries[index];
                if (!entry)
                    throw new Error("checkpoint index out of range: ".concat(index));
                if (entry.schema === 2)
                    return [2 /*return*/, this.legacyRecord(entry.record, false)];
                // Schema 3: scalars come from the stored header, so the manifest (and its
                // entries) stays unmaterialized until a consumer asks for it.
                return [2 /*return*/, this.buildRecord(entry.stored, undefined, undefined)];
            });
        });
    };
    /** Full record, with ledger context and manifest materialized. */
    CheckpointJournal.prototype.recordAt = function (index) {
        return __awaiter(this, void 0, void 0, function () {
            var entry, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        entry = this.entries[index];
                        if (!entry)
                            throw new Error("checkpoint index out of range: ".concat(index));
                        if (entry.schema === 2)
                            return [2 /*return*/, this.legacyRecord(entry.record, true)];
                        _a = this.buildRecord;
                        _b = [entry.stored];
                        return [4 /*yield*/, this.contextAt(index)];
                    case 1:
                        _b = _b.concat([_c.sent()]);
                        return [4 /*yield*/, this.manifestAt(index)];
                    case 2: return [2 /*return*/, _a.apply(this, _b.concat([_c.sent()]))];
                }
            });
        });
    };
    CheckpointJournal.prototype.summaries = function () {
        return __awaiter(this, void 0, void 0, function () {
            var out, index, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        out = [];
                        index = 0;
                        _c.label = 1;
                    case 1:
                        if (!(index < this.entries.length)) return [3 /*break*/, 4];
                        _b = (_a = out).push;
                        return [4 /*yield*/, this.summaryAt(index)];
                    case 2:
                        _b.apply(_a, [_c.sent()]);
                        _c.label = 3;
                    case 3:
                        index++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, out];
                }
            });
        });
    };
    CheckpointJournal.prototype.all = function () {
        return __awaiter(this, void 0, void 0, function () {
            var out, index, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        out = [];
                        index = 0;
                        _c.label = 1;
                    case 1:
                        if (!(index < this.entries.length)) return [3 /*break*/, 4];
                        _b = (_a = out).push;
                        return [4 /*yield*/, this.recordAt(index)];
                    case 2:
                        _b.apply(_a, [_c.sent()]);
                        _c.label = 3;
                    case 3:
                        index++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, out];
                }
            });
        });
    };
    CheckpointJournal.prototype.get = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var index, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        index = this.indexOfID(id);
                        if (!(index === undefined)) return [3 /*break*/, 1];
                        _a = undefined;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.recordAt(index)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3: return [2 /*return*/, _a];
                }
            });
        });
    };
    CheckpointJournal.prototype.buildRecord = function (stored, context, manifest) {
        var storedContext = stored.context, storedManifest = stored.manifest, rest = __rest(stored, ["context", "manifest"]);
        return __assign(__assign(__assign(__assign(__assign(__assign({}, rest), { schemaVersion: 3 }), (manifest ? { manifest: manifest } : {})), { manifestMeta: {
                root: storedManifest.root,
                complete: storedManifest.complete,
                errors: storedManifest.errors,
                ignoredFiles: storedManifest.ignoredFiles,
                totalBytes: storedManifest.totalBytes,
                entryCount: storedManifest.entryCount,
            } }), (context ? { context: context } : {})), { contextMeta: {
                journalOffset: storedContext.journalOffset,
                step: storedContext.step,
                tokenEstimate: storedContext.tokenEstimate,
                compactionGeneration: storedContext.compactionGeneration,
                entryCount: storedContext.entryCount,
            } });
    };
    /**
     * Encodes a materialized record against its predecessor and appends one line.
     * The caller has already serialized concurrent writes through the checkpoint
     * queue.
     */
    CheckpointJournal.prototype.append = function (record) {
        return __awaiter(this, void 0, void 0, function () {
            var previousIndex, previous, _a, stored;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        previousIndex = this.entries.length - 1;
                        if (!(previousIndex >= 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.recordAt(previousIndex)];
                    case 1:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = undefined;
                        _b.label = 3;
                    case 3:
                        previous = _a;
                        return [4 /*yield*/, this.encode(record, previous)];
                    case 4:
                        stored = _b.sent();
                        this.entries.push({ schema: 3, stored: stored });
                        this.bySequence.set(stored.sequence, this.entries.length - 1);
                        return [4 /*yield*/, appendFileLine(this.path, JSON.stringify(stored))];
                    case 5:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /** Encodes a record without writing it (used by tests and compaction). */
    CheckpointJournal.prototype.encode = function (record_1, previous_1) {
        return __awaiter(this, arguments, void 0, function (record, previous, forceAnchor) {
            var context, _a, _b;
            var _c;
            var _d;
            if (forceAnchor === void 0) { forceAnchor = false; }
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (!((_d = record.context) !== null && _d !== void 0)) return [3 /*break*/, 1];
                        _a = _d;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.contextFromMeta(record)];
                    case 2:
                        _a = (_e.sent());
                        _e.label = 3;
                    case 3:
                        context = _a;
                        if (!record.manifest)
                            throw new Error("cannot encode a checkpoint without its workspace manifest");
                        _b = [__assign(__assign(__assign(__assign(__assign(__assign({ schemaVersion: 3, id: record.id, sequence: record.sequence, sessionID: record.sessionID }, (record.turnID ? { turnID: record.turnID } : {})), (record.stepID ? { stepID: record.stepID } : {})), { step: record.step, reason: record.reason }), (record.name ? { name: record.name } : {})), { createdAt: record.createdAt, cwd: record.cwd, complete: record.complete, errors: record.errors, changes: record.changes, runtime: record.runtime, diskUsageBytes: record.diskUsageBytes }), (record.metadata ? { metadata: record.metadata } : {}))];
                        _c = {};
                        return [4 /*yield*/, this.encodeContext(context, previous, forceAnchor)];
                    case 4:
                        _c.context = _e.sent();
                        return [4 /*yield*/, this.encodeManifest(record.manifest, previous, forceAnchor)];
                    case 5: return [2 /*return*/, __assign.apply(void 0, _b.concat([(_c.manifest = _e.sent(), _c)]))];
                }
            });
        });
    };
    CheckpointJournal.prototype.contextFromMeta = function (record) {
        return __awaiter(this, void 0, void 0, function () {
            var index;
            return __generator(this, function (_a) {
                index = this.indexOfID(record.id);
                if (index === undefined)
                    throw new Error("cannot encode a checkpoint without its context");
                return [2 /*return*/, this.contextAt(index)];
            });
        });
    };
    CheckpointJournal.prototype.encodeContext = function (context_2, previous_1) {
        return __awaiter(this, arguments, void 0, function (context, previous, forceAnchor) {
            var meta, previousContext, delta, payload_1, payload;
            if (forceAnchor === void 0) { forceAnchor = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        meta = contextMetaOf(context);
                        previousContext = previous === null || previous === void 0 ? void 0 : previous.context;
                        if (!(!forceAnchor &&
                            previousContext &&
                            isPrefixExtension(previousContext.entries, context.entries))) return [3 /*break*/, 2];
                        delta = __assign({ added: context.entries.slice(previousContext.entries.length), resources: context.resources }, (context.checkpoint ? { checkpoint: context.checkpoint } : {}));
                        return [4 /*yield*/, this.encodePayload(Buffer.from(JSON.stringify(delta), "utf8"))];
                    case 1:
                        payload_1 = _a.sent();
                        return [2 /*return*/, __assign(__assign({ kind: "delta", base: previous.sequence }, payload_1), meta)];
                    case 2: return [4 /*yield*/, this.encodePayload(Buffer.from(JSON.stringify(context), "utf8"))];
                    case 3:
                        payload = _a.sent();
                        return [2 /*return*/, __assign(__assign({ kind: "anchor" }, payload), meta)];
                }
            });
        });
    };
    /** Inlines a small payload, otherwise stores it through the chunk library. */
    CheckpointJournal.prototype.encodePayload = function (bytes) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (bytes.length <= INLINE_MAX_BYTES)
                            return [2 /*return*/, { inline: bytes.toString("base64") }];
                        _a = {};
                        return [4 /*yield*/, this.chunks.put(bytes)];
                    case 1: return [2 /*return*/, (_a.ref = _b.sent(), _a)];
                }
            });
        });
    };
    /** Reverses {@link encodePayload}. */
    CheckpointJournal.prototype.decodePayload = function (stored) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if ("inline" in stored)
                            return [2 /*return*/, Buffer.from(stored.inline, "base64")];
                        return [4 /*yield*/, this.chunks.get(stored.ref)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    CheckpointJournal.prototype.encodeManifest = function (manifest_1, previous_1) {
        return __awaiter(this, arguments, void 0, function (manifest, previous, forceAnchor) {
            var header, previousManifest, added, _i, _a, _b, path, value, before, removed, delta, encoded, anchorBytes, payload_2, payload;
            if (forceAnchor === void 0) { forceAnchor = false; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        header = {
                            root: manifest.root,
                            complete: manifest.complete,
                            errors: manifest.errors,
                            ignoredFiles: manifest.ignoredFiles,
                            totalBytes: manifest.totalBytes,
                            entryCount: Object.keys(manifest.entries).length,
                        };
                        previousManifest = previous === null || previous === void 0 ? void 0 : previous.manifest;
                        if (!(previousManifest && !forceAnchor)) return [3 /*break*/, 2];
                        added = {};
                        for (_i = 0, _a = Object.entries(manifest.entries); _i < _a.length; _i++) {
                            _b = _a[_i], path = _b[0], value = _b[1];
                            before = previousManifest.entries[path];
                            if (!before || !sameManifestEntry(before, value))
                                added[path] = value;
                        }
                        removed = Object.keys(previousManifest.entries).filter(function (path) { return !(path in manifest.entries); });
                        delta = { added: added, removed: removed };
                        encoded = Buffer.from(JSON.stringify(delta), "utf8");
                        anchorBytes = Buffer.from(JSON.stringify(manifest), "utf8");
                        if (!(encoded.length * 2 < anchorBytes.length)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.encodePayload(encoded)];
                    case 1:
                        payload_2 = _c.sent();
                        return [2 /*return*/, __assign(__assign({ kind: "delta", base: previous.sequence }, payload_2), header)];
                    case 2: return [4 /*yield*/, this.encodePayload(Buffer.from(JSON.stringify(manifest), "utf8"))];
                    case 3:
                        payload = _c.sent();
                        return [2 /*return*/, __assign(__assign({ kind: "anchor" }, payload), header)];
                }
            });
        });
    };
    /** Renames one record in place, keeping its delta chain intact. */
    CheckpointJournal.prototype.rename = function (id, name) {
        return __awaiter(this, void 0, void 0, function () {
            var index, entry, updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        index = this.indexOfID(id);
                        if (index === undefined)
                            return [2 /*return*/, undefined];
                        entry = this.entries[index];
                        if (entry.schema === 3) {
                            updated = __assign(__assign({}, entry.stored), { name: name });
                            this.entries[index] = { schema: 3, stored: updated };
                        }
                        else {
                            this.entries[index] = {
                                schema: 2,
                                record: __assign(__assign({}, entry.record), { name: name }),
                            };
                        }
                        return [4 /*yield*/, this.writeAll()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.summaryAt(index)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Drops every record later than `sequence`, optionally keeping one record
     * with `keepSequence` (the rollback safety checkpoint, which sits above the
     * target but must survive so a failed rollback can be recovered).
     */
    CheckpointJournal.prototype.truncateAfter = function (sequence, keepSequence) {
        return __awaiter(this, void 0, void 0, function () {
            var kept, keepIndex, index, entry, at, record, _a, _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        kept = [];
                        for (index = 0; index < this.entries.length; index++) {
                            entry = this.entries[index];
                            at = entry.schema === 3 ? entry.stored.sequence : entry.record.sequence;
                            if (at <= sequence)
                                kept.push(entry);
                            else if (keepSequence !== undefined && at === keepSequence)
                                keepIndex = index;
                        }
                        if (!(keepIndex !== undefined)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.recordAt(keepIndex)];
                    case 1:
                        record = _d.sent();
                        _b = (_a = kept).push;
                        _c = {
                            schema: 3
                        };
                        return [4 /*yield*/, this.encode(record, undefined, true)];
                    case 2:
                        _b.apply(_a, [(_c.stored = _d.sent(),
                                _c)]);
                        _d.label = 3;
                    case 3:
                        this.entries = kept;
                        this.reindex();
                        this.contextMemo.clear();
                        this.manifestMemo.clear();
                        return [4 /*yield*/, this.writeAll()];
                    case 4:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /** Chunk refs referenced by the journal (GC roots for the chunk store). */
    CheckpointJournal.prototype.referencedChunks = function () {
        var referenced = new Set();
        for (var _i = 0, _a = this.entries; _i < _a.length; _i++) {
            var entry = _a[_i];
            if (entry.schema !== 3)
                continue;
            for (var _b = 0, _c = [entry.stored.context, entry.stored.manifest]; _b < _c.length; _b++) {
                var payload = _c[_b];
                if (!("ref" in payload))
                    continue;
                for (var _d = 0, _e = payload.ref.chunks; _d < _e.length; _d++) {
                    var hash = _e[_d];
                    referenced.add(hash);
                }
            }
        }
        return referenced;
    };
    /** Serialized lines, for a full rewrite (rename/truncate/migration). */
    CheckpointJournal.prototype.serializedLines = function () {
        return this.entries.map(function (entry) {
            return entry.schema === 3
                ? JSON.stringify(entry.stored)
                : JSON.stringify(entry.record);
        });
    };
    /** Replaces the on-disk journal with the current in-memory entries. */
    CheckpointJournal.prototype.writeAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, replaceJournal(this.path, "".concat(this.serializedLines().join("\n"), "\n"))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /** Swaps in freshly migrated entries (used by the v2→v3 migration). */
    CheckpointJournal.fromEntries = function (path, chunks, entries) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, replaceJournal(path, "".concat(entries.map(function (entry) { return JSON.stringify(entry); }).join("\n"), "\n"))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return CheckpointJournal;
}());
exports.CheckpointJournal = CheckpointJournal;
/**
 * Migrates every v2 checkpoint journal under `<workspaceRoot>/.natalia/checkpoints`
 * to v3 (delta + CDC), one session at a time. Each migrated journal keeps a
 * `<journal>.v2-backup`; sessions already on v3 are skipped. Run this while no
 * runtime is writing to the workspace, or just let the runtime migrate on first
 * load.
 */
function migrateAllCheckpointJournals(workspaceRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var sessionsDir, entries, error_4, results, chunks, _i, entries_1, entry, journal, migrated;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sessionsDir = (0, platform_1.resolveWorkspaceCheckpointSessionsRoot)(workspaceRoot);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, promises_1.readdir)(sessionsDir, { withFileTypes: true })];
                case 2:
                    entries = _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_4 = _a.sent();
                    if (error_4.code === "ENOENT")
                        return [2 /*return*/, []];
                    throw error_4;
                case 4:
                    results = [];
                    chunks = new chunk_store_1.ChunkStore((0, platform_1.resolveWorkspaceChunksRoot)(workspaceRoot));
                    return [4 /*yield*/, chunks.migrateLegacyRoots()];
                case 5:
                    _a.sent();
                    _i = 0, entries_1 = entries;
                    _a.label = 6;
                case 6:
                    if (!(_i < entries_1.length)) return [3 /*break*/, 9];
                    entry = entries_1[_i];
                    if (!entry.isDirectory())
                        return [3 /*break*/, 8];
                    journal = (0, node_path_1.join)(sessionsDir, entry.name, "journal.jsonl");
                    return [4 /*yield*/, CheckpointJournal.migrate(journal, chunks)];
                case 7:
                    migrated = _a.sent();
                    if (migrated)
                        results.push(__assign({ sessionID: entry.name }, migrated));
                    _a.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 6];
                case 9: return [2 /*return*/, results];
            }
        });
    });
}
/**
 * Deletes `<journal>.v2-backup` files once the v3 journal next to them loads
 * and its newest record fully reconstructs from the shared chunk store.
 *
 * Deliberately opt-in and offline-only: the runtime never prunes a backup, and
 * the newest record is reconstructed first so the only remaining copy is proven
 * self-sufficient before it is deleted.
 */
function pruneV2Backups(workspaceRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var sessionsDir, entries, error_5, chunks, pruned, bytes, _i, entries_2, entry, journalPath, backupPath, backupInfo, _a, journal, last;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    sessionsDir = (0, platform_1.resolveWorkspaceCheckpointSessionsRoot)(workspaceRoot);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, promises_1.readdir)(sessionsDir, { withFileTypes: true })];
                case 2:
                    entries = _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_5 = _b.sent();
                    if (error_5.code === "ENOENT")
                        return [2 /*return*/, { pruned: 0, bytes: 0 }];
                    throw error_5;
                case 4:
                    chunks = new chunk_store_1.ChunkStore((0, platform_1.resolveWorkspaceChunksRoot)(workspaceRoot));
                    pruned = 0;
                    bytes = 0;
                    _i = 0, entries_2 = entries;
                    _b.label = 5;
                case 5:
                    if (!(_i < entries_2.length)) return [3 /*break*/, 16];
                    entry = entries_2[_i];
                    if (!entry.isDirectory())
                        return [3 /*break*/, 15];
                    journalPath = (0, node_path_1.join)(sessionsDir, entry.name, "journal.jsonl");
                    backupPath = "".concat(journalPath, ".v2-backup");
                    backupInfo = void 0;
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, (0, promises_1.stat)(backupPath)];
                case 7:
                    backupInfo = _b.sent();
                    return [3 /*break*/, 9];
                case 8:
                    _a = _b.sent();
                    return [3 /*break*/, 15];
                case 9: return [4 /*yield*/, CheckpointJournal.load(journalPath, chunks)];
                case 10:
                    journal = _b.sent();
                    if (!(journal.length > 0)) return [3 /*break*/, 13];
                    last = journal.length - 1;
                    return [4 /*yield*/, journal.manifestAt(last)];
                case 11:
                    _b.sent();
                    return [4 /*yield*/, journal.contextAt(last)];
                case 12:
                    _b.sent();
                    _b.label = 13;
                case 13: return [4 /*yield*/, (0, promises_1.rm)(backupPath, { force: true })];
                case 14:
                    _b.sent();
                    bytes += backupInfo.size;
                    pruned += 1;
                    _b.label = 15;
                case 15:
                    _i++;
                    return [3 /*break*/, 5];
                case 16: return [2 /*return*/, { pruned: pruned, bytes: bytes }];
            }
        });
    });
}
function emptyContext() {
    return {
        entries: [],
        resources: [],
        journalOffset: 0,
        step: 0,
        tokenEstimate: 0,
        compactionGeneration: 0,
    };
}
function emptyMeta() {
    return {
        journalOffset: 0,
        step: 0,
        tokenEstimate: 0,
        compactionGeneration: 0,
        entryCount: 0,
    };
}
function appendFileLine(path, line) {
    return __awaiter(this, void 0, void 0, function () {
        var open, handle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("node:fs/promises"); })];
                case 1:
                    open = (_a.sent()).open;
                    return [4 /*yield*/, open(path, "a", 384)];
                case 2:
                    handle = _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, , 6, 8]);
                    return [4 /*yield*/, handle.writeFile("".concat(line, "\n"))];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, handle.sync()];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 6: return [4 /*yield*/, handle.close()];
                case 7:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function replaceJournal(path, contents) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, open, rename, rm, writeFile, randomUUID, temporary, handle;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("node:fs/promises"); })];
                case 1:
                    _a = _b.sent(), open = _a.open, rename = _a.rename, rm = _a.rm, writeFile = _a.writeFile;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("node:crypto"); })];
                case 2:
                    randomUUID = (_b.sent()).randomUUID;
                    temporary = "".concat(path, ".").concat(randomUUID(), ".tmp");
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, , 12, 14]);
                    return [4 /*yield*/, writeFile(temporary, contents, { mode: 384 })];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, open(temporary, "r+")];
                case 5:
                    handle = _b.sent();
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, , 8, 10]);
                    return [4 /*yield*/, handle.sync()];
                case 7:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 8: return [4 /*yield*/, handle.close()];
                case 9:
                    _b.sent();
                    return [7 /*endfinally*/];
                case 10: return [4 /*yield*/, rename(temporary, path)];
                case 11:
                    _b.sent();
                    return [3 /*break*/, 14];
                case 12: return [4 /*yield*/, rm(temporary, { force: true }).catch(function () { return undefined; })];
                case 13:
                    _b.sent();
                    return [7 /*endfinally*/];
                case 14: return [2 /*return*/];
            }
        });
    });
}
