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
exports.L1_CACHE_KINDS = exports.toolSearchKind = exports.toolGlobKind = exports.toolFsReadKind = exports.OPAQUE_WORKSPACE_WRITERS = exports.READ_CACHE_TOOL_KINDS = void 0;
var node_fs_1 = require("node:fs");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
/**
 * The first consumable on the fabric: L1 read caching for tool execution
 * (RINA study — the tool pipeline executes fs-read/search cold on every
 * call today, and a subagent re-reads files its parent already read).
 *
 * The classification is the explicit list law 1 asks for: tools named here
 * are deterministic reads whose inputs fully determine their output;
 * everything else (shell, web, ask, todo, process…) is not listed and
 * therefore never caches. `shell` additionally *flushes* the tree kinds when
 * it finishes — it is the opaque writer the hooks cannot see into.
 */
/** tool name -> cache kind. Anything absent is executed every time. */
exports.READ_CACHE_TOOL_KINDS = {
    read_file: "tool.fs-read",
    glob: "tool.glob",
    grep: "tool.search",
};
/**
 * Tools that may write into the workspace without declaring paths (their
 * writes are opaque to the mutation hooks): after they run, tree-scoped
 * results are dropped — the study's invalidate-on-write, extended to the
 * one writer the declarations cannot see.
 */
exports.OPAQUE_WORKSPACE_WRITERS = new Set([
    "run_shell",
]);
function pathFromKey(key) {
    var parsed;
    try {
        parsed = JSON.parse(key);
    }
    catch (_a) {
        throw new Error("fs-read cache key is not JSON tool input: ".concat(key));
    }
    if (typeof parsed.path !== "string")
        throw new Error("fs-read cache key carries no path: ".concat(key));
    return parsed.path;
}
/**
 * Evidence for a read: the canonical path plus the file's own size and
 * nanosecond mtime — the fs's record of "this is what was true when the
 * value was computed". A hit whose stat disagrees is a miss (external
 * writers are seen), which is law 2: evidence beats TTL guessing.
 */
function captureFsReadEvidence(key) {
    return __awaiter(this, void 0, void 0, function () {
        var canonical, info;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    canonical = node_fs_1.realpathSync.native((0, node_path_1.resolve)(pathFromKey(key)));
                    return [4 /*yield*/, (0, promises_1.stat)(canonical, { bigint: true })];
                case 1:
                    info = _a.sent();
                    return [2 /*return*/, {
                            path: canonical,
                            size: String(info.size),
                            mtimeNs: String(info.mtimeNs),
                        }];
            }
        });
    });
}
function validFsReadEvidence(evidence, key) {
    return __awaiter(this, void 0, void 0, function () {
        var captured, info, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    captured = evidence;
                    if (!captured || typeof captured.path !== "string")
                        return [2 /*return*/, false];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, promises_1.stat)(captured.path, { bigint: true })];
                case 2:
                    info = _b.sent();
                    return [2 /*return*/, (String(info.size) === captured.size &&
                            String(info.mtimeNs) === captured.mtimeNs)];
                case 3:
                    _a = _b.sent();
                    // Gone or unreadable: the old value must not answer again.
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.toolFsReadKind = {
    id: "tool.fs-read",
    deterministic: true,
    invalidation: "path",
    captureEvidence: captureFsReadEvidence,
    validEvidence: validFsReadEvidence,
};
/**
 * Tree-scoped kinds: a listing or a search describes the whole tree, so any
 * workspace write (or an opaque shell write) drops every entry — cheap,
 * conservative, and never wrong in the dangerous direction.
 */
exports.toolGlobKind = {
    id: "tool.glob",
    deterministic: true,
    invalidation: "tree",
};
exports.toolSearchKind = {
    id: "tool.search",
    deterministic: true,
    invalidation: "tree",
};
exports.L1_CACHE_KINDS = [
    exports.toolFsReadKind,
    exports.toolGlobKind,
    exports.toolSearchKind,
];
