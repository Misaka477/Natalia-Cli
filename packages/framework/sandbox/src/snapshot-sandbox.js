"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.SnapshotSandboxManager = void 0;
/**
 * The git-free sandbox backend — the "类 git" layer.
 *
 * `WorktreeSandboxManager` needs git because worktrees are git concepts. This
 * backend gives every workspace the same candidate/promotion/rollback surface
 * without git: at create it captures a content-addressed snapshot of the host
 * and checks it out into the candidate worktree, `previewMerge` diffs the real
 * candidate against the base by content hash, and `merge` promotes the changed
 * files into the host with a last-known-good backup that `rollback` restores.
 * Git, when present, upgrades to the worktree backend's real commit history;
 * here the semantics are the same, the store is ours.
 */
var node_path_1 = require("node:path");
var platform_1 = require("@natalia/platform");
var workspace_manager_1 = require("./workspace-manager");
var object_store_1 = require("@natalia/object-store");
var snapshot_store_1 = require("./snapshot-store");
/**
 * Structural exclusions for a snapshot candidate: these are the sandbox's own
 * stores, not user content. They cannot be disabled through .nataliaignore.
 */
function isSnapshotInternalPath(rel) {
    return (rel === platform_1.NATALIA_IGNORE_FILE ||
        rel === ".natalia-manifest.json" ||
        rel === ".natalia/sandboxes" ||
        rel.startsWith(".natalia/sandboxes/") ||
        rel === ".natalia/snapshots" ||
        rel.startsWith(".natalia/snapshots/") ||
        rel === ".natalia/objects" ||
        rel.startsWith(".natalia/objects/") ||
        rel === ".natalia/checkpoints" ||
        rel.startsWith(".natalia/checkpoints/"));
}
var SnapshotSandboxManager = /** @class */ (function (_super) {
    __extends(SnapshotSandboxManager, _super);
    function SnapshotSandboxManager(hostRoot) {
        var _this = _super.call(this, (0, node_path_1.resolve)(hostRoot, ".natalia", "sandboxes")) || this;
        _this.hostRoot = hostRoot;
        _this.store = new snapshot_store_1.SnapshotStore(new object_store_1.ObjectStore((0, node_path_1.resolve)(hostRoot, ".natalia", "objects")), (0, node_path_1.resolve)(hostRoot, ".natalia", "snapshots"));
        return _this;
    }
    /** The backup a promotion leaves, when it left one. */
    SnapshotSandboxManager.prototype.rollbackPoint = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.store.hasLastKnownGood(id)];
                    case 1: return [2 /*return*/, (_a.sent())
                            ? "snapshot:".concat(id)
                            : undefined];
                }
            });
        });
    };
    SnapshotSandboxManager.prototype.snapshotIgnoreRules = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, platform_1.ensureNataliaIgnoreFile)(this.hostRoot)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, platform_1.loadNataliaIgnore)(this.hostRoot)];
                    case 2: return [2 /*return*/, (_a.sent()).rules];
                }
            });
        });
    };
    SnapshotSandboxManager.prototype.candidateIgnore = function (rules) {
        return function (rel, directory) {
            return isSnapshotInternalPath(rel) || (0, platform_1.isSnapshotIgnored)(rel, directory, rules);
        };
    };
    /**
     * Creates the isolated worktree, captures the host as its base, then checks
     * that base out into the candidate. The candidate index records the checkout
     * metadata so later diffs can reuse unchanged objects by size/mtime.
     */
    SnapshotSandboxManager.prototype.create = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var manifest, rules, base, candidate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _super.prototype.create.call(this, id)];
                    case 1:
                        manifest = _a.sent();
                        return [4 /*yield*/, this.snapshotIgnoreRules()];
                    case 2:
                        rules = _a.sent();
                        return [4 /*yield*/, this.store.capture(this.hostRoot, undefined, this.candidateIgnore(rules))];
                    case 3:
                        base = _a.sent();
                        return [4 /*yield*/, this.store.saveIndex(id, base)];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, this.store.materialize(manifest.root, base)];
                    case 5:
                        candidate = _a.sent();
                        return [4 /*yield*/, this.store.saveCandidateIndex(id, candidate)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/, manifest];
                }
            });
        });
    };
    /** The candidate's real changes against the base, by content hash. */
    SnapshotSandboxManager.prototype.previewMerge = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var base, candidateIndex;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.store.loadIndex(id)];
                    case 1:
                        base = _a.sent();
                        if (!!base) return [3 /*break*/, 3];
                        return [4 /*yield*/, _super.prototype.previewMerge.call(this, id)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3: return [4 /*yield*/, this.captureCandidate(id)];
                    case 4:
                        candidateIndex = _a.sent();
                        // Persist the candidate index so the live worktree's objects count as
                        // referenced for the shared library's GC — a reviewed-but-unmerged
                        // candidate is still an owner.
                        return [4 /*yield*/, this.store.saveCandidateIndex(id, candidateIndex)];
                    case 5:
                        // Persist the candidate index so the live worktree's objects count as
                        // referenced for the shared library's GC — a reviewed-but-unmerged
                        // candidate is still an owner.
                        _a.sent();
                        return [4 /*yield*/, this.store.diff(this.candidateRoot(id), base, candidateIndex)];
                    case 6: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Promotes the candidate's changes into the host with a last-known-good
     * backup. Base-compatible return: the changed files.
     */
    SnapshotSandboxManager.prototype.promoteWithValidation = function (id, input) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, _super.prototype.promoteWithValidation.call(this, id, __assign(__assign({}, input), { hostRoot: (_a = input.hostRoot) !== null && _a !== void 0 ? _a : this.hostRoot }))];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    SnapshotSandboxManager.prototype.merge = function (id, _hostRoot, authorize) {
        return __awaiter(this, void 0, void 0, function () {
            var base, candidateIndex, changes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.store.loadIndex(id)];
                    case 1:
                        base = _a.sent();
                        if (!!base) return [3 /*break*/, 3];
                        return [4 /*yield*/, _super.prototype.merge.call(this, id, this.hostRoot, authorize)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3: return [4 /*yield*/, this.captureCandidate(id)];
                    case 4:
                        candidateIndex = _a.sent();
                        return [4 /*yield*/, this.store.diff(this.candidateRoot(id), base, candidateIndex)];
                    case 5:
                        changes = _a.sent();
                        if (!changes.length)
                            throw new Error("candidate ".concat(id, " has no changes to promote"));
                        return [4 /*yield*/, this.store.promote(id, this.candidateRoot(id), this.hostRoot, changes, authorize, 
                            // The base the candidate was built from: the promotion checks the host
                            // still matches it before writing, which is what stops a second candidate
                            // taken from the same base from silently overwriting the first.
                            base)];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, this.store.saveCandidateIndex(id, candidateIndex)];
                    case 7:
                        _a.sent();
                        return [2 /*return*/, changes];
                }
            });
        });
    };
    /** Restores the host to the last-known-good state of the last promote. */
    SnapshotSandboxManager.prototype.rollback = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = {};
                        return [4 /*yield*/, this.store.rollback(this.hostRoot, id)];
                    case 1: return [2 /*return*/, (_a.restored = _b.sent(), _a)];
                }
            });
        });
    };
    /** Whether a last-known-good exists for the sandbox. */
    SnapshotSandboxManager.prototype.hasLastKnownGood = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.store.hasLastKnownGood(id)];
            });
        });
    };
    /**
     * Every object id this manager's snapshot indices reference — for the shared
     * object library's GC, so checkpoint's gc can never prune a live sandbox
     * object.
     */
    SnapshotSandboxManager.prototype.referencedObjectIDs = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.store.referencedObjectIDs()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /** The candidate's current index, reusing the previous one by size/mtime. */
    SnapshotSandboxManager.prototype.captureCandidate = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var rules, _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.snapshotIgnoreRules()];
                    case 1:
                        rules = _d.sent();
                        _b = (_a = this.store).capture;
                        _c = [this.candidateRoot(id)];
                        return [4 /*yield*/, this.store.loadCandidateIndex(id)];
                    case 2: return [4 /*yield*/, _b.apply(_a, _c.concat([_d.sent(), this.candidateIgnore(rules)]))];
                    case 3: return [2 /*return*/, _d.sent()];
                }
            });
        });
    };
    SnapshotSandboxManager.prototype.candidateRoot = function (id) {
        return (0, node_path_1.resolve)(this["baseRoot"], id);
    };
    return SnapshotSandboxManager;
}(workspace_manager_1.WorkspaceSandboxManager));
exports.SnapshotSandboxManager = SnapshotSandboxManager;
