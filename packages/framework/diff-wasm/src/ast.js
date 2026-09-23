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
exports.SUPPORTED_AST_LANGUAGES = void 0;
exports.loadAstWasm = loadAstWasm;
exports.parseAstDiffBinary = parseAstDiffBinary;
exports.diffWasmAst = diffWasmAst;
exports.parseAstIndexBinary = parseAstIndexBinary;
exports.indexWasmAst = indexWasmAst;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_url_1 = require("node:url");
var node_wasi_1 = require("node:wasi");
var astCache = new Map();
var astIndexCache = new Map();
var AST_CACHE_MAX = 128;
function astCacheKey(language, oldText, newText) {
    var hash = (0, node_crypto_1.createHash)("sha256")
        .update(oldText)
        .update("\0")
        .update(newText)
        .digest("hex");
    return "".concat(language, "|").concat(oldText.length, "|").concat(newText.length, "|").concat(hash);
}
function astIndexCacheKey(language, source) {
    var hash = (0, node_crypto_1.createHash)("sha256").update(source).digest("hex");
    return "".concat(language, "|").concat(source.length, "|").concat(hash);
}
var PACK_BY_LANGUAGE = {
    javascript: "javascript",
    js: "javascript",
    typescript: "typescript",
    ts: "typescript",
    tsx: "tsx",
    python: "python",
    py: "python",
    go: "go",
    rust: "rust",
    rs: "rust",
    json: "json",
    c: "c",
    h: "c",
    cpp: "cpp",
    cxx: "cpp",
    cc: "cpp",
    hpp: "cpp",
    java: "java",
    csharp: "csharp",
    cs: "csharp",
    bash: "bash",
    sh: "bash",
    ruby: "ruby",
    rb: "ruby",
    php: "php",
    css: "css",
    scss: "css",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    html: "xml",
    lua: "lua",
    scala: "scala",
    swift: "swift",
    elixir: "elixir",
    haskell: "haskell",
    hs: "haskell",
    nix: "nix",
    zig: "zig",
    elm: "elm",
    fsharp: "fsharp",
    fs: "fsharp",
    ocaml: "ocaml",
    ml: "ocaml",
    r: "r",
    julia: "julia",
    dart: "dart",
    clojure: "clojure",
    clj: "clojure",
    toml: "toml",
    sql: "sql",
    cmake: "cmake",
    fish: "fish",
    make: "make",
    makefile: "make",
    perl: "perl",
    pl: "perl",
    proto: "proto",
    protobuf: "proto",
    racket: "racket",
    rkt: "racket",
    scheme: "scheme",
    scm: "scheme",
    verilog: "verilog",
    v: "verilog",
    vhdl: "vhdl",
    pascal: "pascal",
    pas: "pascal",
    objc: "objc",
    "objective-c": "objc",
    m: "objc",
};
/** Canonical supported AST language set. Runtime refactor/apply must use this. */
exports.SUPPORTED_AST_LANGUAGES = Object.keys(PACK_BY_LANGUAGE);
var packInstances = new Map();
var packPromises = new Map();
var instance;
var instancePromise;
function allocString(exports, text) {
    var bytes = new TextEncoder().encode(text);
    var ptr = exports.wasm_alloc(bytes.length);
    if (!ptr)
        throw new Error("ast wasm alloc failed");
    new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes);
    return { ptr: ptr, len: bytes.length };
}
function loadAstWasm(language) {
    return __awaiter(this, void 0, void 0, function () {
        var pack, cached, pending, promise, resolved;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pack = (language && PACK_BY_LANGUAGE[language]) || language || "javascript";
                    cached = packInstances.get(pack);
                    if (cached)
                        return [2 /*return*/, cached];
                    pending = packPromises.get(pack);
                    if (pending)
                        return [2 /*return*/, pending];
                    promise = (function () { return __awaiter(_this, void 0, void 0, function () {
                        var fileName, url, bytes, wasi, wasmInstance;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    fileName = "".concat(pack, ".wasm");
                                    url = new URL("../ast/".concat(fileName), import.meta.url);
                                    return [4 /*yield*/, (0, promises_1.readFile)((0, node_url_1.fileURLToPath)(url))];
                                case 1:
                                    bytes = _a.sent();
                                    wasi = new node_wasi_1.WASI({
                                        version: "preview1",
                                        args: [],
                                        env: {},
                                        preopens: {},
                                    });
                                    return [4 /*yield*/, WebAssembly.instantiate(bytes, {
                                            wasi_snapshot_preview1: wasi.wasiImport,
                                        })];
                                case 2:
                                    wasmInstance = (_a.sent()).instance;
                                    try {
                                        wasi.start(wasmInstance);
                                    }
                                    catch (_b) {
                                        // Reactor-style module: no _start, memory already initialized by start.
                                    }
                                    return [2 /*return*/, wasmInstance.exports];
                            }
                        });
                    }); })();
                    packPromises.set(pack, promise);
                    return [4 /*yield*/, promise];
                case 1:
                    resolved = _a.sent();
                    packInstances.set(pack, resolved);
                    packPromises.delete(pack);
                    return [2 /*return*/, resolved];
            }
        });
    });
}
var AST_HEADER = 0x54534441;
var AST_VERSION = 1;
function parseAstDiffBinary(binary) {
    var bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== AST_HEADER)
        throw new Error("invalid AST diff binary magic");
    if (view.getUint32(4, true) !== AST_VERSION)
        throw new Error("unsupported AST diff binary version");
    var count = view.getUint32(8, true);
    var changes = [];
    var offset = 12;
    for (var i = 0; i < count; i++) {
        var kind = view.getUint8(offset);
        offset += 1;
        var oldStart = view.getUint32(offset, true);
        var oldEnd = view.getUint32(offset + 4, true);
        var newStart = view.getUint32(offset + 8, true);
        var newEnd = view.getUint32(offset + 12, true);
        var kindLen = view.getUint32(offset + 16, true);
        offset += 20;
        var nodeKind = new TextDecoder().decode(bytes.subarray(offset, offset + kindLen));
        offset += kindLen;
        var textLen = view.getUint32(offset, true);
        offset += 4;
        var nodeText = new TextDecoder().decode(bytes.subarray(offset, offset + textLen));
        offset += textLen;
        changes.push({
            kind: kind === 1
                ? "added"
                : kind === 2
                    ? "removed"
                    : kind === 3
                        ? "moved"
                        : "modified",
            nodeKind: nodeKind,
            nodeText: nodeText,
            oldStart: oldStart,
            oldEnd: oldEnd,
            newStart: newStart,
            newEnd: newEnd,
        });
    }
    return { language: "", changes: changes };
}
function diffWasmAst(oldText, newText, language) {
    return __awaiter(this, void 0, void 0, function () {
        var key, cached, promise, first;
        var _this = this;
        return __generator(this, function (_a) {
            if (!Object.hasOwn(PACK_BY_LANGUAGE, language)) {
                // Keep the UI's AST view useful for languages we do not ship a parser for:
                // it is not an error, just an empty structural diff.
                return [2 /*return*/, { language: language, changes: [] }];
            }
            key = astCacheKey(language, oldText, newText);
            cached = astCache.get(key);
            if (cached)
                return [2 /*return*/, cached];
            promise = (function () { return __awaiter(_this, void 0, void 0, function () {
                var exports, old, new_, lang, outLenPtr, resultPtr, resultLen, outLen, binary;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, loadAstWasm(language)];
                        case 1:
                            exports = _a.sent();
                            old = allocString(exports, oldText);
                            new_ = allocString(exports, newText);
                            lang = allocString(exports, language);
                            outLenPtr = exports.wasm_alloc(8);
                            resultPtr = 0;
                            resultLen = 0;
                            try {
                                resultPtr = exports.wasm_ast_diff(old.ptr, old.len, new_.ptr, new_.len, lang.ptr, lang.len, outLenPtr);
                                outLen = new DataView(exports.memory.buffer, outLenPtr, 8).getUint32(0, true);
                                resultLen = Number(outLen);
                                binary = new Uint8Array(exports.memory.buffer.slice(resultPtr, resultPtr + resultLen));
                                return [2 /*return*/, __assign(__assign({}, parseAstDiffBinary(binary)), { language: language })];
                            }
                            finally {
                                if (resultPtr && resultLen)
                                    exports.wasm_dealloc(resultPtr, resultLen);
                                exports.wasm_dealloc(old.ptr, old.len);
                                exports.wasm_dealloc(new_.ptr, new_.len);
                                exports.wasm_dealloc(lang.ptr, lang.len);
                                exports.wasm_dealloc(outLenPtr, 8);
                            }
                            return [2 /*return*/];
                    }
                });
            }); })();
            astCache.set(key, promise);
            if (astCache.size > AST_CACHE_MAX) {
                first = astCache.keys().next().value;
                if (first !== undefined)
                    astCache.delete(first);
            }
            return [2 /*return*/, promise];
        });
    });
}
var AST_INDEX_HEADER = 0x49535441;
var AST_INDEX_VERSION = 1;
function parseAstIndexBinary(binary) {
    var bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== AST_INDEX_HEADER)
        throw new Error("invalid AST index binary magic");
    if (view.getUint32(4, true) !== AST_INDEX_VERSION)
        throw new Error("unsupported AST index binary version");
    var count = view.getUint32(8, true);
    var nodes = [];
    var offset = 12;
    for (var i = 0; i < count; i++) {
        var start = view.getUint32(offset, true);
        var end = view.getUint32(offset + 4, true);
        var kindLen = view.getUint32(offset + 8, true);
        offset += 12;
        var nodeKind = new TextDecoder().decode(bytes.subarray(offset, offset + kindLen));
        offset += kindLen;
        var textLen = view.getUint32(offset, true);
        offset += 4;
        var text = new TextDecoder().decode(bytes.subarray(offset, offset + textLen));
        offset += textLen;
        nodes.push({ nodeKind: nodeKind, text: text, start: start, end: end });
    }
    return { language: "", nodes: nodes };
}
function indexWasmAst(source, language) {
    return __awaiter(this, void 0, void 0, function () {
        var key, cached, promise, first;
        var _this = this;
        return __generator(this, function (_a) {
            if (!Object.hasOwn(PACK_BY_LANGUAGE, language))
                return [2 /*return*/, { language: language, nodes: [] }];
            key = astIndexCacheKey(language, source);
            cached = astIndexCache.get(key);
            if (cached)
                return [2 /*return*/, cached];
            promise = (function () { return __awaiter(_this, void 0, void 0, function () {
                var exports, src, lang, outLenPtr, resultPtr, resultLen, outLen, binary;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, loadAstWasm(language)];
                        case 1:
                            exports = _a.sent();
                            src = allocString(exports, source);
                            lang = allocString(exports, language);
                            outLenPtr = exports.wasm_alloc(8);
                            resultPtr = 0;
                            resultLen = 0;
                            try {
                                resultPtr = exports.wasm_ast_index(src.ptr, src.len, lang.ptr, lang.len, outLenPtr);
                                outLen = new DataView(exports.memory.buffer, outLenPtr, 8).getUint32(0, true);
                                resultLen = Number(outLen);
                                binary = new Uint8Array(exports.memory.buffer.slice(resultPtr, resultPtr + resultLen));
                                return [2 /*return*/, __assign(__assign({}, parseAstIndexBinary(binary)), { language: language })];
                            }
                            finally {
                                if (resultPtr && resultLen)
                                    exports.wasm_dealloc(resultPtr, resultLen);
                                exports.wasm_dealloc(src.ptr, src.len);
                                exports.wasm_dealloc(lang.ptr, lang.len);
                                exports.wasm_dealloc(outLenPtr, 8);
                            }
                            return [2 /*return*/];
                    }
                });
            }); })();
            astIndexCache.set(key, promise);
            if (astIndexCache.size > AST_CACHE_MAX) {
                first = astIndexCache.keys().next().value;
                if (first !== undefined)
                    astIndexCache.delete(first);
            }
            return [2 /*return*/, promise];
        });
    });
}
