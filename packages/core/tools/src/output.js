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
exports.TOOL_OUTPUT_RETENTION_MS = exports.MAX_TOOL_OUTPUT_LINES = exports.MAX_TOOL_OUTPUT_BYTES = void 0;
exports.boundToolOutput = boundToolOutput;
exports.cleanupToolOutput = cleanupToolOutput;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
exports.MAX_TOOL_OUTPUT_BYTES = 50 * 1024;
exports.MAX_TOOL_OUTPUT_LINES = 2000;
exports.TOOL_OUTPUT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Leave room in each page for the pagination marker. */
var PAGE_CONTENT_BYTES = exports.MAX_TOOL_OUTPUT_BYTES - 1024;
var PAGE_CONTENT_LINES = exports.MAX_TOOL_OUTPUT_LINES - 3;
function boundToolOutput(workspaceRoot, output) {
    return __awaiter(this, void 0, void 0, function () {
        var directory, id, outputPath, pages, totalPages, pagePaths, index, index;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (new TextEncoder().encode(output).byteLength <= exports.MAX_TOOL_OUTPUT_BYTES &&
                        output.split("\n").length <= exports.MAX_TOOL_OUTPUT_LINES)
                        return [2 /*return*/, { text: output }];
                    directory = (0, node_path_1.join)(workspaceRoot, ".natalia", "tool-output");
                    return [4 /*yield*/, (0, promises_1.mkdir)(directory, { recursive: true, mode: 448 })];
                case 1:
                    _a.sent();
                    id = (0, node_crypto_1.randomUUID)();
                    outputPath = (0, node_path_1.join)(directory, "tool-".concat(id, ".log"));
                    return [4 /*yield*/, (0, promises_1.writeFile)(outputPath, output, {
                            encoding: "utf8",
                            mode: 384,
                            flag: "wx",
                        })];
                case 2:
                    _a.sent();
                    pages = paginate(output, PAGE_CONTENT_BYTES, PAGE_CONTENT_LINES);
                    totalPages = pages.length;
                    pagePaths = [outputPath];
                    for (index = 1; index < totalPages; index += 1)
                        pagePaths.push((0, node_path_1.join)(directory, "tool-".concat(id, ".page-").concat(String(index + 1).padStart(4, "0"), ".log")));
                    index = 1;
                    _a.label = 3;
                case 3:
                    if (!(index < totalPages)) return [3 /*break*/, 6];
                    return [4 /*yield*/, (0, promises_1.writeFile)(pagePaths[index], pageWithMarker(pages[index], index, totalPages, pagePaths, outputPath, workspaceRoot), {
                            encoding: "utf8",
                            mode: 384,
                            flag: "wx",
                        })];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    index += 1;
                    return [3 /*break*/, 3];
                case 6: return [2 /*return*/, __assign(__assign({ text: pageWithMarker(pages[0], 0, totalPages, pagePaths, outputPath, workspaceRoot), outputPath: outputPath, truncated: true, page: 1, totalPages: totalPages }, (pagePaths[1] ? { nextPagePath: pagePaths[1] } : {})), { totalBytes: new TextEncoder().encode(output).byteLength })];
            }
        });
    });
}
function pageWithMarker(page, index, totalPages, pagePaths, outputPath, workspaceRoot) {
    var pageNumber = index + 1;
    var nextPagePath = pagePaths[index + 1];
    var fullPath = (0, node_path_1.relative)(workspaceRoot, outputPath);
    var marker = nextPagePath
        ? "... output truncated: page ".concat(pageNumber, "/").concat(totalPages, "; continue with read_file(").concat(JSON.stringify({ path: (0, node_path_1.relative)(workspaceRoot, nextPagePath) }), ") or read the full output at ").concat(fullPath, " ...")
        : "... output truncated: page ".concat(pageNumber, "/").concat(totalPages, "; end of full output (").concat(fullPath, ") ...");
    return "".concat(page, "\n\n").concat(marker);
}
function cleanupToolOutput(workspaceRoot_1) {
    return __awaiter(this, arguments, void 0, function (workspaceRoot, now) {
        var directory, entries, error_1, removed, _i, entries_1, entry, path, info;
        if (now === void 0) { now = Date.now(); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    directory = (0, node_path_1.join)(workspaceRoot, ".natalia", "tool-output");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, promises_1.readdir)(directory)];
                case 2:
                    entries = _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    if (error_1.code === "ENOENT")
                        return [2 /*return*/, 0];
                    throw error_1;
                case 4:
                    removed = 0;
                    _i = 0, entries_1 = entries;
                    _a.label = 5;
                case 5:
                    if (!(_i < entries_1.length)) return [3 /*break*/, 9];
                    entry = entries_1[_i];
                    if (!/^tool-[0-9a-f-]+(?:\.page-\d+)?\.log$/u.test(entry))
                        return [3 /*break*/, 8];
                    path = (0, node_path_1.join)(directory, entry);
                    return [4 /*yield*/, (0, promises_1.stat)(path)];
                case 6:
                    info = _a.sent();
                    if (now - info.mtimeMs < exports.TOOL_OUTPUT_RETENTION_MS)
                        return [3 /*break*/, 8];
                    return [4 /*yield*/, (0, promises_1.rm)(path)];
                case 7:
                    _a.sent();
                    removed++;
                    _a.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 5];
                case 9: return [2 /*return*/, removed];
            }
        });
    });
}
function paginate(output, maxBytes, maxLines) {
    var pages = [];
    var page = "";
    var bytes = 0;
    var lines = 1;
    for (var _i = 0, output_1 = output; _i < output_1.length; _i++) {
        var char = output_1[_i];
        var size = new TextEncoder().encode(char).byteLength;
        if (bytes + size > maxBytes || (char === "\n" && lines >= maxLines)) {
            pages.push(page);
            page = "";
            bytes = 0;
            lines = 1;
        }
        page += char;
        bytes += size;
        if (char === "\n")
            lines += 1;
    }
    if (page)
        pages.push(page);
    return pages;
}
