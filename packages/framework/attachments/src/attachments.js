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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ATTACHMENT_LIMITS = void 0;
exports.storeLocalAttachments = storeLocalAttachments;
exports.storeLocalAttachmentBytes = storeLocalAttachmentBytes;
exports.attachmentDataURL = attachmentDataURL;
exports.attachmentText = attachmentText;
exports.isTextAttachment = isTextAttachment;
exports.cleanupUnreferencedAttachments = cleanupUnreferencedAttachments;
exports.referencedAttachmentsForSessions = referencedAttachmentsForSessions;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var session_1 = require("@anthelia/session");
var image_scale_1 = require("./image-scale");
/** Reference limits from the attachment research pass; callers may override. */
exports.DEFAULT_ATTACHMENT_LIMITS = {
    maxImageBytes: 5 * 1024 * 1024,
    maxImagesPerMessage: 20,
    maxMessageImageBytes: 100 * 1024 * 1024,
    maxImagePixels: 40000000,
    maxImageLongEdge: image_scale_1.DEFAULT_MAX_IMAGE_LONG_EDGE,
};
function resolveAttachmentLimits(overrides) {
    return __assign(__assign({}, exports.DEFAULT_ATTACHMENT_LIMITS), overrides);
}
/**
 * Apply the one-time admission-time downscale. Returns the bytes and dimensions
 * that will be stored, which are the originals unless the image was over the
 * long-edge limit and the codec succeeded.
 *
 * Doing this before anything is written keeps the stored file, its sha256 and
 * its recorded dimensions in agreement — a caller that copies the source file
 * while reporting a scaled hash would disagree with itself.
 */
function prepareImageForStorage(input) {
    return __awaiter(this, void 0, void 0, function () {
        var scaled;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!input.dimensions)
                        return [2 /*return*/, { bytes: input.bytes, dimensions: undefined }];
                    return [4 /*yield*/, (0, image_scale_1.scaleImage)({
                            bytes: input.bytes,
                            mediaType: input.mediaType,
                            maxLongEdge: input.limits.maxImageLongEdge,
                        })];
                case 1:
                    scaled = _a.sent();
                    if (!scaled)
                        return [2 /*return*/, { bytes: input.bytes, dimensions: input.dimensions }];
                    return [2 /*return*/, {
                            bytes: scaled.bytes,
                            dimensions: { width: scaled.width, height: scaled.height },
                        }];
            }
        });
    });
}
function assertImageAdmission(input) {
    if (!input.mediaType.startsWith("image/"))
        throw new Error("attachment is not an image: ".concat(input.label));
    if (input.bytes.byteLength > input.limits.maxImageBytes)
        throw new Error("image attachment exceeds ".concat(input.limits.maxImageBytes, " bytes: ").concat(input.label));
    var dimensions = readImageDimensions(input.bytes, input.mediaType);
    if (!dimensions ||
        dimensions.width <= 0 ||
        dimensions.height <= 0 ||
        dimensions.width * dimensions.height > input.limits.maxImagePixels)
        throw new Error("image attachment exceeds pixel limit or has invalid dimensions: ".concat(input.label));
    return dimensions;
}
/**
 * True when `candidate` escapes `canonicalDir`. Both must already be realpath'd
 * so a symlinked root cannot make an in-dir path look like an escape. A real
 * escape is a leading ".." path SEGMENT or an absolute result (a different
 * drive on Windows); matching the whole first segment, not a ".." prefix, keeps
 * an in-dir name like "..config" from being misreported.
 *
 * The single confinement check for the attachment store and its readers — kept
 * in one place because the copies had drifted (a stale startsWith("..") form
 * survived in the readers after the store was corrected).
 */
function escapesDir(canonicalDir, candidate) {
    var rel = (0, node_path_1.relative)(canonicalDir, candidate);
    return (0, node_path_1.isAbsolute)(rel) || rel.split(/[/\\]/u)[0] === "..";
}
function storeLocalAttachments(input) {
    return __awaiter(this, void 0, void 0, function () {
        var root, store, limits, canonicalRoot, accepted, imageCount, imageBytes, _loop_1, _i, _a, path;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    root = (0, node_path_1.resolve)(input.workspaceRoot);
                    store = (0, node_path_1.join)(root, ".natalia", "attachments");
                    limits = resolveAttachmentLimits(input.limits);
                    return [4 /*yield*/, (0, promises_1.mkdir)(store, { recursive: true, mode: 448 })];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, (0, promises_1.realpath)(root)];
                case 2:
                    canonicalRoot = _b.sent();
                    accepted = [];
                    imageCount = 0;
                    imageBytes = 0;
                    _loop_1 = function (path) {
                        var source, info, bytes, _c, filename, mediaType, dimensions, prepared;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.resolve)(root, path))];
                                case 1:
                                    source = _d.sent();
                                    if (escapesDir(canonicalRoot, source))
                                        throw new Error("attachment path escapes workspace: ".concat(path));
                                    return [4 /*yield*/, (0, promises_1.stat)(source)];
                                case 2:
                                    info = _d.sent();
                                    if (!info.isFile())
                                        throw new Error("attachment is not a file: ".concat(path));
                                    _c = Uint8Array.bind;
                                    return [4 /*yield*/, Bun.file(source).arrayBuffer()];
                                case 3:
                                    bytes = new (_c.apply(Uint8Array, [void 0, _d.sent()]))();
                                    filename = (0, node_path_1.basename)(source);
                                    mediaType = mediaTypeForBytes(bytes, filename);
                                    if (!mediaType)
                                        throw new Error("attachment type is unsupported: ".concat(path));
                                    dimensions = mediaType.startsWith("image/")
                                        ? (function () {
                                            imageCount += 1;
                                            imageBytes += bytes.byteLength;
                                            if (imageCount > limits.maxImagesPerMessage)
                                                throw new Error("too many image attachments (max ".concat(limits.maxImagesPerMessage, ")"));
                                            if (imageBytes > limits.maxMessageImageBytes)
                                                throw new Error("image attachments exceed ".concat(limits.maxMessageImageBytes, " aggregate bytes"));
                                            return assertImageAdmission({
                                                bytes: bytes,
                                                mediaType: mediaType,
                                                label: path,
                                                limits: limits,
                                            });
                                        })()
                                        : undefined;
                                    return [4 /*yield*/, prepareImageForStorage({
                                            bytes: bytes,
                                            mediaType: mediaType,
                                            dimensions: dimensions,
                                            limits: limits,
                                        })];
                                case 4:
                                    prepared = _d.sent();
                                    accepted.push(__assign({ source: source, bytes: prepared.bytes, filename: filename, mediaType: mediaType, byteLength: prepared.bytes.byteLength }, (prepared.dimensions ? { dimensions: prepared.dimensions } : {})));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, _a = input.paths;
                    _b.label = 3;
                case 3:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    path = _a[_i];
                    return [5 /*yield**/, _loop_1(path)];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [4 /*yield*/, Promise.all(accepted.map(function (item) { return __awaiter(_this, void 0, void 0, function () {
                        var id, target;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    id = "att_".concat((0, node_crypto_1.randomUUID)().replace(/-/gu, ""));
                                    target = (0, node_path_1.join)(store, "".concat(id, "-").concat(item.filename));
                                    // Write the prepared bytes rather than copying the source: they differ
                                    // whenever the image was scaled, and the recorded sha256 hashes them.
                                    return [4 /*yield*/, (0, promises_1.writeFile)(target, item.bytes, { mode: 384 })];
                                case 1:
                                    // Write the prepared bytes rather than copying the source: they differ
                                    // whenever the image was scaled, and the recorded sha256 hashes them.
                                    _a.sent();
                                    return [2 /*return*/, __assign({ id: id, path: (0, node_path_1.relative)(root, target), filename: item.filename, mediaType: item.mediaType, byteLength: item.byteLength, sha256: (0, node_crypto_1.createHash)("sha256").update(item.bytes).digest("hex") }, (item.dimensions
                                            ? { width: item.dimensions.width, height: item.dimensions.height }
                                            : {}))];
                            }
                        });
                    }); }))];
                case 7: return [2 /*return*/, _b.sent()];
            }
        });
    });
}
function storeLocalAttachmentBytes(input) {
    return __awaiter(this, void 0, void 0, function () {
        var root, store, limits, filename, mediaType, dimensions, prepared, id, target;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    root = (0, node_path_1.resolve)(input.workspaceRoot);
                    store = (0, node_path_1.join)(root, ".natalia", "attachments");
                    limits = resolveAttachmentLimits(input.limits);
                    return [4 /*yield*/, (0, promises_1.mkdir)(store, { recursive: true, mode: 448 })];
                case 1:
                    _a.sent();
                    filename = (0, node_path_1.basename)(input.name || "attachment");
                    mediaType = mediaTypeForBytes(input.data, filename);
                    if (!mediaType)
                        throw new Error("attachment type is unsupported or does not match its bytes: ".concat(filename));
                    dimensions = mediaType.startsWith("image/")
                        ? assertImageAdmission({
                            bytes: input.data,
                            mediaType: mediaType,
                            label: filename,
                            limits: limits,
                        })
                        : undefined;
                    return [4 /*yield*/, prepareImageForStorage({
                            bytes: input.data,
                            mediaType: mediaType,
                            dimensions: dimensions,
                            limits: limits,
                        })];
                case 2:
                    prepared = _a.sent();
                    id = "att_".concat((0, node_crypto_1.randomUUID)().replace(/-/gu, ""));
                    target = (0, node_path_1.join)(store, "".concat(id, "-").concat(filename));
                    return [4 /*yield*/, (0, promises_1.writeFile)(target, prepared.bytes, { mode: 384 })];
                case 3:
                    _a.sent();
                    return [2 /*return*/, __assign({ id: id, path: (0, node_path_1.relative)(root, target), filename: filename, mediaType: mediaType, byteLength: prepared.bytes.byteLength, sha256: (0, node_crypto_1.createHash)("sha256").update(prepared.bytes).digest("hex") }, (prepared.dimensions
                            ? { width: prepared.dimensions.width, height: prepared.dimensions.height }
                            : {}))];
            }
        });
    });
}
function attachmentDataURL(workspaceRoot, attachment) {
    return __awaiter(this, void 0, void 0, function () {
        var root, path, store, bytes, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    root = (0, node_path_1.resolve)(workspaceRoot);
                    return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.resolve)(root, attachment.path))];
                case 1:
                    path = _b.sent();
                    return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.join)(root, ".natalia", "attachments"))];
                case 2:
                    store = _b.sent();
                    if (escapesDir(store, path))
                        throw new Error("attachment store path escapes root: ".concat(attachment.id));
                    _a = Uint8Array.bind;
                    return [4 /*yield*/, Bun.file(path).arrayBuffer()];
                case 3:
                    bytes = new (_a.apply(Uint8Array, [void 0, _b.sent()]))();
                    return [2 /*return*/, "data:".concat(attachment.mediaType, ";base64,").concat(Buffer.from(bytes).toString("base64"))];
            }
        });
    });
}
function attachmentText(workspaceRoot, attachment) {
    return __awaiter(this, void 0, void 0, function () {
        var root, path, store, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!isTextAttachment(attachment))
                        throw new Error("attachment is not text: ".concat(attachment.id));
                    root = (0, node_path_1.resolve)(workspaceRoot);
                    return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.resolve)(root, attachment.path))];
                case 1:
                    path = _c.sent();
                    return [4 /*yield*/, (0, promises_1.realpath)((0, node_path_1.join)(root, ".natalia", "attachments"))];
                case 2:
                    store = _c.sent();
                    if (escapesDir(store, path))
                        throw new Error("attachment store path escapes root: ".concat(attachment.id));
                    _b = (_a = new TextDecoder("utf-8", { fatal: true }))
                        .decode;
                    return [4 /*yield*/, Bun.file(path).arrayBuffer()];
                case 3: return [2 /*return*/, _b.apply(_a, [_c.sent()])
                        .replace(/\r\n/g, "\n")
                        .replace(/\r/g, "\n")];
            }
        });
    });
}
function isTextAttachment(attachment) {
    return (attachment.mediaType.startsWith("text/") ||
        attachment.mediaType === "application/json");
}
function cleanupUnreferencedAttachments(input) {
    return __awaiter(this, void 0, void 0, function () {
        var store, referenced, entries, orphaned;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    store = (0, node_path_1.join)((0, node_path_1.resolve)(input.workspaceRoot), ".natalia", "attachments");
                    referenced = new Set(input.attachments.map(function (attachment) { return (0, node_path_1.basename)(attachment.path); }));
                    return [4 /*yield*/, (0, promises_1.readdir)(store, { withFileTypes: true }).catch(function () { return []; })];
                case 1:
                    entries = _a.sent();
                    orphaned = entries.filter(function (entry) {
                        return entry.isFile() &&
                            entry.name.startsWith("att_") &&
                            !referenced.has(entry.name);
                    });
                    return [4 /*yield*/, Promise.all(orphaned.map(function (entry) { return (0, promises_1.rm)((0, node_path_1.join)(store, entry.name), { force: true }); }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/, orphaned.map(function (entry) { return entry.name; })];
            }
        });
    });
}
function referencedAttachmentsForSessions(sessions) {
    return sessions.flatMap(function (record) {
        var _a, _b;
        var checkpoint = __spreadArray([], record.events, true).reverse()
            .find(function (event) { return event.type === "context.checkpoint"; });
        var checkpointAttachments = (checkpoint === null || checkpoint === void 0 ? void 0 : checkpoint.type) === "context.checkpoint"
            ? checkpoint.snapshot.entries.flatMap(function (entry) { var _a; return (_a = entry.attachments) !== null && _a !== void 0 ? _a : []; })
            : [];
        return __spreadArray(__spreadArray(__spreadArray([], checkpointAttachments, true), (0, session_1.modelVisibleEvents)(record.events).flatMap(function (event) { var _a; return event.type === "turn.submitted" ? ((_a = event.attachments) !== null && _a !== void 0 ? _a : []) : []; }), true), ((_b = (_a = record.inbox) === null || _a === void 0 ? void 0 : _a.flatMap(function (input) { var _a; return (_a = input.attachments) !== null && _a !== void 0 ? _a : []; })) !== null && _b !== void 0 ? _b : []), true);
    });
}
function readImageDimensions(bytes, mediaType) {
    if (mediaType === "image/png")
        return pngDimensions(bytes);
    if (mediaType === "image/jpeg")
        return jpegDimensions(bytes);
    if (mediaType === "image/gif")
        return gifDimensions(bytes);
    if (mediaType === "image/webp")
        return webpDimensions(bytes);
    return undefined;
}
function pngDimensions(bytes) {
    if (bytes.length < 24 ||
        bytes[0] !== 0x89 ||
        bytes[1] !== 0x50 ||
        bytes[2] !== 0x4e ||
        bytes[3] !== 0x47 ||
        bytes[4] !== 0x0d ||
        bytes[5] !== 0x0a ||
        bytes[6] !== 0x1a ||
        bytes[7] !== 0x0a)
        return undefined;
    return {
        width: readUInt32BE(bytes, 16),
        height: readUInt32BE(bytes, 20),
    };
}
function gifDimensions(bytes) {
    if (bytes.length < 10 ||
        bytes[0] !== 0x47 ||
        bytes[1] !== 0x49 ||
        bytes[2] !== 0x46 ||
        bytes[3] !== 0x38 ||
        (bytes[4] !== 0x37 && bytes[4] !== 0x39) ||
        bytes[5] !== 0x61)
        return undefined;
    return {
        width: readUInt16LE(bytes, 6),
        height: readUInt16LE(bytes, 8),
    };
}
function jpegDimensions(bytes) {
    if (bytes.length < 4 ||
        bytes[0] !== 0xff ||
        bytes[1] !== 0xd8 ||
        bytes[2] !== 0xff)
        return undefined;
    var offset = 2;
    while (offset + 4 <= bytes.length) {
        if (bytes[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        var marker = bytes[offset + 1];
        if (marker === 0xff) {
            offset += 1;
            continue;
        }
        offset += 2;
        if (marker === 0xd8 ||
            marker === 0xd9 ||
            (marker >= 0xd0 && marker <= 0xd7))
            continue;
        if (marker === 0xda)
            break;
        if (offset + 2 > bytes.length)
            break;
        var length_1 = readUInt16BE(bytes, offset);
        if (length_1 < 2 || offset + length_1 > bytes.length)
            return undefined;
        var isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3) ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf);
        if (isStartOfFrame) {
            if (offset + 7 > bytes.length)
                return undefined;
            return {
                height: readUInt16BE(bytes, offset + 3),
                width: readUInt16BE(bytes, offset + 5),
            };
        }
        offset += length_1;
    }
    return undefined;
}
function webpDimensions(bytes) {
    if (bytes.length < 30 ||
        bytes[0] !== 0x52 ||
        bytes[1] !== 0x49 ||
        bytes[2] !== 0x46 ||
        bytes[3] !== 0x46 ||
        bytes[8] !== 0x57 ||
        bytes[9] !== 0x45 ||
        bytes[10] !== 0x42 ||
        bytes[11] !== 0x50)
        return undefined;
    var chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === "VP8X")
        return {
            width: 1 + readUInt24LE(bytes, 24),
            height: 1 + readUInt24LE(bytes, 27),
        };
    if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01) {
        if (bytes[25] !== 0x2a)
            return undefined;
        return {
            width: readUInt16LE(bytes, 26) & 0x3fff,
            height: readUInt16LE(bytes, 28) & 0x3fff,
        };
    }
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
        var header = readUInt32LE(bytes, 21);
        return {
            width: (header & 0x3fff) + 1,
            height: ((header >> 14) & 0x3fff) + 1,
        };
    }
    return undefined;
}
function readUInt16BE(bytes, offset) {
    return (bytes[offset] << 8) | bytes[offset + 1];
}
function readUInt32BE(bytes, offset) {
    return (bytes[offset] * 0x1000000 +
        ((bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3]));
}
function readUInt16LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
}
function readUInt24LE(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16));
}
function readUInt32LE(bytes, offset) {
    return (bytes[offset] +
        bytes[offset + 1] * 0x100 +
        bytes[offset + 2] * 0x10000 +
        bytes[offset + 3] * 0x1000000);
}
function mediaTypeForBytes(bytes, filename) {
    var header = __spreadArray([], bytes.slice(0, 8), true).map(function (byte) { return byte.toString(16).padStart(2, "0"); })
        .join("");
    if (header === "89504e470d0a1a0a")
        return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return "image/jpeg";
    if (bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50)
        return "image/webp";
    if (bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) &&
        bytes[5] === 0x61)
        return "image/gif";
    if (bytes[4] === 0x66 &&
        bytes[5] === 0x74 &&
        bytes[6] === 0x79 &&
        bytes[7] === 0x70)
        return "video/mp4";
    if (bytes[0] === 0x1a &&
        bytes[1] === 0x45 &&
        bytes[2] === 0xdf &&
        bytes[3] === 0xa3)
        return "video/webm";
    try {
        if (!/\.(txt|md|markdown|json|csv|log|yaml|yml|ts|tsx|js|jsx|py|go|rs|java|css|html|xml)$/iu.test(filename))
            return undefined;
        var text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        if (text.includes("\0"))
            return undefined;
        var trimmed = text.trimStart();
        if (trimmed.startsWith("{") || trimmed.startsWith("["))
            return "application/json";
        return "text/plain";
    }
    catch (_a) {
        // Non-UTF-8 binary is intentionally unsupported.
    }
    return undefined;
}
