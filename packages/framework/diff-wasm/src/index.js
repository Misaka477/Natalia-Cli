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
exports.loadWasmDiff = loadWasmDiff;
exports.diffWasm = diffWasm;
exports.parseDiffBinary = parseDiffBinary;
exports.diffWasmBinary = diffWasmBinary;
exports.diffWasmStructured = diffWasmStructured;
var engine;
var enginePromise;
function allocString(exports, text) {
    var bytes = new TextEncoder().encode(text);
    var ptr = exports.wasm_alloc(bytes.length);
    if (!ptr)
        throw new Error("wasm alloc failed");
    new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes);
    return { ptr: ptr, len: bytes.length };
}
function freeInputs(exports, old, new_, outLenPtr) {
    exports.wasm_dealloc(old.ptr, old.len);
    exports.wasm_dealloc(new_.ptr, new_.len);
    exports.wasm_dealloc(outLenPtr, 8);
}
function withWasm(oldText, newText, run) {
    return __awaiter(this, void 0, void 0, function () {
        var exports, old, new_, outLenPtr;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, loadWasmDiff()];
                case 1:
                    exports = _a.sent();
                    old = allocString(exports, oldText);
                    new_ = allocString(exports, newText);
                    outLenPtr = exports.wasm_alloc(8);
                    try {
                        run(exports, old, new_, outLenPtr);
                    }
                    finally {
                        freeInputs(exports, old, new_, outLenPtr);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function loadWasmDiff() {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (engine)
                        return [2 /*return*/, engine];
                    if (enginePromise)
                        return [2 /*return*/, enginePromise];
                    enginePromise = (function () { return __awaiter(_this, void 0, void 0, function () {
                        var url, source, module_1, _a, readFile, fileURLToPath, bytes, module_2;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    url = new URL("./natalia_diff_wasm.wasm", import.meta.url);
                                    _b.label = 1;
                                case 1:
                                    _b.trys.push([1, 4, , 9]);
                                    return [4 /*yield*/, fetch(url)];
                                case 2:
                                    source = _b.sent();
                                    return [4 /*yield*/, WebAssembly.instantiateStreaming(source, {})];
                                case 3:
                                    module_1 = _b.sent();
                                    return [2 /*return*/, module_1.instance.exports];
                                case 4:
                                    _a = _b.sent();
                                    return [4 /*yield*/, Promise.resolve().then(function () { return require("node:fs/promises"); })];
                                case 5:
                                    readFile = (_b.sent()).readFile;
                                    return [4 /*yield*/, Promise.resolve().then(function () { return require("node:url"); })];
                                case 6:
                                    fileURLToPath = (_b.sent()).fileURLToPath;
                                    return [4 /*yield*/, readFile(fileURLToPath(url))];
                                case 7:
                                    bytes = _b.sent();
                                    return [4 /*yield*/, WebAssembly.instantiate(bytes, {})];
                                case 8:
                                    module_2 = _b.sent();
                                    return [2 /*return*/, module_2.instance.exports];
                                case 9: return [2 /*return*/];
                            }
                        });
                    }); })();
                    return [4 /*yield*/, enginePromise];
                case 1:
                    engine = _a.sent();
                    return [2 /*return*/, engine];
            }
        });
    });
}
function diffWasm(oldText, newText) {
    return __awaiter(this, void 0, void 0, function () {
        var patch, additions, deletions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patch = "";
                    additions = 0;
                    deletions = 0;
                    return [4 /*yield*/, withWasm(oldText, newText, function (exports, old, new_, outLenPtr) {
                            var patchPtr = exports.wasm_diff(old.ptr, old.len, new_.ptr, new_.len, outLenPtr);
                            var outLen = new DataView(exports.memory.buffer, outLenPtr, 8).getUint32(0, true);
                            var length = Number(outLen);
                            patch = new TextDecoder().decode(new Uint8Array(exports.memory.buffer, patchPtr, length));
                            if (patchPtr && length)
                                exports.wasm_dealloc(patchPtr, length);
                            for (var _i = 0, _a = patch.split("\n"); _i < _a.length; _i++) {
                                var line = _a[_i];
                                if (line.startsWith("+") && !line.startsWith("+++"))
                                    additions++;
                                else if (line.startsWith("-") && !line.startsWith("---"))
                                    deletions++;
                            }
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { patch: patch, additions: additions, deletions: deletions }];
            }
        });
    });
}
var DIFF_BINARY_HEADER_SIZE = 48;
var DIFF_HUNK_RECORD_SIZE = 20;
var DIFF_LINE_RECORD_SIZE = 20;
var LINE_NONE = 0xffffffff;
/**
 * Decode the compact binary format produced by `wasm_diff_structured`.
 *
 * The binary contains the original old/new text blobs followed by hunk and
 * line records. Line text is reconstructed by line number from the decoded
 * full text, so no per-line string copies are necessary on the wire.
 */
function parseDiffBinary(binary) {
    var _a;
    var _b;
    var bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var magic = view.getUint32(0, true);
    if (magic !== 0x4e444946)
        throw new Error("invalid diff binary magic: 0x".concat(magic.toString(16)));
    var version = view.getUint32(4, true);
    if (version !== 1 && version !== 2)
        throw new Error("unsupported diff binary version: ".concat(version));
    var hunkCount = view.getUint32(8, true);
    var lineOpCount = view.getUint32(12, true);
    var additions = view.getUint32(16, true);
    var deletions = view.getUint32(20, true);
    var wordRangeCount = view.getUint32(24, true);
    var lineOpsOffset = view.getUint32(28, true);
    var textsOffset = view.getUint32(32, true);
    var textsLen = view.getUint32(36, true);
    var wordRangesOffset = view.getUint32(40, true);
    var textsBytes = bytes.subarray(textsOffset, textsOffset + textsLen);
    var hunkStart = 48;
    var hunks = [];
    var lines = [];
    var WORD_RANGE_SIZE = 16;
    for (var i = 0; i < lineOpCount; i++) {
        var offset = lineOpsOffset + i * DIFF_LINE_RECORD_SIZE;
        var kind = view.getUint32(offset, true);
        var oldLineRaw = view.getUint32(offset + 4, true);
        var newLineRaw = view.getUint32(offset + 8, true);
        var oldLineNumber = oldLineRaw === LINE_NONE ? null : oldLineRaw;
        var newLineNumber = newLineRaw === LINE_NONE ? null : newLineRaw;
        var type = kind === 1 ? "add" : kind === 2 ? "delete" : "context";
        var textOffset = view.getUint32(offset + 12, true);
        var textLen = view.getUint32(offset + 16, true);
        var text = new TextDecoder().decode(textsBytes.subarray(textOffset, textOffset + textLen));
        lines.push({ type: type, text: text, oldLineNumber: oldLineNumber, newLineNumber: newLineNumber });
    }
    for (var i = 0; i < wordRangeCount; i++) {
        var offset = wordRangesOffset + i * WORD_RANGE_SIZE;
        var lineIndex = view.getUint32(offset, true);
        var kind = view.getUint8(offset + 4);
        var start = view.getUint32(offset + 5, true);
        var end = view.getUint32(offset + 9, true);
        if (lineIndex < lineOpCount) {
            (_a = (_b = lines[lineIndex]).wordRanges) !== null && _a !== void 0 ? _a : (_b.wordRanges = []);
            lines[lineIndex].wordRanges.push({
                start: start,
                end: end,
                kind: kind === 1 ? "added" : "deleted",
            });
        }
    }
    var cursor = 0;
    for (var i = 0; i < hunkCount; i++) {
        var offset = hunkStart + i * DIFF_HUNK_RECORD_SIZE;
        var lineCount = view.getUint32(offset + 16, true);
        hunks.push({
            oldStart: view.getUint32(offset, true),
            oldCount: view.getUint32(offset + 4, true),
            newStart: view.getUint32(offset + 8, true),
            newCount: view.getUint32(offset + 12, true),
            lines: lines.slice(cursor, cursor + lineCount),
        });
        cursor += lineCount;
    }
    return { hunks: hunks, additions: additions, deletions: deletions };
}
/**
 * Returns the raw compact DiffBinary buffer produced by Rust/WASM.
 * This is the hot-path transport representation; callers may keep it as
 * ArrayBuffer or decode it with `parseDiffBinary`.
 */
function diffWasmBinary(oldText, newText, options) {
    return __awaiter(this, void 0, void 0, function () {
        var binary;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    binary = new Uint8Array(0);
                    return [4 /*yield*/, withWasm(oldText, newText, function (exports, old, new_, outLenPtr) {
                            var diffPtr = exports.wasm_diff_structured(old.ptr, old.len, new_.ptr, new_.len, (options === null || options === void 0 ? void 0 : options.ignoreWhitespace) ? 1 : 0, outLenPtr);
                            var outLen = new DataView(exports.memory.buffer, outLenPtr, 8).getUint32(0, true);
                            var len = Number(outLen);
                            if (!len)
                                return;
                            binary = new Uint8Array(exports.memory.buffer.slice(diffPtr, diffPtr + len));
                            if (diffPtr && len)
                                exports.wasm_dealloc(diffPtr, len);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, binary];
            }
        });
    });
}
function diffWasmStructured(oldText, newText, options) {
    return __awaiter(this, void 0, void 0, function () {
        var binary;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, diffWasmBinary(oldText, newText, options)];
                case 1:
                    binary = _a.sent();
                    return [2 /*return*/, parseDiffBinary(binary)];
            }
        });
    });
}
