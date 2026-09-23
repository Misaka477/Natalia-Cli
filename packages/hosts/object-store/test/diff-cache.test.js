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
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var src_1 = require("../src");
var structured = {
    hunks: [
        {
            oldStart: 1,
            oldCount: 1,
            newStart: 1,
            newCount: 2,
            lines: [
                { type: "context", text: "a", oldLineNumber: 1, newLineNumber: 1 },
                { type: "add", text: "b", oldLineNumber: null, newLineNumber: 2 },
            ],
        },
    ],
    additions: 1,
    deletions: 0,
};
function openCache() {
    return __awaiter(this, arguments, void 0, function (maxEntries) {
        var root, objects, cache;
        if (maxEntries === void 0) { maxEntries = 100; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-diff-cache-"))];
                case 1:
                    root = _a.sent();
                    objects = new src_1.ObjectStore((0, node_path_1.join)(root, "objects"));
                    cache = new src_1.DiffCache(objects, "test-namespace", maxEntries);
                    return [2 /*return*/, { objects: objects, cache: cache }];
            }
        });
    });
}
(0, bun_test_1.test)("DiffCache stores and returns structured diffs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var cache, oldText, newText, _a, hit, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, openCache()];
            case 1:
                cache = (_c.sent()).cache;
                oldText = "a\n";
                newText = "a\nb\n";
                _a = bun_test_1.expect;
                return [4 /*yield*/, cache.get(oldText, newText)];
            case 2:
                _a.apply(void 0, [_c.sent()]).toBeUndefined();
                return [4 /*yield*/, cache.set(oldText, newText, {
                        additions: 1,
                        deletions: 0,
                        structured: structured,
                    })];
            case 3:
                _c.sent();
                return [4 /*yield*/, cache.get(oldText, newText)];
            case 4:
                hit = _c.sent();
                (0, bun_test_1.expect)(hit).toEqual({
                    additions: 1,
                    deletions: 0,
                    structured: structured,
                });
                _b = bun_test_1.expect;
                return [4 /*yield*/, cache.get("missing\n", "new-missing\n")];
            case 5:
                _b.apply(void 0, [_c.sent()]).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("DiffCache evicts the least recently used entries at max capacity", function () { return __awaiter(void 0, void 0, void 0, function () {
    var cache, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, openCache(2)];
            case 1:
                cache = (_d.sent()).cache;
                return [4 /*yield*/, cache.set("one\n", "one-new\n", {
                        additions: 1,
                        deletions: 0,
                        structured: structured,
                    })];
            case 2:
                _d.sent();
                return [4 /*yield*/, cache.set("two\n", "two-new\n", {
                        additions: 2,
                        deletions: 0,
                        structured: structured,
                    })];
            case 3:
                _d.sent();
                return [4 /*yield*/, cache.set("three\n", "three-new\n", {
                        additions: 3,
                        deletions: 0,
                        structured: structured,
                    })];
            case 4:
                _d.sent();
                // The original implementation evicts asynchronously; give the async
                // deleteMeta call a moment to finish before asserting eviction.
                return [4 /*yield*/, Bun.sleep(20)];
            case 5:
                // The original implementation evicts asynchronously; give the async
                // deleteMeta call a moment to finish before asserting eviction.
                _d.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, cache.get("one\n", "one-new\n")];
            case 6:
                _a.apply(void 0, [_d.sent()]).toBeUndefined();
                _b = bun_test_1.expect;
                return [4 /*yield*/, cache.get("two\n", "two-new\n")];
            case 7:
                _b.apply(void 0, [_d.sent()]).toBeDefined();
                _c = bun_test_1.expect;
                return [4 /*yield*/, cache.get("three\n", "three-new\n")];
            case 8:
                _c.apply(void 0, [_d.sent()]).toBeDefined();
                return [2 /*return*/];
        }
    });
}); });
