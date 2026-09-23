"use strict";
/**
 * Deterministic image downscaling for attachments.
 *
 * Why scale at admission instead of at dispatch: a dispatch-time decision has
 * to read the request's remaining byte budget, and every input to that
 * arithmetic (inline fallback, quantum size, compaction, route switch) moves
 * between requests. An image that was inlined on one request and dropped on the
 * next rewrites history, so the provider's prefix cache misses on every turn.
 * Scaling once here, against a fixed target, and persisting the result removes
 * the per-request decision entirely: the stored bytes are the attachment's
 * representation for life, and the prefix cannot move because of them.
 *
 * The target is the provider's own threshold rather than a number we invented.
 * Anthropic resamples any image whose long edge exceeds 1568px and rejects
 * anything above roughly 1.15 MP, so an image over that edge is going to be
 * resampled anyway — scaling it here costs us deterministic bytes we control
 * instead of full-size bytes the provider then reduces lossily.
 */
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
exports.DEFAULT_MAX_IMAGE_LONG_EDGE = void 0;
exports.scaleImage = scaleImage;
var runtime_services_1 = require("@natalia/runtime-services");
/**
 * Pinned knobs. Nothing here may read runtime state: the same input bytes with
 * the same limits must produce the same output bytes, or two admissions of one
 * file could disagree and a resumed session would see a different prefix.
 */
var RESIZE_METHOD = "lanczos3";
var FIT_METHOD = "contain";
/** Longest edge allowed before an image is scaled down. Anthropic's own threshold. */
exports.DEFAULT_MAX_IMAGE_LONG_EDGE = 1568;
/** Media types this module can decode, resize and re-encode. */
var SCALABLE_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
/**
 * Scale an image down so its longest edge is at most `maxLongEdge`, preserving
 * aspect ratio. Returns `undefined` when nothing is worth doing: the media type
 * is not scalable here (animated GIF included — per-frame work is a different
 * problem), the image already fits, or the codec failed.
 *
 * A codec failure returns `undefined` rather than throwing, so a WASM problem
 * can never fail an attachment the user legitimately attached. The original
 * bytes are themselves a stable representation, so falling back to them costs
 * size, not correctness.
 *
 * The media type never changes. Re-encoding a PNG as JPEG would shrink it far
 * more, but it would also make the stored representation a policy decision
 * rather than a property of the file; keeping the format means one less thing
 * that has to be pinned to stay deterministic.
 */
function scaleImage(input) {
    return __awaiter(this, void 0, void 0, function () {
        var longEdge, codec, source, longest, factor, targetWidth, targetHeight, resize, resized, encoded, bytes, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!SCALABLE_MEDIA_TYPES.has(input.mediaType))
                        return [2 /*return*/, undefined];
                    longEdge = Math.max(1, Math.floor(input.maxLongEdge));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    return [4 /*yield*/, loadCodec(input.mediaType)];
                case 2:
                    codec = _a.sent();
                    return [4 /*yield*/, codec.decode(input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength))];
                case 3:
                    source = _a.sent();
                    longest = Math.max(source.width, source.height);
                    if (longest <= longEdge)
                        return [2 /*return*/, undefined];
                    factor = longEdge / longest;
                    targetWidth = Math.max(1, Math.floor(source.width * factor));
                    targetHeight = Math.max(1, Math.floor(source.height * factor));
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@jsquash/resize"); })];
                case 4:
                    resize = (_a.sent()).default;
                    return [4 /*yield*/, resize(source, {
                            width: targetWidth,
                            height: targetHeight,
                            method: RESIZE_METHOD,
                            fitMethod: FIT_METHOD,
                            premultiply: true,
                            linearRGB: true,
                        })];
                case 5:
                    resized = _a.sent();
                    return [4 /*yield*/, codec.encode(resized)];
                case 6:
                    encoded = _a.sent();
                    bytes = new Uint8Array(encoded);
                    return [2 /*return*/, {
                            bytes: bytes,
                            width: resized.width,
                            height: resized.height,
                            mediaType: input.mediaType,
                        }];
                case 7:
                    error_1 = _a.sent();
                    // Keep the failure visible without failing the attachment.
                    (0, runtime_services_1.perfLog)("[attachments] image scaling failed; storing the original bytes", {
                        mediaType: input.mediaType,
                        error: error_1 instanceof Error ? error_1.message : String(error_1),
                    });
                    return [2 /*return*/, undefined];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function loadCodec(mediaType) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(mediaType === "image/png")) return [3 /*break*/, 2];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@jsquash/png"); })];
                case 1: return [2 /*return*/, (_a.sent())];
                case 2:
                    if (!(mediaType === "image/jpeg")) return [3 /*break*/, 4];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@jsquash/jpeg"); })];
                case 3: return [2 /*return*/, (_a.sent())];
                case 4: return [4 /*yield*/, Promise.resolve().then(function () { return require("@jsquash/webp"); })];
                case 5: return [2 /*return*/, (_a.sent())];
            }
        });
    });
}
