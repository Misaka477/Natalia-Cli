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
exports.createMemoryTransport = createMemoryTransport;
exports.createWebTransport = createWebTransport;
function createMemoryTransport(files) {
    if (files === void 0) { files = new Map(); }
    return {
        readFile: function (path) {
            return __awaiter(this, void 0, void 0, function () {
                var data;
                return __generator(this, function (_a) {
                    data = files.get(path);
                    if (!data)
                        throw new Error("file not found: ".concat(path));
                    return [2 /*return*/, data];
                });
            });
        },
        writeFile: function (path, data) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    files.set(path, data);
                    return [2 /*return*/];
                });
            });
        },
    };
}
function createWebTransport(files) {
    if (files === void 0) { files = new Map(); }
    return {
        readFile: function (path) {
            return __awaiter(this, void 0, void 0, function () {
                var data;
                return __generator(this, function (_a) {
                    data = files.get(path);
                    if (!data)
                        throw new Error("web transport cannot read ".concat(path));
                    return [2 /*return*/, data];
                });
            });
        },
        writeFile: function (path, data) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    files.set(path, data);
                    return [2 /*return*/];
                });
            });
        },
        openPath: function (path) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    throw new Error("web transport cannot open ".concat(path));
                });
            });
        },
        readClipboardImage: function () {
            return __awaiter(this, void 0, void 0, function () {
                var items, _i, items_1, item, type, blob, _a;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (typeof navigator === "undefined" || !((_b = navigator.clipboard) === null || _b === void 0 ? void 0 : _b.read))
                                return [2 /*return*/, undefined];
                            return [4 /*yield*/, navigator.clipboard.read()];
                        case 1:
                            items = _c.sent();
                            _i = 0, items_1 = items;
                            _c.label = 2;
                        case 2:
                            if (!(_i < items_1.length)) return [3 /*break*/, 6];
                            item = items_1[_i];
                            type = item.types.find(function (entry) { return entry.startsWith("image/"); });
                            if (!type)
                                return [3 /*break*/, 5];
                            return [4 /*yield*/, item.getType(type)];
                        case 3:
                            blob = _c.sent();
                            _a = Uint8Array.bind;
                            return [4 /*yield*/, blob.arrayBuffer()];
                        case 4: return [2 /*return*/, new (_a.apply(Uint8Array, [void 0, _c.sent()]))()];
                        case 5:
                            _i++;
                            return [3 /*break*/, 2];
                        case 6: return [2 /*return*/, undefined];
                    }
                });
            });
        },
    };
}
