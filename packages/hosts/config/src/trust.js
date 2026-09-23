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
exports.TRUST_FILE = void 0;
exports.trustStorePath = trustStorePath;
exports.loadTrustStore = loadTrustStore;
exports.saveTrustStore = saveTrustStore;
exports.recordTrust = recordTrust;
exports.removeTrust = removeTrust;
exports.fingerprintFile = fingerprintFile;
exports.verifyTrust = verifyTrust;
/**
 * The trust database (分发层 P11, local half).
 *
 * Installing an out-of-tree tool family or plugin records where it came from
 * and a fingerprint of its entry file, so loading can verify the package on
 * disk is the one that was installed — a changed or replaced package is
 * reported instead of silently running whatever is there now.
 *
 * The store lives at `.natalia/trust.json` and is keyed by the family/plugin
 * id. It is an audit-and-verify record, not a permission gate: the operator who
 * configures a source has already opted in, and the store tells them when the
 * bytes changed.
 */
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
exports.TRUST_FILE = ".natalia/trust.json";
function trustStorePath(workspaceRoot) {
    return (0, node_path_1.resolve)(workspaceRoot, exports.TRUST_FILE);
}
function loadTrustStore(workspaceRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var parsed, _a, _b, error_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(trustStorePath(workspaceRoot), "utf8")];
                case 1:
                    parsed = _b.apply(_a, [_c.sent()]);
                    return [2 /*return*/, parsed && typeof parsed === "object" ? parsed : {}];
                case 2:
                    error_1 = _c.sent();
                    if (error_1.code === "ENOENT")
                        return [2 /*return*/, {}];
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function saveTrustStore(workspaceRoot, store) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.resolve)(workspaceRoot, ".natalia"), { recursive: true })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)(trustStorePath(workspaceRoot), "".concat(JSON.stringify(store, null, 2), "\n"), { mode: 384 })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function recordTrust(workspaceRoot, entry) {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, loadTrustStore(workspaceRoot)];
                case 1:
                    store = _a.sent();
                    store[entry.key] = entry;
                    return [4 /*yield*/, saveTrustStore(workspaceRoot, store)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, store];
            }
        });
    });
}
function removeTrust(workspaceRoot, key) {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, loadTrustStore(workspaceRoot)];
                case 1:
                    store = _a.sent();
                    delete store[key];
                    return [4 /*yield*/, saveTrustStore(workspaceRoot, store)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, store];
            }
        });
    });
}
/** sha256 of a file's bytes, the fingerprint a trust record pins. */
function fingerprintFile(path) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _b = (_a = (0, node_crypto_1.createHash)("sha256"))
                        .update;
                    return [4 /*yield*/, (0, promises_1.readFile)(path)];
                case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])
                        .digest("hex")];
            }
        });
    });
}
/**
 * Whether a family/plugin's on-disk entry matches the trust record. Returns
 * `undefined` when there is no record (never installed), `true` when it
 * matches, and the expected fingerprint when the bytes changed.
 */
function verifyTrust(workspaceRoot, key, entryPath) {
    return __awaiter(this, void 0, void 0, function () {
        var store, record, actual;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, loadTrustStore(workspaceRoot)];
                case 1:
                    store = _a.sent();
                    record = store[key];
                    if (!(record === null || record === void 0 ? void 0 : record.fingerprint))
                        return [2 /*return*/, { verified: false }];
                    return [4 /*yield*/, fingerprintFile(entryPath)];
                case 2:
                    actual = _a.sent();
                    return [2 /*return*/, {
                            verified: actual === record.fingerprint,
                            expected: record.fingerprint,
                            actual: actual,
                        }];
            }
        });
    });
}
