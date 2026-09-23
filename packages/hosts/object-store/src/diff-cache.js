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
exports.DiffCache = void 0;
var node_crypto_1 = require("node:crypto");
/**
 * Persistent structured-diff cache layered on the object store.
 *
 * The object store already deduplicates file content; this cache prevents
 * recomputing tree-sitter/line diff for the same old/new pair across
 * checkpoint and sandbox operations.
 */
var DiffCache = /** @class */ (function () {
    function DiffCache(objects, namespace, maxEntries) {
        if (maxEntries === void 0) { maxEntries = 5000; }
        this.objects = objects;
        this.namespace = namespace;
        this.seenOrder = [];
        this.seen = new Set();
        this.maxEntries = maxEntries;
    }
    DiffCache.prototype.get = function (oldText, newText) {
        return __awaiter(this, void 0, void 0, function () {
            var key, entry;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        key = this.key(oldText, newText);
                        return [4 /*yield*/, this.objects.getMeta(key)];
                    case 1:
                        entry = _a.sent();
                        if (entry &&
                            entry.oldSha256 === this.hash(oldText) &&
                            entry.newSha256 === this.hash(newText)) {
                            this.touch(key);
                            return [2 /*return*/, {
                                    additions: entry.additions,
                                    deletions: entry.deletions,
                                    structured: entry.structured,
                                }];
                        }
                        return [2 /*return*/, undefined];
                }
            });
        });
    };
    DiffCache.prototype.set = function (oldText, newText, result) {
        return __awaiter(this, void 0, void 0, function () {
            var key;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        key = this.key(oldText, newText);
                        return [4 /*yield*/, this.objects.putMeta(key, {
                                oldSha256: this.hash(oldText),
                                newSha256: this.hash(newText),
                                additions: result.additions,
                                deletions: result.deletions,
                                structured: result.structured,
                            })];
                    case 1:
                        _a.sent();
                        this.touch(key);
                        return [2 /*return*/];
                }
            });
        });
    };
    DiffCache.prototype.touch = function (key) {
        if (!this.seen.has(key)) {
            if (this.seenOrder.length >= this.maxEntries) {
                var oldest = this.seenOrder.shift();
                if (oldest) {
                    this.seen.delete(oldest);
                    void this.objects.deleteMeta(oldest);
                }
            }
            this.seen.add(key);
            this.seenOrder.push(key);
            return;
        }
        var index = this.seenOrder.indexOf(key);
        if (index >= 0) {
            this.seenOrder.splice(index, 1);
            this.seenOrder.push(key);
        }
    };
    DiffCache.prototype.key = function (oldText, newText) {
        return "".concat(this.namespace, ":").concat(this.hash(oldText), ":").concat(this.hash(newText));
    };
    DiffCache.prototype.hash = function (text) {
        return (0, node_crypto_1.createHash)("sha256").update(text).digest("hex");
    };
    return DiffCache;
}());
exports.DiffCache = DiffCache;
