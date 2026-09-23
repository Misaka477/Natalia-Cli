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
var src_2 = require("../src");
function pngBytes(width, height, totalBytes) {
    if (width === void 0) { width = 1; }
    if (height === void 0) { height = 1; }
    if (totalBytes === void 0) { totalBytes = 24; }
    var bytes = Buffer.alloc(totalBytes, 0x61);
    Buffer.from("89504e470d0a1a0a", "hex").copy(bytes, 0);
    bytes.writeUInt32BE(13, 8);
    bytes.write("IHDR", 12, "ascii");
    bytes.writeUInt32BE(width, 16);
    bytes.writeUInt32BE(height, 20);
    return bytes;
}
function webpBytes(width, height) {
    if (width === void 0) { width = 1; }
    if (height === void 0) { height = 1; }
    var bytes = Buffer.alloc(30);
    Buffer.from("524946460000000057454250", "hex").copy(bytes, 0);
    bytes.write("VP8L", 12, "ascii");
    bytes[20] = 0x2f;
    var header = (width - 1) | ((height - 1) << 14);
    bytes.writeUInt32LE(header, 21);
    return bytes;
}
(0, bun_test_1.test)("local attachment store rejects workspace escapes and extension spoofing", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, outside;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-store-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-outside-"))];
            case 2:
                outside = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "spoof.png"), "not an image")];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(outside, "image.png"), pngBytes())];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_2.storeLocalAttachments)({ workspaceRoot: root, paths: ["spoof.png"] })).rejects.toThrow("attachment type is unsupported")];
            case 5:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_2.storeLocalAttachments)({
                        workspaceRoot: root,
                        paths: [(0, node_path_1.join)(outside, "image.png")],
                    })).rejects.toThrow("attachment path escapes workspace")];
            case 6:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("attachment store accepts an in-workspace name that starts with '..'", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, stored;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-dotdot-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "..config.png"), pngBytes())];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_2.storeLocalAttachments)({
                        workspaceRoot: root,
                        paths: ["..config.png"],
                    })];
            case 3:
                stored = _a.sent();
                (0, bun_test_1.expect)(stored).toHaveLength(1);
                (0, bun_test_1.expect)(stored[0].filename).toBe("..config.png");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("attachment store accepts a workspace reached through a symlink", function () { return __awaiter(void 0, void 0, void 0, function () {
    var real, link, stored, dataURL;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-real-"))];
            case 1:
                real = _a.sent();
                link = "".concat(real, "-link");
                return [4 /*yield*/, (0, promises_1.symlink)(real, link)];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3:
                _a.trys.push([3, , 7, 9]);
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(real, "image.png"), pngBytes())];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, src_2.storeLocalAttachments)({
                        workspaceRoot: link,
                        paths: ["image.png"],
                    })];
            case 5:
                stored = _a.sent();
                (0, bun_test_1.expect)(stored).toHaveLength(1);
                (0, bun_test_1.expect)(stored[0].filename).toBe("image.png");
                return [4 /*yield*/, (0, src_2.attachmentDataURL)(link, stored[0])];
            case 6:
                dataURL = _a.sent();
                (0, bun_test_1.expect)(dataURL.startsWith("data:image/png;base64,")).toBe(true);
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, (0, promises_1.rm)(link, { recursive: true, force: true })];
            case 8:
                _a.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("attachment cleanup removes only unreferenced Natalia attachment files", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, attachment, store, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-cleanup-"))];
            case 1:
                root = _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "image.png"), pngBytes())];
            case 2:
                _d.sent();
                return [4 /*yield*/, (0, src_2.storeLocalAttachments)({
                        workspaceRoot: root,
                        paths: ["image.png"],
                    })];
            case 3:
                attachment = (_d.sent())[0];
                store = (0, node_path_1.join)(root, ".natalia", "attachments");
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(store, "att_orphan.png"), "orphan")];
            case 4:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(store, "user-note.txt"), "do not delete")];
            case 5:
                _d.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_2.cleanupUnreferencedAttachments)({
                        workspaceRoot: root,
                        attachments: [attachment],
                    })];
            case 6:
                _a.apply(void 0, [_d.sent()]).toEqual(["att_orphan.png"]);
                _b = bun_test_1.expect;
                return [4 /*yield*/, Bun.file((0, node_path_1.join)(store, "att_orphan.png")).exists()];
            case 7:
                _b.apply(void 0, [_d.sent()]).toBe(false);
                _c = bun_test_1.expect;
                return [4 /*yield*/, Bun.file((0, node_path_1.join)(store, "user-note.txt")).exists()];
            case 8:
                _c.apply(void 0, [_d.sent()]).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("local attachment store derives a private data URL from validated bytes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, attachment, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-data-url-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "image.png"), pngBytes())];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, src_2.storeLocalAttachments)({
                        workspaceRoot: root,
                        paths: ["image.png"],
                    })];
            case 3:
                attachment = (_b.sent())[0];
                (0, bun_test_1.expect)(attachment).toBeDefined();
                (0, bun_test_1.expect)(attachment).toMatchObject({ width: 1, height: 1 });
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_2.attachmentDataURL)(root, attachment)];
            case 4:
                _a.apply(void 0, [_b.sent()]).toMatch(/^data:image\/png;base64,/u);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("local attachment store rejects PDF attachments", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-pdf-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "doc.pdf"), "%PDF-1.7 fake")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_2.storeLocalAttachments)({
                        workspaceRoot: root,
                        paths: ["doc.pdf"],
                    })).rejects.toThrow(/unsupported/u)];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("local attachment store recognizes webp, gif, mp4 and webm signatures", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, cases, _i, cases_1, _a, filename, bytes, expected, attachment;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-media-"))];
            case 1:
                root = _b.sent();
                cases = [
                    ["pic.webp", webpBytes(), "image/webp"],
                    ["anim.gif", Buffer.from("47494638396101000100", "hex"), "image/gif"],
                    ["clip.mp4", Buffer.from("000000186674797000000000", "hex"), "video/mp4"],
                    ["clip.webm", Buffer.from("1a45dfa3", "hex"), "video/webm"],
                ];
                _i = 0, cases_1 = cases;
                _b.label = 2;
            case 2:
                if (!(_i < cases_1.length)) return [3 /*break*/, 6];
                _a = cases_1[_i], filename = _a[0], bytes = _a[1], expected = _a[2];
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, filename), bytes)];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, src_2.storeLocalAttachments)({
                        workspaceRoot: root,
                        paths: [filename],
                    })];
            case 4:
                attachment = (_b.sent())[0];
                (0, bun_test_1.expect)(attachment.mediaType, filename).toBe(expected);
                _b.label = 5;
            case 5:
                _i++;
                return [3 /*break*/, 2];
            case 6: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("image attachments enforce per-file, count, aggregate, and pixel limits", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, big, tooManyPixels, small, aggregateA, aggregateB;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-limits-"))];
            case 1:
                root = _a.sent();
                big = pngBytes(1, 1, 5 * 1024 * 1024 + 1);
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "big.png"), big)];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_2.storeLocalAttachments)({ workspaceRoot: root, paths: ["big.png"] })).rejects.toThrow("exceeds 5242880 bytes")];
            case 3:
                _a.sent();
                tooManyPixels = pngBytes(7000, 7000);
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "pixels.png"), tooManyPixels)];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_2.storeLocalAttachments)({ workspaceRoot: root, paths: ["pixels.png"] })).rejects.toThrow("pixel limit")];
            case 5:
                _a.sent();
                small = pngBytes();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "small.png"), small)];
            case 6:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_2.storeLocalAttachments)({
                        workspaceRoot: root,
                        paths: Array.from({ length: 21 }, function () { return "small.png"; }),
                    })).rejects.toThrow("too many image attachments (max 20)")];
            case 7:
                _a.sent();
                aggregateA = pngBytes(1, 1, 4 * 1024 * 1024);
                aggregateB = pngBytes(1, 1, 4 * 1024 * 1024);
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "aggregate-a.png"), aggregateA)];
            case 8:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "aggregate-b.png"), aggregateB)];
            case 9:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_2.storeLocalAttachments)({
                        workspaceRoot: root,
                        paths: ["aggregate-a.png", "aggregate-b.png"],
                        limits: { maxMessageImageBytes: 6 * 1024 * 1024 },
                    })).rejects.toThrow("exceed 6291456 aggregate bytes")];
            case 10:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("text attachments remain outside the image ceiling", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, text, textAttachment, read;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-large-"))];
            case 1:
                root = _a.sent();
                text = Buffer.alloc(2 * 1024 * 1024, 0x61);
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "big.txt"), text)];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, src_2.storeLocalAttachments)({
                        workspaceRoot: root,
                        paths: ["big.txt"],
                    })];
            case 3:
                textAttachment = (_a.sent())[0];
                (0, bun_test_1.expect)(textAttachment.mediaType).toBe("text/plain");
                return [4 /*yield*/, (0, src_2.attachmentText)(root, textAttachment)];
            case 4:
                read = _a.sent();
                (0, bun_test_1.expect)(read.length).toBe(2 * 1024 * 1024);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("attachment.upload bytes are sniffed and bounded before storage", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, service, stored;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-bytes-"))];
            case 1:
                root = _a.sent();
                service = (0, src_2.createAttachmentService)(root);
                return [4 /*yield*/, (0, bun_test_1.expect)(service.storeBytes({
                        name: "spoof.png",
                        mediaType: "image/png",
                        data: Buffer.from("not an image"),
                    })).rejects.toThrow("unsupported or does not match")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(service.storeBytes({
                        name: "too-big.png",
                        mediaType: "image/png",
                        data: pngBytes(1, 1, 5 * 1024 * 1024 + 1),
                    })).rejects.toThrow("exceeds 5242880 bytes")];
            case 3:
                _a.sent();
                return [4 /*yield*/, service.storeBytes({
                        name: "ok.png",
                        mediaType: "image/png",
                        data: pngBytes(2, 3),
                    })];
            case 4:
                stored = _a.sent();
                (0, bun_test_1.expect)(stored).toMatchObject({ width: 2, height: 3 });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("local attachment store admits bounded UTF-8 text with a durable filename", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, attachment, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-text-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "notes.md"), "# Notes\r\nhello\r\n")];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, src_2.storeLocalAttachments)({
                        workspaceRoot: root,
                        paths: ["notes.md"],
                    })];
            case 3:
                attachment = (_b.sent())[0];
                (0, bun_test_1.expect)(attachment).toMatchObject({
                    filename: "notes.md",
                    mediaType: "text/plain",
                });
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_2.attachmentText)(root, attachment)];
            case 4:
                _a.apply(void 0, [_b.sent()]).toBe("# Notes\nhello\n");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("attachment service is a framework service with a durable store", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, service, attachment, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-attachment-service-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "image.png"), pngBytes())];
            case 2:
                _b.sent();
                service = (0, src_2.createAttachmentService)(root);
                (0, bun_test_1.expect)(src_1.attachmentService.id).toBe("attachment.service");
                (0, bun_test_1.expect)(service.store).toBeTypeOf("function");
                (0, bun_test_1.expect)(service.dataURL).toBeTypeOf("function");
                (0, bun_test_1.expect)(service.text).toBeTypeOf("function");
                (0, bun_test_1.expect)(service.cleanup).toBeTypeOf("function");
                (0, bun_test_1.expect)(service.referencedForSessions).toBeTypeOf("function");
                return [4 /*yield*/, service.store(["image.png"])];
            case 3:
                attachment = (_b.sent())[0];
                (0, bun_test_1.expect)(attachment).toBeDefined();
                _a = bun_test_1.expect;
                return [4 /*yield*/, service.dataURL(attachment)];
            case 4:
                _a.apply(void 0, [_b.sent()]).toMatch(/^data:image\/png;base64,/u);
                return [2 /*return*/];
        }
    });
}); });
