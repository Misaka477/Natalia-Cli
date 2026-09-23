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
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("tool output retention preserves complete output and paginates the preview", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, output, bounded, _a, nextPage, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tool-output-"))];
            case 1:
                root = _c.sent();
                output = "HEAD\n".concat("x".repeat(src_1.MAX_TOOL_OUTPUT_BYTES), "\nTAIL");
                return [4 /*yield*/, (0, src_1.boundToolOutput)(root, output)];
            case 2:
                bounded = _c.sent();
                (0, bun_test_1.expect)(bounded.outputPath).toBeDefined();
                (0, bun_test_1.expect)(bounded.truncated).toBe(true);
                (0, bun_test_1.expect)(bounded.page).toBe(1);
                (0, bun_test_1.expect)(bounded.totalPages).toBeGreaterThan(1);
                (0, bun_test_1.expect)(bounded.text).toContain("output truncated: page 1/");
                (0, bun_test_1.expect)(new TextEncoder().encode(bounded.text).byteLength).toBeLessThanOrEqual(src_1.MAX_TOOL_OUTPUT_BYTES);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)(bounded.outputPath, "utf8")];
            case 3:
                _a.apply(void 0, [_c.sent()]).toBe(output);
                (0, bun_test_1.expect)(bounded.nextPagePath).toBeDefined();
                return [4 /*yield*/, (0, promises_1.readFile)(bounded.nextPagePath, "utf8")];
            case 4:
                nextPage = _c.sent();
                (0, bun_test_1.expect)(nextPage).not.toBe("");
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.boundToolOutput)(root, nextPage)];
            case 5:
                _b.apply(void 0, [_c.sent()]).toEqual({ text: nextPage });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("page files form a complete read_file chain without re-truncation", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, output, bounded, text, pageNumber, _a, match, next, nextPage;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tool-output-chain-"))];
            case 1:
                root = _b.sent();
                output = Array.from({ length: 12000 }, function (_, index) { return "line ".concat(index, " ").concat("x".repeat(12)); }).join("\n");
                return [4 /*yield*/, (0, src_1.boundToolOutput)(root, output)];
            case 2:
                bounded = _b.sent();
                (0, bun_test_1.expect)(bounded.truncated).toBe(true);
                (0, bun_test_1.expect)(bounded.totalPages).toBeGreaterThan(3);
                text = bounded.text;
                pageNumber = 1;
                _b.label = 3;
            case 3:
                if (!(pageNumber <= bounded.totalPages)) return [3 /*break*/, 7];
                (0, bun_test_1.expect)(text).toContain("output truncated: page ".concat(pageNumber, "/").concat(bounded.totalPages));
                (0, bun_test_1.expect)(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(src_1.MAX_TOOL_OUTPUT_BYTES);
                (0, bun_test_1.expect)(text.split("\n").length).toBeLessThanOrEqual(src_1.MAX_TOOL_OUTPUT_LINES);
                // A page read through read_file must stay under the same limits, otherwise
                // the generic outer bound would paginate the page again.
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.boundToolOutput)(root, text)];
            case 4:
                // A page read through read_file must stay under the same limits, otherwise
                // the generic outer bound would paginate the page again.
                _a.apply(void 0, [_b.sent()]).toEqual({ text: text });
                if (pageNumber === bounded.totalPages) {
                    (0, bun_test_1.expect)(text).not.toContain("read_file(");
                    return [3 /*break*/, 7];
                }
                match = text.match(/read_file\((\{.*?\})\)/su);
                (0, bun_test_1.expect)(match).toBeDefined();
                next = JSON.parse(match[1]);
                nextPage = (0, node_path_1.join)(root, next.path);
                if (pageNumber === 1)
                    (0, bun_test_1.expect)(bounded.nextPagePath).toBe(nextPage);
                return [4 /*yield*/, (0, promises_1.readFile)(nextPage, "utf8")];
            case 5:
                text = _b.sent();
                _b.label = 6;
            case 6:
                pageNumber++;
                return [3 /*break*/, 3];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("long line-count output stays pageable across multiple pages", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, output, bounded, nextPage;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tool-output-lines-"))];
            case 1:
                root = _b.sent();
                output = Array.from({ length: 5000 }, function (_, index) { return "line ".concat(index); }).join("\n");
                return [4 /*yield*/, (0, src_1.boundToolOutput)(root, output)];
            case 2:
                bounded = _b.sent();
                (0, bun_test_1.expect)(bounded.truncated).toBe(true);
                (0, bun_test_1.expect)(bounded.totalPages).toBeGreaterThan(1);
                (0, bun_test_1.expect)(bounded.text).toContain("output truncated: page 1/");
                (0, bun_test_1.expect)(bounded.nextPagePath).toBeDefined();
                return [4 /*yield*/, (0, promises_1.readFile)(bounded.nextPagePath, "utf8")];
            case 3:
                nextPage = _b.sent();
                (0, bun_test_1.expect)(nextPage).toContain("output truncated: page 2/");
                (0, bun_test_1.expect)(nextPage.split("\n").length).toBeLessThanOrEqual(2000);
                if (((_a = bounded.totalPages) !== null && _a !== void 0 ? _a : 0) > 2)
                    (0, bun_test_1.expect)(nextPage).toContain(".page-0003.log");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("small tool output remains inline without a managed file", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tool-output-small-"))];
            case 1:
                root = _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.boundToolOutput)(root, "complete result")];
            case 2:
                _a.apply(void 0, [_b.sent()]).toEqual({
                    text: "complete result",
                });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("tool output cleanup removes only expired managed output files", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, directory, old, recent, unrelated, expired, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-tool-output-cleanup-"))];
            case 1:
                root = _d.sent();
                directory = (0, node_path_1.join)(root, ".natalia", "tool-output");
                old = (0, node_path_1.join)(directory, "tool-00000000-0000-0000-0000-000000000000.log");
                recent = (0, node_path_1.join)(directory, "tool-11111111-1111-1111-1111-111111111111.log");
                unrelated = (0, node_path_1.join)(directory, "keep.txt");
                return [4 /*yield*/, (0, src_1.boundToolOutput)(root, "x".repeat(src_1.MAX_TOOL_OUTPUT_BYTES + 1))];
            case 2:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(old, "old")];
            case 3:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(recent, "recent")];
            case 4:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(unrelated, "keep")];
            case 5:
                _d.sent();
                expired = new Date(Date.now() - src_1.TOOL_OUTPUT_RETENTION_MS - 1);
                return [4 /*yield*/, (0, promises_1.utimes)(old, expired, expired)];
            case 6:
                _d.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.cleanupToolOutput)(root)];
            case 7:
                _a.apply(void 0, [_d.sent()]).toBe(1);
                return [4 /*yield*/, (0, bun_test_1.expect)((0, promises_1.readFile)(old, "utf8")).rejects.toThrow()];
            case 8:
                _d.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)(recent, "utf8")];
            case 9:
                _b.apply(void 0, [_d.sent()]).toBe("recent");
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)(unrelated, "utf8")];
            case 10:
                _c.apply(void 0, [_d.sent()]).toBe("keep");
                return [2 /*return*/];
        }
    });
}); });
