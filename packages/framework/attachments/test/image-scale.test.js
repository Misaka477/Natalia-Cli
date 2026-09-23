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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var src_1 = require("../src");
/** A real PNG, so the codec has something decodable to work on. */
function makePng(width, height) {
    return __awaiter(this, void 0, void 0, function () {
        var encode, data, index, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("@jsquash/png"); })];
                case 1:
                    encode = (_b.sent()).encode;
                    data = new Uint8ClampedArray(width * height * 4);
                    for (index = 0; index < width * height; index += 1) {
                        data[index * 4] = index % 256;
                        data[index * 4 + 1] = (index * 3) % 256;
                        data[index * 4 + 2] = (index * 7) % 256;
                        data[index * 4 + 3] = 255;
                    }
                    _a = Uint8Array.bind;
                    return [4 /*yield*/, encode(new ImageData(data, width, height))];
                case 2: return [2 /*return*/, new (_a.apply(Uint8Array, [void 0, _b.sent()]))()];
            }
        });
    });
}
(0, bun_test_1.test)("scaleImage shrinks an oversized PNG down to the long-edge limit", function () { return __awaiter(void 0, void 0, void 0, function () {
    var png, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, makePng(320, 200)];
            case 1:
                png = _a.sent();
                return [4 /*yield*/, (0, src_1.scaleImage)({
                        bytes: png,
                        mediaType: "image/png",
                        maxLongEdge: 160,
                    })];
            case 2:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toBeDefined();
                (0, bun_test_1.expect)(Math.max(result.width, result.height)).toBe(160);
                // Aspect ratio preserved: 320x200 scaled by 160/320 keeps the 8:5 ratio.
                (0, bun_test_1.expect)(result.height).toBe(100);
                (0, bun_test_1.expect)(result.width).toBe(160);
                (0, bun_test_1.expect)(result.mediaType).toBe("image/png");
                // The whole point: the replacement bytes are smaller than what came in.
                (0, bun_test_1.expect)(result.bytes.byteLength).toBeLessThan(png.byteLength);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("scaleImage leaves an image that already fits untouched", function () { return __awaiter(void 0, void 0, void 0, function () {
    var png, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, makePng(40, 30)];
            case 1:
                png = _a.sent();
                return [4 /*yield*/, (0, src_1.scaleImage)({
                        bytes: png,
                        mediaType: "image/png",
                        maxLongEdge: src_1.DEFAULT_MAX_IMAGE_LONG_EDGE,
                    })];
            case 2:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("scaleImage never touches a GIF, which would need per-frame work", function () { return __awaiter(void 0, void 0, void 0, function () {
    var gif, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
                return [4 /*yield*/, (0, src_1.scaleImage)({
                        bytes: gif,
                        mediaType: "image/gif",
                        maxLongEdge: 8,
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("scaleImage is deterministic: the same bytes scale to the same output", function () { return __awaiter(void 0, void 0, void 0, function () {
    var png, options, first, second;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, makePng(300, 150)];
            case 1:
                png = _a.sent();
                options = { mediaType: "image/png", maxLongEdge: 100 };
                return [4 /*yield*/, (0, src_1.scaleImage)(__assign({ bytes: png }, options))];
            case 2:
                first = _a.sent();
                return [4 /*yield*/, (0, src_1.scaleImage)(__assign({ bytes: png }, options))];
            case 3:
                second = _a.sent();
                (0, bun_test_1.expect)(first).toBeDefined();
                (0, bun_test_1.expect)(second).toBeDefined();
                (0, bun_test_1.expect)(Array.from(second.bytes)).toEqual(Array.from(first.bytes));
                (0, bun_test_1.expect)(second.width).toBe(first.width);
                (0, bun_test_1.expect)(second.height).toBe(first.height);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("scaleImage falls back to the original bytes when the codec fails", function () { return __awaiter(void 0, void 0, void 0, function () {
    var broken, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                broken = new Uint8Array([
                    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48,
                    0x44, 0x52, 0, 0, 0, 0x0a, 0, 0, 0, 0x0a,
                ]);
                return [4 /*yield*/, (0, src_1.scaleImage)({
                        bytes: broken,
                        mediaType: "image/png",
                        maxLongEdge: 4,
                    })];
            case 1:
                result = _a.sent();
                (0, bun_test_1.expect)(result).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("storing an oversized image persists the scaled bytes and dimensions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, png, stored, onDisk, _a, dataURL, again;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-scale-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, makePng(320, 200)];
            case 2:
                png = _b.sent();
                return [4 /*yield*/, (0, src_1.storeLocalAttachmentBytes)({
                        workspaceRoot: root,
                        name: "big.png",
                        mediaType: "image/png",
                        data: png,
                        limits: { maxImageLongEdge: 160 },
                    })];
            case 3:
                stored = _b.sent();
                (0, bun_test_1.expect)(Math.max(stored.width, stored.height)).toBe(160);
                (0, bun_test_1.expect)(stored.height).toBe(100);
                _a = Uint8Array.bind;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(root, stored.path))];
            case 4:
                onDisk = new (_a.apply(Uint8Array, [void 0, _b.sent()]))();
                (0, bun_test_1.expect)(onDisk.byteLength).toBe(stored.byteLength);
                (0, bun_test_1.expect)(Bun.file((0, node_path_1.join)(root, stored.path)).size).toBe(stored.byteLength);
                (0, bun_test_1.expect)(onDisk.byteLength).toBeLessThan(png.byteLength);
                return [4 /*yield*/, (0, src_1.attachmentDataURL)(root, stored)];
            case 5:
                dataURL = _b.sent();
                return [4 /*yield*/, (0, src_1.attachmentDataURL)(root, stored)];
            case 6:
                again = _b.sent();
                // Prefix stability: the same attachment must resolve to the same bytes every
                // time, or every request after the first one misses the provider's cache.
                (0, bun_test_1.expect)(again).toBe(dataURL);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("storing from a path scales too, and records the scaled dimensions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, writeFile, _a, _b, stored;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-path-"))];
            case 1:
                root = _c.sent();
                return [4 /*yield*/, Promise.resolve().then(function () { return require("node:fs/promises"); })];
            case 2:
                writeFile = (_c.sent()).writeFile;
                _a = writeFile;
                _b = [(0, node_path_1.join)(root, "shot.png")];
                return [4 /*yield*/, makePng(400, 300)];
            case 3: return [4 /*yield*/, _a.apply(void 0, _b.concat([_c.sent()]))];
            case 4:
                _c.sent();
                return [4 /*yield*/, (0, src_1.storeLocalAttachments)({
                        workspaceRoot: root,
                        paths: ["shot.png"],
                        limits: { maxImageLongEdge: 160 },
                    })];
            case 5:
                stored = (_c.sent())[0];
                (0, bun_test_1.expect)(stored).toBeDefined();
                // 400x300 at a 160 long edge: factor 160/400, so height floors to 120.
                (0, bun_test_1.expect)(Math.max(stored.width, stored.height)).toBe(160);
                (0, bun_test_1.expect)(stored.height).toBe(120);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the long-edge limit is configurable", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, png, stored;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-limit-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, makePng(200, 100)];
            case 2:
                png = _a.sent();
                return [4 /*yield*/, (0, src_1.storeLocalAttachmentBytes)({
                        workspaceRoot: root,
                        name: "big.png",
                        mediaType: "image/png",
                        data: png,
                        limits: { maxImageLongEdge: 64 },
                    })];
            case 3:
                stored = _a.sent();
                (0, bun_test_1.expect)(Math.max(stored.width, stored.height)).toBe(64);
                (0, bun_test_1.expect)(src_1.DEFAULT_ATTACHMENT_LIMITS.maxImageLongEdge).toBe(src_1.DEFAULT_MAX_IMAGE_LONG_EDGE);
                return [2 /*return*/];
        }
    });
}); });
