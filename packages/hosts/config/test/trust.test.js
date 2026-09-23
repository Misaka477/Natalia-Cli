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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var trust_1 = require("../src/trust");
(0, bun_test_1.test)("the trust store records, lists and removes entries", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, store, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-trust-"))];
            case 1:
                root = _c.sent();
                return [4 /*yield*/, (0, trust_1.recordTrust)(root, {
                        key: "/workspace/extra/extra.family",
                        source: "/workspace/extra/extra.family",
                        version: "1.0.0",
                        installedAt: "2026-08-16T00:00:00.000Z",
                    })];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, trust_1.loadTrustStore)(root)];
            case 3:
                store = _c.sent();
                (0, bun_test_1.expect)((_b = store["/workspace/extra/extra.family"]) === null || _b === void 0 ? void 0 : _b.version).toBe("1.0.0");
                return [4 /*yield*/, (0, trust_1.removeTrust)(root, "/workspace/extra/extra.family")];
            case 4:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, trust_1.loadTrustStore)(root)];
            case 5:
                _a.apply(void 0, [_c.sent()]).toEqual({});
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("verifyTrust reports a package that changed since install", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, dir, entry, fingerprint, _a, mismatch;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-trust-verify-"))];
            case 1:
                root = _b.sent();
                dir = (0, node_path_1.join)(root, "extra.family");
                return [4 /*yield*/, (0, promises_1.mkdir)(dir, { recursive: true })];
            case 2:
                _b.sent();
                entry = (0, node_path_1.join)(dir, "index.ts");
                return [4 /*yield*/, (0, promises_1.writeFile)(entry, "export const v = 1;")];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, trust_1.fingerprintFile)(entry)];
            case 4:
                fingerprint = _b.sent();
                return [4 /*yield*/, (0, trust_1.recordTrust)(root, {
                        key: dir,
                        source: dir,
                        version: "1.0.0",
                        fingerprint: fingerprint,
                        installedAt: new Date().toISOString(),
                    })];
            case 5:
                _b.sent();
                // Unchanged: verified.
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, trust_1.verifyTrust)(root, dir, entry)];
            case 6:
                // Unchanged: verified.
                _a.apply(void 0, [_b.sent()]).toMatchObject({
                    verified: true,
                });
                // Changed bytes: not verified, and the expected fingerprint is reported.
                return [4 /*yield*/, (0, promises_1.writeFile)(entry, "export const v = 2;")];
            case 7:
                // Changed bytes: not verified, and the expected fingerprint is reported.
                _b.sent();
                return [4 /*yield*/, (0, trust_1.verifyTrust)(root, dir, entry)];
            case 8:
                mismatch = _b.sent();
                (0, bun_test_1.expect)(mismatch.verified).toBe(false);
                (0, bun_test_1.expect)(mismatch.expected).toBe(fingerprint);
                (0, bun_test_1.expect)(mismatch.actual).not.toBe(fingerprint);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("verifyTrust reports an unrecorded package as unverified", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, entry, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-trust-unknown-"))];
            case 1:
                root = _b.sent();
                entry = (0, node_path_1.join)(root, "index.ts");
                return [4 /*yield*/, (0, promises_1.writeFile)(entry, "x")];
            case 2:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, trust_1.verifyTrust)(root, "/somewhere/else", entry)];
            case 3:
                _a.apply(void 0, [_b.sent()]).toEqual({
                    verified: false,
                });
                return [2 /*return*/];
        }
    });
}); });
