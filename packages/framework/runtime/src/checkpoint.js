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
exports.CheckpointStore = void 0;
exports.initializeDefaultCheckpointStore = initializeDefaultCheckpointStore;
exports.runCheckpointCommand = runCheckpointCommand;
var object_store_1 = require("@natalia/object-store");
var node_crypto_1 = require("node:crypto");
var chunk_store_1 = require("./chunk-store");
var checkpoint_journal_1 = require("./checkpoint-journal");
var node_fs_1 = require("node:fs");
var promises_1 = require("node:fs/promises");
var platform_1 = require("@natalia/platform");
var node_path_1 = require("node:path");
var CheckpointStore = /** @class */ (function () {
    function CheckpointStore(options) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.checkpointQueue = Promise.resolve();
        this.sessionID = options.sessionID;
        this.workspaceRoot = (0, node_path_1.resolve)(options.workspaceRoot);
        // §1.6: the rescue ring defaults OUTSIDE the workspace; an explicit
        // storeDir is the portable opt-in and takes the whole store local with it
        // (metadata, objects and chunks move together — a half-moved store is
        // metadata pointing at data that died with the workspace).
        var explicitStore = options.storeDir !== undefined;
        this.storeDir = (0, node_path_1.resolve)((_a = options.storeDir) !== null && _a !== void 0 ? _a : (0, platform_1.defaultCheckpointStoreDir)(this.workspaceRoot, options.sessionID));
        this.objects = new object_store_1.ObjectStore(explicitStore
            ? (0, node_path_1.join)(this.workspaceRoot, ".natalia", "objects")
            : (0, platform_1.resolveWorkspaceObjectsRoot)(this.workspaceRoot));
        this.diffCache = new object_store_1.DiffCache(this.objects, "checkpoint-diff");
        this.enabled = (_b = options.enabled) !== null && _b !== void 0 ? _b : true;
        this.maxFiles = (_c = options.maxFiles) !== null && _c !== void 0 ? _c : 20000;
        this.maxBytes = (_d = options.maxBytes) !== null && _d !== void 0 ? _d : 512 * 1024 * 1024;
        this.legacyIgnore = __spreadArray([], ((_e = options.ignore) !== null && _e !== void 0 ? _e : []), true);
        this.additionalDirs = (_f = options.additionalDirs) !== null && _f !== void 0 ? _f : [];
        this.now = (_g = options.now) !== null && _g !== void 0 ? _g : (function () { return new Date(); });
        this.onEvent = options.onEvent;
        // Kept out of `storeDir`: the chunk library is not part of one checkpoint's
        // disk footprint, and `storeDir` is what `diskUsageBytes` reports. One
        // shared root lets identical payloads dedupe across sessions; GC unions
        // every session's references so that sharing stays safe.
        this.chunkRoot = explicitStore
            ? (0, node_path_1.join)(this.workspaceRoot, ".natalia", "chunks")
            : (0, platform_1.resolveWorkspaceChunksRoot)(this.workspaceRoot);
        this.chunks = new chunk_store_1.ChunkStore(this.chunkRoot);
    }
    CheckpointStore.prototype.loadJournal = function () {
        return __awaiter(this, void 0, void 0, function () {
            var chunkMigration, migration, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!this.journal) return [3 /*break*/, 6];
                        if (!(process.env.NATALIA_CHECKPOINT_NO_MIGRATE !== "1")) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.chunks.migrateLegacyRoots()];
                    case 1:
                        chunkMigration = _b.sent();
                        if (chunkMigration.roots > 0)
                            console.warn("[checkpoint] merged ".concat(chunkMigration.moved, " chunks from ").concat(chunkMigration.roots, " legacy session root(s)"));
                        // Fold any loose one-file-per-chunk leftovers into packs (covers the
                        // shared-root layout written before packing existed).
                        return [4 /*yield*/, this.chunks.packLooseChunks()];
                    case 2:
                        // Fold any loose one-file-per-chunk leftovers into packs (covers the
                        // shared-root layout written before packing existed).
                        _b.sent();
                        return [4 /*yield*/, checkpoint_journal_1.CheckpointJournal.migrate(this.journalPath(), this.chunks)];
                    case 3:
                        migration = _b.sent();
                        if (migration)
                            console.warn("[checkpoint] migrated ".concat(migration.migrated, " records to v3; backup at ").concat(migration.backup));
                        _b.label = 4;
                    case 4:
                        _a = this;
                        return [4 /*yield*/, checkpoint_journal_1.CheckpointJournal.load(this.journalPath(), this.chunks)];
                    case 5:
                        _a.journal = _b.sent();
                        _b.label = 6;
                    case 6: return [2 /*return*/, this.journal];
                }
            });
        });
    };
    CheckpointStore.open = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        store = new CheckpointStore(options);
                        return [4 /*yield*/, store.initialize()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, store];
                }
            });
        });
    };
    CheckpointStore.prototype.isEnabled = function () {
        return this.enabled;
    };
    CheckpointStore.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1, message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.enabled) {
                            this.unavailableReason = "disabled_by_config";
                            this.emit({
                                type: "checkpoint.unavailable",
                                reason: "disabled_by_config",
                                suggestion: "Set checkpoint.enabled=true to restore /checkpoint and /rollback.",
                                disabledByConfig: true,
                            });
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        assertContained(this.workspaceRoot, this.workspaceRoot);
                        // The journal lives per session; the objects live in the shared library.
                        return [4 /*yield*/, (0, promises_1.mkdir)(this.storeDir, { recursive: true, mode: 448 })];
                    case 2:
                        // The journal lives per session; the objects live in the shared library.
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.mkdir)(this.objectRoot(), { recursive: true, mode: 448 })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, promises_1.appendFile)(this.journalPath(), "", { mode: 384 })];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        message = "checkpoint storage unavailable: ".concat(errorKind(error_1));
                        this.unavailableReason = message;
                        this.emit({
                            type: "checkpoint.unavailable",
                            reason: message,
                            suggestion: "Check workspace permissions and the checkpoint store path, then restart the session.",
                        });
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    CheckpointStore.prototype.ensureBaseline = function (context_1) {
        return __awaiter(this, arguments, void 0, function (context, step) {
            if (step === void 0) { step = 0; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Read-only workspaces or permission failures must not block the rest of
                        // the runtime. Checkpoint creation stays available for writable workspaces;
                        // if the store is unavailable, skip the baseline and continue degraded.
                        if (this.unavailableReason)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, this.readLastRecord()];
                    case 1:
                        // Existence only. Reading the whole journal here made every turn pay for
                        // the entire checkpoint history: `createTurnCheckpoint` calls `init()`,
                        // which calls this before creating the turn's own checkpoint. On a long
                        // session the journal grows to hundreds of MB, so an O(journal) check
                        // stalled the turn before the provider ever ran (the UI sat on
                        // "Planning" and a kill lost the in-flight reply). The tail read is O(1).
                        if ((_a.sent()) !== undefined)
                            return [2 /*return*/, undefined];
                        return [2 /*return*/, this.createCheckpoint({
                                reason: "baseline",
                                context: context,
                                step: step,
                                status: "baseline",
                            })];
                }
            });
        });
    };
    CheckpointStore.prototype.createCheckpoint = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var create, queued;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        create = function () { return _this.createCheckpointLocked(input); };
                        queued = this.checkpointQueue.then(create, create);
                        this.checkpointQueue = queued.then(function () { return undefined; }, function () { return undefined; });
                        return [4 /*yield*/, queued];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    CheckpointStore.prototype.createCheckpointLocked = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var previous, sequence, id, manifest, context, diskUsageBytes, record, error_2, message;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        this.assertAvailable();
                        return [4 /*yield*/, this.readLastRecord()];
                    case 1:
                        previous = _c.sent();
                        sequence = previous ? previous.sequence + 1 : 0;
                        id = sequence === 0 ? "checkpoint_0" : "checkpoint_".concat(sequence);
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 7, , 8]);
                        return [4 /*yield*/, this.captureManifest()];
                    case 3:
                        manifest = _c.sent();
                        context = input.context.durableCheckpoint(input.step);
                        return [4 /*yield*/, this.diskUsageBytes()];
                    case 4:
                        diskUsageBytes = _c.sent();
                        record = __assign(__assign(__assign({ schemaVersion: 3, id: id, sequence: sequence, sessionID: this.sessionID, turnID: input.turnID, stepID: input.stepID, step: input.step, reason: input.reason }, (((_a = input.name) === null || _a === void 0 ? void 0 : _a.trim()) ? { name: input.name.trim() } : {})), { createdAt: this.now().toISOString(), cwd: this.workspaceRoot, complete: manifest.complete, errors: manifest.errors, manifest: manifest, manifestMeta: (0, checkpoint_journal_1.manifestMetaOf)(manifest), context: context, contextMeta: (0, checkpoint_journal_1.contextMetaOf)(context), changes: diffManifests(previous === null || previous === void 0 ? void 0 : previous.manifest, manifest), runtime: {
                                status: (_b = input.status) !== null && _b !== void 0 ? _b : "ready",
                                model: input.model,
                                tokenEstimate: context.tokenEstimate,
                                compactionGeneration: context.compactionGeneration,
                            }, diskUsageBytes: diskUsageBytes }), (input.metadata ? { metadata: input.metadata } : {}));
                        return [4 /*yield*/, this.loadJournal()];
                    case 5: return [4 /*yield*/, (_c.sent()).append(record)];
                    case 6:
                        _c.sent();
                        if (!record.complete)
                            this.emit({
                                type: "checkpoint.failed",
                                reason: record.reason,
                                message: "checkpoint captured incomplete workspace manifest",
                                incomplete: true,
                                errors: record.errors,
                            });
                        else
                            this.emit({
                                type: "checkpoint.created",
                                id: record.id,
                                reason: record.reason,
                                turnID: record.turnID,
                                stepID: record.stepID,
                                sequence: record.sequence,
                                complete: record.complete,
                                files: record.manifestMeta.entryCount,
                                changes: record.changes.length,
                                contextJournalOffset: context.journalOffset,
                                step: context.step,
                                tokenEstimate: context.tokenEstimate,
                                diskUsageBytes: record.diskUsageBytes,
                            });
                        return [2 /*return*/, record];
                    case 7:
                        error_2 = _c.sent();
                        message = "checkpoint creation failed: ".concat(errorKind(error_2));
                        this.emit({ type: "checkpoint.failed", reason: input.reason, message: message });
                        throw error_2;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Records for listings. Ledger entries are intentionally NOT materialized:
     * the scalar `contextMeta` carries what list consumers need, and `get` (or
     * `loadContext`) reconstructs the entries for the single record that needs
     * them. Materializing every context here would rebuild ~1 GB of history just
     * to show a list.
     */
    CheckpointStore.prototype.list = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.unavailableReason)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, this.loadJournal()];
                    case 1: return [4 /*yield*/, (_a.sent()).summaries()];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /** One record with its full ledger context materialized. */
    CheckpointStore.prototype.get = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.unavailableReason)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, this.loadJournal()];
                    case 1: return [4 /*yield*/, (_a.sent()).get(id)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /** Materializes the ledger context of an already-listed record. */
    CheckpointStore.prototype.loadContext = function (record) {
        return __awaiter(this, void 0, void 0, function () {
            var journal, index;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (record.context)
                            return [2 /*return*/, record.context];
                        return [4 /*yield*/, this.loadJournal()];
                    case 1:
                        journal = _a.sent();
                        index = journal.length - 1;
                        _a.label = 2;
                    case 2:
                        if (!(index >= 0)) return [3 /*break*/, 5];
                        if (!(journal.sequenceAt(index) === record.sequence)) return [3 /*break*/, 4];
                        return [4 /*yield*/, journal.contextAt(index)];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4:
                        index--;
                        return [3 /*break*/, 2];
                    case 5: throw new Error("checkpoint context not found: ".concat(record.id));
                }
            });
        });
    };
    /** Materializes the workspace manifest of an already-listed record. */
    CheckpointStore.prototype.loadManifest = function (record) {
        return __awaiter(this, void 0, void 0, function () {
            var journal, index;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (record.manifest)
                            return [2 /*return*/, record.manifest];
                        return [4 /*yield*/, this.loadJournal()];
                    case 1:
                        journal = _a.sent();
                        index = journal.length - 1;
                        _a.label = 2;
                    case 2:
                        if (!(index >= 0)) return [3 /*break*/, 5];
                        if (!(journal.sequenceAt(index) === record.sequence)) return [3 /*break*/, 4];
                        return [4 /*yield*/, journal.manifestAt(index)];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4:
                        index--;
                        return [3 /*break*/, 2];
                    case 5: throw new Error("checkpoint manifest not found: ".concat(record.id));
                }
            });
        });
    };
    CheckpointStore.prototype.listCheckpointsByKind = function (kind) {
        return __awaiter(this, void 0, void 0, function () {
            var records;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.list()];
                    case 1:
                        records = _a.sent();
                        if (!kind)
                            return [2 /*return*/, records];
                        return [2 /*return*/, records.filter(function (record) { return checkpointKind(record) === kind; })];
                }
            });
        });
    };
    CheckpointStore.prototype.listAuditRounds = function (planID) {
        return __awaiter(this, void 0, void 0, function () {
            var records, rounds, _i, records_1, record, metadata, metadataPlanID, round, verdict;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.list()];
                    case 1:
                        records = _b.sent();
                        rounds = [];
                        for (_i = 0, records_1 = records; _i < records_1.length; _i++) {
                            record = records_1[_i];
                            if (record.reason !== "audit_round")
                                continue;
                            metadata = (_a = record.metadata) !== null && _a !== void 0 ? _a : {};
                            metadataPlanID = metadata.planID;
                            if (typeof metadataPlanID !== "string")
                                continue;
                            if (planID && metadataPlanID !== planID)
                                continue;
                            round = metadata.round;
                            verdict = metadata.verdict;
                            if (typeof round !== "number")
                                continue;
                            if (verdict !== "gaps" && verdict !== "passed")
                                continue;
                            rounds.push({
                                checkpointID: record.id,
                                planID: metadataPlanID,
                                round: round,
                                verdict: verdict,
                                auditReportAt: typeof metadata.auditReportAt === "string"
                                    ? metadata.auditReportAt
                                    : record.createdAt,
                                sequence: record.sequence,
                                createdAt: record.createdAt,
                            });
                        }
                        return [2 /*return*/, rounds.sort(function (a, b) { return a.round - b.round; })];
                }
            });
        });
    };
    CheckpointStore.prototype.createAuditRoundCheckpoint = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var existing;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.listAuditRounds(input.planID)];
                    case 1:
                        existing = _a.sent();
                        if (existing.some(function (round) { return round.round === input.round; }))
                            throw new Error("audit round already exists: ".concat(input.planID, ":").concat(input.round));
                        return [2 /*return*/, this.createCheckpoint({
                                reason: "audit_round",
                                context: input.context,
                                step: input.step,
                                turnID: input.turnID,
                                name: "audit_round:".concat(input.planID, ":").concat(input.round),
                                status: "audit_round:".concat(input.verdict),
                                metadata: __assign({ kind: "audit_round", planID: input.planID, round: input.round, verdict: input.verdict, auditReportAt: this.now().toISOString() }, (input.reportID ? { reportID: input.reportID } : {})),
                            })];
                }
            });
        });
    };
    CheckpointStore.prototype.diffCheckpoints = function (from_1, to_1) {
        return __awaiter(this, arguments, void 0, function (from, to, options) {
            var fromManifest, toManifest, changes;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.assertAvailable();
                        return [4 /*yield*/, this.manifestForRef(from)];
                    case 1:
                        fromManifest = _a.sent();
                        return [4 /*yield*/, this.manifestForRef(to)];
                    case 2:
                        toManifest = _a.sent();
                        changes = diffManifests(fromManifest, toManifest);
                        return [2 /*return*/, this.renderDiffChanges(fromManifest, toManifest, changes, options)];
                }
            });
        });
    };
    CheckpointStore.prototype.manifestForRef = function (ref) {
        return __awaiter(this, void 0, void 0, function () {
            var records, record, rounds, round_1, rounds, round_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (ref.kind === "current")
                            return [2 /*return*/, this.captureManifest()];
                        return [4 /*yield*/, this.list()];
                    case 1:
                        records = _a.sent();
                        if (!(ref.kind === "baseline")) return [3 /*break*/, 2];
                        record = records.find(function (candidate) { return candidate.complete; });
                        if (!record)
                            throw new Error("baseline checkpoint not found");
                        return [3 /*break*/, 7];
                    case 2:
                        if (!(ref.kind === "checkpoint")) return [3 /*break*/, 3];
                        record = records.find(function (candidate) {
                            return candidate.id === ref.id || String(candidate.sequence) === ref.id;
                        });
                        if (!record)
                            throw new Error("checkpoint not found: ".concat(ref.id));
                        return [3 /*break*/, 7];
                    case 3:
                        if (!(ref.kind === "round")) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.listAuditRounds(ref.planID)];
                    case 4:
                        rounds = _a.sent();
                        round_1 = rounds.find(function (candidate) { return candidate.round === ref.round; });
                        if (!round_1)
                            throw new Error("audit round not found: ".concat(ref.planID, ":").concat(ref.round));
                        record = records.find(function (candidate) { return candidate.id === round_1.checkpointID; });
                        return [3 /*break*/, 7];
                    case 5: return [4 /*yield*/, this.listAuditRounds(ref.planID)];
                    case 6:
                        rounds = _a.sent();
                        if (!rounds.length)
                            throw new Error("no audit round found".concat(ref.planID ? " for plan ".concat(ref.planID) : ""));
                        round_2 = rounds.at(-1);
                        record = records.find(function (candidate) { return candidate.id === round_2.checkpointID; });
                        _a.label = 7;
                    case 7:
                        if (!record)
                            throw new Error("checkpoint record not found");
                        if (!record.complete)
                            throw new Error("checkpoint is incomplete: ".concat(record.id));
                        return [4 /*yield*/, this.loadManifest(record)];
                    case 8: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    CheckpointStore.prototype.renderDiffChanges = function (fromManifest, toManifest, changes, options) {
        return __awaiter(this, void 0, void 0, function () {
            var result, maxFiles, maxPatchChars, _loop_1, this_1, _i, changes_1, change, state_1;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        result = [];
                        maxFiles = (_a = options.maxFiles) !== null && _a !== void 0 ? _a : 50;
                        maxPatchChars = (_b = options.maxPatchChars) !== null && _b !== void 0 ? _b : 12000;
                        _loop_1 = function (change) {
                            var oldEntry, newEntry, oldContent, _h, newContent, _j, operation, text, patch;
                            return __generator(this, function (_k) {
                                switch (_k.label) {
                                    case 0:
                                        if (result.length >= maxFiles)
                                            return [2 /*return*/, "break"];
                                        if (((_c = options.paths) === null || _c === void 0 ? void 0 : _c.length) &&
                                            !options.paths.some(function (path) { return change.path === path || change.path.startsWith("".concat(path, "/")); }))
                                            return [2 /*return*/, "continue"];
                                        oldEntry = (_e = fromManifest.entries[(_d = change.oldPath) !== null && _d !== void 0 ? _d : change.path]) !== null && _e !== void 0 ? _e : (change.oldPath ? fromManifest.entries[change.oldPath] : undefined);
                                        newEntry = toManifest.entries[change.path];
                                        if (!(oldEntry === null || oldEntry === void 0 ? void 0 : oldEntry.objectHash)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, this_1.objects
                                                .get(oldEntry.objectHash)
                                                .then(function (buffer) { return buffer.toString("utf8"); })
                                                .catch(function () { return undefined; })];
                                    case 1:
                                        _h = _k.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        _h = undefined;
                                        _k.label = 3;
                                    case 3:
                                        oldContent = _h;
                                        if (!(newEntry === null || newEntry === void 0 ? void 0 : newEntry.objectHash)) return [3 /*break*/, 5];
                                        return [4 /*yield*/, this_1.objects
                                                .get(newEntry.objectHash)
                                                .then(function (buffer) { return buffer.toString("utf8"); })
                                                .catch(function () { return undefined; })];
                                    case 4:
                                        _j = _k.sent();
                                        return [3 /*break*/, 6];
                                    case 5:
                                        _j = undefined;
                                        _k.label = 6;
                                    case 6:
                                        newContent = _j;
                                        operation = change.kind === "add"
                                            ? "added"
                                            : change.kind === "delete"
                                                ? "deleted"
                                                : change.kind === "rename"
                                                    ? "renamed"
                                                    : "modified";
                                        return [4 /*yield*/, this_1.diffTextCached(change.path, oldContent, newContent)];
                                    case 7:
                                        text = _k.sent();
                                        patch = options.includePatch === false
                                            ? undefined
                                            : (_f = text.patch) === null || _f === void 0 ? void 0 : _f.slice(0, maxPatchChars);
                                        if (oldContent === undefined && newContent === undefined) {
                                            result.push(__assign(__assign(__assign({ path: change.path, operation: operation }, (change.oldPath ? { oldPath: change.oldPath } : {})), { additions: 0, deletions: 0 }), (change.mode ? { mode: change.mode } : {})));
                                            return [2 /*return*/, "continue"];
                                        }
                                        result.push(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ path: change.path, operation: operation }, (change.oldPath ? { oldPath: change.oldPath } : {})), { additions: text.additions, deletions: text.deletions }), (patch ? { patch: patch } : {})), (text.structured ? { structured: text.structured } : {})), (options.includeContent !== false && oldContent !== undefined
                                            ? { before: oldContent }
                                            : {})), (options.includeContent !== false && newContent !== undefined
                                            ? { after: newContent }
                                            : {})), (change.mode ? { mode: change.mode } : {})));
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, changes_1 = changes;
                        _g.label = 1;
                    case 1:
                        if (!(_i < changes_1.length)) return [3 /*break*/, 4];
                        change = changes_1[_i];
                        return [5 /*yield**/, _loop_1(change)];
                    case 2:
                        state_1 = _g.sent();
                        if (state_1 === "break")
                            return [3 /*break*/, 4];
                        _g.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, result];
                }
            });
        });
    };
    CheckpointStore.prototype.rename = function (id, name) {
        return __awaiter(this, void 0, void 0, function () {
            var trimmed, updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.assertAvailable();
                        trimmed = name.trim();
                        if (!trimmed)
                            throw new Error("checkpoint name must not be empty");
                        return [4 /*yield*/, this.loadJournal()];
                    case 1: return [4 /*yield*/, (_a.sent()).rename(id, trimmed)];
                    case 2:
                        updated = _a.sent();
                        if (!updated)
                            throw new Error("checkpoint not found: ".concat(id));
                        this.emit({
                            type: "checkpoint.created",
                            id: updated.id,
                            reason: updated.reason,
                            turnID: updated.turnID,
                            stepID: updated.stepID,
                            sequence: updated.sequence,
                            complete: updated.complete,
                            files: updated.manifestMeta.entryCount,
                            changes: updated.changes.length,
                            contextJournalOffset: updated.contextMeta.journalOffset,
                            step: updated.contextMeta.step,
                            tokenEstimate: updated.contextMeta.tokenEstimate,
                            diskUsageBytes: updated.diskUsageBytes,
                        });
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    CheckpointStore.prototype.previewRollback = function (id_1, context_1) {
        return __awaiter(this, arguments, void 0, function (id, context, resources, dryRun) {
            var target, targetManifest, current, contextStatus, preview;
            var _a;
            if (resources === void 0) { resources = []; }
            if (dryRun === void 0) { dryRun = false; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.assertAvailable();
                        return [4 /*yield*/, this.get(id)];
                    case 1:
                        target = _b.sent();
                        if (!target)
                            throw new Error("checkpoint not found: ".concat(id));
                        return [4 /*yield*/, this.loadManifest(target)];
                    case 2:
                        targetManifest = _b.sent();
                        return [4 /*yield*/, this.captureManifest()];
                    case 3:
                        current = _b.sent();
                        contextStatus = context.journalStatus();
                        _a = {
                            checkpointID: target.id,
                            dryRun: dryRun
                        };
                        return [4 /*yield*/, this.previewChangesWithDiff(current, targetManifest, diffManifests(current, targetManifest))];
                    case 4:
                        _a.changes = _b.sent(),
                            _a.context = {
                                // Scalar header only: preview must not materialize the ledger.
                                truncateMessages: Math.max(0, contextStatus.messageCount - target.contextMeta.entryCount),
                                targetJournalOffset: target.contextMeta.journalOffset,
                                targetStep: target.contextMeta.step,
                                targetTokens: target.contextMeta.tokenEstimate,
                                compactionGeneration: target.contextMeta.compactionGeneration,
                            },
                            _a.resources = resourcePolicies(resources),
                            _a.ignoredFiles = current.ignoredFiles;
                        return [4 /*yield*/, this.diskUsageBytes()];
                    case 5:
                        preview = (_a.diskUsageBytes = _b.sent(),
                            _a.complete = target.complete && current.complete,
                            _a.warnings = __spreadArray(__spreadArray(__spreadArray([], target.errors, true), current.errors, true), additionalDirWarnings(this.workspaceRoot, this.additionalDirs), true),
                            _a);
                        this.emit({ type: "rollback.previewed", preview: preview });
                        return [2 /*return*/, preview];
                }
            });
        });
    };
    /**
     * Returns a global object-store diff from the earliest complete checkpoint to
     * the current workspace. This is the "own diff" source used by the review
     * UI before git integration: it sees every change since the checkpoint,
     * regardless of who made it.
     */
    CheckpointStore.prototype.workspaceDiff = function () {
        return __awaiter(this, void 0, void 0, function () {
            var records;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.assertAvailable();
                        return [4 /*yield*/, this.list()];
                    case 1:
                        records = _a.sent();
                        if (!records.some(function (record) { return record.complete; }))
                            return [2 /*return*/, []];
                        return [2 /*return*/, this.diffCheckpoints({ kind: "baseline" }, { kind: "current" }, {
                                includePatch: true,
                                includeContent: true,
                                maxFiles: 20000,
                                maxPatchChars: 1000000,
                            })];
                }
            });
        });
    };
    CheckpointStore.prototype.diffTextCached = function (path, oldText, newText) {
        return __awaiter(this, void 0, void 0, function () {
            var oldTextValue, newTextValue, cached, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        oldTextValue = oldText !== null && oldText !== void 0 ? oldText : "";
                        newTextValue = newText !== null && newText !== void 0 ? newText : "";
                        return [4 /*yield*/, this.diffCache.get(oldTextValue, newTextValue)];
                    case 1:
                        cached = _a.sent();
                        if (cached)
                            return [2 /*return*/, {
                                    additions: cached.additions,
                                    deletions: cached.deletions,
                                    structured: cached.structured,
                                }];
                        return [4 /*yield*/, diffTextAsync(path, oldText, newText)];
                    case 2:
                        result = _a.sent();
                        if (!result.structured) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.diffCache.set(oldTextValue, newTextValue, {
                                additions: result.additions,
                                deletions: result.deletions,
                                structured: result.structured,
                            })];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/, result];
                }
            });
        });
    };
    CheckpointStore.prototype.previewChangesWithDiff = function (current, target, changes) {
        return __awaiter(this, void 0, void 0, function () {
            var result, _i, changes_2, change, fromEntry, toEntry, beforeContent, _a, afterContent, _b, text;
            var _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        result = [];
                        _i = 0, changes_2 = changes;
                        _e.label = 1;
                    case 1:
                        if (!(_i < changes_2.length)) return [3 /*break*/, 10];
                        change = changes_2[_i];
                        fromEntry = (_d = current.entries[(_c = change.oldPath) !== null && _c !== void 0 ? _c : change.path]) !== null && _d !== void 0 ? _d : (change.oldPath ? current.entries[change.oldPath] : undefined);
                        toEntry = target.entries[change.path];
                        if (!(fromEntry === null || fromEntry === void 0 ? void 0 : fromEntry.objectHash)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.objects
                                .get(fromEntry.objectHash)
                                .then(function (buffer) { return buffer.toString("utf8"); })
                                .catch(function () { return undefined; })];
                    case 2:
                        _a = _e.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = undefined;
                        _e.label = 4;
                    case 4:
                        beforeContent = _a;
                        if (!(toEntry === null || toEntry === void 0 ? void 0 : toEntry.objectHash)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.objects
                                .get(toEntry.objectHash)
                                .then(function (buffer) { return buffer.toString("utf8"); })
                                .catch(function () { return undefined; })];
                    case 5:
                        _b = _e.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        _b = undefined;
                        _e.label = 7;
                    case 7:
                        afterContent = _b;
                        return [4 /*yield*/, this.diffTextCached(change.path, beforeContent, afterContent)];
                    case 8:
                        text = _e.sent();
                        result.push(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ kind: change.kind, path: change.path }, (change.oldPath ? { oldPath: change.oldPath } : {})), (change.mode ? { mode: change.mode } : {})), { additions: text.additions, deletions: text.deletions }), (text.patch ? { patch: text.patch } : {})), (text.structured ? { structured: text.structured } : {})), (beforeContent !== undefined ? { before: beforeContent } : {})), (afterContent !== undefined ? { after: afterContent } : {})));
                        _e.label = 9;
                    case 9:
                        _i++;
                        return [3 /*break*/, 1];
                    case 10: return [2 /*return*/, result];
                }
            });
        });
    };
    CheckpointStore.prototype.rollbackTo = function (id, options) {
        return __awaiter(this, void 0, void 0, function () {
            var target, targetContext, targetManifest, preview, safety, safetyContext, safetyManifest, _i, _a, policy, applied, error_3, recovered;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, this.get(id)];
                    case 1:
                        target = _e.sent();
                        if (!target)
                            throw new Error("checkpoint not found: ".concat(id));
                        if (!target.complete)
                            throw new Error("checkpoint is incomplete: ".concat(target.id));
                        return [4 /*yield*/, this.loadContext(target)];
                    case 2:
                        targetContext = _e.sent();
                        return [4 /*yield*/, this.loadManifest(target)];
                    case 3:
                        targetManifest = _e.sent();
                        return [4 /*yield*/, this.previewRollback(target.id, options.context, options.resources, Boolean(options.dryRun))];
                    case 4:
                        preview = _e.sent();
                        if (options.dryRun)
                            return [2 /*return*/, preview];
                        return [4 /*yield*/, this.createCheckpoint({
                                reason: "rollback_safety",
                                context: options.context,
                                step: options.context.journalStatus().messageCount,
                                status: "rollback_safety",
                            })];
                    case 5:
                        safety = _e.sent();
                        if (!safety.complete)
                            throw new Error("rollback safety checkpoint is incomplete; refusing workspace mutation");
                        return [4 /*yield*/, this.loadContext(safety)];
                    case 6:
                        safetyContext = _e.sent();
                        return [4 /*yield*/, this.loadManifest(safety)];
                    case 7:
                        safetyManifest = _e.sent();
                        preview.safetyCheckpointID = safety.id;
                        this.emit({
                            type: "rollback.begin",
                            checkpointID: target.id,
                            safetyCheckpointID: safety.id,
                        });
                        _e.label = 8;
                    case 8:
                        _e.trys.push([8, 16, , 22]);
                        _i = 0, _a = preview.resources;
                        _e.label = 9;
                    case 9:
                        if (!(_i < _a.length)) return [3 /*break*/, 12];
                        policy = _a[_i];
                        if (!(policy.action !== "none" && policy.action !== "preserve_dirty")) return [3 /*break*/, 11];
                        return [4 /*yield*/, ((_b = options.onResourcePolicy) === null || _b === void 0 ? void 0 : _b.call(options, policy))];
                    case 10:
                        _e.sent();
                        _e.label = 11;
                    case 11:
                        _i++;
                        return [3 /*break*/, 9];
                    case 12: return [4 /*yield*/, this.applyManifest(targetManifest)];
                    case 13:
                        applied = _e.sent();
                        if (options.failAfterWorkspaceApply)
                            throw new Error("injected workspace rollback failure");
                        if (options.failContextRestore)
                            throw new Error("injected context rollback failure");
                        options.context.restoreDurableCheckpoint(targetContext);
                        return [4 /*yield*/, ((_c = options.onContextRestored) === null || _c === void 0 ? void 0 : _c.call(options, targetContext))];
                    case 14:
                        _e.sent();
                        return [4 /*yield*/, this.truncateFutureCheckpoints(target, safety)];
                    case 15:
                        _e.sent();
                        this.emit({
                            type: "rollback.end",
                            checkpointID: target.id,
                            safetyCheckpointID: safety.id,
                            restoredFiles: applied.restoredFiles,
                            deletedFiles: applied.deletedFiles,
                            contextJournalOffset: target.contextMeta.journalOffset,
                            step: target.contextMeta.step,
                        });
                        return [2 /*return*/, preview];
                    case 16:
                        error_3 = _e.sent();
                        recovered = false;
                        _e.label = 17;
                    case 17:
                        _e.trys.push([17, , 20, 21]);
                        return [4 /*yield*/, this.applyManifest(safetyManifest)];
                    case 18:
                        _e.sent();
                        options.context.restoreDurableCheckpoint(safetyContext);
                        return [4 /*yield*/, ((_d = options.onContextRestored) === null || _d === void 0 ? void 0 : _d.call(options, safetyContext))];
                    case 19:
                        _e.sent();
                        recovered = true;
                        return [3 /*break*/, 21];
                    case 20:
                        this.emit({
                            type: "rollback.failed",
                            checkpointID: target.id,
                            safetyCheckpointID: safety.id,
                            message: "rollback transaction failed: ".concat(errorKind(error_3)),
                            recovered: recovered,
                        });
                        return [7 /*endfinally*/];
                    case 21: throw error_3;
                    case 22: return [2 /*return*/];
                }
            });
        });
    };
    CheckpointStore.prototype.gcObjects = function () {
        return __awaiter(this, arguments, void 0, function (dryRun, extraReachable) {
            var run, queued;
            var _this = this;
            if (dryRun === void 0) { dryRun = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        run = function () { return _this.gcObjectsLocked(dryRun, extraReachable); };
                        queued = this.checkpointQueue.then(run, run);
                        this.checkpointQueue = queued.then(function () { return undefined; }, function () { return undefined; });
                        return [4 /*yield*/, queued];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Every sibling session journal under the same checkpoint parent, plus the
     * caller's own journal. The workspace object store and the chunk root are
     * shared, so a GC that only saw this session would delete another session's
     * live payloads.
     */
    CheckpointStore.prototype.journalsForGc = function (ownJournal) {
        return __awaiter(this, void 0, void 0, function () {
            var journals, parent, ownDir, entries, error_4, _i, entries_1, entry, sessionDir, journalPath, _a, _b, error_5;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        journals = [ownJournal];
                        parent = (0, node_path_1.dirname)(this.storeDir);
                        ownDir = (0, node_path_1.resolve)(this.storeDir);
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, promises_1.readdir)(parent, { withFileTypes: true })];
                    case 2:
                        entries = _c.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _c.sent();
                        if (error_4.code === "ENOENT")
                            return [2 /*return*/, journals];
                        throw error_4;
                    case 4:
                        _i = 0, entries_1 = entries;
                        _c.label = 5;
                    case 5:
                        if (!(_i < entries_1.length)) return [3 /*break*/, 10];
                        entry = entries_1[_i];
                        if (!entry.isDirectory())
                            return [3 /*break*/, 9];
                        sessionDir = (0, node_path_1.resolve)(parent, entry.name);
                        if (sessionDir === ownDir)
                            return [3 /*break*/, 9];
                        journalPath = (0, node_path_1.join)(sessionDir, "journal.jsonl");
                        _c.label = 6;
                    case 6:
                        _c.trys.push([6, 8, , 9]);
                        _b = (_a = journals).push;
                        return [4 /*yield*/, checkpoint_journal_1.CheckpointJournal.load(journalPath, this.chunks)];
                    case 7:
                        _b.apply(_a, [_c.sent()]);
                        return [3 /*break*/, 9];
                    case 8:
                        error_5 = _c.sent();
                        // A foreign/corrupt directory must never make GC unsafe: skipping it
                        // can only keep payloads that might already be dead, never delete a
                        // live one.
                        console.warn("[checkpoint] GC skipped unreadable journal ".concat(journalPath, ": ").concat(error_5 instanceof Error ? error_5.message : String(error_5)));
                        return [3 /*break*/, 9];
                    case 9:
                        _i++;
                        return [3 /*break*/, 5];
                    case 10: return [2 /*return*/, journals];
                }
            });
        });
    };
    CheckpointStore.prototype.gcObjectsLocked = function (dryRun, extraReachable) {
        return __awaiter(this, void 0, void 0, function () {
            var ownJournal, journals, referenced, referencedChunks, _i, journals_1, journal, index, manifest, _a, _b, entry, _c, _d, hash, _e, _f, id, chunks, existing, _g, unreachable, bytes, _h, unreachable_1, hash, _j, _k;
            return __generator(this, function (_l) {
                switch (_l.label) {
                    case 0: return [4 /*yield*/, this.loadJournal()];
                    case 1:
                        ownJournal = _l.sent();
                        return [4 /*yield*/, this.journalsForGc(ownJournal)];
                    case 2:
                        journals = _l.sent();
                        referenced = new Set();
                        referencedChunks = new Set();
                        _i = 0, journals_1 = journals;
                        _l.label = 3;
                    case 3:
                        if (!(_i < journals_1.length)) return [3 /*break*/, 9];
                        journal = journals_1[_i];
                        index = 0;
                        _l.label = 4;
                    case 4:
                        if (!(index < journal.length)) return [3 /*break*/, 7];
                        return [4 /*yield*/, journal.manifestAt(index)];
                    case 5:
                        manifest = _l.sent();
                        for (_a = 0, _b = Object.values(manifest.entries); _a < _b.length; _a++) {
                            entry = _b[_a];
                            if (entry.objectHash)
                                referenced.add(entry.objectHash);
                        }
                        _l.label = 6;
                    case 6:
                        index++;
                        return [3 /*break*/, 4];
                    case 7:
                        for (_c = 0, _d = journal.referencedChunks(); _c < _d.length; _c++) {
                            hash = _d[_c];
                            referencedChunks.add(hash);
                        }
                        _l.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 3];
                    case 9:
                        for (_e = 0, _f = extraReachable !== null && extraReachable !== void 0 ? extraReachable : []; _e < _f.length; _e++) {
                            id = _f[_e];
                            referenced.add(id);
                            referencedChunks.add(id);
                        }
                        return [4 /*yield*/, this.chunks.collectGarbage(referencedChunks, dryRun, {
                                minAgeMs: 60000,
                            })];
                    case 10:
                        chunks = _l.sent();
                        if (!dryRun) return [3 /*break*/, 16];
                        _g = Set.bind;
                        return [4 /*yield*/, this.objects.list()];
                    case 11:
                        existing = new (_g.apply(Set, [void 0, _l.sent()]))();
                        unreachable = __spreadArray([], existing, true).filter(function (hash) { return !referenced.has(hash); });
                        bytes = 0;
                        _h = 0, unreachable_1 = unreachable;
                        _l.label = 12;
                    case 12:
                        if (!(_h < unreachable_1.length)) return [3 /*break*/, 15];
                        hash = unreachable_1[_h];
                        _j = bytes;
                        return [4 /*yield*/, (0, promises_1.stat)(this.objectPath(hash))];
                    case 13:
                        bytes = _j + (_l.sent()).size;
                        _l.label = 14;
                    case 14:
                        _h++;
                        return [3 /*break*/, 12];
                    case 15: return [2 /*return*/, {
                            dryRun: dryRun,
                            unreachableObjects: unreachable.length,
                            bytes: bytes,
                            unreachableChunks: chunks.removed,
                            chunkBytes: chunks.bytes,
                        }];
                    case 16:
                        _k = [{ dryRun: dryRun }];
                        return [4 /*yield*/, this.objects.collectGarbage(referenced)];
                    case 17: return [2 /*return*/, __assign.apply(void 0, [__assign.apply(void 0, _k.concat([(_l.sent())])), { unreachableChunks: chunks.removed, chunkBytes: chunks.bytes }])];
                }
            });
        });
    };
    CheckpointStore.prototype.diskUsageBytes = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, directorySize(this.storeDir)];
            });
        });
    };
    CheckpointStore.prototype.captureManifest = function () {
        return __awaiter(this, arguments, void 0, function (options) {
            var writeObjects, ignoreRules, manifest, roots, _i, _a, dir, resolved, _b, roots_1, root;
            var _c;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        writeObjects = (_c = options.writeObjects) !== null && _c !== void 0 ? _c : true;
                        return [4 /*yield*/, (0, platform_1.ensureNataliaIgnoreFile)(this.workspaceRoot, this.legacyIgnore)];
                    case 1:
                        _d.sent();
                        return [4 /*yield*/, (0, platform_1.loadNataliaIgnore)(this.workspaceRoot)];
                    case 2:
                        ignoreRules = (_d.sent()).rules;
                        manifest = {
                            root: this.workspaceRoot,
                            entries: {},
                            complete: true,
                            errors: [],
                            ignoredFiles: 0,
                            totalBytes: 0,
                        };
                        roots = [this.workspaceRoot];
                        for (_i = 0, _a = this.additionalDirs; _i < _a.length; _i++) {
                            dir = _a[_i];
                            resolved = (0, node_path_1.resolve)(this.workspaceRoot, dir);
                            if (isContained(this.workspaceRoot, resolved))
                                roots.push(resolved);
                            else {
                                manifest.complete = false;
                                manifest.errors.push("checkpoint additional directory is outside the managed workspace");
                            }
                        }
                        _b = 0, roots_1 = roots;
                        _d.label = 3;
                    case 3:
                        if (!(_b < roots_1.length)) return [3 /*break*/, 6];
                        root = roots_1[_b];
                        return [4 /*yield*/, this.scanDirectory(root, manifest, writeObjects, ignoreRules)];
                    case 4:
                        _d.sent();
                        _d.label = 5;
                    case 5:
                        _b++;
                        return [3 /*break*/, 3];
                    case 6: return [2 /*return*/, manifest];
                }
            });
        });
    };
    CheckpointStore.prototype.scanDirectory = function (dir, manifest, writeObjects, ignoreRules) {
        return __awaiter(this, void 0, void 0, function () {
            var entries, _i, entries_2, entry, full, rel, info, bytes, objectHash, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.readdir)(dir, { withFileTypes: true })];
                    case 1:
                        entries = _a.sent();
                        _i = 0, entries_2 = entries;
                        _a.label = 2;
                    case 2:
                        if (!(_i < entries_2.length)) return [3 /*break*/, 14];
                        entry = entries_2[_i];
                        full = (0, node_path_1.join)(dir, entry.name);
                        rel = normalizeManifestPath((0, node_path_1.relative)(this.workspaceRoot, full));
                        if (!rel ||
                            this.shouldIgnore(rel, full, entry.isDirectory(), ignoreRules)) {
                            manifest.ignoredFiles += 1;
                            return [3 /*break*/, 13];
                        }
                        if (Object.keys(manifest.entries).length >= this.maxFiles) {
                            manifest.complete = false;
                            manifest.errors.push("checkpoint file count guard exceeded: ".concat(this.maxFiles));
                            return [2 /*return*/];
                        }
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 12, , 13]);
                        return [4 /*yield*/, (0, promises_1.lstat)(full)];
                    case 4:
                        info = _a.sent();
                        if (!info.isDirectory()) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.scanDirectory(full, manifest, writeObjects, ignoreRules)];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 13];
                    case 6:
                        if (!info.isSymbolicLink()) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.captureSymlink(full, rel, manifest)];
                    case 7:
                        _a.sent();
                        return [3 /*break*/, 13];
                    case 8:
                        if (!info.isFile()) {
                            manifest.ignoredFiles += 1;
                            return [3 /*break*/, 13];
                        }
                        manifest.totalBytes += info.size;
                        if (manifest.totalBytes > this.maxBytes) {
                            manifest.complete = false;
                            manifest.errors.push("checkpoint byte guard exceeded: ".concat(this.maxBytes));
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, (0, promises_1.readFile)(full)];
                    case 9:
                        bytes = _a.sent();
                        objectHash = (0, node_crypto_1.createHash)("sha256").update(bytes).digest("hex");
                        if (!writeObjects) return [3 /*break*/, 11];
                        return [4 /*yield*/, this.writeObject(objectHash, bytes)];
                    case 10:
                        _a.sent();
                        _a.label = 11;
                    case 11:
                        manifest.entries[rel] = {
                            path: rel,
                            kind: "regular",
                            objectHash: objectHash,
                            size: info.size,
                            mode: info.mode & 511,
                        };
                        return [3 /*break*/, 13];
                    case 12:
                        error_6 = _a.sent();
                        manifest.complete = false;
                        manifest.errors.push("checkpoint could not read a workspace entry: ".concat(errorKind(error_6)));
                        return [3 /*break*/, 13];
                    case 13:
                        _i++;
                        return [3 /*break*/, 2];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    CheckpointStore.prototype.captureSymlink = function (full, rel, manifest) {
        return __awaiter(this, void 0, void 0, function () {
            var target, resolvedTarget, info;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.readlink)(full)];
                    case 1:
                        target = _a.sent();
                        resolvedTarget = (0, node_path_1.resolve)((0, node_path_1.dirname)(full), (0, platform_1.normalizeLinkTarget)(target));
                        if (!isContained(this.workspaceRoot, resolvedTarget)) {
                            manifest.complete = false;
                            manifest.errors.push("checkpoint contains a symlink outside the managed workspace");
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, (0, promises_1.lstat)(full)];
                    case 2:
                        info = _a.sent();
                        manifest.entries[rel] = {
                            path: rel,
                            kind: "symlink",
                            mode: info.mode & 511,
                            linkTarget: target,
                        };
                        return [2 /*return*/];
                }
            });
        });
    };
    CheckpointStore.prototype.writeObject = function (hash, bytes) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // The shared store dedups by content hash; `hash` is sha256(bytes), so the
                    // written object id is identical.
                    return [4 /*yield*/, this.objects.put(bytes)];
                    case 1:
                        // The shared store dedups by content hash; `hash` is sha256(bytes), so the
                        // written object id is identical.
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    CheckpointStore.prototype.applyManifest = function (manifest) {
        return __awaiter(this, void 0, void 0, function () {
            var current, restoredFiles, deletedFiles, _i, _a, path, _loop_2, this_2, _b, _c, entry;
            var _this = this;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.captureManifest({ writeObjects: false })];
                    case 1:
                        current = _d.sent();
                        restoredFiles = 0;
                        deletedFiles = 0;
                        _i = 0, _a = Object.keys(current.entries);
                        _d.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        path = _a[_i];
                        if (manifest.entries[path])
                            return [3 /*break*/, 4];
                        return [4 /*yield*/, removeWorkspacePath(this.workspaceRoot, path)];
                    case 3:
                        _d.sent();
                        deletedFiles += 1;
                        _d.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        _loop_2 = function (entry) {
                            var full, resolvedTarget, targetIsDirectory, temp;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        full = workspacePath(this_2.workspaceRoot, entry.path);
                                        return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(full), { recursive: true })];
                                    case 1:
                                        _e.sent();
                                        return [4 /*yield*/, (0, platform_1.forceRemove)(full, { recursive: true })];
                                    case 2:
                                        _e.sent();
                                        if (!(entry.kind === "symlink")) return [3 /*break*/, 5];
                                        if (!entry.linkTarget)
                                            throw new Error("missing symlink target: ".concat(entry.path));
                                        resolvedTarget = (0, node_path_1.resolve)((0, node_path_1.dirname)(full), (0, platform_1.normalizeLinkTarget)(entry.linkTarget));
                                        if (!isContained(this_2.workspaceRoot, resolvedTarget))
                                            throw new Error("refusing to restore escaping symlink: ".concat(entry.path));
                                        return [4 /*yield*/, (0, promises_1.stat)(resolvedTarget)
                                                .then(function (info) { return info.isDirectory(); })
                                                .catch(function () { return false; })];
                                    case 3:
                                        targetIsDirectory = _e.sent();
                                        return [4 /*yield*/, (0, platform_1.createSymlink)(entry.linkTarget, full, { targetIsDirectory: targetIsDirectory })];
                                    case 4:
                                        _e.sent();
                                        restoredFiles += 1;
                                        return [2 /*return*/, "continue"];
                                    case 5:
                                        if (!entry.objectHash)
                                            throw new Error("missing object hash: ".concat(entry.path));
                                        temp = "".concat(full, ".natalia-rollback-tmp");
                                        return [4 /*yield*/, (0, promises_1.copyFile)(this_2.objectPath(entry.objectHash), temp, node_fs_1.constants.COPYFILE_FICLONE_FORCE).catch(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                                return [2 /*return*/, (0, promises_1.copyFile)(this.objectPath(entry.objectHash), temp)];
                                            }); }); })];
                                    case 6:
                                        _e.sent();
                                        return [4 /*yield*/, (0, promises_1.chmod)(temp, entry.mode)];
                                    case 7:
                                        _e.sent();
                                        return [4 /*yield*/, (0, promises_1.rename)(temp, full)];
                                    case 8:
                                        _e.sent();
                                        restoredFiles += 1;
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        _b = 0, _c = Object.values(manifest.entries);
                        _d.label = 6;
                    case 6:
                        if (!(_b < _c.length)) return [3 /*break*/, 9];
                        entry = _c[_b];
                        return [5 /*yield**/, _loop_2(entry)];
                    case 7:
                        _d.sent();
                        _d.label = 8;
                    case 8:
                        _b++;
                        return [3 /*break*/, 6];
                    case 9: return [2 /*return*/, { restoredFiles: restoredFiles, deletedFiles: deletedFiles }];
                }
            });
        });
    };
    CheckpointStore.prototype.truncateFutureCheckpoints = function (target, safety) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.loadJournal()];
                    case 1: return [4 /*yield*/, (_a.sent()).truncateAfter(target.sequence, safety.sequence)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /** Newest record summary, for sequence numbering and baseline checks. */
    CheckpointStore.prototype.readLastRecord = function () {
        return __awaiter(this, void 0, void 0, function () {
            var journal, index, record, _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.loadJournal()];
                    case 1:
                        journal = _c.sent();
                        if (journal.isEmpty)
                            return [2 /*return*/, undefined];
                        index = journal.length - 1;
                        return [4 /*yield*/, journal.summaryAt(index)];
                    case 2:
                        record = _c.sent();
                        _a = [__assign({}, record)];
                        _b = {};
                        return [4 /*yield*/, journal.manifestAt(index)];
                    case 3: return [2 /*return*/, __assign.apply(void 0, _a.concat([(_b.manifest = _c.sent(), _b)]))];
                }
            });
        });
    };
    CheckpointStore.prototype.shouldIgnore = function (rel, full, directory, ignoreRules) {
        // Structural self-exclusion: a snapshot must never include its own store,
        // the shared object library, or the chunk library, even if the user removes
        // .natalia/ from .nataliaignore.
        if (full === this.storeDir ||
            isContained(this.storeDir, full) ||
            full === this.objectRoot() ||
            isContained(this.objectRoot(), full) ||
            full === this.chunkRoot ||
            isContained(this.chunkRoot, full))
            return true;
        if (full === (0, node_path_1.resolve)(this.workspaceRoot, platform_1.NATALIA_IGNORE_FILE))
            return true;
        return (0, platform_1.isSnapshotIgnored)(rel, directory, ignoreRules);
    };
    CheckpointStore.prototype.assertAvailable = function () {
        if (!this.enabled)
            throw new Error("checkpoint disabled by config");
        if (this.unavailableReason)
            throw new Error("checkpoint unavailable: ".concat(this.unavailableReason));
    };
    CheckpointStore.prototype.journalPath = function () {
        return (0, node_path_1.join)(this.storeDir, "journal.jsonl");
    };
    CheckpointStore.prototype.objectRoot = function () {
        // The shared object library, git-style: one store for checkpoint and the
        // sandbox, so identical files across subsystems share a single object.
        return (0, node_path_1.resolve)(this.workspaceRoot, ".natalia", "objects");
    };
    CheckpointStore.prototype.objectPath = function (hash) {
        return (0, node_path_1.join)(this.objectRoot(), hash.slice(0, 2), hash);
    };
    CheckpointStore.prototype.emit = function (event) {
        var _a;
        (_a = this.onEvent) === null || _a === void 0 ? void 0 : _a.call(this, event);
    };
    return CheckpointStore;
}());
exports.CheckpointStore = CheckpointStore;
function initializeDefaultCheckpointStore(options) {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, CheckpointStore.open(options)];
                case 1:
                    store = _a.sent();
                    if (!(options.enabled !== false)) return [3 /*break*/, 3];
                    return [4 /*yield*/, store.ensureBaseline(options.context, 0)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/, store];
            }
        });
    });
}
function runCheckpointCommand(store_1, context_1, command_1) {
    return __awaiter(this, arguments, void 0, function (store, context, command, options, 
    /**
     * Other object-library owners' referenced ids (the sandbox's snapshot
     * indices), so GC never prunes a live sandbox object.
     */
    extraReachable) {
        var parts, name, record, result, _a, _b, _c, limitIndex, limit, records, target, dryRun, preview;
        var _d;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    parts = command.trim().split(/\s+/u);
                    name = parts[0];
                    if (!(name === "/checkpoint")) return [3 /*break*/, 2];
                    return [4 /*yield*/, store.createCheckpoint({
                            reason: "manual",
                            context: context,
                            step: context.journalStatus().messageCount,
                        })];
                case 1:
                    record = _e.sent();
                    return [2 /*return*/, { ok: true, output: formatCheckpoint(record) }];
                case 2:
                    if (!(name === "/checkpoints")) return [3 /*break*/, 7];
                    if (!(parts[1] === "gc")) return [3 /*break*/, 5];
                    _b = (_a = store).gcObjects;
                    _c = [parts.includes("--dry-run")];
                    return [4 /*yield*/, (extraReachable === null || extraReachable === void 0 ? void 0 : extraReachable())];
                case 3: return [4 /*yield*/, _b.apply(_a, _c.concat([_e.sent()]))];
                case 4:
                    result = _e.sent();
                    return [2 /*return*/, {
                            ok: true,
                            output: "checkpoint gc ".concat(result.dryRun ? "dry-run" : "applied", ": ").concat(result.unreachableObjects, " objects, ").concat(result.bytes, " bytes"),
                        }];
                case 5:
                    limitIndex = parts.indexOf("--limit");
                    limit = limitIndex >= 0 ? Number(parts[limitIndex + 1]) : 20;
                    return [4 /*yield*/, store.list()];
                case 6:
                    records = (_e.sent()).slice(-limit);
                    return [2 /*return*/, { ok: true, output: records.map(formatCheckpoint).join("\n") }];
                case 7:
                    if (!(name === "/rollback")) return [3 /*break*/, 9];
                    target = (_d = parts[1]) !== null && _d !== void 0 ? _d : "last";
                    dryRun = parts.includes("--dry-run");
                    return [4 /*yield*/, store.rollbackTo(target, __assign({ context: context, dryRun: dryRun }, options))];
                case 8:
                    preview = _e.sent();
                    return [2 /*return*/, { ok: true, output: formatRollbackPreview(preview) }];
                case 9: return [2 /*return*/, { ok: false, output: "unknown checkpoint command: ".concat(name) }];
            }
        });
    });
}
function diffText(path, oldText, newText) {
    var before = oldText !== null && oldText !== void 0 ? oldText : "";
    var after = newText !== null && newText !== void 0 ? newText : "";
    var a = before.endsWith("\n")
        ? before.slice(0, -1).split("\n")
        : before
            ? before.split("\n")
            : [];
    var b = after.endsWith("\n")
        ? after.slice(0, -1).split("\n")
        : after
            ? after.split("\n")
            : [];
    if (a.length === 0 && b.length === 0)
        return { additions: 0, deletions: 0 };
    var ops = diffLineOps(a, b);
    var additions = 0;
    var deletions = 0;
    for (var _i = 0, ops_1 = ops; _i < ops_1.length; _i++) {
        var op = ops_1[_i];
        if (op.type === "insert")
            additions++;
        if (op.type === "delete")
            deletions++;
    }
    if (additions === 0 && deletions === 0)
        return { additions: 0, deletions: 0 };
    return {
        additions: additions,
        deletions: deletions,
        patch: renderUnifiedPatch(path, ops),
    };
}
function renderUnifiedPatch(path, ops) {
    var entries = [];
    var oldLine = 1;
    var newLine = 1;
    for (var _i = 0, ops_2 = ops; _i < ops_2.length; _i++) {
        var op = ops_2[_i];
        entries.push({ op: op, oldLine: oldLine, newLine: newLine });
        if (op.type !== "insert")
            oldLine++;
        if (op.type !== "delete")
            newLine++;
    }
    var changeIndexes = entries.flatMap(function (entry, index) {
        return entry.op.type === "equal" ? [] : [index];
    });
    if (!changeIndexes.length)
        return "";
    var context = 3;
    var ranges = [];
    for (var _a = 0, changeIndexes_1 = changeIndexes; _a < changeIndexes_1.length; _a++) {
        var index = changeIndexes_1[_a];
        var start = Math.max(0, index - context);
        var end = Math.min(entries.length - 1, index + context);
        var last = ranges.at(-1);
        if (last && start <= last[1] + 1)
            last[1] = Math.max(last[1], end);
        else
            ranges.push([start, end]);
    }
    var lines = ["--- a/".concat(path), "+++ b/".concat(path)];
    for (var _b = 0, ranges_1 = ranges; _b < ranges_1.length; _b++) {
        var _c = ranges_1[_b], start = _c[0], end = _c[1];
        var first = entries[start];
        var slice = entries.slice(start, end + 1);
        var oldCount = slice.filter(function (entry) { return entry.op.type !== "insert"; }).length;
        var newCount = slice.filter(function (entry) { return entry.op.type !== "delete"; }).length;
        lines.push("@@ -".concat(first.oldLine, ",").concat(oldCount, " +").concat(first.newLine, ",").concat(newCount, " @@"));
        for (var _d = 0, slice_1 = slice; _d < slice_1.length; _d++) {
            var entry = slice_1[_d];
            if (entry.op.type === "insert")
                lines.push("+".concat(entry.op.text));
            else if (entry.op.type === "delete")
                lines.push("-".concat(entry.op.text));
            else
                lines.push(" ".concat(entry.op.text));
        }
    }
    return lines.join("\n") + "\n";
}
function diffLineOps(a, b) {
    // A practical LCS line diff. Files larger than the guard fall back to a
    // whole-file block diff; the object store and UI still get usable output.
    var maxLines = 2000;
    if (a.length > maxLines || b.length > maxLines) {
        var ops_3 = [];
        for (var _i = 0, a_1 = a; _i < a_1.length; _i++) {
            var line = a_1[_i];
            ops_3.push({ type: "delete", text: line });
        }
        for (var _a = 0, b_1 = b; _a < b_1.length; _a++) {
            var line = b_1[_a];
            ops_3.push({ type: "insert", text: line });
        }
        return ops_3;
    }
    var n = a.length;
    var m = b.length;
    var dp = Array.from({ length: n + 1 }, function () {
        return new Array(m + 1).fill(0);
    });
    for (var i_1 = n - 1; i_1 >= 0; i_1--) {
        for (var j_1 = m - 1; j_1 >= 0; j_1--) {
            dp[i_1][j_1] =
                a[i_1] === b[j_1]
                    ? dp[i_1 + 1][j_1 + 1] + 1
                    : Math.max(dp[i_1 + 1][j_1], dp[i_1][j_1 + 1]);
        }
    }
    var ops = [];
    var i = 0;
    var j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            ops.push({ type: "equal", text: a[i] });
            i++;
            j++;
        }
        else if (dp[i + 1][j] >= dp[i][j + 1]) {
            ops.push({ type: "delete", text: a[i] });
            i++;
        }
        else {
            ops.push({ type: "insert", text: b[j] });
            j++;
        }
    }
    while (i < n)
        ops.push({ type: "delete", text: a[i++] });
    while (j < m)
        ops.push({ type: "insert", text: b[j++] });
    return ops;
}
/**
 * Pure in-process text diff. Unlike the Git tab, checkpoint and sandbox diffs
 * deliberately do not require git to be installed.
 */
function diffTextAsync(path, oldText, newText) {
    return __awaiter(this, void 0, void 0, function () {
        var diffWasmStructured, wasm, patch, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@natalia/diff-wasm"); })];
                case 1:
                    diffWasmStructured = (_b.sent()).diffWasmStructured;
                    return [4 /*yield*/, diffWasmStructured(oldText !== null && oldText !== void 0 ? oldText : "", newText !== null && newText !== void 0 ? newText : "")];
                case 2:
                    wasm = _b.sent();
                    patch = wasm.hunks.length
                        ? "--- a/".concat(path, "\n+++ b/").concat(path, "\n").concat(renderStructuredPatch(wasm))
                        : undefined;
                    return [2 /*return*/, __assign(__assign({ additions: wasm.additions, deletions: wasm.deletions }, (patch ? { patch: patch } : {})), { structured: wasm })];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, diffText(path, oldText, newText)];
            }
        });
    });
}
function renderStructuredPatch(diff) {
    if (!diff.hunks.length)
        return "";
    var lines = [];
    for (var _i = 0, _a = diff.hunks; _i < _a.length; _i++) {
        var hunk = _a[_i];
        lines.push("@@ -".concat(hunk.oldStart, ",").concat(hunk.oldCount, " +").concat(hunk.newStart, ",").concat(hunk.newCount, " @@"));
        for (var _b = 0, _c = hunk.lines; _b < _c.length; _b++) {
            var line = _c[_b];
            if (line.type === "add")
                lines.push("+".concat(line.text));
            else if (line.type === "delete")
                lines.push("-".concat(line.text));
            else
                lines.push(" ".concat(line.text));
        }
    }
    return lines.join("\n") + "\n";
}
function checkpointKind(record) {
    if (record.reason === "rollback_safety")
        return "rollback_safety";
    if (record.reason === "manual")
        return "manual";
    if (record.reason === "audit_round" || record.reason === "baseline")
        return "audit";
    return "auto_safety";
}
function diffManifests(before, after) {
    if (!before) {
        return Object.values(after.entries).map(function (entry) { return ({
            kind: "add",
            path: entry.path,
            mode: modeString(entry.mode),
        }); });
    }
    var changes = [];
    var beforeByHash = new Map();
    for (var _i = 0, _a = Object.values(before.entries); _i < _a.length; _i++) {
        var entry = _a[_i];
        var key = entryKey(entry);
        if (key)
            beforeByHash.set(key, entry.path);
    }
    for (var _b = 0, _c = Object.entries(after.entries); _b < _c.length; _b++) {
        var _d = _c[_b], path = _d[0], entry = _d[1];
        var old = before.entries[path];
        if (!old) {
            var oldPath = beforeByHash.get(entryKey(entry));
            changes.push({
                kind: oldPath ? "rename" : "add",
                path: path,
                oldPath: oldPath,
                mode: modeString(entry.mode),
            });
            continue;
        }
        if (old.kind !== entry.kind)
            changes.push({ kind: "symlink", path: path });
        else if (old.objectHash !== entry.objectHash ||
            old.linkTarget !== entry.linkTarget)
            changes.push({
                kind: entry.kind === "symlink" ? "symlink" : "modify",
                path: path,
            });
        if (old.mode !== entry.mode)
            changes.push({
                kind: "mode",
                path: path,
                mode: "".concat(modeString(old.mode), " -> ").concat(modeString(entry.mode)),
            });
    }
    for (var _e = 0, _f = Object.keys(before.entries); _e < _f.length; _e++) {
        var path = _f[_e];
        if (!after.entries[path])
            changes.push({ kind: "delete", path: path });
    }
    return changes;
}
function resourcePolicies(resources) {
    return resources.map(function (resource) {
        if (resource.kind === "pending_modal")
            return {
                kind: resource.kind,
                id: resource.id,
                action: "invalidate",
                summary: resource.summary,
            };
        if (resource.kind === "tool")
            return {
                kind: resource.kind,
                id: resource.id,
                action: "cancel",
                summary: resource.summary,
            };
        if (resource.status === "running" ||
            resource.status === "waiting" ||
            resource.status === "pending")
            return {
                kind: resource.kind,
                id: resource.id,
                action: "stop",
                summary: resource.summary,
            };
        if (resource.status === "preserve_dirty")
            return {
                kind: resource.kind,
                id: resource.id,
                action: "preserve_dirty",
                summary: resource.summary,
            };
        return {
            kind: resource.kind,
            id: resource.id,
            action: "none",
            summary: resource.summary,
        };
    });
}
function formatCheckpoint(record) {
    var name = record.name ? " name=".concat(JSON.stringify(record.name)) : "";
    return "".concat(record.id, " step=").concat(record.step, " reason=").concat(record.reason).concat(name, " files=").concat(record.manifestMeta.entryCount, " changes=").concat(record.changes.length, " tokens=").concat(record.contextMeta.tokenEstimate, " ").concat(record.complete ? "complete" : "incomplete");
}
function formatRollbackPreview(preview) {
    return "rollback ".concat(preview.checkpointID).concat(preview.dryRun ? " dry-run" : "", ": ").concat(preview.changes.length, " file changes, truncate ").concat(preview.context.truncateMessages, " messages, resources=").concat(preview.resources.length);
}
function additionalDirWarnings(root, dirs) {
    return dirs
        .filter(function (dir) { return !isContained(root, (0, node_path_1.resolve)(root, dir)); })
        .map(function () { return "checkpoint additional directory is outside the managed workspace"; });
}
function entryKey(entry) {
    if (!entry)
        return "";
    if (entry.kind === "regular")
        return "regular:".concat(entry.objectHash, ":").concat(entry.size);
    return "symlink:".concat(entry.linkTarget);
}
function modeString(mode) {
    return "0".concat(mode.toString(8));
}
function normalizeManifestPath(path) {
    return path.replace(/\\/gu, "/").replace(/^\.\//u, "");
}
function workspacePath(root, path) {
    var resolved = (0, node_path_1.resolve)(root, path);
    assertContained(root, resolved);
    return resolved;
}
function removeWorkspacePath(root, path) {
    return __awaiter(this, void 0, void 0, function () {
        var full;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    full = workspacePath(root, path);
                    return [4 /*yield*/, (0, platform_1.forceRemove)(full, { recursive: true })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function assertContained(root, target) {
    if (!isContained(root, target))
        throw new Error("path escapes workspace root: ".concat(target));
}
function isContained(root, target) {
    var rel = (0, node_path_1.relative)((0, node_path_1.resolve)(root), (0, node_path_1.resolve)(target));
    return rel === "" || (!rel.startsWith("..") && !(0, node_path_1.isAbsolute)(rel));
}
function directorySize(path) {
    return __awaiter(this, void 0, void 0, function () {
        var info, entries, size, _i, entries_3, entry, _a, error_7;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 7, , 8]);
                    return [4 /*yield*/, (0, promises_1.lstat)(path)];
                case 1:
                    info = _b.sent();
                    if (info.isFile() || info.isSymbolicLink())
                        return [2 /*return*/, info.size];
                    if (!info.isDirectory())
                        return [2 /*return*/, 0];
                    return [4 /*yield*/, (0, promises_1.readdir)(path)];
                case 2:
                    entries = _b.sent();
                    size = 0;
                    _i = 0, entries_3 = entries;
                    _b.label = 3;
                case 3:
                    if (!(_i < entries_3.length)) return [3 /*break*/, 6];
                    entry = entries_3[_i];
                    _a = size;
                    return [4 /*yield*/, directorySize((0, node_path_1.join)(path, entry))];
                case 4:
                    size = _a + _b.sent();
                    _b.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [2 /*return*/, size];
                case 7:
                    error_7 = _b.sent();
                    if (error_7.code === "ENOENT")
                        return [2 /*return*/, 0];
                    throw error_7;
                case 8: return [2 /*return*/];
            }
        });
    });
}
function listObjectHashes(root) {
    return __awaiter(this, void 0, void 0, function () {
        var buckets, hashes, _i, buckets_1, bucket, files, _a, files_1, file, error_8;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 6, , 7]);
                    return [4 /*yield*/, (0, promises_1.readdir)(root, { withFileTypes: true })];
                case 1:
                    buckets = _b.sent();
                    hashes = [];
                    _i = 0, buckets_1 = buckets;
                    _b.label = 2;
                case 2:
                    if (!(_i < buckets_1.length)) return [3 /*break*/, 5];
                    bucket = buckets_1[_i];
                    if (!bucket.isDirectory())
                        return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, promises_1.readdir)((0, node_path_1.join)(root, bucket.name), {
                            withFileTypes: true,
                        })];
                case 3:
                    files = _b.sent();
                    for (_a = 0, files_1 = files; _a < files_1.length; _a++) {
                        file = files_1[_a];
                        if (file.isFile())
                            hashes.push(file.name);
                    }
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, hashes];
                case 6:
                    error_8 = _b.sent();
                    if (error_8.code === "ENOENT")
                        return [2 /*return*/, []];
                    throw error_8;
                case 7: return [2 /*return*/];
            }
        });
    });
}
function fileSize(path) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.stat)(path)];
                case 1: return [2 /*return*/, (_b.sent()).size];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, 0];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function errorKind(error) {
    if (error && typeof error === "object" && "code" in error) {
        var code = error.code;
        if (typeof code === "string")
            return code;
    }
    return "filesystem_error";
}
/**
 * Atomically replaces the journal. POSIX rename is atomic and returns on the
 * first attempt; Windows rejects the rename while another client holds the
 * target open for reading (its handle lacks FILE_SHARE_DELETE), so the
 * overwrite retries with a short backoff and falls back to a direct write
 * once the lock clears. Journal writers are serialized per store, so the
 * fallback cannot interleave two updates.
 */
function replaceJournalFile(source, target) {
    return __awaiter(this, void 0, void 0, function () {
        var attempt, error_9, code, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    attempt = 0;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 8]);
                    return [4 /*yield*/, (0, promises_1.rename)(source, target)];
                case 2:
                    _c.sent();
                    return [2 /*return*/];
                case 3:
                    error_9 = _c.sent();
                    code = errorKind(error_9);
                    if (code !== "EPERM" &&
                        code !== "EBUSY" &&
                        code !== "EACCES" &&
                        code !== "EEXIST")
                        throw error_9;
                    if (!(attempt >= 4)) return [3 /*break*/, 6];
                    _a = promises_1.writeFile;
                    _b = [target];
                    return [4 /*yield*/, (0, promises_1.readFile)(source, "utf8")];
                case 4: return [4 /*yield*/, _a.apply(void 0, _b.concat([_c.sent(), {
                            mode: 384,
                        }]))];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
                case 6: return [4 /*yield*/, Bun.sleep(25 * (attempt + 1))];
                case 7:
                    _c.sent();
                    return [3 /*break*/, 8];
                case 8:
                    attempt++;
                    return [3 /*break*/, 1];
                case 9: return [2 /*return*/];
            }
        });
    });
}
