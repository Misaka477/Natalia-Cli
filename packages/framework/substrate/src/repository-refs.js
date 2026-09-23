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
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureRepositoryRefsSync = captureRepositoryRefsSync;
exports.captureManifestRef = captureManifestRef;
exports.captureRepositoryRefFields = captureRepositoryRefFields;
exports.captureRepositoryEvidenceFields = captureRepositoryEvidenceFields;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var GIT_HASH = /^[0-9a-f]{7,64}$/iu;
/** Captures the refs synchronously where possible; the manifest ref is async. */
function captureRepositoryRefsSync(workspaceRoot, env) {
    var _a;
    if (env === void 0) { env = process.env; }
    var refs = {};
    var version = (_a = env.NATALIA_VERSION) === null || _a === void 0 ? void 0 : _a.trim();
    if (version)
        refs.repositoryVersion = version;
    try {
        var result = Bun.spawnSync(["git", "-C", workspaceRoot, "rev-parse", "HEAD"], { stdout: "pipe", stderr: "pipe" });
        if (result.success) {
            var commit = result.stdout.toString().trim();
            // Only a bare object hash is secret-safe; anything else is discarded.
            if (GIT_HASH.test(commit))
                refs.commit = commit;
        }
    }
    catch (_b) {
        // A missing git binary or non-repo workspace must never fail evidence.
    }
    return refs;
}
/**
 * Stamps a safe manifest ref: a short content hash of the public model catalog,
 * so two evidence records recorded against different catalogs are
 * distinguishable without exposing the catalog path or contents.
 */
function captureManifestRef(workspaceRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var content, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(workspaceRoot, ".natalia", "models-dev-catalog.json"), "utf8")];
                case 1:
                    content = _b.sent();
                    return [2 /*return*/, "models-dev-catalog:".concat(Bun.hash(content).toString(16))];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, undefined];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * The spread-ready evidence fields for one workspace: every evidence writer
 * (the record_validation tool, a runtime validation, a Nia audit round, a
 * sandbox promotion) stamps the same refs so "which tree validated this" is
 * always answerable from the record alone (EI E2).
 */
function captureRepositoryRefFields(workspaceRoot) {
    var refs = captureRepositoryRefsSync(workspaceRoot);
    return __assign(__assign({}, (refs.repositoryVersion
        ? { repositoryVersion: refs.repositoryVersion }
        : {})), (refs.commit ? { commit: refs.commit } : {}));
}
/** `captureRepositoryRefFields` plus the async manifest ref. */
function captureRepositoryEvidenceFields(workspaceRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var refs, manifestRef;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    refs = captureRepositoryRefFields(workspaceRoot);
                    return [4 /*yield*/, captureManifestRef(workspaceRoot)];
                case 1:
                    manifestRef = _a.sent();
                    if (manifestRef)
                        refs.manifestRef = manifestRef;
                    return [2 /*return*/, refs];
            }
        });
    });
}
