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
(0, bun_test_1.test)("ensureNataliaIgnoreFile creates the default file without overwriting", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, created, contents, _i, DEFAULT_NATALIA_IGNORE_PATTERNS_1, pattern, again, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ignore-default-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, src_1.ensureNataliaIgnoreFile)(root)];
            case 2:
                created = _b.sent();
                (0, bun_test_1.expect)(created.created).toBe(true);
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, src_1.NATALIA_IGNORE_FILE), "utf8")];
            case 3:
                contents = _b.sent();
                for (_i = 0, DEFAULT_NATALIA_IGNORE_PATTERNS_1 = src_1.DEFAULT_NATALIA_IGNORE_PATTERNS; _i < DEFAULT_NATALIA_IGNORE_PATTERNS_1.length; _i++) {
                    pattern = DEFAULT_NATALIA_IGNORE_PATTERNS_1[_i];
                    (0, bun_test_1.expect)(contents).toContain(pattern);
                }
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, src_1.NATALIA_IGNORE_FILE), "custom/\n")];
            case 4:
                _b.sent();
                return [4 /*yield*/, (0, src_1.ensureNataliaIgnoreFile)(root)];
            case 5:
                again = _b.sent();
                (0, bun_test_1.expect)(again.created).toBe(false);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, src_1.NATALIA_IGNORE_FILE), "utf8")];
            case 6:
                _a.apply(void 0, [_b.sent()]).toBe("custom/\n");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("ensureNataliaIgnoreFile migrates checkpoint.ignore patterns once", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, loaded;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ignore-migrate-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, src_1.ensureNataliaIgnoreFile)(root, ["legacy-cache/", "*.bak"])];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_1.loadNataliaIgnore)(root)];
            case 3:
                loaded = _a.sent();
                (0, bun_test_1.expect)(loaded.exists).toBe(true);
                (0, bun_test_1.expect)(loaded.patterns).toContain("legacy-cache/");
                (0, bun_test_1.expect)(loaded.patterns).toContain("*.bak");
                (0, bun_test_1.expect)(loaded.patterns).toContain("node_modules/");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("snapshot ignore rules are directory-aware and support negation", function () {
    var rules = (0, src_1.parseSnapshotIgnore)("build/\n!build/keep/\n*.tmp\n/root-only\n");
    (0, bun_test_1.expect)((0, src_1.isSnapshotIgnored)("build/generated.js", false, rules)).toBe(true);
    (0, bun_test_1.expect)((0, src_1.isSnapshotIgnored)("build/keep/note.md", false, rules)).toBe(false);
    (0, bun_test_1.expect)((0, src_1.isSnapshotIgnored)("src/a.tmp", false, rules)).toBe(true);
    (0, bun_test_1.expect)((0, src_1.isSnapshotIgnored)("root-only", false, rules)).toBe(true);
    (0, bun_test_1.expect)((0, src_1.isSnapshotIgnored)("nested/root-only", false, rules)).toBe(false);
});
